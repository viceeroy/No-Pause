import { normalizeMode } from "./modes.js";
import { isMissingSessionAnalysisColumnError } from "./session.js";

export type SessionRecord = {
  id: string;
  created_at: string;
  mode: string;
  duration: number;
  speaking_time: number | null;
  pauses: number | null;
  pause_count?: number | null;
  words: number | null;
  flow_score: number | null;
  completed: boolean | null;
  hesitation_log: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
  transcript?: string | null;
  analysis_feedback?: string | null;
  source?: "web" | "telegram" | string | null;
};

export type StreakRecord = {
  current_streak: number | null;
  longest_streak: number | null;
  last_session_date?: string | null;
};

export type PracticeStats = {
  scoredSessions: number;
  totalSessions: number;
  totalPracticeTime: number;
  avgFlowScore: number;
  bestFlowScore: number;
  lastSessionDate: string | null;
  currentStreak: number;
  bestStreak: number;
  modeBreakdown: Array<{
    mode: string;
    totalSessions: number;
    totalDuration: number;
    avgFlowScore: number | null;
  }>;
  recentSessions: Array<{
    id: string;
    created_at: string;
    duration: number;
    speakingTime: number;
    totalSilenceTime: number;
    hesitationCount: number;
    flowScore: number | null;
    mode: string;
    source: string | null;
    isAllTimeBest?: boolean;
  }>;
};

export type ModeBreakdown = PracticeStats["modeBreakdown"][number];
export type RecentSessionSummary = PracticeStats["recentSessions"][number];

export type StatsSummary = {
  bestFlowScore: number;
  avgFlowScore: number;
  sessionCount: number;
  totalPracticeTime: number;
  hasScoredSession: boolean;
};

export type WeeklyStatsComparison = {
  currentWeek: StatsSummary;
  lastWeek: StatsSummary;
};

export type WeeklyActivityDay = {
  label: "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";
  dateKey: string;
  completed: boolean;
  bestScore: number | null;
};

type SupabaseRpcLike = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

type SupabaseQueryLike = {
  from(table: string): {
    select(columns: string, options?: { count?: "exact"; head?: boolean }): unknown;
  };
};

type ChallengeAttemptSummary = {
  challenge_id: string | null;
  telegram_id: number | string | null;
  session_id: string | null;
};

type ChallengeScoreSummary = {
  id: string;
  flow_score: number | null;
};

type ChallengeSummary = {
  id: string;
  status: string;
};

type QueryBuilderLike<T> = PromiseLike<{ data: T[] | null; error: unknown }> & {
  eq(column: string, value: unknown): QueryBuilderLike<T>;
  in(column: string, values: unknown[]): QueryBuilderLike<T>;
};

const SESSION_COLUMNS =
  "id, created_at, mode, duration, speaking_time, pauses, pause_count, words, flow_score, completed, hesitation_log, transcript, analysis_feedback, source";
const LEGACY_SESSION_COLUMNS =
  "id, created_at, mode, duration, speaking_time, pauses, words, flow_score, completed, hesitation_log, transcript, analysis_feedback, source";

async function getServerSupabase() {
  const { supabaseServer } = await import("../../services/supabaseServer.js");
  return supabaseServer;
}

export async function getTelegramSessions(userId: string): Promise<SessionRecord[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingSessionAnalysisColumnError(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("sessions")
        .select(LEGACY_SESSION_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (legacyError) {
        throw legacyError;
      }

      return (legacyData ?? []) as SessionRecord[];
    }

    throw error;
  }

  return (data ?? []) as SessionRecord[];
}

function isMissingPracticeStatsRpcError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return (
    maybeError?.code === "PGRST202" ||
    maybeError?.code === "42883" ||
    maybeError?.message?.includes("get_practice_stats") === true
  );
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toInteger(value: unknown, fallback = 0): number {
  return Math.round(toNumber(value, fallback));
}

function parseModeBreakdown(value: unknown): PracticeStats["modeBreakdown"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = toRecord(item);
    if (!record) return [];
    const avgFlowScore = record.avgFlowScore;
    return [{
      mode: String(record.mode ?? "speaking"),
      totalSessions: toInteger(record.totalSessions),
      totalDuration: toInteger(record.totalDuration),
      avgFlowScore: avgFlowScore === null || avgFlowScore === undefined ? null : toInteger(avgFlowScore),
    }];
  });
}

