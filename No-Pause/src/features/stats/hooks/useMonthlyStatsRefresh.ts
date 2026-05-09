import { type MutableRefObject, useEffect, useRef } from 'react';
import { getCurrentMonthRange } from '@/lib/core/queries';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getCurrentUtcMonthKey(): string {
  return getCurrentMonthRange().start;
}

function getNextUtcMidnightDelay(): number {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );

  return Math.max(1, nextMidnight - now.getTime());
}

export function useMonthlyStatsRefresh({
  lastLoadedMonthRef,
  refreshStats,
}: {
  lastLoadedMonthRef: MutableRefObject<string | null>;
  refreshStats: () => void | Promise<void>;
}) {
  const refreshStatsRef = useRef(refreshStats);

  useEffect(() => {
    refreshStatsRef.current = refreshStats;
  }, [refreshStats]);

  useEffect(() => {
    const refreshIfMonthChanged = () => {
      const lastLoadedMonth = lastLoadedMonthRef.current;
      const currentMonth = getCurrentUtcMonthKey();

      if (lastLoadedMonth && lastLoadedMonth !== currentMonth) {
        void refreshStatsRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshIfMonthChanged();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      refreshIfMonthChanged();
      intervalId = window.setInterval(refreshIfMonthChanged, MILLISECONDS_PER_DAY);
    }, getNextUtcMidnightDelay());

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

}
