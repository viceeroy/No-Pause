import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { getRandomPrompt } from "../core/prompts.js";
import { buildPracticeStats, getStreak, getTelegramSessions } from "../core/queries.js";
import { escapeTelegramHtml } from "../core/utils.js";
import { resolveTelegramUser } from "../core/user.js";
import {
  ABOUT_LABEL,
  AI_FEEDBACK_ACTION_PREFIX,
  CHANGE_GROUP_TOPIC_ACTION_PREFIX,
  CHANGE_PROMPT_ACTION,
  changePromptKeyboard,
  CHALLENGE_LABEL,
  GET_PROMPT_LABEL,
  getConnectAccountKeyboard,
  getTelegramStatsMessage,
  MESSAGES,
  MY_STATS_LABEL,
  replyKeyboard,
  SEND_CHALLENGE_RESULT_ACTION_PREFIX,
  SHARE_TO_GROUP_ACTION_PREFIX,
  SPEAK_GROUP_TOPIC_ACTION_PREFIX,
  TRY_AGAIN_ACTION,
  TRY_GROUP_CHALLENGE_ACTION_PREFIX,
} from "./constants.js";
import {
  changeGroupChallengeTopic,
  handleChallengeDeepLink,
  replyWithNewFriendChallenge,
  replyWithNewGroupChallenge,
  retryGroupChallenge,
  sendGroupChallengeTopic,
} from "./challenges.js";
import {
  getBotToken,
  getTelegramId,
  getTelegramUsername,
  handleVoiceMessage,
  isGroupChat,
  replyWithAiFeedback,
  replyWithConnectPrompt,
  sendFriendChallengeResult,
  shareResultToGroup,
} from "./voiceHandler.js";

const VOICE_ONLY_MESSAGE = "🎤 NoPause only accepts voice notes. Please send a voice note to get your Flow Score.";

function getStartPayload(ctx: Context): string {
  const message = ctx.message as { text?: unknown } | undefined;
  const text = typeof message?.text === "string" ? message.text : "";
  const [, payload = ""] = text.split(/\s+/, 2);
  return payload.trim();
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
    const [streak, sessionSets] = await Promise.all([
      getStreak(userId),
      getTelegramSessions(userId),
    ]);
    stats = buildPracticeStats(sessionSets.allTimeSessions, streak, sessionSets.monthlySessions);
  } catch (error) {
    console.error("Telegram stats lookup failed", error);
    await ctx.reply(MESSAGES.statsError, { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  if (stats.recentSessions.length === 0) {
    await ctx.reply(MESSAGES.noSessions, { ...replyKeyboard, parse_mode: "HTML" });
    return;
  }

  const modeStats = {
    speaking: stats.modeBreakdown.find((item) => item.mode === "speaking"),
  };

  await ctx.reply(
    getTelegramStatsMessage({
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      bestFlowScore: stats.bestFlowScore,
      avgFlowScore: stats.avgFlowScore,
      scoredSessions: stats.scoredSessions,
      totalPracticeTime: stats.totalPracticeTime,
      monthlySessions: stats.monthlyStats?.totalSessions ?? 0,
      monthlySpeakingTime: stats.monthlyStats?.totalSpeakingTime ?? 0,
      monthlyAvgFlowScore: stats.monthlyStats?.avgFlowScore ?? 0,
      speakingSessions: modeStats.speaking?.totalSessions ?? 0,
      speakingAvgFlowScore: modeStats.speaking?.avgFlowScore ?? null,
      lastSessionText: formatRelativeDate(stats.lastSessionDate),
    }),
    { ...replyKeyboard, parse_mode: "HTML" },
  );
}

export function createTelegramBot() {
  const bot = new Telegraf(getBotToken());

  void bot.telegram.setMyCommands([
    { command: "start", description: "Start or connect NoPause" },
    { command: "stats", description: "View your speaking stats" },
    { command: "scoring", description: "See how scoring works" },
    { command: "challenge", description: "Learn about challenges" },
    { command: "nopause", description: "Start a group challenge" },
    { command: "about", description: "About NoPause" },
  ]).catch((error) => {
    console.error("Telegram command menu registration failed", error);
  });

  bot.start(async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.reply(MESSAGES.welcomeIdentify, { parse_mode: "HTML" });
      return;
    }

    const startPayload = getStartPayload(ctx);
    if (startPayload.startsWith("challenge_")) {
      const handled = await handleChallengeDeepLink(ctx, telegramId, startPayload.replace(/^challenge_/, ""));
      if (handled) return;
    }

    await ctx.reply(MESSAGES.welcome, { ...getConnectAccountKeyboard(telegramId), parse_mode: "HTML" });
  });

  bot.command("status", async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply(MESSAGES.statsPrivate, { parse_mode: "HTML" });
      return;
    }

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.command("scoring", async (ctx) => {
    await ctx.reply(MESSAGES.scoringInfo, { parse_mode: "HTML" });
  });

  bot.command("challenge", async (ctx) => {
    await ctx.reply(MESSAGES.challengeInfo, { parse_mode: "HTML" });
  });

  bot.command("stats", async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply(MESSAGES.statsPrivate, { parse_mode: "HTML" });
      return;
    }

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithStatus(ctx, telegramId);
  });

  bot.command("about", async (ctx) => {
    await ctx.reply(MESSAGES.about, { ...replyKeyboard, parse_mode: "HTML" });
  });

  bot.command("prompt", async (ctx) => {
    await replyWithPrompt(ctx);
  });

  bot.command("nopause", async (ctx) => {
    if (!isGroupChat(ctx)) {
      await ctx.reply("👥 This command only works in groups. Add NoPause to a group to start a group challenge.");
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    await replyWithNewGroupChallenge(ctx, chatId);
  });

  bot.hears(CHALLENGE_LABEL, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    await replyWithNewFriendChallenge(ctx, telegramId);
  });

  bot.hears(MY_STATS_LABEL, async (ctx) => {
    if (isGroupChat(ctx)) {
      await ctx.reply(MESSAGES.statsPrivate, { parse_mode: "HTML" });
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
    await ctx.reply(MESSAGES.about, { ...replyKeyboard, parse_mode: "HTML" });
  });

  bot.action(new RegExp(`^${CHANGE_GROUP_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    await changeGroupChallengeTopic(ctx);
  });

  bot.action(new RegExp(`^${SPEAK_GROUP_TOPIC_ACTION_PREFIX}(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.answerCbQuery("I could not start this challenge right now.");
      return;
    }

    await sendGroupChallengeTopic(ctx, telegramId, getTelegramUsername(ctx));
  });

  bot.action(new RegExp(`^${SEND_CHALLENGE_RESULT_ACTION_PREFIX}([^:]+):(.+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.answerCbQuery("I could not find your challenge result right now.", { show_alert: true });
      return;
    }

    await sendFriendChallengeResult(ctx, telegramId);
  });

  bot.action(new RegExp(`^${SHARE_TO_GROUP_ACTION_PREFIX}([^:]+):(-?\\d+)$`), async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      await ctx.answerCbQuery("I could not find a recent group challenge result right now.", { show_alert: true });
      return;
    }

    await shareResultToGroup(ctx, telegramId);
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

    await replyWithAiFeedback(ctx, telegramId);
  });

  bot.on(["photo", "video", "document", "sticker", "audio", "animation", "video_note"], async (ctx) => {
    await ctx.reply(VOICE_ONLY_MESSAGE);
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
