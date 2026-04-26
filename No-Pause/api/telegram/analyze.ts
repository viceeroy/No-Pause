import { createHmac, timingSafeEqual } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import { calculateFlowScore } from "../../src/features/practice/lib/analyzer/scoring.js";
import { getTelegramConnection } from "../../src/lib/telegramAuth.js";
import { supabaseServer } from "../../src/lib/supabaseServer.js";

type FlowAnalysis = {
  flowScore: number;
  hesitationCount: number;
  speakingTimeSec: number;
  isCompleted: boolean;
};

type TelegramInitUser = {
  id?: number;
};

const MIN_RECORDING_SECONDS = 5;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readRequestFormData(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/api/telegram/analyze"}`, {
    method: "POST",
    headers,
    body: Buffer.concat(chunks),
  });

  return request.formData();
}

function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    return null;
  }

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const receivedBuffer = Buffer.from(receivedHash, "hex");
  const calculatedBuffer = Buffer.from(calculatedHash, "hex");

  if (receivedBuffer.length !== calculatedBuffer.length || !timingSafeEqual(receivedBuffer, calculatedBuffer)) {
    return null;
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  const maxAgeSeconds = 24 * 60 * 60;
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeSeconds) {
    return null;
  }

  const userText = params.get("user");
  if (!userText) {
    return null;
  }

  try {
    const user = JSON.parse(userText) as TelegramInitUser;
    return Number.isSafeInteger(user.id) && user.id ? user : null;
  } catch {
    return null;
  }
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numberValue));
}

function parseHesitationAnalysis(content: string): number {
  const jsonText = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(jsonText) as {
    hesitation_count?: unknown;
  };

  return Math.round(clampNumber(parsed.hesitation_count, 0, 9999, 0));
}

function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter(Boolean).length;
}

function getHesitationsPerMinute(hesitationCount: number, speakingTimeSec: number): number {
  const speakingMinutes = Math.max(speakingTimeSec / 60, 0.5);
  return hesitationCount / speakingMinutes;
}

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

async function transcribeAudio(audio: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", audio, audio.name || "recording.webm");
  formData.append("model", "whisper-large-v3-turbo");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv(process.env.GROQ_API_KEY, "GROQ_API_KEY")}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  return String(data?.text ?? "").trim();
}

async function analyzeTranscript(transcript: string, speakingTimeSec: number): Promise<FlowAnalysis> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv(process.env.GROQ_API_KEY, "GROQ_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a speech fluency coach. Analyze this transcript for pauses and hesitations. Return ONLY valid JSON: { \"hesitation_count\": <number of pauses/hesitations detected> }",
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq analysis failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
  const hesitationCount = parseHesitationAnalysis(content);
  const scoreResult = calculateFlowScore(hesitationCount, {
    mode: "free",
    speakingTimeSec,
    totalSessionTimeSec: speakingTimeSec,
    hasSpeechEvidence: transcript.trim().length > 0 || hesitationCount > 0,
  });

  return {
    flowScore: Number.isFinite(scoreResult.score) ? scoreResult.score : 0,
    hesitationCount,
    speakingTimeSec,
    isCompleted: scoreResult.isCompleted,
  };
}

async function insertTelegramSession(input: {
  userId: string;
  transcript: string;
  analysis: FlowAnalysis;
}) {
  const today = formatLocalDate(new Date());
  const hesitationsPerMinute = getHesitationsPerMinute(input.analysis.hesitationCount, input.analysis.speakingTimeSec);
  const { data, error } = await supabaseServer
    .from("sessions")
    .insert({
      user_id: input.userId,
      mode: "free_speaking",
      transcript: input.transcript,
      flow_score: input.analysis.flowScore,
      hesitations_per_minute: hesitationsPerMinute,
      completed: input.analysis.isCompleted,
      scoring_version: "1.0",
      duration: input.analysis.speakingTimeSec,
      speaking_time: input.analysis.speakingTimeSec,
      pauses: input.analysis.hesitationCount,
      words: countWords(input.transcript),
    })
    .select("id, created_at, duration, flow_score, mode, pauses, speaking_time")
    .single();

  if (error) {
    throw error;
  }

  const { data: streak } = await supabaseServer
    .from("streaks")
    .select("current_streak, longest_streak, last_session_date")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (streak?.last_session_date !== today) {
    const yesterday = addDaysToDateString(today, -1);
    const currentStreak =
      streak?.last_session_date === yesterday ? Number(streak.current_streak ?? 0) + 1 : 1;
    const longestStreak = Math.max(currentStreak, Number(streak?.longest_streak ?? 0));

    await supabaseServer.from("streaks").upsert(
      {
        user_id: input.userId,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_session_date: today,
      },
      { onConflict: "user_id" },
    );
  }

  return data;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end("Method Not Allowed");
      return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      sendJson(res, 500, { error: "TELEGRAM_BOT_TOKEN is not set" });
      return;
    }

    const formData = await readRequestFormData(req);
    const audio = formData.get("audio");
    const telegramId = Number(formData.get("telegram_id"));
    const duration = Math.round(Number(formData.get("duration")));
    const initData = String(formData.get("init_data") ?? "");

    if (!(audio instanceof File) || audio.size === 0) {
      sendJson(res, 400, { error: "Audio recording is required" });
      return;
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      sendJson(res, 413, { error: "Audio recording is too large" });
      return;
    }

    if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
      sendJson(res, 400, { error: "telegram_id is required" });
      return;
    }

    if (!Number.isFinite(duration) || duration < MIN_RECORDING_SECONDS) {
      sendJson(res, 400, { error: `Record for at least ${MIN_RECORDING_SECONDS} seconds` });
      return;
    }

    const telegramUser = verifyTelegramInitData(initData, botToken);
    if (!telegramUser?.id || telegramUser.id !== telegramId) {
      sendJson(res, 401, { error: "Invalid Telegram Mini App session" });
      return;
    }

    const connection = await getTelegramConnection(telegramId);
    if (!connection) {
      sendJson(res, 403, { error: "Connect your NoPause account before recording" });
      return;
    }

    const transcript = await transcribeAudio(audio);
    if (!transcript.trim()) {
      sendJson(res, 422, { error: "Transcript is empty" });
      return;
    }

    const analysis = await analyzeTranscript(transcript, duration);
    const session = await insertTelegramSession({
      userId: connection.userId,
      transcript,
      analysis,
    });

    sendJson(res, 200, {
      success: true,
      session_id: session.id,
      transcript,
      flow_score: analysis.flowScore,
      hesitation_count: analysis.hesitationCount,
      speaking_time_seconds: analysis.speakingTimeSec,
      duration_seconds: analysis.speakingTimeSec,
      words: countWords(transcript),
      session: {
        id: session.id,
        created_at: session.created_at,
        duration_seconds: Number(session.duration || 0),
        flow_score: session.flow_score,
        mode: session.mode,
        hesitation_count: Number(session.pauses || 0),
        speaking_time_seconds: Number(session.speaking_time || 0),
      },
    });
  } catch (error) {
    console.error("telegram miniapp analyze error:", error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
