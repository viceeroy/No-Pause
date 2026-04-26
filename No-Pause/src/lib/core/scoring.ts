export const TOPIC_MIN_TOTAL_SECONDS = 120;

export const LEMON_MIN_TOTAL_SECONDS = 60;

export const THRESHOLD_BEGINNER = 1.8;
export const THRESHOLD_INTERMEDIATE = 1.2;
export const THRESHOLD_ADVANCED = 0.8;
export const DEFAULT_PAUSE_THRESHOLD_MS = Math.round(THRESHOLD_BEGINNER * 1000);

export type PauseThresholdLevel = "beginner" | "intermediate" | "advanced";

export const DEFAULT_PAUSE_THRESHOLD_LEVEL: PauseThresholdLevel = "beginner";

export const PAUSE_THRESHOLD_BY_LEVEL: Record<PauseThresholdLevel, number> = {
  beginner: THRESHOLD_BEGINNER,
  intermediate: THRESHOLD_INTERMEDIATE,
  advanced: THRESHOLD_ADVANCED,
};

export const GRACE_RATE = 1.0;
export const PENALTY_PER_HPM = 10;
export const MIN_RATIO_FOR_UNCAPPED = 0.65;
export const CAP_AT_MIN_RATIO = 70;

const MIN_SPEAKING_RATIO_FOR_SCORE = 0.5;

type ScoreReason = "duration" | "speaking";

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
  const mode = options?.mode ?? "free";
  const hesitationCount = rawHesitationCount ?? 0;
  const speakingRatio = totalSession > 0 ? speakingTime / totalSession : 0;

  if (totalSession <= 0) return { score: 0, isCompleted: false, reason: "duration" };

  let isCompleted = false;
  let reason: ScoreReason | undefined;

  if (mode === "lemon") {
    const durationComplete = totalSession >= LEMON_MIN_TOTAL_SECONDS;
    if (!durationComplete) {
      reason = "duration";
    } else if (speakingRatio < MIN_SPEAKING_RATIO_FOR_SCORE) {
      reason = "speaking";
    } else {
      isCompleted = true;
    }
  } else if (mode === "topic") {
    const durationComplete = totalSession >= TOPIC_MIN_TOTAL_SECONDS;
    if (!durationComplete) {
      reason = "duration";
    } else if (speakingRatio < MIN_SPEAKING_RATIO_FOR_SCORE) {
      reason = "speaking";
    } else {
      isCompleted = true;
    }
  } else {
    isCompleted = totalSession >= 60 && speakingRatio >= MIN_SPEAKING_RATIO_FOR_SCORE;
    if (!isCompleted) reason = totalSession < 60 ? "duration" : "speaking";
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
  if (score >= 96) return "Perfect Flow";
  if (score >= 81) return "Great Flow";
  if (score >= 61) return "Good Flow";
  if (score >= 41) return "Getting There";
  return "Needs Practice";
}
