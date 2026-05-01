import { insertSession, updateStreak as updateCoreStreak } from "./core/session";
import { buildPracticeStats, type PracticeStats, type SessionRecord, type StreakRecord } from "./core/queries";
import {
  analyzePracticeSpeech,
  transcribePracticeAudio,
  type AnalyzePracticeSpeechInput,
  type Base64TranscriptionInput,
} from "@/services/groq";
import { supabase as browserSupabase } from "@/services/supabase";

export type { PracticeStats, SessionRecord } from "./core/queries";

export async function transcribeAudio(input: Base64TranscriptionInput): Promise<string> {
  return transcribePracticeAudio(input);
}

export async function analyzeSpeech(input: AnalyzePracticeSpeechInput): Promise<string> {
  return analyzePracticeSpeech(input);
}

type SaveSessionInput = {
  userId: string | null;
  email?: string | null;
  duration: number;
  speakingTime?: number;
  pauses: number;
  words?: number | null;
  mode: string;
  flowScore?: number | null;
  completed?: boolean;
  hesitationLog?: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }>;
  transcript?: string | null;
  analysisFeedback?: string | null;
};

type UpdateSessionInput = {
  sessionId?: string | null;
  userId: string | null;
  words?: number | null;
  transcript?: string | null;
  analysisFeedback?: string | null;
};

export async function saveSession(input: SaveSessionInput): Promise<string | null> {
  return insertSession(browserSupabase, {
    userId: input.userId,
    speakingTime: input.speakingTime,
    flowScore: input.flowScore,
    pauses: input.pauses,
    words: input.words,
    mode: input.mode,
    source: "web",
    duration: input.duration,
    completed: input.completed,
    hesitationLog: input.hesitationLog,
    transcript: input.transcript,
    analysisFeedback: input.analysisFeedback,
  });
}

export async function updateSession(input: UpdateSessionInput): Promise<void> {
  if (!input.userId || !input.sessionId) return;

  const updates: Record<string, string | number | null> = {};
  if (input.transcript !== undefined) updates.transcript = input.transcript;
  if (input.words !== undefined) updates.words = input.words;
  if (input.analysisFeedback !== undefined) updates.analysis_feedback = input.analysisFeedback;
  if (Object.keys(updates).length === 0) return;

  const { error } = await browserSupabase
    .from("sessions")
    .update(updates)
    .eq("id", input.sessionId)
    .eq("user_id", input.userId);

  if (error) throw error;
}

export async function updateStreak(input: { userId: string | null; email?: string | null; localDate?: string }): Promise<void> {
  await updateCoreStreak(browserSupabase, {
    userId: input.userId,
    localDate: input.localDate,
  });
}

export async function getPracticeStats(userId: string | null, limit = 15): Promise<PracticeStats> {
  if (!userId) {
    return {
      scoredSessions: 0,
      totalPracticeTime: 0,
      avgFlowScore: 0,
      bestFlowScore: 0,
      lastSessionDate: null,
      currentStreak: 0,
      bestStreak: 0,
      modeBreakdown: [],
      recentSessions: [],
    };
  }

  const [{ data: sessions, error: sessionsError }, { data: streak, error: streakError }] = await Promise.all([
    browserSupabase
      .from("sessions")
      .select("id, created_at, mode, duration, speaking_time, pauses, words, flow_score, completed, hesitation_log, transcript, analysis_feedback")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    browserSupabase
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (sessionsError) throw sessionsError;
  if (streakError) throw streakError;

  return buildPracticeStats((sessions ?? []) as SessionRecord[], streak as StreakRecord | null);
}
