import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { getRandomPrompt } from "../core/prompts.js";
import { getTelegramChallengeCounts, getTelegramPracticeStats, getTelegramWeeklyStatsComparison } from "../core/queries.js";
import { escapeTelegramHtml } from "../core/utils.js";
import { resolveTelegramUser } from "../core/user.js";
import {
  AI_FEEDBACK_ACTION_PREFIX,
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
  replyWithAiFeedback,
  replyWithConnectPrompt,
  shareCreatorChallengeResult,
  sendFriendChallengeResult,
  postGroupChallengeResultToGroup,
  TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from "./voiceHandler.js";

const VOICE_ONLY_MESSAGE = "🎤 NoPause only accepts voice notes. Please send a voice note to get your Flow Score.";

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

async function replyWithPrompt(ctx: Context) {
  const prompt = getRandomPrompt();

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
  let weeklyStats;
  try {
    [stats, weeklyStats] = await Promise.all([
      getTelegramPracticeStats(userId),
      getTelegramWeeklyStatsComparison(userId),
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
      weeklyBestFlowScore: weeklyStats.currentWeek.bestFlowScore,
      weeklyAvgFlowScore: weeklyStats.currentWeek.avgFlowScore,
      weeklySessionCount: weeklyStats.currentWeek.sessionCount,
      totalSessions: stats.totalSessions,
      totalPracticeTime: stats.totalPracticeTime,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      lastSessionDate: stats.lastSessionDate,
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
    { command: "about", description: "About NoPause" },
    { command: "stats", description: "View your stats" },
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

  bot.command("about", async (ctx) => {
    if (isGroupChat(ctx)) return;

    await ctx.reply(MESSAGES.about, { ...replyKeyboard, parse_mode: "HTML" });
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

  bot.command("stats", async (ctx) => {
    if (isGroupChat(ctx)) return;

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
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

    await replyWithNewFriendChallenge(ctx, telegramId);
  });

  bot.hears(SPEAK_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) return;

    await ctx.reply(MESSAGES.speakPrivate, { ...speakPromptKeyboard, parse_mode: "HTML" });
  });

  bot.action(new RegExp(`^${CHANGE_GROUP_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await changeGroupChallengeTopic(ctx);
  });

  bot.action(new RegExp(`^${SEND_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.answerCbQuery("I could not find your challenge result right now.", { show_alert: true });
      return;
    }

    await sendFriendChallengeResult(ctx, telegramId);
  });

  bot.action(new RegExp(`^${SHARE_CREATOR_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):([^:]+):(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.answerCbQuery(MESSAGES.challengeResultMissing, { show_alert: true });
      return;
    }

    await shareCreatorChallengeResult(ctx, telegramId);
  });

  bot.action(new RegExp(`^${POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.answerCbQuery("I could not find a recent group challenge result right now.", { show_alert: true });
      return;
    }

    await postGroupChallengeResultToGroup(ctx, telegramId);
  });

  bot.action(new RegExp(`^${GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await showGroupChallengeLeaderboard(ctx);
  });

  bot.action(CHANGE_PROMPT_ACTION, async (ctx) => {
    const prompt = getRandomPrompt();

    await ctx.answerCbQuery();
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

  bot.action(new RegExp(`^${AI_FEEDBACK_ACTION_PREFIX}(.+)$`), async (ctx) => {
    try {
      ctx.telegram.webhookReply = false;
      await ctx.answerCbQuery();
      console.log("Telegram AI feedback callback received", {
        callbackData: "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined,
        sessionId: ctx.match?.[1],
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
        fromId: ctx.from?.id,
      });
      const telegramId = getTelegramId(ctx);

      if (!telegramId) {
        await ctx.reply(MESSAGES.feedbackIdentifyError, { parse_mode: "HTML" });
        return;
      }

      console.log("Telegram AI feedback handler dispatching", {
        telegramId,
        sessionId: ctx.match?.[1],
      });
      await replyWithAiFeedback(ctx, telegramId);
    } catch (error) {
      console.error("Telegram AI feedback callback failed", {
        message: error instanceof Error ? error.message : String(error),
        sessionId: ctx.match?.[1],
        fromId: ctx.from?.id,
      });
      await ctx.reply(TELEGRAM_AI_FEEDBACK_TEMPORARILY_UNAVAILABLE_MESSAGE);
    }
  });

  bot.on(["photo", "video", "document", "sticker", "audio", "animation", "video_note"], async (ctx) => {
    await ctx.reply(VOICE_ONLY_MESSAGE);
  });

  bot.on("voice", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await handleVoiceMessage(ctx, telegramId);
  });

  bot.catch((error, ctx) => {
    console.error("Telegram bot error", error);
    ctx.reply(MESSAGES.analysisError, { parse_mode: "HTML" }).catch(() => undefined);
  });

  return bot;
}
