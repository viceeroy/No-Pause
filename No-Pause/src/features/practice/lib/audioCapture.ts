import {
  buildDiagnosticsSnapshot,
  createDiagnosticsSessionId,
  getPlatformDiagnostics,
  type AnalyzerDiagnosticsSnapshot,
} from './analyzer/diagnostics';

const IS_ANDROID = /android/i.test(navigator.userAgent);
const IS_DEV = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => { if (IS_DEV) console.log(...args); };
const debugWarn = (...args: unknown[]) => { if (IS_DEV) console.warn(...args); };
const debugError = (...args: unknown[]) => { if (IS_DEV) console.error(...args); };

const ZERO_RMS_RECOVERY_WINDOW_MS = 2000;
const SOURCE_REBIND_COOLDOWN_MS = 1500;
const STREAM_HEALTH_INTERVAL_MS = 2000;
const ANALYZER_HEALTH_INTERVAL_MS = 2500;
const MEDIA_RECORDER_STOP_TIMEOUT_MS = 3000;
const WEBM_AUDIO_MIME_TYPE = 'audio/webm';
const SMOOTHING_WINDOW = 4;

type TrackSettingsWithDiagnostics = MediaTrackSettings & {
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  latency?: number;
  sampleRate?: number;
};

export interface AudioCaptureFrame {
  now: number;
  delta: number;
  rms: number;
  smoothedRms: number;
  maxSample: number;
  frameCount: number;
  waveformData: number[];
  frequencyData: number[];
  speechEnergy: number;
}

export interface AudioCaptureStopResult {
  audioBlob: Blob | null;
  audioMimeType: string;
  avgVolume: number;
  frameCount: number;
}

export class AudioCapture {
  stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyserSink: GainNode | null = null;
  private dataArray: Float32Array | null = null;
  private analyzeIntervalId: ReturnType<typeof setInterval> | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaRecorderMimeType = '';
  private audioChunks: Blob[] = [];
  private chunkSizes: number[] = [];
  private chunkCount = 0;
  private recorderStartTimestamp = 0;
  private firstChunkDelayMs: number | null = null;
  private lastChunkTimestamp: number | null = null;
  private streamHealthInterval: ReturnType<typeof setInterval> | null = null;
  private analyzerHealthInterval: ReturnType<typeof setInterval> | null = null;
  private chunkRmsAccumulator = 0;
  private chunkPeakAccumulator = 0;
  private chunkRmsSampleCount = 0;
  private previousChunkAvgRms: number | null = null;
  private chunkIntervalsMs: number[] = [];
  private chunkAvgRmsPerChunk: number[] = [];
  private chunkPeakRmsPerChunk: number[] = [];
  private chunkLowAmplitudeFlags: boolean[] = [];
  private chunkDropFlags: boolean[] = [];
  private pauseResumeEvents: { type: 'pause' | 'resume'; atMs: number }[] = [];
  private streamHealthLogs: { atMs: number; streamActive: boolean; trackReadyState: string; trackMuted: boolean | null }[] = [];
  private diagnosticsSessionId = '';
  private diagnosticsUserAgent = '';
  private diagnosticsPlatform = '';
  private diagnosticsBrowser = '';
  private diagnosticsOsVersion = '';
  private diagnosticsAudioSampleRate: number | null = null;
  private diagnosticsChannelCount: number | null = null;
  private diagnosticsEchoCancellation: boolean | null = null;
  private diagnosticsNoiseSuppression: boolean | null = null;
  private diagnosticsAutoGainControl: boolean | null = null;
  private diagnosticsLatency: number | null = null;
  private recordingStartTime = 0;
  private lastFrameTime: number | null = null;
  private lastAnalyzeTime = 0;
  private analyzeInterval = 33;
  private frameCount = 0;
  private volumeSamples: number[] = [];
  private volumeSum = 0;
  private volumeSampleCount = 0;
  private zeroRmsFrameCount = 0;
  private lastSourceRebindAt = 0;
  private graphRecoveryInProgress = false;
  private isRunning = false;
  private onFrame: ((frame: AudioCaptureFrame) => void) | null = null;

  start(input: {
    stream: MediaStream;
    audioContext: AudioContext;
    onFrame: (frame: AudioCaptureFrame) => void;
  }) {
    this.stream = input.stream;
    this.audioContext = input.audioContext;
    this.onFrame = input.onFrame;
    this.validateStream();
    this.resetSessionState();
    this.captureDiagnostics();
    this.buildAnalyzerGraph();
    this.startRecorder();
    this.startHealthChecks();
    this.isRunning = true;
    this.analyzeIntervalId = setInterval(() => this.analyze(), this.analyzeInterval);
  }

