import { normalizeMode } from "./modes.js";
import { isMissingSessionAnalysisColumnError } from "./session.js";

export type SessionRecord = {
  id: string;
  created_at: string;
  mode: string;
  duration: number;
  speaking_time: number | null;
  total_silence_time?: number | null;
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
};

type SupabaseRpcLike = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

const SESSION_COLUMNS =
  "id, created_at, mode, duration, speaking_time, total_silence_time, pauses, pause_count, words, flow_score, completed, hesitation_log, transcript, analysis_feedback, source";
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
    }];
  });
}

export function parsePracticeStats(value: unknown): PracticeStats | null {
  const record = toRecord(value);
  if (!record) return null;
  return {
    scoredSessions: toInteger(record.scoredSessions),
    totalPracticeTime: toInteger(record.totalPracticeTime),
    avgFlowScore: toInteger(record.avgFlowScore),
    bestFlowScore: toInteger(record.bestFlowScore),
    lastSessionDate: record.lastSessionDate === null || record.lastSessionDate === undefined
      ? null
      : String(record.lastSessionDate),
    currentStreak: toInteger(record.currentStreak),
    bestStreak: toInteger(record.bestStreak),
    modeBreakdown: parseModeBreakdown(record.modeBreakdown),
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
  return Number(session.total_silence_time ?? 0);
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
  sessions: Array<Pick<SessionRecord, "created_at">>,
  now = new Date(),
): WeeklyActivityDay[] {
  const labels: WeeklyActivityDay["label"][] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const startOfWeek = getStartOfCurrentWeek(now);
  const todayKey = getLocalDateKey(now);
  const completedDateKeys = new Set(
    sessions
      .map((session) => getLocalDateKey(new Date(session.created_at)))
      .filter((dateKey) => dateKey >= getLocalDateKey(startOfWeek) && dateKey <= todayKey),
  );

  return labels.map((label, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    const dateKey = getLocalDateKey(date);
    return {
      label,
      dateKey,
      completed: completedDateKeys.has(dateKey),
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
    totalPracticeTime: sessions.reduce((sum, session) => sum + getSessionDuration(session), 0),
    avgFlowScore: calculateWeightedAverageFlowScore(sessions),
    bestFlowScore: calculateBestFlowScore(sessions),
    lastSessionDate: getLastSessionDate(sessions),
    currentStreak: Number(streak?.current_streak ?? 0),
    bestStreak: Number(streak?.longest_streak ?? 0),
    modeBreakdown: buildModeBreakdown(sessions),
    recentSessions: buildRecentSessionSummaries(sessions),
  };
}
