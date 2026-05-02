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
  filler_count?: number | null;
  words: number | null;
  flow_score: number | null;
  completed: boolean | null;
  source?: string | null;
  hesitation_log: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
  transcript: string | null;
  analysis_feedback: string | null;
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
  monthlyStats?: {
    totalSessions: number;
    totalSpeakingTime: number;
    avgFlowScore: number;
  };
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
    hesitationCount: number;
    flowScore: number | null;
    mode: string;
    source?: string | null;
  }>;
};

export type ModeBreakdown = PracticeStats["modeBreakdown"][number];
export type RecentSessionSummary = PracticeStats["recentSessions"][number];

export type StatsSessionSets = {
  allTimeSessions: SessionRecord[];
  monthlySessions: SessionRecord[];
};

const SESSION_COLUMNS =
  "id, created_at, mode, duration, speaking_time, pauses, pause_count, filler_count, words, flow_score, completed, hesitation_log, transcript, analysis_feedback";
const LEGACY_SESSION_COLUMNS =
  "id, created_at, mode, duration, speaking_time, pauses, words, flow_score, completed, hesitation_log, transcript, analysis_feedback";

async function getServerSupabase() {
  const { supabaseServer } = await import("../../services/supabaseServer.js");
  return supabaseServer;
}

export function getCurrentMonthRange(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getTelegramSessions(userId: string): Promise<StatsSessionSets> {
  const supabase = await getServerSupabase();
  const monthRange = getCurrentMonthRange();
  const [
    { data: allTimeData, error: allTimeError },
    { data: monthlyData, error: monthlyError },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", userId)
      .gte("created_at", monthRange.start)
      .lt("created_at", monthRange.end)
      .order("created_at", { ascending: false }),
  ]);

  if (allTimeError || monthlyError) {
    if (isMissingSessionAnalysisColumnError(allTimeError) || isMissingSessionAnalysisColumnError(monthlyError)) {
      const [
        { data: legacyAllTimeData, error: legacyAllTimeError },
        { data: legacyMonthlyData, error: legacyMonthlyError },
      ] = await Promise.all([
        supabase
          .from("sessions")
          .select(LEGACY_SESSION_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select(LEGACY_SESSION_COLUMNS)
          .eq("user_id", userId)
          .gte("created_at", monthRange.start)
          .lt("created_at", monthRange.end)
          .order("created_at", { ascending: false }),
      ]);

      if (legacyAllTimeError) {
        throw legacyAllTimeError;
      }
      if (legacyMonthlyError) {
        throw legacyMonthlyError;
      }

      return {
        allTimeSessions: (legacyAllTimeData ?? []) as SessionRecord[],
        monthlySessions: (legacyMonthlyData ?? []) as SessionRecord[],
      };
    }

    if (allTimeError) {
      throw allTimeError;
    }
    if (monthlyError) {
      throw monthlyError;
    }
  }

  return {
    allTimeSessions: (allTimeData ?? []) as SessionRecord[],
    monthlySessions: (monthlyData ?? []) as SessionRecord[],
  };
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
    hesitationCount: getSessionHesitationCount(session),
    flowScore: getSessionFlowScore(session),
    mode: getNormalizedSessionMode(session),
    source: session.source ?? null,
  }));
}

export function getCurrentMonthSessions(sessions: SessionRecord[], now = new Date()): SessionRecord[] {
  return sessions.filter((session) => {
    const sessionDate = new Date(session.created_at);
    return (
      Number.isFinite(sessionDate.getTime()) &&
      sessionDate.getFullYear() === now.getFullYear() &&
      sessionDate.getMonth() === now.getMonth()
    );
  });
}

export function buildPracticeStats(
  sessions: SessionRecord[],
  streak: StreakRecord | null,
  monthlySessionRecords = getCurrentMonthSessions(sessions),
): PracticeStats {
  const scored = sessions.filter(isScoredSession);

  return {
    scoredSessions: scored.length,
    totalPracticeTime: sessions.reduce((sum, session) => sum + getSessionDuration(session), 0),
    avgFlowScore: calculateWeightedAverageFlowScore(sessions),
    bestFlowScore: calculateBestFlowScore(sessions),
    monthlyStats: {
      totalSessions: monthlySessionRecords.length,
      totalSpeakingTime: monthlySessionRecords.reduce((sum, session) => sum + getSessionSpeakingTime(session), 0),
      avgFlowScore: calculateWeightedAverageFlowScore(monthlySessionRecords),
    },
    lastSessionDate: getLastSessionDate(sessions),
    currentStreak: Number(streak?.current_streak ?? 0),
    bestStreak: Number(streak?.longest_streak ?? 0),
    modeBreakdown: buildModeBreakdown(sessions),
    recentSessions: buildRecentSessionSummaries(sessions),
  };
}
