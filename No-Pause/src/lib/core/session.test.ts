import { describe, expect, it } from 'vitest';
import {
  formatLocalDate,
  addDaysToDateString,
  calculateNextStreak,
  buildSessionInsertValues,
  buildLegacySessionInsertValues,
  isMissingSessionAnalysisColumnError,
} from './session';

describe('formatLocalDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatLocalDate(new Date(2026, 4, 21))).toBe('2026-05-21');
  });

  it('zero-pads single-digit month and day', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDaysToDateString', () => {
  it('adds one day', () => {
    expect(addDaysToDateString('2026-05-21', 1)).toBe('2026-05-22');
  });

  it('subtracts one day', () => {
    expect(addDaysToDateString('2026-05-01', -1)).toBe('2026-04-30');
  });

  it('crosses month boundary forward', () => {
    expect(addDaysToDateString('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses year boundary backward', () => {
    expect(addDaysToDateString('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('calculateNextStreak', () => {
  it('starts a new streak when no existing streak', () => {
    const result = calculateNextStreak({
      userId: 'u1',
      today: '2026-05-21',
      existingStreak: null,
    });
    expect(result).toEqual({
      user_id: 'u1',
      current_streak: 1,
      longest_streak: 1,
      last_session_date: '2026-05-21',
    });
  });

  it('returns null when already practiced today', () => {
    const result = calculateNextStreak({
      userId: 'u1',
      today: '2026-05-21',
      existingStreak: {
        current_streak: 3,
        longest_streak: 5,
        last_session_date: '2026-05-21',
      },
    });
    expect(result).toBeNull();
  });

  it('increments streak when last session was yesterday', () => {
    const result = calculateNextStreak({
      userId: 'u1',
      today: '2026-05-21',
      existingStreak: {
        current_streak: 3,
        longest_streak: 5,
        last_session_date: '2026-05-20',
      },
    });
    expect(result).toEqual({
      user_id: 'u1',
      current_streak: 4,
      longest_streak: 5,
      last_session_date: '2026-05-21',
    });
  });

  it('resets streak when gap is more than one day', () => {
    const result = calculateNextStreak({
      userId: 'u1',
      today: '2026-05-21',
      existingStreak: {
        current_streak: 10,
        longest_streak: 10,
        last_session_date: '2026-05-19',
      },
    });
    expect(result).toEqual({
      user_id: 'u1',
      current_streak: 1,
      longest_streak: 10,
      last_session_date: '2026-05-21',
    });
  });

  it('updates longest streak when current exceeds it', () => {
    const result = calculateNextStreak({
      userId: 'u1',
      today: '2026-05-21',
      existingStreak: {
        current_streak: 5,
        longest_streak: 5,
        last_session_date: '2026-05-20',
      },
    });
    expect(result!.current_streak).toBe(6);
    expect(result!.longest_streak).toBe(6);
  });

  it('handles null fields in existing streak', () => {
    const result = calculateNextStreak({
      userId: 'u1',
      today: '2026-05-21',
      existingStreak: {
        current_streak: null,
        longest_streak: null,
        last_session_date: null,
      },
    });
    expect(result).toEqual({
      user_id: 'u1',
      current_streak: 1,
      longest_streak: 1,
      last_session_date: '2026-05-21',
    });
  });
});

describe('buildSessionInsertValues', () => {
  const minimal = {
    userId: 'u1',
    duration: 60,
    pauses: 3,
  };

  it('sets defaults for optional fields', () => {
    const values = buildSessionInsertValues(minimal);
    expect(values.user_id).toBe('u1');
    expect(values.duration).toBe(60);
    expect(values.pauses).toBe(3);
    expect(values.pause_count).toBe(3);
    expect(values.mode).toBe('speaking');
    expect(values.completed).toBe(false);
    expect(values.source).toBe('web');
    expect(values.scoring_version).toBe('1.0');
    expect(values.transcript).toBeNull();
  });

  it('uses explicit pauseCount when provided', () => {
    const values = buildSessionInsertValues({ ...minimal, pauseCount: 7 });
    expect(values.pause_count).toBe(7);
  });

  it('passes through all optional fields', () => {
    const values = buildSessionInsertValues({
      ...minimal,
      speakingTime: 55,
      flowScore: 85,
      words: 120,
      completed: true,
      transcript: 'hello world',
      source: 'telegram',
      telegramChatId: 12345,
      telegramMessageId: 678,
    });
    expect(values.speaking_time).toBe(55);
    expect(values.flow_score).toBe(85);
    expect(values.words).toBe(120);
    expect(values.completed).toBe(true);
    expect(values.transcript).toBe('hello world');
    expect(values.source).toBe('telegram');
    expect(values.telegram_chat_id).toBe(12345);
    expect(values.telegram_message_id).toBe(678);
  });
});

describe('buildLegacySessionInsertValues', () => {
  it('omits new columns that may not exist in legacy schema', () => {
    const values = buildLegacySessionInsertValues({
      userId: 'u1',
      duration: 60,
      pauses: 3,
      pauseCount: 5,
      telegramChatId: 123,
      telegramMessageId: 456,
    });
    expect(values).not.toHaveProperty('pause_count');
    expect(values).not.toHaveProperty('hesitations_per_minute');
    expect(values).not.toHaveProperty('telegram_chat_id');
    expect(values).not.toHaveProperty('telegram_message_id');
    expect(values.pauses).toBe(3);
  });
});

describe('isMissingSessionAnalysisColumnError', () => {
  it('detects PGRST204 code', () => {
    expect(isMissingSessionAnalysisColumnError({ code: 'PGRST204' })).toBe(true);
  });

  it('detects 42703 code', () => {
    expect(isMissingSessionAnalysisColumnError({ code: '42703' })).toBe(true);
  });

  it('detects column name in message', () => {
    expect(isMissingSessionAnalysisColumnError({ message: 'column pause_count does not exist' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isMissingSessionAnalysisColumnError({ code: '23505' })).toBe(false);
    expect(isMissingSessionAnalysisColumnError(null)).toBe(false);
    expect(isMissingSessionAnalysisColumnError(undefined)).toBe(false);
  });
});