function getParsedTotalSessions(record: Record<string, unknown>, modeBreakdown: PracticeStats["modeBreakdown"]): number {
  if (record.totalSessions !== null && record.totalSessions !== undefined) {
    return toInteger(record.totalSessions);
  }

  const modeSessionCount = modeBreakdown.reduce((sum, item) => sum + item.totalSessions, 0);
  return modeSessionCount || toInteger(record.scoredSessions);
}

function parseRecentSessions(value: unknown): PracticeStats["recentSessions"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = toRecord(item);
    if (!record) return [];
    const flowScore = record.flowScore;
    return [{
      id: String(record.id ?? ""),
      created_at: String(record.created_at ?? ""),
      duration: toInteger(record.duration),
      speakingTime: toInteger(record.speakingTime),
      totalSilenceTime: toInteger(record.totalSilenceTime),
      hesitationCount: toInteger(record.hesitationCount),
      flowScore: flowScore === null || flowScore === undefined ? null : toInteger(flowScore),
      mode: String(record.mode ?? "speaking"),
      source: record.source === null || record.source === undefined ? null : String(record.source),
      isAllTimeBest: record.isAllTimeBest === true,
    }];
  });
}

export function parsePracticeStats(value: unknown): PracticeStats | null {
  const record = toRecord(value);
  if (!record) return null;
  const modeBreakdown = parseModeBreakdown(record.modeBreakdown);
  return {
    scoredSessions: toInteger(record.scoredSessions),
    totalSessions: getParsedTotalSessions(record, modeBreakdown),
    totalPracticeTime: toInteger(record.totalPracticeTime),
    avgFlowScore: toInteger(record.avgFlowScore),
    bestFlowScore: toInteger(record.bestFlowScore),
    lastSessionDate: record.lastSessionDate === null || record.lastSessionDate === undefined
      ? null
      : String(record.lastSessionDate),
    currentStreak: toInteger(record.currentStreak),
    bestStreak: toInteger(record.bestStreak),
    modeBreakdown,
    recentSessions: parseRecentSessions(record.recentSessions),
  };
}

export async function getPracticeStatsFromRpc(
  supabase: SupabaseRpcLike,
  userId: string,
  limit = 15,
): Promise<PracticeStats | null> {
  const { data, error } = await supabase.rpc("get_practice_stats", {
    p_user_id: userId,
    p_recent_limit: limit,
  });

  if (error) {
    if (isMissingPracticeStatsRpcError(error)) {
      return null;
    }
    throw error;
  }

  return parsePracticeStats(data);
}

export async function getTelegramPracticeStats(userId: string, limit = 15): Promise<PracticeStats> {
  const supabase = await getServerSupabase();
  const stats = await getPracticeStatsFromRpc(supabase as unknown as SupabaseRpcLike, userId, limit);
  if (stats) {
    return stats;
  }

  const [streak, sessionSets] = await Promise.all([
    getStreak(userId),
    getTelegramSessions(userId),
  ]);
  return buildPracticeStats(sessionSets, streak);
}

export async function getTelegramChallengeCounts(
  telegramId: number,
  supabaseClient?: SupabaseQueryLike,
): Promise<{ friendChallenges: number; groupChallenges: number }> {
  try {
    const supabase = supabaseClient ?? await getServerSupabase();

    const { data, error } = await (supabase
      .from("telegram_challenge_attempts")
      .select("challenge_id, challenges(status)") as QueryBuilderLike<Array<{ challenge_id: string | null; challenges: { status: string } | null }>[number]>)
      .eq("telegram_id", telegramId);

    if (error) {
      console.error("Telegram challenge counts query failed", error);
      return { friendChallenges: 0, groupChallenges: 0 };
    }

    let friendChallenges = 0;
    let groupChallenges = 0;

    for (const attempt of data ?? []) {
      const challenges = (attempt as Record<string, unknown>).challenges as { status: string } | null;
      if (challenges === null || challenges === undefined) {
        console.warn("[NoPause] getTelegramChallengeCounts: challenges FK null for attempt", (attempt as Record<string, unknown>).challenge_id);
        continue;
      }
      if (challenges.status?.startsWith("group_pending")) {
        groupChallenges++;
      } else {
        friendChallenges++;
      }
    }

    return { friendChallenges, groupChallenges };
  } catch (error) {
    console.error("Telegram challenge counts failed", error);
    return { friendChallenges: 0, groupChallenges: 0 };
  }
}

