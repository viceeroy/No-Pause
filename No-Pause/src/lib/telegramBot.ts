import { Markup, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { getTelegramConnection } from "./telegramAuth.js";
import { supabaseServer } from "./supabaseServer.js";

const SITE_URL = "https://nopause.org";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FREE_SPEAKING_LABEL = "🎤 Free Speaking";
const MY_STATS_LABEL = "📈 My Stats";
const GET_PROMPT_LABEL = "💡 Get Prompt";
const ABOUT_LABEL = "ℹ️ About";
const PROMPT_READY_ACTION = "prompt_ready";
const TRY_AGAIN_PROMPT_ACTION = "try_again:prompt";
const TRY_AGAIN_FREE_ACTION = "try_again:free_speaking";

type LastInteraction = "prompt" | "free_speaking";
type SessionMode = "telegram_prompt" | "free_speaking";

const lastInteractionByTelegramId = new Map<number, LastInteraction>();

const opinionPrompts = [
  "Should schools teach public speaking as a core skill?",
  "Is remote work better for creativity or focus?",
  "Should people read more books or listen to more podcasts?",
  "Is confidence something you build or something you choose?",
  "Should social media platforms hide public like counts?",
  "Is it better to be highly specialized or broadly skilled?",
  "Should cities prioritize walking and cycling over cars?",
  "Is failure overrated as a teacher?",
  "Should AI tools be allowed in classrooms?",
  "Is a busy schedule a sign of ambition or poor boundaries?",
];

type FlowAnalysis = {
  score: number;
  coachingNote: string;
};

const replyKeyboard = Markup.keyboard([
  [FREE_SPEAKING_LABEL, MY_STATS_LABEL, GET_PROMPT_LABEL],
  [ABOUT_LABEL],
]).resize();

const promptReadyKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("✅ Got it, recording...", PROMPT_READY_ACTION),
]);

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function getBotToken(): string {
  return requireEnv(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
}

function getGroqApiKey(): string {
  return requireEnv(GROQ_API_KEY, "GROQ_API_KEY");
}

function getTelegramId(ctx: Context): number | null {
  return ctx.from?.id ?? null;
}

function getConnectUrl(telegramId: number): string {
  return `${SITE_URL}/connect?tg=${encodeURIComponent(String(telegramId))}`;
}

function getRandomPrompt(): string {
  return opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
}

function getSessionMode(telegramId: number): SessionMode {
  return lastInteractionByTelegramId.get(telegramId) === "prompt" ? "telegram_prompt" : "free_speaking";
}

function getTryAgainAction(mode: SessionMode): string {
  return mode === "telegram_prompt" ? TRY_AGAIN_PROMPT_ACTION : TRY_AGAIN_FREE_ACTION;
}

function getSessionActions(mode: SessionMode, sessionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔄 Try Again", getTryAgainAction(mode)),
      Markup.button.url("📊 View on NoPause", `${SITE_URL}/session/${sessionId}`),
    ],
  ]);
}

function estimateDurationSec(voiceDuration?: number): number {
  if (!voiceDuration || voiceDuration < 1) {
    return 1;
  }

  return Math.round(voiceDuration);
}

function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter(Boolean).length;
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

function parseFlowAnalysis(content: string): FlowAnalysis {
  const scoreMatch = content.match(/(?:flow\s*score|score)[^\d]*(\d{1,3})/i) ?? content.match(/\b(\d{1,3})\s*\/\s*100\b/);
  const rawScore = scoreMatch ? Number(scoreMatch[1]) : 0;
  const score = Math.max(0, Math.min(100, Number.isFinite(rawScore) ? rawScore : 0));
  const coachingNote = content
    .replace(/(?:flow\s*score|score)[^\n.]*?(\d{1,3})(?:\s*\/\s*100)?[.\n-]*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    score,
    coachingNote: coachingNote || "Keep your next answer tighter by slowing your transitions and replacing fillers with a brief intentional pause.",
  };
}

async function transcribeAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-large-v3-turbo");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGroqApiKey()}`,
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

async function analyzeTranscript(transcript: string): Promise<FlowAnalysis> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGroqApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a speech fluency coach. Analyze this transcript for hesitations, filler words, clarity, and confidence. Return a Flow Score 0-100 and one actionable coaching note in 2 sentences max.",
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
  return parseFlowAnalysis(content);
}

