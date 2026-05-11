import { formatDuration } from '@/lib/core/time';

/**
 * Formats a duration with spaced minute/second units.
 */
export const formatMMSS = (seconds: number) => {
  return formatDuration(seconds);
};
