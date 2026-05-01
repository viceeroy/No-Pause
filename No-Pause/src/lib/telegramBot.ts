import { Markup, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { APP_URL, SCORING_VERSION, TELEGRAM_MIN_DURATION } from "./core/constants.js";
import { getRandomPrompt } from "./core/prompts.js";
import { buildPracticeStats, getStreak, getTelegramSessions } from "./core/queries.js";
import { calculateFlowScore, DEFAULT_PAUSE_THRESHOLD_MS } from "./core/scoring.js";
import { formatLocalDate, insertSession, updateStreak } from "./core/session.js";
import type { SupabaseLike } from "./core/session.js";
import { escapeTelegramHtml } from "./core/utils.js";
import {
  analyzeSpeech as analyzeGroqSpeech,
  getAIFeedback,
  isUsableTranscript,
  transcribeAudioVerbose,
  type TranscribedWord,
} from "../services/groq.js";
import { resolveTelegramUser } from "./core/user.js";
import { supabaseServer } from "../services/supabaseServer.js";

const SITE_URL = APP_URL;
const TELEGRAM_BOT_USERNAME = "NoPauseAI_bot";
const sessionSupabase = supabaseServer as unknown as SupabaseLike;
const CHALLENGE_LABEL = "⚔️ Challenge";
const MY_STATS_LABEL = "📈 My Stats";
const GET_PROMPT_LABEL = "💡 Get Prompt";
const ABOUT_LABEL = "ℹ️ About";
const CHANGE_PROMPT_ACTION = "change_prompt";
const CHANGE_GROUP_TOPIC_ACTION_PREFIX = "cg:";
const SPEAK_GROUP_TOPIC_ACTION_PREFIX = "sg:";
const SHARE_TO_GROUP_ACTION_PREFIX = "shg:";
const SEND_CHALLENGE_RESULT_ACTION_PREFIX = "scr:";
const TRY_GROUP_CHALLENGE_ACTION_PREFIX = "tg:";
const TRY_AGAIN_ACTION = "try_again:free_speaking";
const AI_FEEDBACK_ACTION_PREFIX = "ai_feedback:";

const TELEGRAM_CHALLENGE_TABLES_SQL = `create table if not exists public.challenges (
  id text primary key,
  topic text not null,
  creator_telegram_id bigint not null,
  creator_score integer,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_challenge_state (
  telegram_id bigint primary key,
  challenge_id text not null references public.challenges(id) on delete cascade,
  challenge_type text not null check (challenge_type in ('friend', 'group')),
  group_id bigint,
  group_message_id bigint,
  participant_username text,
  creator_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);`;

type FlowAnalysis = {
  flowScore: number;
  pauseCount: number;
  hesitationCount: number;
  speakingTimeSec: number;
  totalSessionTimeSec: number;
  isCompleted: boolean;
  pauseLog: Array<{ timestamp: number; duration: number; units: number }>;
};

type FriendChallengeRecord = {
  id: string;
  topic: string;
  creator_telegram_id: number;
  creator_score: number | null;
  status: string;
  created_at: string | null;
};

type PendingChallengeRecord = {
  telegram_id: number;
  challenge_id: string;
  challenge_type: "friend" | "group";
  group_id: number | null;
  group_message_id: number | null;
  participant_username: string | null;
  creator_username: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TelegramSessionRecord = {
  id: string;
  transcript: string | null;
  flow_score: number | null;
  pauses: number | null;
  pause_count?: number | null;
  filler_count?: number | null;
  speaking_time: number | null;
  duration: number | null;
  completed: boolean | null;
  hesitation_log: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
};

const STATS_SESSION_LIMIT = 15;

const replyKeyboard = Markup.keyboard([
  [CHALLENGE_LABEL, MY_STATS_LABEL, GET_PROMPT_LABEL],
  [ABOUT_LABEL],
]).resize();

const changePromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Change Prompt", CHANGE_PROMPT_ACTION),
]);

function getGroupChallengeKeyboard(challengeId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🗣 Speak", `${SPEAK_GROUP_TOPIC_ACTION_PREFIX}${challengeId}`),
      Markup.button.callback("🔄 Change Topic", `${CHANGE_GROUP_TOPIC_ACTION_PREFIX}${challengeId}`),
    ],
  ]);
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function getBotToken(): string {
  return requireEnv(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
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
  const message = ctx.message as { text?: unknown } | undefined;
  const text = typeof message?.text === "string" ? message.text : "";
  const [, payload = ""] = text.split(/\s+/, 2);
  return payload.trim();
}

function isMissingChallengesTableError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return maybeError?.code === "42P01" || maybeError?.message?.includes("challenges") === true;
}

function getChallengesTableMissingMessage(): string {
  return `⚠️ <b>Setup needed</b>\n\n<b>Issue:</b>\nI could not find the Supabase Telegram challenge tables.\n\n<b>SQL:</b>\n<pre>${escapeTelegramHtml(TELEGRAM_CHALLENGE_TABLES_SQL)}</pre>`;
}

