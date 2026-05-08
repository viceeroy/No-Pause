import { Readable } from 'stream';
import type { IncomingMessage } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateFlowScore, getScoreLabel } from '@/lib/core/scoring';
import {
  buildPracticeStats,
  buildRecentSessionSummaries,
  getPracticeStatsFromRpc,
  type SessionRecord,
} from '@/lib/core/queries';
import { buildSessionResult } from '@/features/practice/hooks/useScoring';
import {
  buildSessionInsertValues,
  calculateNextStreak,
  insertSession,
  updateStreak,
  type SupabaseLike,
} from '@/lib/core/session';
import {
  CHANGE_GROUP_TOPIC_ACTION_PREFIX,
  getGroupChallengeDeepLink,
  getGroupChallengeCreatorTelegramId,
  getGroupChallengeLeaderboardMessage,
  getGroupChallengeResultActions,
  getGroupChallengeStatus,
  getGroupShareResultMessage,
  GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX,
  getNoPauseGroupChallengeKeyboard,
  getSpeakingResultMessage,
  isGroupChallengeRecord,
  POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX,
  TRY_AGAIN_ACTION,
  TRY_GROUP_CHALLENGE_ACTION_PREFIX,
} from '@/lib/telegram/constants';

const originalEnv = { ...process.env };

type InsertCall = {
  table: string;
  values: unknown;
};

function createInsertSupabase(input: {
  id?: string;
  error?: unknown;
  legacyId?: string;
} = {}) {
  const inserts: InsertCall[] = [];
  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((values: unknown) => {
        inserts.push({ table, values });
        const isLegacyInsert = inserts.length > 1;
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => (
              !isLegacyInsert && input.error
                ? { data: null, error: input.error }
                : { data: { id: isLegacyInsert ? input.legacyId ?? 'legacy-session' : input.id ?? 'session-1' }, error: null }
            )),
          })),
        };
      }),
    })),
  };

  return { supabase: supabase as unknown as SupabaseLike, inserts };
}

function createStreakSupabase(existingStreak: {
  current_streak: number | null;
  longest_streak: number | null;
  last_session_date: string | null;
} | null) {
  const upserts: unknown[] = [];
  const supabase = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: existingStreak, error: null })),
        })),
      })),
      upsert: vi.fn(async (values: unknown) => {
        upserts.push({ table, values });
        return { data: null, error: null };
      }),
    })),
  };

  return { supabase: supabase as unknown as SupabaseLike, upserts };
}

function createResponseRecorder() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader: vi.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
    end: vi.fn((body?: string) => {
      res.body = body ?? '';
    }),
  };

  return res;
}

function createRequest(input: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}) {
  const body = input.body ? [Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body)] : [];
  const req = Readable.from(body) as unknown as IncomingMessage;
  req.method = input.method ?? 'POST';
  req.headers = input.headers ?? {};
  return req;
}

describe('speaking mode scoring architecture', () => {
  it.each([
    { hesitations: 0, speakingTimeSec: 60, totalSessionTimeSec: 60, expected: 100, isCompleted: true },
    { hesitations: 0, speakingTimeSec: 59, totalSessionTimeSec: 59, expected: 59, isCompleted: true },
    { hesitations: 0, speakingTimeSec: 150, totalSessionTimeSec: 150, expected: 230, isCompleted: true },
    { hesitations: 10, speakingTimeSec: 120, totalSessionTimeSec: 120, expected: 100, isCompleted: true },
    {
      hesitations: 20,
      speakingTimeSec: 1,
      totalSessionTimeSec: 60,
      expected: 0,
      isCompleted: false,
      note: 'Session was too short to score. Speak for at least 5 seconds.',
    },
    { hesitations: 0, speakingTimeSec: 300, totalSessionTimeSec: 300, expected: 500, isCompleted: true },
    {
      hesitations: 0,
      speakingTimeSec: 1,
      totalSessionTimeSec: 1,
      expected: 0,
      isCompleted: false,
      note: 'Session was too short to score. Speak for at least 5 seconds.',
    },
    { hesitations: 1, speakingTimeSec: 60, totalSessionTimeSec: 60, expected: 90, isCompleted: true },
    { hesitations: 3, speakingTimeSec: 60, totalSessionTimeSec: 60, expected: 70, isCompleted: true },
    { hesitations: 6, speakingTimeSec: 120, totalSessionTimeSec: 120, expected: 140, isCompleted: true },
    { hesitations: 0, speakingTimeSec: 31, totalSessionTimeSec: 60, expected: 31, isCompleted: true },
    { hesitations: 2, speakingTimeSec: 125, totalSessionTimeSec: 300, expected: 185, isCompleted: true },
  ])(
    'scores $expected for $hesitations hesitations over $speakingTimeSec/$totalSessionTimeSec seconds',
    ({ hesitations, speakingTimeSec, totalSessionTimeSec, expected, isCompleted, note }) => {
      expect(calculateFlowScore(hesitations, { speakingTimeSec, totalSessionTimeSec })).toEqual({
        score: expected,
        isCompleted,
        ...(note ? { note } : {}),
      });
    },
  );

  it('scores sessions under 60 seconds from speaking time', () => {
    expect(calculateFlowScore(0, { speakingTimeSec: 59, totalSessionTimeSec: 59 })).toEqual({
      score: 59,
      isCompleted: true,
    });
  });

  it('scores sessions under 50% speaking ratio from speaking time', () => {
    expect(calculateFlowScore(0, { speakingTimeSec: 29, totalSessionTimeSec: 60 })).toEqual({
      score: 29,
      isCompleted: true,
    });
  });

  it('does not return negative scores', () => {
    expect(calculateFlowScore(10, { speakingTimeSec: 5, totalSessionTimeSec: 60 })).toEqual({
      score: 0,
      isCompleted: true,
    });
  });

  it('passes analyzer speaking time and pause count into web session scoring', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10_000);

    const result = buildSessionResult({
      startTime: 4_000,
      results: {
        totalSpeakingTime: 6,
        totalSilenceTime: 0,
        hesitationSilenceTime: 0,
        hesitationCount: 0,
        fillerWordCount: 0,
        hesitationLog: [],
        longestFlowStreak: 0,
        frameCount: 1,
        noiseFloor: 0,
        totalTime: 6_000,
        avgVolume: 0.1,
        audioBlob: null,
        audioMimeType: 'audio/webm',
        transcript: 'hello world',
      },
    });

    expect(result.sessionResult).toMatchObject({
      totalSpeakingTime: 6,
      totalSessionTime: 6,
      hesitationCount: 0,
      flowScore: 6,
    });

    nowSpy.mockRestore();
  });

  it.each([
    { score: 300, label: 'Perfect Flow' },
    { score: 299, label: 'Great Flow' },
    { score: 200, label: 'Great Flow' },
    { score: 199, label: 'Good Flow' },
    { score: 100, label: 'Good Flow' },
    { score: 99, label: 'Getting There' },
    { score: 50, label: 'Getting There' },
    { score: 49, label: 'Needs Practice' },
  ])('labels score $score as $label', ({ score, label }) => {
    expect(getScoreLabel(score)).toBe(label);
  });
});

