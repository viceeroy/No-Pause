// Web Audio API wrapper for real-time speech analysis
// Architecture: Delta-time accumulation
import {
  buildDiagnosticsSnapshot,
  createDiagnosticsSessionId,
  getPlatformDiagnostics,
  type AnalyzerDiagnosticsSnapshot,
} from '@/lib/analyzer/diagnostics';
import {
  applyMicStateFrame,
  finalizeMicState,
  type MicStateSnapshot,
} from '@/lib/analyzer/micStateMachine';
import {
  calculateFlowScore,
  getScoreLabel,
  type FlowScoreOptions,
  type FlowScoreResult,
} from '@/lib/analyzer/scoring';

const SPEECH_THRESHOLD = 0.01;
const SPEECH_OFF_MULTIPLIER = 0.7;
const HESITATION_MIN_DURATION = 1800;
const MICRO_PAUSE_IGNORE = 300;
const SMOOTHING_WINDOW = 10;
const CALIBRATION_DURATION = 1500;
const ANALYTICS_START_DELAY_MS = 400;
const IS_ANDROID = /android/i.test(navigator.userAgent);
const FRAME_LOG_INTERVAL = 60;
const ZERO_RMS_RECOVERY_WINDOW_MS = 2000;
const SOURCE_REBIND_COOLDOWN_MS = 1500;
const STREAM_HEALTH_INTERVAL_MS = 2000;
const ANALYZER_HEALTH_INTERVAL_MS = 2500;
const WEBM_AUDIO_MIME_TYPE = 'audio/webm';
const EMPTY_TRANSCRIPT = 'No speech detected.';

const IS_DEV = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => { if (IS_DEV) console.log(...args); };
const debugWarn = (...args: unknown[]) => { if (IS_DEV) console.warn(...args); };
const debugError = (...args: unknown[]) => { if (IS_DEV) console.error(...args); };

type WindowWithSpeechRecognition = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  };

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

interface AudioAnalyzerOptions {
  enableTranscription?: boolean;
  hesitationMinDurationMs?: number;
  onData?: (data: AudioDataPayload) => void;
  onHesitation?: (duration: number, count: number) => void;
  onCalibrated?: (ambientNoise: number, thresholdSet: number) => void;
  onStartError?: (error: unknown) => void;
  transcribeAudio?: (payload: { audioBase64: string; mimeType: string }) => Promise<string>;
}

export interface AudioDataPayload {
  rms: number;
  smoothedRms: number;
  isSilent: boolean;
  isActuallySpeaking: boolean;
  currentSilenceDuration: number;
  totalSilenceTime: number;
  totalSpeakingTime: number;
  hesitationCount: number;
  waveformData: number[];
  frequencyData: number[];
  volume: number;
  speechEnergy: number;
  isCalibrating: boolean;
}

export interface AnalyzerResults {
  totalSpeakingTime: number;
  totalSilenceTime: number;
  hesitationSilenceTime: number;
  hesitationCount: number;
  longestFlowStreak: number;
  frameCount: number;
  noiseFloor: number;
  totalTime: number;
  avgVolume: number;
  audioBlob: Blob | null;
  audioMimeType: string;
  transcript: string;
}

export type { AnalyzerDiagnosticsSnapshot } from '@/lib/analyzer/diagnostics';

export class AudioAnalyzer {
  private readonly START_BUFFER_MS = 0;  // Count from first frame
  private readonly END_BUFFER_MS = 0;    // Count until final frame
  private speechOnThreshold: number;
  private speechOffThreshold: number;
  private hesitationMinDuration: number;
  private microPauseFilter: number;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyserSink: GainNode | null = null;
  stream: MediaStream | null = null;
  private dataArray: Float32Array | null = null;
  isRunning = false;
  private enableTranscription: boolean;
  private onData: ((data: AudioDataPayload) => void) | null;
  private onHesitation: ((duration: number, count: number) => void) | null;
  private onCalibrated: ((ambientNoise: number, thresholdSet: number) => void) | null;
  private onStartError: ((error: unknown) => void) | null;
  private transcribeAudio: ((payload: { audioBase64: string; mimeType: string }) => Promise<string>) | null;
  private animationFrame: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaRecorderMimeType = '';
  private audioChunks: Blob[] = [];
  private chunkCount = 0;
  private chunkSizes: number[] = [];
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
  private transcript = '';
  private finalTranscript = '';
  private recognition: SpeechRecognitionLike | null = null;
  private isListening = false;

