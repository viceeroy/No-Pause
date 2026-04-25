import { Markup, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { calculateFlowScore } from "../features/practice/lib/analyzer/scoring.js";
import { getTelegramConnection } from "./telegramAuth.js";
import { supabaseServer } from "./supabaseServer.js";

const SITE_URL = "https://nopause.org";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FREE_SPEAKING_LABEL = "🎤 Free Speaking";
const MY_STATS_LABEL = "📈 My Stats";
const GET_PROMPT_LABEL = "💡 Get Prompt";
const ABOUT_LABEL = "ℹ️ About";
const PROMPT_READY_ACTION = "prompt_ready";
const TRY_AGAIN_ACTION = "try_again:free_speaking";
const AI_FEEDBACK_ACTION_PREFIX = "ai_feedback:";
const sessionTranscriptsByTelegramId = new Map<number, Map<string, string>>();

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
  flowScore: number;
  hesitationCount: number;
  speakingTimeSec: number;
  isCompleted: boolean;
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

function getSessionActions(sessionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION),
      Markup.button.callback("🤖 AI Feedback", `${AI_FEEDBACK_ACTION_PREFIX}${sessionId}`),
    ],
    [Markup.button.url("📊 View on NoPause", `${SITE_URL}/sessions`)],
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

function getHesitationsPerMinute(hesitationCount: number, speakingTimeSec: number): number {
  const speakingMinutes = Math.max(speakingTimeSec / 60, 0.5);
  return hesitationCount / speakingMinutes;
}

function storeSessionTranscript(telegramId: number, sessionId: string, transcript: string) {
  const transcripts = sessionTranscriptsByTelegramId.get(telegramId) ?? new Map<string, string>();
  transcripts.set(sessionId, transcript);
  sessionTranscriptsByTelegramId.set(telegramId, transcripts);
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

async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
  const formData = new FormData();
  const audioFile = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  formData.append("file", audioFile);
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
  console.log("Groq Whisper response:", data);
  const transcript = String(data?.text ?? "").trim();
  console.log("transcript:", transcript);
  return transcript;
}

async function analyzeTranscript(transcript: string, speakingTimeSec: number): Promise<FlowAnalysis> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGroqApiKey()}`,
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

async function generateAiFeedback(transcript: string): Promise<string> {
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
            "You are a speech fluency coach. Give specific, actionable feedback on this speech transcript in 3-4 sentences. Focus on clarity, confidence, and areas to improve.",
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
    throw new Error(`Groq feedback failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const feedback = String(data?.choices?.[0]?.message?.content ?? "").trim();
  return feedback || "I could not generate feedback for that transcript right now.";
}

async function downloadTelegramVoice(fileId: string): Promise<ArrayBuffer> {
  const token = getBotToken();
  const fileResponse = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );

  if (!fileResponse.ok) {
    const errorText = await fileResponse.text();
    throw new Error(`Telegram getFile failed: ${fileResponse.status} ${errorText.slice(0, 200)}`);
  }

  const fileData = await fileResponse.json();
  const filePath = String(fileData?.result?.file_path ?? "");
  if (!fileData?.ok || !filePath) {
    throw new Error(`Telegram getFile returned no file_path: ${JSON.stringify(fileData).slice(0, 200)}`);
  }

  const response = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

  if (!response.ok) {
    throw new Error(`Telegram voice download failed: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  console.log("Telegram voice audio bytes:", audioBuffer.byteLength);
  if (audioBuffer.byteLength === 0) {
    throw new Error("Telegram voice download returned an empty audio buffer");
  }

  return audioBuffer;
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

async function replyWithPrompt(ctx: Context) {
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
    const voice = ctx.message.voice;
    const audioBuffer = await downloadTelegramVoice(voice.file_id);
    const transcript = await transcribeAudio(audioBuffer);

    if (!transcript.trim()) {
      await ctx.reply("Couldn't hear anything. Make sure your mic is on and try again 🎤");
      return;
    }

    const speakingTimeSec = estimateDurationSec(voice.duration);
    const analysis = await analyzeTranscript(transcript, speakingTimeSec);
    const sessionId = await insertTelegramSession({
      userId: connection.userId,
      transcript,
      analysis,
    });
    storeSessionTranscript(telegramId, sessionId, transcript);

    await ctx.reply(
      `🎤 Free Speaking Result\n\n📝 Transcript:\n${transcript}\n\n🎯 Flow Score: ${analysis.flowScore}\n⏸ Pauses: ${analysis.hesitationCount}\n🕐 Speaking time: ${analysis.speakingTimeSec}s`,
      getSessionActions(sessionId),
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
    await replyWithPrompt(ctx);
  });

  bot.hears(FREE_SPEAKING_LABEL, async (ctx) => {
    await ctx.reply("Go ahead, I'm listening 🎤", replyKeyboard);
  });

  bot.hears(MY_STATS_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.hears(GET_PROMPT_LABEL, async (ctx) => {
    await replyWithPrompt(ctx);
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
    await ctx.answerCbQuery("Send a voice note when you're ready.");
  });

  bot.action(TRY_AGAIN_ACTION, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("Go ahead, I'm listening 🎤", replyKeyboard);
  });

  bot.action(new RegExp(`^${AI_FEEDBACK_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const sessionId = ctx.match[1];

    if (!telegramId) {
      await ctx.reply("I could not identify your Telegram account for feedback.");
      return;
    }

    const transcript = sessionTranscriptsByTelegramId.get(telegramId)?.get(sessionId);
    if (!transcript) {
      await ctx.reply("I could not find the transcript for that session in memory. Send a new voice note and try again.");
      return;
    }

    try {
      const feedback = await generateAiFeedback(transcript);
      await ctx.reply(`🤖 AI Feedback\n${feedback}`);
    } catch (error) {
      console.error("Telegram AI feedback failed", error);
      await ctx.reply("I could not generate feedback right now. Please try again in a moment.");
    }
  });

  bot.on("voice", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await handleVoiceMessage(ctx, telegramId);
  });

  bot.catch((error) => {
    console.error("Telegram bot error", error);
  });

  return bot;
}
