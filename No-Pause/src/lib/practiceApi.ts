import {
  insertSession,
  isMissingSessionAnalysisColumnError,
  updateStreak as updateCoreStreak,
  type SupabaseLike,
} from "./core/session";
import {
  buildRecentSessionSummaries,
  buildWeeklyActivityDays,
  buildWeeklyStatsComparison,
  buildPracticeStats,
  getStartOfCurrentWeek,
  getPracticeStatsFromRpc,
  type PracticeStats,
  type SessionRecord,
  type StreakRecord,
  type WeeklyActivityDay,
  type WeeklyStatsComparison,
} from "./core/queries";
import { supabase as browserSupabase } from "@/services/supabase";

export type { PracticeStats, SessionRecord, WeeklyActivityDay, WeeklyStatsComparison } from "./core/queries";

const sessionSupabase: SupabaseLike = browserSupabase as unknown as SupabaseLike;
const SESSION_SUMMARY_COLUMNS =
  "id, created_at, mode, duration, speaking_time, total_silence_time, pauses, pause_count, words, flow_score, completed, hesitation_log, source";
const LEGACY_SESSION_SUMMARY_COLUMNS =
  "id, created_at, mode, duration, speaking_time, pauses, pause_count, words, flow_score, completed, hesitation_log, source";

export type Base64TranscriptionInput = {
  audioBase64: string;
  mimeType: string;
  language?: string;
  durationSec?: number;
};

export type TranscriptionResult = {
  transcript: string;
};

export type AnalyzePracticeSpeechInput = {
  transcript: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
};

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function getAudioFilename(mimeType: string): string {
  const extensionByMime: Record<string, string> = {
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
  };
  const safeMimeType = mimeType.split(";")[0] || "audio/webm";
  return `recording.${extensionByMime[safeMimeType] || "webm"}`;
}

async function readEndpointJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: unknown }).error)
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await browserSupabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function transcribeAudio(input: Base64TranscriptionInput): Promise<TranscriptionResult> {
  const safeMimeType = input.mimeType.split(";")[0] || "audio/webm";
  const formData = new FormData();
  formData.append("audio", base64ToBlob(input.audioBase64, safeMimeType), getAudioFilename(safeMimeType));
  if (input.language) formData.append("language", input.language);
  if (input.durationSec !== undefined) formData.append("durationSec", String(input.durationSec));

  const response = await fetch("/api/transcription", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: formData,
  });
  const body = await readEndpointJson<{ transcript?: unknown; words?: unknown }>(response);
  return {
    transcript: String(body.transcript ?? ""),
  };
}

export async function analyzeSpeech(input: AnalyzePracticeSpeechInput): Promise<string> {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      ...(await getAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = await readEndpointJson<{ feedback?: unknown }>(response);
  return String(body.feedback ?? "");
}

type SaveSessionInput = {
  userId: string | null;
  email?: string | null;
  duration: number;
  speakingTime?: number;
  silenceTime?: number;
  pauses: number;
  pauseCount?: number | null;
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
  return insertSession(sessionSupabase, {
    userId: input.userId,
    speakingTime: input.speakingTime,
    silenceTime: input.silenceTime,
    flowScore: input.flowScore,
    pauses: input.pauses,
    pauseCount: input.pauseCount ?? input.pauses,
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
  await updateCoreStreak(sessionSupabase, {
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

  const rpcStats = await getPracticeStatsFromRpc(browserSupabase, userId, limit);
  if (rpcStats) {
    return rpcStats;
  }

  const [
    allTimeSessionsResult,
    recentSessionsResult,
    streakResult,
  ] = await Promise.all([
    browserSupabase
      .from("sessions")
      .select(SESSION_SUMMARY_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    browserSupabase
      .from("sessions")
      .select(SESSION_SUMMARY_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    browserSupabase
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  let allTimeSessions = allTimeSessionsResult.data as SessionRecord[] | null;
  let allTimeSessionsError = allTimeSessionsResult.error;
  let recentSessions = recentSessionsResult.data as SessionRecord[] | null;
  let recentSessionsError = recentSessionsResult.error;
  const streak = streakResult.data;
  const streakError = streakResult.error;

  if (isMissingSessionAnalysisColumnError(allTimeSessionsError) || isMissingSessionAnalysisColumnError(recentSessionsError)) {
    const [
      legacyAllTimeSessionsResult,
      legacyRecentSessionsResult,
    ] = await Promise.all([
      browserSupabase
        .from("sessions")
        .select(LEGACY_SESSION_SUMMARY_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      browserSupabase
        .from("sessions")
        .select(LEGACY_SESSION_SUMMARY_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);
    allTimeSessions = legacyAllTimeSessionsResult.data as SessionRecord[] | null;
    allTimeSessionsError = legacyAllTimeSessionsResult.error;
    recentSessions = legacyRecentSessionsResult.data as SessionRecord[] | null;
    recentSessionsError = legacyRecentSessionsResult.error;
  }

  if (allTimeSessionsError) throw allTimeSessionsError;
  if (recentSessionsError) throw recentSessionsError;
  if (streakError) throw streakError;

  const stats = buildPracticeStats(
    (allTimeSessions ?? []) as SessionRecord[],
    streak as StreakRecord | null,
  );
  return {
    ...stats,
    recentSessions: buildRecentSessionSummaries((recentSessions ?? []) as SessionRecord[]),
  };
}

export async function getWeeklyActivityDays(userId: string | null): Promise<WeeklyActivityDay[]> {
  const now = new Date();
  if (!userId) {
    return buildWeeklyActivityDays([], now);
  }

  const startOfWeek = getStartOfCurrentWeek(now);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const queryStart = startOfWeek > sevenDaysAgo ? startOfWeek : sevenDaysAgo;

  const { data, error } = await browserSupabase
    .from("sessions")
    .select("created_at")
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("created_at", queryStart.toISOString())
    .lte("created_at", now.toISOString());

  if (error) throw error;

  return buildWeeklyActivityDays((data ?? []) as Array<Pick<SessionRecord, "created_at">>, now);
}

export async function getWeeklyStatsComparison(userId: string | null): Promise<WeeklyStatsComparison> {
  const now = new Date();
  if (!userId) {
    return buildWeeklyStatsComparison([], now);
  }

  const currentWeekStart = getStartOfCurrentWeek(now);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(currentWeekStart.getDate() - 7);

  const { data, error } = await browserSupabase
    .from("sessions")
    .select(SESSION_SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .gte("created_at", lastWeekStart.toISOString())
    .lte("created_at", now.toISOString());

  if (error) {
    if (isMissingSessionAnalysisColumnError(error)) {
      const { data: legacyData, error: legacyError } = await browserSupabase
        .from("sessions")
        .select(LEGACY_SESSION_SUMMARY_COLUMNS)
        .eq("user_id", userId)
        .gte("created_at", lastWeekStart.toISOString())
        .lte("created_at", now.toISOString());

      if (legacyError) throw legacyError;
      return buildWeeklyStatsComparison((legacyData ?? []) as SessionRecord[], now);
    }

    throw error;
  }

  return buildWeeklyStatsComparison((data ?? []) as SessionRecord[], now);
}
