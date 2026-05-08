import type { Context } from "telegraf";
import { getRandomPrompt } from "../core/prompts.js";
import { resolveTelegramUser } from "../core/user.js";
import { supabaseServer } from "../../services/supabaseServer.js";
import {
  getChallengeShareActions,
  getChallengesTableMissingMessage,
  getConnectAccountKeyboard,
  getFriendChallengeAlreadyAcceptedMessage,
  getFriendChallengeReceivedMessage,
  getFriendChallengeShareMessage,
  getGroupChallengeConnectMessage,
  getGroupChallengeEndedMessage,
  getGroupChallengeLeaderboardMessage,
  getGroupChallengeKeyboard,
  getGroupChallengeMessage,
  getGroupChallengeRetryMessage,
  getGroupChallengeCreatorTelegramId,
  getGroupChallengeStatus,
  getNoPauseGroupChallengeKeyboard,
  getNoPauseGroupChallengeMessage,
  getPrivateChallengeMessage,
  isGroupChallengeRecord,
  MESSAGES,
  replyKeyboard,
} from "./constants.js";

const GROUP_CHALLENGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export type FriendChallengeRecord = {
  id: string;
  topic: string;
  creator_telegram_id: number;
  creator_score: number | null;
  status: string;
  created_at: string | null;
};

export type PendingChallengeRecord = {
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

type ChallengeAttemptRecord = {
  id: string;
  telegram_id: number;
  session_id: string | null;
  created_at: string | null;
};

type ChallengeSessionScoreRecord = {
  id: string;
  flow_score: number | null;
};

type ChallengeLeaderboardParticipant = {
  telegramId: number;
  bestFlowScore: number;
  attemptCount: number;
};

export function createChallengeId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function isMissingChallengesTableError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return maybeError?.code === "42P01" || maybeError?.message?.includes("challenges") === true;
}

export function isGroupChallengeExpired(
  challenge: Pick<FriendChallengeRecord, "created_at">,
  now = new Date(),
): boolean {
  if (!challenge.created_at) {
    return false;
  }

  const createdAt = new Date(challenge.created_at).getTime();
  if (!Number.isFinite(createdAt)) {
    return false;
  }

  return now.getTime() - createdAt >= GROUP_CHALLENGE_EXPIRY_MS;
}

