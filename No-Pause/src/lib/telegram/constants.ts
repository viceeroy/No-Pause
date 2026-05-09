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
export const TRY_GROUP_CHALLENGE_ACTION_PREFIX = "tg:";
export const TRY_AGAIN_ACTION = "try_again:speaking";
export const AI_FEEDBACK_ACTION_PREFIX = "ai_feedback:";
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
  hesitationCount: number;
  speakingTimeSec: number;
  totalSessionTimeSec: number;
  isCompleted: boolean;
  pauseLog: Array<{ timestamp: number; duration: number; units: number }>;
};

export const replyKeyboard = Markup.keyboard([
  [CHALLENGE_LABEL, MY_STATS_LABEL, SPEAK_LABEL],
  [ABOUT_LABEL],
]).resize();

export const speakPromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback(GET_PROMPT_LABEL, GET_PROMPT_ACTION),
]);

export const changePromptKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Change Prompt", CHANGE_PROMPT_ACTION),
]);

export const groupTryAgainKeyboard = Markup.inlineKeyboard([
  Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION),
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

export function getFriendChallengeShareMessage(input: { topic: string; challengeId: string }): string {
  return `⚔️ <b>Challenge your friends</b>

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
  const safeTotalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const microSilenceSeconds = Math.max(0, safeTotalSeconds - safeSpeakingSeconds);
  const speakingText = `${formatTelegramResultDuration(safeSpeakingSeconds)} speaking`;

  if (microSilenceSeconds === 0) {
    return speakingText;
  }

  return `${speakingText} · ${formatTelegramResultDuration(microSilenceSeconds)} gaps`;
}

function formatCompletedMinutesLabel(minutes: number): string {
  return `${minutes} completed ${minutes === 1 ? "minute" : "minutes"}`;
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
  const bonus = completedMinutes * 40;
  const transcript = input.transcript?.trim();
  const label = (text: string) => (input.html ? `<b>${text}</b>` : text);
  const fields = [
    `📊 ${label("Flow Score:")} ${input.analysis.flowScore}`,
    `🥇 ${label("Bonus:")} +${bonus} (${formatCompletedMinutesLabel(completedMinutes)})`,
    "",
    `⏱ ${label("Speaking time:")} ${formatTelegramSpeakingTimeBreakdown(input.analysis.speakingTimeSec, input.analysis.totalSessionTimeSec)}`,
    `🕒 ${label("Session length:")} ${formatTelegramResultDuration(input.analysis.totalSessionTimeSec)}`,
    `🔇 ${label("Pauses:")} ${input.analysis.pauseCount} (silent gaps)`,
    `💬 ${label("Fillers:")} ${input.analysis.hesitationCount} (um, uh, er, ah)`,
  ].join("\n");

  if (!transcript) {
    return fields;
  }

  const transcriptPrefix = `\n\n📝 ${label("Transcript:")}\n\n`;
  const availableTranscriptLength =
    (input.maxLength ?? TELEGRAM_SAFE_MESSAGE_LENGTH) - fields.length - transcriptPrefix.length;

  if (availableTranscriptLength <= 0) {
    return fields;
  }

  const renderedTranscript = input.html ? escapeTelegramHtml(transcript) : transcript;
  return `${fields}${transcriptPrefix}${truncateTextForLimit(renderedTranscript, availableTranscriptLength)}`;
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
🔇 <b>Pauses:</b> ${input.analysis.pauseCount}
💬 <b>Fillers:</b> ${input.analysis.hesitationCount}`;
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
    [Markup.button.callback("🔄 Try Again", `${TRY_GROUP_CHALLENGE_ACTION_PREFIX}${input.challengeId}`)],
  ]);
}

export function getChallengeShareActions(challengeId: string, createdByViewer = false) {
  const challengeDeepLink = getChallengeDeepLink(challengeId);

  return Markup.inlineKeyboard([
    [
      createdByViewer
        ? Markup.button.url(
            "⚔️ Accept Challenge",
            challengeDeepLink,
          )
        : Markup.button.url("Accept Challenge 🎤", challengeDeepLink),
    ],
  ]);
}

export function getFriendChallengeResultActions(input: {
  creatorUsername: string;
  challengeId: string;
  sessionId: string;
}) {
  const creatorLabel = input.creatorUsername.trim().replace(/^@+/, "");

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `Send Result to @${creatorLabel} 📨`,
        `${SEND_CHALLENGE_RESULT_ACTION_PREFIX}${input.challengeId}:${input.sessionId}`,
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
    const prefix = `⚔️ <b>Challenge Result</b>\n\n<b>Friend:</b>\n@${friend}\n\n<b>Topic:</b>\n${topic}\n\n`;
    const suffix = `\n\n<b>Action:</b>\nSend a voice note and let's see what you've got 🎤`;
    return `${prefix}${formatResultFields({
      analysis: input.analysis,
      transcript: input.transcript,
      html: true,
      maxLength: TELEGRAM_SAFE_MESSAGE_LENGTH - prefix.length - suffix.length,
    })}${suffix}`;
  }

  const prefix = `⚔️ <b>Challenge Result</b>\n\n<b>Friend:</b>\n@${friend}\n\n<b>Topic:</b>\n${topic}\n\n`;
  const suffix = `\n\n<b>Your Flow Score:</b>\n${input.creatorScore}`;
  return `${prefix}${formatResultFields({
    analysis: input.analysis,
    transcript: input.transcript,
    html: true,
    maxLength: TELEGRAM_SAFE_MESSAGE_LENGTH - prefix.length - suffix.length,
  })}${suffix}`;
}

export function getConnectUrl(telegramId: number): string {
  return `${SITE_URL}/connect?tg=${encodeURIComponent(String(telegramId))}`;
}

