import { supabase } from "./supabase";

type TranscribeAudioInput = {
  audioBase64: string;
  mimeType: string;
  language?: string;
  durationSec?: number;
};

type AnalyzeSpeechInput = {
  transcript: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
  mode?: string;
};

const BACKEND_MIGRATION_MESSAGE =
  "Practice backend features are temporarily unavailable while the backend migration is in progress.";

export async function transcribeAudio(_input: TranscribeAudioInput): Promise<string> {
  throw new Error(BACKEND_MIGRATION_MESSAGE);
}

export async function analyzeSpeech(_input: AnalyzeSpeechInput): Promise<string> {
  throw new Error(BACKEND_MIGRATION_MESSAGE);
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
};

type UpdateStreakInput = {
  userId: string | null;
  email?: string | null;
  localDate?: string;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return formatLocalDate(date);
}

export async function saveSession(input: SaveSessionInput): Promise<void> {
  if (!input.userId) {
    return;
  }

  const { error } = await supabase.from("sessions").insert({
    user_id: input.userId,
    speaking_time: input.speakingTime,
    flow_score: input.flowScore,
    pauses: input.pauses,
    words: input.words,
    mode: input.mode,
    duration: input.duration,
    completed: input.completed ?? false,
  });

  if (error) {
    throw error;
  }
}

export async function updateStreak(input: UpdateStreakInput): Promise<void> {
  if (!input.userId) {
    return;
  }

  const today = input.localDate ?? formatLocalDate(new Date());
  const yesterday = addDaysToDateString(today, -1);

  const { data: streak, error: fetchError } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, last_session_date")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (streak?.last_session_date === today) {
    return;
  }

  const currentStreak =
    streak?.last_session_date === yesterday ? (streak.current_streak ?? 0) + 1 : 1;
  const longestStreak = Math.max(currentStreak, streak?.longest_streak ?? 0);

  const { error: upsertError } = await supabase.from("streaks").upsert(
    {
      user_id: input.userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_session_date: today,
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    throw upsertError;
  }
}