export async function getTelegramChallengeWins(
  telegramId: number,
  supabaseClient?: SupabaseQueryLike,
): Promise<{ friendWins: number; groupWins: number }> {
  try {
    const supabase = supabaseClient ?? await getServerSupabase();

    const { data: userAttemptsData, error: userAttemptsError } = await (supabase
      .from("telegram_challenge_attempts")
      .select("challenge_id, telegram_id, session_id") as QueryBuilderLike<ChallengeAttemptSummary>)
      .eq("telegram_id", telegramId);

    if (userAttemptsError) {
      console.error("Telegram challenge wins user attempts query failed", userAttemptsError);
      return { friendWins: 0, groupWins: 0 };
    }

    const challengeIds = Array.from(new Set(
      (userAttemptsData ?? [])
        .map((attempt) => attempt.challenge_id)
        .filter((challengeId): challengeId is string => Boolean(challengeId)),
    ));
    if (challengeIds.length === 0) return { friendWins: 0, groupWins: 0 };

    const [attemptsResult, challengesResult] = await Promise.all([
      (supabase
        .from("telegram_challenge_attempts")
        .select("challenge_id, telegram_id, session_id") as QueryBuilderLike<ChallengeAttemptSummary>)
        .in("challenge_id", challengeIds),
      (supabase
        .from("challenges")
        .select("id, status") as QueryBuilderLike<ChallengeSummary>)
        .in("id", challengeIds),
    ]);

    if (attemptsResult.error) {
      console.error("Telegram challenge wins attempts query failed", attemptsResult.error);
      return { friendWins: 0, groupWins: 0 };
    }
    if (challengesResult.error) {
      console.error("Telegram challenge wins challenges query failed", challengesResult.error);
      return { friendWins: 0, groupWins: 0 };
    }

    const attempts = attemptsResult.data ?? [];
    const challengeStatusById = new Map(
      (challengesResult.data ?? []).map((c) => [c.id, c.status]),
    );

    const sessionIds = Array.from(new Set(
      attempts
        .map((attempt) => attempt.session_id)
        .filter((sessionId): sessionId is string => Boolean(sessionId)),
    ));
    if (sessionIds.length === 0) return { friendWins: 0, groupWins: 0 };

    const { data: sessionsData, error: sessionsError } = await (supabase
      .from("sessions")
      .select("id, flow_score") as QueryBuilderLike<ChallengeScoreSummary>)
      .in("id", sessionIds);

    if (sessionsError) {
      console.error("Telegram challenge wins sessions query failed", sessionsError);
      return { friendWins: 0, groupWins: 0 };
    }

    const scoreBySessionId = new Map(
      (sessionsData ?? []).flatMap((session) => {
        const score = Number(session.flow_score);
        return Number.isFinite(score) ? [[session.id, score] as const] : [];
      }),
    );
    const scoresByChallenge = new Map<string, Array<{ telegramId: number; score: number }>>();

    attempts.forEach((attempt) => {
      if (!attempt.challenge_id || !attempt.session_id) return;
      const score = scoreBySessionId.get(attempt.session_id);
      if (score === undefined) return;
      const challengeScores = scoresByChallenge.get(attempt.challenge_id) ?? [];
      challengeScores.push({ telegramId: Number(attempt.telegram_id), score });
      scoresByChallenge.set(attempt.challenge_id, challengeScores);
    });

    let friendWins = 0;
    let groupWins = 0;

    for (const [challengeId, scores] of scoresByChallenge.entries()) {
      const bestScore = Math.max(...scores.map((entry) => entry.score));
      const userBestScore = Math.max(
        ...scores
          .filter((entry) => entry.telegramId === telegramId)
          .map((entry) => entry.score),
      );
      if (Number.isFinite(userBestScore) && userBestScore === bestScore) {
        const status = challengeStatusById.get(challengeId);
        if (status?.startsWith("group_pending")) {
          groupWins++;
        } else {
          friendWins++;
        }
      }
    }

    return { friendWins, groupWins };
  } catch (error) {
    console.error("Telegram challenge wins failed", error);
    return { friendWins: 0, groupWins: 0 };
  }
}