function formatTelegramDisplayName(chat: { username?: string; first_name?: string; last_name?: string } | null, telegramId: number): string {
  if (chat?.username) {
    return `@${chat.username}`;
  }

  const fullName = [chat?.first_name, chat?.last_name].filter(Boolean).join(" ").trim();
  return fullName || `@${telegramId}`;
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

export async function createFriendChallenge(input: {
  id: string;
  topic: string;
  creatorTelegramId: number;
}): Promise<FriendChallengeRecord> {
  return createChallenge(input);
}

export async function createGroupChallenge(input: {
  id: string;
  topic: string;
  groupId: number;
  creatorTelegramId: number;
}): Promise<FriendChallengeRecord> {
  return createChallenge({
    id: input.id,
    topic: input.topic,
    creatorTelegramId: input.groupId,
    status: getGroupChallengeStatus(input.creatorTelegramId),
  });
}

export async function updateChallengeTopic(challengeId: string, topic: string) {
  const { error } = await supabaseServer
    .from("challenges")
    .update({ topic })
    .eq("id", challengeId);

  if (error) {
    throw error;
  }
}

export async function getFriendChallenge(challengeId: string): Promise<FriendChallengeRecord | null> {
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

export async function upsertPendingChallenge(input: {
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

export async function getPendingChallenge(telegramId: number): Promise<PendingChallengeRecord | null> {
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

export async function deletePendingChallenge(telegramId: number) {
  const { error } = await supabaseServer
    .from("telegram_challenge_state")
    .delete()
    .eq("telegram_id", telegramId);

  if (error) {
    throw error;
  }
}

export async function recordGroupChallengeAttempt(input: {
  challengeId: string;
  telegramId: number;
  sessionId: string;
}): Promise<number> {
  const { error: insertError } = await supabaseServer
    .from("telegram_challenge_attempts")
    .insert({
      challenge_id: input.challengeId,
      telegram_id: input.telegramId,
      session_id: input.sessionId || null,
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    throw insertError;
  }

  const { count, error: countError } = await supabaseServer
    .from("telegram_challenge_attempts")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", input.challengeId)
    .eq("telegram_id", input.telegramId);

  if (countError) {
    throw countError;
  }

  return Math.max(1, count ?? 1);
}

export async function getGroupChallengeAttemptCount(input: {
  challengeId: string;
  telegramId: number;
}): Promise<number> {
  const { count, error } = await supabaseServer
    .from("telegram_challenge_attempts")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", input.challengeId)
    .eq("telegram_id", input.telegramId);

  if (error) {
    throw error;
  }

  return Math.max(1, count ?? 1);
}

export async function hasSubmittedFriendChallenge(input: {
  challengeId: string;
  telegramId: number;
}): Promise<boolean> {
  const { count, error } = await supabaseServer
    .from("telegram_challenge_attempts")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", input.challengeId)
    .eq("telegram_id", input.telegramId);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

export async function recordFriendChallengeSubmission(input: {
  challengeId: string;
  telegramId: number;
  sessionId: string;
}) {
  if (await hasSubmittedFriendChallenge(input)) {
    return;
  }

  const { error } = await supabaseServer
    .from("telegram_challenge_attempts")
    .insert({
      challenge_id: input.challengeId,
      telegram_id: input.telegramId,
      session_id: input.sessionId || null,
      created_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

export async function getGroupChallengeLeaderboard(challengeId: string): Promise<ChallengeLeaderboardParticipant[]> {
  const { data: attemptsData, error: attemptsError } = await supabaseServer
    .from("telegram_challenge_attempts")
    .select("id, telegram_id, session_id, created_at")
    .eq("challenge_id", challengeId);

  if (attemptsError) {
    throw attemptsError;
  }

  const attempts = (attemptsData ?? []) as ChallengeAttemptRecord[];
  if (attempts.length === 0) {
    return [];
  }

  const sessionIds = Array.from(new Set(
    attempts
      .map((attempt) => attempt.session_id)
      .filter((sessionId): sessionId is string => Boolean(sessionId)),
  ));
  if (sessionIds.length === 0) {
    return [];
  }

  const { data: sessionsData, error: sessionsError } = await supabaseServer
    .from("sessions")
    .select("id, flow_score")
    .in("id", sessionIds);

  if (sessionsError) {
    throw sessionsError;
  }

  const scoreBySessionId = new Map(
    ((sessionsData ?? []) as ChallengeSessionScoreRecord[])
      .flatMap((session) => {
        const score = Number(session.flow_score);
        return Number.isFinite(score) ? [[session.id, Math.round(score)] as const] : [];
      }),
  );
  const byTelegramId = new Map<number, ChallengeLeaderboardParticipant>();

  attempts.forEach((attempt) => {
    const score = attempt.session_id ? scoreBySessionId.get(attempt.session_id) : undefined;
    if (score === undefined) {
      return;
    }

    const current = byTelegramId.get(Number(attempt.telegram_id));
    byTelegramId.set(Number(attempt.telegram_id), {
      telegramId: Number(attempt.telegram_id),
      bestFlowScore: Math.max(current?.bestFlowScore ?? 0, score),
      attemptCount: (current?.attemptCount ?? 0) + 1,
    });
  });

  return Array.from(byTelegramId.values())
    .sort((a, b) => b.bestFlowScore - a.bestFlowScore || a.telegramId - b.telegramId)
    .slice(0, 20);
}

export async function showGroupChallengeLeaderboard(ctx: Context & { match: RegExpExecArray }) {
  const challengeId = ctx.match[1];

  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge || !isGroupChallengeRecord(challenge)) {
      await ctx.answerCbQuery("This challenge is no longer available.", { show_alert: true });
      return;
    }

    const participants = await getGroupChallengeLeaderboard(challenge.id);
    const entries = await Promise.all(participants.map(async (participant, index) => {
      try {
        const chat = await ctx.telegram.getChat(participant.telegramId) as {
          username?: string;
          first_name?: string;
          last_name?: string;
        };
        return {
          rank: index + 1,
          username: formatTelegramDisplayName(chat, participant.telegramId),
          bestFlowScore: participant.bestFlowScore,
          attemptCount: participant.attemptCount,
        };
      } catch (error) {
        console.error("Telegram leaderboard username lookup failed", error);
        return {
          rank: index + 1,
          username: `@${participant.telegramId}`,
          bestFlowScore: participant.bestFlowScore,
          attemptCount: participant.attemptCount,
        };
      }
    }));

    await ctx.answerCbQuery();
    await ctx.reply(getGroupChallengeLeaderboardMessage({
      topic: challenge.topic,
      entries,
      expired: isGroupChallengeExpired(challenge),
    }), { parse_mode: "HTML" });
  } catch (error) {
    console.error("Telegram group leaderboard failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.answerCbQuery("I could not load the leaderboard right now.", { show_alert: true });
  }
}

export async function updateFriendChallengeCreatorScore(challengeId: string, score: number) {
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

export async function replyWithNewFriendChallenge(ctx: Context, telegramId: number) {
  const topic = getRandomPrompt();
  const challengeId = createChallengeId();

  try {
    await createFriendChallenge({
      id: challengeId,
      topic,
      creatorTelegramId: telegramId,
    });

    await ctx.reply(
      getFriendChallengeShareMessage({ topic, challengeId }),
      {
        ...getChallengeShareActions(challengeId, true),
        parse_mode: "HTML",
      },
    );
    await ctx.reply("👆 Forward the message above to your friends so they can accept your challenge!");
  } catch (error) {
    console.error("Telegram challenge creation failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(MESSAGES.challengeCreationError, { ...replyKeyboard, parse_mode: "HTML" });
  }
}

export async function handleChallengeDeepLink(
  ctx: Context,
  telegramId: number,
  challengeId: string,
): Promise<boolean> {
  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge) {
      await ctx.reply(MESSAGES.challengeNotFound, { ...replyKeyboard, parse_mode: "HTML" });
      return true;
    }

    const pendingChallenge = await getPendingChallenge(telegramId);
    if (
      pendingChallenge?.challenge_type === "friend" &&
      pendingChallenge.challenge_id === challenge.id
    ) {
      await ctx.reply(getFriendChallengeAlreadyAcceptedMessage(challenge.topic), { parse_mode: "HTML" });
      return true;
    }

    if (await hasSubmittedFriendChallenge({ challengeId: challenge.id, telegramId })) {
      await ctx.reply(getFriendChallengeAlreadyAcceptedMessage(challenge.topic), { parse_mode: "HTML" });
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
      getFriendChallengeReceivedMessage({ creatorUsername, topic: challenge.topic, challengeId: challenge.id }),
      { parse_mode: "HTML" },
    );
    return true;
  } catch (error) {
    console.error("Telegram challenge deep link failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return true;
    }

    await ctx.reply(MESSAGES.challengeLoadError, { ...replyKeyboard, parse_mode: "HTML" });
    return true;
  }
}

export async function handleGroupChallengeDeepLink(
  ctx: Context,
  telegramId: number,
  challengeId: string,
  participantUsername: string,
): Promise<boolean> {
  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge || !isGroupChallengeRecord(challenge)) {
      await ctx.reply(MESSAGES.groupChallengeGone, { parse_mode: "HTML" });
      return true;
    }

    const groupId = Number(challenge.creator_telegram_id);
    if (isGroupChallengeExpired(challenge)) {
      await ctx.telegram.sendMessage(groupId, getGroupChallengeEndedMessage({ topic: challenge.topic }), {
        parse_mode: "HTML",
      });
      return true;
    }

    const userId = await resolveTelegramUser(telegramId);
    if (!userId) {
      await ctx.telegram.sendMessage(
        groupId,
        getGroupChallengeConnectMessage({ username: participantUsername }),
        { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" },
      );
      return true;
    }

    await upsertPendingChallenge({
      telegramId,
      challengeId: challenge.id,
      challengeType: "group",
      groupId,
      participantUsername,
    });

    await ctx.reply(getPrivateChallengeMessage(challenge.topic), { parse_mode: "HTML" });
    return true;
  } catch (error) {
    console.error("Telegram group challenge deep link failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return true;
    }

    await ctx.reply(MESSAGES.challengeLoadError, { ...replyKeyboard, parse_mode: "HTML" });
    return true;
  }
}

export async function replyWithNewGroupChallenge(ctx: Context, groupId: number, creatorTelegramId: number) {
  const prompt = getRandomPrompt();
  const challengeId = createChallengeId();

  try {
    await createGroupChallenge({
      id: challengeId,
      topic: prompt,
      groupId,
      creatorTelegramId,
    });

    await ctx.reply(getNoPauseGroupChallengeMessage(prompt), {
      ...getNoPauseGroupChallengeKeyboard(challengeId),
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Telegram group challenge creation failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(MESSAGES.groupChallengeCreationError, { parse_mode: "HTML" });
  }
}

export async function changeGroupChallengeTopic(ctx: Context & { match: RegExpExecArray }) {
  const challengeId = ctx.match[1];
  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge) {
      await ctx.answerCbQuery("I could not update this challenge right now.");
      return;
    }

    const creatorTelegramId = getGroupChallengeCreatorTelegramId(challenge);
    if (!creatorTelegramId || ctx.from?.id !== creatorTelegramId) {
      await ctx.answerCbQuery("🔒 Only the person who started this challenge can change the topic.", {
        show_alert: true,
      });
      return;
    }

    const prompt = getRandomPrompt(challenge.topic);
    await updateChallengeTopic(challengeId, prompt);

    await ctx.answerCbQuery();
    await ctx.editMessageText(getNoPauseGroupChallengeMessage(prompt), {
      ...getNoPauseGroupChallengeKeyboard(challengeId),
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Telegram group topic change failed", error);
    await ctx.answerCbQuery("I could not update this challenge right now.", { show_alert: true });
  }
}

export async function sendGroupChallengeTopic(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
  participantUsername: string,
) {
  const challengeId = ctx.match[1];
  const message = ctx.callbackQuery && "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
  const messageId = message?.message_id;
  if (!messageId) {
    await ctx.answerCbQuery("I could not start this challenge right now.");
    return;
  }

  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge) {
      await ctx.answerCbQuery("This challenge topic expired. Start a new Challenge.", { show_alert: true });
      return;
    }

    await ctx.telegram.sendMessage(telegramId, getPrivateChallengeMessage(challenge.topic), { parse_mode: "HTML" });
    await upsertPendingChallenge({
      telegramId,
      challengeId: challenge.id,
      challengeType: "group",
      groupId: Number(challenge.creator_telegram_id),
      groupMessageId: messageId,
      participantUsername,
    });
    await ctx.answerCbQuery("I sent you the topic privately.");
  } catch (error) {
    console.error("Telegram group challenge DM failed", error);
    await ctx.answerCbQuery("Open @NoPauseAI_bot and press Start first. Then tap Speak again.", {
      show_alert: true,
    });
  }
}

export async function retryGroupChallenge(
  ctx: Context & { match: RegExpExecArray },
  telegramId: number,
  participantUsername: string,
) {
  const challengeId = ctx.match[1];

  try {
    const challenge = await getFriendChallenge(challengeId);
    if (!challenge) {
      await ctx.reply(MESSAGES.groupChallengeGone, { parse_mode: "HTML" });
      return;
    }

    const pendingChallenge = await getPendingChallenge(telegramId);
    const groupId = Number(pendingChallenge?.group_id ?? challenge.creator_telegram_id);
    if (isGroupChallengeExpired(challenge)) {
      await ctx.telegram.sendMessage(groupId, getGroupChallengeEndedMessage({ topic: challenge.topic }), {
        parse_mode: "HTML",
      });
      return;
    }

    await upsertPendingChallenge({
      telegramId,
      challengeId: challenge.id,
      challengeType: "group",
      groupId,
      participantUsername,
    });
    await ctx.reply(getGroupChallengeRetryMessage(challenge.topic), { parse_mode: "HTML" });
  } catch (error) {
    console.error("Telegram group retry failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(MESSAGES.challengeRestartError, { parse_mode: "HTML" });
  }
}
