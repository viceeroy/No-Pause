import {
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
  GRACE_RATE,
  PENALTY_PER_HPM,
  MIN_RATIO_FOR_UNCAPPED,
  CAP_AT_MIN_RATIO,
} from '../scoringConstants.js';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
const IS_DEV = Boolean(viteEnv?.DEV);
const IS_TEST = Boolean(viteEnv?.VITEST) || viteEnv?.MODE === 'test';
const MIN_SPEAKING_RATIO_FOR_SCORE = 0.5;

const debugScoreBreakdown = (details: Record<string, unknown>) => {
  if (IS_DEV && !IS_TEST) {
    console.debug('[NoSpeech] SCORE BREAKDOWN:', details);
  }
};

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
  const speakingRatio = totalSession > 0 ? speakingTime / totalSession : 0;

  if (totalSession <= 0) return { score: 0, isCompleted: false, reason: 'duration' };

  let isCompleted = false;
  let reason: ScoreReason | undefined;

  if (mode === 'lemon') {
    const durationComplete = totalSession >= LEMON_MIN_TOTAL_SECONDS;
    if (!durationComplete) {
      reason = 'duration';
    } else if (speakingRatio < MIN_SPEAKING_RATIO_FOR_SCORE) {
      reason = 'speaking';
    } else {
      isCompleted = true;
    }
  } else if (mode === 'topic') {
    const durationComplete = totalSession >= TOPIC_MIN_TOTAL_SECONDS;
    if (!durationComplete) {
      reason = 'duration';
    } else if (speakingRatio < MIN_SPEAKING_RATIO_FOR_SCORE) {
      reason = 'speaking';
    } else {
      isCompleted = true;
    }
  } else {
    isCompleted = totalSession >= 60 && speakingRatio >= MIN_SPEAKING_RATIO_FOR_SCORE;
    if (!isCompleted) reason = totalSession < 60 ? 'duration' : 'speaking';
  }

  if (!isCompleted) {
    debugScoreBreakdown({
      mode,
      speakingTime: `${speakingTime}s`,
      totalSession: `${totalSession}s`,
      hesitationCount,
      reason,
      completed: false,
      finalScore: 0,
    });
    return { score: 0, isCompleted: false, reason };
  }

  // --- Rate-based scoring ---
  // Hesitations per minute of speaking time, with a 30s floor to avoid
  // division spikes on sessions that barely qualify.
  const speakingMinutes = Math.max(speakingTime / 60, 0.5);
  const hesitationsPerMinute = hesitationCount / speakingMinutes;

  // Grace zone: up to 1.0 hesitations/min scores a perfect 100.
  // Each additional hesitation/min above the grace costs 15 points.
  const excessRate = Math.max(0, hesitationsPerMinute - GRACE_RATE);
  let finalScore = Math.max(0, Math.round(100 - excessRate * PENALTY_PER_HPM));
  
  if (speakingRatio < MIN_RATIO_FOR_UNCAPPED) {
    // Linear interpolation: 0.50→70, 0.65→100
    const ratioRange = MIN_RATIO_FOR_UNCAPPED - MIN_SPEAKING_RATIO_FOR_SCORE;
    const ratioProgress = Math.min(1, (speakingRatio - MIN_SPEAKING_RATIO_FOR_SCORE) / ratioRange);
    const maxScore = Math.round(CAP_AT_MIN_RATIO + ratioProgress * (100 - CAP_AT_MIN_RATIO));
    finalScore = Math.min(finalScore, maxScore);
  }

  debugScoreBreakdown({
    mode,
    speakingTime: `${speakingTime}s`,
    totalSession: `${totalSession}s`,
    hesitationCount,
    speakingMinutes: speakingMinutes.toFixed(2),
    hesitationsPerMinute: hesitationsPerMinute.toFixed(2),
    graceRate: GRACE_RATE,
    excessRate: excessRate.toFixed(2),
    speakingRatio: `${(speakingRatio * 100).toFixed(0)}%`,
    completed: true,
    finalScore,
  });

  return { score: finalScore, isCompleted: true };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Great';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Keep Practicing';
}
