import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { pickPromptForUser } from "../../services/userPrompts.js";
import { getTelegramChallengeCounts, getTelegramPracticeStats } from "../core/queries.js";
import { escapeTelegramHtml } from "../core/utils.js";
import { resolveTelegramUser } from "../core/user.js";
import { supabaseServer } from "../../services/supabaseServer.js";
import {
  CHANGE_FRIEND_TOPIC_ACTION_PREFIX,
  CHANGE_GROUP_TOPIC_ACTION_PREFIX,
  CHANGE_PROMPT_ACTION,
  changePromptKeyboard,
  CHALLENGE_LABEL,
  GET_PROMPT_ACTION,
  getConnectAccountKeyboard,
  getNoPauseGroupWelcomeMessage,
  getTelegramStatsMessage,
  GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX,
  MESSAGES,
  MY_STATS_LABEL,
  POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX,
  replyKeyboard,
  SEND_CHALLENGE_RESULT_ACTION_PREFIX,
  SHARE_CREATOR_CHALLENGE_RESULT_ACTION_PREFIX,
  SPEAK_LABEL,
  speakPromptKeyboard,
  TELEGRAM_BOT_USERNAME,
  TRY_AGAIN_ACTION,
  TRY_GROUP_CHALLENGE_ACTION_PREFIX,
} from "./constants.js";
import {
  changeFriendChallengeTopic,
  changeGroupChallengeTopic,
  handleChallengeDeepLink,
  handleGroupChallengeDeepLink,
  replyWithNewFriendChallenge,
  replyWithNewGroupChallenge,
  retryGroupChallenge,
  showGroupChallengeLeaderboard,
} from "./challenges.js";
import {
  getBotToken,
  getTelegramId,
  getTelegramUsername,
  handleVoiceMessage,
  isGroupChat,
  replyWithConnectPrompt,
  shareCreatorChallengeResult,
  sendFriendChallengeResult,
  postGroupChallengeResultToGroup,
} from "./voiceHandler.js";

function getStartPayload(ctx: Context): string {
  const message = ctx.message as { text?: unknown } | undefined;
  const text = typeof message?.text === "string" ? message.text : "";
  const [, payload = ""] = text.split(/\s+/, 2);
  return payload.trim();
}

function getDebugStackSnippet() {
  return new Error().stack?.split("\n").slice(1, 6).join("\n");
}

function wasNoPauseAddedToGroup(ctx: Context): boolean {
  const message = ctx.message as { new_chat_members?: Array<{ username?: string }> } | undefined;
  return Boolean(
    isGroupChat(ctx) &&
      message?.new_chat_members?.some((member) => member.username === TELEGRAM_BOT_USERNAME),
  );
}

async function resolveUserIdForPrompt(ctx: Context): Promise<string | null> {
  const telegramId = getTelegramId(ctx);
  if (!telegramId) return null;
  try {
    return await resolveTelegramUser(telegramId);
  } catch (error) {
    console.error("Telegram user lookup failed for prompt", error);
    return null;
  }
}

async function replyWithPrompt(ctx: Context) {
  const userId = await resolveUserIdForPrompt(ctx);
  const prompt = await pickPromptForUser(userId);

  const formattedMessage = isGroupChat(ctx)
    ? `💬 <b>Prompt</b>\n\n<b>For:</b>\n${escapeTelegramHtml(getTelegramUsername(ctx))}\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`
    : `💬 <b>Prompt</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`;
  await ctx.reply(formattedMessage, { ...changePromptKeyboard, parse_mode: "HTML" });
}