function getGroupChallengeMessage(topic: string): string {
  return `⚔️ <b>Group Challenge</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(topic)}\n\n<b>Action:</b>\nTap Speak and I will send it privately 🎤`;
}

function getPrivateChallengeMessage(topic: string): string {
  return `⚔️ <b>Group Challenge</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(topic)}\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤`;
}

function getGroupResultText(input: {
  username: string;
  topic: string;
  analysis: FlowAnalysis;
}): string {
  return `🎤 Group Challenge Result\n\nSpeaker:\n${input.username}\n\nTopic:\n${input.topic}\n\nFlow Score:\n${input.analysis.flowScore}\n\nPauses:\n${input.analysis.pauseCount}\n\nHesitations:\n${input.analysis.hesitationCount}\n\nSpeaking time:\n${input.analysis.speakingTimeSec}s`;
}

function getGroupShareResultMessage(input: {
  firstName: string;
  username?: string;
  analysis: FlowAnalysis;
}): string {
  const usernameText = input.username ? `(@${escapeTelegramHtml(input.username)})` : "";
  const nameLine = [escapeTelegramHtml(input.firstName), usernameText].filter(Boolean).join(" ");

  return `🎤 <b>Group Challenge Result</b>\n\n<b>Speaker:</b>\n${nameLine}\n\n<b>Flow Score:</b>\n${input.analysis.flowScore}\n\n<b>Pauses:</b>\n${input.analysis.pauseCount}\n\n<b>Hesitations:</b>\n${input.analysis.hesitationCount}\n\n<b>Speaking time:</b>\n${input.analysis.speakingTimeSec}s`;
}

function getResultShareUrl(resultText: string): string {
  return getTelegramShareUrl({ url: SITE_URL, text: resultText });
}

function getGroupChallengeResultActions(input: {
  resultText: string;
  sessionId: string;
  groupId: number;
  challengeId: string;
}) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📤 Share to Group", `${SHARE_TO_GROUP_ACTION_PREFIX}${input.sessionId}:${input.groupId}`),
      Markup.button.url("👥 Share to Friends", getResultShareUrl(input.resultText)),
    ],
    [Markup.button.callback("🔄 Try Again", `${TRY_GROUP_CHALLENGE_ACTION_PREFIX}${input.challengeId}`)],
  ]);
}

function getChallengeShareActions(challengeId: string, topic: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "⚔️ Share Challenge",
        getTelegramShareUrl({
          url: getChallengeDeepLink(challengeId),
          text: `I challenged you on NoPause! Topic: ${topic}`,
        }),
      ),
    ],
  ]);
}

function getFriendChallengeResultActions(input: {
  creatorUsername: string;
  challengeId: string;
  sessionId: string;
}) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `📤 Send Result to @${input.creatorUsername}`,
        `${SEND_CHALLENGE_RESULT_ACTION_PREFIX}${input.challengeId}:${input.sessionId}`,
      ),
    ],
  ]);
}

function getChallengeResultMessage(input: { topic: string; analysis: FlowAnalysis }): string {
  return `⚔️ <b>Challenge Result</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(input.topic)}\n\n<b>Flow Score:</b>\n${input.analysis.flowScore}\n\n<b>Pauses:</b>\n${input.analysis.pauseCount}\n\n<b>Hesitations:</b>\n${input.analysis.hesitationCount}\n\n<b>Speaking time:</b>\n${input.analysis.speakingTimeSec}s`;
}

function getChallengeCreatorNotification(input: {
  friendUsername: string;
  topic: string;
  analysis: FlowAnalysis;
  creatorScore: number | null;
}): string {
  const friend = escapeTelegramHtml(input.friendUsername);
  const topic = escapeTelegramHtml(input.topic);
  if (input.creatorScore === null || input.creatorScore === undefined) {
    return `⚔️ <b>Challenge update</b>\n\n<b>Friend:</b>\n@${friend}\n\n<b>Topic:</b>\n${topic}\n\n<b>Their Flow Score:</b>\n${input.analysis.flowScore}\n\n<b>Action:</b>\nSend a voice note and let's see what you've got 🎤`;
  }

  return `⚔️ <b>Challenge update</b>\n\n<b>Friend:</b>\n@${friend}\n\n<b>Topic:</b>\n${topic}\n\n<b>Their Flow Score:</b>\n${input.analysis.flowScore}\n\n<b>Your Flow Score:</b>\n${input.creatorScore}`;
}

function getConnectUrl(telegramId: number): string {
  return `${SITE_URL}/connect?tg=${encodeURIComponent(String(telegramId))}`;
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

function getConnectAccountKeyboard(telegramId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.url("🔑 Connect Account", getConnectUrl(telegramId))],
  ]);
}

