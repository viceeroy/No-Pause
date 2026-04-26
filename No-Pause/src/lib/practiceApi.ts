import { supabase } from "./supabase";
import { normalizeMode } from "./core/modes";
import { insertSession, updateStreak as updateCoreStreak } from "./core/session";

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

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const buildPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `You are a speech analysis expert. The user just completed a speaking session with these stats:
- Flow Score: ${input.flowScore}/100
- Hesitations: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}

Return feedback in markdown with:
- A short punchy header (e.g. ## 🎯 Your Session Breakdown)
- Bold the key stats when mentioned (flow score, hesitation count)
- 2-3 short sections with emoji headers like ### 💪 What You Did Well and ### 🎯 Focus On This
- End with a single motivational sentence under ### 🚀 Next Time
Keep it under 200 words, punchy and energetic in tone — not corporate or boring.`;

const buildVoiceActingPrompt = (transcript: string) =>
  `You are a drama coach and voice acting director. The user just read a dramatic passage aloud. Analyze their transcript for emotional expression, clarity, pacing, and dramatic delivery. Give energetic, encouraging feedback like a real acting coach. Reference specific words or phrases from their reading. Keep it under 200 words and use markdown formatting with emoji headers.

Transcript: ${transcript}`;

function requireGroqApiKey(): string {
  if (!GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY is not set");
  }

  return GROQ_API_KEY;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

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

export async function transcribeAudio(input: TranscribeAudioInput): Promise<string> {
  try {
    const apiKey = requireGroqApiKey();
    const safeMimeType = input.mimeType.split(";")[0] || "audio/webm";
    const audioByteLength = Math.floor((input.audioBase64.length * 3) / 4);
    const MAX_BYTES = 15 * 1024 * 1024;
    const MIN_BYTES = 5 * 1024;
    if (audioByteLength === 0) {
      throw new Error("Audio payload is empty");
    }
    if (input.durationSec !== undefined && input.durationSec < 1) {
      return "";
    }
    if (audioByteLength < MIN_BYTES) {
      return "";
    }
    if (audioByteLength > MAX_BYTES) {
      throw new Error(`Audio payload too large: ${audioByteLength} bytes`);
    }

    const audioBlob = base64ToBlob(input.audioBase64, safeMimeType);

    const extensionByMime: Record<string, string> = {
      "audio/webm": "webm",
      "audio/wav": "wav",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "mp4",
      "audio/m4a": "m4a",
      "audio/ogg": "ogg",
    };
    const fileExt = extensionByMime[safeMimeType] || "webm";

    const formData = new FormData();
    formData.append("file", audioBlob, `recording.${fileExt}`);
    formData.append("model", "whisper-large-v3-turbo");
    if (input.language) {
      formData.append("language", input.language);
    }

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const transcript = String(data?.text ?? "").trim();
    if (!transcript) return "";
    const normalized = transcript.toLowerCase().trim();
    // If transcript is 3 words or fewer, it's almost certainly a hallucination — discard it
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 3) return "";
    return transcript;
  } catch (error) {
    console.error("Groq transcription action failed", {
      message: error instanceof Error ? error.message : String(error),
      mimeType: input.mimeType,
      language: input.language ?? null,
      durationSec: input.durationSec ?? null,
      base64Length: input.audioBase64.length,
    });
    throw error;
  }
}

export async function analyzeSpeech(input: AnalyzeSpeechInput): Promise<string> {
  try {
    const apiKey = requireGroqApiKey();
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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: mode === "voiceacting"
              ? buildVoiceActingPrompt(trimmed)
              : buildPrompt({
                transcript: trimmed,
                flowScore,
                hesitationCount,
                speakingTime,
                wordCount,
              }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq analysis failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const output = String(content).trim();
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

  const records = (sessions ?? []) as SessionRecord[];
  const scored = records.filter((session) => session.flow_score !== null && session.flow_score !== undefined);
  const totalScoreWeight = scored.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const weightedScore = scored.reduce(
    (sum, session) => sum + Number(session.flow_score || 0) * Number(session.duration || 0),
    0,
  );
  const byMode = records.reduce<Record<string, SessionRecord[]>>((acc, session) => {
    const mode = normalizeMode((session.mode || "free").toLowerCase());
    acc[mode] = acc[mode] ? [...acc[mode], session] : [session];
    return acc;
  }, {});

  return {
    scoredSessions: scored.length,
    totalPracticeTime: records.reduce((sum, session) => sum + Number(session.duration || 0), 0),
    avgFlowScore: totalScoreWeight > 0 ? Math.round(weightedScore / totalScoreWeight) : 0,
    currentStreak: Number(streak?.current_streak ?? 0),
    bestStreak: Number(streak?.longest_streak ?? 0),
    modeBreakdown: Object.entries(byMode).map(([mode, modeSessions]) => {
      const modeScoredIncludingZero = modeSessions.filter((session) => session.flow_score !== null && session.flow_score !== undefined);
      return {
        mode,
        totalSessions: modeSessions.length,
        totalDuration: modeSessions.reduce((sum, session) => sum + Number(session.duration || 0), 0),
        avgFlowScore:
          modeScoredIncludingZero.length > 0
            ? Math.round(modeScoredIncludingZero.reduce((sum, session) => sum + Number(session.flow_score || 0), 0) / modeScoredIncludingZero.length)
            : null,
      };
    }),
    recentSessions: records.map((session) => ({
      id: session.id,
      created_at: session.created_at,
      duration: Number(session.duration || 0),
      hesitationCount: Number(session.pauses || 0),
      flowScore: session.flow_score === null || session.flow_score === undefined ? null : Number(session.flow_score),
      mode: normalizeMode((session.mode || "free").toLowerCase()),
    })),
  };
}
