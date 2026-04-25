import type { IncomingMessage, ServerResponse } from "http";
import { supabaseServer } from "../../src/lib/supabaseServer.js";
import { upsertTelegramConnection } from "../../src/lib/telegramAuth.js";

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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end("Method Not Allowed");
      return;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      sendJson(res, 500, { error: "missing env vars" });
      return;
    }

    const body = await readJsonBody(req);
    const telegramId = Number(body.telegram_id);
    const userId = String(body.user_id ?? "");
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || !userId) {
      sendJson(res, 400, { error: "telegram_id and user_id are required" });
      return;
    }

    if (!accessToken) {
      sendJson(res, 401, { error: "Authorization token is required" });
      return;
    }

    const { data, error } = await supabaseServer.auth.getUser(accessToken);
    if (error || data.user?.id !== userId) {
      sendJson(res, 403, { error: "Invalid user session" });
      return;
    }

    await upsertTelegramConnection({ telegramId, userId });
    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error("telegram connect error:", err);
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message });
  }
}