async function replyWithConnectPrompt(ctx: Context, telegramId: number) {
  await ctx.reply(
    "👋 <b>Connect your account</b>\n\n<b>Status:</b>\nYour NoPause account is not connected yet.\n\n<b>Action:</b>\nConnect first to get your Flow Score.",
    { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" },
  );
}

function estimateDurationSec(voiceDuration?: number): number {
  if (!voiceDuration || voiceDuration < TELEGRAM_MIN_DURATION) {
    return TELEGRAM_MIN_DURATION;
  }

  return Math.round(voiceDuration);
}

function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter(Boolean).length;
}

function getSpeakingTimeSec(words: TranscribedWord[], fallbackDurationSec: number): number {
  const speakingSeconds = words.reduce((sum, word) => {
    const duration = Math.max(0, word.end - word.start);
    return sum + duration;
  }, 0);

  if (speakingSeconds > 0) {
    return Math.max(1, Math.round(speakingSeconds));
  }

  return fallbackDurationSec;
}

function detectPausesFromWordTimestamps(words: TranscribedWord[]) {
  const orderedWords = [...words]
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start)
    .sort((a, b) => a.start - b.start);
  const thresholdSec = DEFAULT_PAUSE_THRESHOLD_MS / 1000;

  return orderedWords.slice(1).reduce(
    (result, word, index) => {
      const previousWord = orderedWords[index];
      const gapSec = Math.max(0, word.start - previousWord.end);
      if (gapSec < thresholdSec) {
        return result;
      }

      const units = Math.floor(gapSec / thresholdSec);
      const duration = Math.round(gapSec * 1000);
      return {
        pauseCount: result.pauseCount + units,
        pauseLog: [
          ...result.pauseLog,
          {
            timestamp: Math.round(word.start * 1000),
            duration,
            units,
          },
        ],
      };
    },
    { pauseCount: 0, pauseLog: [] as Array<{ timestamp: number; duration: number; units: number }> },
  );
}

function formatAverageFlowScore(score: number | null): string {
  return score === null ? "N/A" : String(score);
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

async function transcribeAudio(audioBuffer: ArrayBuffer) {
  const audioFile = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  const transcription = await transcribeAudioVerbose(audioFile);
  console.log("transcript:", transcription.text);
  console.log("transcript words:", transcription.words.length);
  return transcription;
}

async function analyzeTranscript(
  transcript: string,
  words: TranscribedWord[],
  totalSessionTimeSec: number,
): Promise<FlowAnalysis> {
  const { hesitation_count: hesitationCount } = await analyzeGroqSpeech(transcript);
  const speakingTimeSec = getSpeakingTimeSec(words, totalSessionTimeSec);
  const { pauseCount, pauseLog } = detectPausesFromWordTimestamps(words);
  const scoreResult = calculateFlowScore(pauseCount, {
    mode: "free",
    speakingTimeSec,
    totalSessionTimeSec,
    hasSpeechEvidence: transcript.trim().length > 0 || words.length > 0 || pauseCount > 0,
  });

  return {
    flowScore: Number.isFinite(scoreResult.score) ? scoreResult.score : 0,
    pauseCount,
    hesitationCount,
    speakingTimeSec,
    totalSessionTimeSec,
    isCompleted: scoreResult.isCompleted,
    pauseLog,
  };
}

async function generateAiFeedback(transcript: string): Promise<string> {
  return getAIFeedback(transcript);
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
  const sessionId = await insertSession(sessionSupabase, {
    userId: input.userId,
    mode: "free",
    transcript: input.transcript,
    flowScore: input.analysis.flowScore,
    completed: input.analysis.isCompleted,
    scoringVersion: SCORING_VERSION,
    source: "telegram",
    duration: input.analysis.totalSessionTimeSec,
    speakingTime: input.analysis.speakingTimeSec,
    pauses: input.analysis.pauseCount,
    pauseCount: input.analysis.pauseCount,
    fillerCount: input.analysis.hesitationCount,
    hesitationsPerMinute:
      input.analysis.speakingTimeSec > 0
        ? input.analysis.pauseCount / (input.analysis.speakingTimeSec / 60)
        : null,
    hesitationLog: input.analysis.pauseLog,
    words: countWords(input.transcript),
  });

  await updateStreak(sessionSupabase, {
    userId: input.userId,
    localDate: formatLocalDate(new Date()),
  });

  return String(sessionId);
}

async function getTelegramSessionTranscript(input: {
  userId: string;
  sessionId: string;
}): Promise<string | null> {
  const session = await getTelegramSession(input);
  return session?.transcript?.trim() || null;
}

function isMissingSessionAnalysisColumnError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return (
    maybeError?.code === "PGRST204" ||
    maybeError?.code === "42703" ||
    maybeError?.message?.includes("pause_count") === true ||
    maybeError?.message?.includes("filler_count") === true
  );
}