export async function getTelegramWeeklyStatsComparison(userId: string): Promise<WeeklyStatsComparison> {
  return buildWeeklyStatsComparison(await getTelegramSessions(userId));
}

export async function getStreak(userId: string): Promise<StreakRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, last_session_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as StreakRecord | null;
}

export function isScoredSession(session: SessionRecord): boolean {
  return session.flow_score !== null && session.flow_score !== undefined;
}

export function getSessionDuration(session: SessionRecord): number {
  return Number(session.duration || 0);
}

export function getSessionSpeakingTime(session: SessionRecord): number {
  return Number(session.speaking_time ?? session.duration ?? 0);
}

export function getSessionSilenceTime(session: SessionRecord): number {
  const duration = Number(session.duration ?? 0);
  const speaking = Number(session.speaking_time ?? session.duration ?? 0);
  return Math.max(0, duration - speaking);
}

export function getSessionHesitationCount(session: SessionRecord): number {
  return Number(session.pause_count ?? session.pauses ?? 0);
}

export function getSessionFlowScore(session: SessionRecord): number | null {
  return isScoredSession(session) ? Number(session.flow_score) : null;
}

export function getNormalizedSessionMode(session: SessionRecord): string {
  return normalizeMode((session.mode || "speaking").toLowerCase());
}

export function groupSessionsByMode(sessions: SessionRecord[]): Record<string, SessionRecord[]> {
  return sessions.reduce<Record<string, SessionRecord[]>>((acc, session) => {
    const mode = getNormalizedSessionMode(session);
    acc[mode] = acc[mode] ? [...acc[mode], session] : [session];
    return acc;
  }, {});
}

export function calculateWeightedAverageFlowScore(sessions: SessionRecord[]): number {
  const scored = sessions.filter(isScoredSession);
  const totalScoreWeight = scored.reduce((sum, session) => sum + getSessionDuration(session), 0);
  const weightedScore = scored.reduce(
    (sum, session) => sum + Number(session.flow_score || 0) * getSessionDuration(session),
    0,
  );

  return totalScoreWeight > 0 ? Math.round(weightedScore / totalScoreWeight) : 0;
}

export function calculateBestFlowScore(sessions: SessionRecord[]): number {
  return sessions
    .filter(isScoredSession)
    .map((session) => Number(session.flow_score))
    .filter((score) => Number.isFinite(score))
    .reduce((best, score) => Math.max(best, score), 0);
}

export function buildStatsSummary(sessions: SessionRecord[]): StatsSummary {
  const scored = sessions.filter(isScoredSession);
  return {
    bestFlowScore: calculateBestFlowScore(sessions),
    avgFlowScore: calculateWeightedAverageFlowScore(sessions),
    sessionCount: sessions.length,
    totalPracticeTime: sessions.reduce((sum, session) => sum + getSessionDuration(session), 0),
    hasScoredSession: scored.length > 0,
  };
}

