import type { Context } from "telegraf";
import {
  SCORING_VERSION_FLOW_2,
  TELEGRAM_MIN_DURATION,
} from "../core/constants.js";
import { calculateDurationBonus, calculateFlowScore, calculateTotalScore, getDurationFactor } from "../core/scoring.js";
import { analyzeSilenceFromTimestamps } from "../core/silence.js";
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
  getAutoFriendChallengeNotification,
  getChallengeCreatorNotification,
  getChallengeResultMessage,
  getChallengesTableMissingMessage,
  getConnectAccountKeyboard,
  getCreatorChallengeResultActions,
  getCreatorChallengeSharedResultMessage,
  getGroupChallengeResultActions,
  getGroupShareResultMessage,
  getSessionActions,
  getSpeakingResultMessage,
  MESSAGES,
  VOICE_COOLDOWN_MS,
} from "./constants.js";

const TELEGRAM_DEBUG = process.env.NOPAUSE_DEBUG_TELEGRAM === "true";
function debugLog(...args: unknown[]) {
  if (TELEGRAM_DEBUG) console.log(...args);
}

async function sendResult(
  ctx: Context,
  opts: {
    text: string;
    keyboard: Record<string, any>;
    logTemplate: string;
    tTotal: number;
    telegramChatId: number | null;
    telegramId: number;
  }
): Promise<void> {
  const t_reply = Date.now();
  await ctx.reply(opts.text, { ...opts.keyboard, parse_mode: "HTML" });
  debugLog('[NoPause:challenge] bot reply sent', { template: opts.logTemplate, chat_id: opts.telegramChatId, ms: Date.now() - t_reply });
  debugLog('[NoPause:challenge] handler done', { telegram_id: opts.telegramId, ms: Date.now() - opts.tTotal });
}

const sessionSupabase = supabaseServer as unknown as SupabaseLike;
const MAX_TELEGRAM_VOICE_DURATION_SECONDS = 300;

export type TelegramSessionRecord = {
  id: string;
  transcript: string | null;
  flow_score: number | null;
  pauses: number | null;
  pause_count?: number | null;
  total_silence_time?: number | null;
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

export async function replyWithConnectPrompt(ctx: Context, telegramId: number) {
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

// Empty / too-short audio makes Groq (or our own guards) throw before we reach
// the isUsableTranscript check. Treat these as "couldn't hear" rather than the
// generic analysis error — same intent as an unusable transcript.
function isUnhearableAudioError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("audio payload is empty") ||
    message.includes("empty audio buffer") ||
    message.includes("too short") ||
    message.includes("no speech")
  );
}

async function transcribeAudio(audioBuffer: ArrayBuffer) {
  const data = await transcribeAudioWithGroq(audioBuffer);
  return { text: data.text, words: data.words };
}

