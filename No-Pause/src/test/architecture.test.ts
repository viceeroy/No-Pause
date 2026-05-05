import { Readable } from 'stream';
import type { IncomingMessage } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateFlowScore, getScoreLabel } from '@/lib/core/scoring';
import { buildPracticeStats, buildRecentSessionSummaries, type SessionRecord } from '@/lib/core/queries';
import { buildSessionResult } from '@/features/practice/hooks/useScoring';
import {
  buildSessionInsertValues,
  calculateNextStreak,
  insertSession,
  updateStreak,
  type SupabaseLike,
} from '@/lib/core/session';
import { getSpeakingResultMessage } from '@/lib/telegram/constants';

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

  it('api/telegram/connect does not send a welcome when the connection already exists for the user', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    const fetchMock = vi.fn();
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

    vi.doMock('@/services/aiFeedback', () => ({
      generateAiFeedback: vi.fn(async () => 'Feedback'),
      isUsableTranscript: vi.fn((text: string) => text.trim().split(/\s+/).length >= 3),
    }));

    vi.doMock('@/lib/core/user', () => ({
      resolveTelegramUser: vi.fn(async () => 'user-1'),
    }));

    vi.doMock('@/lib/telegram/challenges', () => ({
      deletePendingChallenge: vi.fn(),
      getFriendChallenge: vi.fn(),
      getPendingChallenge: vi.fn(async () => null),
      isMissingChallengesTableError: vi.fn(() => false),
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

      order.push('deepgram');
      expect(urlString).toContain('https://api.deepgram.com/v1/listen');
      expect(urlString).toContain('model=nova-3');
      expect(urlString).toContain('smart_format=true');
      expect(urlString).toContain('punctuate=true');
      expect(urlString).toContain('words=true');
      expect(urlString).toContain('filler_words=true');
      expect(init?.headers).toMatchObject({
        Authorization: 'Token deepgram-key',
        'Content-Type': 'audio/ogg',
      });
      return {
        ok: true,
        json: async () => ({
          results: {
            channels: [{
              alternatives: [{
                transcript: 'hello world again',
                words: [
                  { word: 'hello', start: 0, end: 1 },
                  { word: 'um', start: 1.1, end: 1.2, type: 'filler' },
                  { word: 'world', start: 2, end: 3 },
                  { word: 'again', start: 5, end: 6 },
                ],
              }],
            }],
          },
        }),
      } as Response;
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
    expect(upsertedStreaks).toHaveLength(1);
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
      getPendingChallenge: vi.fn(),
      isMissingChallengesTableError: vi.fn(() => false),
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
