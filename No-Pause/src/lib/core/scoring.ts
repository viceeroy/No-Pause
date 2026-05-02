import {
  CAP_AT_MIN_RATIO,
  GETTING_THERE_MIN_SCORE,
  GOOD_FLOW_MIN_SCORE,
  GRACE_RATE,
  GREAT_FLOW_MIN_SCORE,
  MIN_RATIO_FOR_UNCAPPED,
  MIN_SPEAKING_RATIO_FOR_SCORE,
  PENALTY_PER_HPM,
  PERFECT_FLOW_MIN_SCORE,
  SPEAKING_MIN_TOTAL_SECONDS,
} from "./constants.js";

export {
  CAP_AT_MIN_RATIO,
  DEFAULT_PAUSE_THRESHOLD_LEVEL,
  DEFAULT_PAUSE_THRESHOLD_MS,
  GRACE_RATE,
  MIN_RATIO_FOR_UNCAPPED,
  MIN_SPEAKING_RATIO_FOR_SCORE,
  PAUSE_THRESHOLD_BY_LEVEL,
  PENALTY_PER_HPM,
  SPEAKING_MIN_TOTAL_SECONDS,
  THRESHOLD_ADVANCED,
  THRESHOLD_BEGINNER,
  THRESHOLD_INTERMEDIATE,
  type PauseThresholdLevel,
} from "./constants.js";

type ScoreReason = "duration" | "speaking";

export interface FlowScoreOptions {
  speakingTimeSec?: number;
  totalSessionTimeSec?: number;
  hasSpeechEvidence?: boolean;
}

export interface FlowScoreResult {
  score: number;
  isCompleted: boolean;
  reason?: ScoreReason;
}

function debugScoreBreakdown(details: Record<string, unknown>) {
  const viteEnv =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
      : undefined;
  const isDev = Boolean(viteEnv?.DEV);
  const isTest = Boolean(viteEnv?.VITEST) || viteEnv?.MODE === "test";

  if (isDev && !isTest) {
    console.debug("[NoSpeech] SCORE BREAKDOWN:", details);
  }
}

export function calculateFlowScore(
  rawHesitationCount: number,
  options?: FlowScoreOptions,
): FlowScoreResult {
  const speakingTime = options?.speakingTimeSec ?? 0;
  const totalSession = options?.totalSessionTimeSec ?? 0;
  const mode = "speaking";
  const hesitationCount = rawHesitationCount ?? 0;
  const speakingRatio = totalSession > 0 ? speakingTime / totalSession : 0;

  if (totalSession <= 0) return { score: 0, isCompleted: false, reason: "duration" };

  const isCompleted =
    totalSession >= SPEAKING_MIN_TOTAL_SECONDS &&
    speakingRatio >= MIN_SPEAKING_RATIO_FOR_SCORE;
  const reason: ScoreReason | undefined = !isCompleted
    ? totalSession < SPEAKING_MIN_TOTAL_SECONDS ? "duration" : "speaking"
    : undefined;

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

  const speakingMinutes = Math.max(speakingTime / 60, 0.5);
  const hesitationsPerMinute = hesitationCount / speakingMinutes;
  const excessRate = Math.max(0, hesitationsPerMinute - GRACE_RATE);
  let finalScore = Math.max(0, Math.round(100 - excessRate * PENALTY_PER_HPM));

  if (speakingRatio < MIN_RATIO_FOR_UNCAPPED) {
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
  if (score >= PERFECT_FLOW_MIN_SCORE) return "Perfect Flow";
  if (score >= GREAT_FLOW_MIN_SCORE) return "Great Flow";
  if (score >= GOOD_FLOW_MIN_SCORE) return "Good Flow";
  if (score >= GETTING_THERE_MIN_SCORE) return "Getting There";
  return "Needs Practice";
}
