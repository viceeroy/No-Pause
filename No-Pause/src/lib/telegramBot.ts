import { Markup, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { calculateFlowScore } from "../features/practice/lib/analyzer/scoring.js";
import { getTelegramConnection } from "./telegramAuth.js";
import { supabaseServer } from "./supabaseServer.js";

const SITE_URL = "https://nopause.org";
const TELEGRAM_BOT_USERNAME = "NoPauseAI_bot";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CHALLENGE_LABEL = "⚔️ Challenge";
const MY_STATS_LABEL = "📈 My Stats";
const GET_PROMPT_LABEL = "💡 Get Prompt";
const ABOUT_LABEL = "ℹ️ About";
const CHANGE_PROMPT_ACTION = "change_prompt";
const CHANGE_GROUP_TOPIC_ACTION = "change_group_topic";
const SPEAK_GROUP_TOPIC_ACTION = "speak_group_topic";
const SHARE_TO_GROUP_ACTION = "share_to_group";
const SEND_CHALLENGE_RESULT_ACTION = "send_challenge_result";
const TRY_AGAIN_ACTION = "try_again:free_speaking";
const AI_FEEDBACK_ACTION_PREFIX = "ai_feedback:";
const sessionTranscriptsByTelegramId = new Map<number, Map<string, string>>();
const lastPromptByTelegramId = new Map<number, string>();
const groupChallengeTopicsByMessage = new Map<string, string>();
const pendingGroupChallengesByTelegramId = new Map<number, GroupChallengePending>();
const groupChallengeResultsByTelegramId = new Map<number, GroupChallengeResult>();
const creatorUsernameByChallengeId = new Map<string, string>();
const pendingFriendChallengesByTelegramId = new Map<number, FriendChallengePending>();
const friendChallengeResultsByTelegramId = new Map<number, FriendChallengeResult>();

const CHALLENGES_TABLE_SQL = `create table if not exists public.challenges (
  id text primary key,
  topic text not null,
  creator_telegram_id bigint not null,
  creator_score integer,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);`;

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
  "Should everyone learn how to tell a good story?",
  "Is it better to plan your life carefully or leave room for surprise?",
  "Should companies shorten meetings by default?",
  "Is silence in conversation awkward or useful?",
  "Should people practice disagreeing more respectfully?",
  "Is curiosity more important than discipline?",
  "Should public speaking be judged more on clarity or charisma?",
  "Is it better to speak slowly and precisely or quickly and energetically?",
  "Should adults keep learning new hobbies even when they are busy?",
  "Is confidence built more through preparation or repeated exposure?",
];

type FlowAnalysis = {
  flowScore: number;
  hesitationCount: number;
  speakingTimeSec: number;
  isCompleted: boolean;
};

type GroupChallengePending = {
  groupId: number;
  messageId: number;
  topic: string;
  username: string;
};

type GroupChallengeResult = GroupChallengePending & {
  analysis: FlowAnalysis;
  resultText?: string;
};

type FriendChallengeRecord = {
  id: string;
  topic: string;
  creator_telegram_id: number;
  creator_score: number | null;
  status: string;
  created_at: string | null;
};

type FriendChallengePending = {
  challengeId: string;
  topic: string;
  creatorTelegramId: number;
  creatorUsername: string;
  creatorScore: number | null;
};

type FriendChallengeResult = FriendChallengePending & {
  friendUsername: string;
  analysis: FlowAnalysis;
};

type StatsSession = {
  id: string;
  created_at: string | null;
  duration: number | null;
  speaking_time: number | null;
  pauses: number | null;
  words: number | null;
  flow_score: number | null;
  mode: string | null;
  completed: boolean | null;
  hesitation_log: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
  transcript: string | null;
  analysis_feedback: string | null;
};

const STATS_SESSION_LIMIT = 15;

const replyKeyboard = Markup.keyboard([
  [CHALLENGE_LABEL, MY_STATS_LABEL, GET_PROMPT_LABEL],
  [ABOUT_LABEL],
]).resize();

const changePromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Change Prompt", CHANGE_PROMPT_ACTION),
]);

const groupChallengeKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("🗣 Speak", SPEAK_GROUP_TOPIC_ACTION),
    Markup.button.callback("🔄 Change Topic", CHANGE_GROUP_TOPIC_ACTION),
  ],
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