async function downloadTelegramVoice(bot: Telegraf["telegram"], fileId: string): Promise<File> {
  const fileLink = await bot.getFileLink(fileId);
  const response = await fetch(fileLink);

  if (!response.ok) {
    throw new Error(`Telegram voice download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new File([buffer], "telegram-voice.ogg", { type: "audio/ogg" });
}

async function insertTelegramSession(input: {
  userId: string;
  mode: SessionMode;
  transcript: string;
  flowScore: number;
  coachingNote: string;
  durationSec: number;
}) {
  const today = formatLocalDate(new Date());
  const { data, error } = await supabaseServer
    .from("sessions")
    .insert({
      user_id: input.userId,
      mode: input.mode,
      transcript: input.transcript,
      flow_score: input.flowScore,
      analysis_feedback: input.coachingNote,
      completed: true,
      scoring_version: "1.0",
      duration: input.durationSec,
      speaking_time: input.durationSec,
      pauses: null,
      words: countWords(input.transcript),
    })
    .select("id")
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

  return String(data.id);
}

async function replyWithPrompt(ctx: Context, telegramId?: number) {
  if (telegramId) {
    lastInteractionByTelegramId.set(telegramId, "prompt");
  }

  await ctx.reply(getRandomPrompt(), promptReadyKeyboard);
}

async function replyWithStatus(ctx: Context, telegramId: number) {
  const connection = await getTelegramConnection(telegramId);
  if (!connection) {
    await ctx.reply(`Connect your account first -> ${getConnectUrl(telegramId)}`, replyKeyboard);
    return;
  }

  const [{ data: streak }, { data: session }] = await Promise.all([
    supabaseServer
      .from("streaks")
      .select("current_streak")
      .eq("user_id", connection.userId)
      .maybeSingle(),
    supabaseServer
      .from("sessions")
      .select("flow_score")
      .eq("user_id", connection.userId)
      .not("flow_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  await ctx.reply(
    `Current streak: ${Number(streak?.current_streak ?? 0)} day(s)\nLast Flow Score: ${
      session?.flow_score ?? "No scored sessions yet"
    }`,
    replyKeyboard,
  );
}

async function handleVoiceMessage(ctx: Context & { message: { voice: { file_id: string; duration?: number } } }, telegramId: number) {
  const connection = await getTelegramConnection(telegramId);
  if (!connection) {
    await ctx.reply(`Connect your account first -> ${getConnectUrl(telegramId)}`);
    return;
  }

  await ctx.reply("Got it. Analyzing your voice note now...");

  try {
    const mode = getSessionMode(telegramId);
    const voice = ctx.message.voice;
    const file = await downloadTelegramVoice(ctx.telegram, voice.file_id);
    const transcript = await transcribeAudio(file);

    if (!transcript) {
      await ctx.reply("I could not detect enough speech in that voice note. Try one more with a little more volume.");
      return;
    }

    const analysis = await analyzeTranscript(transcript);
    const sessionId = await insertTelegramSession({
      userId: connection.userId,
      mode,
      transcript,
      flowScore: analysis.score,
      coachingNote: analysis.coachingNote,
      durationSec: estimateDurationSec(voice.duration),
    });

    await ctx.reply(
      `🎯 Flow Score: ${analysis.score}/100\n💬 ${analysis.coachingNote}`,
      getSessionActions(mode, sessionId),
    );
  } catch (error) {
    console.error("Telegram voice handling failed", error);
    await ctx.reply("I hit an issue analyzing that voice note. Please try again in a moment.");
  }
}

export function createTelegramBot() {
  const bot = new Telegraf(getBotToken());

  bot.start(async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.reply("Welcome to No Pause. Open nopause.org/connect from Telegram to connect your account.", replyKeyboard);
      return;
    }

    await ctx.reply(
      `Welcome to No Pause. Connect your account here:\n${getConnectUrl(telegramId)}\n\nThen send me a voice message to get a Flow Score.`,
      replyKeyboard,
    );
  });

  bot.command("status", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.command("prompt", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    await replyWithPrompt(ctx, telegramId ?? undefined);
  });

  bot.hears(FREE_SPEAKING_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      lastInteractionByTelegramId.set(telegramId, "free_speaking");
    }

    await ctx.reply("Go ahead, I'm listening 🎤", replyKeyboard);
  });

  bot.hears(MY_STATS_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.hears(GET_PROMPT_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    await replyWithPrompt(ctx, telegramId ?? undefined);
  });

  bot.hears(ABOUT_LABEL, async (ctx) => {
    await ctx.reply(
      `📊 NoPause scores your speech on:
- Flow Score (0–100) — fluency & rhythm
- Hesitations Per Minute — um, uh, pauses
- Filler words — like, you know, basically...

Speak naturally. The bot analyzes and logs every session to your NoPause account.
nopause.org`,
      replyKeyboard,
    );
  });

  bot.action(PROMPT_READY_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      lastInteractionByTelegramId.set(telegramId, "prompt");
    }

    await ctx.answerCbQuery("Prompt mode set. Send a voice note when you're ready.");
  });

  bot.action(TRY_AGAIN_PROMPT_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    await ctx.answerCbQuery();
    await replyWithPrompt(ctx, telegramId ?? undefined);
  });

  bot.action(TRY_AGAIN_FREE_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      lastInteractionByTelegramId.set(telegramId, "free_speaking");
    }

    await ctx.answerCbQuery();
    await ctx.reply("Go ahead, I'm listening 🎤", replyKeyboard);
  });

  bot.on("voice", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    void handleVoiceMessage(ctx, telegramId);
  });

  bot.catch((error) => {
    console.error("Telegram bot error", error);
  });

  return bot;
}
