import { calculateDurationBonus, calculateFlowScore } from '@/lib/core/scoring';
import { analyzeSilenceFromTimestamps } from '@/lib/core/silence';
import type { AnalyzerResults } from '@/features/practice/lib/speechAnalyzer';
import type { SessionResult } from '@/features/practice/pages/types';
import { formatMMSS } from '@/features/practice/pages/time';
import { getWordCount, parseTranscribedWords, type TranscribedWord } from '@/lib/core/utils';

const IS_DEV = import.meta.env.DEV;
const MIN_WORDS_FOR_SCORING = 3;

export type BuildSessionResultInput = {
  results: AnalyzerResults;
  startTime: number;
  words?: TranscribedWord[];
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

function getTranscriptText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'transcript' in value) {
    return String((value as { transcript?: unknown }).transcript ?? '');
  }
  return '';
}

function getResultWords(results: AnalyzerResults, words?: TranscribedWord[]): TranscribedWord[] {
  if (words && words.length > 0) {
    return words;
  }
  const transcriptValue = results.transcript as unknown;
  if (transcriptValue && typeof transcriptValue === 'object' && 'words' in transcriptValue) {
    return parseTranscribedWords((transcriptValue as { words?: unknown }).words);
  }
  return [];
}

function buildScoringError(
  results: AnalyzerResults,
  startTime: number,
  transcript: string,
  errorMessage: string,
): BuildSessionResultOutput {
  const now = Date.now();
  const duration = Math.floor((now - startTime) / 1000);
  return {
    completed: false,
    duration,
    normalizedMode: 'speaking',
    words: null,
    sessionResult: {
      sessionId: null,
      flowScore: 0,
      totalSpeakingTime: 0,
      totalSilenceTime: 0,
      totalSessionTime: duration,
      isCompleted: false,
      hesitationCount: 0,
      pauseCount: 0,
      hesitationLog: [],
      mode: 'speaking',
      audioBlob: results.audioBlob,
      audioMimeType: results.audioMimeType,
      transcript,
      analysisFeedback: undefined,
      analysisFeedbackLoading: false,
      analysisFeedbackError: undefined,
      transcriptionLoading: false,
      transcriptionError: undefined,
      wordCount: null,
      scoringError: errorMessage,
    },
  };
}

export function buildSessionResult({
  results,
  startTime,
  words: inputWords,
}: BuildSessionResultInput): BuildSessionResultOutput {
  const now = Date.now();
  const duration = Math.floor((now - startTime) / 1000);
  const mode = 'speaking';
  const transcript = getTranscriptText(results.transcript);
  const timestampWords = getResultWords(results, inputWords);

  if (timestampWords.length < MIN_WORDS_FOR_SCORING) {
    return buildScoringError(
      results,
      startTime,
      transcript,
      "Couldn't score this session — please try again",
    );
  }

  const totalSessionTimeSec = Math.max(1, duration);
  const analysis = analyzeSilenceFromTimestamps(timestampWords, totalSessionTimeSec);
  const { speakingTimeSec, totalSilenceSec, gapCount, gaps } = analysis;
  const cleanSpeakingTime = totalSessionTimeSec - totalSilenceSec;

  const words = transcript && transcript.trim().length > 0
    ? getWordCount(transcript)
    : null;

  const scoreInput = {
    cleanSpeakingTime,
    totalSessionTime: totalSessionTimeSec,
    speakingTime: speakingTimeSec,
    pauseCount: gapCount,
  };
  if (IS_DEV) {
    console.info('[NoPause][WebSessionScoring]', {
      scoreInput,
      totalSilenceSec,
      duration,
      timestampWordCount: timestampWords.length,
    });
  }

  const transcriptUsable = Boolean(
    transcript &&
    transcript.trim().length > 0 &&
    transcript !== 'No speech detected.' &&
    !transcript.startsWith('Transcription failed'),
  );

  const scoreResult = calculateFlowScore(scoreInput);
  const completed = scoreResult.isCompleted;
  const flowScore = scoreResult.score;
  const safeFlowScore = Number.isFinite(flowScore) ? flowScore : 0;
  const durationBonus = calculateDurationBonus(speakingTimeSec);

  let statusNote: string | undefined;
  if (!scoreResult.isCompleted) {
    statusNote = getIncompleteStatusNote(speakingTimeSec);
  }

  return {
    completed,
    duration,
    normalizedMode: mode,
    words,
    sessionResult: {
      sessionId: null,
      flowScore: safeFlowScore,
      totalSpeakingTime: speakingTimeSec,
      totalSilenceTime: totalSilenceSec,
      totalSessionTime: totalSessionTimeSec,
      isCompleted: scoreResult.isCompleted,
      hesitationCount: gapCount,
      pauseCount: gapCount,
      hesitationLog: [],
      mode,
      audioBlob: results.audioBlob,
      audioMimeType: results.audioMimeType,
      transcript,
      analysisFeedback: undefined,
      analysisFeedbackLoading: transcriptUsable,
      analysisFeedbackError: undefined,
      transcriptionLoading: false,
      transcriptionError: undefined,
      wordCount: words,
      statusNote,
      totalSilenceSec,
      flowScoreBase: safeFlowScore,
      durationBonus,
      gaps,
      transcribedWords: timestampWords,
    },
  };
}

export function useScoring() {
  return {
    buildSessionResult,
  };
}
