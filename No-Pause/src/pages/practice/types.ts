import type { AudioDataPayload } from '@/lib/speechAnalyzer';
import type { LemonPrompt, TopicDifficulty, TopicPrompt } from '@/lib/promptService';
import type { Dispatch, SetStateAction } from 'react';

export type PracticeState = 'setup' | 'countdown' | 'recording' | 'done';
export type TopicDifficultyMode = 'random' | TopicDifficulty;

export interface SessionResult {
  flowScore: number;
  totalSpeakingTime: number;
  totalSessionTime: number;
  hesitationCount: number;
  mode: string;
  audioBlob: Blob | null;
  audioMimeType?: string;
  transcript: string;
  analysisFeedback?: string;
  analysisFeedbackLoading?: boolean;
  analysisFeedbackError?: string;
  wordCount: number;
  isCompleted: boolean;
  statusNote?: string;
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
  promptLoading: boolean;
  setPromptLoading: Dispatch<SetStateAction<boolean>>;
  topicDifficultyMode: TopicDifficultyMode;
  setTopicDifficultyMode: Dispatch<SetStateAction<TopicDifficultyMode>>;
  elapsedTime: number;
  setElapsedTime: Dispatch<SetStateAction<number>>;
  copied: boolean;
  setCopied: Dispatch<SetStateAction<boolean>>;
  lemonPrompt: LemonPrompt | null;
  setLemonPrompt: Dispatch<SetStateAction<LemonPrompt | null>>;
  topicPrompt: TopicPrompt | null;
  setTopicPrompt: Dispatch<SetStateAction<TopicPrompt | null>>;
  isFixedScreen: boolean;
  isTranscriptMissing: boolean;
  isSessionFailed: boolean;
  forceShowDebugExport: boolean;
  showResultsDebugExport: boolean;
}