export function getLastSessionDate(sessions: SessionRecord[]): string | null {
  return (
    sessions
      .map((session) => session.created_at)
      .filter((createdAt): createdAt is string => Boolean(createdAt))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

export function buildModeBreakdown(sessions: SessionRecord[]): ModeBreakdown[] {
  return Object.entries(groupSessionsByMode(sessions)).map(([mode, modeSessions]) => {
    const scoredByMode = modeSessions.filter(isScoredSession);
    return {
      mode,
      totalSessions: modeSessions.length,
      totalDuration: modeSessions.reduce((sum, session) => sum + getSessionDuration(session), 0),
      avgFlowScore:
        scoredByMode.length > 0
          ? Math.round(
              scoredByMode.reduce((sum, session) => sum + Number(session.flow_score || 0), 0) /
                scoredByMode.length,
            )
          : null,
    };
  });
}

export function buildRecentSessionSummaries(sessions: SessionRecord[]): RecentSessionSummary[] {
  return sessions.map((session) => ({
    id: session.id,
    created_at: session.created_at,
    duration: getSessionDuration(session),
    speakingTime: getSessionSpeakingTime(session),
    totalSilenceTime: getSessionSilenceTime(session),
    hesitationCount: getSessionHesitationCount(session),
    flowScore: getSessionFlowScore(session),
    mode: getNormalizedSessionMode(session),
    source: session.source ?? null,
  }));
}

export function getBestScoringSession(sessions: SessionRecord[]): SessionRecord | null {
  return sessions
    .filter((session) => {
      const score = getSessionFlowScore(session);
      return score !== null && Number.isFinite(score);
    })
    .sort((a, b) => {
      const scoreDelta = Number(b.flow_score) - Number(a.flow_score);
      if (scoreDelta !== 0) return scoreDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0] ?? null;
}

export function buildPinnedRecentSessionSummaries(
  recentSessions: SessionRecord[],
  allTimeBestSession: SessionRecord | null,
  limit = recentSessions.length,
): RecentSessionSummary[] {
  const bestSessionId = allTimeBestSession?.id ?? null;
  const remainingSessions = bestSessionId
    ? recentSessions.filter((session) => session.id !== bestSessionId)
    : recentSessions;
  const pinnedSessions = allTimeBestSession
    ? [allTimeBestSession, ...remainingSessions]
    : remainingSessions;

  return buildRecentSessionSummaries(pinnedSessions)
    .slice(0, limit)
    .map((session) => ({
      ...session,
      isAllTimeBest: bestSessionId !== null && session.id === bestSessionId,
    }));
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStartOfCurrentWeek(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function buildWeeklyStatsComparison(
  sessions: SessionRecord[],
  now = new Date(),
): WeeklyStatsComparison {
  const currentWeekStart = getStartOfCurrentWeek(now);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(currentWeekStart.getDate() - 7);
  const currentWeekEnd = new Date(now);

  const currentWeekSessions = sessions.filter((session) => {
    const createdAt = new Date(session.created_at);
    return createdAt >= currentWeekStart && createdAt <= currentWeekEnd;
  });
  const lastWeekSessions = sessions.filter((session) => {
    const createdAt = new Date(session.created_at);
    return createdAt >= lastWeekStart && createdAt < currentWeekStart;
  });

  return {
    currentWeek: buildStatsSummary(currentWeekSessions),
    lastWeek: buildStatsSummary(lastWeekSessions),
  };
}

export function buildWeeklyActivityDays(
  sessions: Array<Pick<SessionRecord, "created_at"> & { flow_score?: number | null; completed?: boolean | null }>,
  now = new Date(),
): WeeklyActivityDay[] {
  const labels: WeeklyActivityDay["label"][] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const startOfWeek = getStartOfCurrentWeek(now);
  const todayKey = getLocalDateKey(now);
  const weekStartKey = getLocalDateKey(startOfWeek);

  const byDate = new Map<string, { completed: boolean; bestScore: number | null }>();
  for (const session of sessions) {
    const dateKey = getLocalDateKey(new Date(session.created_at));
    if (dateKey < weekStartKey || dateKey > todayKey) continue;
    const existing = byDate.get(dateKey);
    const score = typeof session.flow_score === "number" ? session.flow_score : null;
    const isCompleted = session.completed !== false;
    if (!existing) {
      byDate.set(dateKey, { completed: isCompleted, bestScore: score });
    } else {
      byDate.set(dateKey, {
        completed: existing.completed || isCompleted,
        bestScore: score !== null && (existing.bestScore === null || score > existing.bestScore)
          ? score
          : existing.bestScore,
      });
    }
  }

  return labels.map((label, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    const dateKey = getLocalDateKey(date);
    const entry = byDate.get(dateKey);
    return {
      label,
      dateKey,
      completed: entry?.completed ?? false,
      bestScore: entry?.bestScore ?? null,
    };
  });
}

export function buildPracticeStats(
  sessions: SessionRecord[],
  streak: StreakRecord | null,
): PracticeStats {
  const scored = sessions.filter(isScoredSession);

  return {
    scoredSessions: scored.length,
    totalSessions: sessions.length,
    totalPracticeTime: sessions.reduce((sum, session) => sum + getSessionDuration(session), 0),
    avgFlowScore: calculateWeightedAverageFlowScore(sessions),
    bestFlowScore: calculateBestFlowScore(sessions),
    lastSessionDate: getLastSessionDate(sessions),
    currentStreak: Number(streak?.current_streak ?? 0),
    bestStreak: Number(streak?.longest_streak ?? 0),
    modeBreakdown: buildModeBreakdown(sessions),
    recentSessions: buildPinnedRecentSessionSummaries(sessions, getBestScoringSession(sessions), sessions.length),
  };
}
