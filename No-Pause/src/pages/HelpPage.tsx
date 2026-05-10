import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type VisualKey =
  | 'flow'
  | 'score'
  | 'pauses'
  | 'fillers'
  | 'streaks'
  | 'challenges'
  | 'telegram'
  | 'tips'
  | 'time'
  | 'prompts';

type HelpArticle = {
  title: string;
  summary: string;
  subheader: string;
  body: string;
  visual: VisualKey;
};

const helpArticles: HelpArticle[] = [
  {
    title: 'What NoPause is',
    summary: 'A speaking fluency trainer built around real recorded practice.',
    subheader: 'Speak, analyze, and track your speaking flow over time',
    body:
      'NoPause listens while you speak and turns the session into concrete fluency signals: Flow Score, speaking time, silence time, pause units, filler words, transcript, and practice history. The web app records from your microphone, analyzes speech and silence in real time, then saves the session so your stats and streaks can build over time. You can speak freely or start from one of the opinion prompts when you need a topic quickly. The Telegram bot uses the same core scoring model for voice notes, so you can practice from Telegram and still add sessions to your NoPause history.',
    visual: 'flow',
  },
  {
    title: 'How Flow Score is calculated',
    summary: 'The score rewards continuous speech and subtracts pause penalties.',
    subheader: '1 point per second plus 40 bonus per completed minute minus 10 per pause',
    body:
      'Flow Score is calculated from whole seconds of speaking time. You earn 1 point for every second you speak, plus a 40 point bonus for every completed speaking minute. Each pause unit subtracts 10 points, and the final score is never allowed to go below zero. If you speak for fewer than 5 seconds, the session is marked incomplete and receives a score of 0. In practice, the same 60 seconds of speaking can score very differently depending on how many pause units were counted.',
    visual: 'score',
  },
  {
    title: 'How pauses are detected',
    summary: 'Pause units come from silence gaps above your difficulty threshold.',
    subheader: 'Difficulty controls how long a silence can last before it counts',
    body:
      'NoPause calibrates to the room, watches microphone energy, and separates speaking time from silence time while you record. A silence gap becomes a pause only after it reaches the selected difficulty threshold: beginner is 1.8 seconds, intermediate is 1.2 seconds, and advanced is 0.8 seconds. Very short gaps under 300 milliseconds are ignored, and natural gaps under your threshold count as silence time but not as penalty pause units. Longer gaps can create multiple pause units because NoPause divides the silence by the threshold and counts the whole units. The first 2 seconds and final 1 second of a recording are filtered out of pause penalties so starting and stopping the session are less likely to distort the result.',
    visual: 'pauses',
  },
  {
    title: 'What filler words are',
    summary: 'Words like um, uh, and like can signal hesitation.',
    subheader: 'Tracked separately from the Flow Score formula',
    body:
      'Filler words are hesitation sounds and phrases that often appear while you are searching for the next thought. NoPause checks transcripts for um, uh, er, ah, like, you know, basically, literally, and actually. In the web app, supported browsers can update the transcript during recording, and the app can fall back to server transcription when needed. Filler words are counted in your results and highlighted in processed transcript text, but they are not part of the Flow Score formula.',
    visual: 'fillers',
  },
  {
    title: 'How streaks work',
    summary: 'Streaks track consistent practice across days.',
    subheader: 'One saved session can keep the day alive',
    body:
      'A streak is based on the local calendar date saved with your practice session. When a new session is saved for today, NoPause checks the last saved session date. If the last date was yesterday, your current streak increases by one; if it was earlier, the current streak restarts at one. If you already saved a session today, the streak is left unchanged so multiple sessions on the same day do not inflate it. Your best streak is preserved whenever the current streak resets.',
    visual: 'streaks',
  },
  {
    title: 'How challenges work',
    summary: 'Challenges let people speak on the same prompt and compare scores.',
    subheader: 'Same prompt, scored attempts, ranked by best Flow Score',
    body:
      'Challenges run through the Telegram bot and give participants the same prompt so results are easier to compare. A friend challenge creates a share link, tracks whether someone has already submitted, and stores the scored session as the challenge attempt. A group challenge is started with the group command, posts a prompt in the group, and sends each participant to a private voice-note flow before recording their attempt. Group challenges expire after 24 hours. Leaderboards rank participants by their best Flow Score for that challenge and show attempt counts, with up to 20 ranked entries.',
    visual: 'challenges',
  },
  {
    title: 'How the Telegram bot works',
    summary: 'Send a voice note in Telegram and get a NoPause result.',
    subheader: 'Practice from Telegram without opening the web app',
    body:
      'The Telegram bot connects a Telegram account to a NoPause user, then accepts fresh voice notes as practice sessions. Voice notes are limited to 5 minutes, forwarded voice notes are rejected, and duplicate processing is guarded by the Telegram chat and message id. The bot transcribes audio, uses word timestamps to estimate speaking time and pauses, applies the same Flow Score formula, saves the session, and updates your streak. In private chats, the bot supports start, about, register, speak, prompts, stats, and friend challenges.',
    visual: 'telegram',
  },
  {
    title: 'Tips for improving your Flow Score',
    summary: 'Speak in complete thoughts and reduce long silent gaps.',
    subheader: 'Improve the inputs that actually move the score',
    body:
      'The fastest way to improve is to increase speaking seconds while reducing pause units. Start with short sessions that you can finish with steady energy, then add time as your flow improves. If you get stuck, keep talking through the thought instead of stopping completely, because a pause unit costs 10 points while an imperfect sentence does not. Use beginner difficulty when you are building consistency, then move to intermediate or advanced when you want stricter silence thresholds.',
    visual: 'tips',
  },
  {
    title: 'Speaking time vs silence',
    summary: 'Speaking time is active speech; silence is time without speech.',
    subheader: 'Silence is measured, but only threshold-level gaps become penalties',
    body:
      'Speaking time is the rounded number of seconds where NoPause detected active speech. Silence time is the rest of the analyzed recording, including ordinary gaps between words and longer pauses. Silence does not automatically reduce your Flow Score; it becomes a penalty only when a gap reaches the pause threshold and creates one or more pause units. Comparing speaking time against silence time over multiple sessions shows whether you are sustaining speech more consistently.',
    visual: 'time',
  },
  {
    title: 'How to use prompts',
    summary: 'Pick a topic when you want a quick idea for practice.',
    subheader: 'Prompts reduce setup friction, not the scoring rules',
    body:
      'Prompts are opinion questions stored in the app so you can start speaking without inventing a topic first. The home page shows a short list, the Prompts page shows the full set, and selecting one passes it into the practice screen as the session topic. During setup, you can choose from prompt options or request a random prompt, and the random picker avoids immediately repeating the prompt you already have when possible. Prompts do not change the scoring formula; they simply reduce hesitation before recording starts.',
    visual: 'prompts',
  },
];