  getCaptureState() {
    const track = this.stream?.getAudioTracks?.()[0];
    return {
      hasStream: !!this.stream,
      streamActive: this.stream?.active ?? false,
      trackReadyState: track?.readyState ?? 'none',
      mediaRecorderState: this.mediaRecorder?.state ?? 'none',
      mediaRecorderMimeType: this.mediaRecorderMimeType || this.mediaRecorder?.mimeType || '',
    };
  }

  getDiagnosticsSnapshot(): AnalyzerDiagnosticsSnapshot {
    return buildDiagnosticsSnapshot({
      sessionId: this.diagnosticsSessionId,
      mediaRecorderMimeType: this.mediaRecorderMimeType,
      fallbackMimeType: this.mediaRecorder?.mimeType || '',
      diagnosticsUserAgent: this.diagnosticsUserAgent,
      diagnosticsPlatform: this.diagnosticsPlatform,
      diagnosticsBrowser: this.diagnosticsBrowser,
      diagnosticsOsVersion: this.diagnosticsOsVersion,
      diagnosticsAudioSampleRate: this.diagnosticsAudioSampleRate,
      diagnosticsChannelCount: this.diagnosticsChannelCount,
      diagnosticsEchoCancellation: this.diagnosticsEchoCancellation,
      diagnosticsNoiseSuppression: this.diagnosticsNoiseSuppression,
      diagnosticsAutoGainControl: this.diagnosticsAutoGainControl,
      diagnosticsLatency: this.diagnosticsLatency,
      firstChunkDelayMs: this.firstChunkDelayMs,
      chunkIntervalsMs: this.chunkIntervalsMs,
      chunkSizes: this.chunkSizes,
      pauseResumeEvents: this.pauseResumeEvents,
      streamHealthLogs: this.streamHealthLogs,
      chunkAvgRmsPerChunk: this.chunkAvgRmsPerChunk,
      chunkPeakRmsPerChunk: this.chunkPeakRmsPerChunk,
      chunkLowAmplitudeFlags: this.chunkLowAmplitudeFlags,
      chunkDropFlags: this.chunkDropFlags,
    });
  }

  async stop(): Promise<AudioCaptureStopResult> {
    this.isRunning = false;
    if (this.analyzeIntervalId) {
      clearInterval(this.analyzeIntervalId);
      this.analyzeIntervalId = null;
    }
    this.clearHealthChecks();
    const audioBlob = await this.stopRecorder();
    const audioMimeType = this.mediaRecorderMimeType || audioBlob?.type || WEBM_AUDIO_MIME_TYPE;
    const avgVolume = this.volumeSampleCount > 0
      ? this.volumeSum / this.volumeSampleCount
      : 0;
    this.disconnectGraph('destroy');
    return { audioBlob, audioMimeType, avgVolume, frameCount: this.frameCount };
  }