function analyzeTranscript(
  transcript: string,
  words: GroqTranscribedWord[],
  totalSessionTimeSec: number,
): FlowAnalysis {
  const analysis = analyzeSilenceFromTimestamps(words, totalSessionTimeSec);
  const { speakingTimeSec, totalSilenceSec, gapCount, gaps } = analysis;
  const cleanSpeakingTime = totalSessionTimeSec - totalSilenceSec;

  const scoreResult = calculateFlowScore({
    cleanSpeakingTime,
    totalSessionTime: totalSessionTimeSec,
    speakingTime: speakingTimeSec,
    pauseCount: gapCount,
  });

  const pauseLog = gaps.map((gap) => ({
    timestamp: Math.round(gap.startSec * 1000),
    duration: Math.round(gap.durationSec * 1000),
    units: 1,
  }));

  return {
    flowScore: Number.isFinite(scoreResult.score) ? scoreResult.score : 0,
    pauseCount: gapCount,
    totalSilenceSec,
    speakingTimeSec,
    totalSessionTimeSec,
    isCompleted: scoreResult.isCompleted,
    pauseLog,
    gaps,
  };
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
  scoringVersion: string;
}) {
  const sessionId = await insertSession(sessionSupabase, {
    userId: input.userId,
    mode: "speaking",
    transcript: input.transcript,
    flowScore: input.flowScoreOverride ?? input.analysis.flowScore,
    completed: input.analysis.isCompleted,
    scoringVersion: input.scoringVersion,
    source: "telegram",
    duration: input.analysis.totalSessionTimeSec,
    speakingTime: input.analysis.speakingTimeSec,
    pauses: input.analysis.pauseCount,
    pauseCount: input.analysis.pauseCount,
    silenceTime: input.analysis.totalSilenceSec,
    hesitationsPerMinute: null,
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
    maybeError?.message?.includes("pause_count") === true ||
    maybeError?.message?.includes("total_silence_time") === true
  );
}

export async function getTelegramSession(input: {
  userId: string;
  sessionId: string;
}): Promise<TelegramSessionRecord | null> {
  const { data, error } = await supabaseServer
    .from("sessions")
    .select("id, transcript, flow_score, pauses, pause_count, total_silence_time, speaking_time, duration, completed, hesitation_log")
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
  const totalSilenceSec = Math.max(0, Math.round(Number(session.total_silence_time ?? 0)));

  return {
    flowScore: Math.round(Number(session.flow_score ?? 0)),
    pauseCount: Math.round(Number(session.pause_count ?? session.pauses ?? 0)),
    totalSilenceSec,
    speakingTimeSec,
    totalSessionTimeSec,
    isCompleted: Boolean(session.completed),
    pauseLog: Array.isArray(session.hesitation_log) ? session.hesitation_log : [],
    // Re-display of a stored session; never feeds the AI (which needs real gaps).
    gaps: [],
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
  let userId: string | null;
  try {
    userId = await resolveTelegramUser(telegramId);
  } catch (error) {
    console.error("Telegram voice connection lookup failed", error);
    await ctx.reply(MESSAGES.lookupError, { parse_mode: "HTML" });
    return;
  }

  debugLog('[NoPause:challenge] user lookup', { telegram_id: telegramId, found: !!userId });
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
    pendingChallenge = await getPendingChallenge(telegramId);
    challenge = pendingChallenge ? await getFriendChallenge(pendingChallenge.challenge_id) : null;
    debugLog('[NoPause:challenge] pending challenge lookup', { telegram_id: telegramId, challenge_id: pendingChallenge?.challenge_id ?? null });
    if (pendingChallenge && !challenge) {
      debugLog('[NoPause:challenge] challenge validity check', { valid: false, reason: 'challenge_not_found', telegram_id: telegramId, challenge_id: pendingChallenge.challenge_id });
      await deletePendingChallenge(telegramId);
      await ctx.reply(MESSAGES.challengeNoLongerExists, { parse_mode: "HTML" });
      return;
    }
    if (pendingChallenge?.challenge_type === "group" && challenge && isGroupChallengeExpired(challenge)) {
      debugLog('[NoPause:challenge] expiry check result', { expired: true, telegram_id: telegramId, challenge_id: pendingChallenge.challenge_id });
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
    debugLog("Telegram voice message already processed", {
      telegramId,
      telegramMessageId,
      sessionId: processedSessionId,
    });
    debugLog('[NoPause:challenge] duplicate message guard hit', { telegram_id: telegramId, telegram_message_id: telegramMessageId, processed_session_id: processedSessionId });
    return;
  }

  // Cooldown: reject a new voice note if this user submitted one < 10s ago.
  // Protects the Groq bill from rapid spam and blocks innocent double-taps
  // before any paid work. Fail-open: a lookup error must not block a real user.
  try {
    const { data: lastSession } = await supabaseServer
      .from("sessions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("source", "telegram")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSession?.created_at) {
      const elapsedMs = Date.now() - new Date(lastSession.created_at).getTime();
      if (elapsedMs < VOICE_COOLDOWN_MS) {
        await ctx.reply(MESSAGES.voiceCooldown, { parse_mode: "HTML" });
        return;
      }
    }
  } catch (error) {
    debugLog("[NoPause:challenge] cooldown lookup failed (fail-open)", { telegram_id: telegramId, error });
  }

  try {
    await consumeApiQuota({
      userId,
      kind: "transcription",
      limit: DAILY_TRANSCRIPTION_LIMIT,
    });

    await ctx.reply(MESSAGES.voiceReceived, { parse_mode: "HTML" });

    const t_download = Date.now();
    debugLog('[NoPause:challenge] voice download start', { telegram_id: telegramId, file_id: voice.file_id });
    const audioBuffer = await downloadTelegramVoice(voice.file_id);
    debugLog('[NoPause:challenge] voice download done', { telegram_id: telegramId, ms: Date.now() - t_download, fileSize: audioBuffer.byteLength });

    const t_transcription = Date.now();
    debugLog('[NoPause:challenge] transcription start', { telegram_id: telegramId });
    const transcription = await transcribeAudio(audioBuffer);
    const transcript = transcription.text;
    debugLog('[NoPause:challenge] transcription done', { telegram_id: telegramId, ms: Date.now() - t_transcription, wordCount: transcription.words.length, preview: transcript.slice(0, 50) });

    if (!isUsableTranscript(transcript)) {
      await ctx.reply(MESSAGES.unusableTranscript);
      return;
    }

    const totalSessionTimeSec = estimateDurationSec(voice.duration);
    const analysis = analyzeTranscript(
      transcript,
      transcription.words,
      totalSessionTimeSec,
    );
    debugLog('[NoPause:challenge] silence calc', { telegram_id: telegramId, totalSilenceSec: analysis.totalSilenceSec, gapCount: analysis.pauseCount, speakingTime: analysis.speakingTimeSec, flowScore: analysis.flowScore });

    const durationBonus = calculateDurationBonus(analysis.speakingTimeSec);
    let aiFeedbackText: string | null = null;
    let finalScore = analysis.flowScore;
    try {
      const aiResult = await analyzePracticeSpeech({
        transcript,
        words: transcription.words,
        gaps: analysis.gaps ?? [],
        speakingTimeSec: analysis.speakingTimeSec,
        totalSilenceSec: analysis.totalSilenceSec,
        pauseCount: analysis.pauseCount,
        wordCount: getWordCount(transcript),
      });
      const durationFactor = getDurationFactor(analysis.speakingTimeSec);
      const adjustedAiScore = Math.round(aiResult.score * durationFactor);
      finalScore = calculateTotalScore(analysis.flowScore, adjustedAiScore, durationBonus);
      aiFeedbackText = aiResult.feedback;
    } catch (error) {
      console.error("Telegram inline AI feedback failed", error);
    }

    let sessionId: string;
    const t_insert = Date.now();
    debugLog('[NoPause:challenge] insertSession start', { telegram_id: telegramId });
    try {
      sessionId = await insertTelegramSession({
        userId,
        transcript,
        analysis,
        telegramChatId,
        telegramMessageId,
        flowScoreOverride: finalScore,
        analysisFeedback: aiFeedbackText,
        scoringVersion: SCORING_VERSION_FLOW_2,
      });
      debugLog('[NoPause:challenge] insertSession done', { telegram_id: telegramId, ms: Date.now() - t_insert, sessionId });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existingSessionId = await getProcessedTelegramSessionId({ userId, telegramChatId, telegramMessageId });
        if (existingSessionId) {
          debugLog("Telegram voice message already inserted by another request", {
            telegramId,
            telegramMessageId,
            sessionId: existingSessionId,
          });
          if (pendingChallenge) await deletePendingChallenge(telegramId);
          return;
        }
      }

      throw error;
    }

    const displayAnalysis = { ...analysis, flowScore: finalScore };
    const feedbackSuffix = aiFeedbackText
      ? `\n\n🤖 <b>AI Feedback</b>\n\n${escapeTelegramHtml(aiFeedbackText)}`
      : "";

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

        // Auto-notify friend with creator's result (no transcript/feedback)
        if (friendTelegramId) {
          try {
            const creatorAttemptCount = await getGroupChallengeAttemptCount({
              challengeId: challenge.id,
              telegramId,
            });
            const shouldSend = await claimFriendChallengeResultSend({
              challengeId: challenge.id,
              telegramId,
              sessionId: String(sessionId),
            });
            if (shouldSend) {
              await ctx.telegram.sendMessage(
                friendTelegramId,
                getAutoFriendChallengeNotification({
                  fromUsername: getTelegramUsername(ctx),
                  topic: challenge.topic,
                  analysis: displayAnalysis,
                  attemptCount: creatorAttemptCount,
                  otherScore: null,
                }),
                { parse_mode: "HTML" },
              );
            }
          } catch (error) {
            console.error("Auto friend challenge notification to friend failed", error);
          }
        }

        await sendResult(ctx, {
          text: getChallengeResultMessage({ topic: challenge.topic, analysis: displayAnalysis, transcript }) + feedbackSuffix,
          keyboard: {},
          logTemplate: 'friend_challenge_creator_result',
          tTotal: t_total,
          telegramChatId,
          telegramId,
        });
        await deletePendingChallenge(telegramId);
        return;
      }

      const creatorUsername = pendingChallenge.creator_username ?? String(challenge.creator_telegram_id);
      const creatorTelegramId = Number(challenge.creator_telegram_id);

      // Auto-notify creator with participant's result (no transcript/feedback)
      try {
        const participantAttemptCount = await getGroupChallengeAttemptCount({
          challengeId: challenge.id,
          telegramId,
        });
        const shouldSend = await claimFriendChallengeResultSend({
          challengeId: challenge.id,
          telegramId,
          sessionId: String(sessionId),
        });
        if (shouldSend) {
          await ctx.telegram.sendMessage(
            creatorTelegramId,
            getAutoFriendChallengeNotification({
              fromUsername: getTelegramUsername(ctx),
              topic: challenge.topic,
              analysis: displayAnalysis,
              attemptCount: participantAttemptCount,
              otherScore: challenge.creator_score,
            }),
            { parse_mode: "HTML" },
          );
          if (challenge.creator_score === null || challenge.creator_score === undefined) {
            await upsertPendingChallenge({
              telegramId: creatorTelegramId,
              challengeId: challenge.id,
              challengeType: "friend",
              creatorUsername,
            });
          }
        }
      } catch (error) {
        console.error("Auto friend challenge notification to creator failed", error);
      }

      await sendResult(ctx, {
        text: getChallengeResultMessage({ topic: challenge.topic, analysis: displayAnalysis, transcript }) + feedbackSuffix,
        keyboard: {},
        logTemplate: 'friend_challenge_participant_result',
        tTotal: t_total,
        telegramChatId,
        telegramId,
      });
      await deletePendingChallenge(telegramId);
      return;
    }

    if (pendingChallenge?.challenge_type === "group" && challenge) {
      const groupId = Number(pendingChallenge.group_id ?? challenge.creator_telegram_id);
      const attemptCount = await recordGroupChallengeAttempt({
        challengeId: challenge.id,
        telegramId,
        sessionId: String(sessionId),
      });
      await sendResult(ctx, {
        text: getChallengeResultMessage({
          title: "Group Challenge Result",
          topic: challenge.topic,
          analysis: displayAnalysis,
          transcript,
          attemptCount,
        }) + feedbackSuffix,
        keyboard: getGroupChallengeResultActions({
          sessionId: String(sessionId),
          groupId,
          challengeId: challenge.id,
          attemptCount,
        }),
        logTemplate: 'group_challenge_result',
        tTotal: t_total,
        telegramChatId,
        telegramId,
      });
      await deletePendingChallenge(telegramId);
      return;
    }

    await sendResult(ctx, {
      text: getSpeakingResultMessage({ analysis: displayAnalysis, transcript }) + feedbackSuffix,
      keyboard: getSessionActions(String(sessionId)),
      logTemplate: 'speaking_result',
      tTotal: t_total,
      telegramChatId,
      telegramId,
    });
  } catch (error) {
    debugLog('[NoPause:challenge] handler done', { telegram_id: telegramId, ms: Date.now() - t_total, error: true });
    if (isApiQuotaExceededError(error)) {
      await ctx.reply(getQuotaExceededMessage(error.kind));
      return;
    }
    if (isUnhearableAudioError(error)) {
      await ctx.reply(MESSAGES.unusableTranscript);
      return;
    }
    console.error("Telegram voice handling failed", error);
    await ctx.reply(MESSAGES.analysisError, { parse_mode: "HTML" });
  }
}