describe('stats architecture', () => {
  it('builds recent session stats from pause_count and source metadata', () => {
    const sessions: SessionRecord[] = [
      {
        id: 'telegram-session',
        created_at: '2026-05-02T01:00:00.000Z',
        mode: 'speaking',
        duration: 90,
        speaking_time: 80,
        pauses: 99,
        pause_count: 3,
        filler_count: 2,
        words: 20,
        flow_score: 120,
        completed: true,
        source: 'telegram',
        hesitation_log: null,
        transcript: null,
        analysis_feedback: null,
      },
    ];

    expect(buildPracticeStats(sessions, null).recentSessions[0]).toMatchObject({
      duration: 90,
      speakingTime: 80,
      hesitationCount: 3,
      flowScore: 120,
      source: 'telegram',
    });
  });
});

describe('result message formatting architecture', () => {
  it('truncates long Telegram transcripts below the safe message limit', () => {
    const message = getSpeakingResultMessage({
      analysis: {
        flowScore: 500,
        pauseCount: 0,
        hesitationCount: 0,
        speakingTimeSec: 300,
        totalSessionTimeSec: 300,
        isCompleted: true,
        pauseLog: [],
      },
      transcript: 'hello '.repeat(1000),
    });

    expect(message.length).toBeLessThanOrEqual(4000);
    expect(message).toContain('... (truncated)');
  });

  it('builds group challenge deep links and result actions', () => {
    const keyboard = getNoPauseGroupChallengeKeyboard('challenge-1').reply_markup.inline_keyboard;

    expect(getGroupChallengeDeepLink('challenge-1')).toBe('https://t.me/NoPauseAI_bot?start=group_challenge-1');
    expect(keyboard[0][0]).toMatchObject({
      text: '🎤 Speak',
      url: 'https://t.me/NoPauseAI_bot?start=group_challenge-1',
    });
    expect(keyboard[0][1]).toMatchObject({
      text: '🔄 Change Prompt',
      callback_data: `${CHANGE_GROUP_TOPIC_ACTION_PREFIX}challenge-1`,
    });
    expect(keyboard[1][0]).toMatchObject({
      text: '🏆 Leaderboard',
      callback_data: `${GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX}challenge-1`,
    });

    const resultActions = getGroupChallengeResultActions({
      sessionId: 'session-1',
      groupId: -100123,
      challengeId: 'challenge-1',
      attemptCount: 2,
    }).reply_markup.inline_keyboard;
    expect(resultActions[0][0]).toMatchObject({
      text: '📤 Send to Group',
      callback_data: `${POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX}challenge-1:session-1`,
    });
    expect(resultActions[1][0]).toMatchObject({
      text: '🔄 Try Again',
      callback_data: `${TRY_GROUP_CHALLENGE_ACTION_PREFIX}challenge-1`,
    });
    expect(resultActions[1][0].callback_data).not.toBe(TRY_AGAIN_ACTION);
    expect(resultActions.flat()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ text: '✅ Approve' })]),
    );
  });

  it('formats group challenge result messages with compact attempt details', () => {
    const analysis = {
      flowScore: 88,
      pauseCount: 2,
      hesitationCount: 1,
      speakingTimeSec: 50,
      totalSessionTimeSec: 60,
      isCompleted: true,
      pauseLog: [],
    };

    const result = getGroupShareResultMessage({
      firstName: 'Sam',
      username: 'speaker',
      topic: 'Talk about focus',
      attemptCount: 3,
      analysis,
    });
    expect(result).toContain('Group Challenge Result');
    expect(result).toContain('Speaker:</b> Sam (@speaker)');
    expect(result).toContain('Talk about focus');
    expect(result).toContain('Flow Score:</b> 88');
    expect(result).toContain('Attempt:</b> #3');
    expect(result).toContain('Speaking time:</b> 50s');
    expect(result).toContain('Pauses:</b> 2');
    expect(result).toContain('Fillers:</b> 1');
    expect(result).not.toContain('Transcript');
    expect(result).not.toContain('Session length');
    expect(result).not.toContain('Bonus');
  });

  it('formats live, empty, and expired group challenge leaderboards', () => {
    const live = getGroupChallengeLeaderboardMessage({
      topic: 'Speak about focus',
      expired: false,
      entries: [
        { rank: 1, username: '@sam', bestFlowScore: 120, attemptCount: 2 },
        { rank: 2, username: '@lee', bestFlowScore: 90, attemptCount: 1 },
        { rank: 4, username: '@mika', bestFlowScore: 70, attemptCount: 5 },
      ],
    });
    expect(live).toContain('🥇 <b>@sam</b>');
    expect(live).toContain('🥈 <b>@lee</b>');
    expect(live).toContain('#4 <b>@mika</b>');
    expect(live).toContain('120 Flow Score');
    expect(live).toContain('5 tries');

    const empty = getGroupChallengeLeaderboardMessage({
      topic: 'Speak about focus',
      expired: false,
      entries: [],
    });
    expect(empty).toContain('No scores yet');

    const expired = getGroupChallengeLeaderboardMessage({
      topic: 'Speak about focus',
      expired: true,
      entries: [{ rank: 1, username: '@sam', bestFlowScore: 120, attemptCount: 2 }],
    });
    expect(expired).toContain('Final board');
    expect(expired).toContain('expired');
  });

  it('stores the group challenge creator in the challenge status', () => {
    const status = getGroupChallengeStatus(123);

    expect(status).toBe('group_pending:123');
    expect(isGroupChallengeRecord({ status })).toBe(true);
    expect(isGroupChallengeRecord({ status: 'group_pending' })).toBe(true);
    expect(getGroupChallengeCreatorTelegramId({ status })).toBe(123);
    expect(getGroupChallengeCreatorTelegramId({ status: 'group_pending' })).toBeNull();
  });
});

