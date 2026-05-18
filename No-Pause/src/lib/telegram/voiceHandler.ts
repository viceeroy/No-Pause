import type { Context } from "telegraf";
import {
  DEFAULT_PAUSE_THRESHOLD_LEVEL,
  PAUSE_THRESHOLD_BY_LEVEL,
  SCORING_VERSION,
  TELEGRAM_MIN_DURATION,
  type PauseThresholdLevel,
} from "../core/constants.js";
import { calculateFlowScore } from "../core/scoring.js";
import { formatLocalDate, insertSession, updateStreak, type SupabaseLike } from "../core/session.js";
import { escapeTelegramHtml } from "../core/utils.js";
import {
  generateAiFeedback,
  isUsableTranscript,
} from "../../services/aiFeedback.js";
import {
  DAILY_FEEDBACK_LIMIT,
  DAILY_TRANSCRIPTION_LIMIT,
  consumeApiQuota,
  getQuotaExceededMessage,
  isApiQuotaExceededError,
} from "../../services/apiQuota.js";
import { transcribeAudioWithGroq, type GroqTranscribedWord } from "../../services/groq.js";
import { resolveTelegramUser } from "../core/user.js";
import { supabaseServer } from "../../services/supabaseServer.js";
import {
  claimFriendChallengeResultSend,
  deletePendingChallenge,
  getFriendChallenge,
  getGroupChallengeAttemptCount,
  getPendingChallenge,
  isGroupChallengeExpired,
  isMissingChallengesTableError,
  recordFriendChallengeSubmission,
  recordGroupChallengeAttempt,
  updateFriendChallengeCreatorScore,
  upsertPendingChallenge,
} from "./challenges.js";
import {
  FlowAnalysis,
  getChallengeCreatorNotification,
  getChallengeResultMessage,
  getChallengesTableMissingMessage,
  getConnectAccountKeyboard,
  getFriendChallengeResultActions,
  getGroupChallengeResultActions,
  getGroupShareResultMessage,
  getSessionActions,
  getSpeakingResultMessage,
  groupTryAgainKeyboard,
  MESSAGES,
} from "./constants.js";

const sessionSupabase = supabaseServer as unknown as SupabaseLike;
const MAX_TELEGRAM_VOICE_DURATION_SECONDS = 300;
const TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_MS = 10_000;
const TELEGRAM_AI_FEEDBACK_DEBOUNCE_MS = 30_000;
const TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "AI feedback is temporarily unavailable. Please try again in a moment.";
const TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR = "Telegram AI feedback Supabase call timed out";
const aiFeedbackSessionDebounce = new Map<string, number>();

export type TelegramSessionRecord = {
  id: string;
  transcript: string | null;
  flow_score: number | null;
  pauses: number | null;
  pause_count?: number | null;
  speaking_time: number | null;
  duration: number | null;
  completed: boolean | null;
  hesitation_log: Array<{ timestamp: number; duration: number; units: number; trailing?: boolean }> | null;
};

type VerboseTranscriptionResponse = {
  transcript?: unknown;
  text?: unknown;
  words?: unknown;
};

type TelegramGetFileResponse = {
  ok?: unknown;
  result?: {
    file_path?: unknown;
  };
};

function isPauseThresholdLevel(value: unknown): value is PauseThresholdLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

function getPauseThresholdLevelFromMetadata(metadata: Record<string, unknown> | null | undefined): PauseThresholdLevel {
  if (isPauseThresholdLevel(metadata?.difficulty)) return metadata.difficulty;
  if (isPauseThresholdLevel(metadata?.difficultyLevel)) return metadata.difficultyLevel;
  return DEFAULT_PAUSE_THRESHOLD_LEVEL;
}

