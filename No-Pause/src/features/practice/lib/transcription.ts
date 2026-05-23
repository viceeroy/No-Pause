import { arrayBufferToBase64 } from '@/shared/lib/utils';
import { parseTranscribedWords, type TranscribedWord } from '@/lib/core/utils';

const IS_DEV = import.meta.env.DEV;
const debugError = (...args: unknown[]) => { if (IS_DEV) console.error(...args); };

const MAX_TRANSCRIBE_BYTES = 15 * 1024 * 1024;

export type FinalizedTranscript = {
  transcript: string;
  words: TranscribedWord[];
};

type StringBackedFinalizedTranscript = string & FinalizedTranscript;

export type TranscribeAudio = (payload: {
  audioBase64: string;
  mimeType: string;
  durationSec?: number;
}) => Promise<string | { transcript?: unknown; text?: unknown; words?: unknown }>;

function createFinalizedTranscript(
  transcript: string,
  words: TranscribedWord[],
): StringBackedFinalizedTranscript {
  const value = new String(transcript) as StringBackedFinalizedTranscript;
  value.transcript = transcript;
  value.words = words;
  return value;
}

export class TranscriptionController {
  private transcript = '';

  constructor(
    private readonly enableTranscription: boolean,
    private readonly transcribeAudio: TranscribeAudio | null,
  ) {}

  reset() {
    this.transcript = '';
  }

  async finalizeTranscript(input: {
    audioBlob: Blob | null;
    normalizedMimeType: string;
    totalRecordingTimeMs: number;
  }): Promise<StringBackedFinalizedTranscript> {
    if (!this.enableTranscription || !this.transcribeAudio || !input.audioBlob) {
      return createFinalizedTranscript('', []);
    }

    try {
      if (input.audioBlob.size === 0) {
        throw new Error('Audio blob is empty');
      }
      if (input.audioBlob.size > MAX_TRANSCRIBE_BYTES) {
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
      const serverWords = typeof transcriptionResult === 'string'
        ? []
        : parseTranscribedWords(transcriptionResult.words);
      if (serverTranscript && serverTranscript.trim().length > 0) {
        this.transcript = serverTranscript.trim();
      }
      return createFinalizedTranscript(this.transcript, serverWords);
    } catch (error) {
      debugError('[Transcript] Server transcription failed:', error);
      return createFinalizedTranscript('', []);
    }
  }

  private async transcribeWithRetry(payload: Parameters<TranscribeAudio>[0]) {
    return await this.transcribeAudio!(payload);
  }
}
