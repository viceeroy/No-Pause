import { SCORING_VERSION_BASE } from "./constants.js";

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
  hesitationsPerMinute?: number | null;
  mode?: string;
  speakingTime?: number | null;
  silenceTime?: number | null;
  flowScore?: number | null;
  words?: number | null;
  completed?: boolean | null;
  hesitationLog?: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
  transcript?: string | null;
  analysisFeedback?: string | null;
  scoringVersion?: string;
  source?: "web" | "telegram";
  telegramChatId?: number | null;
  telegramMessageId?: number | null;
};

export type UpdateStreakInput = {
  userId: string | null;
  localDate?: string;
};

export type ExistingStreakRecord = {
  current_streak: number | null;
  longest_streak: number | null;
  last_session_date: string | null;
};

export type StreakUpdateValues = ExistingStreakRecord & {
  user_id: string;
};

function normalizeSessionMode(mode: string): string {
  void mode;
  return "speaking";
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

export function isMissingSessionAnalysisColumnError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return (
    maybeError?.code === "PGRST204" ||
    maybeError?.code === "42703" ||
    maybeError?.message?.includes("pause_count") === true ||
    maybeError?.message?.includes("hesitations_per_minute") === true ||
    maybeError?.message?.includes("total_silence_time") === true ||
    maybeError?.message?.includes("telegram_chat_id") === true ||
    maybeError?.message?.includes("telegram_message_id") === true
  );
}

export function buildSessionInsertValues(input: InsertSessionInput) {
  return {
    user_id: input.userId,
    speaking_time: input.speakingTime,
    total_silence_time: input.silenceTime ?? null,
    flow_score: input.flowScore,
    pauses: input.pauses,
    pause_count: input.pauseCount ?? input.pauses,
    hesitations_per_minute: input.hesitationsPerMinute ?? null,
    words: input.words,
    mode: normalizeSessionMode(input.mode ?? "speaking"),
    duration: input.duration,
    completed: input.completed ?? false,
    hesitation_log: input.hesitationLog ?? null,
    transcript: input.transcript ?? null,
    analysis_feedback: input.analysisFeedback ?? null,
    scoring_version: input.scoringVersion ?? SCORING_VERSION_BASE,
    source: input.source ?? "web",
    telegram_chat_id: input.telegramChatId ?? null,
    telegram_message_id: input.telegramMessageId ?? null,
  };
}

export function buildLegacySessionInsertValues(input: InsertSessionInput) {
  const legacyValues: Partial<ReturnType<typeof buildSessionInsertValues>> = {
    ...buildSessionInsertValues(input),
  };
  delete legacyValues.pause_count;
  delete legacyValues.hesitations_per_minute;
  delete legacyValues.total_silence_time;
  delete legacyValues.telegram_chat_id;
  delete legacyValues.telegram_message_id;

  return legacyValues;
}

export function calculateNextStreak(input: {
  userId: string;
  today: string;
  existingStreak: ExistingStreakRecord | null;
}): StreakUpdateValues | null {
  if (input.existingStreak?.last_session_date === input.today) {
    return null;
  }

  const yesterday = addDaysToDateString(input.today, -1);
  const currentStreak =
    input.existingStreak?.last_session_date === yesterday
      ? Number(input.existingStreak.current_streak ?? 0) + 1
      : 1;
  const longestStreak = Math.max(currentStreak, Number(input.existingStreak?.longest_streak ?? 0));

  return {
    user_id: input.userId,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_session_date: input.today,
  };
}

export async function insertSession(
  supabase: SupabaseLike,
  input: InsertSessionInput,
): Promise<string | null> {
  if (!input.userId) {
    return null;
  }

  const values = buildSessionInsertValues(input);

  const { data, error } = await supabase
    .from("sessions")
    .insert(values)
    .select("id")
    .single();

  if (error) {
    if (isMissingSessionAnalysisColumnError(error)) {
      const legacyValues = buildLegacySessionInsertValues(input);
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

  const { data: streak, error: fetchError } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, last_session_date")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const streakValues = calculateNextStreak({
    userId: input.userId,
    today,
    existingStreak: streak,
  });

  if (!streakValues) {
    return;
  }

  const { error: upsertError } = await supabase.from("streaks").upsert(
    streakValues,
    { onConflict: "user_id" },
  );

  if (upsertError) {
    throw upsertError;
  }
}
