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
import { transcribeAudioWithDeepgram, type DeepgramTranscribedWord } from "../../services/deepgram.js";
import { resolveTelegramUser } from "../core/user.js";
import { supabaseServer } from "../../services/supabaseServer.js";
import {
  deletePendingChallenge,
  getFriendChallenge,
  getPendingChallenge,
  isMissingChallengesTableError,
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
  getGroupResultText,
  getGroupShareResultMessage,
  getSessionActions,
  getSpeakingResultMessage,
  groupTryAgainKeyboard,
  MESSAGES,
} from "./constants.js";

const sessionSupabase = supabaseServer as unknown as SupabaseLike;
const MAX_TELEGRAM_VOICE_DURATION_SECONDS = 300;

export type TelegramSessionRecord = {
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

type VerboseTranscriptionResponse = {
  transcript?: unknown;
  text?: unknown;
  words?: unknown;
  fillerCount?: unknown;
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

export async function replyWithConnectPrompt(ctx: Context, telegramId: number) {
  await ctx.reply(MESSAGES.connectPrompt, { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" });
}

function parseTranscribedWords(words: unknown): DeepgramTranscribedWord[] {
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

function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter(Boolean).length;
}

function getSpeakingTimeSec(words: DeepgramTranscribedWord[], fallbackDurationSec: number): number {
  const speakingSeconds = words.reduce((sum, word) => {
    const duration = Math.max(0, word.end - word.start);
    return sum + duration;
  }, 0);

  if (speakingSeconds > 0) {
    return Math.max(1, Math.round(speakingSeconds));
  }

  return fallbackDurationSec;
}

function detectPausesFromWordTimestamps(words: DeepgramTranscribedWord[], pauseThresholdMs: number) {
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
  const data = await transcribeAudioWithDeepgram(audioBuffer) as VerboseTranscriptionResponse;
  const transcript = String(data.transcript ?? data.text ?? "").trim();
  const words = parseTranscribedWords(data.words);
  const rawFillerCount = Number(data.fillerCount);
  const fillerCount = Number.isFinite(rawFillerCount) ? Math.max(0, Math.round(rawFillerCount)) : 0;
  console.log("transcript words:", words.length);

  return { text: transcript, words, fillerCount };
}

async function analyzeTranscript(
  transcript: string,
  words: DeepgramTranscribedWord[],
  fillerCount: number,
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
    hesitationCount: fillerCount,
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
    maybeError?.message?.includes("filler_count") === true
  );
}

export async function getTelegramSession(input: {
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

export function getSessionAnalysis(session: TelegramSessionRecord): FlowAnalysis {
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

export async function handleVoiceMessage(
  ctx: Context & {
    message: {
      voice: { file_id: string; duration?: number };
      forward_origin?: unknown;
      forward_date?: unknown;
    };
  },
  telegramId: number,
) {
  const userId = await resolveTelegramUser(telegramId);
  const groupChat = isGroupChat(ctx);
  const username = getTelegramUsername(ctx);
  if (!userId) {
    await replyWithConnectPrompt(ctx, telegramId);
    return;
  }

  const voice = ctx.message.voice;
  if (ctx.message.forward_origin || ctx.message.forward_date) {
    await ctx.reply("🎤 Please record a fresh voice note directly in this chat, not forwarded from somewhere else.");
    return;
  }

  if (voice.duration && voice.duration > MAX_TELEGRAM_VOICE_DURATION_SECONDS) {
    await ctx.reply("🎤 The maximum voice note length is 5 minutes. Please send a shorter voice note.");
    return;
  }

  const pauseThresholdMs = await getUserPauseThresholdMs(userId);
  await ctx.reply(MESSAGES.voiceReceived, { parse_mode: "HTML" });

  try {
    const pendingChallenge = groupChat ? null : await getPendingChallenge(telegramId);
    const challenge = pendingChallenge ? await getFriendChallenge(pendingChallenge.challenge_id) : null;
    if (pendingChallenge && !challenge) {
      await deletePendingChallenge(telegramId);
    }

    const audioBuffer = await downloadTelegramVoice(voice.file_id);
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
      transcription.fillerCount,
      totalSessionTimeSec,
      pauseThresholdMs,
    );
    const sessionId = await insertTelegramSession({
      userId,
      transcript,
      analysis,
    });

    if (groupChat) {
      await ctx.reply(
        getSpeakingResultMessage({ speaker: username, analysis, transcript }),
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
      await deletePendingChallenge(telegramId);
      const resultText = getGroupResultText({
        username: pendingChallenge.participant_username ?? username,
        topic: challenge.topic,
        analysis,
        transcript,
      });
      const groupId = Number(pendingChallenge.group_id ?? challenge.creator_telegram_id);

      await ctx.reply(
        getChallengeResultMessage({ title: "Group Challenge Result", topic: challenge.topic, analysis, transcript }),
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
      getSpeakingResultMessage({ analysis, transcript }),
      { ...getSessionActions(String(sessionId)), parse_mode: "HTML" },
    );

    try {
      console.log("Telegram automatic AI feedback started", {
        telegramId,
        sessionId: String(sessionId),
        transcriptLength: transcript.length,
      });
      const feedback = await withTimeout(generateAiFeedback(transcript), 25_000, "AI feedback timed out");
      console.log("Telegram automatic AI feedback completed", {
        telegramId,
        sessionId: String(sessionId),
        feedbackLength: feedback.length,
      });
      await ctx.reply(`🤖 <b>AI Feedback</b>\n\n${escapeTelegramHtml(feedback)}`, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Telegram automatic AI feedback failed", {
        message: error instanceof Error ? error.message : String(error),
        telegramId,
        sessionId: String(sessionId),
      });
      await ctx.reply("AI feedback is taking too long. Try again later.");
    }
  } catch (error) {
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

export async function shareResultToGroup(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
) {
  const sessionId = ctx.match[1];
  const groupId = Number(ctx.match[2]);
  if (!Number.isFinite(groupId)) {
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
        transcript: session.transcript,
      }),
      { parse_mode: "HTML" },
    );
    await ctx.answerCbQuery("Shared to the group.");
  } catch (error) {
    console.error("Telegram share to group failed", error);
    await ctx.answerCbQuery("I could not post to the group right now.", { show_alert: true });
  }
}

export async function replyWithAiFeedback(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
) {
  const sessionId = ctx.match[1];
  console.log("Telegram AI feedback handler entered", {
    telegramId,
    sessionId,
  });

  try {
    const userId = await resolveTelegramUser(telegramId);
    if (!userId) {
      await replyWithConnectPrompt(ctx, telegramId);
      return;
    }

    const transcript = await getTelegramSessionTranscript({ userId, sessionId });
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
      console.error("Telegram AI feedback failed", {
        message: error instanceof Error ? error.message : String(error),
        telegramId,
        sessionId,
      });
      await ctx.reply("AI feedback is taking too long. Try again in a moment.");
    }
  } catch (error) {
    console.error("Telegram AI feedback failed", error);
    await ctx.reply(MESSAGES.feedbackError, { parse_mode: "HTML" });
  }
}
