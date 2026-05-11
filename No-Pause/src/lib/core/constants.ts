export const SCORING_VERSION = "1.0";
export const TELEGRAM_MIN_DURATION = 1;
export const APP_URL = "https://nopause.org";

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
