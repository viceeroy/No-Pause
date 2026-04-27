import { SCORING_VERSION } from "./constants.js";

type SupabaseQueryResult<T> = PromiseLike<{ data: T | null; error: unknown }>;

type SupabaseFrom = {
  insert(values: unknown): {
    select(columns: string): {
      single(): SupabaseQueryResult<{ id: string }>;
    };
  };
  update(values: unknown): {
    eq(column: string, value: unknown): {
      eq(column: string, value: unknown): SupabaseQueryResult<unknown>;
    } & SupabaseQueryResult<unknown>;
  };
  select(columns: string): {
    eq(column: string, value: unknown): {
      maybeSingle(): SupabaseQueryResult<{
        current_streak: number | null;
        longest_streak: number | null;
        last_session_date: string | null;
      }>;
    };
  };
  upsert(values: unknown, options?: unknown): SupabaseQueryResult<unknown>;
};

export type SupabaseLike = {
  from(table: string): SupabaseFrom;
};

export type InsertSessionInput = {
  userId: string | null;
  duration: number;
  pauses: number;
  pauseCount?: number | null;
  fillerCount?: number | null;
  hesitationsPerMinute?: number | null;
  mode?: string;
  speakingTime?: number | null;
  flowScore?: number | null;
  words?: number | null;
  completed?: boolean | null;
  hesitationLog?: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
  transcript?: string | null;
  analysisFeedback?: string | null;
  scoringVersion?: string;
  source?: "web" | "telegram";
};

export type UpdateStreakInput = {
  userId: string | null;
  localDate?: string;
};

function normalizeSessionMode(mode: string): string {
  return mode === "free_speaking" ? "free" : mode;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return formatLocalDate(date);
}

function isMissingSessionAnalysisColumnError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return (
    maybeError?.code === "PGRST204" ||
    maybeError?.code === "42703" ||
    maybeError?.message?.includes("pause_count") === true ||
    maybeError?.message?.includes("filler_count") === true ||
    maybeError?.message?.includes("hesitations_per_minute") === true
  );
}

export async function insertSession(
  supabase: SupabaseLike,
  input: InsertSessionInput,
): Promise<string | null> {
  if (!input.userId) {
    return null;
  }

  const values = {
      user_id: input.userId,
      speaking_time: input.speakingTime,
      flow_score: input.flowScore,
      pauses: input.pauses,
      pause_count: input.pauseCount ?? input.pauses,
      filler_count: input.fillerCount ?? null,
      hesitations_per_minute: input.hesitationsPerMinute ?? null,
      words: input.words,
      mode: normalizeSessionMode(input.mode ?? "free"),
      duration: input.duration,
      completed: input.completed ?? false,
      hesitation_log: input.hesitationLog ?? null,
      transcript: input.transcript ?? null,
      analysis_feedback: input.analysisFeedback ?? null,
      scoring_version: input.scoringVersion ?? SCORING_VERSION,
      source: input.source ?? "web",
    };

  const { data, error } = await supabase
    .from("sessions")
    .insert(values)
    .select("id")
    .single();

  if (error) {
    if (isMissingSessionAnalysisColumnError(error)) {
      const {
        pause_count: _pauseCount,
        filler_count: _fillerCount,
        hesitations_per_minute: _hpm,
        ...legacyValues
      } = values;
      const { data: legacyData, error: legacyError } = await supabase
        .from("sessions")
        .insert(legacyValues)
        .select("id")
        .single();

      if (legacyError) {
        throw legacyError;
      }

      return String(legacyData?.id ?? "");
    }

    throw error;
  }

  return String(data?.id ?? "");
}

export async function updateStreak(
  supabase: SupabaseLike,
  input: UpdateStreakInput,
): Promise<void> {
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
    streak?.last_session_date === yesterday ? Number(streak.current_streak ?? 0) + 1 : 1;
  const longestStreak = Math.max(currentStreak, Number(streak?.longest_streak ?? 0));

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
