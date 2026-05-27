import { calculateFlowScore } from '@/lib/core/scoring';
import type { AnalyzerResults } from '@/features/practice/lib/speechAnalyzer';
import type { SessionResult } from '@/features/practice/pages/types';
import { formatMMSS } from '@/features/practice/pages/time';
import { getWordCount, parseTranscribedWords, type TranscribedWord } from '@/lib/core/utils';

const IS_DEV = import.meta.env.DEV;

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

function normalizeNonNegativeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function computeHesitationsFromWords(
  words: { word: string; start: number; end: number }[],
  pauseThresholdSec: number = 1.2
): number {
  let count = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= pauseThresholdSec) count++;
  }
  return count;
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

export function buildSessionResult({
  results,
  startTime,
  words: inputWords,
}: BuildSessionResultInput): BuildSessionResultOutput {
  const now = Date.now();
  const duration = Math.floor((now - startTime) / 1000);
  const mode = 'speaking';
  const analyzerSeconds = Math.round(normalizeNonNegativeNumber(results.totalTime) / 1000);
  const totalSessionTimeSec = Math.max(analyzerSeconds, duration);
  const speakingTimeSec = normalizeNonNegativeNumber(results.totalSpeakingTime);
  const silenceTimeSec = normalizeNonNegativeNumber(results.totalSilenceTime);
  const transcript = getTranscriptText(results.transcript);
  const timestampWords = getResultWords(results, inputWords);
  const hesitationCount = timestampWords.length > 1
    ? computeHesitationsFromWords(timestampWords)
    : Math.round(normalizeNonNegativeNumber(results.hesitationCount));

  const transcriptHasSpeech = Boolean(
    transcript &&
      transcript !== 'No speech detected.' &&
      transcript.trim().length > 0,
  );
  const hasSpeechEvidence =
    transcriptHasSpeech || hesitationCount > 0 || speakingTimeSec > 0;
  const words = transcript && transcript.trim().length > 0
    ? getWordCount(transcript)
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
        transcript,
      },
      scoreInput,
      duration,
      analyzerSeconds,
    });
  }

  const transcriptUsable = Boolean(
    transcript &&
    transcript.trim().length > 0 &&
    transcript !== 'No speech detected.' &&
    !transcript.startsWith('Transcription failed'),
  );

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
    normalizedMode: mode,
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
    },
  };
}

export function useScoring() {
  return {
    buildSessionResult,
  };
}