describe('stats summary architecture', () => {
  it('keeps session source on recent summaries', () => {
    const summaries = buildRecentSessionSummaries([
      {
        id: 'session-1',
        created_at: '2026-05-02T00:00:00.000Z',
        mode: 'speaking',
        duration: 60,
        speaking_time: 55,
        pauses: 1,
        pause_count: 1,
        filler_count: null,
        words: 10,
        flow_score: 90,
        completed: true,
        hesitation_log: [],
        source: 'telegram',
      },
    ] as SessionRecord[]);

    expect(summaries[0].source).toBe('telegram');
    expect(summaries[0].speakingTime).toBe(55);
  });

  it('reads bounded practice stats from the Supabase RPC shape', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        scoredSessions: 2,
        totalPracticeTime: 120,
        avgFlowScore: 90,
        bestFlowScore: 100,
        monthlyStats: { totalSessions: 1, totalSpeakingTime: 55, avgFlowScore: 90 },
        lastSessionDate: '2026-05-02T00:00:00.000Z',
        currentStreak: 3,
        bestStreak: 5,
        modeBreakdown: [{ mode: 'speaking', totalSessions: 2, totalDuration: 120, avgFlowScore: 90 }],
        recentSessions: [{
          id: 'session-1',
          created_at: '2026-05-02T00:00:00.000Z',
          duration: 60,
          speakingTime: 55,
          hesitationCount: 1,
          flowScore: 90,
          mode: 'speaking',
          source: 'web',
        }],
      },
      error: null,
    }));

    await expect(getPracticeStatsFromRpc({ rpc }, 'user-1', 25)).resolves.toMatchObject({
      scoredSessions: 2,
      recentSessions: [{ id: 'session-1', hesitationCount: 1 }],
    });
    expect(rpc).toHaveBeenCalledWith('get_practice_stats', {
      p_user_id: 'user-1',
      p_recent_limit: 25,
    });
  });

  it('falls back when the practice stats RPC is unavailable', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'get_practice_stats was not found' },
    }));

    await expect(getPracticeStatsFromRpc({ rpc }, 'user-1', 25)).resolves.toBeNull();
  });
});