async function getTelegramSession(input: {
  userId: string;
  sessionId: string;
}): Promise<TelegramSessionRecord | null> {
  const { data, error } = await supabaseServer
    .from("sessions")
    .select("id, transcript, flow_score, pauses, pause_count, filler_count, speaking_time, duration, completed, hesitation_log")
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    if (isMissingSessionAnalysisColumnError(error)) {
      const { data: legacyData, error: legacyError } = await supabaseServer
        .from("sessions")
        .select("id, transcript, flow_score, pauses, speaking_time, duration, completed, hesitation_log")
        .eq("id", input.sessionId)
        .eq("user_id", input.userId)
        .maybeSingle();

      if (legacyError) {
        throw legacyError;
      }

      return legacyData as TelegramSessionRecord | null;
    }

    throw error;
  }

  return data as TelegramSessionRecord | null;
}

function getSessionAnalysis(session: TelegramSessionRecord): FlowAnalysis {
  const speakingTimeSec = Math.max(0, Math.round(Number(session.speaking_time ?? 0)));
  const totalSessionTimeSec = Math.max(speakingTimeSec, Math.round(Number(session.duration ?? speakingTimeSec)));

  return {
    flowScore: Math.round(Number(session.flow_score ?? 0)),
    pauseCount: Math.round(Number(session.pause_count ?? session.pauses ?? 0)),
    hesitationCount: Math.round(Number(session.filler_count ?? 0)),
    speakingTimeSec,
    totalSessionTimeSec,
    isCompleted: Boolean(session.completed),
    pauseLog: Array.isArray(session.hesitation_log) ? session.hesitation_log : [],
  };
}

