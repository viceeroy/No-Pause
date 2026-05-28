import type { Context } from "telegraf";
import {
  SCORING_VERSION,
  TELEGRAM_MIN_DURATION,
} from "../core/constants.js";
import { calculateFlowScore, DEFAULT_PAUSE_THRESHOLD } from "../core/scoring.js";
import { formatLocalDate, insertSession, updateStreak, type SupabaseLike } from "../core/session.js";
import { escapeTelegramHtml, getWordCount } from "../core/utils.js";
import {
  analyzePracticeSpeech,
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
  formatTelegramDisplayName,
  getFriendChallenge,
  getFriendChallengeParticipantTelegramId,
  getFriendChallengeSubmissionSessionId,
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
  getCreatorChallengeResultActions,
  getCreatorChallengeSharedResultMessage,
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
export const TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "AI feedback is temporarily unavailable. Please try again in a moment.";
const TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR = "Telegram AI feedback Supabase call timed out";
const TELEGRAM_PAUSE_THRESHOLD_MS = Math.round(DEFAULT_PAUSE_THRESHOLD * 1000);
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

type TelegramGetFileResponse = {
  ok?: unknown;
  result?: {
    file_path?: unknown;
  };
};

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
  return formatTelegramDisplayName(ctx.from ?? null, ctx.from?.id ?? ctx.chat?.id ?? "");
}

