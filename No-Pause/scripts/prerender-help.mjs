import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const siteUrl = "https://www.nopause.org";
const canonicalUrl = `${siteUrl}/help`;
const title = "Help | No Pause";
const description =
  "Learn how No Pause scoring, pauses, prompts, streaks, challenges, and Telegram practice work.";

const helpArticles = [
  {
    title: "What NoPause is",
    summary: "A speaking fluency trainer built around real recorded practice.",
    subheader: "Speak, analyze, and track your speaking flow over time",
    body:
      "NoPause listens while you speak and turns the session into concrete fluency signals: Flow Score, speaking time, silence time, pause units, filler words, transcript, and practice history. The web app records from your microphone, analyzes speech and silence in real time, then saves the session so your stats and streaks can build over time. You can speak freely or start from one of the opinion prompts when you need a topic quickly. The Telegram bot uses the same core scoring model for voice notes, so you can practice from Telegram and still add sessions to your NoPause history.",
  },
  {
    title: "How Flow Score is calculated",
    summary: "The score rewards continuous speech and subtracts pause penalties.",
    subheader: "1 point per second plus 40 bonus per completed minute minus 10 per pause",
    body:
      "Flow Score is calculated from whole seconds of speaking time. You earn 1 point for every second you speak, plus a 40 point bonus for every completed speaking minute. Each pause unit subtracts 10 points, and the final score is never allowed to go below zero. If you speak for fewer than 5 seconds, the session is marked incomplete and receives a score of 0. In practice, the same 60 seconds of speaking can score very differently depending on how many pause units were counted.",
  },
  {
    title: "How pauses are detected",
    summary: "Pause units come from silence gaps above your difficulty threshold.",
    subheader: "Difficulty controls how long a silence can last before it counts",
    body:
      "NoPause calibrates to the room, watches microphone energy, and separates speaking time from silence time while you record. A silence gap becomes a pause only after it reaches the selected difficulty threshold: beginner is 1.8 seconds, intermediate is 1.2 seconds, and advanced is 0.8 seconds. Very short gaps under 300 milliseconds are ignored, and natural gaps under your threshold count as silence time but not as penalty pause units. Longer gaps can create multiple pause units because NoPause divides the silence by the threshold and counts the whole units. The first 2 seconds and final 1 second of a recording are filtered out of pause penalties so starting and stopping the session are less likely to distort the result.",
  },
  {
    title: "What filler words are",
    summary: "Words like um, uh, and like can signal hesitation.",
    subheader: "Tracked separately from the Flow Score formula",
    body:
      "Filler words are hesitation sounds and phrases that often appear while you are searching for the next thought. NoPause checks transcripts for um, uh, er, ah, like, you know, basically, literally, and actually. In the web app, supported browsers can update the transcript during recording, and the app can fall back to server transcription when needed. Filler words are counted in your results and highlighted in processed transcript text, but they are not part of the Flow Score formula.",
  },
  {
    title: "How streaks work",
    summary: "Streaks track consistent practice across days.",
    subheader: "One saved session can keep the day alive",
    body:
      "A streak is based on the local calendar date saved with your practice session. When a new session is saved for today, NoPause checks the last saved session date. If the last date was yesterday, your current streak increases by one; if it was earlier, the current streak restarts at one. If you already saved a session today, the streak is left unchanged so multiple sessions on the same day do not inflate it. Your best streak is preserved whenever the current streak resets.",
  },
  {
    title: "How challenges work",
    summary: "Challenges let people speak on the same prompt and compare scores.",
    subheader: "Same prompt, scored attempts, ranked by best Flow Score",
    body:
      "Challenges run through the Telegram bot and give participants the same prompt so results are easier to compare. A friend challenge creates a share link, tracks whether someone has already submitted, and stores the scored session as the challenge attempt. A group challenge is started with the group command, posts a prompt in the group, and sends each participant to a private voice-note flow before recording their attempt. Group challenges expire after 24 hours. Leaderboards rank participants by their best Flow Score for that challenge and show attempt counts, with up to 20 ranked entries.",
  },
  {
    title: "How the Telegram bot works",
    summary: "Send a voice note in Telegram and get a NoPause result.",
    subheader: "Practice from Telegram without opening the web app",
    body:
      "The Telegram bot connects a Telegram account to a NoPause user, then accepts fresh voice notes as practice sessions. Voice notes are limited to 5 minutes, forwarded voice notes are rejected, and duplicate processing is guarded by the Telegram chat and message id. The bot transcribes audio, uses word timestamps to estimate speaking time and pauses, applies the same Flow Score formula, saves the session, and updates your streak. In private chats, the bot supports start, about, register, speak, prompts, stats, and friend challenges.",
  },
  {
    title: "Tips for improving your Flow Score",
    summary: "Speak in complete thoughts and reduce long silent gaps.",
    subheader: "Improve the inputs that actually move the score",
    body:
      "The fastest way to improve is to increase speaking seconds while reducing pause units. Start with short sessions that you can finish with steady energy, then add time as your flow improves. If you get stuck, keep talking through the thought instead of stopping completely, because a pause unit costs 10 points while an imperfect sentence does not. Use beginner difficulty when you are building consistency, then move to intermediate or advanced when you want stricter silence thresholds.",
  },
  {
    title: "Speaking time vs silence",
    summary: "Speaking time is active speech; silence is time without speech.",
    subheader: "Silence is measured, but only threshold-level gaps become penalties",
    body:
      "Speaking time is the rounded number of seconds where NoPause detected active speech. Silence time is the rest of the analyzed recording, including ordinary gaps between words and longer pauses. Silence does not automatically reduce your Flow Score; it becomes a penalty only when a gap reaches the pause threshold and creates one or more pause units. Comparing speaking time against silence time over multiple sessions shows whether you are sustaining speech more consistently.",
  },
  {
    title: "How to use prompts",
    summary: "Pick a topic when you want a quick idea for practice.",
    subheader: "Prompts reduce setup friction, not the scoring rules",
    body:
      "Prompts are opinion questions stored in the app so you can start speaking without inventing a topic first. The home page shows a short list, the Prompts page shows the full set, and selecting one passes it into the practice screen as the session topic. During setup, you can choose from prompt options or request a random prompt, and the random picker avoids immediately repeating the prompt you already have when possible. Prompts do not change the scoring formula; they simply reduce hesitation before recording starts.",
  },
];

