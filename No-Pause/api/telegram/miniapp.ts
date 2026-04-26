import { createHmac, timingSafeEqual } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import { getTelegramConnection } from "../../src/lib/telegramAuth.js";
import { supabaseServer } from "../../src/lib/supabaseServer.js";

type MiniAppSession = {
  id: string;
  created_at: string | null;
  duration: number | null;
  flow_score: number | null;
  mode: string | null;
  pauses: number | null;
  speaking_time: number | null;
  words: number | null;
  completed: boolean | null;
  hesitation_log: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
  transcript: string | null;
  analysis_feedback: string | null;
};

type TelegramInitUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
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

  let user: TelegramInitUser;
  try {
    user = JSON.parse(userText) as TelegramInitUser;
  } catch {
    return null;
  }

  return Number.isSafeInteger(user.id) && user.id ? user : null;
}

const STATS_SESSION_LIMIT = 15;

function getScoredSessions(sessions: MiniAppSession[]) {
  return sessions.filter((session) => session.flow_score !== null && session.flow_score !== undefined);
}

function getWeightedAverageFlowScore(sessions: MiniAppSession[]) {
  const scoredSessions = getScoredSessions(sessions);
  const totalScoreWeight = scoredSessions.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const weightedScore = scoredSessions.reduce(
    (sum, session) => sum + Number(session.flow_score || 0) * Number(session.duration || 0),
    0,
  );

  return totalScoreWeight > 0 ? Math.round(weightedScore / totalScoreWeight) : 0;
}

function serializeSession(session: MiniAppSession) {
  return {
    id: session.id,
    mode: session.mode,
    flow_score: session.flow_score,
    duration_seconds: Number(session.duration || 0),
    speaking_time_seconds: Number(session.speaking_time || 0),
    hesitation_count: Number(session.pauses || 0),
    created_at: session.created_at,
  };
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

    const body = await readJsonBody(req);
    const initData = String(body.initData ?? "");
    const telegramUser = verifyTelegramInitData(initData, botToken);
    if (!telegramUser?.id) {
      sendJson(res, 401, { error: "Invalid Telegram Mini App session" });
      return;
    }

    const connection = await getTelegramConnection(telegramUser.id);
    if (!connection) {
      sendJson(res, 200, {
        connected: false,
        telegramUser,
        connectUrl: `https://nopause.org/connect?tg=${encodeURIComponent(String(telegramUser.id))}`,
      });
      return;
    }
    console.log("resolved user_id:", connection.userId);

    const [{ data: streak, error: streakError }, { data: sessions, error: sessionsError }] = await Promise.all([
      supabaseServer
        .from("streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", connection.userId)
        .maybeSingle(),
      supabaseServer
        .from("sessions")
        .select("id, created_at, mode, duration, speaking_time, pauses, words, flow_score, completed, hesitation_log, transcript, analysis_feedback")
        .eq("user_id", connection.userId)
        .order("created_at", { ascending: false })
        .limit(STATS_SESSION_LIMIT),
    ]);

    if (streakError || sessionsError) {
      console.error("Telegram Mini App stats lookup failed", { streakError, sessionsError });
      sendJson(res, 500, { error: "Failed to load stats" });
      return;
    }

    const records = (sessions ?? []) as MiniAppSession[];
    const scoredSessions = getScoredSessions(records);
    const latestSession = records[0] ?? null;

    sendJson(res, 200, {
      connected: true,
      telegramUser,
      stats: {
        currentStreak: Number(streak?.current_streak ?? 0),
        longestStreak: Number(streak?.longest_streak ?? 0),
        totalSessions: scoredSessions.length,
        totalPracticeTime: records.reduce((sum, session) => sum + Number(session.duration || 0), 0),
        overallFlow: getWeightedAverageFlowScore(records),
        latestSession: latestSession ? serializeSession(latestSession) : null,
        recentSessions: records.map(serializeSession),
      },
    });
  } catch (error) {
    console.error("telegram miniapp error:", error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
