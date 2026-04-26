import { normalizeMode } from "./modes.js";

export type SessionRecord = {
  id: string;
  created_at: string;
  mode: string;
  duration: number;
  speaking_time: number | null;
  pauses: number | null;
  words: number | null;
  flow_score: number | null;
  completed: boolean | null;
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
  }>;
};

const SESSION_COLUMNS =
  "id, created_at, mode, duration, speaking_time, pauses, words, flow_score, completed, hesitation_log, transcript, analysis_feedback";

async function getServerSupabase() {
  const { supabaseServer } = await import("../supabaseServer.js");
  return supabaseServer;
}

export async function getSessions(userId: string, limit = 15): Promise<SessionRecord[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as SessionRecord[];
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

export async function getStats(userId: string, limit = 15): Promise<PracticeStats> {
  const [sessions, streak] = await Promise.all([
    getSessions(userId, limit),
    getStreak(userId),
  ]);

  return buildPracticeStats(sessions, streak);
}

export function buildPracticeStats(
  sessions: SessionRecord[],
  streak: StreakRecord | null,
): PracticeStats {
  const scored = sessions.filter((session) => session.flow_score !== null && session.flow_score !== undefined);
  const totalScoreWeight = scored.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const weightedScore = scored.reduce(
    (sum, session) => sum + Number(session.flow_score || 0) * Number(session.duration || 0),
    0,
  );
  const byMode = sessions.reduce<Record<string, SessionRecord[]>>((acc, session) => {
    const mode = normalizeMode((session.mode || "free").toLowerCase());
    acc[mode] = acc[mode] ? [...acc[mode], session] : [session];
    return acc;
  }, {});

  return {
    scoredSessions: scored.length,
    totalPracticeTime: sessions.reduce((sum, session) => sum + Number(session.duration || 0), 0),
    avgFlowScore: totalScoreWeight > 0 ? Math.round(weightedScore / totalScoreWeight) : 0,
    currentStreak: Number(streak?.current_streak ?? 0),
    bestStreak: Number(streak?.longest_streak ?? 0),
    modeBreakdown: Object.entries(byMode).map(([mode, modeSessions]) => {
      const scoredByMode = modeSessions.filter(
        (session) => session.flow_score !== null && session.flow_score !== undefined,
      );
      return {
        mode,
        totalSessions: modeSessions.length,
        totalDuration: modeSessions.reduce((sum, session) => sum + Number(session.duration || 0), 0),
        avgFlowScore:
          scoredByMode.length > 0
            ? Math.round(scoredByMode.reduce((sum, session) => sum + Number(session.flow_score || 0), 0) / scoredByMode.length)
            : null,
      };
    }),
    recentSessions: sessions.map((session) => ({
      id: session.id,
      created_at: session.created_at,
      duration: Number(session.duration || 0),
      hesitationCount: Number(session.pauses || 0),
      flowScore: session.flow_score === null || session.flow_score === undefined ? null : Number(session.flow_score),
      mode: normalizeMode((session.mode || "free").toLowerCase()),
    })),
  };
}
