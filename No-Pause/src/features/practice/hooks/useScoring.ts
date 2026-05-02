import { calculateFlowScore } from '@/lib/core/scoring';
import { SPEAKING_MIN_TOTAL_SECONDS } from '@/lib/core/constants';
import type { AnalyzerResults } from '@/features/practice/lib/speechAnalyzer';
import type { SessionResult } from '@/features/practice/pages/types';
import { formatMMSS, toMMSS } from '@/features/practice/pages/time';

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
  return `Speaking Mode requires at least ${toMMSS(SPEAKING_MIN_TOTAL_SECONDS)} total session and 50% speaking time. You spoke for ${formatMMSS(speakingTimeSec)} this session.`;
}

export function buildSessionResult({
  results,
  startTime,
}: BuildSessionResultInput): BuildSessionResultOutput {
  const duration = Math.floor((Date.now() - startTime) / 1000);
  const normalizedMode = 'speaking';
  const practiceMode = 'speaking';
  const recordedSeconds = Math.floor((Date.now() - startTime) / 1000);
  const analyzerSeconds = Math.round(results.totalTime / 1000);
  const totalSessionTimeSec = Math.max(analyzerSeconds, recordedSeconds);

  const transcriptHasSpeech = Boolean(
    results.transcript &&
      results.transcript !== 'No speech detected.' &&
      results.transcript.trim().length > 0,
  );
  const hasSpeechEvidence =
    transcriptHasSpeech || results.hesitationCount > 0 || results.totalSpeakingTime > 0;
  const words = results.transcript && results.transcript.trim().length > 0
    ? results.transcript.trim().split(/\s+/).filter(Boolean).length
    : null;

  const scoreResult = calculateFlowScore(results.hesitationCount, {
    speakingTimeSec: results.totalSpeakingTime,
    totalSessionTimeSec,
    hasSpeechEvidence,
  });
  const completed = scoreResult.isCompleted;
  const flowScore = scoreResult.score;
  const safeFlowScore = Number.isFinite(flowScore) ? flowScore : 0;

  let statusNote: string | undefined;
  if (!scoreResult.isCompleted) {
    statusNote = getIncompleteStatusNote(results.totalSpeakingTime);
  } else if (flowScore === 0 && results.hesitationCount > 2) {
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
      totalSpeakingTime: results.totalSpeakingTime,
      totalSessionTime: totalSessionTimeSec,
      isCompleted: scoreResult.isCompleted,
      hesitationCount: results.hesitationCount,
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