  destroy() {
    this.isRunning = false;
    if (this.analyzeIntervalId) {
      clearInterval(this.analyzeIntervalId);
      this.analyzeIntervalId = null;
    }
    this.clearHealthChecks();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {
        debugWarn('[Audio] Recorder stop failed (destroy full)', e);
      }
    }
    this.mediaRecorder = null;
    this.disconnectGraph('destroy full');
    this.stream = null;
    this.audioContext = null;
  }

  hasAudioSignal(): boolean {
    if (!this.analyser) return false;
    const testBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(testBuffer);
    return testBuffer.some((value) => value > 0);
  }

  private static getSupportedRecorderMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  }

  private validateStream() {
    const audioTracks = this.stream?.getAudioTracks() || [];
    if (audioTracks.length === 0 || audioTracks[0].readyState === 'ended') {
      debugWarn('[MicDebug] Stream tracks ended/missing — will not re-request getUserMedia', {
        trackCount: audioTracks.length,
        trackStates: audioTracks.map(t => t.readyState),
      });
      throw new Error('Microphone stream inactive');
    }
    audioTracks.forEach(track => {
      if (!track.enabled) {
        debugWarn('[NoSpeech] ⚠️ Track was disabled, force-enabling:', track.label);
        track.enabled = true;
      }
    });
  }

  private resetSessionState() {
    const now = Date.now();
    this.recordingStartTime = now;
    this.lastFrameTime = now;
    this.audioChunks = [];
    this.chunkSizes = [];
    this.chunkCount = 0;
    this.recorderStartTimestamp = 0;
    this.firstChunkDelayMs = null;
    this.lastChunkTimestamp = null;
    this.chunkRmsAccumulator = 0;
    this.chunkPeakAccumulator = 0;
    this.chunkRmsSampleCount = 0;
    this.previousChunkAvgRms = null;
    this.chunkIntervalsMs = [];
    this.chunkAvgRmsPerChunk = [];
    this.chunkPeakRmsPerChunk = [];
    this.chunkLowAmplitudeFlags = [];
    this.chunkDropFlags = [];
    this.pauseResumeEvents = [];
    this.streamHealthLogs = [];
    this.frameCount = 0;
    this.volumeSamples = [];
    this.volumeSum = 0;
    this.volumeSampleCount = 0;
    this.zeroRmsFrameCount = 0;
    this.lastSourceRebindAt = 0;
    this.graphRecoveryInProgress = false;
  }

  private captureDiagnostics() {
    const audioTracks = this.stream?.getAudioTracks() || [];
    const primaryTrack = audioTracks[0];
    const trackSettings = (primaryTrack?.getSettings?.() || {}) as TrackSettingsWithDiagnostics;
    const trackConstraints = primaryTrack?.getConstraints?.() || {};
    const platformDiagnostics = getPlatformDiagnostics(navigator.userAgent, navigator.platform || 'unknown');
    this.diagnosticsSessionId = createDiagnosticsSessionId();
    this.diagnosticsUserAgent = platformDiagnostics.userAgent;
    this.diagnosticsPlatform = platformDiagnostics.platform;
    this.diagnosticsBrowser = platformDiagnostics.browser;
    this.diagnosticsOsVersion = platformDiagnostics.osVersion;
    this.diagnosticsAudioSampleRate = this.audioContext?.sampleRate ?? null;
    this.diagnosticsChannelCount = trackSettings.channelCount ?? null;
    this.diagnosticsEchoCancellation = trackSettings.echoCancellation ?? null;
    this.diagnosticsNoiseSuppression = trackSettings.noiseSuppression ?? null;
    this.diagnosticsAutoGainControl = trackSettings.autoGainControl ?? null;
    this.diagnosticsLatency = trackSettings.latency ?? null;

    debugLog('[NoSpeech] 🎤 Stream health check:', {
      streamId: this.stream?.id,
      active: this.stream?.active,
      trackCount: audioTracks.length,
      tracks: audioTracks.map(t => ({ label: t.label, readyState: t.readyState, enabled: t.enabled, muted: t.muted })),
    });
    debugLog('[MicDiag] 📱 Device info:', platformDiagnostics);
    debugLog('[MicDiag] 🎚️ Audio config:', {
      audioContextSampleRate: this.audioContext?.sampleRate,
      channelCount: trackSettings.channelCount,
      echoCancellation: trackSettings.echoCancellation,
      noiseSuppression: trackSettings.noiseSuppression,
      autoGainControl: trackSettings.autoGainControl,
      latency: trackSettings.latency,
      sampleRate: trackSettings.sampleRate,
      trackConstraints,
    });
  }

  private buildAnalyzerGraph() {
    if (!this.audioContext || !this.stream) throw new Error('Audio capture not initialized');
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    if (IS_ANDROID) {
      this.analyserSink = this.audioContext.createGain();
      this.analyserSink.gain.value = 0;
      this.analyser.connect(this.analyserSink);
      this.analyserSink.connect(this.audioContext.destination);
    }
    this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
  }

  private startRecorder() {
    if (typeof MediaRecorder === 'undefined' || !this.stream) return;
    const preferredMimeType = AudioCapture.getSupportedRecorderMimeType();
    const recorderOptions: MediaRecorderOptions = {
      ...(preferredMimeType ? { mimeType: preferredMimeType } : {}),
      ...(IS_ANDROID ? { audioBitsPerSecond: 128000 } : {}),
    };
    this.mediaRecorder = Object.keys(recorderOptions).length > 0
      ? new MediaRecorder(this.stream, recorderOptions)
      : new MediaRecorder(this.stream);
    this.mediaRecorderMimeType = this.mediaRecorder.mimeType || preferredMimeType || 'default';
    debugLog('[MicDebug] MediaRecorder created', {
      state: this.mediaRecorder.state,
      mimeType: this.mediaRecorderMimeType,
      preferredMimeType,
    });
    this.mediaRecorder.onstart = () => {
      this.recorderStartTimestamp = Date.now();
      debugLog('[MicDebug] MediaRecorder start', { state: this.mediaRecorder?.state || 'none' });
    };
    this.mediaRecorder.onpause = () => {
      debugWarn('[MicDiag] MediaRecorder pause event');
      this.pauseResumeEvents.push({ type: 'pause', atMs: Date.now() - this.recordingStartTime });
    };
    this.mediaRecorder.onresume = () => {
      debugWarn('[MicDiag] MediaRecorder resume event');
      this.pauseResumeEvents.push({ type: 'resume', atMs: Date.now() - this.recordingStartTime });
    };
    this.mediaRecorder.onstop = () => {
      debugLog('[MicDebug] MediaRecorder stop', { state: this.mediaRecorder?.state || 'none' });
    };
    this.mediaRecorder.ondataavailable = (event) => this.handleRecorderData(event);
    this.mediaRecorder.start(100);
    debugLog('[MicDebug] MediaRecorder started', { state: this.mediaRecorder.state });
  }

  private startHealthChecks() {
    this.clearHealthChecks();
    this.streamHealthInterval = setInterval(() => {
      const track = this.stream?.getAudioTracks?.()[0];
      const logItem = {
        atMs: Date.now() - this.recordingStartTime,
        streamActive: this.stream?.active ?? false,
        trackMuted: track?.muted ?? null,
        trackReadyState: track?.readyState ?? 'none',
      };
      this.streamHealthLogs.push(logItem);
      debugLog('[MicDiag] 💓 Stream health:', logItem);
    }, STREAM_HEALTH_INTERVAL_MS);

    this.analyzerHealthInterval = setInterval(() => {
      if (!IS_ANDROID || !this.isRunning || this.graphRecoveryInProgress) return;
      const track = this.stream?.getAudioTracks?.()[0];
      const streamHealthy = !!this.stream?.active && track?.readyState === 'live';
      if (!streamHealthy || this.hasAudioSignal()) return;
      if (Date.now() - this.lastSourceRebindAt < SOURCE_REBIND_COOLDOWN_MS) return;
      this.lastSourceRebindAt = Date.now();
      this.rebindSourceNode();
    }, ANALYZER_HEALTH_INTERVAL_MS);
  }

  private handleRecorderData(event: BlobEvent) {
    const nowChunk = Date.now();
    if (this.firstChunkDelayMs === null && this.recorderStartTimestamp > 0) {
      this.firstChunkDelayMs = nowChunk - this.recorderStartTimestamp;
    }
    const chunkIntervalMs = this.lastChunkTimestamp ? nowChunk - this.lastChunkTimestamp : null;
    this.lastChunkTimestamp = nowChunk;
    if (chunkIntervalMs !== null) this.chunkIntervalsMs.push(chunkIntervalMs);
    if (event.data.size > 0) this.audioChunks.push(event.data);
    this.chunkCount += 1;
    this.chunkSizes.push(event.data.size);

    const avgRms = this.chunkRmsSampleCount > 0 ? this.chunkRmsAccumulator / this.chunkRmsSampleCount : 0;
    const peakRms = this.chunkPeakAccumulator;
    const lowAmplitude = avgRms < 0.004 && peakRms < 0.012;
    const suddenDrop = this.previousChunkAvgRms !== null && this.previousChunkAvgRms > 0.02 && avgRms < this.previousChunkAvgRms * 0.35;
    this.chunkAvgRmsPerChunk.push(Number(avgRms.toFixed(5)));
    this.chunkPeakRmsPerChunk.push(Number(peakRms.toFixed(5)));
    this.chunkLowAmplitudeFlags.push(lowAmplitude);
    this.chunkDropFlags.push(suddenDrop);
    debugLog('[MicDiag] 📦 Chunk telemetry:', {
      chunkIndex: this.chunkCount,
      sizeBytes: event.data.size,
      recorderState: this.mediaRecorder?.state || 'none',
      firstChunkDelayMs: this.firstChunkDelayMs,
      chunkIntervalMs,
      avgRms: Number(avgRms.toFixed(5)),
      peakRms: Number(peakRms.toFixed(5)),
      lowAmplitudeSuspected: lowAmplitude,
      suddenDropSuspected: suddenDrop,
    });
    this.previousChunkAvgRms = avgRms;
    this.chunkRmsAccumulator = 0;
    this.chunkPeakAccumulator = 0;
    this.chunkRmsSampleCount = 0;
  }

  private analyze() {
    if (!this.isRunning || !this.analyser || !this.dataArray) return;
    const now = Date.now();
    this.lastAnalyzeTime = now;
    this.frameCount++;

    const delta = now - (this.lastFrameTime || now);
    this.lastFrameTime = now;
    this.analyser.getFloatTimeDomainData(this.dataArray as Float32Array<ArrayBuffer>);
    let sumSquares = 0;
    let maxSample = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const abs = Math.abs(this.dataArray[i]);
      if (abs > maxSample) maxSample = abs;
      sumSquares += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);
    this.handleZeroRmsRecovery(now, rms);
    this.chunkRmsAccumulator += rms;
    if (rms > this.chunkPeakAccumulator) this.chunkPeakAccumulator = rms;
    this.chunkRmsSampleCount += 1;
    this.volumeSum += rms;
    this.volumeSampleCount += 1;
    this.volumeSamples.push(rms);
    if (this.volumeSamples.length > SMOOTHING_WINDOW) this.volumeSamples = this.volumeSamples.slice(-SMOOTHING_WINDOW);
    const smoothedRms = this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length;

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);
    const speechFrequencies = Array.from(freqData.slice(0, 12));
    const speechEnergy = speechFrequencies.reduce((a: number, b: number) => a + b, 0) / speechFrequencies.length;
    this.onFrame?.({
      now,
      delta,
      rms,
      smoothedRms,
      maxSample,
      frameCount: this.frameCount,
      waveformData: Array.from(this.dataArray.slice(0, 256)),
      frequencyData: Array.from(freqData.slice(0, 64)),
      speechEnergy,
    });
  }

  private handleZeroRmsRecovery(now: number, rms: number) {
    if (!IS_ANDROID) return;
    this.zeroRmsFrameCount = rms <= 0.000001 ? this.zeroRmsFrameCount + 1 : 0;
    const zeroRmsThreshold = Math.ceil(ZERO_RMS_RECOVERY_WINDOW_MS / this.analyzeInterval);
    const canRecover =
      this.zeroRmsFrameCount >= zeroRmsThreshold &&
      !this.graphRecoveryInProgress &&
      now - this.lastSourceRebindAt > SOURCE_REBIND_COOLDOWN_MS;
    if (!canRecover) return;
    this.graphRecoveryInProgress = true;
    this.lastSourceRebindAt = now;
    this.zeroRmsFrameCount = 0;
    this.rebindSourceNode();
    this.graphRecoveryInProgress = false;
  }

  private rebindSourceNode() {
    try {
      this.disconnectGraph('rebind');
      this.buildAnalyzerGraph();
      debugWarn('[Audio] Rebuilt source/analyser/sink chain after sustained zero RMS');
    } catch (error) {
      debugError('[Audio] Failed to rebind source node', error);
      this.graphRecoveryInProgress = false;
    }
  }

  private disconnectGraph(reason: string) {
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {
        debugWarn(`[Audio] Source disconnect failed (${reason})`, e);
      }
      this.source = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (e) {
        debugWarn(`[Audio] Analyser disconnect failed (${reason})`, e);
      }
      this.analyser = null;
    }
    if (this.analyserSink) {
      try { this.analyserSink.disconnect(); } catch (e) {
        debugWarn(`[Audio] AnalyserSink disconnect failed (${reason})`, e);
      }
      this.analyserSink = null;
    }
    this.dataArray = null;
  }

  private stopRecorder() {
    return new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      let stopTimeout: ReturnType<typeof setTimeout> | null = null;
      let resolved = false;
      const resolveWithChunks = (source: 'event' | 'timeout') => {
        if (resolved) return;
        resolved = true;
        if (stopTimeout) clearTimeout(stopTimeout);
        debugLog('[MicDebug] MediaRecorder stop resolved', {
          source,
          state: this.mediaRecorder?.state || 'none',
          chunks: this.audioChunks.length,
        });
        const blobType = this.mediaRecorderMimeType || this.mediaRecorder?.mimeType || WEBM_AUDIO_MIME_TYPE;
        resolve(new Blob(this.audioChunks, { type: blobType }));
      };
      this.mediaRecorder.onstop = () => {
        debugLog('[MicDebug] MediaRecorder stop (from stop())', { state: this.mediaRecorder?.state || 'none' });
        resolveWithChunks('event');
      };
      stopTimeout = setTimeout(() => resolveWithChunks('timeout'), MEDIA_RECORDER_STOP_TIMEOUT_MS);
      debugLog('[MicDebug] MediaRecorder stop requested', { state: this.mediaRecorder.state });
      try { this.mediaRecorder.stop(); } catch (error) {
        debugWarn('[MicDebug] MediaRecorder stop failed, resolving with existing chunks', error);
        resolveWithChunks('timeout');
      }
    });
  }

  private clearHealthChecks() {
    if (this.streamHealthInterval) clearInterval(this.streamHealthInterval);
    if (this.analyzerHealthInterval) clearInterval(this.analyzerHealthInterval);
    this.streamHealthInterval = null;
    this.analyzerHealthInterval = null;
  }
}
