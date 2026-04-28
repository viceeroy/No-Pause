import { useMemo, useState } from 'react';
import type { AudioDataPayload } from '../lib/speechAnalyzer';
import type { TopicPrompt } from '../lib/promptService';
import type { PracticeState, PracticeStateStore, SessionResult } from './types';

export function usePracticeState(): PracticeStateStore {
  const [topicPrompt, setTopicPrompt] = useState<TopicPrompt | null>(null);
  const [state, setState] = useState<PracticeState>('setup');
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [audioData, setAudioData] = useState<AudioDataPayload | null>(null);
  const [lastResults, setLastResults] = useState<SessionResult | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [showMicRetry, setShowMicRetry] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copied, setCopied] = useState(false);

  const isFixedScreen = state === 'setup' || state === 'countdown' || state === 'recording';
  const isTranscriptMissing = Boolean(lastResults) && !(lastResults?.transcript || '').trim();
  const isSessionFailed = Boolean(lastResults) && !lastResults?.isCompleted;
  const forceShowDebugExport = typeof window !== 'undefined' && localStorage.getItem('debugLogs') === 'true';
  const showResultsDebugExport = Boolean(lastResults) && (isSessionFailed || isTranscriptMissing || forceShowDebugExport);

  return useMemo(() => ({
    state,
    setState,
    timeLeft,
    setTimeLeft,
    countdown,
    setCountdown,
    audioData,
    setAudioData,
    lastResults,
    setLastResults,
    transcriptError,
    setTranscriptError,
    showMicRetry,
    setShowMicRetry,
    elapsedTime,
    setElapsedTime,
    copied,
    setCopied,
    topicPrompt,
    setTopicPrompt,
    isFixedScreen,
    isTranscriptMissing,
    isSessionFailed,
    forceShowDebugExport,
    showResultsDebugExport,
  }), [
    state,
    timeLeft,
    countdown,
    audioData,
    lastResults,
    transcriptError,
    showMicRetry,
    elapsedTime,
    copied,
    topicPrompt,
    isFixedScreen,
    isTranscriptMissing,
    isSessionFailed,
    forceShowDebugExport,
    showResultsDebugExport,
  ]);
}
