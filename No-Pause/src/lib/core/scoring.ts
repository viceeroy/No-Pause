export {
  DEFAULT_PAUSE_THRESHOLD_LEVEL,
  DEFAULT_PAUSE_THRESHOLD_MS,
  PAUSE_THRESHOLD_BY_LEVEL,
  THRESHOLD_ADVANCED,
  THRESHOLD_BEGINNER,
  THRESHOLD_INTERMEDIATE,
  type PauseThresholdLevel,
} from "./constants.js";

export interface FlowScoreOptions {
  speakingTimeSec?: number;
  totalSessionTimeSec?: number;
  hasSpeechEvidence?: boolean;
}

export interface FlowScoreResult {
  score: number;
  isCompleted: boolean;
  note?: string;
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
  const speakingTime = Math.max(0, Math.floor(options?.speakingTimeSec ?? 0));
  const mode = "speaking";
  const hesitationCount = Math.max(0, Math.floor(rawHesitationCount ?? 0));
  if (speakingTime < 5) {
    const note = "Session was too short to score. Speak for at least 5 seconds.";

    debugScoreBreakdown({
      mode,
      speakingTime: `${speakingTime}s`,
      hesitationCount,
      completed: false,
      finalScore: 0,
      note,
    });

    return { score: 0, isCompleted: false, note };
  }

  const completedSpeakingMinutes = Math.floor(speakingTime / 60);
  const finalScore = Math.max(0, speakingTime + completedSpeakingMinutes * 40 - hesitationCount * 10);

  debugScoreBreakdown({
    mode,
    speakingTime: `${speakingTime}s`,
    hesitationCount,
    completedSpeakingMinutes,
    completed: true,
    finalScore,
  });

  return { score: finalScore, isCompleted: true };
}

export function getScoreLabel(score: number): string {
  if (score >= 300) return "Perfect Flow";
  if (score >= 200) return "Great Flow";
  if (score >= 100) return "Good Flow";
  if (score >= 50) return "Getting There";
  return "Needs Practice";
}
