import { Markup } from "telegraf";
import { APP_URL } from "../core/constants.js";
import { escapeTelegramHtml } from "../core/utils.js";

export const SITE_URL = APP_URL;
export const TELEGRAM_BOT_USERNAME = "NoPauseAI_bot";

export const CHALLENGE_LABEL = "⚔️ Challenge";
export const MY_STATS_LABEL = "📈 My Stats";
export const SPEAK_LABEL = "🎤 Speak";
export const GET_PROMPT_LABEL = "💡 Get Prompt";
export const ABOUT_LABEL = "ℹ️ About";

export const GET_PROMPT_ACTION = "get_prompt";
export const CHANGE_PROMPT_ACTION = "change_prompt";
export const CHANGE_GROUP_TOPIC_ACTION_PREFIX = "cg:";
export const POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX = "pgr:";
export const SEND_CHALLENGE_RESULT_ACTION_PREFIX = "scr:";
export const SHARE_CREATOR_CHALLENGE_RESULT_ACTION_PREFIX = "ccr:";
export const TRY_GROUP_CHALLENGE_ACTION_PREFIX = "tg:";
export const TRY_AGAIN_ACTION = "try_again:speaking";
export const GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX = "gcl:";
export const GROUP_CHALLENGE_STATUS_PREFIX = "group_pending";
const TELEGRAM_SAFE_MESSAGE_LENGTH = 4000;
const TRUNCATED_TRANSCRIPT_NOTE = "... (truncated)";

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
);

create table if not exists public.telegram_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.challenges(id) on delete cascade,
  telegram_id bigint not null,
  session_id uuid,
  created_at timestamptz not null default now()
);`;

export type FlowAnalysis = {
  flowScore: number;
  pauseCount: number;
  totalSilenceSec: number;
  speakingTimeSec: number;
  totalSessionTimeSec: number;
  isCompleted: boolean;
  pauseLog: Array<{ timestamp: number; duration: number; units: number }>;
};

export const replyKeyboard = Markup.keyboard([
  [SPEAK_LABEL, CHALLENGE_LABEL],
  [MY_STATS_LABEL],
]).resize();

export const speakPromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback(GET_PROMPT_LABEL, GET_PROMPT_ACTION),
]);

export const changePromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Change Prompt", CHANGE_PROMPT_ACTION),
]);

export const groupTryAgainKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔁 Try Again", TRY_AGAIN_ACTION),
]);

export function getGroupChallengeDeepLink(challengeId: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=group_${encodeURIComponent(challengeId)}`;
}

export function getGroupChallengeStatus(creatorTelegramId: number): string {
  return `${GROUP_CHALLENGE_STATUS_PREFIX}:${creatorTelegramId}`;
}

export function isGroupChallengeRecord(challenge: { status: string }): boolean {
  return challenge.status === GROUP_CHALLENGE_STATUS_PREFIX || challenge.status.startsWith(`${GROUP_CHALLENGE_STATUS_PREFIX}:`);
}

export function getGroupChallengeCreatorTelegramId(challenge: { status: string }): number | null {
  if (!challenge.status.startsWith(`${GROUP_CHALLENGE_STATUS_PREFIX}:`)) {
    return null;
  }

  const creatorId = Number(challenge.status.slice(GROUP_CHALLENGE_STATUS_PREFIX.length + 1));
  return Number.isFinite(creatorId) ? creatorId : null;
}

export function getNoPauseGroupChallengeKeyboard(challengeId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.url("🎤 Speak", getGroupChallengeDeepLink(challengeId)),
      Markup.button.callback("🔄 Change Prompt", `${CHANGE_GROUP_TOPIC_ACTION_PREFIX}${challengeId}`),
    ],
    [
      Markup.button.callback("🏆 Leaderboard", `${GROUP_CHALLENGE_LEADERBOARD_ACTION_PREFIX}${challengeId}`),
    ],
  ]);
}

