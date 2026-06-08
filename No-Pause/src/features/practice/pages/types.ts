import type { AudioDataPayload } from '../lib/speechAnalyzer';
import type { Dispatch, SetStateAction } from 'react';
import type { SilenceGap } from '@/lib/core/silence';
import type { TranscribedWord } from '@/lib/core/utils';

export type PracticeState = 'setup' | 'countdown' | 'recording' | 'finishing' | 'done';

export type TopicPrompt = {
  id: string;
  topicTitle: string;
  category: string;
  cueCard: string[];
};

export interface SessionResult {
  sessionId?: string | null;
  flowScore: number;
  totalSpeakingTime: number;
  totalSilenceTime: number;
  totalSessionTime: number;
  hesitationCount: number;
  pauseCount?: number | null;
  hesitationLog: { timestamp: number; duration: number; units: number; trailing?: boolean }[];
  mode: string;
  audioBlob: Blob | null;
  audioMimeType?: string;
  transcript: string;
  analysisFeedback?: string;
  analysisFeedbackLoading?: boolean;
  analysisFeedbackError?: string;
  bonusPoints?: number;
  transcriptionLoading?: boolean;
  transcriptionError?: string;
  wordCount: number | null;
  isCompleted: boolean;
  statusNote?: string;
  saveFailed?: boolean;
  scoringError?: string;
  totalSilenceSec?: number;
  flowScoreBase?: number;
  durationBonus?: number;
  gaps?: SilenceGap[];
  transcribedWords?: TranscribedWord[];
}

export interface PracticeStateStore {
  state: PracticeState;
  setState: Dispatch<SetStateAction<PracticeState>>;
  timeLeft: number;
  setTimeLeft: Dispatch<SetStateAction<number>>;
  countdown: number;
  setCountdown: Dispatch<SetStateAction<number>>;
  audioData: AudioDataPayload | null;
  setAudioData: Dispatch<SetStateAction<AudioDataPayload | null>>;
  lastResults: SessionResult | null;
  setLastResults: Dispatch<SetStateAction<SessionResult | null>>;
  transcriptError: string | null;
  setTranscriptError: Dispatch<SetStateAction<string | null>>;
  showMicRetry: boolean;
  setShowMicRetry: Dispatch<SetStateAction<boolean>>;
  elapsedTime: number;
  setElapsedTime: Dispatch<SetStateAction<number>>;
  copied: boolean;
  setCopied: Dispatch<SetStateAction<boolean>>;
  topicPrompt: TopicPrompt | null;
  setTopicPrompt: Dispatch<SetStateAction<TopicPrompt | null>>;
  isFixedScreen: boolean;
  isTranscriptMissing: boolean;
  isSessionFailed: boolean;
  forceShowDebugExport: boolean;
  showResultsDebugExport: boolean;
}