async function getUserPauseThresholdMs(userId: string): Promise<number> {
  try {
    const { data, error } = await supabaseServer.auth.admin.getUserById(userId);
    if (error) {
      console.error("Telegram difficulty metadata lookup failed", error);
      return Math.round(PAUSE_THRESHOLD_BY_LEVEL[DEFAULT_PAUSE_THRESHOLD_LEVEL] * 1000);
    }

    const metadata = data.user?.user_metadata as Record<string, unknown> | undefined;
    const level = getPauseThresholdLevelFromMetadata(metadata);
    return Math.round(PAUSE_THRESHOLD_BY_LEVEL[level] * 1000);
  } catch (error) {
    console.error("Telegram difficulty metadata lookup failed", error);
    return Math.round(PAUSE_THRESHOLD_BY_LEVEL[DEFAULT_PAUSE_THRESHOLD_LEVEL] * 1000);
  }
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function getBotToken(): string {
  return requireEnv(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
}

export function getTelegramId(ctx: Context): number | null {
  return ctx.from?.id ?? null;
}

export function isGroupChat(ctx: Context): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

export function getTelegramUsername(ctx: Context): string {
  return ctx.from?.username ? `@${ctx.from.username}` : "@there";
}

export function getPlainTelegramUsername(ctx: Context): string {
  return ctx.from?.username ?? String(ctx.from?.id ?? "there");
}

function getTelegramFirstName(ctx: Context): string {
  return ctx.from?.first_name ?? getPlainTelegramUsername(ctx);
}

function getDebugStackSnippet() {
  return new Error().stack?.split("\n").slice(1, 6).join("\n");
}

export async function replyWithConnectPrompt(ctx: Context, telegramId: number) {
  console.log("Telegram welcome debug", {
    triggerSource: "voiceHandler.ts:replyWithConnectPrompt",
    telegramId,
    stack: getDebugStackSnippet(),
  });
  await ctx.reply(MESSAGES.connectPrompt, { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" });
}

function parseTranscribedWords(words: unknown): GroqTranscribedWord[] {
  if (!Array.isArray(words)) {
    return [];
  }

  return words.flatMap((word) => {
    const maybeWord = word as { word?: unknown; start?: unknown; end?: unknown; no_speech_prob?: unknown };
    const start = Number(maybeWord.start);
    const end = Number(maybeWord.end);
    const noSpeechProb = Number(maybeWord.no_speech_prob);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return [];
    }

    return [{
      word: String(maybeWord.word ?? "").trim(),
      start,
      end,
      ...(Number.isFinite(noSpeechProb) ? { no_speech_prob: noSpeechProb } : {}),
    }];
  });
}

function estimateDurationSec(voiceDuration?: number): number {
  if (!voiceDuration || voiceDuration < TELEGRAM_MIN_DURATION) {
    return TELEGRAM_MIN_DURATION;
  }

  return Math.round(voiceDuration);
}

function isMissingTelegramMessageIdColumnError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return (
    maybeError?.code === "PGRST204" ||
    maybeError?.code === "42703" ||
    maybeError?.message?.includes("telegram_chat_id") === true ||
    maybeError?.message?.includes("telegram_message_id") === true
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter(Boolean).length;
}

function getSpeakingTimeSec(words: GroqTranscribedWord[], fallbackDurationSec: number): number {
  const speakingSeconds = words.reduce((sum, word) => {
    const duration = Math.max(0, word.end - word.start);
    return sum + duration;
  }, 0);

  if (speakingSeconds > 0) {
    return Math.max(1, Math.round(speakingSeconds));
  }

  return fallbackDurationSec;
}

function detectPausesFromWordTimestamps(words: GroqTranscribedWord[], pauseThresholdMs: number) {
  const orderedWords = [...words]
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start)
    .sort((a, b) => a.start - b.start);
  const thresholdSec = pauseThresholdMs / 1000;

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

async function transcribeAudio(audioBuffer: ArrayBuffer) {
  const data = await transcribeAudioWithGroq(audioBuffer) as VerboseTranscriptionResponse;
  const transcript = String(data.transcript ?? data.text ?? "").trim();
  const words = parseTranscribedWords(data.words);
  console.log("transcript words:", words.length);

  return { text: transcript, words };
}

async function analyzeTranscript(
  transcript: string,
  words: GroqTranscribedWord[],
  totalSessionTimeSec: number,
  pauseThresholdMs: number,
): Promise<FlowAnalysis> {
  const speakingTimeSec = getSpeakingTimeSec(words, totalSessionTimeSec);
  const { pauseCount, pauseLog } = detectPausesFromWordTimestamps(words, pauseThresholdMs);
  const scoreResult = calculateFlowScore(pauseCount, {
    speakingTimeSec,
    totalSessionTimeSec,
    hasSpeechEvidence: transcript.trim().length > 0 || words.length > 0 || pauseCount > 0,
  });

  return {
    flowScore: Number.isFinite(scoreResult.score) ? scoreResult.score : 0,
    pauseCount,
    speakingTimeSec,
    totalSessionTimeSec,
    isCompleted: scoreResult.isCompleted,
    pauseLog,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function isTelegramAiFeedbackSupabaseTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR;
}

function claimAiFeedbackSession(sessionId: string): boolean {
  const now = Date.now();
  for (const [trackedSessionId, lastCallbackAt] of aiFeedbackSessionDebounce) {
    if (now - lastCallbackAt >= TELEGRAM_AI_FEEDBACK_DEBOUNCE_MS) {
      aiFeedbackSessionDebounce.delete(trackedSessionId);
    }
  }

  const lastCallbackAt = aiFeedbackSessionDebounce.get(sessionId);
  if (lastCallbackAt !== undefined && now - lastCallbackAt < TELEGRAM_AI_FEEDBACK_DEBOUNCE_MS) {
    return false;
  }

  aiFeedbackSessionDebounce.set(sessionId, now);
  return true;
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

  const fileData = await fileResponse.json() as TelegramGetFileResponse;
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
  telegramChatId: number | null;
  telegramMessageId: number | null;
}) {
  const sessionId = await insertSession(sessionSupabase, {
    userId: input.userId,
    mode: "speaking",
    transcript: input.transcript,
    flowScore: input.analysis.flowScore,
    completed: input.analysis.isCompleted,
    scoringVersion: SCORING_VERSION,
    source: "telegram",
    duration: input.analysis.totalSessionTimeSec,
    speakingTime: input.analysis.speakingTimeSec,
    pauses: input.analysis.pauseCount,
    pauseCount: input.analysis.pauseCount,
    hesitationsPerMinute:
      input.analysis.speakingTimeSec > 0
        ? input.analysis.pauseCount / (input.analysis.speakingTimeSec / 60)
        : null,
    hesitationLog: input.analysis.pauseLog,
    words: countWords(input.transcript),
    telegramChatId: input.telegramChatId,
    telegramMessageId: input.telegramMessageId,
  });

  await updateStreak(sessionSupabase, {
    userId: input.userId,
    localDate: formatLocalDate(new Date()),
  });

  return String(sessionId);
}

async function getProcessedTelegramSessionId(input: {
  userId: string;
  telegramChatId: number | null;
  telegramMessageId: number | null;
}): Promise<string | null> {
  if (!input.telegramChatId || !input.telegramMessageId) {
    return null;
  }

  const { data, error } = await supabaseServer
    .from("sessions")
    .select("id")
    .eq("user_id", input.userId)
    .eq("source", "telegram")
    .eq("telegram_chat_id", input.telegramChatId)
    .eq("telegram_message_id", input.telegramMessageId)
    .maybeSingle();

  if (error) {
    if (isMissingTelegramMessageIdColumnError(error)) {
      return null;
    }

    throw error;
  }

  return typeof data?.id === "string" && data.id ? data.id : null;
}

export async function getTelegramSessionTranscript(input: {
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
    maybeError?.message?.includes("pause_count") === true
  );
}

export async function getTelegramSession(input: {
  userId: string;
  sessionId: string;
}): Promise<TelegramSessionRecord | null> {
  const { data, error } = await supabaseServer
    .from("sessions")
    .select("id, transcript, flow_score, pauses, pause_count, speaking_time, duration, completed, hesitation_log")
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

export function getSessionAnalysis(session: TelegramSessionRecord): FlowAnalysis {
  const speakingTimeSec = Math.max(0, Math.round(Number(session.speaking_time ?? 0)));
  const totalSessionTimeSec = Math.max(speakingTimeSec, Math.round(Number(session.duration ?? speakingTimeSec)));

  return {
    flowScore: Math.round(Number(session.flow_score ?? 0)),
    pauseCount: Math.round(Number(session.pause_count ?? session.pauses ?? 0)),
    speakingTimeSec,
    totalSessionTimeSec,
    isCompleted: Boolean(session.completed),
    pauseLog: Array.isArray(session.hesitation_log) ? session.hesitation_log : [],
  };
}

export async function handleVoiceMessage(
  ctx: Context & {
    message: {
      message_id?: number;
      voice: { file_id: string; duration?: number };
      forward_origin?: unknown;
      forward_date?: unknown;
    };
  },
  telegramId: number,
) {
  const groupChat = isGroupChat(ctx);
  const username = getTelegramUsername(ctx);
  let userId: string | null;
  try {
    userId = await resolveTelegramUser(telegramId);
  } catch (error) {
    console.error("Telegram voice connection lookup failed", error);
    await ctx.reply(MESSAGES.lookupError, { parse_mode: "HTML" });
    return;
  }

  if (!userId) {
    await replyWithConnectPrompt(ctx, telegramId);
    return;
  }

  const voice = ctx.message.voice;
  const telegramChatId = Number.isFinite(ctx.chat?.id) ? ctx.chat?.id ?? null : null;
  const telegramMessageId = Number.isFinite(ctx.message.message_id) ? ctx.message.message_id : null;
  if (ctx.message.forward_origin || ctx.message.forward_date) {
    await ctx.reply("🎤 Please record a fresh voice note directly in this chat, not forwarded from somewhere else.");
    return;
  }

  if (voice.duration && voice.duration > MAX_TELEGRAM_VOICE_DURATION_SECONDS) {
    await ctx.reply("🎤 The maximum voice note length is 5 minutes. Please send a shorter voice note.");
    return;
  }

  let pendingChallenge: Awaited<ReturnType<typeof getPendingChallenge>> = null;
  let challenge: Awaited<ReturnType<typeof getFriendChallenge>> = null;
  try {
    pendingChallenge = groupChat ? null : await getPendingChallenge(telegramId);
    challenge = pendingChallenge ? await getFriendChallenge(pendingChallenge.challenge_id) : null;
    if (pendingChallenge && !challenge) {
      await deletePendingChallenge(telegramId);
      await ctx.reply(MESSAGES.challengeNoLongerExists, { parse_mode: "HTML" });
      return;
    }
    if (pendingChallenge?.challenge_type === "group" && challenge && isGroupChallengeExpired(challenge)) {
      await deletePendingChallenge(telegramId);
      await ctx.reply(MESSAGES.groupChallengeExpired, { parse_mode: "HTML" });
      return;
    }
  } catch (error) {
    console.error("Telegram pending challenge lookup failed", error);
    await ctx.reply(MESSAGES.lookupError, { parse_mode: "HTML" });
    return;
  }

  let pauseThresholdMs: number;
  let processedSessionId: string | null;
  try {
    pauseThresholdMs = await getUserPauseThresholdMs(userId);
    processedSessionId = await getProcessedTelegramSessionId({ userId, telegramChatId, telegramMessageId });
  } catch (error) {
    console.error("Telegram voice preflight lookup failed", error);
    await ctx.reply(MESSAGES.lookupError, { parse_mode: "HTML" });
    return;
  }

  if (processedSessionId) {
    console.log("Telegram voice message already processed", {
      telegramId,
      telegramMessageId,
      sessionId: processedSessionId,
    });
    return;
  }

  try {
    await ctx.reply(MESSAGES.voiceReceived, { parse_mode: "HTML" });

    const audioBuffer = await downloadTelegramVoice(voice.file_id);
    await consumeApiQuota({
      userId,
      kind: "transcription",
      limit: DAILY_TRANSCRIPTION_LIMIT,
    });
    const transcription = await transcribeAudio(audioBuffer);
    const transcript = transcription.text;

    if (!isUsableTranscript(transcript)) {
      await ctx.reply(MESSAGES.unusableTranscript);
      return;
    }

    const totalSessionTimeSec = estimateDurationSec(voice.duration);
    const analysis = await analyzeTranscript(
      transcript,
      transcription.words,
      totalSessionTimeSec,
      pauseThresholdMs,
    );
    let sessionId: string;
    try {
      sessionId = await insertTelegramSession({
        userId,
        transcript,
        analysis,
        telegramChatId,
        telegramMessageId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existingSessionId = await getProcessedTelegramSessionId({ userId, telegramChatId, telegramMessageId });
        if (existingSessionId) {
          console.log("Telegram voice message already inserted by another request", {
            telegramId,
            telegramMessageId,
            sessionId: existingSessionId,
          });
          return;
        }
      }

      throw error;
    }

    if (groupChat) {
      await ctx.reply(
        getSpeakingResultMessage({ speaker: username, analysis, transcript }),
        { ...groupTryAgainKeyboard, parse_mode: "HTML" },
      );
      return;
    }

    if (pendingChallenge?.challenge_type === "friend" && challenge) {
      try {
        await recordFriendChallengeSubmission({
          challengeId: challenge.id,
          telegramId,
          sessionId: String(sessionId),
        });
      } catch (error) {
        console.error("Telegram friend challenge submission marker failed", error);
      }

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

        await ctx.reply(getChallengeResultMessage({ topic: challenge.topic, analysis, transcript }), {
          parse_mode: "HTML",
        });
        return;
      }

      const creatorUsername = pendingChallenge.creator_username ?? String(challenge.creator_telegram_id);

      await ctx.reply(getChallengeResultMessage({ topic: challenge.topic, analysis, transcript }), {
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
      const groupId = Number(pendingChallenge.group_id ?? challenge.creator_telegram_id);
      const attemptCount = await recordGroupChallengeAttempt({
        challengeId: challenge.id,
        telegramId,
        sessionId: String(sessionId),
      });
      await deletePendingChallenge(telegramId);

      await ctx.reply(
        getChallengeResultMessage({
          title: "Group Challenge Result",
          topic: challenge.topic,
          analysis,
          transcript,
          attemptCount,
        }),
        {
          ...getGroupChallengeResultActions({
            sessionId: String(sessionId),
            groupId,
            challengeId: challenge.id,
            attemptCount,
          }),
          parse_mode: "HTML",
        },
      );
      return;
    }

    await ctx.reply(
      getSpeakingResultMessage({ analysis, transcript }),
      { ...getSessionActions(String(sessionId)), parse_mode: "HTML" },
    );
  } catch (error) {
    if (isApiQuotaExceededError(error)) {
      await ctx.reply(getQuotaExceededMessage(error.kind));
      return;
    }
    console.error("Telegram voice handling failed", error);
    await ctx.reply(MESSAGES.analysisError, { parse_mode: "HTML" });
  }
}

export async function sendFriendChallengeResult(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
) {
  const challengeId = ctx.match[1];
  const sessionId = ctx.match[2];

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

    const shouldSend = await claimFriendChallengeResultSend({
      challengeId: challenge.id,
      telegramId,
      sessionId,
    });
    if (!shouldSend) {
      await ctx.answerCbQuery("This result has already been sent.");
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
      transcript: session.transcript,
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
}

export async function postGroupChallengeResultToGroup(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
) {
  const challengeId = ctx.match[1];
  const sessionId = ctx.match[2];

  try {
    const [userId, challenge] = await Promise.all([
      resolveTelegramUser(telegramId),
      getFriendChallenge(challengeId),
    ]);
    if (!userId || !challenge) {
      await ctx.answerCbQuery("I could not find a recent group challenge result right now.", { show_alert: true });
      return;
    }

    const session = await getTelegramSession({ userId, sessionId });
    if (!session) {
      await ctx.answerCbQuery("I could not find a recent group challenge result right now.", { show_alert: true });
      return;
    }

    const attemptCount = await getGroupChallengeAttemptCount({ challengeId: challenge.id, telegramId });
    await ctx.telegram.sendMessage(
      Number(challenge.creator_telegram_id),
      getGroupShareResultMessage({
        firstName: getTelegramFirstName(ctx),
        username: ctx.from?.username,
        topic: challenge.topic,
        attemptCount,
        analysis: getSessionAnalysis(session),
      }),
      { parse_mode: "HTML" },
    );
    await ctx.answerCbQuery("Sent to the group.");
  } catch (error) {
    console.error("Telegram group challenge result post failed", error);
    await ctx.answerCbQuery("I could not post to the group right now.", { show_alert: true });
  }
}

export async function replyWithAiFeedback(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
) {
  const sessionId = ctx.match[1];
  if (!claimAiFeedbackSession(sessionId)) {
    return;
  }

  console.log("Telegram AI feedback handler entered", {
    telegramId,
    sessionId,
  });

  try {
    const userId = await withTimeout(
      resolveTelegramUser(telegramId),
      TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_MS,
      TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR,
    );
    if (!userId) {
      await replyWithConnectPrompt(ctx, telegramId);
      return;
    }

    const transcript = await withTimeout(
      getTelegramSessionTranscript({ userId, sessionId }),
      TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_MS,
      TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR,
    );
    if (!transcript) {
      await ctx.reply("Session not found or expired.");
      return;
    }
    console.log("Telegram AI feedback session loaded", {
      telegramId,
      sessionId,
      userId,
      transcriptLength: transcript.length,
    });

    try {
      await ctx.reply("🤖 AI feedback is being generated...");
      await withTimeout(
        consumeApiQuota({
          userId,
          kind: "feedback",
          limit: DAILY_FEEDBACK_LIMIT,
        }),
        TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_MS,
        TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR,
      );
      console.log("Telegram AI feedback started", {
        telegramId,
        sessionId,
        transcriptLength: transcript.length,
      });
      const feedback = await withTimeout(generateAiFeedback(transcript), 25_000, "AI feedback timed out");
      console.log("Telegram AI feedback completed", {
        telegramId,
        sessionId,
        feedbackLength: feedback.length,
      });
      await ctx.reply(`🤖 <b>AI Feedback</b>\n\n${escapeTelegramHtml(feedback)}`, { parse_mode: "HTML" });
    } catch (error) {
      if (isApiQuotaExceededError(error)) {
        await ctx.reply(getQuotaExceededMessage(error.kind));
        return;
      }
      if (isTelegramAiFeedbackSupabaseTimeout(error)) {
        await ctx.reply(TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE);
        return;
      }
      console.error("Telegram AI feedback failed", {
        message: error instanceof Error ? error.message : String(error),
        telegramId,
        sessionId,
      });
      await ctx.reply("AI feedback is taking too long. Try again in a moment.");
    }
  } catch (error) {
    if (isTelegramAiFeedbackSupabaseTimeout(error)) {
      await ctx.reply(TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE);
      return;
    }
    console.error("Telegram AI feedback failed", error);
    await ctx.reply(MESSAGES.feedbackError, { parse_mode: "HTML" });
  }
}