const heroArticles = helpArticles.slice(0, 3);
const collapsibleArticles = helpArticles.slice(3);

function FlowVisual() {
  const steps = ['Speak', 'Analyze', 'Flow Score'];

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-1 items-center gap-3">
            <div className="flex min-h-14 flex-1 items-center justify-center rounded-2xl border border-border bg-surface-card px-4 text-sm font-sans font-bold text-foreground">
              {step}
            </div>
            {index < steps.length - 1 && (
              <span className="shrink-0 text-sm font-sans font-black text-primary" aria-hidden="true">
                -&gt;
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreVisual() {
  const rows = [
    ['30s speaking', '0 pauses', '30 points'],
    ['60s speaking', '0 pauses', '100 points'],
    ['60s speaking', '2 pauses', '80 points'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <table className="w-full text-left text-sm font-sans">
        <thead className="bg-surface-card text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-bold">Speaking</th>
            <th className="px-4 py-3 font-bold">Pauses</th>
            <th className="px-4 py-3 font-bold">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([speaking, pauses, score]) => (
            <tr key={`${speaking}-${pauses}`} className="border-t border-border text-foreground">
              <td className="px-4 py-3">{speaking}</td>
              <td className="px-4 py-3">{pauses}</td>
              <td className="px-4 py-3 font-bold text-primary">{score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-3 text-xs font-sans text-muted-foreground">
        60s with no pauses is 60 points plus the 40 point completed-minute bonus.
      </p>
    </div>
  );
}

function PausesVisual() {
  const rows = [
    ['Beginner', '1.8s'],
    ['Intermediate', '1.2s'],
    ['Advanced', '0.8s'],
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
        {rows.map(([level, threshold]) => (
          <div key={level} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
            <span className="text-sm font-sans font-bold text-foreground">{level}</span>
            <span className="text-sm font-sans text-primary">{threshold}</span>
          </div>
        ))}
      </div>
      <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-sans text-muted-foreground">
          <span>10 second example</span>
          <span>7s speaking, 3s silence</span>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full bg-surface-card">
          <div className="w-[70%] bg-primary" />
          <div className="w-[30%] bg-muted-foreground/35" />
        </div>
        <div className="mt-2 flex justify-between text-xs font-sans text-muted-foreground">
          <span>Speaking</span>
          <span>Silence</span>
        </div>
      </div>
    </div>
  );
}

function FillerVisual() {
  const fillers = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'literally', 'actually'];

  return (
    <div className="flex flex-wrap gap-2 rounded-[18px] border border-border bg-surface-elevated p-4">
      {fillers.map((word) => (
        <span
          key={word}
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-sans font-bold text-primary"
        >
          {word}
        </span>
      ))}
    </div>
  );
}

function StreakVisual() {
  const days = [
    ['Mon', true],
    ['Tue', true],
    ['Wed', true],
    ['Thu', false],
    ['Fri', true],
    ['Sat', true],
    ['Sun', false],
  ] as const;

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="grid grid-cols-7 gap-2">
        {days.map(([day, filled]) => (
          <div key={day} className="text-center">
            <div
              className={`mb-2 flex aspect-square items-center justify-center rounded-xl border text-xs font-sans font-bold ${
                filled
                  ? 'border-primary/40 bg-primary/20 text-primary'
                  : 'border-border bg-surface-card text-muted-foreground'
              }`}
            >
              {filled ? 'Done' : '-'}
            </div>
            <p className="text-[0.7rem] font-sans text-muted-foreground">{day}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardVisual() {
  const rows = [
    ['1', 'Maya', '142'],
    ['2', 'Jordan', '118'],
    ['3', 'Sam', '96'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-[64px_1fr_96px] bg-surface-card px-4 py-3 text-xs font-sans font-bold text-muted-foreground">
        <span>Rank</span>
        <span>Name</span>
        <span className="text-right">Flow Score</span>
      </div>
      {rows.map(([rank, name, score]) => (
        <div key={rank} className="grid grid-cols-[64px_1fr_96px] border-t border-border px-4 py-3 text-sm font-sans text-foreground">
          <span>{rank}</span>
          <span>{name}</span>
          <span className="text-right font-bold text-primary">{score}</span>
        </div>
      ))}
    </div>
  );
}

function TelegramVisual() {
  const steps = ['Connect your account', 'Send a voice note', 'Receive your Flow Score and transcript'];

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-sans font-black text-primary-foreground">
              {index + 1}
            </span>
            <span className="text-sm font-sans text-foreground">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TipsVisual() {
  const rows = [
    ['Keep speaking through imperfect phrasing', 'Stop completely to find the perfect word'],
    ['Use prompts to start faster', 'Spend the session planning silently'],
    ['Track trends across sessions', 'Judge progress from one score'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-2 bg-surface-card text-xs font-sans font-bold text-muted-foreground">
        <span className="border-r border-border px-4 py-3">Do</span>
        <span className="px-4 py-3">Do not</span>
      </div>
      {rows.map(([doText, dontText]) => (
        <div key={doText} className="grid grid-cols-2 border-t border-border text-sm font-sans text-foreground">
          <span className="border-r border-border px-4 py-3">{doText}</span>
          <span className="px-4 py-3 text-muted-foreground">{dontText}</span>
        </div>
      ))}
    </div>
  );
}

function SpeakingTimeVisual() {
  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-sans text-muted-foreground">
        <span>Example session</span>
        <span>70% speaking, 30% silence</span>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-surface-card">
        <div className="w-[70%] bg-primary" />
        <div className="w-[30%] bg-muted-foreground/35" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-sans">
        <div className="rounded-2xl bg-surface-card px-3 py-2 text-primary">Speaking time: 70%</div>
        <div className="rounded-2xl bg-surface-card px-3 py-2 text-muted-foreground">Silence: 30%</div>
      </div>
    </div>
  );
}

function PromptVisual() {
  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="rounded-[18px] border border-border bg-surface-card p-4">
        <p className="mb-4 text-lg font-serif font-medium leading-snug text-foreground">
          Should public speaking be judged more on clarity or charisma?
        </p>
        <span className="inline-flex min-h-10 items-center rounded-full bg-primary px-5 text-sm font-sans font-black text-primary-foreground">
          Start Speaking
        </span>
      </div>
    </div>
  );
}

function ArticleVisual({ visual }: { visual: VisualKey }) {
  if (visual === 'flow') return <FlowVisual />;
  if (visual === 'score') return <ScoreVisual />;
  if (visual === 'pauses') return <PausesVisual />;
  if (visual === 'fillers') return <FillerVisual />;
  if (visual === 'streaks') return <StreakVisual />;
  if (visual === 'challenges') return <LeaderboardVisual />;
  if (visual === 'telegram') return <TelegramVisual />;
  if (visual === 'tips') return <TipsVisual />;
  if (visual === 'time') return <SpeakingTimeVisual />;
  return <PromptVisual />;
}

function ArticleContent({ article }: { article: HelpArticle }) {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <p className="mb-2 text-sm font-sans font-bold text-primary">{article.subheader}</p>
        <p className="text-sm font-sans leading-relaxed text-foreground md:text-base">{article.body}</p>
      </div>
      <ArticleVisual visual={article.visual} />
    </div>
  );
}

function HeroArticleCard({ article }: { article: HelpArticle }) {
  return (
    <article className="w-full rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card md:p-6">
      <h2 className="mb-3 text-2xl font-serif font-medium leading-tight text-foreground md:text-3xl">
        {article.title}
      </h2>
      <p className="mb-4 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
        {article.summary}
      </p>
      <ArticleContent article={article} />
    </article>
  );
}

function CollapsibleArticleCard({
  article,
  isOpen,
  onToggle,
}: {
  article: HelpArticle;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="w-full rounded-[20px] border border-border bg-surface-card p-4 text-left shadow-card transition-colors hover:bg-surface-elevated md:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={isOpen}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-serif font-medium leading-tight text-foreground md:text-xl">
            {article.title}
          </h2>
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-primary">
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
        <p className="truncate text-sm font-sans leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
      </button>
      {isOpen && (
        <div className="mt-4">
          <ArticleContent article={article} />
        </div>
      )}
    </article>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  const [openArticleTitle, setOpenArticleTitle] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-surface-base px-5 pb-24 pt-6 md:px-12 md:pt-8 lg:px-20">
      <main className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="-ml-2 mb-8 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <header className="mb-8 text-left">
          <h1 className="mb-2 text-4xl font-serif font-medium text-foreground md:text-5xl">Help</h1>
          <p className="max-w-2xl text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
            Clear answers about practice, scoring, prompts, challenges, and Telegram.
          </p>
        </header>

        <section className="mb-4 flex flex-col gap-3 md:mb-5">
          {heroArticles.map((article) => (
            <HeroArticleCard key={article.title} article={article} />
          ))}
        </section>

        <section className="flex flex-col gap-3">
          {collapsibleArticles.map((article) => {
            const isOpen = openArticleTitle === article.title;

            return (
              <CollapsibleArticleCard
                key={article.title}
                article={article}
                isOpen={isOpen}
                onToggle={() => setOpenArticleTitle(isOpen ? null : article.title)}
              />
            );
          })}
        </section>
      </main>
    </div>
  );
}
