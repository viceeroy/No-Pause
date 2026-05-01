import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/lib/core/constants';
import { useRecording } from '@/features/practice/hooks/useRecording';
import { useScoring } from '@/features/practice/hooks/useScoring';
import { useSession } from '@/features/practice/hooks/useSession';
import { useAuth } from '@/providers/AuthContext';
import type { PracticeStateStore } from './types';

type UseRecordingControllerOptions = {
  mode: string;
  navigate: NavigateFunction;
  state: PracticeStateStore;
  selectedTimerSeconds?: number;
};

type RecordingControllerResult = {
  handleStart: (forceRetryMic?: boolean) => Promise<void>;
  handleRetryMicrophone: () => void;
  handleRetry: () => void;
  handleBack: () => void;
  stopRecording: () => Promise<void>;
  requestFeedback: () => Promise<void>;
  requestTranscription: () => Promise<void>;
  soundDetectedRef: React.MutableRefObject<boolean>;
};

export function useRecordingController({
  mode,
  navigate,
  state,
  selectedTimerSeconds = 0,
}: UseRecordingControllerOptions): RecordingControllerResult {
  const { user, difficultyLevel } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email;

  const {
    setState,
    setTimeLeft,
    setAudioData,
    setLastResults,
    lastResults,
  } = state;

  const { buildSessionResult } = useScoring();
  const {
    requestFeedback,
    requestTranscription,
    saveFinishedSession,
  } = useSession({
    lastResults,
    setLastResults,
    userEmail,
    userId,
  });
  const {
    handleBack,
    handleRetryMicrophone,
    handleStart,
    soundDetectedRef,
    stopRecording,
  } = useRecording({
    buildSessionResult,
    difficultyLevel,
    mode,
    navigate,
    saveFinishedSession,
    selectedTimerSeconds,
    state,
  });

  const handleRetry = useCallback(() => {
    setState('setup');
    setAudioData(null);
    setLastResults(null);
    if (mode === 'lemon') setTimeLeft(LEMON_MIN_TOTAL_SECONDS);
    else if (mode === 'topic') setTimeLeft(TOPIC_MIN_TOTAL_SECONDS);
    else setTimeLeft(0);
  }, [mode, setState, setAudioData, setLastResults, setTimeLeft]);

  return {
    handleStart,
    handleRetryMicrophone,
    handleRetry,
    handleBack,
    stopRecording,
    requestFeedback,
    requestTranscription,
    soundDetectedRef,
  };
}
