import { AudioCapture } from './audioCapture';
import { SpeechSession } from './speechSession';
import {
  TranscriptionController,
  type TranscribeAudio,
} from './transcription';
import type { AnalyzerDiagnosticsSnapshot } from './analyzer/diagnostics';
import type { AnalyzerResults, AudioDataPayload } from './speechTypes';
import {
  calculateFlowScore,
  type FlowScoreOptions,
  type FlowScoreResult,
} from '@/lib/core/scoring';

const WEBM_AUDIO_MIME_TYPE = 'audio/webm';

interface AudioAnalyzerOptions {
  enableTranscription?: boolean;
  hesitationMinDurationMs?: number;
  onData?: (data: AudioDataPayload) => void;
  onHesitation?: (duration: number, count: number) => void;
  onCalibrated?: (ambientNoise: number, thresholdSet: number) => void;
  onStartError?: (error: unknown) => void;
  transcribeAudio?: TranscribeAudio;
}

export type { AnalyzerDiagnosticsSnapshot } from './analyzer/diagnostics';
export type { AnalyzerResults, AudioDataPayload } from './speechTypes';

export class AudioAnalyzer {
  stream: MediaStream | null = null;
  isRunning = false;
  static getUserMediaGlobalCount = 0;

  private readonly capture = new AudioCapture();
  private readonly transcription: TranscriptionController;
  private session: SpeechSession | null = null;
  private readonly options: AudioAnalyzerOptions;

  constructor(options: AudioAnalyzerOptions = {}) {
    this.options = options;
    this.transcription = new TranscriptionController(
      options.enableTranscription ?? false,
      options.transcribeAudio || null,
    );
  }

  getCaptureState() {
    return this.capture.getCaptureState();
  }

  getDiagnosticsSnapshot(): AnalyzerDiagnosticsSnapshot {
    return this.capture.getDiagnosticsSnapshot();
  }

  async start(existingStream?: MediaStream, existingAudioContext?: AudioContext): Promise<boolean> {
    try {
      if (!existingStream) {
        this.options.onStartError?.(new Error('Microphone stream not initialized'));
        return false;
      }
      if (!existingAudioContext) {
        this.options.onStartError?.(new Error('AudioContext not initialized'));
        return false;
      }

      this.stream = existingStream;
      this.session = new SpeechSession({
        hesitationMinDurationMs: this.options.hesitationMinDurationMs,
        onData: this.options.onData,
        onHesitation: this.options.onHesitation,
        onCalibrated: this.options.onCalibrated,
      });
      this.session.start();
      this.transcription.reset();
      this.capture.start({
        stream: existingStream,
        audioContext: existingAudioContext,
        onFrame: (frame) => this.session?.handleFrame(frame),
      });
      this.isRunning = true;
      return true;
    } catch (err) {
      this.options.onStartError?.(err);
      return false;
    }
  }

  async stop(): Promise<AnalyzerResults> {
    this.isRunning = false;
    const now = Date.now();
    const captureResult = await this.capture.stop();
    const stats = this.session?.finish(now, captureResult.avgVolume) ?? this.emptyStats();
    const normalizedMimeType = (captureResult.audioMimeType.split(';')[0] || WEBM_AUDIO_MIME_TYPE);
    const transcript = await this.transcription.finalizeTranscript({
      audioBlob: captureResult.audioBlob,
      normalizedMimeType,
      totalRecordingTimeMs: stats.totalTime,
    });

    return {
      ...stats,
      audioBlob: captureResult.audioBlob,
      audioMimeType: captureResult.audioMimeType,
      transcript,
    };
  }

  destroy() {
    this.isRunning = false;
    this.capture.destroy();
    this.stream = null;
    this.session = null;
  }

  static calculateFlowScore(hesitationCount: number, options?: FlowScoreOptions): FlowScoreResult {
    return calculateFlowScore(hesitationCount, options);
  }

  hasAudioSignal(): boolean {
    return this.capture.hasAudioSignal();
  }

  private emptyStats(): Omit<AnalyzerResults, 'audioBlob' | 'audioMimeType' | 'transcript'> {
    return { totalSpeakingTime: 0, totalSilenceTime: 0, hesitationSilenceTime: 0, hesitationCount: 0, hesitationLog: [], longestFlowStreak: 0, frameCount: 0, noiseFloor: 0, totalTime: 0, avgVolume: 0 };
  }
}