describe('session persistence architecture', () => {
  it('builds new session rows with speaking mode even when old free_speaking input is supplied', () => {
    const values = buildSessionInsertValues({
      userId: 'user-1',
      duration: 60,
      pauses: 2,
      speakingTime: 55,
      mode: 'free_speaking',
      flowScore: 90,
      completed: true,
    });

    expect(values.mode).toBe('speaking');
    expect(JSON.stringify(values)).not.toContain('free_speaking');
  });

  it('insertSession writes speaking mode to Supabase', async () => {
    const { supabase, inserts } = createInsertSupabase();

    await expect(insertSession(supabase, {
      userId: 'user-1',
      duration: 60,
      pauses: 0,
      mode: 'free_speaking',
    })).resolves.toBe('session-1');

    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toMatchObject({ mode: 'speaking', source: 'web' });
    expect(JSON.stringify(inserts[0].values)).not.toContain('free_speaking');
  });

  it('insertSession fallback still writes speaking mode for legacy schemas', async () => {
    const { supabase, inserts } = createInsertSupabase({
      error: { code: 'PGRST204', message: 'pause_count missing' },
      legacyId: 'legacy-id',
    });

    await expect(insertSession(supabase, {
      userId: 'user-1',
      duration: 60,
      pauses: 1,
      mode: 'free_speaking',
    })).resolves.toBe('legacy-id');

    expect(inserts).toHaveLength(2);
    expect(inserts[1].values).toMatchObject({ mode: 'speaking' });
    expect(JSON.stringify(inserts[1].values)).not.toContain('free_speaking');
  });

  it('calculateNextStreak increments from yesterday and preserves best streak', () => {
    expect(calculateNextStreak({
      userId: 'user-1',
      today: '2026-05-02',
      existingStreak: {
        current_streak: 3,
        longest_streak: 5,
        last_session_date: '2026-05-01',
      },
    })).toEqual({
      user_id: 'user-1',
      current_streak: 4,
      longest_streak: 5,
      last_session_date: '2026-05-02',
    });
  });

  it('updateStreak upserts the incremented streak values', async () => {
    const { supabase, upserts } = createStreakSupabase({
      current_streak: 3,
      longest_streak: 3,
      last_session_date: '2026-05-01',
    });

    await updateStreak(supabase, { userId: 'user-1', localDate: '2026-05-02' });

    expect(upserts).toEqual([{
      table: 'streaks',
      values: {
        user_id: 'user-1',
        current_streak: 4,
        longest_streak: 4,
        last_session_date: '2026-05-02',
      },
    }]);
  });
});

describe('module export architecture', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../src/services/deepgram.js');
    vi.doUnmock('@/services/deepgram');
    process.env = { ...originalEnv };
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.DEEPGRAM_API_KEY = 'deepgram-key';
  });

  it('router, voiceHandler, and challenges exports resolve with their server dependencies mocked', async () => {
    vi.doMock('@/services/aiFeedback', () => ({
      analyzePracticeSpeech: vi.fn(async () => 'Feedback'),
      generateAiFeedback: vi.fn(async () => 'Feedback'),
      generateFillerCount: vi.fn(async () => '{"hesitation_count":0}'),
      isUsableTranscript: vi.fn(() => true),
    }));
    vi.doMock('@/services/supabaseServer', () => ({
      supabaseServer: { from: vi.fn() },
    }));

    const [router, voiceHandler, challenges] = await Promise.all([
      import('@/lib/telegram/router'),
      import('@/lib/telegram/voiceHandler'),
      import('@/lib/telegram/challenges'),
    ]);

    expect(router.createTelegramBot).toEqual(expect.any(Function));
    expect(voiceHandler.handleVoiceMessage).toEqual(expect.any(Function));
    expect(voiceHandler.getSessionAnalysis).toEqual(expect.any(Function));
    expect(challenges.createChallengeId).toEqual(expect.any(Function));
    expect(challenges.isMissingChallengesTableError).toEqual(expect.any(Function));
  });

  it('audio pipeline modules export expected classes and functions', async () => {
    const [audioCapture, speechSession, transcription, micStateMachine] = await Promise.all([
      import('@/features/practice/lib/audioCapture'),
      import('@/features/practice/lib/speechSession'),
      import('@/features/practice/lib/transcription'),
      import('@/features/practice/lib/analyzer/micStateMachine'),
    ]);

    expect(audioCapture.AudioCapture).toEqual(expect.any(Function));
    expect(speechSession.SpeechSession).toEqual(expect.any(Function));
    expect(transcription.TranscriptionController).toEqual(expect.any(Function));
    expect(transcription.processTranscriptForFillerWords).toEqual(expect.any(Function));
    expect(micStateMachine.applyMicStateFrame).toEqual(expect.any(Function));
    expect(micStateMachine.finalizeMicState).toEqual(expect.any(Function));
  });
});

