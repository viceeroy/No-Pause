const SECONDS_PER_MINUTE = 60;

const formatMinutesSeconds = (seconds: number) => {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  return `${mins}m ${secs}s`;
};

/**
 * Formats a duration in `Xm Ys` form.
 */
export const toMMSS = (seconds: number) => {
  return formatMinutesSeconds(seconds);
};

/**
 * Formats a duration for the live timer display in `Xm Ys` form.
 */
export const formatTime = (seconds: number) => {
  return formatMinutesSeconds(seconds);
};

/**
 * Formats a duration in `Xm Ys` form.
 */
export const formatMMSS = (seconds: number) => {
  return formatMinutesSeconds(seconds);
};
