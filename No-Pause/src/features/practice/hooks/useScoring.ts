import { calculateFlowScore } from '@/lib/core/scoring';
import type { AnalyzerResults } from '@/features/practice/lib/speechAnalyzer';
import type { SessionResult } from '@/features/practice/pages/types';
import { formatMMSS } from '@/features/practice/pages/time';

const IS_DEV = import.meta.env.DEV;

export type BuildSessionResultInput = {
  results: AnalyzerResults;
  startTime: number;
};

export type BuildSessionResultOutput = {
  completed: boolean;
  duration: number;
  normalizedMode: string;
  sessionResult: SessionResult;
  words: number | null;
};

function getIncompleteStatusNote(speakingTimeSec: number): string {
  return `Speaking Mode requires at least 5 seconds of speaking time. You spoke for ${formatMMSS(speakingTimeSec)} this session.`;
}

function normalizeNonNegativeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function buildSessionResult({
  results,
  startTime,
}: BuildSessionResultInput): BuildSessionResultOutput {
  const duration = Math.floor((Date.now() - startTime) / 1000);
  const normalizedMode = 'speaking';
  const practiceMode = 'speaking';
  const recordedSeconds = Math.floor((Date.now() - startTime) / 1000);
  const analyzerSeconds = Math.round(normalizeNonNegativeNumber(results.totalTime) / 1000);
  const totalSessionTimeSec = Math.max(analyzerSeconds, recordedSeconds);
  const speakingTimeSec = normalizeNonNegativeNumber(results.totalSpeakingTime);
  const silenceTimeSec = normalizeNonNegativeNumber(results.totalSilenceTime);
  const hesitationCount = Math.round(normalizeNonNegativeNumber(results.hesitationCount));

  const transcriptHasSpeech = Boolean(
    results.transcript &&
      results.transcript !== 'No speech detected.' &&
      results.transcript.trim().length > 0,
  );
  const hasSpeechEvidence =
    transcriptHasSpeech || hesitationCount > 0 || speakingTimeSec > 0;
  const words = results.transcript && results.transcript.trim().length > 0
    ? results.transcript.trim().split(/\s+/).filter(Boolean).length
    : null;

  const scoreInput = {
    hesitationCount,
    speakingTimeSec,
    totalSessionTimeSec,
    hasSpeechEvidence,
  };
  if (IS_DEV) {
    console.info('[NoPause][WebSessionScoring]', {
      rawAnalyzerResults: {
        totalSpeakingTime: results.totalSpeakingTime,
        hesitationCount: results.hesitationCount,
        totalTime: results.totalTime,
        transcript: results.transcript,
      },
      scoreInput,
      recordedSeconds,
      analyzerSeconds,
    });
  }

  const scoreResult = calculateFlowScore(scoreInput.hesitationCount, {
    speakingTimeSec: scoreInput.speakingTimeSec,
    totalSessionTimeSec: scoreInput.totalSessionTimeSec,
    hasSpeechEvidence: scoreInput.hasSpeechEvidence,
  });
  const completed = scoreResult.isCompleted;
  const flowScore = scoreResult.score;
  const safeFlowScore = Number.isFinite(flowScore) ? flowScore : 0;

  let statusNote: string | undefined;
  if (!scoreResult.isCompleted) {
    statusNote = getIncompleteStatusNote(speakingTimeSec);
  } else if (flowScore === 0 && hesitationCount > 2) {
    statusNote = 'Session completed, but score is 0 because hesitation units were too high.';
  }

  return {
    completed,
    duration,
    normalizedMode,
    words,
    sessionResult: {
      sessionId: null,
      flowScore: safeFlowScore,
      totalSpeakingTime: speakingTimeSec,
      totalSilenceTime: silenceTimeSec,
      totalSessionTime: totalSessionTimeSec,
      isCompleted: scoreResult.isCompleted,
      hesitationCount,
      pauseCount: hesitationCount,
      hesitationLog: results.hesitationLog,
      mode: practiceMode,
      audioBlob: results.audioBlob,
      audioMimeType: results.audioMimeType,
      transcript: results.transcript,
      analysisFeedback: undefined,
      analysisFeedbackLoading: false,
      analysisFeedbackError: undefined,
      transcriptionLoading: false,
      transcriptionError: undefined,
      wordCount: words,
      statusNote,
    },
  };
}

export function useScoring() {
  return {
    buildSessionResult,
  };
}
