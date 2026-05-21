import { arrayBufferToBase64 } from '@/shared/lib/utils';

const IS_ANDROID = /android/i.test(navigator.userAgent);
const IS_DEV = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => { if (IS_DEV) console.log(...args); };
const debugWarn = (...args: unknown[]) => { if (IS_DEV) console.warn(...args); };
const debugError = (...args: unknown[]) => { if (IS_DEV) console.error(...args); };

const MAX_TRANSCRIBE_BYTES = 15 * 1024 * 1024;
const EMPTY_TRANSCRIPT = 'No speech detected.';

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { isFinal: boolean; 0: SpeechRecognitionAlternativeLike };
type SpeechRecognitionResultListLike = { length: number; [index: number]: SpeechRecognitionResultLike };
type SpeechRecognitionEventLike = Event & { resultIndex: number; results: SpeechRecognitionResultListLike };
type SpeechRecognitionErrorEventLike = Event & { error: string };
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
type WindowWithSpeechRecognition = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export type TranscribeAudio = (payload: {
  audioBase64: string;
  mimeType: string;
  durationSec?: number;
}) => Promise<string | { transcript?: unknown; text?: unknown }>;

export class TranscriptionController {
  private recognition: SpeechRecognitionLike | null = null;
  private recognitionRestartCount = 0;
  private recognitionRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private isListening = false;
  private transcript = '';
  private finalTranscript = '';

  private static readonly MAX_RECOGNITION_RESTARTS = 20;
  private static readonly RECOGNITION_RESTART_DELAY_MS = 1000;

  constructor(
    private readonly enableTranscription: boolean,
    private readonly transcribeAudio: TranscribeAudio | null,
  ) {}

  get currentTranscript() {
    return this.transcript;
  }

  reset() {
    this.transcript = '';
    this.finalTranscript = '';
    this.recognitionRestartCount = 0;
  }

  startBrowserRecognition(isRunning: () => boolean) {
    if (!this.enableTranscription) return;
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

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) newFinal += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      if (newFinal) this.finalTranscript += newFinal;
      const currentRawTranscript = (this.finalTranscript + interim).trim();
      this.transcript = currentRawTranscript;
      debugLog('[Transcript] onresult:', this.transcript.slice(-80));
    };

    this.recognition.onend = () => {
      debugLog('[Transcript] Recognition ended, transcript so far:', this.finalTranscript.slice(-60));
      if (!this.isListening || !isRunning()) return;
      if (this.recognitionRestartCount >= TranscriptionController.MAX_RECOGNITION_RESTARTS) {
        debugWarn('[Transcript] Max restarts reached, stopping auto-restart');
        return;
      }
      if (this.recognitionRestartTimer) clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = setTimeout(() => {
        if (this.isListening && isRunning() && this.recognition) {
          this.recognitionRestartCount++;
          debugLog(`[MicDebug] 🔄 SpeechRecognition restart #${this.recognitionRestartCount}`);
          try { this.recognition.start(); } catch (e) {
            debugError('[Transcript] Restart failed:', e);
          }
        }
      }, TranscriptionController.RECOGNITION_RESTART_DELAY_MS);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      debugError('[Transcript] Error:', event.error);
      if (event.error === 'not-allowed') this.isListening = false;
      if (event.error === 'aborted') debugLog('[Transcript] Aborted, will retry via onend');
    };

    debugLog('[Transcript] Starting recognition (initial)...');
    try {
      this.recognition.start();
      debugLog('[Transcript] recognition.start() called successfully');
    } catch (err) {
      debugError('[Transcript] Failed to start:', err);
    }
  }

  stopBrowserRecognition() {
    this.isListening = false;
    if (this.recognitionRestartTimer) {
      clearTimeout(this.recognitionRestartTimer);
      this.recognitionRestartTimer = null;
    }
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch (e) {
      debugWarn('[Transcript] stop failed', e);
    }
    this.recognition = null;
    debugLog('[Transcript] Stopped');
    debugLog('[Transcript] Saved to session:', this.transcript.slice(0, 120) || '(empty)');
  }

  async finalizeTranscript(input: {
    audioBlob: Blob | null;
    normalizedMimeType: string;
    totalRecordingTimeMs: number;
  }): Promise<string> {
    let finalTranscript = this.transcript.trim() || EMPTY_TRANSCRIPT;
    const needsServerFallback = !finalTranscript.trim() || finalTranscript === EMPTY_TRANSCRIPT;
    if (!needsServerFallback || !this.enableTranscription || !this.transcribeAudio || !input.audioBlob) {
      return finalTranscript;
    }

    try {
      if (input.audioBlob.size === 0) {
        finalTranscript = 'Transcription failed: empty audio.';
        throw new Error('Audio blob is empty');
      }
      if (input.audioBlob.size > MAX_TRANSCRIBE_BYTES) {
        finalTranscript = 'Transcription skipped: audio too large.';
        throw new Error(`Audio blob too large: ${input.audioBlob.size} bytes`);
      }

      const audioBase64 = arrayBufferToBase64(await input.audioBlob.arrayBuffer());
      const durationSec = Math.round(input.totalRecordingTimeMs / 1000);
      const transcriptionResult = await this.transcribeWithRetry({
        audioBase64,
        mimeType: input.normalizedMimeType,
        durationSec,
      });
      const serverTranscript = typeof transcriptionResult === 'string'
        ? transcriptionResult
        : String(transcriptionResult.transcript ?? transcriptionResult.text ?? '');
      if (serverTranscript && serverTranscript.trim().length > 0) {
        finalTranscript = serverTranscript.trim();
        this.transcript = finalTranscript;
      }
    } catch (error) {
      debugError('[Transcript] Server transcription failed:', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Unknown error';
      if (finalTranscript === EMPTY_TRANSCRIPT || finalTranscript === this.transcript.trim()) {
        finalTranscript = `Transcription failed: ${message}`;
      }
    }

    return finalTranscript;
  }

  destroy() {
    this.stopBrowserRecognition();
  }

  private async transcribeWithRetry(payload: Parameters<TranscribeAudio>[0]) {
    return await this.transcribeAudio!(payload);
  }
}