export function getChallengeDeepLink(challengeId: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=challenge_${encodeURIComponent(challengeId)}`;
}

export function getChallengesTableMissingMessage(): string {
  return `⚠️ <b>Setup needed</b>\n\n<b>Issue:</b>\nI could not find the Supabase Telegram challenge tables.\n\n<b>SQL:</b>\n<pre>${escapeTelegramHtml(TELEGRAM_CHALLENGE_TABLES_SQL)}</pre>`;
}

export function getNoPauseGroupWelcomeMessage(): string {
  return `⚔️🎤 <b>NoPause is in the group!</b>

Start quick speaking challenges with your friends.
I’ll give the group a topic, then members can jump in and practice.

Type <b>/nopause</b> to start a group challenge.`;
}

export function getNoPauseGroupChallengeMessage(topic: string): string {
  return `⚔️ <b>NoPause Group Challenge</b>

💬 <b>Topic</b>
${escapeTelegramHtml(topic)}

🎤 Tap Speak when you are ready.`;
}

export function getPrivateChallengeMessage(topic: string): string {
  return `⚔️🎤 <b>Group Challenge</b>

💬 <b>Topic</b>
${escapeTelegramHtml(topic)}

🎙 <b>Your turn</b>
Send a fresh voice note in this DM when you are ready.`;
}

export function getGroupChallengeRetryMessage(topic: string): string {
  return `⚔️🎤 <b>Try this topic again</b>

💬 <b>Topic</b>
${escapeTelegramHtml(topic)}

🎙 <b>Your turn</b>
Send a new voice message in this DM. Once it is scored, I'll add it to the leaderboard automatically.`;
}

export function getFriendChallengeShareMessage(input: { creatorName: string; topic: string; challengeId: string }): string {
  const creatorName = input.creatorName.trim().replace(/^@+/, "") || "Someone";

  return `⚔️ <b>${escapeTelegramHtml(creatorName)}'s Challenge</b>

💬 <b>Topic</b>
${escapeTelegramHtml(input.topic)}

Say anything — just speak your mind! 🎤`;
}

export function getFriendChallengeReceivedMessage(input: { creatorUsername: string; topic: string; challengeId: string }): string {
  const creatorName = input.creatorUsername.trim().replace(/^@+/, "") || "Someone";
  const challengeLink = getChallengeDeepLink(input.challengeId);

  return `⚔️ <b>${escapeTelegramHtml(creatorName)}'s Challenge</b>

💬 <b>Topic</b>
${escapeTelegramHtml(input.topic)}

Say anything — just speak your mind!

<a href="${challengeLink}">${challengeLink}</a>`;
}

export function getFriendChallengeAlreadyAcceptedMessage(topic: string): string {
  return `⚔️ <b>Challenge already accepted</b>

💬 <b>Topic</b>
${escapeTelegramHtml(topic)}

🎙 <b>Your turn</b>
You have already accepted this challenge. If you have not sent your voice note yet, send it here when you are ready.`;
}

function formatTelegramResultDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function formatTelegramSpeakingTimeBreakdown(speakingSeconds: number, totalSeconds: number): string {
  const safeSpeakingSeconds = Math.max(0, Math.floor(speakingSeconds || 0));
  void totalSeconds;
  return formatTelegramResultDuration(safeSpeakingSeconds);
}

function truncateTextForLimit(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= TRUNCATED_TRANSCRIPT_NOTE.length) {
    return TRUNCATED_TRANSCRIPT_NOTE.slice(0, Math.max(0, maxLength));
  }

  return `${text.slice(0, maxLength - TRUNCATED_TRANSCRIPT_NOTE.length).trimEnd()}${TRUNCATED_TRANSCRIPT_NOTE}`;
}

function formatResultFields(input: {
  analysis: FlowAnalysis;
  transcript?: string | null;
  html?: boolean;
  maxLength?: number;
}): string {
  const completedMinutes = Math.floor(Math.max(0, input.analysis.speakingTimeSec || 0) / 60);
  const bonus = completedMinutes * 20;
  const transcript = input.transcript?.trim();
  const label = (text: string) => (input.html ? `<b>${text}</b>` : text);
  const fieldsWithFeedback = [
    `📊 ${label("Flow Score:")} ${input.analysis.flowScore}`,
    ...(bonus > 0 ? [`🥇 ${label("Bonus:")} +${bonus}`] : []),
    "",
    `⏱ ${label("Speaking time:")} ${formatTelegramSpeakingTimeBreakdown(input.analysis.speakingTimeSec, input.analysis.totalSessionTimeSec)}`,
    `⏸ ${label("Pauses:")} ${input.analysis.pauseCount}`,
    `🔇 ${label("Silence:")} ${input.analysis.totalSilenceSec}s`,
  ].join("\n");

  if (!transcript) {
    return fieldsWithFeedback;
  }

  const transcriptPrefix = `\n\n📝 ${label("Transcript:")}\n\n`;
  const availableTranscriptLength =
    (input.maxLength ?? TELEGRAM_SAFE_MESSAGE_LENGTH) - fieldsWithFeedback.length - transcriptPrefix.length;

  if (availableTranscriptLength <= 0) {
    return fieldsWithFeedback;
  }

  const renderedTranscript = input.html ? escapeTelegramHtml(transcript) : transcript;
  return `${fieldsWithFeedback}${transcriptPrefix}${truncateTextForLimit(renderedTranscript, availableTranscriptLength)}`;
}

