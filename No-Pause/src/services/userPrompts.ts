import { supabaseServer } from "./supabaseServer.js";
import { getRandomPrompt, opinionPrompts, type PromptCategory } from "../lib/core/prompts.js";

type CategoryId = PromptCategory["id"];
type GeneratedMap = Partial<Record<CategoryId, string[]>>;

function normalizeGenerated(value: unknown): GeneratedMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const map: GeneratedMap = {};
  for (const [key, prompts] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(prompts)) continue;
    const cleaned = prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0);
    if (cleaned.length > 0) {
      map[key as CategoryId] = cleaned;
    }
  }
  return map;
}

async function readGeneratedMap(userId: string): Promise<GeneratedMap> {
  const { data, error } = await supabaseServer
    .from("user_prompts")
    .select("generated")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeGenerated(data?.generated);
}

export async function getUserGeneratedPrompts(userId: string, categoryId: CategoryId): Promise<string[]> {
  const map = await readGeneratedMap(userId);
  return map[categoryId] ?? [];
}

export async function appendUserGeneratedPrompts(
  userId: string,
  categoryId: CategoryId,
  prompts: string[],
): Promise<void> {
  const map = await readGeneratedMap(userId);
  const existing = map[categoryId] ?? [];
  const seen = new Set(existing.map((prompt) => prompt.trim().toLowerCase()));
  const merged = [...existing];

  for (const prompt of prompts) {
    const trimmed = prompt.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }

  const nextGenerated: GeneratedMap = { ...map, [categoryId]: merged };

  const { error } = await supabaseServer.from("user_prompts").upsert(
    {
      user_id: userId,
      generated: nextGenerated,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }
}

/**
 * Picks a topic for the Telegram bot. Prefers a user's generated prompts merged
 * with the built-in pool; falls back to the built-in pool when the user is
 * unresolved, has no generated prompts, or the lookup fails.
 */
export async function pickPromptForUser(userId: string | null, excludeLast?: string): Promise<string> {
  if (!userId) {
    return getRandomPrompt(excludeLast);
  }

  let generated: string[] = [];
  try {
    const map = await readGeneratedMap(userId);
    generated = Object.values(map).flatMap((prompts) => prompts ?? []);
  } catch (error) {
    console.error("Failed to load user generated prompts; falling back to built-ins", error);
  }

  if (generated.length === 0) {
    return getRandomPrompt(excludeLast);
  }

  const pool = [...opinionPrompts, ...generated];
  if (pool.length <= 1) {
    return pool[0] ?? getRandomPrompt(excludeLast);
  }

  let prompt = pool[Math.floor(Math.random() * pool.length)];
  while (prompt === excludeLast) {
    prompt = pool[Math.floor(Math.random() * pool.length)];
  }
  return prompt;
}
