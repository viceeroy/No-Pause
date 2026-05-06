import type { IncomingMessage, ServerResponse } from "http";
import { createTelegramBot } from "../../src/lib/telegram/router.js";

const bot = createTelegramBot();
const telegrafWebhook = bot.webhookCallback("/api/telegram/webhook");

function getTelegramSecretToken(req: IncomingMessage): string {
  const header = req.headers["x-telegram-bot-api-secret-token"];
  return Array.isArray(header) ? header[0] ?? "" : header ?? "";
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!webhookSecret || getTelegramSecretToken(req) !== webhookSecret) {
    res.statusCode = 401;
    res.end("Unauthorized");
    return;
  }

  await telegrafWebhook(req, res);
}