export function getSpeakingResultMessage(input: {
  analysis: FlowAnalysis;
  transcript?: string | null;
  speaker?: string;
}): string {
  const speakerText = input.speaker
    ? `\n\n👤 <b>Speaker:</b> ${escapeTelegramHtml(input.speaker)}`
    : "";

  const prefix = `🎤 <b>Speaking Result</b>${speakerText}\n\n`;
  return `${prefix}${formatResultFields({
    analysis: input.analysis,
    transcript: input.transcript,
    html: true,
    maxLength: TELEGRAM_SAFE_MESSAGE_LENGTH - prefix.length,
  })}`;
}

export function getGroupShareResultMessage(input: {
  firstName: string;
  username?: string;
  topic?: string;
  attemptCount?: number;
  analysis: FlowAnalysis;
}): string {
  const usernameText = input.username ? `(@${escapeTelegramHtml(input.username)})` : "";
  const nameLine = [escapeTelegramHtml(input.firstName), usernameText].filter(Boolean).join(" ");
  const topicText = input.topic ? escapeTelegramHtml(input.topic) : "Group practice";
  const attemptText = input.attemptCount ? `#${input.attemptCount}` : "n/a";

  return `🎤 <b>Group Challenge Result</b>

👤 <b>Speaker:</b> ${nameLine}
💬 <b>Topic:</b> ${topicText}
📊 <b>Flow Score:</b> ${input.analysis.flowScore}
🔁 <b>Attempt:</b> ${attemptText}
⏱ <b>Speaking time:</b> ${formatTelegramSpeakingTimeBreakdown(input.analysis.speakingTimeSec, input.analysis.totalSessionTimeSec)}
🔇 <b>Silence:</b> ${input.analysis.totalSilenceSec}s`;
}

export function getGroupChallengeResultActions(input: {
  sessionId: string;
  groupId: number;
  challengeId: string;
  attemptCount: number;
}) {
  void input.groupId;
  void input.attemptCount;
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📤 Send to Group", `${POST_GROUP_CHALLENGE_RESULT_ACTION_PREFIX}${input.challengeId}:${input.sessionId}`),
    ],
    [Markup.button.callback("🔁 Try Again", `${TRY_GROUP_CHALLENGE_ACTION_PREFIX}${input.challengeId}`)],
  ]);
}

function getChallengeShareUrl(challengeId: string): string {
  const deepLink = getChallengeDeepLink(challengeId);
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent("Can you beat my score? 🎤")}`;
}

export function getChallengeShareActions(challengeId: string, createdByViewer = false) {
  return Markup.inlineKeyboard([
    [
      createdByViewer
        ? Markup.button.url("📤 Share Challenge", getChallengeShareUrl(challengeId))
        : Markup.button.url("🎤 Accept Challenge", getChallengeDeepLink(challengeId)),
    ],
  ]);
}

export function getFriendChallengeResultActions(input: {
  creatorUsername: string;
  challengeId: string;
  sessionId: string;
}) {
  const creatorLabel = input.creatorUsername.trim() || "the challenger";

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `Send Result to ${creatorLabel} 📨`,
        `${SEND_CHALLENGE_RESULT_ACTION_PREFIX}${input.challengeId}:${input.sessionId}`,
      ),
    ],
  ]);
}

export function getCreatorChallengeResultActions(input: {
  challengeId: string;
  sessionId: string;
  friendTelegramId: number;
}) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "📤 Share Results",
        `${SHARE_CREATOR_CHALLENGE_RESULT_ACTION_PREFIX}${input.challengeId}:${input.sessionId}:${input.friendTelegramId}`,
      ),
    ],
  ]);
}

export function getChallengeResultMessage(input: {
  topic: string;
  analysis: FlowAnalysis;
  transcript?: string | null;
  title?: string;
  attemptCount?: number;
}): string {
  const attemptText = input.attemptCount ? `\n\n🔁 <b>Attempt:</b> #${input.attemptCount}` : "";
  const prefix = `⚔️ <b>${escapeTelegramHtml(input.title ?? "Challenge Result")}</b>\n\n<b>Topic:</b>\n${escapeTelegramHtml(input.topic)}${attemptText}\n\n`;
  return `${prefix}${formatResultFields({
    analysis: input.analysis,
    transcript: input.transcript,
    html: true,
    maxLength: TELEGRAM_SAFE_MESSAGE_LENGTH - prefix.length,
  })}`;
}

