import type { IncomingMessage, ServerResponse } from "http";
import { createTelegramBot } from "../../src/lib/telegramBot.js";

const bot = createTelegramBot();
const telegrafWebhook = bot.webhookCallback("/api/telegram/webhook");

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  await telegrafWebhook(req, res);
}
