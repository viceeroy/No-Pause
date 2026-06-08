export {
  DEFAULT_PAUSE_THRESHOLD,
  DEFAULT_PAUSE_THRESHOLD_MS,
} from "./constants.js";

export interface FlowScoreInput {
  cleanSpeakingTime: number;
  totalSessionTime: number;
  speakingTime: number;
  pauseCount: number;
}

export interface FlowScoreResult {
  score: number;
  isCompleted: boolean;
}

const FLOW_SCORE_MAX = 100;
const AI_SCORE_MAX = 100;
const DURATION_BONUS_MAX = 30;
const TOTAL_SCORE_MAX = 230;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function debugScoreBreakdown(details: Record<string, unknown>) {
  const viteEnv =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
      : undefined;
  const isDev = Boolean(viteEnv?.DEV);
  const isTest = Boolean(viteEnv?.VITEST) || viteEnv?.MODE === "test";

  if (isDev && !isTest) {
    console.debug("[NoPause] SCORE BREAKDOWN:", details);
  }
}

export function getDurationFactor(speakingTimeSec: number): number {
  return Math.min(Math.sqrt(Math.max(0, speakingTimeSec) / 120), 1.0);
}

export function calculateFlowScore(input: FlowScoreInput): FlowScoreResult {
  const speakingTime = Math.max(0, input.speakingTime ?? 0);
  const totalSessionTime = Math.max(0, input.totalSessionTime ?? 0);
  const cleanSpeakingTime = Math.max(0, input.cleanSpeakingTime ?? 0);
  const pauseCount = Math.max(0, input.pauseCount ?? 0);
  const isCompleted = speakingTime >= 5;

  if (speakingTime <= 0 || totalSessionTime <= 0) {
    debugScoreBreakdown({ speakingTime, totalSessionTime, finalScore: 0, isCompleted });
    return { score: 0, isCompleted };
  }

  const continuityRatio = cleanSpeakingTime / totalSessionTime;
  const durationFactor = getDurationFactor(speakingTime);
  const pausePenalty = Math.round((pauseCount / (speakingTime / 60)) * 2);
  const score = clamp(Math.round(continuityRatio * 100 * durationFactor) - pausePenalty, 0, FLOW_SCORE_MAX);

  debugScoreBreakdown({
    cleanSpeakingTime,
    totalSessionTime,
    speakingTime,
    pauseCount,
    continuityRatio,
    pausePenalty,
    finalScore: score,
    isCompleted,
  });

  return { score, isCompleted };
}

export function calculateDurationBonus(speakingTimeSec: number): number {
  return clamp(Math.round((speakingTimeSec ?? 0) / 10), 0, DURATION_BONUS_MAX);
}

export function calculateTotalScore(
  flowScore: number,
  aiScore: number,
  durationBonus: number,
): number {
  const flow = clamp(Math.round(flowScore ?? 0), 0, FLOW_SCORE_MAX);
  const ai = clamp(Math.round(aiScore ?? 0), 0, AI_SCORE_MAX);
  const bonus = clamp(Math.round(durationBonus ?? 0), 0, DURATION_BONUS_MAX);
  return Math.min(flow + ai + bonus, TOTAL_SCORE_MAX);
}

export function getScoreLabel(score: number): string {
  if (score >= 201) return "Perfect Flow";
  if (score >= 151) return "Great Flow";
  if (score >= 101) return "Good Flow";
  if (score >= 51) return "Getting There";
  return "Needs Practice";
}