async function createChallenge(input: {
  id: string;
  topic: string;
  creatorTelegramId: number;
  status?: string;
}): Promise<FriendChallengeRecord> {
  const { data, error } = await supabaseServer
    .from("challenges")
    .insert({
      id: input.id,
      topic: input.topic,
      creator_telegram_id: input.creatorTelegramId,
      creator_score: null,
      status: input.status ?? "pending",
      created_at: new Date().toISOString(),
    })
    .select("id, topic, creator_telegram_id, creator_score, status, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as FriendChallengeRecord;
}

async function createFriendChallenge(input: {
  id: string;
  topic: string;
  creatorTelegramId: number;
}): Promise<FriendChallengeRecord> {
  return createChallenge(input);
}

async function createGroupChallenge(input: {
  id: string;
  topic: string;
  groupId: number;
}): Promise<FriendChallengeRecord> {
  return createChallenge({
    id: input.id,
    topic: input.topic,
    creatorTelegramId: input.groupId,
    status: "group_pending",
  });
}

async function updateChallengeTopic(challengeId: string, topic: string) {
  const { error } = await supabaseServer
    .from("challenges")
    .update({ topic })
    .eq("id", challengeId);

  if (error) {
    throw error;
  }
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

async function upsertPendingChallenge(input: {
  telegramId: number;
  challengeId: string;
  challengeType: "friend" | "group";
  groupId?: number | null;
  groupMessageId?: number | null;
  participantUsername?: string | null;
  creatorUsername?: string | null;
}) {
  const { error } = await supabaseServer
    .from("telegram_challenge_state")
    .upsert(
      {
        telegram_id: input.telegramId,
        challenge_id: input.challengeId,
        challenge_type: input.challengeType,
        group_id: input.groupId ?? null,
        group_message_id: input.groupMessageId ?? null,
        participant_username: input.participantUsername ?? null,
        creator_username: input.creatorUsername ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id" },
    );

  if (error) {
    throw error;
  }
}

async function getPendingChallenge(telegramId: number): Promise<PendingChallengeRecord | null> {
  const { data, error } = await supabaseServer
    .from("telegram_challenge_state")
    .select("telegram_id, challenge_id, challenge_type, group_id, group_message_id, participant_username, creator_username, created_at, updated_at")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PendingChallengeRecord | null;
}

async function deletePendingChallenge(telegramId: number) {
  const { error } = await supabaseServer
    .from("telegram_challenge_state")
    .delete()
    .eq("telegram_id", telegramId);

  if (error) {
    throw error;
  }
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
  const prompt = getRandomPrompt();

  const formattedMessage = isGroupChat(ctx)
    ? `💬 <b>Prompt</b>\n\n<b>For:</b>\n${escapeTelegramHtml(getTelegramUsername(ctx))}\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`
    : `💬 <b>Prompt</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`;
  await ctx.reply(formattedMessage, { ...changePromptKeyboard, parse_mode: "HTML" });
}

async function replyWithStatus(ctx: Context, telegramId: number) {
  const userId = await resolveTelegramUser(telegramId);
  if (!userId) {
    await replyWithConnectPrompt(ctx, telegramId);
    return;
  }
  console.log("resolved user_id:", userId);

  let stats;
  try {
    const [streak, records] = await Promise.all([
      getStreak(userId),
      getTelegramSessions(userId, STATS_SESSION_LIMIT),
    ]);
    stats = buildPracticeStats(records, streak);
  } catch (error) {
    console.error("Telegram stats lookup failed", error);
    await ctx.reply("⚠️ <b>Stats error</b>\n\n<b>Status:</b>\nI could not load your stats right now.\n\n<b>Action:</b>\nPlease try again in a moment.", { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  if (stats.recentSessions.length === 0) {
    await ctx.reply("📊 <b>No sessions yet</b>\n\n<b>Status:</b>\nYou do not have any practice sessions yet.\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤", { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  const practiceTime = getPracticeTimeParts(stats.totalPracticeTime);
  const modeStats = {
    free: stats.modeBreakdown.find((item) => item.mode === "free"),
    lemon: stats.modeBreakdown.find((item) => item.mode === "lemon"),
    topic: stats.modeBreakdown.find((item) => item.mode === "topic"),
  };

  await ctx.reply(
    `📊 <b>Your NoPause Stats</b>\n\n<b>Current streak:</b>\n${stats.currentStreak} day(s)\n\n<b>Best streak:</b>\n${stats.bestStreak} day(s)\n\n<b>Overall Flow:</b>\n${stats.avgFlowScore}\n\n<b>Scored sessions:</b>\n${stats.scoredSessions}\n\n<b>Practice time:</b>\n${practiceTime.minutes}m ${practiceTime.seconds}s\n\n📈 <b>Practice Breakdown</b>\n\n<b>Free Speaking sessions:</b>\n${modeStats.free?.totalSessions ?? 0}\n\n<b>Free Speaking average flow:</b>\n${formatAverageFlowScore(modeStats.free?.avgFlowScore ?? null)}\n\n<b>Lemon sessions:</b>\n${modeStats.lemon?.totalSessions ?? 0}\n\n<b>Lemon average flow:</b>\n${formatAverageFlowScore(modeStats.lemon?.avgFlowScore ?? null)}\n\n<b>Topic sessions:</b>\n${modeStats.topic?.totalSessions ?? 0}\n\n<b>Topic average flow:</b>\n${formatAverageFlowScore(modeStats.topic?.avgFlowScore ?? null)}\n\n🏆 <b>Highlights</b>\n\n<b>Best Flow Score:</b>\n${stats.bestFlowScore}\n\n<b>Last session:</b>\n${formatRelativeDate(stats.lastSessionDate)}`,
    { ...replyKeyboard, parse_mode: "HTML" },
  );
}

async function replyWithNewFriendChallenge(ctx: Context, telegramId: number) {
  const topic = getRandomPrompt();
  const challengeId = createChallengeId();

  try {
    await createFriendChallenge({
      id: challengeId,
      topic,
      creatorTelegramId: telegramId,
    });

    await ctx.reply(
      `⚔️ <b>Challenge your friends</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(topic)}`,
      {
        ...getChallengeShareActions(challengeId, topic),
        parse_mode: "HTML",
      },
    );
  } catch (error) {
    console.error("Telegram challenge creation failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.reply("⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not create a challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.", { ...replyKeyboard, parse_mode: "HTML" });
  }
}

async function handleChallengeDeepLink(ctx: Context, telegramId: number, challengeId: string): Promise<boolean> {
  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge) {
      await ctx.reply("⚠️ <b>Challenge not found</b>\n\n<b>Status:</b>\nI could not find that challenge.\n\n<b>Action:</b>\nAsk your friend to send a fresh challenge link.", { ...replyKeyboard, parse_mode: "HTML" });
      return true;
    }

    let creatorUsername: string | undefined;
    try {
      const creatorChat = (await ctx.telegram.getChat(Number(challenge.creator_telegram_id))) as { username?: string };
      creatorUsername = creatorChat.username;
    } catch (error) {
      console.error("Telegram creator username lookup failed", error);
    }
    creatorUsername ??= String(challenge.creator_telegram_id);
    await upsertPendingChallenge({
      telegramId,
      challengeId: challenge.id,
      challengeType: "friend",
      creatorUsername,
    });

    await ctx.reply(
      `⚔️ <b>Challenge received</b>\n\n<b>From:</b>\n@${escapeTelegramHtml(creatorUsername)}\n\n<b>Topic:</b>\n${escapeTelegramHtml(challenge.topic)}\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤`,
      { parse_mode: "HTML" },
    );
    return true;
  } catch (error) {
    console.error("Telegram challenge deep link failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return true;
    }

    await ctx.reply("⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not load that challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.", { ...replyKeyboard, parse_mode: "HTML" });
    return true;
  }
}

async function handleVoiceMessage(ctx: Context & { message: { voice: { file_id: string; duration?: number } } }, telegramId: number) {
  const userId = await resolveTelegramUser(telegramId);
  const groupChat = isGroupChat(ctx);
  const username = getTelegramUsername(ctx);
  if (!userId) {
    await replyWithConnectPrompt(ctx, telegramId);
    return;
  }

  await ctx.reply("🎧 <b>Voice note received</b>\n\n<b>Status:</b>\nAnalyzing your voice note now.", { parse_mode: "HTML" });

  try {
    const pendingChallenge = groupChat ? null : await getPendingChallenge(telegramId);
    const challenge = pendingChallenge ? await getFriendChallenge(pendingChallenge.challenge_id) : null;
    const voice = ctx.message.voice;
    const audioBuffer = await downloadTelegramVoice(voice.file_id);
    const transcription = await transcribeAudio(audioBuffer);
    const transcript = transcription.text;

    if (!isUsableTranscript(transcript)) {
      await ctx.reply("Couldn't hear anything clearly. Please speak louder and try again 🎤");
      return;
    }

    const totalSessionTimeSec = estimateDurationSec(voice.duration);
    const analysis = await analyzeTranscript(transcript, transcription.words, totalSessionTimeSec);
    const sessionId = await insertTelegramSession({
      userId,
      transcript,
      analysis,
    });

    if (groupChat) {
      await ctx.reply(
        `🎤 <b>Voice Result</b>\n\n<b>Speaker:</b>\n${escapeTelegramHtml(username)}\n\n<b>Flow Score:</b>\n${analysis.flowScore}\n\n<b>Pauses:</b>\n${analysis.pauseCount}\n\n<b>Hesitations:</b>\n${analysis.hesitationCount}\n\n<b>Speaking time:</b>\n${analysis.speakingTimeSec}s`,
        { ...groupTryAgainKeyboard, parse_mode: "HTML" },
      );
      return;
    }

    if (pendingChallenge?.challenge_type === "friend" && challenge) {
      await deletePendingChallenge(telegramId);

      if (Number(challenge.creator_telegram_id) === telegramId) {
        try {
          await updateFriendChallengeCreatorScore(challenge.id, analysis.flowScore);
        } catch (error) {
          console.error("Telegram challenge creator score update failed", error);
          if (isMissingChallengesTableError(error)) {
            await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
            return;
          }
        }

        await ctx.reply(getChallengeResultMessage({ topic: challenge.topic, analysis }), {
          parse_mode: "HTML",
        });
        return;
      }

      const creatorUsername = pendingChallenge.creator_username ?? String(challenge.creator_telegram_id);

      await ctx.reply(getChallengeResultMessage({ topic: challenge.topic, analysis }), {
        ...getFriendChallengeResultActions({
          creatorUsername,
          challengeId: challenge.id,
          sessionId: String(sessionId),
        }),
        parse_mode: "HTML",
      });
      return;
    }

    if (pendingChallenge?.challenge_type === "group" && challenge) {
      await deletePendingChallenge(telegramId);
      const resultText = getGroupResultText({
        username: pendingChallenge.participant_username ?? username,
        topic: challenge.topic,
        analysis,
      });
      const groupId = Number(pendingChallenge.group_id ?? challenge.creator_telegram_id);

      await ctx.reply(
        `⚔️ <b>Group Challenge Result</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(challenge.topic)}\n\n<b>Flow Score:</b>\n${analysis.flowScore}\n\n<b>Pauses:</b>\n${analysis.pauseCount}\n\n<b>Hesitations:</b>\n${analysis.hesitationCount}\n\n<b>Speaking time:</b>\n${analysis.speakingTimeSec}s\n\n📝 <b>Transcript</b>\n\n${escapeTelegramHtml(transcript)}`,
        {
          ...getGroupChallengeResultActions({
            resultText,
            sessionId: String(sessionId),
            groupId,
            challengeId: challenge.id,
          }),
          parse_mode: "HTML",
        },
      );
      return;
    }

    await ctx.reply(
      `🎤 Free Speaking Result\n\nFlow Score: ${analysis.flowScore}\nPauses: ${analysis.pauseCount} | Hesitations: ${analysis.hesitationCount} | Speaking time: ${analysis.speakingTimeSec}s\n\n📝 Transcript:\n${escapeTelegramHtml(transcript)}`,
      { ...getSessionActions(String(sessionId)), parse_mode: "HTML" },
    );
  } catch (error) {
    console.error("Telegram voice handling failed", error);
    await ctx.reply("⚠️ <b>Analysis error</b>\n\n<b>Status:</b>\nI hit an issue analyzing that voice note.\n\n<b>Action:</b>\nPlease try again in a moment.", { parse_mode: "HTML" });
  }
}

export function createTelegramBot() {
  const bot = new Telegraf(getBotToken());

  bot.start(async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.reply("👋 <b>Welcome to NoPause</b>\n\n<b>Status:</b>\nI could not identify your Telegram account.", { parse_mode: "HTML" });
      return;
    }

    const startPayload = getStartPayload(ctx);
    if (startPayload.startsWith("challenge_")) {
      const handled = await handleChallengeDeepLink(ctx, telegramId, startPayload.replace(/^challenge_/, ""));
      if (handled) return;
    }

    await ctx.reply(
      "👋 <b>Welcome to NoPause</b>\n\n<b>What it does:</b>\nTrack your speaking fluency.\nReduce pauses.\nImprove your Flow Score.\n\n<b>Action:</b>\nConnect your account to get started.",
      { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" },
    );
  });

  bot.command("status", async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply("📊 <b>Stats are private</b>\n\n<b>Action:</b>\nOpen @NoPauseAI_bot directly to view your stats.", { parse_mode: "HTML" });
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
      await ctx.reply("🎤 <b>Ready when you are</b>\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤", { ...replyKeyboard, parse_mode: "HTML" });
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const prompt = getRandomPrompt();
    const challengeId = createChallengeId();

    try {
      await createGroupChallenge({
        id: challengeId,
        topic: prompt,
        groupId: chatId,
      });

      await ctx.reply(getGroupChallengeMessage(prompt), {
        ...getGroupChallengeKeyboard(challengeId),
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error("Telegram group challenge creation failed", error);
      if (isMissingChallengesTableError(error)) {
        await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
        return;
      }

      await ctx.reply("⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not create a group challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.", { parse_mode: "HTML" });
    }
  });

  bot.hears(CHALLENGE_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithNewFriendChallenge(ctx, telegramId);
  });

  bot.hears(MY_STATS_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply("📊 <b>Stats are private</b>\n\n<b>Action:</b>\nOpen @NoPauseAI_bot directly to view your stats.", { parse_mode: "HTML" });
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

<b>What it is:</b>
NoPause is your Telegram speaking coach.

🎤 <b>Voice practice</b>

<b>Action:</b>
Practice speaking naturally.
I transcribe your speech.
I measure pauses.
I give you a Flow Score.

📊 <b>Dashboard</b>

<b>Action:</b>
Review your dashboard and session history.

💡 <b>Prompts</b>

<b>Action:</b>
Receive a speaking topic when you want something to practice.

📈 <b>Stats</b>

<b>Action:</b>
Check your streak.
Review your practice time.
See recent sessions.
Track your overall Flow Score.

<b>Account:</b>
Your sessions are saved to your connected NoPause account.

<b>Website:</b>
nopause.org`,
      { ...replyKeyboard, parse_mode: "HTML" },
    );
  });

  bot.action(new RegExp(`^${CHANGE_GROUP_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    const challengeId = ctx.match[1];
    try {
      const challenge = await getFriendChallenge(challengeId);
      if (!challenge) {
        await ctx.answerCbQuery("I could not update this challenge right now.");
        return;
      }

      const prompt = getRandomPrompt(challenge.topic);
      await updateChallengeTopic(challengeId, prompt);

      await ctx.answerCbQuery();
      await ctx.editMessageText(getGroupChallengeMessage(prompt), {
        ...getGroupChallengeKeyboard(challengeId),
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error("Telegram group topic change failed", error);
      await ctx.answerCbQuery("I could not update this challenge right now.", { show_alert: true });
    }
  });

  bot.action(new RegExp(`^${SPEAK_GROUP_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const challengeId = ctx.match[1];
    const message = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const messageId = message?.message_id;
    if (!telegramId || !messageId) {
      await ctx.answerCbQuery("I could not start this challenge right now.");
      return;
    }

    try {
      const challenge = await getFriendChallenge(challengeId);
      if (!challenge) {
        await ctx.answerCbQuery("This challenge topic expired. Run /nopause again.", { show_alert: true });
        return;
      }

      await ctx.telegram.sendMessage(telegramId, getPrivateChallengeMessage(challenge.topic), { parse_mode: "HTML" });
      await upsertPendingChallenge({
        telegramId,
        challengeId: challenge.id,
        challengeType: "group",
        groupId: Number(challenge.creator_telegram_id),
        groupMessageId: messageId,
        participantUsername: getTelegramUsername(ctx),
      });
      await ctx.answerCbQuery("I sent you the topic privately.");
    } catch (error) {
      console.error("Telegram group challenge DM failed", error);
      await ctx.answerCbQuery("Open @NoPauseAI_bot and press Start first. Then tap Speak again.", {
        show_alert: true,
      });
    }
  });

  bot.action(new RegExp(`^${SEND_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const challengeId = ctx.match[1];
    const sessionId = ctx.match[2];
    if (!telegramId) {
      await ctx.answerCbQuery("I could not find your challenge result right now.", { show_alert: true });
      return;
    }

    try {
      const [userId, challenge] = await Promise.all([
        resolveTelegramUser(telegramId),
        getFriendChallenge(challengeId),
      ]);
      if (!userId || !challenge) {
        await ctx.answerCbQuery("I could not find your challenge result right now.", { show_alert: true });
        return;
      }

      const session = await getTelegramSession({ userId, sessionId });
      if (!session) {
        await ctx.answerCbQuery("I could not find your challenge result right now.", { show_alert: true });
        return;
      }

      const analysis = getSessionAnalysis(session);
      const creatorTelegramId = Number(challenge.creator_telegram_id);
      const creatorUsername = String(challenge.creator_telegram_id);

      await ctx.telegram.sendMessage(creatorTelegramId, getChallengeCreatorNotification({
        friendUsername: getPlainTelegramUsername(ctx),
        topic: challenge.topic,
        analysis,
        creatorScore: challenge.creator_score,
      }), {
        parse_mode: "HTML",
      });

      if (challenge.creator_score === null || challenge.creator_score === undefined) {
        await upsertPendingChallenge({
          telegramId: creatorTelegramId,
          challengeId: challenge.id,
          challengeType: "friend",
          creatorUsername,
        });
      }

      await ctx.answerCbQuery("Sent to the challenger.");
    } catch (error) {
      console.error("Telegram challenge result send failed", error);
      await ctx.answerCbQuery("I could not send that result right now.", { show_alert: true });
    }
  });

  bot.action(new RegExp(`^${SHARE_TO_GROUP_ACTION_PREFIX}([^:]+):(-?\\d+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const sessionId = ctx.match[1];
    const groupId = Number(ctx.match[2]);
    if (!telegramId || !Number.isFinite(groupId)) {
      await ctx.answerCbQuery("I could not find a recent group challenge result right now.", { show_alert: true });
      return;
    }

    try {
      const userId = await resolveTelegramUser(telegramId);
      if (!userId) {
        await ctx.answerCbQuery("Connect your account first, then try again.", { show_alert: true });
        return;
      }

      const session = await getTelegramSession({ userId, sessionId });
      if (!session) {
        await ctx.answerCbQuery("I could not find a recent group challenge result right now.", { show_alert: true });
        return;
      }

      await ctx.telegram.sendMessage(
        groupId,
        getGroupShareResultMessage({
          firstName: ctx.from?.first_name ?? "Someone",
          username: ctx.from?.username,
          analysis: getSessionAnalysis(session),
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
    const prompt = getRandomPrompt();

    await ctx.answerCbQuery();
    const message = isGroupChat(ctx)
      ? `💬 <b>Prompt</b>\n\n<b>For:</b>\n${escapeTelegramHtml(getTelegramUsername(ctx))}\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`
      : `💬 <b>Prompt</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`;
    await ctx.editMessageText(message, { ...changePromptKeyboard, parse_mode: "HTML" });
  });

  bot.action(TRY_AGAIN_ACTION, async (ctx) => {
    await ctx.answerCbQuery();
    if (isGroupChat(ctx)) {
      await ctx.reply(
        `🎤 <b>Ready when you are</b>\n\n<b>For:</b>\n${escapeTelegramHtml(getTelegramUsername(ctx))}\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤`,
        { parse_mode: "HTML" },
      );
      return;
    }

    await ctx.reply(
      "🎤 <b>Ready when you are</b>\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤",
      { ...replyKeyboard, parse_mode: "HTML" },
    );
  });

  bot.action(new RegExp(`^${TRY_GROUP_CHALLENGE_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const challengeId = ctx.match[1];
    if (!telegramId) return;

    try {
      const challenge = await getFriendChallenge(challengeId);
      if (!challenge) {
        await ctx.reply("⚠️ <b>Challenge not found</b>\n\n<b>Status:</b>\nI could not find that group challenge anymore.\n\n<b>Action:</b>\nAsk the group to run /nopause again.", { parse_mode: "HTML" });
        return;
      }

      await upsertPendingChallenge({
        telegramId,
        challengeId: challenge.id,
        challengeType: "group",
        groupId: Number(challenge.creator_telegram_id),
        participantUsername: getTelegramUsername(ctx),
      });
      await ctx.reply(getPrivateChallengeMessage(challenge.topic), { parse_mode: "HTML" });
    } catch (error) {
      console.error("Telegram group retry failed", error);
      if (isMissingChallengesTableError(error)) {
        await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
        return;
      }

      await ctx.reply("⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not restart that challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.", { parse_mode: "HTML" });
    }
  });

  bot.action(new RegExp(`^${AI_FEEDBACK_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const sessionId = ctx.match[1];

    if (!telegramId) {
      await ctx.reply("⚠️ <b>Feedback error</b>\n\n<b>Status:</b>\nI could not identify your Telegram account.", { parse_mode: "HTML" });
      return;
    }

    try {
      const userId = await resolveTelegramUser(telegramId);
      if (!userId) {
        await replyWithConnectPrompt(ctx, telegramId);
        return;
      }

      const transcript = await getTelegramSessionTranscript({ userId, sessionId });
      if (!transcript) {
        await ctx.reply(
          "⚠️ <b>Feedback error</b>\n\n<b>Status:</b>\nI could not find the transcript for that session.\n\n<b>Action:</b>\nSend a new voice note and try again.",
          { parse_mode: "HTML" },
        );
        return;
      }

      const feedback = await generateAiFeedback(transcript);
      await ctx.reply(`🤖 <b>AI Feedback</b>\n\n${escapeTelegramHtml(feedback)}`, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Telegram AI feedback failed", error);
      await ctx.reply(
        "⚠️ <b>Feedback error</b>\n\n<b>Status:</b>\nI could not generate feedback right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
        { parse_mode: "HTML" },
      );
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