function isGroupChat(ctx: Context): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function getTelegramUsername(ctx: Context): string {
  return ctx.from?.username ? `@${ctx.from.username}` : "@there";
}

function getPlainTelegramUsername(ctx: Context): string {
  return ctx.from?.username ?? String(ctx.from?.id ?? "there");
}

function createChallengeId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function getChallengeDeepLink(challengeId: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=challenge_${encodeURIComponent(challengeId)}`;
}

function getTelegramShareUrl(input: { url: string; text?: string }): string {
  const params = new URLSearchParams({ url: input.url });
  if (input.text) {
    params.set("text", input.text);
  }

  return `https://t.me/share/url?${params.toString()}`;
}

function getStartPayload(ctx: Context): string {
  const text = "text" in (ctx.message ?? {}) ? String(ctx.message.text ?? "") : "";
  const [, payload = ""] = text.split(/\s+/, 2);
  return payload.trim();
}

function isMissingChallengesTableError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return maybeError?.code === "42P01" || maybeError?.message?.includes("challenges") === true;
}

function getChallengesTableMissingMessage(): string {
  return `I could not find the Supabase challenges table. Create it with:\n\n<pre>${escapeTelegramHtml(CHALLENGES_TABLE_SQL)}</pre>`;
}

function getMessageTopicKey(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`;
}

function getGroupChallengeMessage(topic: string): string {
  return `🎤 NoPause is here and ready to listen! Who wants to practice?\n\n<b>Topic:</b> ${escapeTelegramHtml(topic)}`;
}

function getPrivateChallengeMessage(topic: string): string {
  return `🎤 <b>Group Challenge Topic</b>\n\n${escapeTelegramHtml(topic)}\n\nSend me a voice note when you're ready.`;
}

function getGroupResultText(input: {
  username: string;
  topic: string;
  analysis: FlowAnalysis;
}): string {
  return `${input.username} spoke about: ${input.topic}\nFlow Score: ${input.analysis.flowScore} | Pauses: ${input.analysis.hesitationCount} | Speaking time: ${input.analysis.speakingTimeSec}s`;
}

function getGroupShareResultMessage(input: {
  firstName: string;
  username?: string;
  analysis: FlowAnalysis;
}): string {
  const usernameText = input.username ? `(@${escapeTelegramHtml(input.username)})` : "";
  const nameLine = [escapeTelegramHtml(input.firstName), usernameText].filter(Boolean).join(" ");

  return `🎤 <b>Group Challenge Result</b>\n\n${nameLine}\n\n<b>Flow Score:</b> ${input.analysis.flowScore}\n<b>Pauses:</b> ${input.analysis.hesitationCount}\n<b>Speaking time:</b> ${input.analysis.speakingTimeSec}s`;
}

function getResultShareUrl(resultText: string): string {
  return getTelegramShareUrl({ url: SITE_URL, text: resultText });
}

function getGroupChallengeResultActions(resultText: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📤 Share to Group", SHARE_TO_GROUP_ACTION),
      Markup.button.url("👥 Share to Friends", getResultShareUrl(resultText)),
    ],
    [Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION)],
  ]);
}

function getChallengeShareActions(challengeId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "📨 Share Challenge",
        getTelegramShareUrl({
          url: getChallengeDeepLink(challengeId),
          text: "I challenged you on NoPause. Tap to accept.",
        }),
      ),
    ],
  ]);
}

function getFriendChallengeResultActions(creatorUsername: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`📤 Send Result to @${creatorUsername}`, SEND_CHALLENGE_RESULT_ACTION)],
  ]);
}

function getChallengeResultMessage(input: { topic: string; analysis: FlowAnalysis }): string {
  return `⚔️ <b>Challenge Result</b>\n\n<b>Topic:</b> ${escapeTelegramHtml(input.topic)}\n<b>Flow Score:</b> ${input.analysis.flowScore}\n<b>Pauses:</b> ${input.analysis.hesitationCount}\n<b>Speaking time:</b> ${input.analysis.speakingTimeSec}s`;
}

