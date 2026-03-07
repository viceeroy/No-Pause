import {
  LEMON_MIN_SPEAKING_SECONDS,
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_SPEAKING_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/lib/scoringConstants';

const IS_DEV = import.meta.env.DEV;
const IS_TEST = Boolean(import.meta.env.VITEST) || import.meta.env.MODE === 'test';

type ScoreReason = 'duration' | 'speaking';

export interface FlowScoreOptions {
  mode?: string;
  speakingTimeSec?: number;
  totalSessionTimeSec?: number;
  hasSpeechEvidence?: boolean;
}

export interface FlowScoreResult {
  score: number;
  isCompleted: boolean;
  reason?: ScoreReason;
}

export function calculateFlowScore(
  rawHesitationCount: number,
  options?: FlowScoreOptions,
): FlowScoreResult {
  const speakingTime = options?.speakingTimeSec ?? 0;
  const totalSession = options?.totalSessionTimeSec ?? 0;
  const mode = options?.mode ?? 'free';
  const hesitationCount = rawHesitationCount ?? 0;

  if (totalSession <= 0) return { score: 0, isCompleted: false, reason: 'duration' };

  let isCompleted = false;
  let reason: ScoreReason | undefined;

  if (mode === 'lemon') {
    const durationComplete = totalSession >= LEMON_MIN_TOTAL_SECONDS;
    if (!durationComplete) {
      reason = 'duration';
    } else if (speakingTime < LEMON_MIN_SPEAKING_SECONDS) {
      reason = 'speaking';
    } else {
      isCompleted = true;
    }
  } else if (mode === 'topic') {
    const durationComplete = totalSession >= TOPIC_MIN_TOTAL_SECONDS;
    if (!durationComplete) {
      reason = 'duration';
    } else if (speakingTime < TOPIC_MIN_SPEAKING_SECONDS) {
      reason = 'speaking';
    } else {
      isCompleted = true;
    }
  } else {
    const speechEvidenceFallback = Boolean(options?.hasSpeechEvidence);
    isCompleted = totalSession >= 60 && (speakingTime >= 45 || speechEvidenceFallback);
    if (!isCompleted) reason = totalSession < 60 ? 'duration' : 'speaking';
  }

  if (!isCompleted) {
    if (IS_DEV && !IS_TEST) {
      console.log('[NoSpeech] 📊 SCORE BREAKDOWN:', {
        mode,
        speakingTime: `${speakingTime}s`,
        totalSession: `${totalSession}s`,
        hesitationCount,
        reason,
        completed: false,
        finalScore: 0,
      });
    }
    return { score: 0, isCompleted: false, reason };
  }

  const penalizedHesitations = Math.max(0, hesitationCount - 2);
  const hesitationPenalty = penalizedHesitations * 10;
  const finalScore = Math.max(0, 100 - hesitationPenalty);

  if (IS_DEV && !IS_TEST) {
    console.log('[NoSpeech] 📊 SCORE BREAKDOWN:', {
      mode,
      speakingTime: `${speakingTime}s`,
      totalSession: `${totalSession}s`,
      hesitationCount,
      penalizedHesitations,
      hesitationPenalty: `-${hesitationPenalty}`,
      completed: true,
      finalScore,
    });
  }

  return { score: finalScore, isCompleted: true };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Great';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Keep Practicing';
}
