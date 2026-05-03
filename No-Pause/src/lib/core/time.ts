const SECONDS_PER_MINUTE = 60;

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
  const remainingSeconds = safeSeconds % SECONDS_PER_MINUTE;

  if (minutes === 0) {
    return `${remainingSeconds} s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes} m`;
  }

  return `${minutes} m ${remainingSeconds} s`;
}

export function formatPracticeTotalDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);

  if (minutes === 0) {
    return `${safeSeconds} s`;
  }

  return `${minutes} m`;
}