describe('Telegram group challenge retry architecture', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
  });

  function mockChallengeSupabase(input: {
    challenge: unknown;
    pendingChallenge?: unknown;
    submittedChallenge?: boolean;
  }) {
    const upserts: unknown[] = [];
    const inserts: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'challenges') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: input.challenge, error: null })),
            })),
          })),
        };
      }

      if (table === 'telegram_challenge_state') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: input.pendingChallenge ?? null, error: null })),
            })),
          })),
          upsert: vi.fn(async (values: unknown) => {
            upserts.push(values);
            return { error: null };
          }),
        };
      }

      if (table === 'telegram_challenge_attempts') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: input.submittedChallenge ? 1 : 0, error: null })),
            })),
          })),
          insert: vi.fn(async (values: unknown) => {
            inserts.push(values);
            return { error: null };
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    const mock = { supabaseServer: { from } };
    vi.doMock('@/services/supabaseServer', () => mock);
    vi.doMock('../../src/services/supabaseServer.js', () => mock);

    return { inserts, upserts, from };
  }

  it('resets pending state for the same group challenge when Try Again is clicked', async () => {
    const { upserts } = mockChallengeSupabase({
      challenge: {
        id: 'challenge-1',
        topic: 'Talk about focus',
        creator_telegram_id: -100123,
        creator_score: null,
        status: 'group_pending:123',
        created_at: new Date().toISOString(),
      },
    });
    const { retryGroupChallenge } = await import('@/lib/telegram/challenges');
    const ctx = {
      match: ['tg:challenge-1', 'challenge-1'],
      reply: vi.fn(),
      telegram: { sendMessage: vi.fn() },
    };

    await retryGroupChallenge(ctx as never, 123, '@speaker');

    expect(upserts[0]).toMatchObject({
      telegram_id: 123,
      challenge_id: 'challenge-1',
      challenge_type: 'group',
      group_id: -100123,
      participant_username: '@speaker',
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Send a new voice message'),
      { parse_mode: 'HTML' },
    );
    expect(ctx.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('does not reopen expired group challenges from Try Again', async () => {
    const { upserts } = mockChallengeSupabase({
      challenge: {
        id: 'challenge-1',
        topic: 'Talk about focus',
        creator_telegram_id: -100123,
        creator_score: null,
        status: 'group_pending:123',
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      },
    });
    const { retryGroupChallenge } = await import('@/lib/telegram/challenges');
    const ctx = {
      match: ['tg:challenge-1', 'challenge-1'],
      reply: vi.fn(),
      telegram: { sendMessage: vi.fn() },
    };

    await retryGroupChallenge(ctx as never, 123, '@speaker');

    expect(upserts).toEqual([]);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(
      -100123,
      expect.stringContaining('Challenge ended'),
      { parse_mode: 'HTML' },
    );
  });

  it('does not recreate pending state when a friend challenge is already accepted', async () => {
    const { upserts } = mockChallengeSupabase({
      challenge: {
        id: 'challenge-1',
        topic: 'Talk about focus',
        creator_telegram_id: 456,
        creator_score: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      pendingChallenge: {
        telegram_id: 123,
        challenge_id: 'challenge-1',
        challenge_type: 'friend',
        group_id: null,
        group_message_id: null,
        participant_username: null,
        creator_username: '456',
        created_at: null,
        updated_at: null,
      },
    });
    const { handleChallengeDeepLink } = await import('@/lib/telegram/challenges');
    const ctx = {
      reply: vi.fn(),
      telegram: { getChat: vi.fn() },
    };

    await handleChallengeDeepLink(ctx as never, 123, 'challenge-1');

    expect(upserts).toEqual([]);
    expect(ctx.telegram.getChat).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('already accepted this challenge'),
      { parse_mode: 'HTML' },
    );
  });

  it('does not recreate pending state when a friend challenge was already submitted', async () => {
    const { upserts } = mockChallengeSupabase({
      challenge: {
        id: 'challenge-1',
        topic: 'Talk about focus',
        creator_telegram_id: 456,
        creator_score: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      submittedChallenge: true,
    });
    const { handleChallengeDeepLink } = await import('@/lib/telegram/challenges');
    const ctx = {
      reply: vi.fn(),
      telegram: { getChat: vi.fn() },
    };

    await handleChallengeDeepLink(ctx as never, 123, 'challenge-1');

    expect(upserts).toEqual([]);
    expect(ctx.telegram.getChat).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('already accepted this challenge'),
      { parse_mode: 'HTML' },
    );
  });
});

describe('HTTP header ASCII normalization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.DEEPGRAM_API_KEY = 'deepgram-key';
  });

  it('api/transcription accepts an internally normalized token containing non-header characters', async () => {
    process.env.NOPAUSE_INTERNAL_API_TOKEN = 'internal-token✅';
    const { default: handler } = await import('../../api/transcription');
    const req = createRequest({
      headers: {
        'x-nopause-internal-token': 'internal-token',
      },
    });
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Expected multipart/form-data audio upload' });
  });

  it('api/transcription returns 429 when regular session transcription quota is exhausted', async () => {
    process.env.DEEPGRAM_API_KEY = 'deepgram-key';
    vi.doMock('../../src/services/supabaseServer.js', () => ({
      supabaseServer: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
        },
      },
    }));
    vi.doMock('../../src/services/apiQuota.js', () => ({
      DAILY_TRANSCRIPTION_LIMIT: 20,
      consumeApiQuota: vi.fn(async () => {
        throw { kind: 'transcription' };
      }),
      getQuotaExceededMessage: vi.fn(() => 'Daily transcription limit reached. Try again tomorrow.'),
      isApiQuotaExceededError: vi.fn((error) => (error as { kind?: string })?.kind === 'transcription'),
    }));
    vi.doMock('../../src/services/deepgram.js', () => ({
      transcribeAudioWithDeepgram: vi.fn(async () => {
        throw new Error('should not call provider');
      }),
    }));

    const { default: handler } = await import('../../api/transcription');
    const body = Buffer.from(
      '--x\r\nContent-Disposition: form-data; name="audio"; filename="a.webm"\r\nContent-Type: audio/webm\r\n\r\nabc\r\n--x--\r\n',
    );
    const req = createRequest({
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'multipart/form-data; boundary=x',
      },
      body,
    });
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body)).toEqual({ error: 'Daily transcription limit reached. Try again tomorrow.' });
  });

  it('api/transcription rejects oversized bodies while reading the request', async () => {
    process.env.DEEPGRAM_API_KEY = 'deepgram-key';
    vi.doMock('../../src/services/supabaseServer.js', () => ({
      supabaseServer: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
        },
      },
    }));
    vi.doMock('../../src/services/apiQuota.js', () => ({
      DAILY_TRANSCRIPTION_LIMIT: 20,
      consumeApiQuota: vi.fn(),
      getQuotaExceededMessage: vi.fn(),
      isApiQuotaExceededError: vi.fn(() => false),
    }));

    const { default: handler } = await import('../../api/transcription');
    const req = createRequest({
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'multipart/form-data; boundary=x',
      },
      body: Buffer.alloc((15 * 1024 * 1024) + 2049),
    });
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body)).toEqual({ error: 'Audio upload is too large' });
  });

  it('api/feedback returns 429 when regular session feedback quota is exhausted', async () => {
    process.env.GROQ_API_KEY = 'groq-key';
    vi.doMock('../../src/services/supabaseServer.js', () => ({
      supabaseServer: {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
        },
      },
    }));
    vi.doMock('../../src/services/apiQuota.js', () => ({
      DAILY_FEEDBACK_LIMIT: 20,
      consumeApiQuota: vi.fn(async () => {
        throw { kind: 'feedback' };
      }),
      getQuotaExceededMessage: vi.fn(() => 'Daily feedback limit reached. Try again tomorrow.'),
      isApiQuotaExceededError: vi.fn((error) => (error as { kind?: string })?.kind === 'feedback'),
    }));
    vi.doMock('../../src/services/aiFeedback.js', () => ({
      analyzePracticeSpeech: vi.fn(async () => 'should not call provider'),
    }));

    const { default: handler } = await import('../../api/feedback');
    const req = createRequest({
      headers: {
        authorization: 'Bearer access-token',
      },
      body: JSON.stringify({ transcript: 'hello world again' }),
    });
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body)).toEqual({ error: 'Daily feedback limit reached. Try again tomorrow.' });
  });

  it('api/telegram/webhook returns 401 when Telegram secret header is missing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-secret';
    const webhookCallback = vi.fn(async (_req, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    vi.doMock('../../src/lib/telegram/router.js', () => ({
      createTelegramBot: vi.fn(() => ({
        webhookCallback: vi.fn(() => webhookCallback),
      })),
    }));

    const { default: handler } = await import('../../api/telegram/webhook');
    const req = createRequest({});
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toBe('Unauthorized');
    expect(webhookCallback).not.toHaveBeenCalled();
  });

  it('api/telegram/webhook allows requests with the configured Telegram secret header', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-secret';
    const webhookCallback = vi.fn(async (_req, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    vi.doMock('../../src/lib/telegram/router.js', () => ({
      createTelegramBot: vi.fn(() => ({
        webhookCallback: vi.fn(() => webhookCallback),
      })),
    }));

    const { default: handler } = await import('../../api/telegram/webhook');
    const req = createRequest({
      headers: {
        'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET,
      },
    });
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('ok');
    expect(webhookCallback).toHaveBeenCalledTimes(1);
  });

  it('api/telegram/connect does not resend a welcome when the connection already exists for the user', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    vi.doMock('../../src/services/supabaseServer.js', () => ({
      supabaseServer: {
        auth: {
          getUser: vi.fn(async () => ({
            data: {
              user: {
                id: 'user-1',
                user_metadata: { first_name: 'Ada' },
              },
            },
            error: null,
          })),
        },
      },
    }));
    vi.doMock('../../src/lib/telegramAuth.js', () => ({
      upsertTelegramConnection: vi.fn(async () => ({ shouldSendWelcome: false })),
    }));

    const { default: handler } = await import('../../api/telegram/connect');
    const req = createRequest({
      headers: {
        authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        telegram_id: 123,
        user_id: 'user-1',
      }),
    });
    const res = createResponseRecorder();

    await handler(req, res as never);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, welcomeSent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('voiceHandler transcribes Telegram audio with Deepgram word timestamps', async () => {
    const order: string[] = [];
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    process.env.DEEPGRAM_API_KEY = 'deepgram-key';

    const generateAiFeedback = vi.fn(async () => 'Feedback');
    vi.doMock('@/services/aiFeedback', () => ({
      generateAiFeedback,
      isUsableTranscript: vi.fn((text: string) => text.trim().split(/\s+/).length >= 3),
    }));
    const deepgramMock = vi.fn(async () => {
      order.push('deepgram');
      return {
        transcript: 'hello world again',
        words: [
          { word: 'hello', start: 0, end: 1 },
          { word: 'um', start: 1.1, end: 1.2 },
          { word: 'world', start: 2, end: 3 },
          { word: 'again', start: 5, end: 6 },
        ],
        fillerCount: 1,
      };
    });
    vi.doMock('@/services/deepgram', () => ({
      transcribeAudioWithDeepgram: deepgramMock,
    }));
    vi.doMock('../../src/services/deepgram.js', () => ({
      transcribeAudioWithDeepgram: deepgramMock,
    }));
    vi.doMock('@/services/apiQuota', () => ({
      DAILY_FEEDBACK_LIMIT: 20,
      DAILY_TRANSCRIPTION_LIMIT: 20,
      consumeApiQuota: vi.fn(async (input: { kind: string }) => {
        order.push(`quota:${input.kind}`);
      }),
      getQuotaExceededMessage: vi.fn((kind: string) => `quota exceeded: ${kind}`),
      isApiQuotaExceededError: vi.fn(() => false),
    }));

    vi.doMock('@/lib/core/user', () => ({
      resolveTelegramUser: vi.fn(async () => 'user-1'),
    }));

    vi.doMock('@/lib/telegram/challenges', () => ({
      deletePendingChallenge: vi.fn(),
      getFriendChallenge: vi.fn(),
      getGroupChallengeAttemptCount: vi.fn(),
      getPendingChallenge: vi.fn(async () => null),
      isMissingChallengesTableError: vi.fn(() => false),
      recordFriendChallengeSubmission: vi.fn(),
      recordGroupChallengeAttempt: vi.fn(),
      updateFriendChallengeCreatorScore: vi.fn(),
      upsertPendingChallenge: vi.fn(),
    }));

    const insertedSessions: unknown[] = [];
    const upsertedStreaks: unknown[] = [];
    vi.doMock('@/services/supabaseServer', () => ({
      supabaseServer: {
        auth: {
          admin: {
            getUserById: vi.fn(async () => ({
              data: { user: { user_metadata: { difficulty: 'beginner' } } },
              error: null,
            })),
          },
        },
        from: vi.fn((table: string) => ({
          insert: vi.fn((values: unknown) => {
            order.push(`insert:${table}`);
            insertedSessions.push(values);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'telegram-session-1' }, error: null })),
              })),
            };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { current_streak: 0, longest_streak: 0, last_session_date: null },
                error: null,
              })),
            })),
          })),
          upsert: vi.fn(async (values: unknown) => {
            order.push(`upsert:${table}`);
            upsertedStreaks.push(values);
            return { data: null, error: null };
          }),
        })),
      },
    }));

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const urlString = String(url);
      if (urlString.includes('/getFile')) {
        order.push('telegram:getFile');
        return {
          ok: true,
          json: async () => ({ ok: true, result: { file_path: 'voice/file.ogg' } }),
        } as Response;
      }
      if (urlString.includes('/file/bot')) {
        order.push('telegram:download');
        return {
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${urlString} ${String(init?.method ?? 'GET')}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { handleVoiceMessage } = await import('@/lib/telegram/voiceHandler');
    const replies: Array<[string, unknown?]> = [];
    const ctx = {
      from: { id: 123, username: 'speaker' },
      chat: { type: 'private' },
      message: { voice: { file_id: 'file-1', duration: 90 } },
      reply: vi.fn(async (message: string, options?: unknown) => {
        replies.push([message, options]);
      }),
    };

    await handleVoiceMessage(ctx as never, 123);

    expect(order).toEqual([
      'telegram:getFile',
      'telegram:download',
      'quota:transcription',
      'deepgram',
      'insert:sessions',
      'upsert:streaks',
    ]);
    expect(insertedSessions[0]).toMatchObject({
      mode: 'speaking',
      source: 'telegram',
      transcript: 'hello world again',
      filler_count: 1,
    });
    expect(replies.some(([message]) => message.includes('Speaking Result') && message.includes('Fillers'))).toBe(true);
    expect(replies.some(([message]) => message.includes('AI Feedback'))).toBe(false);
    expect(generateAiFeedback).not.toHaveBeenCalled();
    expect(upsertedStreaks).toHaveLength(1);
  });

  it('voiceHandler automatically records group challenge attempts when scoring finishes', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    process.env.DEEPGRAM_API_KEY = 'deepgram-key';

    vi.doMock('@/services/aiFeedback', () => ({
      generateAiFeedback: vi.fn(async () => 'Feedback'),
      isUsableTranscript: vi.fn((text: string) => text.trim().split(/\s+/).length >= 3),
    }));
    const deepgramMock = vi.fn(async () => ({
      transcript: 'hello group challenge',
      words: [
        { word: 'hello', start: 0, end: 1 },
        { word: 'group', start: 1.2, end: 2 },
        { word: 'challenge', start: 2.2, end: 3 },
      ],
      fillerCount: 0,
    }));
    vi.doMock('@/services/deepgram', () => ({
      transcribeAudioWithDeepgram: deepgramMock,
    }));
    vi.doMock('../../src/services/deepgram.js', () => ({
      transcribeAudioWithDeepgram: deepgramMock,
    }));
    vi.doMock('@/services/apiQuota', () => ({
      DAILY_FEEDBACK_LIMIT: 20,
      DAILY_TRANSCRIPTION_LIMIT: 20,
      consumeApiQuota: vi.fn(),
      getQuotaExceededMessage: vi.fn((kind: string) => `quota exceeded: ${kind}`),
      isApiQuotaExceededError: vi.fn(() => false),
    }));
    vi.doMock('@/lib/core/user', () => ({
      resolveTelegramUser: vi.fn(async () => 'user-1'),
    }));

    const recordGroupChallengeAttempt = vi.fn(async () => 2);
    const deletePendingChallenge = vi.fn();
    vi.doMock('@/lib/telegram/challenges', () => ({
      deletePendingChallenge,
      getFriendChallenge: vi.fn(async () => ({
        id: 'challenge-1',
        topic: 'Talk about focus',
        creator_telegram_id: -100123,
        creator_score: null,
        status: 'group_pending:123',
        created_at: new Date().toISOString(),
      })),
      getGroupChallengeAttemptCount: vi.fn(),
      getPendingChallenge: vi.fn(async () => ({
        telegram_id: 123,
        challenge_id: 'challenge-1',
        challenge_type: 'group',
        group_id: -100123,
        group_message_id: null,
        participant_username: '@speaker',
        creator_username: null,
        created_at: null,
        updated_at: null,
      })),
      isMissingChallengesTableError: vi.fn(() => false),
      recordFriendChallengeSubmission: vi.fn(),
      recordGroupChallengeAttempt,
      updateFriendChallengeCreatorScore: vi.fn(),
      upsertPendingChallenge: vi.fn(),
    }));

    vi.doMock('@/services/supabaseServer', () => ({
      supabaseServer: {
        auth: {
          admin: {
            getUserById: vi.fn(async () => ({
              data: { user: { user_metadata: { difficulty: 'beginner' } } },
              error: null,
            })),
          },
        },
        from: vi.fn((table: string) => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: 'telegram-session-1' }, error: null })),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { current_streak: 0, longest_streak: 0, last_session_date: null },
                error: null,
              })),
            })),
          })),
          upsert: vi.fn(async () => ({ data: null, error: null })),
        })),
      },
    }));

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const urlString = String(url);
      if (urlString.includes('/getFile')) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { file_path: 'voice/file.ogg' } }),
        } as Response;
      }
      if (urlString.includes('/file/bot')) {
        return {
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${urlString}`);
    }));

    const { handleVoiceMessage } = await import('@/lib/telegram/voiceHandler');
    const replies: Array<[string, { reply_markup?: { inline_keyboard?: Array<Array<{ text: string }>> } }?]> = [];
    const ctx = {
      from: { id: 123, username: 'speaker' },
      chat: { type: 'private' },
      message: { voice: { file_id: 'file-1', duration: 90 } },
      reply: vi.fn(async (message: string, options?: { reply_markup?: { inline_keyboard?: Array<Array<{ text: string }>> } }) => {
        replies.push([message, options]);
      }),
    };

    await handleVoiceMessage(ctx as never, 123);

    expect(recordGroupChallengeAttempt).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      telegramId: 123,
      sessionId: 'telegram-session-1',
    });
    expect(deletePendingChallenge).toHaveBeenCalledWith(123);
    const resultReply = replies.find(([message]) => message.includes('Group Challenge Result'));
    expect(resultReply?.[0]).toContain('Attempt:</b> #2');
    expect(resultReply?.[1]?.reply_markup?.inline_keyboard?.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '📤 Send to Group' }),
        expect.objectContaining({ text: '🔄 Try Again' }),
      ]),
    );
    expect(resultReply?.[1]?.reply_markup?.inline_keyboard?.flat()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ text: '✅ Approve' })]),
    );
  });

  it('voiceHandler rejects voice notes over 300 seconds before analysis work starts', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

    vi.doMock('@/services/aiFeedback', () => ({
      generateAiFeedback: vi.fn(async () => 'Feedback'),
      generateFillerCount: vi.fn(async () => '{"hesitation_count":0}'),
      isUsableTranscript: vi.fn(() => true),
    }));

    vi.doMock('@/lib/core/user', () => ({
      resolveTelegramUser: vi.fn(async () => 'user-1'),
    }));

    vi.doMock('@/lib/telegram/challenges', () => ({
      deletePendingChallenge: vi.fn(),
      getFriendChallenge: vi.fn(),
      getGroupChallengeAttemptCount: vi.fn(),
      getPendingChallenge: vi.fn(),
      isMissingChallengesTableError: vi.fn(() => false),
      recordFriendChallengeSubmission: vi.fn(),
      recordGroupChallengeAttempt: vi.fn(),
      updateFriendChallengeCreatorScore: vi.fn(),
      upsertPendingChallenge: vi.fn(),
    }));

    const fromMock = vi.fn();
    vi.doMock('@/services/supabaseServer', () => ({
      supabaseServer: {
        from: fromMock,
      },
    }));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { handleVoiceMessage } = await import('@/lib/telegram/voiceHandler');
    const replies: Array<[string, unknown?]> = [];
    const ctx = {
      from: { id: 123, username: 'speaker' },
      chat: { type: 'private' },
      message: { voice: { file_id: 'file-1', duration: 301 } },
      reply: vi.fn(async (message: string, options?: unknown) => {
        replies.push([message, options]);
      }),
    };

    await handleVoiceMessage(ctx as never, 123);

    expect(replies).toEqual([
      ['🎤 The maximum voice note length is 5 minutes. Please send a shorter voice note.', undefined],
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
