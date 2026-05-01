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
  fillerWordCount: number;
  hesitationLog: { timestamp: number; duration: number; units: number; trailing?: boolean }[];
  longestFlowStreak: number;
  frameCount: number;
  noiseFloor: number;
  totalTime: number;
  avgVolume: number;
  audioBlob: Blob | null;
  audioMimeType: string;
  transcript: string;
}