export function getCreatorChallengeSharedResultMessage(input: {
  topic: string;
  analysis: FlowAnalysis;
  transcript?: string | null;
}): string {
  return getChallengeResultMessage({
    title: "Challenger Result",
    topic: input.topic,
    analysis: input.analysis,
    transcript: input.transcript,
  });
}

export function getChallengeCreatorNotification(input: {
  friendUsername: string;
  topic: string;
  analysis: FlowAnalysis;
  creatorScore: number | null;
  transcript?: string | null;
}): string {
  const friend = escapeTelegramHtml(input.friendUsername);
  const topic = escapeTelegramHtml(input.topic);
  if (input.creatorScore === null || input.creatorScore === undefined) {
    const prefix = `⚔️ <b>Challenge Result</b>\n\n👤 <b>Friend:</b>\n${friend}\n\n💬 <b>Topic:</b>\n${topic}\n\n`;
    const suffix = "\n\n🎤 Send a voice note when you are ready.";
    return `${prefix}${formatResultFields({
      analysis: input.analysis,
      transcript: input.transcript,
      html: true,
      maxLength: TELEGRAM_SAFE_MESSAGE_LENGTH - prefix.length - suffix.length,
    })}${suffix}`;
  }

  const prefix = `⚔️ <b>Challenge Result</b>\n\n👤 <b>Friend:</b>\n${friend}\n\n💬 <b>Topic:</b>\n${topic}\n\n`;
  const suffix = `\n\n<b>Your Flow Score:</b>\n${input.creatorScore}`;
  return `${prefix}${formatResultFields({
    analysis: input.analysis,
    transcript: input.transcript,
    html: true,
    maxLength: TELEGRAM_SAFE_MESSAGE_LENGTH - prefix.length - suffix.length,
  })}${suffix}`;
}

export function getConnectUrl(telegramId: number, options?: { challengeId?: string; challengeType?: "friend" | "group" }): string {
  const params = new URLSearchParams({ tg: String(telegramId) });
  if (options?.challengeId) {
    params.set("challenge_id", options.challengeId);
  }
  if (options?.challengeType) {
    params.set("challenge_type", options.challengeType);
  }
  return `${SITE_URL}/connect?${params.toString()}`;
}

export function getGroupChallengeConnectMessage(input: { username: string }): string {
  return `🔐 ${escapeTelegramHtml(input.username)} needs to connect NoPause first.

Sign in and connect Telegram, then tap Speak again to join the challenge.`;
}

export function getGroupChallengeEndedMessage(input: { topic: string }): string {
  return `⏰ <b>Challenge ended</b>

💬 <b>Topic:</b>
${escapeTelegramHtml(input.topic)}

🏁 This challenge is closed now.
Tap <b>Leaderboard</b> on the group card to see the final scores.`;
}

export type GroupChallengeLeaderboardEntry = {
  rank: number;
  username: string;
  bestFlowScore: number;
  attemptCount: number;
};