export function getPlainTelegramUsername(ctx: Context): string {
  return getTelegramUsername(ctx).replace(/^@+/, "");
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
  const data = await transcribeAudioWithGroq(audioBuffer);
  return { text: data.text, words: data.words };
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
  flowScoreOverride?: number;
  analysisFeedback?: string | null;
}) {
  const sessionId = await insertSession(sessionSupabase, {
    userId: input.userId,
    mode: "speaking",
    transcript: input.transcript,
    flowScore: input.flowScoreOverride ?? input.analysis.flowScore,
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
    words: getWordCount(input.transcript),
    telegramChatId: input.telegramChatId,
    telegramMessageId: input.telegramMessageId,
    analysisFeedback: input.analysisFeedback,
  });

  await updateStreak(sessionSupabase, {
    userId: input.userId,
    localDate: formatLocalDate(new Date()),
  });

  if (!sessionId) {
    console.error("insertTelegramSession: session insert returned no ID", { userId: input.userId });
    throw new Error("Session insert returned no ID");
  }
  return sessionId;
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
  const t_total = Date.now();
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

  console.log('[NoPause:challenge] user lookup', { telegram_id: telegramId, found: !!userId });
  if (!userId) {
    await replyWithConnectPrompt(ctx, telegramId);
    return;
  }

  const voice = ctx.message.voice;
  const telegramChatId = Number.isFinite(ctx.chat?.id) ? ctx.chat?.id ?? null : null;
  const telegramMessageId = Number.isFinite(ctx.message.message_id) ? ctx.message.message_id : null;
  if (ctx.message.forward_origin || ctx.message.forward_date) {
    await ctx.reply(MESSAGES.forwardedVoice);
    return;
  }

  if (voice.duration && voice.duration > MAX_TELEGRAM_VOICE_DURATION_SECONDS) {
    await ctx.reply(MESSAGES.voiceTooLong);
    return;
  }

  let pendingChallenge: Awaited<ReturnType<typeof getPendingChallenge>> = null;
  let challenge: Awaited<ReturnType<typeof getFriendChallenge>> = null;
  try {
    pendingChallenge = groupChat ? null : await getPendingChallenge(telegramId);
    challenge = pendingChallenge ? await getFriendChallenge(pendingChallenge.challenge_id) : null;
    console.log('[NoPause:challenge] pending challenge lookup', { telegram_id: telegramId, challenge_id: pendingChallenge?.challenge_id ?? null });
    if (pendingChallenge && !challenge) {
      console.log('[NoPause:challenge] challenge validity check', { valid: false, reason: 'challenge_not_found', telegram_id: telegramId, challenge_id: pendingChallenge.challenge_id });
      await deletePendingChallenge(telegramId);
      await ctx.reply(MESSAGES.challengeNoLongerExists, { parse_mode: "HTML" });
      return;
    }
    if (pendingChallenge?.challenge_type === "group" && challenge && isGroupChallengeExpired(challenge)) {
      console.log('[NoPause:challenge] expiry check result', { expired: true, telegram_id: telegramId, challenge_id: pendingChallenge.challenge_id });
      await deletePendingChallenge(telegramId);
      await ctx.reply(MESSAGES.groupChallengeExpired, { parse_mode: "HTML" });
      return;
    }
  } catch (error) {
    console.error("Telegram pending challenge lookup failed", error);
    await ctx.reply(MESSAGES.lookupError, { parse_mode: "HTML" });
    return;
  }

  let processedSessionId: string | null;
  try {
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
    console.log('[NoPause:challenge] duplicate message guard hit', { telegram_id: telegramId, telegram_message_id: telegramMessageId, processed_session_id: processedSessionId });
    return;
  }

  try {
    await consumeApiQuota({
      userId,
      kind: "transcription",
      limit: DAILY_TRANSCRIPTION_LIMIT,
    });

    await ctx.reply(MESSAGES.voiceReceived, { parse_mode: "HTML" });

    const t_download = Date.now();
    console.log('[NoPause:challenge] voice download start', { telegram_id: telegramId, file_id: voice.file_id });
    const audioBuffer = await downloadTelegramVoice(voice.file_id);
    console.log('[NoPause:challenge] voice download done', { telegram_id: telegramId, ms: Date.now() - t_download, fileSize: audioBuffer.byteLength });

    const t_transcription = Date.now();
    console.log('[NoPause:challenge] transcription start', { telegram_id: telegramId });
    const transcription = await transcribeAudio(audioBuffer);
    const transcript = transcription.text;
    console.log('[NoPause:challenge] transcription done', { telegram_id: telegramId, ms: Date.now() - t_transcription, wordCount: transcription.words.length, preview: transcript.slice(0, 50) });

    if (!isUsableTranscript(transcript)) {
      await ctx.reply(MESSAGES.unusableTranscript);
      return;
    }

    const totalSessionTimeSec = estimateDurationSec(voice.duration);
    const analysis = await analyzeTranscript(
      transcript,
      transcription.words,
      totalSessionTimeSec,
      TELEGRAM_PAUSE_THRESHOLD_MS,
    );
    console.log('[NoPause:challenge] pause calc', { telegram_id: telegramId, pauseCount: analysis.pauseCount, speakingTime: analysis.speakingTimeSec, flowScore: analysis.flowScore });

    const sessionTopic = challenge?.topic ?? null;
    let aiFeedbackText: string | null = null;
    let finalScore = analysis.flowScore;
    if (sessionTopic) {
      try {
        const aiResult = await analyzePracticeSpeech({
          transcript,
          topic: sessionTopic,
          hesitationCount: analysis.pauseCount,
          speakingTime: analysis.speakingTimeSec,
          flowScore: analysis.flowScore,
          wordCount: getWordCount(transcript),
        });
        finalScore = analysis.flowScore + aiResult.band * 10;
        aiFeedbackText = aiResult.feedback;
      } catch (error) {
        console.error("Telegram inline AI feedback failed", error);
      }
    }

    let sessionId: string;
    const t_insert = Date.now();
    console.log('[NoPause:challenge] insertSession start', { telegram_id: telegramId });
    try {
      sessionId = await insertTelegramSession({
        userId,
        transcript,
        analysis,
        telegramChatId,
        telegramMessageId,
        flowScoreOverride: finalScore,
        analysisFeedback: aiFeedbackText,
      });
      console.log('[NoPause:challenge] insertSession done', { telegram_id: telegramId, ms: Date.now() - t_insert, sessionId });
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

    const displayAnalysis = { ...analysis, flowScore: finalScore };
    const feedbackSuffix = aiFeedbackText
      ? `\n\n🤖 <b>AI Feedback</b>\n\n${escapeTelegramHtml(aiFeedbackText)}`
      : "";

    if (groupChat) {
      const t_reply = Date.now();
      await ctx.reply(
        getSpeakingResultMessage({ speaker: username, analysis: displayAnalysis, transcript }) + feedbackSuffix,
        { ...groupTryAgainKeyboard, parse_mode: "HTML" },
      );
      console.log('[NoPause:challenge] bot reply sent', { template: 'group_speaking_result', chat_id: telegramChatId, ms: Date.now() - t_reply });
      console.log('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total });
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
          await updateFriendChallengeCreatorScore(challenge.id, finalScore);
        } catch (error) {
          console.error("Telegram challenge creator score update failed", error);
          if (isMissingChallengesTableError(error)) {
            await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
            return;
          }
        }

        let friendTelegramId: number | null = null;
        try {
          friendTelegramId = await getFriendChallengeParticipantTelegramId({
            challengeId: challenge.id,
            creatorTelegramId: telegramId,
          });
        } catch (error) {
          console.error("Telegram friend challenge participant lookup failed", error);
        }

        const t_reply_creator = Date.now();
        await ctx.reply(getChallengeResultMessage({ topic: challenge.topic, analysis: displayAnalysis, transcript }) + feedbackSuffix, {
          ...(friendTelegramId
            ? getCreatorChallengeResultActions({
                challengeId: challenge.id,
                sessionId: String(sessionId),
                friendTelegramId,
              })
            : {}),
          parse_mode: "HTML",
        });
        console.log('[NoPause:challenge] bot reply sent', { template: 'friend_challenge_creator_result', chat_id: telegramChatId, ms: Date.now() - t_reply_creator });
        console.log('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total });
        return;
      }

      const creatorUsername = pendingChallenge.creator_username ?? String(challenge.creator_telegram_id);

      const t_reply_participant = Date.now();
      await ctx.reply(getChallengeResultMessage({ topic: challenge.topic, analysis: displayAnalysis, transcript }) + feedbackSuffix, {
        ...getFriendChallengeResultActions({
          creatorUsername,
          challengeId: challenge.id,
          sessionId: String(sessionId),
        }),
        parse_mode: "HTML",
      });
      console.log('[NoPause:challenge] bot reply sent', { template: 'friend_challenge_participant_result', chat_id: telegramChatId, ms: Date.now() - t_reply_participant });
      console.log('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total });
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

      const t_reply_group = Date.now();
      await ctx.reply(
        getChallengeResultMessage({
          title: "Group Challenge Result",
          topic: challenge.topic,
          analysis: displayAnalysis,
          transcript,
          attemptCount,
        }) + feedbackSuffix,
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
      console.log('[NoPause:challenge] bot reply sent', { template: 'group_challenge_result', chat_id: telegramChatId, ms: Date.now() - t_reply_group });
      console.log('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total });
      return;
    }

    const noTopicNote = !sessionTopic
      ? "\n\n💡 Pick a topic to get AI feedback and a higher flow score — use the button below to grab a prompt"
      : "";
    const t_reply_default = Date.now();
    await ctx.reply(
      getSpeakingResultMessage({ analysis: displayAnalysis, transcript }) + feedbackSuffix + noTopicNote,
      { ...getSessionActions(String(sessionId)), parse_mode: "HTML" },
    );
    console.log('[NoPause:challenge] bot reply sent', { template: 'speaking_result', chat_id: telegramChatId, ms: Date.now() - t_reply_default });
    console.log('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total });
  } catch (error) {
    console.log('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total, error: true });
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
    const creatorUsername = formatTelegramDisplayName(null, challenge.creator_telegram_id);
    const creatorSessionId = challenge.creator_score === null || challenge.creator_score === undefined
      ? null
      : await getFriendChallengeSubmissionSessionId({
          challengeId: challenge.id,
          telegramId: creatorTelegramId,
        });

    await ctx.telegram.sendMessage(creatorTelegramId, getChallengeCreatorNotification({
      friendUsername: getTelegramUsername(ctx),
      topic: challenge.topic,
      analysis,
      creatorScore: challenge.creator_score,
      transcript: session.transcript,
    }), {
      ...(creatorSessionId
        ? getCreatorChallengeResultActions({
            challengeId: challenge.id,
            sessionId: creatorSessionId,
            friendTelegramId: telegramId,
          })
        : {}),
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
    await ctx.reply("✅ Your result was sent to the challenger. Good luck!");
  } catch (error) {
    console.error("Telegram challenge result send failed", error);
    await ctx.answerCbQuery("I could not send that result right now.", { show_alert: true });
  }
}

export async function shareCreatorChallengeResult(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
) {
  const challengeId = ctx.match[1];
  const sessionId = ctx.match[2];
  const friendTelegramId = Number(ctx.match[3]);

  try {
    const [userId, challenge] = await Promise.all([
      resolveTelegramUser(telegramId),
      getFriendChallenge(challengeId),
    ]);
    if (!userId || !challenge || !Number.isFinite(friendTelegramId)) {
      await ctx.answerCbQuery(MESSAGES.challengeResultMissing, { show_alert: true });
      return;
    }

    if (Number(challenge.creator_telegram_id) !== telegramId) {
      await ctx.answerCbQuery(MESSAGES.challengeCreatorShareUnauthorized, { show_alert: true });
      return;
    }

    const session = await getTelegramSession({ userId, sessionId });
    if (!session) {
      await ctx.answerCbQuery(MESSAGES.challengeResultMissing, { show_alert: true });
      return;
    }

    const shouldSend = await claimFriendChallengeResultSend({
      challengeId: challenge.id,
      telegramId,
      sessionId,
    });
    if (!shouldSend) {
      await ctx.answerCbQuery(MESSAGES.challengeCreatorShareAlreadySent);
      return;
    }

    await ctx.telegram.sendMessage(friendTelegramId, getCreatorChallengeSharedResultMessage({
      topic: challenge.topic,
      analysis: getSessionAnalysis(session),
      transcript: session.transcript,
    }), {
      parse_mode: "HTML",
    });

    await ctx.answerCbQuery(MESSAGES.challengeCreatorShareSent);
    await ctx.reply(MESSAGES.challengeCreatorShareConfirmation);
  } catch (error) {
    console.error("Telegram creator challenge result share failed", error);
    await ctx.answerCbQuery(MESSAGES.challengeCreatorShareError, { show_alert: true });
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

    const session = await withTimeout(
      getTelegramSession({ userId, sessionId }),
      TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_MS,
      TELEGRAM_AI_FEEDBACK_SUPABASE_TIMEOUT_ERROR,
    );
    if (!session || !session.transcript?.trim()) {
      await ctx.reply(MESSAGES.feedbackTranscriptMissing, { parse_mode: "HTML" });
      return;
    }

    // Sessions table has no topic column — no topic available, matches gate in useSession.ts and api/feedback.ts
    await ctx.reply("💡 Pick a topic to get AI feedback and a higher flow score — use the button below to grab a prompt");
  } catch (error) {
    if (isTelegramAiFeedbackSupabaseTimeout(error)) {
      await ctx.reply(TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE);
      return;
    }
    console.error("Telegram AI feedback failed", error);
    await ctx.reply(MESSAGES.feedbackError, { parse_mode: "HTML" });
  }
}
