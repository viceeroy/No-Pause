// Local storage wrapper for sessions & preferences
import { DEFAULT_PAUSE_THRESHOLD_LEVEL, type PauseThresholdLevel } from '@/lib/scoringConstants';

const PREFIX = 'fluencyflow';
const PREFS_KEY = `${PREFIX}_preferences`;

export interface AppPreferences {
  pauseThresholdLevel: PauseThresholdLevel;
}

const isPauseThresholdLevel = (value: unknown): value is PauseThresholdLevel => (
  value === 'beginner' || value === 'intermediate' || value === 'advanced'
);

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  getPreferences(): AppPreferences {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { pauseThresholdLevel: DEFAULT_PAUSE_THRESHOLD_LEVEL };
      const parsed = JSON.parse(raw) as Partial<AppPreferences>;
      if (!isPauseThresholdLevel(parsed.pauseThresholdLevel)) {
        return { pauseThresholdLevel: DEFAULT_PAUSE_THRESHOLD_LEVEL };
      }
      return { pauseThresholdLevel: parsed.pauseThresholdLevel };
    } catch {
      return { pauseThresholdLevel: DEFAULT_PAUSE_THRESHOLD_LEVEL };
    }
  },

  savePreferences(prefs: Partial<AppPreferences>): AppPreferences {
    const current = this.getPreferences();
    const next: AppPreferences = {
      ...current,
      ...prefs,
    };
    safeSetItem(PREFS_KEY, JSON.stringify(next));
    return next;
  },
};