function formatLeaderboardRank(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function getGroupChallengeLeaderboardMessage(input: {
  topic: string;
  entries: GroupChallengeLeaderboardEntry[];
  expired: boolean;
}): string {
  const topic = escapeTelegramHtml(input.topic);
  const status = input.expired
    ? "\n\n⏰ <b>Final board:</b> This challenge has expired."
    : "\n\n🔥 <b>Live board:</b> Keep speaking to climb higher.";

  if (input.entries.length === 0) {
    return `🏆✨ <b>Challenge Leaderboard</b> ✨🏆

💬 <b>Topic:</b>
${topic}${status}

🎤 No scores yet.
Be the first to jump in and set the pace.`;
  }

  const rows = input.entries.map((entry) => {
    const rank = formatLeaderboardRank(entry.rank);
    const attempts = entry.attemptCount === 1 ? "1 try" : `${entry.attemptCount} tries`;
    return `${rank} <b>${escapeTelegramHtml(entry.username)}</b>\n   📊 ${entry.bestFlowScore} Flow Score  |  🔁 ${attempts}`;
  });

  return `🏆✨ <b>Challenge Leaderboard</b> ✨🏆

💬 <b>Topic:</b>
${topic}${status}

${rows.join("\n\n")}`;
}

export function getSessionActions(sessionId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔁 Try Again", TRY_AGAIN_ACTION)],
    [Markup.button.url("📊 View on NoPause", SITE_URL)],
  ]);
}

export function getConnectAccountKeyboard(telegramId: number, options?: { challengeId?: string; challengeType?: "friend" | "group" }) {
  return Markup.inlineKeyboard([
    [Markup.button.url("🔑 Connect Account", getConnectUrl(telegramId, options))],
  ]);
}

function formatStatsPracticeTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

function formatStatsCount(count: number): string {
  const safeCount = Math.max(0, Math.floor(count || 0));
  if (safeCount < 1_000) {
    return String(safeCount);
  }
  if (safeCount < 1_000_000) {
    return `${Math.floor(safeCount / 1_000)}k`;
  }

  return `${Math.floor(safeCount / 1_000_000)}m`;
}

