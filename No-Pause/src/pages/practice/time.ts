const SECONDS_PER_MINUTE = 60;

/**
 * Formats a duration in `M:SS` form.
 */
export const toMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formats a duration for the live timer display in `M:SS` form.
 */
export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formats a duration in zero-padded `MM:SS` form.
 */
export const formatMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
