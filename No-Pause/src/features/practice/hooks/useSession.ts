import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { analyzeSpeech, saveSession, transcribeAudio, updateSession, updateStreak } from '@/lib/practiceApi';
import type { SessionResult } from '@/features/practice/pages/types';

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

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
  const saveFinishedSession = useCallback(async ({
    completed,
    duration,
    normalizedMode,
    sessionResult,
    words,
  }: SaveFinishedSessionInput): Promise<void> => {
    try {
      const [sessionId] = await Promise.all([
        saveSession({
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
        }),
        updateStreak({
          userId,
          email: userEmail ?? undefined,
          localDate: new Date().toLocaleDateString('en-CA'),
        }),
      ]);
      sessionResult.sessionId = sessionId;
    } catch (error) {
      console.error('Failed to sync session to Supabase:', error);
    }
  }, [userEmail, userId]);

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
      const feedback = await analyzeSpeech({
        transcript,
        flowScore: lastResults.flowScore,
        hesitationCount: lastResults.hesitationCount,
        speakingTime: lastResults.totalSpeakingTime,
        wordCount: lastResults.wordCount ?? undefined,
      });
      await updateSession({
        sessionId: lastResults.sessionId,
        userId,
        analysisFeedback: feedback,
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          analysisFeedback: feedback,
          analysisFeedbackLoading: false,
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
      const words = transcript.trim().length > 0
        ? transcript.trim().split(/\s+/).filter(Boolean).length
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
