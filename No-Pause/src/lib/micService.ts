export type MicInitOptions = {
  constraints?: MediaTrackConstraints;
};

const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const IS_ANDROID = /android/i.test(navigator.userAgent);

const getAudioConstraints = (): MediaTrackConstraints => {
  if (IS_IOS) {
    return {
      echoCancellation: true,
    };
  }
  if (IS_ANDROID) {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };
  }
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
};

const IS_DEV = import.meta.env.DEV;
const debugLog = (...args: any[]) => { if (IS_DEV) console.log(...args); };
const debugWarn = (...args: any[]) => { if (IS_DEV) console.warn(...args); };
const debugError = (...args: any[]) => { if (IS_DEV) console.error(...args); };

class MicService {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private initializing: Promise<MediaStream> | null = null;
  private getUserMediaCount = 0;
  private visibilityHandler: (() => void) | null = null;
  private recordingActive = false;
  private recoveryInProgress = false;
  onTrackEnded: (() => void) | null = null;

  async init(options: MicInitOptions = {}): Promise<MediaStream> {
    if (this.stream) {
      const track = this.stream.getAudioTracks()[0];
      const streamHealthy = this.stream.active && track?.readyState === 'live';
      if (!streamHealthy) {
        debugWarn('[MicDebug] Cached stream is unhealthy, resetting before reuse', {
          streamActive: this.stream.active,
          trackReadyState: track?.readyState,
        });
        this.reset();
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

  async retryInit(options: MicInitOptions = {}): Promise<MediaStream> {
    this.reset();
    return this.init(options);
  }

  reset() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try { track.stop(); } catch { }
      });
    }
    this.stream = null;
    this.initializing = null;
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch { }
    }
    this.audioContext = null;
    debugLog('[MicDebug] MicService reset complete');
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  setRecordingActive(active: boolean) {
    this.recordingActive = active;
  }

  setTracksEnabled(enabled: boolean) {
    if (!this.stream) return;
    this.stream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
    debugLog('[MicDebug] MicService setTracksEnabled', { enabled });
  }

  getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.ensureVisibilityRecovery();
      debugLog('[MicDebug] MicService created AudioContext', { state: this.audioContext.state });
    }
    return this.audioContext;
  }

  async ensureAudioContextRunning(): Promise<void> {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      debugLog('[MicDebug] MicService resumed AudioContext', { state: this.audioContext.state });
    }
  }

  private ensureVisibilityRecovery() {
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return;
      const ctx = this.audioContext;
      if (!ctx || ctx.state !== 'suspended') return;
      void ctx.resume().then(() => {
        debugLog('[Audio] AudioContext resumed after visibility change');
      }).catch((error) => {
        debugWarn('[Audio] Failed to resume AudioContext after visibility change', error);
      });
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private async _initInternal(options: MicInitOptions): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not available');
    }

    await this.logPermissionState();

    this.getUserMediaCount++;
    const resolvedConstraints = options.constraints || getAudioConstraints();
    debugLog(`[MicDebug] 🔴 getUserMedia() CALL #${this.getUserMediaCount} — source: MicService.init()`, {
      constraints: resolvedConstraints,
      stack: new Error().stack?.split('\n').slice(1, 5).join(' | '),
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: resolvedConstraints,
    });

    this.stream = stream;
    this.installTrackStopLogger(stream);
    this.ensureTracksEnabled(stream);

    debugLog('[MicDebug] ✅ MicService acquired stream', {
      id: stream.id,
      active: stream.active,
      tracks: stream.getAudioTracks().map(t => `${t.label}:${t.readyState}:enabled=${t.enabled}`),
    });

    return stream;
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
      const originalStop = track.stop.bind(track);
      if ((track as any).__micStopWrapped) return;
      (track as any).__micStopWrapped = true;
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

      const endedHandler = () => {
        debugWarn('[MicDebug] 🎤 Track ended unexpectedly', {
          id: track.id,
          readyState: track.readyState,
          recordingActive: this.recordingActive,
        });
        if (!this.recordingActive || this.recoveryInProgress) return;
        this.recoveryInProgress = true;
        void (async () => {
          try {
            debugWarn('[Mic] Track ended unexpectedly, attempting recovery...');
            this.reset();
            await this.init();
            debugLog('[Mic] Recovery successful');
          } catch (error) {
            debugError('[Mic] Recovery failed:', error);
            this.onTrackEnded?.();
          } finally {
            this.recoveryInProgress = false;
          }
        })();
      };
      track.addEventListener('ended', endedHandler);
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