const improveSpeakingArticles = [
  {
    title: "How to stop saying um and uh",
    summary: "Replace hesitation sounds with intentional pauses.",
    subheader: "Replace hesitation sounds with intentional pauses",
    body:
      "Fillers often appear when your brain is buying time between thought formation and sentence production. The sound comes out before the next idea is ready, which makes the hesitation audible to the listener. A quiet pause does the same neurological job without weakening the sentence. It gives your brain time to select the next word while making you sound deliberate instead of uncertain. To catch yourself, record short sessions, review the exact spots where fillers appear, and practice replacing the first filler sound with one silent breath before continuing.",
  },
  {
    title: "How to reduce hesitation when speaking",
    summary: "Use structure and tracking to keep your flow moving.",
    subheader: "Hesitation breaks your flow and your listener's attention",
    body:
      "A thinking pause is a controlled break that helps the next idea land. Hesitation is different: it feels uncontrolled, repeats often, and pulls attention away from your message. Before speaking, use a simple structure such as point, reason, example, conclusion so your brain always has a next step. Then track hesitation count across sessions instead of judging a single recording. When the count drops over repeated practice, you can see that your speaking flow is becoming more automatic.",
  },
  {
    title: "How to speak more confidently",
    summary: "Confidence grows from repeated proof that you can keep going.",
    subheader: "Confidence comes from repetition not preparation",
    body:
      "Confidence is not built by preparing one perfect speech. It is built by producing many imperfect reps and learning that you can recover while speaking. Recording yourself removes the mystery: you hear what actually happened, review the score, and stop imagining the session was worse than it was. Short daily sessions compound because each one lowers the fear of starting. Over time, the act of speaking becomes familiar, and familiar actions feel more confident.",
  },
  {
    title: "How to think faster while speaking",
    summary: "Practice forming thoughts while words are already moving.",
    subheader: "Train your brain to form thoughts at speaking speed",
    body:
      "Most people can think faster than they speak, but pressure changes the timing. In a live moment, you may wait for a complete thought before starting, which creates silence and hesitation. Prompts train the opposite skill: begin with a reasonable first sentence, then let the next thought form while you are already speaking. This builds real-time thinking because your brain learns to organize ideas at speaking speed instead of waiting for a finished script.",
  },
  {
    title: "How to eliminate filler words",
    summary: "Spot the habit loop, then replace the cue with silence.",
    subheader: "Awareness is the first step to elimination",
    body:
      "Fillers are a habit loop: uncertainty is the cue, the filler is the routine, and the reward is a tiny bit of extra thinking time. You reduce the habit by seeing where it happens and replacing the routine. NoPause transcript highlights make patterns visible, such as fillers at the start of answers or after long clauses. For daily practice, choose one filler, speak for two minutes, and restart the sentence silently whenever that filler appears. The goal is not instant perfection; it is faster awareness.",
  },
  {
    title: "Why do I pause so much when talking",
    summary: "Long gaps usually come from load, pressure, or unfamiliar topics.",
    subheader: "Pausing is normal but long gaps hurt your flow",
    body:
      "Pausing is part of normal speech, but long gaps usually mean cognitive load is too high. You are choosing words, organizing ideas, monitoring how you sound, and sometimes managing anxiety at the same time. Anxiety increases pause frequency because it makes your brain self-check while you are trying to speak. Start with familiar topics so idea generation is easier, then move gradually to harder prompts. As topic familiarity increases, your pauses usually become shorter and less frequent.",
  },
  {
    title: "How to practice public speaking alone",
    summary: "Use short solo reps to build skill before adding an audience.",
    subheader: "Solo practice is the most underrated speaking tool",
    body:
      "Early speaking practice works best when the feedback loop is fast and low pressure. Group practice can help later, but solo practice lets you repeat more often, try again immediately, and focus on one weakness at a time. A strong 5 minute NoPause session is simple: pick a prompt, speak for two or three minutes, review Flow Score, pause count, silence time, and transcript, then repeat one focused section. Track Flow Score over weeks to measure whether your baseline is rising.",
  },
  {
    title: "How to speak clearly and fluently",
    summary: "Increase active speaking time while reducing silence time.",
    subheader: "Fluency is speaking time divided by total time",
    body:
      "Clear fluency is partly a ratio: how much of the session is active speaking compared with silence. More speaking time and less silence usually means your thoughts are moving more smoothly from idea to sentence. A strong fluency session often has a high speaking-time share with only brief natural gaps, while a weak one has large silent sections that interrupt the listener. Use your session history to compare the ratio over time, not just one recording, and look for a steady trend toward more continuous speech.",
  },
];

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderArticle = (article) => `
          <article class="help-prerender-card">
            <h2>${escapeHtml(article.title)}</h2>
            <p>${escapeHtml(article.summary)}</p>
            <h3>${escapeHtml(article.subheader)}</h3>
            <p>${escapeHtml(article.body)}</p>
          </article>`;