export async function sendFriendChallengeResult(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
  placeholderMsgId: number,
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
      try {
        await ctx.telegram.editMessageText(ctx.chat!.id, placeholderMsgId, undefined, "Already sent.");
      } catch {
        // edit failed silently — dup check already completed
      }
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

    try {
      await ctx.telegram.editMessageText(ctx.chat!.id, placeholderMsgId, undefined, "✅ Result sent!");
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      // edit failed silently — send already completed
    }
  } catch (error) {
    console.error("Telegram challenge result send failed", error);
    await ctx.answerCbQuery("I could not send that result right now.", { show_alert: true });
  }
}

export async function shareCreatorChallengeResult(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
  placeholderMsgId: number,
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
      try {
        await ctx.telegram.editMessageText(ctx.chat!.id, placeholderMsgId, undefined, "Already sent.");
      } catch {
        // edit failed silently — dup check already completed
      }
      return;
    }

    await ctx.telegram.sendMessage(friendTelegramId, getCreatorChallengeSharedResultMessage({
      topic: challenge.topic,
      analysis: getSessionAnalysis(session),
      transcript: session.transcript,
    }), {
      parse_mode: "HTML",
    });

    try {
      await ctx.telegram.editMessageText(ctx.chat!.id, placeholderMsgId, undefined, "✅ Result sent!");
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      // edit failed silently — send already completed
    }
  } catch (error) {
    console.error("Telegram creator challenge result share failed", error);
    await ctx.answerCbQuery(MESSAGES.challengeCreatorShareError, { show_alert: true });
  }
}

export async function postGroupChallengeResultToGroup(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
  placeholderMsgId: number,
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
    try {
      await ctx.telegram.editMessageText(ctx.chat!.id, placeholderMsgId, undefined, "✅ Result sent!");
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      // edit failed silently — send already completed
    }
  } catch (error) {
    console.error("Telegram group challenge result post failed", error);
    await ctx.answerCbQuery("I could not post to the group right now.", { show_alert: true });
  }
}
