import { DEFAULT_PAUSE_THRESHOLD } from "./constants.js";

export interface SilenceWord {
  start: number;
  end: number;
}

export interface SilenceGap {
  startSec: number;
  durationSec: number;
}

export interface SilenceAnalysis {
  totalSilenceSec: number;
  speakingTimeSec: number;
  gapCount: number;
  gaps: SilenceGap[];
}

export function analyzeSilenceFromTimestamps(
  words: SilenceWord[],
  totalSessionTimeSec: number,
  thresholdSec: number = DEFAULT_PAUSE_THRESHOLD,
): SilenceAnalysis {
  const ordered = words
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start)
    .sort((a, b) => a.start - b.start);

  if (ordered.length === 0) {
    return { totalSilenceSec: 0, speakingTimeSec: 0, gapCount: 0, gaps: [] };
  }

  const speakingTimeRaw = ordered.reduce((sum, w) => sum + Math.max(0, w.end - w.start), 0);
  const speakingTimeSec = Math.max(1, Math.round(speakingTimeRaw));

  const gaps: SilenceGap[] = [];
  let silenceSum = 0;

  const leadGap = ordered[0].start;
  if (leadGap >= thresholdSec) {
    gaps.push({ startSec: 0, durationSec: leadGap });
    silenceSum += leadGap;
  }

  for (let i = 1; i < ordered.length; i++) {
    const gap = ordered[i].start - ordered[i - 1].end;
    if (gap >= thresholdSec) {
      gaps.push({ startSec: ordered[i - 1].end, durationSec: gap });
      silenceSum += gap;
    }
  }

  const trailGap = Math.max(0, totalSessionTimeSec - ordered[ordered.length - 1].end);
  if (trailGap >= thresholdSec) {
    gaps.push({ startSec: ordered[ordered.length - 1].end, durationSec: trailGap });
    silenceSum += trailGap;
  }

  return {
    totalSilenceSec: Math.round(silenceSum),
    speakingTimeSec,
    gapCount: gaps.length,
    gaps,
  };
}