const renderSection = (heading, articles) => `
        <section>
          ${heading ? `<h2>${escapeHtml(heading)}</h2>` : ""}
          ${articles.map(renderArticle).join("\n")}
        </section>`;

const rootMarkup = `
    <div class="help-prerender">
      <main>
        <header>
          <h1>Help</h1>
          <p>Clear answers about practice, scoring, prompts, challenges, and Telegram.</p>
        </header>
${renderSection("", helpArticles)}
${renderSection("Improve Your Speaking", improveSpeakingArticles)}
      </main>
    </div>`;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: title,
  url: canonicalUrl,
  description,
  isPartOf: {
    "@type": "WebSite",
    name: "No Pause",
    url: siteUrl,
  },
};

const indexHtml = await readFile(path.join(distDir, "index.html"), "utf8");
const assetTags = [
  ...indexHtml.matchAll(/<(?:script|link)\b(?=[^>]*(?:rel="(?:modulepreload|stylesheet|icon|manifest)"|type="module"))[^>]*>(?:<\/script>)?/g),
]
  .map(([tag]) => tag)
  .join("\n  ");

const html = `<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="No Pause" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta name="theme-color" content="#0f172a" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="No Pause" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${siteUrl}/preview.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${siteUrl}/preview.png" />
  <meta name="google-site-verification" content="google4ad73ebb56a52070.html" />
  <script type="application/ld+json" data-route-seo="jsonld">${JSON.stringify(structuredData)}</script>
  <style>
    .help-prerender { min-height: 100vh; background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    .help-prerender main { max-width: 1024px; margin: 0 auto; }
    .help-prerender h1 { margin: 0 0 8px; font-size: 3rem; font-weight: 600; }
    .help-prerender header > p { margin: 0 0 28px; color: #cbd5e1; }
    .help-prerender section { display: grid; gap: 12px; margin-top: 28px; }
    .help-prerender section > h2 { margin: 0 0 4px; font-size: 1.75rem; }
    .help-prerender-card { border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 18px; background: rgba(15, 23, 42, 0.78); padding: 20px; }
    .help-prerender-card h2 { margin: 0 0 8px; font-size: 1.25rem; }
    .help-prerender-card h3 { margin: 16px 0 8px; color: #38bdf8; font-size: 0.95rem; }
    .help-prerender-card p { margin: 0; color: #cbd5e1; line-height: 1.65; }
  </style>
  ${assetTags}
</head>

<body>
  <div id="root">${rootMarkup}
  </div>
</body>

</html>
`;

const helpDir = path.join(distDir, "help");
await mkdir(helpDir, { recursive: true });
await writeFile(path.join(helpDir, "index.html"), html);

console.log("Prerendered /help to dist/help/index.html");
