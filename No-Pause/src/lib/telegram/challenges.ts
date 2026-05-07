import type { Context } from "telegraf";
import { getRandomPrompt } from "../core/prompts.js";
import { supabaseServer } from "../../services/supabaseServer.js";
import {
  getChallengeShareActions,
  getChallengesTableMissingMessage,
  getFriendChallengeReceivedMessage,
  getFriendChallengeShareMessage,
  getGroupChallengeKeyboard,
  getGroupChallengeMessage,
  getPrivateChallengeMessage,
  MESSAGES,
  replyKeyboard,
} from "./constants.js";

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

export function createChallengeId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function isMissingChallengesTableError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  return maybeError?.code === "42P01" || maybeError?.message?.includes("challenges") === true;
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
}): Promise<FriendChallengeRecord> {
  return createChallenge({
    id: input.id,
    topic: input.topic,
    creatorTelegramId: input.groupId,
    status: "group_pending",
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

export async function replyWithNewGroupChallenge(ctx: Context, groupId: number) {
  const prompt = getRandomPrompt();
  const challengeId = createChallengeId();

  try {
    await createGroupChallenge({
      id: challengeId,
      topic: prompt,
      groupId,
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

    const creatorTelegramId = String(challenge.creator_telegram_id);
    const userTelegramId = ctx.from?.id === undefined ? null : String(ctx.from.id);
    const chatId = ctx.chat?.id === undefined ? null : String(ctx.chat.id);
    if (creatorTelegramId !== userTelegramId && creatorTelegramId !== chatId) {
      await ctx.answerCbQuery("Only the person who started the challenge can change the topic.", {
        show_alert: true,
      });
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
  console.log("Telegram retryGroupChallenge started", {
    telegramId,
    challengeId,
    participantUsername,
  });

  try {
    console.log("Telegram retryGroupChallenge fetching challenge", {
      challengeId,
    });
    const challenge = await getFriendChallenge(challengeId);
    console.log("Telegram retryGroupChallenge challenge fetched", {
      challengeId,
      found: Boolean(challenge),
      creatorTelegramId: challenge?.creator_telegram_id,
      status: challenge?.status,
    });
    if (!challenge) {
      console.log("Telegram retryGroupChallenge challenge missing, replying gone", {
        challengeId,
      });
      await ctx.reply(MESSAGES.groupChallengeGone, { parse_mode: "HTML" });
      return;
    }

    const pendingChallenge = await getPendingChallenge(telegramId);
    const groupId = Number(pendingChallenge?.group_id ?? challenge.creator_telegram_id);

    console.log("Telegram retryGroupChallenge calling upsertPendingChallenge", {
      telegramId,
      challengeId: challenge.id,
      challengeType: "group",
      groupId,
      participantUsername,
    });
    await upsertPendingChallenge({
      telegramId,
      challengeId: challenge.id,
      challengeType: "group",
      groupId,
      participantUsername,
    });
    console.log("Telegram retryGroupChallenge upsertPendingChallenge completed", {
      telegramId,
      challengeId: challenge.id,
    });
    console.log("Telegram retryGroupChallenge sending retry prompt reply", {
      telegramId,
      challengeId: challenge.id,
      topicLength: challenge.topic.length,
    });
    await ctx.reply(getPrivateChallengeMessage(challenge.topic), { parse_mode: "HTML" });
    console.log("Telegram retryGroupChallenge retry prompt reply sent", {
      telegramId,
      challengeId: challenge.id,
    });
  } catch (error) {
    console.error("Telegram group retry failed", error);
    if (isMissingChallengesTableError(error)) {
      await ctx.reply(getChallengesTableMissingMessage(), { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(MESSAGES.challengeRestartError, { parse_mode: "HTML" });
  }
}
