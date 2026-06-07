import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { analyzeSpeech, saveSession, transcribeAudio, updateSession, updateStreak } from '@/lib/practiceApi';
import type { SessionResult } from '@/features/practice/pages/types';
import { arrayBufferToBase64 } from '@/shared/lib/utils';
import { getWordCount } from '@/lib/core/utils';
import { applyBandBonus, isScorableSession } from '@/lib/core/scoring';
import { SCORING_VERSION_FREE_SPEECH_BAND } from '@/lib/core/constants';
import { toast } from '@/shared/components/ui/sonner';
import { trackEvent } from '@/services/posthog';
import { useAuth } from '@/providers/AuthContext';

type UseSessionOptions = {
  lastResults: SessionResult | null;
  setLastResults: Dispatch<SetStateAction<SessionResult | null>>;
  userEmail?: string | null;
  userId: string | null;
  topic: string | null;
};

type SaveFinishedSessionInput = {
  completed: boolean;
  duration: number;
  normalizedMode: string;
  sessionResult: SessionResult;
  words: number | null;
};

export type SaveSessionResult = {
  sessionId: string | null;
  saveFailed: boolean;
};

export type RequestFeedbackInput = {
  sessionId?: string | null;
  flowScore: number;
  transcript: string;
  hesitationCount: number;
  speakingTime: number;
  wordCount?: number;
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
  topic,
}: UseSessionOptions) {
  const { isGuest } = useAuth();
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
  }: SaveFinishedSessionInput): Promise<SaveSessionResult> => {
    // Guests never write to the DB — scoring/result display continue upstream.
    if (isGuest) {
      return { sessionId: null, saveFailed: false };
    }

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
    } catch (error) {
      console.error('Failed to save session:', error);
      pendingSaveRef.current = { completed, duration, normalizedMode, sessionResult, words };
      toast.error("Couldn't save your session", {
        description: 'Your results are still here. Tap retry to save.',
        action: { label: 'Retry', onClick: () => void retrySave() },
        duration: 10000,
      });
      return { sessionId: null, saveFailed: true };
    }

    trackEvent('session_completed', {
      mode: normalizedMode,
      duration_s: duration,
      flow_score: sessionResult.flowScore,
      words,
      completed,
      pause_count: sessionResult.pauseCount ?? sessionResult.hesitationCount,
    });

    try {
      await updateStreak({
        userId,
        email: userEmail ?? undefined,
        localDate: new Date().toLocaleDateString('en-CA'),
      });
    } catch (error) {
      console.error('Failed to update streak:', error);
    }

    return { sessionId, saveFailed: false };
  }, [userEmail, userId, retrySave, isGuest]);

  const requestFeedback = useCallback(async (input: RequestFeedbackInput) => {
    try {
      const result = await analyzeSpeech({
        transcript: input.transcript,
        topic: topic ?? undefined,
        flowScore: input.flowScore,
        hesitationCount: input.hesitationCount,
        speakingTime: input.speakingTime,
        wordCount: input.wordCount,
      });

      const finalScore = applyBandBonus(input.flowScore, result.band);
      const bandPoints = finalScore - input.flowScore;

      trackEvent('ai_feedback_received', {
        band: result.band,
        band_points: bandPoints,
        flow_score_before: input.flowScore,
        flow_score_after: finalScore,
        has_topic: !!topic,
      });

      if (input.sessionId && userId) {
        updateSession({
          sessionId: input.sessionId,
          userId,
          analysisFeedback: result.feedback,
          flowScore: finalScore,
          // Free-speech band sessions use a 3-criterion rubric — tag for cohort separation.
          ...(!topic && bandPoints > 0 ? { scoringVersion: SCORING_VERSION_FREE_SPEECH_BAND } : {}),
        }).catch(console.error);
      }

      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          flowScore: finalScore,
          bandPoints,
          analysisFeedback: result.feedback,
          analysisFeedbackLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to get AI feedback:', error);
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
  }, [setLastResults, userId, topic]);

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
          analysisFeedbackLoading: true,
          analysisFeedbackError: undefined,
        };
      });

      const shouldAnalyze =
        isScorableSession(lastResults.flowScore) &&
        transcript.trim().length > 0 &&
        transcript !== 'No speech detected.' &&
        !transcript.startsWith('Transcription failed');

      if (shouldAnalyze) {
        try {
          const result = await analyzeSpeech({
            transcript,
            topic: topic ?? undefined,
            flowScore: lastResults.flowScore,
            hesitationCount: lastResults.hesitationCount,
            speakingTime: lastResults.totalSpeakingTime,
            wordCount: words ?? undefined,
          });
          const finalScore = applyBandBonus(lastResults.flowScore, result.band);
          const bandPoints = finalScore - lastResults.flowScore;
          await updateSession({
            sessionId: lastResults.sessionId,
            userId,
            analysisFeedback: result.feedback,
            flowScore: finalScore,
            // Free-speech band sessions use a 3-criterion rubric — tag for cohort separation.
            ...(!topic && bandPoints > 0 ? { scoringVersion: SCORING_VERSION_FREE_SPEECH_BAND } : {}),
          });
          setLastResults((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              analysisFeedback: result.feedback,
              analysisFeedbackLoading: false,
              flowScore: finalScore,
              bandPoints,
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
      } else {
        setLastResults((prev) => {
          if (!prev) return prev;
          return { ...prev, analysisFeedbackLoading: false };
        });
      }
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
  }, [lastResults, setLastResults, userId, topic]);

  return {
    requestTranscription,
    requestFeedback,
    saveFinishedSession,
  };
}
