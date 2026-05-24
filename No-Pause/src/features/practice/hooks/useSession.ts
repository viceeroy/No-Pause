import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { analyzeSpeech, saveSession, transcribeAudio, updateSession, updateStreak } from '@/lib/practiceApi';
import { blendWithAiScore } from '@/lib/core/scoring';
import type { SessionResult } from '@/features/practice/pages/types';
import { arrayBufferToBase64 } from '@/shared/lib/utils';
import { getWordCount } from '@/lib/core/utils';
import { toast } from '@/shared/components/ui/sonner';

type UseSessionOptions = {
  lastResults: SessionResult | null;
  setLastResults: Dispatch<SetStateAction<SessionResult | null>>;
  userEmail?: string | null;
  userId: string | null;
};

type SaveFinishedSessionInput = {
  completed: boolean;
  duration: number;
  normalizedMode: string;
  sessionResult: SessionResult;
  words: number | null;
};

function getErrorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message)
    : 'Unknown error';
}

export function useSession({
  lastResults,
  setLastResults,
  userEmail,
  userId,
}: UseSessionOptions) {
  const pendingSaveRef = useRef<SaveFinishedSessionInput | null>(null);

  const retrySave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;

    try {
      const sessionId = await saveSession({
        userId,
        email: userEmail ?? undefined,
        duration: pending.duration,
        speakingTime: pending.sessionResult.totalSpeakingTime,
        silenceTime: pending.sessionResult.totalSilenceTime,
        pauses: pending.sessionResult.hesitationCount,
        pauseCount: pending.sessionResult.pauseCount ?? pending.sessionResult.hesitationCount,
        words: pending.words,
        mode: pending.normalizedMode,
        flowScore: pending.sessionResult.flowScore,
        completed: pending.completed,
        hesitationLog: pending.sessionResult.hesitationLog,
        transcript: pending.sessionResult.transcript,
      });
      pendingSaveRef.current = null;
      setLastResults((prev) => {
        if (!prev) return prev;
        return { ...prev, sessionId, saveFailed: false };
      });
      toast.success('Session saved');
    } catch (error) {
      console.error('Retry save failed:', error);
      toast.error("Still couldn't save — check your connection", {
        action: { label: 'Retry', onClick: () => void retrySave() },
      });
    }
  }, [userId, userEmail, setLastResults]);

  const saveFinishedSession = useCallback(async ({
    completed,
    duration,
    normalizedMode,
    sessionResult,
    words,
  }: SaveFinishedSessionInput): Promise<void> => {
    let sessionId: string | null = null;
    try {
      sessionId = await saveSession({
        userId,
        email: userEmail ?? undefined,
        duration,
        speakingTime: sessionResult.totalSpeakingTime,
        silenceTime: sessionResult.totalSilenceTime,
        pauses: sessionResult.hesitationCount,
        pauseCount: sessionResult.pauseCount ?? sessionResult.hesitationCount,
        words,
        mode: normalizedMode,
        flowScore: sessionResult.flowScore,
        completed,
        hesitationLog: sessionResult.hesitationLog,
        transcript: sessionResult.transcript,
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        return { ...prev, sessionId };
      });
    } catch (error) {
      console.error('Failed to save session:', error);
      pendingSaveRef.current = { completed, duration, normalizedMode, sessionResult, words };
      setLastResults((prev) => {
        if (!prev) return prev;
        return { ...prev, saveFailed: true };
      });
      toast.error("Couldn't save your session", {
        description: 'Your results are still here. Tap retry to save.',
        action: { label: 'Retry', onClick: () => void retrySave() },
        duration: 10000,
      });
    }

    try {
      await updateStreak({
        userId,
        email: userEmail ?? undefined,
        localDate: new Date().toLocaleDateString('en-CA'),
      });
    } catch (error) {
      console.error('Failed to update streak:', error);
    }
  }, [userEmail, userId, setLastResults, retrySave]);

  const requestFeedback = useCallback(async () => {
    if (!lastResults) return;
    if (lastResults.analysisFeedbackLoading) return;
    if (lastResults.analysisFeedback) return;

    const transcript = lastResults.transcript.trim();
    const shouldAnalyze =
      transcript.length > 0 &&
      transcript !== 'No speech detected.' &&
      !transcript.startsWith('Transcription failed');
    if (!shouldAnalyze) return;

    setLastResults((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        analysisFeedbackLoading: true,
        analysisFeedbackError: undefined,
      };
    });

    try {
      const result = await analyzeSpeech({
        transcript,
        flowScore: lastResults.flowScore,
        hesitationCount: lastResults.hesitationCount,
        speakingTime: lastResults.totalSpeakingTime,
        wordCount: lastResults.wordCount ?? undefined,
      });
      await updateSession({
        sessionId: lastResults.sessionId,
        userId,
        analysisFeedback: result.feedback,
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        const baseScore = prev.baseFlowScore ?? prev.flowScore;
        const blendedScore = result.aiScore != null
          ? blendWithAiScore(baseScore, result.aiScore)
          : prev.flowScore;
        return {
          ...prev,
          analysisFeedback: result.feedback,
          analysisFeedbackLoading: false,
          baseFlowScore: baseScore,
          aiScore: result.aiScore,
          aiScoreFeedback: result.aiScoreFeedback,
          flowScore: blendedScore,
        };
      });
    } catch (error) {
      console.error('Failed to analyze transcript:', error);
      const message = getErrorMessage(error);
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          analysisFeedbackError: message,
          analysisFeedbackLoading: false,
        };
      });
    }
  }, [lastResults, setLastResults, userId]);

  const requestTranscription = useCallback(async () => {
    if (!lastResults) return;
    if (lastResults.transcriptionLoading) return;
    if (!lastResults.audioBlob) return;

    setLastResults((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transcriptionLoading: true,
        transcriptionError: undefined,
      };
    });

    try {
      const base64Audio = arrayBufferToBase64(await lastResults.audioBlob.arrayBuffer());
      const transcription = await transcribeAudio({
        audioBase64: base64Audio,
        mimeType: lastResults.audioMimeType || 'audio/webm',
        durationSec: lastResults.totalSessionTime,
      });
      const transcript = transcription.transcript;
      const transcribedWords = transcription.words;
      const words = transcribedWords.length > 0
        ? transcribedWords.length
        : transcript.trim().length > 0
          ? getWordCount(transcript)
          : null;
      await updateSession({
        sessionId: lastResults.sessionId,
        userId,
        transcript,
        words,
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transcript,
          wordCount: words,
          transcriptionLoading: false,
          transcriptionError: undefined,
          analysisFeedback: undefined,
          analysisFeedbackLoading: false,
          analysisFeedbackError: undefined,
        };
      });
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      const message = getErrorMessage(error);
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transcriptionError: message,
          transcriptionLoading: false,
        };
      });
    }
  }, [lastResults, setLastResults, userId]);

  return {
    requestFeedback,
    requestTranscription,
    saveFinishedSession,
  };
}