function getChallengeCreatorNotification(input: FriendChallengeResult): string {
  const friend = escapeTelegramHtml(input.friendUsername);
  const topic = escapeTelegramHtml(input.topic);
  if (input.creatorScore === null || input.creatorScore === undefined) {
    return `⚔️ @${friend} completed your challenge!\n<b>Topic:</b> ${topic}\n<b>Their Flow Score:</b> ${input.analysis.flowScore}\n\nSend a voice note to compete! 🎤`;
  }

  return `⚔️ @${friend} accepted your challenge!\n<b>Topic:</b> ${topic}\n<b>Their Flow Score:</b> ${input.analysis.flowScore} | <b>Yours:</b> ${input.creatorScore}`;
}

function getConnectUrl(telegramId: number): string {
  return `${SITE_URL}/connect?tg=${encodeURIComponent(String(telegramId))}`;
}

function getRandomPrompt(previousPrompt?: string): string {
  if (opinionPrompts.length <= 1) {
    return opinionPrompts[0] ?? "Talk about something you care about.";
  }

  let prompt = opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
  while (prompt === previousPrompt) {
    prompt = opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
  }

  return prompt;
}

function getSessionActions(sessionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION),
      Markup.button.callback("🤖 AI Feedback", `${AI_FEEDBACK_ACTION_PREFIX}${sessionId}`),
    ],
    [Markup.button.url("📊 View on NoPause", SITE_URL)],
  ]);
}

const groupTryAgainKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION),
]);

const openNoPauseKeyboard = Markup.inlineKeyboard([
  [Markup.button.url("📊 Open NoPause", SITE_URL)],
]);

function estimateDurationSec(voiceDuration?: number): number {
  if (!voiceDuration || voiceDuration < 1) {
    return 1;
  }

  return Math.round(voiceDuration);
}

function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter(Boolean).length;
}

