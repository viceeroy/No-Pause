import { supabase } from "./supabase";
import { insertSession, updateStreak as updateCoreStreak } from "./core/session";
import { getAIFeedback, transcribeBase64Audio, type Base64TranscriptionInput } from "./core/groq";
import { buildPracticeStats, type PracticeStats, type SessionRecord, type StreakRecord } from "./core/queries";

export type { PracticeStats, SessionRecord } from "./core/queries";

type AnalyzeSpeechInput = {
  transcript: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
  mode?: string;
};

const buildPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `You are a speech analysis expert. The user just completed a speaking session with these stats:
- Flow Score: ${input.flowScore}/100
- Pauses: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}

Return feedback in markdown with:
- A short punchy header (e.g. ## 🎯 Your Session Breakdown)
- Bold the key stats when mentioned (flow score, pause count)
- 2-3 short sections with emoji headers like ### 💪 What You Did Well and ### 🎯 Focus On This
- End with a single motivational sentence under ### 🚀 Next Time
Keep it under 200 words, punchy and energetic in tone — not corporate or boring.`;

const buildVoiceActingPrompt = (transcript: string) =>
  `You are a drama coach and voice acting director. The user just read a dramatic passage aloud. Analyze their transcript for emotional expression, clarity, pacing, and dramatic delivery. Give energetic, encouraging feedback like a real acting coach. Reference specific words or phrases from their reading. Keep it under 200 words and use markdown formatting with emoji headers.

Transcript: ${transcript}`;

export async function transcribeAudio(input: Base64TranscriptionInput): Promise<string> {
  return transcribeBase64Audio(input);
}

export async function analyzeSpeech(input: AnalyzeSpeechInput): Promise<string> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const flowScore = input.flowScore ?? 0;
    const hesitationCount = input.hesitationCount ?? 0;
    const speakingTime = input.speakingTime ?? 0;
    const wordCount = input.wordCount ?? 0;
    const mode = input.mode ?? "default";

    console.log("analyzeSpeech request", {
      transcriptLength: trimmed.length,
      flowScore,
      hesitationCount,
      speakingTime,
      wordCount,
      mode,
    });

    const output = await getAIFeedback(
      trimmed,
      mode === "voiceacting"
        ? buildVoiceActingPrompt(trimmed)
        : buildPrompt({
          transcript: trimmed,
          flowScore,
          hesitationCount,
          speakingTime,
          wordCount,
        }),
    );
    console.log("analyzeSpeech response", {
      responseLength: output.length,
    });
    return output;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
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
  return insertSession(supabase, {
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

  const { error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", input.sessionId)
    .eq("user_id", input.userId);

  if (error) throw error;
}

export async function updateStreak(input: { userId: string | null; email?: string | null; localDate?: string }): Promise<void> {
  await updateCoreStreak(supabase, {
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
    supabase
      .from("sessions")
      .select("id, created_at, mode, duration, speaking_time, pauses, words, flow_score, completed, hesitation_log, transcript, analysis_feedback")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (sessionsError) throw sessionsError;
  if (streakError) throw streakError;

  return buildPracticeStats((sessions ?? []) as SessionRecord[], streak as StreakRecord | null);
}
