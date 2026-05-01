import { Markup } from "telegraf";
import { APP_URL } from "../core/constants.js";
import { escapeTelegramHtml } from "../core/utils.js";

export const SITE_URL = APP_URL;
export const TELEGRAM_BOT_USERNAME = "NoPauseAI_bot";

export const CHALLENGE_LABEL = "⚔️ Challenge";
export const MY_STATS_LABEL = "📈 My Stats";
export const GET_PROMPT_LABEL = "💡 Get Prompt";
export const ABOUT_LABEL = "ℹ️ About";

export const CHANGE_PROMPT_ACTION = "change_prompt";
export const CHANGE_GROUP_TOPIC_ACTION_PREFIX = "cg:";
export const SPEAK_GROUP_TOPIC_ACTION_PREFIX = "sg:";
export const SHARE_TO_GROUP_ACTION_PREFIX = "shg:";
export const SEND_CHALLENGE_RESULT_ACTION_PREFIX = "scr:";
export const TRY_GROUP_CHALLENGE_ACTION_PREFIX = "tg:";
export const TRY_AGAIN_ACTION = "try_again:free_speaking";
export const AI_FEEDBACK_ACTION_PREFIX = "ai_feedback:";

export const TELEGRAM_CHALLENGE_TABLES_SQL = `create table if not exists public.challenges (
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

export type FlowAnalysis = {
  flowScore: number;
  pauseCount: number;
  hesitationCount: number;
  speakingTimeSec: number;
  totalSessionTimeSec: number;
  isCompleted: boolean;
  pauseLog: Array<{ timestamp: number; duration: number; units: number }>;
};

export const replyKeyboard = Markup.keyboard([
  [CHALLENGE_LABEL, MY_STATS_LABEL, GET_PROMPT_LABEL],
  [ABOUT_LABEL],
]).resize();

export const changePromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Change Prompt", CHANGE_PROMPT_ACTION),
]);

export const groupTryAgainKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION),
]);

export function getGroupChallengeKeyboard(challengeId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🗣 Speak", `${SPEAK_GROUP_TOPIC_ACTION_PREFIX}${challengeId}`),
      Markup.button.callback("🔄 Change Topic", `${CHANGE_GROUP_TOPIC_ACTION_PREFIX}${challengeId}`),
    ],
  ]);
}

export function getTelegramShareUrl(input: { url: string; text?: string }): string {
  const params = new URLSearchParams({ url: input.url });
  if (input.text) {
    params.set("text", input.text);
  }

  return `https://t.me/share/url?${params.toString()}`;
}