async function replyWithStatus(ctx: Context, telegramId: number) {
  let userId: string | null;
  try {
    userId = await resolveTelegramUser(telegramId);
  } catch (error) {
    console.error("Telegram stats connection lookup failed", error);
    await ctx.reply(MESSAGES.lookupError, { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  if (!userId) {
    await replyWithConnectPrompt(ctx, telegramId);
    return;
  }
  console.log("resolved user_id:", userId);

  let stats;
  let fullName: string | null = null;
  let email: string | null = null;
  try {
    [stats] = await Promise.all([
      getTelegramPracticeStats(userId),
      supabaseServer.auth.admin.getUserById(userId).then(({ data }) => {
        if (data?.user) {
          fullName = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null;
          email = data.user.email ?? null;
        }
      }),
    ]);
  } catch (error) {
    console.error("Telegram stats lookup failed", error);
    await ctx.reply(MESSAGES.statsError, { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  if (stats.recentSessions.length === 0) {
    await ctx.reply(MESSAGES.noSessions, { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  const challengeCounts = await getTelegramChallengeCounts(telegramId);

  await ctx.reply(
    getTelegramStatsMessage({
      fullName,
      email,
      bestFlowScore: stats.bestFlowScore,
      avgFlowScore: stats.avgFlowScore,
      totalSessions: stats.totalSessions,
      totalPracticeTime: stats.totalPracticeTime,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      friendChallenges: challengeCounts.friendChallenges,
      groupChallenges: challengeCounts.groupChallenges,
    }),
    { ...replyKeyboard, parse_mode: "HTML" },
  );
}

export function createTelegramBot() {
  const bot = new Telegraf(getBotToken());

  void bot.telegram.setMyCommands([
    { command: "start", description: "Start or connect NoPause" },
    { command: "register", description: "Connect or switch account" },
  ], { scope: { type: "all_private_chats" } }).catch((error) => {
    console.error("Telegram command menu registration failed", error);
  });
  void bot.telegram.setMyCommands([
    { command: "nopause", description: "Start a group challenge" },
  ], { scope: { type: "all_group_chats" } }).catch((error) => {
    console.error("Telegram group command menu registration failed", error);
  });

  bot.start(async (ctx) => {
    if (isGroupChat(ctx)) return;

    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      console.log("Telegram welcome debug", {
        triggerSource: "router.ts:bot.start:welcomeIdentify",
        telegramId,
        stack: getDebugStackSnippet(),
      });
      await ctx.reply(MESSAGES.welcomeIdentify, { parse_mode: "HTML" });
      return;
    }

    const startPayload = getStartPayload(ctx);
    if (startPayload.startsWith("challenge_")) {
      const handled = await handleChallengeDeepLink(ctx, telegramId, startPayload.replace(/^challenge_/, ""));
      if (handled) return;
    }
    if (startPayload.startsWith("group_")) {
      const handled = await handleGroupChallengeDeepLink(
        ctx,
        telegramId,
        startPayload.replace(/^group_/, ""),
        getTelegramUsername(ctx),
      );
      if (handled) return;
    }

    console.log("Telegram welcome debug", {
      triggerSource: "router.ts:bot.start:welcome",
      telegramId,
      stack: getDebugStackSnippet(),
    });
    const userId = await resolveTelegramUser(telegramId);
    if (userId) {
      await ctx.reply(MESSAGES.welcomeBack, { ...replyKeyboard, parse_mode: "HTML" });
      return;
    }

    await ctx.reply(MESSAGES.welcome, { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" });
  });

  bot.command("register", async (ctx) => {
    if (isGroupChat(ctx)) return;

    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.reply(MESSAGES.welcomeIdentify, { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(MESSAGES.register, { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" });
  });

  bot.command("nopause", async (ctx) => {
    if (!isGroupChat(ctx)) return;
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithNewGroupChallenge(ctx, Number(ctx.chat.id), telegramId);
  });

  bot.on("new_chat_members", async (ctx) => {
    if (!wasNoPauseAddedToGroup(ctx)) return;

    await ctx.reply(getNoPauseGroupWelcomeMessage(), { parse_mode: "HTML" });
  });

  bot.hears(CHALLENGE_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) return;

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    console.log('[NoPause:challenge] challenge label pressed', { telegram_id: telegramId, chat_type: ctx.chat?.type });
    await replyWithNewFriendChallenge(ctx, telegramId);
  });

  bot.hears(SPEAK_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) return;

    await ctx.reply(MESSAGES.speakPrivate, { ...speakPromptKeyboard, parse_mode: "HTML" });
  });

  bot.hears(MY_STATS_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) return;

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.action(new RegExp(`^${CHANGE_GROUP_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    // Do not pre-answer here: changeGroupChallengeTopic owns answerCbQuery on
    // every path and uses it to surface permission/error alerts. A bare
    // pre-answer would consume the query, hiding those alerts and risking a
    // throw on the duplicate answer that skips the topic edit.
    console.log('[NoPause:challenge] callback', { action: 'change_group_topic', telegram_id: getTelegramId(ctx), challenge_id: ctx.match?.[1] });
    await changeGroupChallengeTopic(ctx);
  });

  bot.action(new RegExp(`^${CHANGE_FRIEND_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    console.log('[NoPause:challenge] callback', { action: 'change_friend_topic', telegram_id: getTelegramId(ctx), challenge_id: ctx.match?.[1] });
    await changeFriendChallengeTopic(ctx);
  });

  bot.action(new RegExp(`^${SEND_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const placeholderMsg = await ctx.reply("⏳ Sending result...");
    const telegramId = getTelegramId(ctx);
    console.log('[NoPause:challenge] callback', { action: 'send_challenge_result', telegram_id: telegramId, challenge_id: ctx.match?.[1] });
    if (!telegramId) {
      return;
    }

    await sendFriendChallengeResult(ctx, telegramId, placeholderMsg.message_id);
  });

  bot.action(new RegExp(`^${SHARE_CREATOR_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):([^:]+):(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const placeholderMsg = await ctx.reply("⏳ Sending result...");
    const telegramId = getTelegramId(ctx);
    console.log('[NoPause:challenge] callback', { action: 'share_creator_challenge_result', telegram_id: telegramId, challenge_id: ctx.match?.[1] });
    if (!telegramId) {
      return;
    }

    await shareCreatorChallengeResult(ctx, telegramId, placeholderMsg.message_id);
  });

  bot.action(new RegExp(`^${POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    const placeholderMsg = await ctx.reply("⏳ Sending result...");
    const telegramId = getTelegramId(ctx);
    console.log('[NoPause:challenge] callback', { action: 'post_group_challenge_result', telegram_id: telegramId, challenge_id: ctx.match?.[1] });
    if (!telegramId) {
      return;
    }

    await postGroupChallengeResultToGroup(ctx, telegramId, placeholderMsg.message_id);
  });

  bot.action(new RegExp(`^${GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await ctx.answerCbQuery();
    console.log('[NoPause:challenge] callback', { action: 'group_challenge_leaderboard', telegram_id: getTelegramId(ctx), challenge_id: ctx.match?.[1] });
    await showGroupChallengeLeaderboard(ctx);
  });

  bot.action(CHANGE_PROMPT_ACTION, async (ctx) => {
    // Answer first so the button's loading spinner clears instantly; this
    // handler shows no alert, so there is nothing to lose by answering early.
    await ctx.answerCbQuery();
    const userId = await resolveUserIdForPrompt(ctx);
    const prompt = await pickPromptForUser(userId);

    const message = isGroupChat(ctx)
      ? `💬 <b>Prompt</b>\n\n<b>For:</b>\n${escapeTelegramHtml(getTelegramUsername(ctx))}\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`
      : `💬 <b>Prompt</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(prompt)}`;
    await ctx.editMessageText(message, { ...changePromptKeyboard, parse_mode: "HTML" });
  });

  bot.action(GET_PROMPT_ACTION, async (ctx) => {
    await ctx.answerCbQuery();
    await replyWithPrompt(ctx);
  });

  bot.action(TRY_AGAIN_ACTION, async (ctx) => {
    console.log('[NoPause:challenge] callback', { action: 'try_again', telegram_id: getTelegramId(ctx) });
    await ctx.answerCbQuery();
    if (isGroupChat(ctx)) {
      await ctx.reply(
        `🎤 <b>Ready when you are</b>\n\n<b>For:</b>\n${escapeTelegramHtml(getTelegramUsername(ctx))}\n\nJust send a voice note and let's see what you've got.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    await ctx.reply(MESSAGES.readyPrivate, { ...replyKeyboard, parse_mode: "HTML" });
  });

  bot.action(new RegExp(`^${TRY_GROUP_CHALLENGE_ACTION_PREFIX}(.+)$`), async (ctx) => {
    console.log('[NoPause:challenge] callback', { action: 'try_group_challenge', telegram_id: getTelegramId(ctx), challenge_id: ctx.match?.[1] });
    console.log("Telegram group retry button pressed", {
      callbackData: "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined,
      match: ctx.match?.[1],
      chatId: ctx.chat?.id,
      chatType: ctx.chat?.type,
      fromId: ctx.from?.id,
    });
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    console.log("Telegram group retry telegramId read", {
      telegramId,
      challengeId: ctx.match?.[1],
    });
    if (!telegramId) return;

    console.log("Telegram group retry calling retryGroupChallenge", {
      telegramId,
      challengeId: ctx.match?.[1],
      username: getTelegramUsername(ctx),
    });
    await retryGroupChallenge(ctx, telegramId, getTelegramUsername(ctx));
  });

  bot.on("voice", async (ctx) => {
    // Bot ignores voice notes sent in group chats. Challenge attempts happen
    // only in the bot DM after the user taps Speak and starts the bot there.
    if (isGroupChat(ctx)) return;

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await handleVoiceMessage(ctx, telegramId);
  });

  bot.catch((error, ctx) => {
    console.error("Telegram bot error", error);
    // Only surface a user-facing error in private chats. In groups this
    // catch-all would otherwise spam the voice-analysis error for unrelated
    // failures (e.g. stale callback-query taps on old inline buttons), which
    // is both the wrong message and visible to everyone in the group.
    if (ctx.chat?.type === "private") {
      ctx.reply(MESSAGES.analysisError, { parse_mode: "HTML" }).catch(() => undefined);
    }
  });

  return bot;
}