  private recordingStartTime: number = 0;
  private hesitationLog: { timestamp: number; duration: number; units: number; trailing?: boolean }[] = [];
  private lastFrameTime: number | null = null;
  private totalSpeakingTimeMs = 0;
  private totalSilenceTimeMs = 0;
  private hesitationSilenceTime = 0;
  private hesitationCount = 0;
  private currentSilenceStart: number | null = null;
  private isSpeaking = false;
  private hasSpokeAtLeastOnce = false;
  private currentFlowStreakStart: number | null = null;
  private longestFlowStreak = 0;
  private frameCount = 0;
  private noiseFloor = 0;
  private volumeSamples: number[] = [];
  private lastAnalyzeTime = 0;
  private analyzeInterval = 33;
  private zeroRmsFrameCount = 0;
  private lastSourceRebindAt = 0;
  private graphRecoveryInProgress = false;
  private calibrationSamples: number[] = [];
  private isCalibrating = true;
  private calibrationStartTime: number | null = null;
  static getUserMediaGlobalCount = 0;

  /**
   * Returns a lightweight snapshot of the current capture pipeline state.
   */
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

  /**
   * Returns the current diagnostics snapshot for export and troubleshooting.
   */
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

  private static getSupportedRecorderMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
    }
    return '';
  }

  constructor(options: AudioAnalyzerOptions = {}) {
    this.speechOnThreshold = SPEECH_THRESHOLD;
    this.speechOffThreshold = SPEECH_THRESHOLD * SPEECH_OFF_MULTIPLIER;
    this.hesitationMinDuration = options.hesitationMinDurationMs ?? HESITATION_MIN_DURATION;
    this.microPauseFilter = MICRO_PAUSE_IGNORE;
    this.enableTranscription = options.enableTranscription ?? false;
    this.onData = options.onData || null;
    this.onHesitation = options.onHesitation || null;
    this.onCalibrated = options.onCalibrated || null;
    this.onStartError = options.onStartError || null;
    this.transcribeAudio = options.transcribeAudio || null;
  }

  /**
   * Start analyzing audio. Accepts an existing MediaStream and AudioContext
   * to avoid redundant getUserMedia() calls (which cause re-prompting on Android
   * and silent recording on iOS).
   */
  async start(existingStream?: MediaStream, existingAudioContext?: AudioContext): Promise<boolean> {
    try {
      // Stream must be provided by MicService (single acquisition per session)
      if (existingStream) {
        this.stream = existingStream;
        debugLog('[MicDebug] AudioAnalyzer.start() — using provided stream (no getUserMedia call)');
      } else {
        if (this.onStartError) this.onStartError(new Error('Microphone stream not initialized'));
        return false;
      }

      // Verify stream has active tracks (fixes iOS silent recording)
      let audioTracks = this.stream.getAudioTracks();
      const primaryTrack = audioTracks[0];
      const trackSettings = primaryTrack?.getSettings?.() || {};
      const trackSettingsWithExtras = trackSettings as MediaTrackSettings & {
        channelCount?: number;
        echoCancellation?: boolean;
        noiseSuppression?: boolean;
        autoGainControl?: boolean;
        latency?: number;
        sampleRate?: number;
      };
      const trackConstraints = primaryTrack?.getConstraints?.() || {};
      const ua = navigator.userAgent;
      const platform = navigator.platform || 'unknown';
      const platformDiagnostics = getPlatformDiagnostics(ua, platform);
      this.diagnosticsSessionId = createDiagnosticsSessionId();
      this.diagnosticsUserAgent = platformDiagnostics.userAgent;
      this.diagnosticsPlatform = platformDiagnostics.platform;
      this.diagnosticsBrowser = platformDiagnostics.browser;
      this.diagnosticsOsVersion = platformDiagnostics.osVersion;
      debugLog('[NoSpeech] 🎤 Stream health check:', {
        streamId: this.stream.id,
        active: this.stream.active,
        trackCount: audioTracks.length,
        tracks: audioTracks.map(t => ({
          label: t.label,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
        })),
      });
      debugLog('[MicDiag] 📱 Device info:', {
        userAgent: platformDiagnostics.userAgent,
        platform: platformDiagnostics.platform,
        browser: platformDiagnostics.browser,
        osVersion: platformDiagnostics.osVersion,
      });
      debugLog('[MicDiag] 🎚️ Audio config:', {
        audioContextSampleRate: this.audioContext?.sampleRate,
        channelCount: trackSettingsWithExtras.channelCount,
        echoCancellation: trackSettingsWithExtras.echoCancellation,
        noiseSuppression: trackSettingsWithExtras.noiseSuppression,
        autoGainControl: trackSettingsWithExtras.autoGainControl,
        latency: trackSettingsWithExtras.latency,
        sampleRate: trackSettingsWithExtras.sampleRate,
        trackConstraints,
      });
      this.diagnosticsAudioSampleRate = this.audioContext?.sampleRate ?? null;
      this.diagnosticsChannelCount = trackSettingsWithExtras.channelCount ?? null;
      this.diagnosticsEchoCancellation = trackSettingsWithExtras.echoCancellation ?? null;
      this.diagnosticsNoiseSuppression = trackSettingsWithExtras.noiseSuppression ?? null;
      this.diagnosticsAutoGainControl = trackSettingsWithExtras.autoGainControl ?? null;
      this.diagnosticsLatency = trackSettingsWithExtras.latency ?? null;

      if (audioTracks.length === 0 || audioTracks[0].readyState === 'ended') {
        debugWarn('[MicDebug] Stream tracks ended/missing — will not re-request getUserMedia', {
          trackCount: audioTracks.length,
          trackStates: audioTracks.map(t => t.readyState),
        });
        if (this.onStartError) this.onStartError(new Error('Microphone stream inactive'));
        return false;
      }

      // CRITICAL: Force-enable all tracks (some browsers mute tracks after inactivity)
      audioTracks.forEach(track => {
        if (!track.enabled) {
          debugWarn('[NoSpeech] ⚠️ Track was disabled, force-enabling:', track.label);
          track.enabled = true;
        }
      });

      if (!existingAudioContext) {
        if (this.onStartError) this.onStartError(new Error('AudioContext not initialized'));
        return false;
      }
      this.audioContext = existingAudioContext;

      debugLog('[NoSpeech] 🔊 AudioContext state:', this.audioContext.state, 'sampleRate:', this.audioContext.sampleRate);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      if (IS_ANDROID) {
        // Android Chrome may not feed analyser data unless graph is connected downstream.
        this.analyserSink = this.audioContext.createGain();
        this.analyserSink.gain.value = 0;
        this.analyser.connect(this.analyserSink);
        this.analyserSink.connect(this.audioContext.destination);
      }
      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
      this.isRunning = true;

      const now = Date.now();
      this.recordingStartTime = now;
      this.lastFrameTime = now;
      this.calibrationStartTime = now;

      // Reset session state
      this.totalSpeakingTimeMs = 0;
      this.totalSilenceTimeMs = 0;
      this.hesitationSilenceTime = 0;
      this.hesitationCount = 0;
      this.hesitationLog = [];
      this.currentSilenceStart = null;
      this.isSpeaking = false;
      this.hasSpokeAtLeastOnce = false;
      this.currentFlowStreakStart = null;
      this.longestFlowStreak = 0;
      this.frameCount = 0;
      this.noiseFloor = 0;
      this.volumeSamples = [];
      this.audioChunks = [];
      this.chunkCount = 0;
      this.chunkSizes = [];
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
      this.transcript = '';
      this.finalTranscript = '';
      this.calibrationSamples = [];
      this.isCalibrating = true;
      this.zeroRmsFrameCount = 0;
      this.lastSourceRebindAt = 0;
      this.graphRecoveryInProgress = false;

      if (typeof MediaRecorder !== 'undefined') {
        const preferredMimeType = AudioAnalyzer.getSupportedRecorderMimeType();
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
        this.mediaRecorder.ondataavailable = (event) => {
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
        };
        this.mediaRecorder.start(100);
        debugLog('[MicDebug] MediaRecorder started', { state: this.mediaRecorder.state });
      }

      if (this.streamHealthInterval) {
        clearInterval(this.streamHealthInterval);
      }
      this.streamHealthInterval = setInterval(() => {
        const track = this.stream?.getAudioTracks?.()[0];
        const logItem = {
          atMs: Date.now() - this.recordingStartTime,
          streamActive: this.stream?.active ?? false,
          trackMuted: track?.muted ?? null,
          trackReadyState: track?.readyState ?? 'none',
        };
        this.streamHealthLogs.push(logItem);
        debugLog('[MicDiag] 💓 Stream health:', {
          streamActive: logItem.streamActive,
          trackMuted: logItem.trackMuted,
          trackReadyState: logItem.trackReadyState,
        });
      }, STREAM_HEALTH_INTERVAL_MS);

      if (this.analyzerHealthInterval) {
        clearInterval(this.analyzerHealthInterval);
      }
      this.analyzerHealthInterval = setInterval(() => {
        if (!IS_ANDROID || !this.isRunning || this.graphRecoveryInProgress) return;
        const track = this.stream?.getAudioTracks?.()[0];
        const streamHealthy = !!this.stream?.active && track?.readyState === 'live';
        if (!streamHealthy) return;
        if (this.hasAudioSignal()) return;
        if (Date.now() - this.lastSourceRebindAt < 1500) return;
        this.lastSourceRebindAt = Date.now();
        this.rebindSourceNode();
      }, ANALYZER_HEALTH_INTERVAL_MS);

      // Start Speech Recognition for transcription
      if (this.enableTranscription) {
        this._startRecognition();
      }

      debugLog('[NoSpeech] ✅ Recording started', {
        streamReused: !!existingStream,
        audioCtxReused: !!existingAudioContext,
        streamActive: this.stream.active,
        trackEnabled: this.stream.getAudioTracks()[0]?.enabled,
        trackMuted: this.stream.getAudioTracks()[0]?.muted,
        audioCtxState: this.audioContext.state,
        mediaRecorderState: this.mediaRecorder?.state || 'none',
      });
      this._analyze();
      return true;
    } catch (err) {
      if (this.onStartError) this.onStartError(err);
      return false;
    }
  }

  private _recognitionRestartCount = 0;
  private _recognitionRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_RECOGNITION_RESTARTS = 20;
  private static readonly RECOGNITION_RESTART_DELAY_MS = 1000;

  private _startRecognition() {
    // On Android Chrome, SpeechRecognition.start() internally calls getUserMedia(),
    // which triggers a second mic permission prompt. Skip recognition entirely on
    // Android to avoid the re-prompt loop and rely on AnalyserNode for detection.
    if (IS_ANDROID) {
      debugLog('[Transcript] Skipping SpeechRecognition on Android to avoid permission re-prompt');
      return;
    }

    const SpeechRecognition =
      (window as WindowWithSpeechRecognition).SpeechRecognition ||
      (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
    debugLog('[Transcript] Speech Recognition available?', !!SpeechRecognition);

    if (!SpeechRecognition) {
      debugWarn('[Transcript] Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.isListening = true;
    this._recognitionRestartCount = 0;

    let lastResultIndex = 0;

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let newFinal = '';
      for (let i = lastResultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinal += result[0].transcript + ' ';
          lastResultIndex = i + 1;
        } else {
          interim += result[0].transcript;
        }
      }
      if (newFinal) {
        this.finalTranscript += newFinal;
      }
      this.transcript = (this.finalTranscript + interim).trim();
      debugLog('[Transcript] onresult:', this.transcript.slice(-80));
    };

    this.recognition.onend = () => {
      debugLog('[Transcript] Recognition ended, transcript so far:', this.finalTranscript.slice(-60));
      lastResultIndex = 0; // Reset for new session after restart

      // Only restart if still actively recording
      if (!this.isListening || !this.isRunning) {
        debugLog('[Transcript] Not restarting (session ended)');
        return;
      }

      if (IS_ANDROID) {
        debugLog('[Transcript] Android detected — skipping recognition auto-restart to avoid repeated permission prompts');
        return;
      }

      // Prevent infinite restart loops
      if (this._recognitionRestartCount >= AudioAnalyzer.MAX_RECOGNITION_RESTARTS) {
        debugWarn('[Transcript] Max restarts reached, stopping auto-restart');
        return;
      }

      // Debounce restart to prevent rapid-fire mic access events
      if (this._recognitionRestartTimer) {
        clearTimeout(this._recognitionRestartTimer);
      }
      this._recognitionRestartTimer = setTimeout(() => {
        if (this.isListening && this.isRunning && this.recognition) {
          this._recognitionRestartCount++;
          debugLog(`[MicDebug] 🔄 SpeechRecognition restart #${this._recognitionRestartCount}`);
          try {
            this.recognition.start();
          } catch (e) {
            debugError('[Transcript] Restart failed:', e);
          }
        }
      }, AudioAnalyzer.RECOGNITION_RESTART_DELAY_MS);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      debugError('[Transcript] Error:', event.error);
      if (event.error === 'not-allowed') {
        this.isListening = false;
      }
      // 'aborted' errors often happen on rapid restart — don't count as fatal
      if (event.error === 'aborted') {
        debugLog('[Transcript] Aborted (likely from rapid restart), will retry via onend');
      }
    };

    debugLog('[Transcript] Starting recognition (initial)...');
    try {
      this.recognition.start();
      debugLog('[Transcript] recognition.start() called successfully');
    } catch (err) {
      debugError('[Transcript] Failed to start:', err);
    }
  }

  private _analyze() {
    if (!this.isRunning || !this.analyser || !this.dataArray) return;

    const now = Date.now();
    if (now - this.lastAnalyzeTime < this.analyzeInterval) {
      this.animationFrame = requestAnimationFrame(() => this._analyze());
      return;
    }
    this.lastAnalyzeTime = now;
    this.frameCount++;

    const delta = now - (this.lastFrameTime || now);
    this.lastFrameTime = now;

    this.analyser.getFloatTimeDomainData(this.dataArray);
    let sumSquares = 0;
    let maxSample = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const abs = Math.abs(this.dataArray[i]);
      if (abs > maxSample) maxSample = abs;
      sumSquares += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);
    if (IS_ANDROID) {
      if (rms <= 0.000001) {
        this.zeroRmsFrameCount += 1;
      } else {
        this.zeroRmsFrameCount = 0;
      }

      const zeroRmsThreshold = Math.ceil(ZERO_RMS_RECOVERY_WINDOW_MS / this.analyzeInterval);
      const canRecover =
        this.zeroRmsFrameCount >= zeroRmsThreshold &&
        !this.graphRecoveryInProgress &&
        now - this.lastSourceRebindAt > SOURCE_REBIND_COOLDOWN_MS;

      if (canRecover) {
        this.graphRecoveryInProgress = true;
        this.lastSourceRebindAt = now;
        this.zeroRmsFrameCount = 0;
        this.rebindSourceNode();
        this.graphRecoveryInProgress = false;
      }
    }
    this.chunkRmsAccumulator += rms;
    if (rms > this.chunkPeakAccumulator) this.chunkPeakAccumulator = rms;
    this.chunkRmsSampleCount += 1;

    // Periodic diagnostic: log every ~2 seconds (60 frames at 33ms interval)
    if (this.frameCount % FRAME_LOG_INTERVAL === 1) {
      const tracks = this.stream?.getAudioTracks() || [];
      debugLog(`[NoSpeech] 📊 Frame ${this.frameCount} | RMS: ${rms.toFixed(5)} | Peak: ${maxSample.toFixed(5)} | Speaking: ${this.isSpeaking} | Hesitations: ${this.hesitationCount} | HesitSilence: ${(this.hesitationSilenceTime / 1000).toFixed(1)}s | Track: ${tracks[0]?.readyState || 'none'}:${tracks[0]?.enabled ? 'on' : 'OFF'}`);
    }

    this.volumeSamples.push(rms);
    if (this.volumeSamples.length > SMOOTHING_WINDOW) {
      this.volumeSamples = this.volumeSamples.slice(-SMOOTHING_WINDOW);
    }
    const smoothedRms = this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length;

    if (this.isCalibrating && this.calibrationStartTime) {
      this.calibrationSamples.push(rms);
      if (now - this.calibrationStartTime >= CALIBRATION_DURATION) {
        this.isCalibrating = false;
        const avgNoise = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
        this.noiseFloor = avgNoise;
        if (this.onCalibrated) this.onCalibrated(avgNoise, this.speechOnThreshold);
      }
    }

    const timeSinceStart = now - this.recordingStartTime;
    const inStartDelayWindow = timeSinceStart < ANALYTICS_START_DELAY_MS;
    const micState: MicStateSnapshot = {
      isSpeaking: this.isSpeaking,
      hasSpokeAtLeastOnce: this.hasSpokeAtLeastOnce,
      currentFlowStreakStart: this.currentFlowStreakStart,
      longestFlowStreak: this.longestFlowStreak,
      totalSpeakingTimeMs: this.totalSpeakingTimeMs,
      totalSilenceTimeMs: this.totalSilenceTimeMs,
      currentSilenceStart: this.currentSilenceStart,
      hesitationSilenceTime: this.hesitationSilenceTime,
      hesitationCount: this.hesitationCount,
      hesitationLog: this.hesitationLog,
    };
    const frameResult = applyMicStateFrame(micState, {
      now,
      delta,
      smoothedRms,
      speechOnThreshold: this.speechOnThreshold,
      speechOffThreshold: this.speechOffThreshold,
      timeSinceStart,
      inStartDelayWindow,
      isCalibrating: this.isCalibrating,
      microPauseFilter: this.microPauseFilter,
      hesitationMinDuration: this.hesitationMinDuration,
      startBufferMs: this.START_BUFFER_MS,
    });

    this.isSpeaking = frameResult.state.isSpeaking;
    this.hasSpokeAtLeastOnce = frameResult.state.hasSpokeAtLeastOnce;
    this.currentFlowStreakStart = frameResult.state.currentFlowStreakStart;
    this.longestFlowStreak = frameResult.state.longestFlowStreak;
    this.totalSpeakingTimeMs = frameResult.state.totalSpeakingTimeMs;
    this.totalSilenceTimeMs = frameResult.state.totalSilenceTimeMs;
    this.currentSilenceStart = frameResult.state.currentSilenceStart;
    this.hesitationSilenceTime = frameResult.state.hesitationSilenceTime;
    this.hesitationCount = frameResult.state.hesitationCount;
    this.hesitationLog = frameResult.state.hesitationLog;

    if (frameResult.hesitationEvent) {
      const hesitationUnits = Math.floor(frameResult.hesitationEvent.duration / this.hesitationMinDuration);
      debugLog(`[NoSpeech] Hesitation at ${Math.round(timeSinceStart)}ms (${(frameResult.hesitationEvent.duration / 1000).toFixed(1)}s, ${hesitationUnits}u) - COUNTED (in analysis window)`);
      if (this.onHesitation) {
        this.onHesitation(frameResult.hesitationEvent.duration, frameResult.hesitationEvent.count);
      }
    }

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);
    const speechFrequencies = Array.from(freqData.slice(0, 12));
    const speechEnergy = speechFrequencies.reduce((a: number, b: number) => a + b, 0) / speechFrequencies.length;

    let currentSilenceDuration = 0;
    if (!this.isSpeaking && this.currentSilenceStart) {
      currentSilenceDuration = now - this.currentSilenceStart;
    }

    if (this.onData) {
      this.onData({
        rms,
        smoothedRms,
        isSilent: !this.isSpeaking,
        isActuallySpeaking: this.isSpeaking,
        currentSilenceDuration,
        totalSilenceTime: Math.round(this.totalSilenceTimeMs / 1000),
        totalSpeakingTime: Math.round(this.totalSpeakingTimeMs / 1000),
        hesitationCount: this.hesitationCount,
        waveformData: Array.from(this.dataArray.slice(0, 256)),
        frequencyData: Array.from(freqData.slice(0, 64)),
        volume: smoothedRms,
        speechEnergy,
        isCalibrating: this.isCalibrating,
      });
    }

    this.animationFrame = requestAnimationFrame(() => this._analyze());
  }

  private rebuildAnalyzerGraph() {
    try {
      if (!this.audioContext || !this.stream || !this.isRunning) return;

      try { this.source?.disconnect(); } catch { }
      try { this.analyser?.disconnect(); } catch { }
      try { this.analyserSink?.disconnect(); } catch { }

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
      } else {
        this.analyserSink = null;
      }

      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
      debugWarn('[Audio] Rebuilt analyzer graph after sustained zero RMS');
    } catch (error) {
      debugError('[Audio] Failed to rebuild analyzer graph', error);
    } finally {
      this.graphRecoveryInProgress = false;
    }
  }

  private rebindSourceNode() {
    try {
      if (!this.audioContext || !this.stream) {
        this.rebuildAnalyzerGraph();
        return;
      }

      try { this.source?.disconnect(); } catch { }
      try { this.analyser?.disconnect(); } catch { }
      try { this.analyserSink?.disconnect(); } catch { }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      // On Android, also rebuild the downstream sink chain.
      // Without analyser → GainNode(0) → destination, Android Chrome won't
      // pull samples through the graph and the AnalyserNode stays silent.
      if (IS_ANDROID) {
        this.analyserSink = this.audioContext.createGain();
        this.analyserSink.gain.value = 0;
        this.analyser.connect(this.analyserSink);
        this.analyserSink.connect(this.audioContext.destination);
      } else {
        this.analyserSink = null;
      }

      this.dataArray = new Float32Array(this.analyser.frequencyBinCount);

      debugWarn('[Audio] Rebuilt source/analyser/sink chain after sustained zero RMS');
    } catch (error) {
      debugError('[Audio] Failed to rebind source node; rebuilding graph', error);
      this.rebuildAnalyzerGraph();
    }
  }

  /**
   * Stops analysis, preserves the shared stream, and returns the session results.
   */
  async stop(): Promise<AnalyzerResults> {
    this.isRunning = false;

    // Stop speech recognition and cancel any pending restart
    this.isListening = false;
    if (this._recognitionRestartTimer) {
      clearTimeout(this._recognitionRestartTimer);
      this._recognitionRestartTimer = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch { }
      this.recognition = null;
      debugLog('[Transcript] Stopped');
      debugLog('[Transcript] Saved to session:', this.transcript.slice(0, 120) || '(empty)');
    }

    const now = Date.now();
    if (this.lastFrameTime) {
      const finalDelta = now - this.lastFrameTime;
      if (this.isSpeaking) {
        this.totalSpeakingTimeMs += finalDelta;
        if (this.currentFlowStreakStart) {
          const streak = now - this.currentFlowStreakStart;
          if (streak > this.longestFlowStreak) this.longestFlowStreak = streak;
        }
      } else {
        this.totalSilenceTimeMs += finalDelta;
      }
    }

    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.streamHealthInterval) {
      clearInterval(this.streamHealthInterval);
      this.streamHealthInterval = null;
    }
    if (this.analyzerHealthInterval) {
      clearInterval(this.analyzerHealthInterval);
      this.analyzerHealthInterval = null;
    }

    const totalRecordingTime = now - this.recordingStartTime;
    const finalizedMicState = finalizeMicState(
      {
        isSpeaking: this.isSpeaking,
        hasSpokeAtLeastOnce: this.hasSpokeAtLeastOnce,
        currentFlowStreakStart: this.currentFlowStreakStart,
        longestFlowStreak: this.longestFlowStreak,
        totalSpeakingTimeMs: this.totalSpeakingTimeMs,
        totalSilenceTimeMs: this.totalSilenceTimeMs,
        currentSilenceStart: this.currentSilenceStart,
        hesitationSilenceTime: this.hesitationSilenceTime,
        hesitationCount: this.hesitationCount,
        hesitationLog: this.hesitationLog,
      },
      {
        now,
        recordingStartTime: this.recordingStartTime,
        endBufferMs: this.END_BUFFER_MS,
        microPauseFilter: this.microPauseFilter,
        hesitationMinDuration: this.hesitationMinDuration,
        startBufferMs: this.START_BUFFER_MS,
      },
    );

    this.currentSilenceStart = finalizedMicState.state.currentSilenceStart;
    this.hesitationLog = finalizedMicState.state.hesitationLog;

    const filteredHesitationSilenceTime = finalizedMicState.filteredHesitationSilenceTime;
    const filteredHesitationCount = finalizedMicState.filteredHesitationCount;
    const analysisWindow = finalizedMicState.analysisWindow;

    const sessionAvgRms = this.volumeSamples.length > 0
      ? this.volumeSamples.reduce((a, b) => a + b, 0) / this.volumeSamples.length
      : 0;

    const flowScore = calculateFlowScore(filteredHesitationCount, {
      speakingTimeSec: Math.round(this.totalSpeakingTimeMs / 1000),
      totalSessionTimeSec: Math.round(totalRecordingTime / 1000),
    });
    debugLog('[NoSpeech] 🏁 Analysis complete:', JSON.stringify({
      totalDuration: `${Math.round(totalRecordingTime / 1000)}s (${totalRecordingTime}ms)`,
      analysisWindow: `${Math.round(analysisWindow / 1000)}s`,
      startBuffer: `${this.START_BUFFER_MS}ms`,
      endBuffer: `${this.END_BUFFER_MS}ms`,
      totalSpeakingTime: `${Math.round(this.totalSpeakingTimeMs / 1000)}s`,
      totalSilenceTime: `${Math.round(this.totalSilenceTimeMs / 1000)}s`,
      hasSpokeAtLeastOnce: this.hasSpokeAtLeastOnce,
      avgRms: sessionAvgRms.toFixed(5),
      totalFrames: this.frameCount,
      allHesitations: this.hesitationLog.length,
      allHesitationDetails: this.hesitationLog.map(h => `${Math.round(h.timestamp)}ms:${(h.duration / 1000).toFixed(1)}s:${h.units}u${h.trailing ? ':trailing' : ''}`),
      filteredHesitations: filteredHesitationCount,
      filteredHesitationSilenceMs: Math.round(filteredHesitationSilenceTime),
      filteredHesitationSilenceSec: `${(filteredHesitationSilenceTime / 1000).toFixed(1)}s`,
      flowScorePreview: flowScore.score,
      audioChunks: this.audioChunks.length,
      recorderMimeType: this.mediaRecorderMimeType || this.mediaRecorder?.mimeType || '',
      firstChunkDelayMs: this.firstChunkDelayMs,
      avgChunkSizeBytes: this.chunkSizes.length > 0 ? Math.round(this.chunkSizes.reduce((a, b) => a + b, 0) / this.chunkSizes.length) : 0,
      transcriptLength: this.transcript.length,
    }));
    if (!this.hasSpokeAtLeastOnce) {
      debugWarn('[NoSpeech] ⚠️ NO SPEECH DETECTED during entire session! RMS never exceeded threshold', this.speechOnThreshold);
    }

    const audioBlob = await new Promise<Blob | null>((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          debugLog('[MicDebug] MediaRecorder stop (from stop())', { state: this.mediaRecorder?.state || 'none' });
          resolve(new Blob(this.audioChunks, { type: WEBM_AUDIO_MIME_TYPE }));
        };
        debugLog('[MicDebug] MediaRecorder stop requested', { state: this.mediaRecorder.state });
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });

    const audioMimeType = this.mediaRecorderMimeType || audioBlob?.type || WEBM_AUDIO_MIME_TYPE;
    const normalizedMimeType = audioMimeType.split(';')[0] || WEBM_AUDIO_MIME_TYPE;
    let finalTranscript = this.transcript.trim() || EMPTY_TRANSCRIPT;

    if (IS_ANDROID && this.enableTranscription && this.transcribeAudio && audioBlob) {
      try {
        const base64Audio = arrayBufferToBase64(await audioBlob.arrayBuffer());
        const groqTranscript = await this.transcribeAudio({
          audioBase64: base64Audio,
          mimeType: normalizedMimeType,
        });
        if (groqTranscript && groqTranscript.trim().length > 0) {
          finalTranscript = groqTranscript.trim();
          this.transcript = finalTranscript;
        }
      } catch (error) {
        debugError('[Transcript] Groq transcription failed:', error);
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message)
            : 'Unknown error';
        finalTranscript = `Transcription failed: ${message}`;
      }
    }

    // Disconnect source but do NOT stop stream tracks or close AudioContext.
    // The stream and context are managed by the caller (PracticePage) so they
    // can be reused across sessions without re-prompting for mic permission.
    if (this.source) {
      try { this.source.disconnect(); } catch { }
      this.source = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { }
      this.analyser = null;
    }
    if (this.analyserSink) {
      try { this.analyserSink.disconnect(); } catch { }
      this.analyserSink = null;
    }

    const avgVolume = sessionAvgRms;

    return {
      totalSpeakingTime: Math.round(this.totalSpeakingTimeMs / 1000),
      totalSilenceTime: Math.round(this.totalSilenceTimeMs / 1000),
      hesitationSilenceTime: Math.round(filteredHesitationSilenceTime),
      hesitationCount: filteredHesitationCount,
      longestFlowStreak: this.longestFlowStreak,
      frameCount: this.frameCount,
      noiseFloor: this.noiseFloor,
      totalTime: totalRecordingTime,
      avgVolume: Math.round(avgVolume * 1000) / 1000,
      audioBlob,
      audioMimeType,
      transcript: finalTranscript,
    };
  }

  /**
   * Fully release the MediaStream and AudioContext.
   * Call this ONLY on component unmount — not between sessions.
   * This is what actually frees the microphone hardware.
   */
  destroy() {
    if (this.isRunning) {
      this.isRunning = false;
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    }
    if (this.streamHealthInterval) {
      clearInterval(this.streamHealthInterval);
      this.streamHealthInterval = null;
    }
    if (this.analyzerHealthInterval) {
      clearInterval(this.analyzerHealthInterval);
      this.analyzerHealthInterval = null;
    }
    this.isListening = false;
    if (this._recognitionRestartTimer) {
      clearTimeout(this._recognitionRestartTimer);
      this._recognitionRestartTimer = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch { }
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { }
    }
    if (this.source) {
      try { this.source.disconnect(); } catch { }
      this.source = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { }
      this.analyser = null;
    }
    if (this.analyserSink) {
      try { this.analyserSink.disconnect(); } catch { }
      this.analyserSink = null;
    }
    this.stream = null;
    this.audioContext = null;
    debugLog('[NoSpeech] Analyzer destroyed (stream retained by MicService)');
  }

  static calculateFlowScore(
    hesitationCount: number,
    options?: FlowScoreOptions,
  ): FlowScoreResult {
    return calculateFlowScore(hesitationCount, options);
  }

  /**
   * Maps a numeric score to a human-readable label.
   */
  static getScoreLabel(score: number): string {
    return getScoreLabel(score);
  }

  /**
   * Checks whether the current analyser node is receiving any frequency energy.
   */
  hasAudioSignal(): boolean {
    if (!this.analyser) return false;
    const testBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(testBuffer);
    return testBuffer.some((value) => value > 0);
  }
}
