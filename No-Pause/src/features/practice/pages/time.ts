import { formatDuration } from '@/lib/core/time';

/**
 * Formats a duration with spaced minute/second units.
 */
export const toMMSS = (seconds: number) => {
  return formatDuration(seconds);
};

/**
 * Formats a duration for the live timer display with spaced minute/second units.
 */
export const formatTime = (seconds: number) => {
  return formatDuration(seconds);
};

/**
 * Formats a duration with spaced minute/second units.
 */
export const formatMMSS = (seconds: number) => {
  return formatDuration(seconds);
};