export function getGroupChallengeConnectMessage(input: { username: string }): string {
  return `🔐 <b>NoPause account needed</b>

👤 <b>Player:</b> ${escapeTelegramHtml(input.username)}

<b>Status:</b>
This player is not connected to NoPause yet.

<b>Action:</b>
Sign in and connect Telegram first, then tap Speak again to join the challenge.`;
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
    [Markup.button.callback("🤖 AI Feedback", `${AI_FEEDBACK_ACTION_PREFIX}${sessionId}`)],
    [Markup.button.callback("🔄 Try Again", TRY_AGAIN_ACTION)],
    [Markup.button.url("📊 View on NoPause", SITE_URL)],
  ]);
}

export function getConnectAccountKeyboard(telegramId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.url("🔑 Connect Account", getConnectUrl(telegramId))],
  ]);
}

function formatCompactDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
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

function formatAverageScore(score: number | null): string {
  return score === null ? "N/A" : String(score);
}

export function getTelegramStatsMessage(input: {
  currentStreak: number;
  bestStreak: number;
  bestFlowScore: number;
  avgFlowScore: number;
  scoredSessions: number;
  totalPracticeTime: number;
  monthlySessions: number;
  monthlySpeakingTime: number;
  monthlyAvgFlowScore: number;
  speakingSessions: number;
  speakingAvgFlowScore: number | null;
  lastSessionText: string;
}): string {
  return `📊 <b>Your NoPause Stats</b>

🔥 <b>Streak:</b> ${input.currentStreak} days  |  <b>Best:</b> ${input.bestStreak} days

🏆 <b>Best Score:</b> ${input.bestFlowScore}
📈 <b>Average Score:</b> ${input.avgFlowScore}
✅ <b>All-Time Sessions:</b> ${input.scoredSessions}

⏱ <b>All-Time Practice Time:</b> ${formatCompactDuration(input.totalPracticeTime)}

📅 <b>This Month</b>
<b>Sessions:</b> ${input.monthlySessions}  |  <b>Avg Score:</b> ${input.monthlyAvgFlowScore}
<b>Speaking Time:</b> ${formatCompactDuration(input.monthlySpeakingTime)}

🎤 <b>Speaking Mode</b>
<b>Sessions:</b> ${input.speakingSessions}  |  <b>Avg Score:</b> ${formatAverageScore(input.speakingAvgFlowScore)}

📅 <b>Last session:</b> ${input.lastSessionText}`;
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
    "⚠️ <b>Challenge not found</b>\n\n<b>Status:</b>\nI could not find that group challenge anymore.\n\n<b>Action:</b>\nAsk the group to start a new Challenge.",
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
  speakPrivate:
    "🎤 <b>Speak freely</b>\n\nYou can talk about anything. Send a voice note whenever you are ready and NoPause will score your fluency, pauses, and Flow Score.\n\nNeed an idea first?",
  scoringInfo:
    "🏆 <b>How scoring works</b>\n\nYou earn 1 point for every second you speak.\nYou also get 40 bonus points for every completed minute.\nEach pause subtracts 10 points.\n\nThe longer you speak without pausing, the higher your score.\n\n<b>Examples:</b>\n1 minute with no pauses = 100 points\n2 minutes with no pauses = 200 points\n2 minutes with 3 pauses = 170 points",
  challengeInfo:
    "⚔️ <b>How challenges work</b>\n\nUse the Challenge button to challenge a friend.\nThey get a link to join.\nBoth of you submit a voice note.\nWhoever scores higher wins.\n\nIn groups, anyone can start a group challenge. Everyone gets the topic and can submit a voice note to compete.",
  statsInfo:
    "📊 <b>How stats work</b>\n\nYour stats combine everything.\nSessions from the web app and voice notes from Telegram all count together.\n\nYou can see your streak, best score, total practice time, and recent progress.",
  nopauseInfo:
    "👥 <b>Using No Pause in groups</b>\n\nAdd No Pause to a group.\nUse the Challenge button to start a group challenge.\nEveryone in the group gets the topic and can submit a voice note.\nResults are shared in the group.",
  about:
    "ℹ️ <b>About NoPause</b>\n\nNoPause is your speaking coach on Telegram. Send a voice note, get a Flow Score.\n\n🎤 <b>Practice</b>\nSend any voice note to get scored on pauses, hesitations, and speaking time. Tap Speak when you want a quick reminder, then use the inline Get Prompt button if you want a topic first.\n\n🏆 <b>How scoring works</b>\nYou earn 1 point for every second you speak.\nYou also get 40 bonus points for every completed minute.\nEach pause subtracts 10 points.\n\nThe longer you speak without pausing, the higher your score.\n\n<b>Examples:</b>\n1 minute with no pauses = 100 points\n2 minutes with no pauses = 200 points\n2 minutes with 3 pauses = 170 points\n\n⚔️ <b>Challenges</b>\nChallenge a friend or start a group challenge. Compete on the same topic.\n\n📈 <b>Stats</b>\nTap My Stats to check your streak, best score, and practice time.\n\n🌐 nopause.org",
  readyPrivate:
    "🎤 <b>Ready when you are</b>\n\n<b>Action:</b>\nJust send a voice note and let's see what you've got 🎤",
  welcomeIdentify:
    "👋 <b>Welcome to NoPause</b>\n\n<b>Status:</b>\nI could not identify your Telegram account.",
  welcome:
    "👋 <b>Welcome to NoPause</b>\n\n<b>What it does:</b>\nTrack your speaking fluency.\nReduce pauses.\nImprove your Flow Score.\n\n<b>Action:</b>\nConnect your account to get started.",
};