function formatStatsDate(isoString: string | null): string {
  if (!isoString) return "None yet";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getTelegramStatsMessage(input: {
  fullName?: string | null;
  email?: string | null;
  bestFlowScore: number;
  avgFlowScore: number;
  totalSessions: number;
  totalPracticeTime: number;
  currentStreak: number;
  bestStreak: number;
  friendChallenges: number;
  groupChallenges: number;
}): string {
  const userLines: string[] = [];
  if (input.fullName) userLines.push(escapeTelegramHtml(input.fullName));
  if (input.email) userLines.push(escapeTelegramHtml(input.email));
  const userPrefix = userLines.length > 0 ? `${userLines.join("\n")}\n\n` : "";

  return `${userPrefix}NoPause helps you speak more fluently. Send a voice note, get a Flow Score — less dead air, higher score. Practice solo or challenge friends.

📊 <b>Stats</b>
🏆 Best: ${input.bestFlowScore}  •  📊 Avg: ${input.avgFlowScore}
🎯 Sessions: ${formatStatsCount(input.totalSessions)}  •  ⏱ ${formatStatsPracticeTime(input.totalPracticeTime)}
🔥 Streak: ${input.currentStreak} / ${input.bestStreak} best

👥 Friend challenges: ${input.friendChallenges}
🏆 Group challenges: ${input.groupChallenges}

🌍 nopause.org

/register`;
}

export const MESSAGES = {
  connectPrompt:
    "👋 Connect your NoPause account first.\n\nThen send a voice note to get your Flow Score.",
  lookupError:
    "⚠️ Something went wrong reaching NoPause right now.\n\nPlease try again in a moment.",
  statsError:
    "⚠️ I could not load your stats right now.\n\nPlease try again in a moment.",
  noSessions:
    "📊 You do not have any practice sessions yet.\n\nSend a voice note and let's see what you've got 🎤",
  challengeCreationError:
    "⚠️ I could not create a challenge right now.\n\nPlease try again in a moment.",
  challengeResultMissing:
    "I could not find your challenge result right now.",
  challengeCreatorShareUnauthorized:
    "Only the challenge creator can share this result.",
  challengeCreatorShareAlreadySent:
    "This result has already been shared.",
  challengeCreatorShareSent:
    "Shared with your friend.",
  challengeCreatorShareConfirmation:
    "✅ Your result was shared.",
  challengeCreatorShareError:
    "I could not share that result right now.",
  groupChallengeCreationError:
    "⚠️ I could not create a group challenge right now.\n\nPlease try again in a moment.",
  challengeNotFound:
    "⚠️ I could not find that challenge.\n\nAsk your friend to send a fresh challenge link.",
  challengeNoLongerExists:
    "⚠️ That challenge no longer exists.\n\nI cleared the old challenge state. Ask for a fresh challenge link, then send a new voice note.",
  challengeLoadError:
    "⚠️ I could not load that challenge right now.\n\nPlease try again in a moment.",
  friendChallengeFull:
    "⚔️ <b>This challenge is full</b>\n\nFriend challenges are 1-on-1 — only the creator and one friend can join.\n\nAsk for a fresh challenge link to start your own.",
  challengeRestartError:
    "⚠️ I could not restart that challenge right now.\n\nPlease try again in a moment.",
  groupChallengeGone:
    "⚠️ I could not find that group challenge anymore.\n\nAsk the group to start a new Challenge.",
  groupChallengeExpired:
    "⏰ That group challenge has expired.\n\nI cleared the old challenge state. Ask the group to start a new challenge, then send a new voice note.",
  voiceReceived:
    "🎧 Voice note received.\n\nAnalyzing it now.",
  unusableTranscript: "⚠️ Couldn't hear anything clearly.\n\nPlease speak louder and try again.",
  analysisError:
    "⚠️ I hit an issue analyzing that voice note.\n\nPlease try again in a moment.",
  forwardedVoice:
    "🎤 Please record a fresh voice note directly in this chat, not forwarded from somewhere else.",
  voiceTooLong:
    "🎤 The maximum voice note length is 5 minutes. Please send a shorter voice note.",
  challengeForwardHint:
    "👆 Forward the message above to your friends so they can accept your challenge!\n\n🌐 www.nopause.org",
  statsPrivate:
    "📊 Open @NoPauseAI_bot directly to view your stats.",
  speakPrivate:
    "🎤 <b>Speak freely</b>\n\nYou can talk about anything. Send a voice note whenever you are ready and NoPause will score your speaking time, silence, and Flow Score.\n\nNeed an idea first?\n\n🌐 www.nopause.org",
  scoringInfo:
    "🏆 <b>How scoring works</b>\n\nYou earn points for every second you spend speaking, plus a bonus each time you reach a full minute.\nSilence — the time you go quiet during the session — is subtracted.\n\nThe longer you speak with less dead air, the higher your score.\n\nRecord against a topic and request AI feedback for an extra bonus when your answer is strong and well-developed.",
  challengeInfo:
    "⚔️ <b>How challenges work</b>\n\nUse the Challenge button to challenge a friend.\nThey get a link to join.\nBoth of you submit a voice note.\nWhoever scores higher wins.\n\nIn groups, anyone can start a group challenge. Everyone gets the topic and can submit a voice note to compete.",
  statsInfo:
    "📊 <b>How stats work</b>\n\nYour stats combine everything.\nSessions from the web app and voice notes from Telegram all count together.\n\nYou can see your streak, best score, total practice time, and recent progress.",
  nopauseInfo:
    "👥 <b>Using No Pause in groups</b>\n\nAdd No Pause to a group.\nUse the Challenge button to start a group challenge.\nEveryone in the group gets the topic and can submit a voice note.\nResults are shared in the group.",
  about:
    "ℹ️ <b>About NoPause</b>\n\nNoPause helps you speak more fluently. Send a voice note and get a Flow Score — the longer you speak and the less dead air you leave, the higher your score.\n\n🎤 <b>Practice</b>\nJust send a voice note anytime. Tap Speak for a quick reminder or Get Prompt for a topic idea.\n\n⚔️ <b>Challenges</b>\nChallenge a friend or start a group challenge. Compete on the same topic.\n\n📈 <b>Stats</b>\nTrack your streak, best score, and practice time.\n\n🌐 nopause.org",
  aboutUserPrefix: (fullName?: string | null, email?: string | null): string => {
    const lines: string[] = [];
    if (fullName) lines.push(escapeTelegramHtml(fullName));
    if (email) lines.push(escapeTelegramHtml(email));
    return lines.length > 0 ? `${lines.join("\n")}\n\n` : "";
  },
  readyPrivate:
    "🎤 Just send a voice note when you are ready.\n\nLet's see what you've got.",
  welcomeIdentify:
    "👋 I could not identify your Telegram account.",
  welcome:
    "👋 Welcome to NoPause.\n\nConnect your account to track fluency, cut dead air, and improve your Flow Score.",
  welcomeBack:
    "👋 Your NoPause account is connected.\n\nSend a voice note whenever you are ready. Use /register to connect a different account.",
  register:
    "🔐 Connect this Telegram chat to NoPause.\n\nSign in with the account you want to use.",
};
