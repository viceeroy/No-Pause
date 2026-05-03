import type { IncomingMessage, ServerResponse } from "http";
import { supabaseServer } from "../src/services/supabaseServer.js";
import { analyzePracticeSpeech, type AnalyzePracticeSpeechInput } from "../src/services/aiFeedback.js";

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

function getFeedbackInput(body: Record<string, unknown>): AnalyzePracticeSpeechInput | null {
  const transcript = typeof body.transcript === "string" ? body.transcript : "";
  if (!transcript.trim()) {
    return null;
  }

  return {
    transcript,
    flowScore: Number.isFinite(Number(body.flowScore)) ? Number(body.flowScore) : undefined,
    hesitationCount: Number.isFinite(Number(body.hesitationCount)) ? Number(body.hesitationCount) : undefined,
    speakingTime: Number.isFinite(Number(body.speakingTime)) ? Number(body.speakingTime) : undefined,
    wordCount: Number.isFinite(Number(body.wordCount)) ? Number(body.wordCount) : undefined,
  };
}

async function requireAuthenticatedUser(req: IncomingMessage): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) return false;

  const { data, error } = await supabaseServer.auth.getUser(accessToken);
  return !error && Boolean(data.user);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end("Method Not Allowed");
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      sendJson(res, 500, { error: "GEMINI_API_KEY is not set" });
      return;
    }

    if (!(await requireAuthenticatedUser(req))) {
      sendJson(res, 401, { error: "Authorization token is required" });
      return;
    }

    const body = await readJsonBody(req);
    const input = getFeedbackInput(body as Record<string, unknown>);
    if (!input) {
      sendJson(res, 400, { error: "transcript is required" });
      return;
    }

    const feedback = await analyzePracticeSpeech(input);
    sendJson(res, 200, { feedback });
  } catch (error) {
    console.error("feedback endpoint error:", error);
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
