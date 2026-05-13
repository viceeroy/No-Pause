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
  "Improve speaking flow and reduce hesitation with real speaking practice. Track pauses, speaking time, Flow Score, and progress over time.";

const helpArticles = [
  {
    title: "What NoPause Helps You Do",
    summary: "Speak, get a score, and build confidence over time.",
    subheader: "A simple loop for steadier speaking",
    body:
      "You speak, NoPause listens and scores you, and you improve over time. The goal is better speaking confidence, stronger fluency, and less hesitation. Each session gives you another chance to sound steadier than before.",
  },
  {
    title: "Who NoPause Helps",
    summary: "For people who want to sound clearer and more confident.",
    subheader: "A friendly place to practice out loud",
    body:
      "NoPause helps people preparing for interviews, presentations, and everyday moments where they want to speak clearly. It is useful for anyone building speaking confidence, reducing filler words, and lowering hesitation. It also fits English fluency practice and helps you hear yourself more clearly.",
  },
  {
    title: "How A Practice Session Works",
    summary: "Choose a topic, record, review, and repeat.",
    subheader: "Practice is action-oriented by design",
    body:
      "Start by choosing a prompt or speaking freely. Record your answer, review your results, then try again. The loop stays simple so you can focus on fluency, reduce pauses, and keep moving through imperfect sentences.",
  },
  {
    title: "Understanding Your Results",
    summary: "See what each result tells you after a session.",
    subheader: "Each result explains a different part of your speaking",
    body:
      "Flow Score shows how continuously you spoke. Speaking time is how long your voice was active, and silence time is the gaps between speech. Pause count shows how often you stopped too long, filler count shows hesitation words, and the transcript is what you said.",
  },
  {
    title: "What Flow Score Means",
    summary: "Higher scores mean steadier speech with fewer long stops.",
    subheader: "Use Flow Score as a progress signal",
    body:
      "Flow Score measures how continuously you speak with fewer long hesitations. Higher is better because it usually means your thoughts kept moving. Use it to track whether your speaking is getting smoother over time.",
  },
  {
    title: "What Counts As A Pause",
    summary: "NoPause separates natural gaps from longer breaks in your flow.",
    subheader: "Not every quiet moment is a problem",
    body:
      "NoPause ignores tiny natural gaps between words. Only longer silences count as pauses. Easier difficulty is more forgiving, while harder difficulty catches shorter gaps so you can practice tighter fluency.",
  },
  {
    title: "How To Improve Your Flow Score",
    summary: "Keep speaking, use prompts, and practice consistently.",
    subheader: "Small steady habits improve speaking flow",
    body:
      "Keep talking through imperfect sentences. Use prompts when overthinking slows you down. Practice short sessions consistently so fluency feels more automatic and you reduce pauses over time.",
  },
  {
    title: "Prompts And Speaking Topics",
    summary: "Pick a topic or speak freely when you are ready.",
    subheader: "Prompts reduce startup friction",
    body:
      "Prompts give you something to answer right away. You can speak freely or pick a topic from Argue, Inform, Describe, and Opinion. The topic is just the starting point; the real goal is to speak clearly and keep your thought moving.",
  },
  {
    title: "Streaks And Progress",
    summary: "Daily streaks make consistency visible.",
    subheader: "Progress compounds through repeated practice",
    body:
      "A daily streak helps you keep the habit visible. It turns practice speaking into something you can return to regularly. Your history can show more fluency, fewer hesitation patterns, and steadier speaking confidence.",
  },
  {
    title: "Privacy And Data",
    summary: "Plain-language details about recording and saved history.",
    subheader: "Your practice history stays connected to your account",
    body:
      "Your microphone is used only during recording. Transcripts and scores are saved to your account so you can see your full history. Telegram linking connects your bot account to your NoPause account so voice-note practice appears with the rest of your history.",
  },
  {
    title: "Telegram Practice",
    summary: "Practice from Telegram without opening the app.",
    subheader: "An optional extra channel for voice notes",
    body:
      "Telegram practice is an optional extra channel. Connect once, then send voice notes anytime without opening the web app. It is a quick way to practice speaking when you are already in Telegram.",
  },
  {
    title: "Challenges",
    summary: "Use the same prompt and compare results socially.",
    subheader: "Social practice with shared prompts",
    body:
      "Challenges give everyone the same prompt. Each person speaks, gets scored, and appears on a leaderboard. Friend challenges and group challenges make practice social when comparison and accountability help you keep going.",
  },
  {
    title: "Detailed Scoring FAQ",
    summary: "Exact scoring details, examples, and implementation notes.",
    subheader: "Technical details live here",
    body:
      "Flow Score is calculated from whole seconds of speaking time. You earn 1 point for every second you speak, plus a 40 point bonus for every completed speaking minute. Each pause unit subtracts 10 points, and the final score is never allowed to go below 0. If you speak for fewer than 5 seconds, the session receives a Flow Score of 0. Beginner counts pauses after 1.8 seconds, intermediate after 1.2 seconds, and advanced after 0.8 seconds. Tiny gaps under 300 milliseconds are ignored, and the first 2 seconds and final 1 second of a recording are filtered out of pause penalties. Long silences can create multiple pause units because NoPause divides the silence by the active threshold and counts the whole units. Example strong session: Flow Score 246, speaking time 2:06, silence time 0:18, pause count 2, filler count 1. Example weak session: Flow Score 42, speaking time 0:48, silence time 1:35, pause count 14, filler count 11.",
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
          <p>Improve speaking flow and reduce hesitation with real speaking practice. Track pauses, speaking time, Flow Score, and progress over time.</p>
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
