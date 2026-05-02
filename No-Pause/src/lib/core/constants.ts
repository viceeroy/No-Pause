export const SCORING_VERSION = "1.0";
export const TELEGRAM_MIN_DURATION = 1;
export const APP_URL = "https://nopause.org";

export const SPEAKING_MIN_TOTAL_SECONDS = 60;

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

export const PERFECT_FLOW_MIN_SCORE = 96;
export const GREAT_FLOW_MIN_SCORE = 81;
export const GOOD_FLOW_MIN_SCORE = 61;
export const GETTING_THERE_MIN_SCORE = 41;
