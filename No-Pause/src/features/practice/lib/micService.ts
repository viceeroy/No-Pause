export type MicInitOptions = {
  constraints?: MediaTrackConstraints;
};

type ConsoleArgs = unknown[];
type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
type AudioTrackWithStopMarker = MediaStreamTrack & {
  __micStopWrapped?: boolean;
};
type MediaTrackSettingsWithSampleRate = MediaTrackSettings & {
  sampleRate?: number;
};

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const IS_ANDROID = /android/i.test(navigator.userAgent);

const IS_DEV = import.meta.env.DEV;
const debugLog = (...args: ConsoleArgs) => { if (IS_DEV) console.log(...args); };
const debugWarn = (...args: ConsoleArgs) => { if (IS_DEV) console.warn(...args); };
const debugError = (...args: ConsoleArgs) => { if (IS_DEV) console.error(...args); };

class MicService {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private initializing: Promise<MediaStream> | null = null;
  private getUserMediaCount = 0;

  /**
   * Initializes microphone access and reuses an existing healthy stream when possible.
   */
  async init(options: MicInitOptions = {}): Promise<MediaStream> {
    if (this.stream) {
      const track = this.stream.getAudioTracks()[0];
      const streamHealthy = this.stream.active && track?.readyState === 'live';
      if (!streamHealthy) {
        debugWarn('[MicDebug] Cached stream is unhealthy, resetting before reuse', {
          streamActive: this.stream.active,
          trackReadyState: track?.readyState,
        });
        await this.reset();
      }
    }

    if (this.stream) {
      debugLog('[MicDebug] MicService.init() — reusing cached stream', {
        id: this.stream.id,
        active: this.stream.active,
        tracks: this.stream.getAudioTracks().map(t => `${t.label}:${t.readyState}:enabled=${t.enabled}`),
      });
      return this.stream;
    }

    if (this.initializing) {
      debugLog('[MicDebug] MicService.init() — awaiting in-flight initialization');
      return this.initializing;
    }

    this.initializing = this._initInternal(options).finally(() => {
      this.initializing = null;
    });

    return this.initializing;
  }

  /**
   * Forces a fresh microphone initialization by clearing cached state first.
   */
  async retryInit(options: MicInitOptions = {}): Promise<MediaStream> {
    await this.reset();
    return this.init(options);
  }

  /**
   * Releases the cached stream and audio context owned by the mic service.
   */
  async reset(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {
          debugWarn('[MicDebug] Error stopping track', e);
        }
      });
    }
    this.stream = null;
    this.initializing = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { await this.audioContext.close(); } catch (e) {
        debugWarn('[MicDebug] Error closing AudioContext', e);
      }
    }
    this.audioContext = null;
    debugLog('[MicDebug] MicService reset complete');
  }

  /**
   * Returns the currently cached microphone stream, if one exists.
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Enables or disables all tracks on the cached stream.
   */
  setTracksEnabled(enabled: boolean) {
    if (!this.stream) return;
    this.stream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
    debugLog('[MicDebug] MicService setTracksEnabled', { enabled });
  }

  /**
   * Returns a reusable audio context for microphone analysis.
   */
  getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = this.stream
        ? this.createBestAudioContext(this.stream)
        : this.createFallbackAudioContext();
    }
    return this.audioContext;
  }

  /**
   * Resumes the cached audio context if the browser has suspended it.
   */
  async ensureAudioContextRunning(): Promise<void> {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      debugLog('[MicDebug] MicService resumed AudioContext', { state: this.audioContext.state });
    }
  }

  private async _initInternal(options: MicInitOptions): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not available');
    }

    await this.logPermissionState();

    this.getUserMediaCount++;
    debugLog(`[MicDebug] 🔴 getUserMedia() CALL #${this.getUserMediaCount} — source: MicService.init()`, {
      constraints: options.constraints || DEFAULT_AUDIO_CONSTRAINTS,
      stack: new Error().stack?.split('\n').slice(1, 5).join(' | '),
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: options.constraints || DEFAULT_AUDIO_CONSTRAINTS,
    });

    this.stream = stream;
    this.audioContext = await this.replaceAudioContextForStream(stream);
    this.installTrackStopLogger(stream);
    this.ensureTracksEnabled(stream);

    debugLog('[MicDebug] ✅ MicService acquired stream', {
      id: stream.id,
      active: stream.active,
      tracks: stream.getAudioTracks().map(t => `${t.label}:${t.readyState}:enabled=${t.enabled}`),
    });

    return stream;
  }

  private createFallbackAudioContext(): AudioContext {
    const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    const context = new AudioContextCtor();
    debugLog('[MicDebug] MicService created fallback AudioContext', {
      state: context.state,
      sampleRate: context.sampleRate,
    });
    return context;
  }

  private getPreferredSampleRate(stream: MediaStream): number | undefined {
    const settings = stream.getAudioTracks()[0]?.getSettings?.() as MediaTrackSettingsWithSampleRate | undefined;
    return settings?.sampleRate;
  }

  private createBestAudioContext(stream: MediaStream): AudioContext {
    const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    const nativeSampleRate = this.getPreferredSampleRate(stream);
    const shouldMatchSampleRate = IS_ANDROID && !!nativeSampleRate;
    const context = shouldMatchSampleRate
      ? new AudioContextCtor({ sampleRate: nativeSampleRate })
      : new AudioContextCtor();

    debugLog('[MicDebug] MicService created AudioContext', {
      state: context.state,
      sampleRate: context.sampleRate,
      requestedRate: shouldMatchSampleRate ? nativeSampleRate : undefined,
    });

    return context;
  }

  private async replaceAudioContextForStream(stream: MediaStream): Promise<AudioContext> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { await this.audioContext.close(); } catch (e) {
        debugWarn('[MicDebug] Error closing AudioContext during replacement', e);
      }
    }

    return this.createBestAudioContext(stream);
  }

  private ensureTracksEnabled(stream: MediaStream) {
    stream.getAudioTracks().forEach(track => {
      if (!track.enabled) {
        debugWarn('[MicDebug] Track disabled, force-enabling', { label: track.label });
        track.enabled = true;
      }
    });
  }

  private installTrackStopLogger(stream: MediaStream) {
    stream.getTracks().forEach(track => {
      const tracked = track as AudioTrackWithStopMarker;
      const originalStop = tracked.stop.bind(tracked);
      if (tracked.__micStopWrapped) return;
      tracked.__micStopWrapped = true;
      track.stop = () => {
        debugError('[MicDebug] 🚨 track.stop() called', {
          id: track.id,
          label: track.label,
          kind: track.kind,
          readyState: track.readyState,
          stack: new Error().stack?.split('\n').slice(1, 6).join(' | '),
        });
        return originalStop();
      };
    });
  }

  private async logPermissionState() {
    if (!navigator.permissions?.query) return;
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      debugLog('[MicDebug] Permissions API microphone state', {
        state: status.state,
        granted: status.state === 'granted',
      });
    } catch (err) {
      debugWarn('[MicDebug] Permissions API query failed', err);
    }
  }
}

export const micService = new MicService();
