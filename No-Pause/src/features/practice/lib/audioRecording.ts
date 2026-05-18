import { AudioAnalyzer, type AudioDataPayload } from './speechAnalyzer';

type CreateAudioAnalyzerOptions = {
  enableTranscription: boolean;
  hesitationMinDurationMs?: number;
  transcribeAudio?: (payload: { audioBase64: string; mimeType: string; durationSec?: number }) => Promise<
    string | { transcript?: unknown; text?: unknown }
  >;
  onData?: (data: AudioDataPayload) => void;
  onHesitation?: () => void;
  onCalibrated?: () => void;
  onStartError?: (error: unknown) => void;
};

export const createAudioAnalyzer = (options: CreateAudioAnalyzerOptions) =>
  new AudioAnalyzer({
    enableTranscription: options.enableTranscription,
    hesitationMinDurationMs: options.hesitationMinDurationMs,
    transcribeAudio: options.transcribeAudio,
    onData: options.onData,
    onHesitation: options.onHesitation,
    onCalibrated: options.onCalibrated,
    onStartError: options.onStartError,
  });
