import type { IncomingMessage, ServerResponse } from "http";
import { supabaseServer } from "../src/services/supabaseServer.js";
import {
  DAILY_PROMPTS_LIMIT,
  consumeApiQuota,
  getQuotaExceededMessage,
  isApiQuotaExceededError,
} from "../src/services/apiQuota.js";
import { generateCategoryPrompts } from "../src/services/groq.js";
import { appendUserGeneratedPrompts, getUserGeneratedPrompts } from "../src/services/userPrompts.js";
import { promptCategories, type PromptCategory } from "../src/lib/core/prompts.js";

const DEFAULT_COUNT = 5;
const MAX_COUNT = 8;

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

async function requireAuthenticatedUser(req: IncomingMessage): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!accessToken) return null;

  const { data, error } = await supabaseServer.auth.getUser(accessToken);
  return !error && data.user ? data.user.id : null;
}

function resolveCategory(body: Record<string, unknown>): PromptCategory | null {
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  return promptCategories.find((category) => category.id === categoryId) ?? null;
}

function resolveCount(body: Record<string, unknown>): number {
  const requested = Number(body.count);
  if (!Number.isFinite(requested)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(1, Math.floor(requested)));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end("Method Not Allowed");
      return;
    }

    if (!process.env.GROQ_API_KEY) {
      sendJson(res, 500, { error: "GROQ_API_KEY is not set" });
      return;
    }

    const userId = await requireAuthenticatedUser(req);
    if (!userId) {
      sendJson(res, 401, { error: "Authorization token is required" });
      return;
    }

    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const category = resolveCategory(body);
    if (!category) {
      sendJson(res, 400, { error: "A valid categoryId is required" });
      return;
    }

    const count = resolveCount(body);

    await consumeApiQuota({
      userId,
      kind: "prompts",
      limit: DAILY_PROMPTS_LIMIT,
    });

    // Include the user's already-generated prompts as style/dedupe context.
    const alreadyGenerated = await getUserGeneratedPrompts(userId, category.id);
    const existing = [...category.prompts, ...alreadyGenerated];

    const prompts = await generateCategoryPrompts({
      label: category.label,
      description: category.description,
      existing,
      count,
    });

    await appendUserGeneratedPrompts(userId, category.id, prompts);

    sendJson(res, 200, { prompts });
  } catch (error) {
    if (isApiQuotaExceededError(error)) {
      sendJson(res, 429, { error: getQuotaExceededMessage(error.kind) });
      return;
    }
    console.error("generate-prompts endpoint error:", error);
    sendJson(res, 500, { error: "Prompt generation failed. Please try again." });
  }
}