function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function averageFlowScore(sessions: StatsSession[]): number | null {
  const scores = sessions
    .map((session) => Number(session.flow_score))
    .filter((score) => Number.isFinite(score));

  if (scores.length === 0) {
    return null;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function getScoredSessions(sessions: StatsSession[]) {
  return sessions.filter((session) => session.flow_score !== null && session.flow_score !== undefined);
}

function getWeightedAverageFlowScore(sessions: StatsSession[]): number {
  const scoredSessions = getScoredSessions(sessions);
  const totalScoreWeight = scoredSessions.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const weightedScore = scoredSessions.reduce(
    (sum, session) => sum + Number(session.flow_score || 0) * Number(session.duration || 0),
    0,
  );

  return totalScoreWeight > 0 ? Math.round(weightedScore / totalScoreWeight) : 0;
}

function formatAverageFlowScore(score: number | null): string {
  return score === null ? "N/A" : String(score);
}

function normalizeStatsMode(mode: string | null): "free" | "lemon" | "topic" | null {
  const normalizedMode = (mode ?? "").toLowerCase();
  if (normalizedMode === "free" || normalizedMode === "free_speaking" || normalizedMode === "free-speak") {
    return "free";
  }
  if (normalizedMode === "lemon") {
    return "lemon";
  }
  if (normalizedMode === "topic") {
    return "topic";
  }
  return null;
}

function getPracticeTimeParts(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  return {
    minutes: Math.floor(safeSeconds / 60),
    seconds: safeSeconds % 60,
  };
}

function formatRelativeDate(dateText: string | null): string {
  if (!dateText) {
    return "N/A";
  }

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.max(0, Math.floor((todayStart - dateStart) / 86_400_000));

  if (daysAgo === 0) {
    return "today";
  }
  if (daysAgo === 1) {
    return "yesterday";
  }

  return `${daysAgo} days ago`;
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
      mode: "free",
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

async function createFriendChallenge(input: {
  id: string;
  topic: string;
  creatorTelegramId: number;
}): Promise<FriendChallengeRecord> {
  const { data, error } = await supabaseServer
    .from("challenges")
    .insert({
      id: input.id,
      topic: input.topic,
      creator_telegram_id: input.creatorTelegramId,
      creator_score: null,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("id, topic, creator_telegram_id, creator_score, status, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as FriendChallengeRecord;
}

async function getFriendChallenge(challengeId: string): Promise<FriendChallengeRecord | null> {
  const { data, error } = await supabaseServer
    .from("challenges")
    .select("id, topic, creator_telegram_id, creator_score, status, created_at")
    .eq("id", challengeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as FriendChallengeRecord | null;
}

async function updateFriendChallengeCreatorScore(challengeId: string, score: number) {
  const { error } = await supabaseServer
    .from("challenges")
    .update({
      creator_score: score,
      status: "completed",
    })
    .eq("id", challengeId);

  if (error) {
    throw error;
  }
}

async function replyWithPrompt(ctx: Context) {
  const telegramId = getTelegramId(ctx);
  const prompt = getRandomPrompt(telegramId ? lastPromptByTelegramId.get(telegramId) : undefined);
  if (telegramId) {
    lastPromptByTelegramId.set(telegramId, prompt);
  }

  const message = isGroupChat(ctx) ? `💬 Prompt for ${getTelegramUsername(ctx)}:\n${prompt}` : prompt;
  await ctx.reply(message, changePromptKeyboard);
}

async function replyWithStatus(ctx: Context, telegramId: number) {
  const connection = await getTelegramConnection(telegramId);
  if (!connection) {
    await ctx.reply(`Connect your account first -> ${getConnectUrl(telegramId)}`, replyKeyboard);
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
    console.error("Telegram stats lookup failed", { streakError, sessionsError });
    await ctx.reply("I could not load your stats right now. Please try again in a moment.", replyKeyboard);
    return;
  }

  const records = (sessions ?? []) as StatsSession[];
  if (records.length === 0) {
    await ctx.reply("No sessions yet. Send a voice message to get started 🎤", replyKeyboard);
    return;
  }

  const scoredSessions = getScoredSessions(records);
  const totalSeconds = records.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const practiceTime = getPracticeTimeParts(totalSeconds);
  const overallFlow = getWeightedAverageFlowScore(records);
  const bestScore = scoredSessions
    .map((session) => Number(session.flow_score))
    .filter((score) => Number.isFinite(score))
    .reduce((best, score) => Math.max(best, score), 0);
  const lastSessionDate =
    records
      .map((session) => session.created_at)
      .filter((createdAt): createdAt is string => Boolean(createdAt))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const sessionsByMode = {
    free: records.filter((session) => normalizeStatsMode(session.mode) === "free"),
    lemon: records.filter((session) => normalizeStatsMode(session.mode) === "lemon"),
    topic: records.filter((session) => normalizeStatsMode(session.mode) === "topic"),
  };

  await ctx.reply(
    `📊 <b>Your NoPause Stats</b>\n\n🔥 <b>Streak:</b> ${Number(streak?.current_streak ?? 0)}/${Number(streak?.longest_streak ?? 0)} day(s)\n🎯 <b>Overall Flow:</b> ${overallFlow}\n📋 <b>Scored Sessions:</b> ${scoredSessions.length}\n🕐 <b>Practice Time:</b> ${practiceTime.minutes}m ${practiceTime.seconds}s\n\n📈 <b>Practice Breakdown:</b>\n- <b>Free Speaking:</b> ${sessionsByMode.free.length} sessions, avg flow ${formatAverageFlowScore(averageFlowScore(sessionsByMode.free))}\n- <b>Lemon:</b> ${sessionsByMode.lemon.length} sessions, avg flow ${formatAverageFlowScore(averageFlowScore(sessionsByMode.lemon))}\n- <b>Topic:</b> ${sessionsByMode.topic.length} sessions, avg flow ${formatAverageFlowScore(averageFlowScore(sessionsByMode.topic))}\n\n🏆 <b>Best Flow Score:</b> ${bestScore}\n📅 <b>Last session:</b> ${formatRelativeDate(lastSessionDate)}`,
    { ...replyKeyboard, parse_mode: "HTML" },
  );
}

async function replyWithNewFriendChallenge(ctx: Context, telegramId: number) {
  const topic = getRandomPrompt(lastPromptByTelegramId.get(telegramId));
  const challengeId = createChallengeId();

  try {
    await createFriendChallenge({
      id: challengeId,
      topic,
      creatorTelegramId: telegramId,
    });
    creatorUsernameByChallengeId.set(challengeId, getPlainTelegramUsername(ctx));
    lastPromptByTelegramId.set(telegramId, topic);

    await ctx.reply(
      `⚔️ Challenge your friends on this topic:\n'${escapeTelegramHtml(topic)}'`,
      {
        ...getChallengeShareActions(challengeId),
        parse_mode: "HTML",
      },
    );
  } catch (error) {
    console.error("Telegram challenge creation failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.reply("I could not create a challenge right now. Please try again in a moment.", replyKeyboard);
  }
}

async function handleChallengeDeepLink(ctx: Context, telegramId: number, challengeId: string): Promise<boolean> {
  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge) {
      await ctx.reply("I could not find that challenge. Ask your friend to send a fresh challenge link.", replyKeyboard);
      return true;
    }

    let creatorUsername = creatorUsernameByChallengeId.get(challengeId);
    if (!creatorUsername) {
      try {
        const creatorChat = (await ctx.telegram.getChat(Number(challenge.creator_telegram_id))) as { username?: string };
        creatorUsername = creatorChat.username;
      } catch (error) {
        console.error("Telegram creator username lookup failed", error);
      }
    }
    creatorUsername ??= String(challenge.creator_telegram_id);
    pendingFriendChallengesByTelegramId.set(telegramId, {
      challengeId: challenge.id,
      topic: challenge.topic,
      creatorTelegramId: Number(challenge.creator_telegram_id),
      creatorUsername,
      creatorScore: challenge.creator_score,
    });

    await ctx.reply(
      `@${escapeTelegramHtml(creatorUsername)} challenged you!\n<b>Topic:</b> ${escapeTelegramHtml(challenge.topic)}\nSend a voice note to accept 🎤`,
      { parse_mode: "HTML" },
    );
    return true;
  } catch (error) {
    console.error("Telegram challenge deep link failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return true;
    }

    await ctx.reply("I could not load that challenge right now. Please try again in a moment.", replyKeyboard);
    return true;
  }
}

async function handleVoiceMessage(ctx: Context & { message: { voice: { file_id: string; duration?: number } } }, telegramId: number) {
  const pendingFriendChallenge = pendingFriendChallengesByTelegramId.get(telegramId);
  const pendingGroupChallenge = pendingGroupChallengesByTelegramId.get(telegramId);
  const connection = await getTelegramConnection(telegramId);
  const groupChat = isGroupChat(ctx);
  const username = getTelegramUsername(ctx);
  if (!connection && !groupChat && !pendingGroupChallenge && !pendingFriendChallenge) {
    await ctx.reply(`Connect your account first -> ${getConnectUrl(telegramId)}`);
    return;
  }

  if (!connection && groupChat) {
    await ctx.reply(`${username} connect your account first → t.me/NoPauseAI_bot`);
  } else {
    await ctx.reply("Got it. Analyzing your voice note now...");
  }

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
    const sessionId = connection
      ? await insertTelegramSession({
        userId: connection.userId,
        transcript,
        analysis,
      })
      : null;

    if (sessionId) {
      storeSessionTranscript(telegramId, sessionId, transcript);
    }

    if (groupChat) {
      await ctx.reply(
        `🎤 ${username}\nFlow Score: ${analysis.flowScore}\nPauses: ${analysis.hesitationCount}\nSpeaking time: ${analysis.speakingTimeSec}s`,
        groupTryAgainKeyboard,
      );
      return;
    }

    if (pendingFriendChallenge) {
      pendingFriendChallengesByTelegramId.delete(telegramId);

      if (pendingFriendChallenge.creatorTelegramId === telegramId) {
        try {
          await updateFriendChallengeCreatorScore(pendingFriendChallenge.challengeId, analysis.flowScore);
        } catch (error) {
          console.error("Telegram challenge creator score update failed", error);
          if (isMissingChallengesTableError(error)) {
            await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
            return;
          }
        }

        await ctx.reply(getChallengeResultMessage({ topic: pendingFriendChallenge.topic, analysis }), {
          parse_mode: "HTML",
        });
        return;
      }

      friendChallengeResultsByTelegramId.set(telegramId, {
        ...pendingFriendChallenge,
        friendUsername: getPlainTelegramUsername(ctx),
        analysis,
      });

      await ctx.reply(getChallengeResultMessage({ topic: pendingFriendChallenge.topic, analysis }), {
        ...getFriendChallengeResultActions(pendingFriendChallenge.creatorUsername),
        parse_mode: "HTML",
      });
      return;
    }

    if (pendingGroupChallenge) {
      const resultText = getGroupResultText({
        username: pendingGroupChallenge.username,
        topic: pendingGroupChallenge.topic,
        analysis,
      });

      groupChallengeResultsByTelegramId.set(telegramId, {
        ...pendingGroupChallenge,
        analysis,
        resultText,
      });
      pendingGroupChallengesByTelegramId.delete(telegramId);

      await ctx.reply(
        `🎤 <b>Group Challenge Result</b>\n\n<b>Topic:</b> ${escapeTelegramHtml(pendingGroupChallenge.topic)}\n<b>Flow Score:</b> ${analysis.flowScore}\n<b>Pauses:</b> ${analysis.hesitationCount}\n<b>Speaking time:</b> ${analysis.speakingTimeSec}s\n\n📝 <b>Transcript</b>\n${escapeTelegramHtml(transcript)}`,
        {
          ...getGroupChallengeResultActions(resultText),
          parse_mode: "HTML",
        },
      );
      return;
    }

    await ctx.reply(
      `🎤 <b>Free Speaking Result</b>\n\n<b>Flow Score:</b> ${analysis.flowScore}\n<b>Pauses:</b> ${analysis.hesitationCount}\n<b>Speaking time:</b> ${analysis.speakingTimeSec}s\n\n📝 <b>Transcript</b>\n${escapeTelegramHtml(transcript)}`,
      { ...getSessionActions(String(sessionId)), parse_mode: "HTML" },
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

    const startPayload = getStartPayload(ctx);
    if (startPayload.startsWith("challenge_")) {
      const handled = await handleChallengeDeepLink(ctx, telegramId, startPayload.replace(/^challenge_/, ""));
      if (handled) return;
    }

    await ctx.reply(
      `Welcome to No Pause. Connect your account here:\n${getConnectUrl(telegramId)}\n\nThen send me a voice message to get a Flow Score.`,
      replyKeyboard,
    );
    await ctx.reply("Open your NoPause dashboard:", openNoPauseKeyboard);
  });

  bot.command("status", async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply("Stats are private. Open @NoPauseAI_bot directly to view your stats.");
      return;
    }

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.command("prompt", async (ctx) => {
    await replyWithPrompt(ctx);
  });

  bot.command("nopause", async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply("Go ahead — send a voice note!", replyKeyboard);
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const prompt = getRandomPrompt();
    const sentMessage = await ctx.reply(getGroupChallengeMessage(prompt), {
      ...groupChallengeKeyboard,
      parse_mode: "HTML",
    });
    groupChallengeTopicsByMessage.set(getMessageTopicKey(chatId, sentMessage.message_id), prompt);
  });

  bot.hears(CHALLENGE_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithNewFriendChallenge(ctx, telegramId);
  });

  bot.hears(MY_STATS_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply("Stats are private. Open @NoPauseAI_bot directly to view your stats.");
      return;
    }

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.hears(GET_PROMPT_LABEL, async (ctx) => {
    await replyWithPrompt(ctx);
  });

  bot.hears(ABOUT_LABEL, async (ctx) => {
    await ctx.reply(
      `ℹ️ <b>About NoPause</b>

NoPause is your Telegram speaking coach.

🎤 <b>Send a voice message</b>
Practice speaking naturally. I transcribe your speech, measure pauses, and give you a Flow Score.

📊 <b>Open NoPause</b>
Review your dashboard and session history.

💡 <b>Get a Prompt</b>
Receive a speaking topic when you want something to practice.

📈 <b>My Stats</b>
Check your streak, practice time, recent sessions, and overall Flow Score.

Your sessions are saved to your connected NoPause account:
nopause.org`,
      { ...replyKeyboard, parse_mode: "HTML" },
    );
  });

  bot.action(CHANGE_GROUP_TOPIC_ACTION, async (ctx) => {
    const chatId = ctx.chat?.id;
    const message = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const messageId = message?.message_id;
    if (!chatId || !messageId) {
      await ctx.answerCbQuery("I could not update this challenge.");
      return;
    }

    const key = getMessageTopicKey(chatId, messageId);
    const prompt = getRandomPrompt(groupChallengeTopicsByMessage.get(key));
    groupChallengeTopicsByMessage.set(key, prompt);

    await ctx.answerCbQuery();
    await ctx.editMessageText(getGroupChallengeMessage(prompt), {
      ...groupChallengeKeyboard,
      parse_mode: "HTML",
    });
  });

  bot.action(SPEAK_GROUP_TOPIC_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const groupId = ctx.chat?.id;
    const message = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const messageId = message?.message_id;
    if (!telegramId || !groupId || !messageId) {
      await ctx.answerCbQuery("I could not start a private challenge.");
      return;
    }

    const topic = groupChallengeTopicsByMessage.get(getMessageTopicKey(groupId, messageId));
    if (!topic) {
      await ctx.answerCbQuery("This challenge topic expired. Run /nopause again.", { show_alert: true });
      return;
    }

    try {
      await ctx.telegram.sendMessage(telegramId, getPrivateChallengeMessage(topic), { parse_mode: "HTML" });
      pendingGroupChallengesByTelegramId.set(telegramId, {
        groupId,
        messageId,
        topic,
        username: getTelegramUsername(ctx),
      });
      await ctx.answerCbQuery("I sent you the topic privately.");
    } catch (error) {
      console.error("Telegram group challenge DM failed", error);
      await ctx.answerCbQuery("Open @NoPauseAI_bot and press Start first, then tap Speak again.", {
        show_alert: true,
      });
    }
  });

  bot.action(SEND_CHALLENGE_RESULT_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const result = telegramId ? friendChallengeResultsByTelegramId.get(telegramId) : undefined;
    if (!telegramId || !result) {
      await ctx.answerCbQuery("I could not find your challenge result.", { show_alert: true });
      return;
    }

    try {
      await ctx.telegram.sendMessage(result.creatorTelegramId, getChallengeCreatorNotification(result), {
        parse_mode: "HTML",
      });

      if (result.creatorScore === null || result.creatorScore === undefined) {
        pendingFriendChallengesByTelegramId.set(result.creatorTelegramId, {
          challengeId: result.challengeId,
          topic: result.topic,
          creatorTelegramId: result.creatorTelegramId,
          creatorUsername: result.creatorUsername,
          creatorScore: result.creatorScore,
        });
      }

      await ctx.answerCbQuery("Sent to the challenger.");
    } catch (error) {
      console.error("Telegram challenge result send failed", error);
      await ctx.answerCbQuery("I could not send that result right now.", { show_alert: true });
    }
  });

  bot.action(SHARE_TO_GROUP_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const session = telegramId ? groupChallengeResultsByTelegramId.get(telegramId) : undefined;
    if (!telegramId || !session?.resultText) {
      await ctx.answerCbQuery("I could not find a recent group challenge result.", { show_alert: true });
      return;
    }

    try {
      await ctx.telegram.sendMessage(
        session.groupId,
        getGroupShareResultMessage({
          firstName: ctx.from?.first_name ?? "Someone",
          username: ctx.from?.username,
          analysis: session.analysis,
        }),
        { parse_mode: "HTML" },
      );
      await ctx.answerCbQuery("Shared to the group.");
    } catch (error) {
      console.error("Telegram share to group failed", error);
      await ctx.answerCbQuery("I could not post to the group right now.", { show_alert: true });
    }
  });

  bot.action(CHANGE_PROMPT_ACTION, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const prompt = getRandomPrompt(telegramId ? lastPromptByTelegramId.get(telegramId) : undefined);
    if (telegramId) {
      lastPromptByTelegramId.set(telegramId, prompt);
    }

    await ctx.answerCbQuery();
    const message = isGroupChat(ctx) ? `💬 Prompt for ${getTelegramUsername(ctx)}:\n${prompt}` : prompt;
    await ctx.editMessageText(message, changePromptKeyboard);
  });

  bot.action(TRY_AGAIN_ACTION, async (ctx) => {
    await ctx.answerCbQuery();
    if (isGroupChat(ctx)) {
      await ctx.reply(`🎤 ${getTelegramUsername(ctx)}, go ahead — send a voice note!`);
      return;
    }

    const telegramId = getTelegramId(ctx);
    const lastGroupResult = telegramId ? groupChallengeResultsByTelegramId.get(telegramId) : undefined;
    if (telegramId && lastGroupResult) {
      pendingGroupChallengesByTelegramId.set(telegramId, {
        groupId: lastGroupResult.groupId,
        messageId: lastGroupResult.messageId,
        topic: lastGroupResult.topic,
        username: lastGroupResult.username,
      });
      await ctx.reply(getPrivateChallengeMessage(lastGroupResult.topic), { parse_mode: "HTML" });
      return;
    }

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
      await ctx.reply(`🤖 <b>AI Feedback</b>\n${escapeTelegramHtml(feedback)}`, { parse_mode: "HTML" });
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
