// Topic mode
export const TOPIC_MIN_TOTAL_SECONDS = 120;
export const TOPIC_MIN_SPEAKING_SECONDS = 60;

// Lemon / Flow mode
export const LEMON_MIN_TOTAL_SECONDS = 60;
export const LEMON_MIN_SPEAKING_SECONDS = 30;

export const THRESHOLD_BEGINNER = 1.8;
export const THRESHOLD_INTERMEDIATE = 1.2;
export const THRESHOLD_ADVANCED = 0.8;

export type PauseThresholdLevel = 'beginner' | 'intermediate' | 'advanced';

export const DEFAULT_PAUSE_THRESHOLD_LEVEL: PauseThresholdLevel = 'beginner';

export const PAUSE_THRESHOLD_BY_LEVEL: Record<PauseThresholdLevel, number> = {
  beginner: THRESHOLD_BEGINNER,
  intermediate: THRESHOLD_INTERMEDIATE,
  advanced: THRESHOLD_ADVANCED,
};

// Flow Score Calculation Constants
export const GRACE_RATE = 1.0;
export const PENALTY_PER_HPM = 15;
export const MIN_RATIO_FOR_UNCAPPED = 0.65;
export const CAP_AT_MIN_RATIO = 70;