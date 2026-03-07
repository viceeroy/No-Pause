// Local storage wrapper for sessions & preferences
import { DEFAULT_PAUSE_THRESHOLD_LEVEL, type PauseThresholdLevel } from '@/lib/scoringConstants';

const PREFIX = 'fluencyflow';
const SESSIONS_KEY = `${PREFIX}_sessions`;
const PREFS_KEY = `${PREFIX}_preferences`;
const STREAK_KEY = `${PREFIX}_streak`;
const LEMON_SCORES_KEY = `${PREFIX}_lemon_scores`;
const TOPIC_SCORES_KEY = `${PREFIX}_topic_scores`;

const MAX_SESSIONS = 200;
const MAX_LEMON_SCORES = 200;
const MAX_TOPIC_SCORES = 200;

export interface SessionData {
  id?: string;
  flowScore: number;
  isCompleted?: boolean;
  hesitationCount: number;
  mode: string;
  audioBlob?: Blob | null;
  audioMimeType?: string;
  transcript?: string;
  duration?: number;
  word?: string;
  topic?: string;
  difficulty?: string;
  created_at?: string;
}

export interface AppPreferences {
  pauseThresholdLevel: PauseThresholdLevel;
}

const isPauseThresholdLevel = (value: unknown): value is PauseThresholdLevel => (
  value === 'beginner' || value === 'intermediate' || value === 'advanced'
);

function toSerializable(session: SessionData): Omit<SessionData, 'audioBlob'> {
  const { audioBlob, ...rest } = session;
  return rest;
}

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

  getSessions(): SessionData[] {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveSession(session: SessionData) {
    const sessions = this.getSessions();
    sessions.unshift(toSerializable({
      ...session,
      id: 'free_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    }));
    const capped = sessions.slice(0, MAX_SESSIONS);
    safeSetItem(SESSIONS_KEY, JSON.stringify(capped));
    this.updateStreak();
    return session;
  },

  deleteSession(sessionId: string) {
    const sessions = this.getSessions();
    safeSetItem(SESSIONS_KEY, JSON.stringify(sessions.filter(s => s.id !== sessionId)));
  },

  deleteLemonScore(sessionId: string) {
    const scores = this.getLemonScores();
    safeSetItem(LEMON_SCORES_KEY, JSON.stringify(scores.filter(s => s.id !== sessionId)));
  },

  deleteTopicScore(sessionId: string) {
    const scores = this.getTopicScores();
    safeSetItem(TOPIC_SCORES_KEY, JSON.stringify(scores.filter(s => s.id !== sessionId)));
  },

  getStreak() {
    try {
      const data = localStorage.getItem(STREAK_KEY);
      if (!data) return { current: 0, best: 0, lastDate: null as string | null };
      return JSON.parse(data);
    } catch {
      return { current: 0, best: 0, lastDate: null as string | null };
    }
  },

  updateStreak() {
    const streak = this.getStreak();
    const today = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

    if (streak.lastDate === today) return streak;
    if (streak.lastDate === yesterday) {
      streak.current += 1;
    } else {
      streak.current = 1;
    }
    streak.best = Math.max(streak.best, streak.current);
    streak.lastDate = today;
    safeSetItem(STREAK_KEY, JSON.stringify(streak));
    return streak;
  },

  getLemonScores(): SessionData[] {
    try {
      const data = localStorage.getItem(LEMON_SCORES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveLemonScore(score: SessionData) {
    const scores = this.getLemonScores();
    scores.unshift(toSerializable({
      ...score,
      id: 'lemon_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    }));
    const capped = scores.slice(0, MAX_LEMON_SCORES);
    safeSetItem(LEMON_SCORES_KEY, JSON.stringify(capped));
    this.updateStreak();
    return score;
  },

  getTopicScores(): SessionData[] {
    try {
      const data = localStorage.getItem(TOPIC_SCORES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTopicScore(score: SessionData) {
    const scores = this.getTopicScores();
    scores.unshift(toSerializable({
      ...score,
      id: 'topic_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    }));
    const capped = scores.slice(0, MAX_TOPIC_SCORES);
    safeSetItem(TOPIC_SCORES_KEY, JSON.stringify(capped));
    this.updateStreak();
    return score;
  },

  getStats() {
    const sessions = this.getSessions();
    const lemonScores = this.getLemonScores();
    const topicScores = this.getTopicScores();
    const streak = this.getStreak();
    const allSessions = [...sessions, ...lemonScores, ...topicScores];

    if (allSessions.length === 0) {
      return {
        totalSessions: 0,
        totalPracticeTime: 0,
        avgScore: 0,
        bestScore: 0,
        currentStreak: streak.current,
        bestStreak: streak.best,
      };
    }

    const totalPracticeTime = allSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgScore = Math.round(allSessions.reduce((sum, s) => sum + (s.flowScore || 0), 0) / allSessions.length);
    const bestScore = Math.max(...allSessions.map(s => s.flowScore || 0));

    return {
      totalSessions: allSessions.length,
      totalPracticeTime,
      avgScore,
      bestScore,
      currentStreak: streak.current,
      bestStreak: streak.best,
    };
  },

  calculateOverallFlowScore() {
    const sessions = this.getSessions();
    const lemonScores = this.getLemonScores();
    const topicScores = this.getTopicScores();
    const allScores = [
      ...sessions.map(s => s.flowScore || 0),
      ...lemonScores.map(s => s.flowScore || 0),
      ...topicScores.map(s => s.flowScore || 0),
    ];
    if (allScores.length === 0) return 0;
    const weightedSum = allScores.reduce((sum, score, index) => {
      const weight = Math.max(0.5, 1 - (index / allScores.length) * 0.5);
      return sum + (score * weight);
    }, 0);
    const totalWeight = allScores.reduce((sum, _, index) => {
      const weight = Math.max(0.5, 1 - (index / allScores.length) * 0.5);
      return sum + weight;
    }, 0);
    return Math.round(weightedSum / totalWeight);
  },

  resetStats() {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(LEMON_SCORES_KEY);
    localStorage.removeItem(TOPIC_SCORES_KEY);
    localStorage.removeItem(STREAK_KEY);
  },
};