export function getChallengeDeepLink(challengeId: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=challenge_${encodeURIComponent(challengeId)}`;
}

export function getChallengesTableMissingMessage(): string {
  return `⚠️ <b>Setup needed</b>\n\n<b>Issue:</b>\nI could not find the Supabase Telegram challenge tables.\n\n<b>SQL:</b>\n<pre>${escapeTelegramHtml(TELEGRAM_CHALLENGE_TABLES_SQL)}</pre>`;
}

export function getGroupChallengeMessage(topic: string): string {
  return `⚔️ <b>Group Challenge</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(topic)}\n\n<b>Action:</b>\nTap Speak and I will send it privately 🎤`;
}

export function getPrivateChallengeMessage(topic: string): string {
  return `⚔️ <b>Group Challenge</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(topic)}\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤`;
}

export function getGroupResultText(input: {
  username: string;
  topic: string;
  analysis: FlowAnalysis;
}): string {
  return `🎤 Group Challenge Result\n\nSpeaker:\n${input.username}\n\nTopic:\n${input.topic}\n\nFlow Score:\n${input.analysis.flowScore}\n\nPauses:\n${input.analysis.pauseCount}\n\nHesitations:\n${input.analysis.hesitationCount}\n\nSpeaking time:\n${input.analysis.speakingTimeSec}s`;
}

export function getGroupShareResultMessage(input: {
  firstName: string;
  username?: string;
  analysis: FlowAnalysis;
}): string {
  const usernameText = input.username ? `(@${escapeTelegramHtml(input.username)})` : "";
  const nameLine = [escapeTelegramHtml(input.firstName), usernameText].filter(Boolean).join(" ");

  return `🎤 <b>Group Challenge Result</b>\n\n<b>Speaker:</b>\n${nameLine}\n\n<b>Flow Score:</b>\n${input.analysis.flowScore}\n\n<b>Pauses:</b>\n${input.analysis.pauseCount}\n\n<b>Hesitations:</b>\n${input.analysis.hesitationCount}\n\n<b>Speaking time:</b>\n${input.analysis.speakingTimeSec}s`;
}

export function getResultShareUrl(resultText: string): string {
  return getTelegramShareUrl({ url: SITE_URL, text: resultText });
}

export function getGroupChallengeResultActions(input: {
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

export function getChallengeShareActions(challengeId: string, topic: string) {
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

export function getFriendChallengeResultActions(input: {
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

export function getChallengeResultMessage(input: { topic: string; analysis: FlowAnalysis }): string {
  return `⚔️ <b>Challenge Result</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(input.topic)}\n\n<b>Flow Score:</b>\n${input.analysis.flowScore}\n\n<b>Pauses:</b>\n${input.analysis.pauseCount}\n\n<b>Hesitations:</b>\n${input.analysis.hesitationCount}\n\n<b>Speaking time:</b>\n${input.analysis.speakingTimeSec}s`;
}

export function getChallengeCreatorNotification(input: {
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

export function getConnectUrl(telegramId: number): string {
  return `${SITE_URL}/connect?tg=${encodeURIComponent(String(telegramId))}`;
}

export function getSessionActions(sessionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION),
      Markup.button.callback("🤖 AI Feedback", `${AI_FEEDBACK_ACTION_PREFIX}${sessionId}`),
    ],
    [Markup.button.url("📊 View on NoPause", SITE_URL)],
  ]);
}

export function getConnectAccountKeyboard(telegramId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.url("🔑 Connect Account", getConnectUrl(telegramId))],
  ]);
}

export const MESSAGES = {
  connectPrompt:
    "👋 <b>Connect your account</b>\n\n<b>Status:</b>\nYour NoPause account is not connected yet.\n\n<b>Action:</b>\nConnect first to get your Flow Score.",
  statsError:
    "⚠️ <b>Stats error</b>\n\n<b>Status:</b>\nI could not load your stats right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
  noSessions:
    "📊 <b>No sessions yet</b>\n\n<b>Status:</b>\nYou do not have any practice sessions yet.\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤",
  challengeCreationError:
    "⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not create a challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
  groupChallengeCreationError:
    "⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not create a group challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
  challengeNotFound:
    "⚠️ <b>Challenge not found</b>\n\n<b>Status:</b>\nI could not find that challenge.\n\n<b>Action:</b>\nAsk your friend to send a fresh challenge link.",
  challengeLoadError:
    "⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not load that challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
  challengeRestartError:
    "⚠️ <b>Challenge error</b>\n\n<b>Status:</b>\nI could not restart that challenge right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
  groupChallengeGone:
    "⚠️ <b>Challenge not found</b>\n\n<b>Status:</b>\nI could not find that group challenge anymore.\n\n<b>Action:</b>\nAsk the group to run /nopause again.",
  voiceReceived:
    "🎧 <b>Voice note received</b>\n\n<b>Status:</b>\nAnalyzing your voice note now.",
  unusableTranscript: "Couldn't hear anything clearly. Please speak louder and try again 🎤",
  analysisError:
    "⚠️ <b>Analysis error</b>\n\n<b>Status:</b>\nI hit an issue analyzing that voice note.\n\n<b>Action:</b>\nPlease try again in a moment.",
  feedbackIdentifyError:
    "⚠️ <b>Feedback error</b>\n\n<b>Status:</b>\nI could not identify your Telegram account.",
  feedbackTranscriptMissing:
    "⚠️ <b>Feedback error</b>\n\n<b>Status:</b>\nI could not find the transcript for that session.\n\n<b>Action:</b>\nSend a new voice note and try again.",
  feedbackError:
    "⚠️ <b>Feedback error</b>\n\n<b>Status:</b>\nI could not generate feedback right now.\n\n<b>Action:</b>\nPlease try again in a moment.",
  statsPrivate:
    "📊 <b>Stats are private</b>\n\n<b>Action:</b>\nOpen @NoPauseAI_bot directly to view your stats.",
  readyPrivate:
    "🎤 <b>Ready when you are</b>\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤",
  welcomeIdentify:
    "👋 <b>Welcome to NoPause</b>\n\n<b>Status:</b>\nI could not identify your Telegram account.",
  welcome:
    "👋 <b>Welcome to NoPause</b>\n\n<b>What it does:</b>\nTrack your speaking fluency.\nReduce pauses.\nImprove your Flow Score.\n\n<b>Action:</b>\nConnect your account to get started.",
};
