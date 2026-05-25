import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useRecording } from '@/features/practice/hooks/useRecording';
import { useScoring } from '@/features/practice/hooks/useScoring';
import { useSession } from '@/features/practice/hooks/useSession';
import { useAuth } from '@/providers/AuthContext';
import type { PracticeStateStore } from './types';

type UseRecordingControllerOptions = {
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
  requestTranscription: () => Promise<void>;
  soundDetectedRef: React.MutableRefObject<boolean>;
};

export function useRecordingController({
  navigate,
  state,
  selectedTimerSeconds = 0,
}: UseRecordingControllerOptions): RecordingControllerResult {
  const { user } = useAuth();
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
    requestTranscription,
    requestFeedback,
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
    navigate,
    requestFeedback,
    saveFinishedSession,
    selectedTimerSeconds,
    state,
  });

  const handleRetry = useCallback(() => {
    setState('setup');
    setAudioData(null);
    setLastResults(null);
    setTimeLeft(0);
  }, [setState, setAudioData, setLastResults, setTimeLeft]);

  return {
    handleStart,
    handleRetryMicrophone,
    handleRetry,
    handleBack,
    stopRecording,
    requestTranscription,
    soundDetectedRef,
  };
}
