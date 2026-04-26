import type { IncomingMessage, ServerResponse } from "http";
import { supabaseServer } from "../../src/lib/supabaseServer.js";
import { upsertTelegramConnection } from "../../src/lib/telegramAuth.js";
import { escapeTelegramHtml } from "../../src/lib/core/utils.js";

const SITE_URL = "https://nopause.org";

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

function getFirstName(userMetadata: Record<string, unknown> | undefined) {
  const metadataFirstName = userMetadata?.first_name;
  if (typeof metadataFirstName === "string" && metadataFirstName.trim()) {
    return metadataFirstName.trim();
  }

  const metadataName = userMetadata?.name ?? userMetadata?.full_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().split(/\s+/)[0];
  }

  return "there";
}

async function sendTelegramWelcomeMessage(input: { telegramId: number; firstName: string }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: input.telegramId,
      parse_mode: "HTML",
      text: `👋 Hi <b>${escapeTelegramHtml(input.firstName)}</b>!

✅ Your NoPause account is now connected.

Here's what you can do with <b>@NoPauseAI_bot</b>:

🎤 <b>Send a voice message</b> — speak freely and get instant feedback on your fluency, pauses, and Flow Score.

📊 <b>Open NoPause</b> — view your full stats, session history, and progress dashboard.

💡 <b>Get a Prompt</b> — receive a speaking topic and practice on the spot.

📈 <b>My Stats</b> — check your streak, Flow Score, and practice time anytime.

Your full history and detailed results are always at:
<a href='${SITE_URL}'>${SITE_URL}</a>`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Telegram welcome message failed: ${response.status} ${errorText}`);
  }
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
    await sendTelegramWelcomeMessage({
      telegramId,
      firstName: getFirstName(data.user.user_metadata),
    });

    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error("telegram connect error:", err);
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message });
  }
}
