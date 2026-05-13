import { type ReactNode, useState } from 'react';
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
  | 'prompts'
  | 'clean-pauses'
  | 'hesitation-trend'
  | 'confidence-habits'
  | 'thinking-flow'
  | 'highlighted-transcript'
  | 'topic-familiarity'
  | 'weekly-practice'
  | 'fluency-ratio';

type HelpArticle = {
  title: string;
  summary: string;
  subheader: string;
  body: ReactNode;
  visual?: VisualKey;
};

const helpArticles: HelpArticle[] = [
  {
    title: 'What NoPause Helps You Do',
    summary: 'Build steadier speaking flow through recorded practice.',
    subheader: 'Practice speaking without stopping every time a thought changes',
    body: (
      <div className="space-y-4">
        <p>
          <strong>NoPause helps you practice continuous speaking</strong> by turning each recording into simple feedback you can review.
        </p>
        <p>
          You can use it to notice <strong>long pauses, filler words, silence time, and the parts of your answer where your flow breaks.</strong>
        </p>
        <p>
          The goal is not perfect speech. <strong>The goal is to keep going, review what happened, and make the next session smoother.</strong>
        </p>
      </div>
    ),
    visual: 'flow',
  },
  {
    title: 'How A Practice Session Works',
    summary: 'Choose a topic, speak, review the result, and repeat.',
    subheader: 'The basic loop is simple on purpose',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Start by choosing a prompt or speaking freely.</strong> A prompt gives you a quick topic, but you can also practice any thought you want.
        </p>
        <p>
          <strong>Record your answer, then review your Flow Score, speaking time, silence time, pause count, filler count, and transcript.</strong>
        </p>
        <p>
          Repeat with one small focus for the next attempt. <strong>Short, regular reps matter more than one perfect recording.</strong>
        </p>
      </div>
    ),
    visual: 'tips',
  },
  {
    title: 'Understanding Your Results',
    summary: 'Learn what each result metric means after a session.',
    subheader: 'Each metric explains a different part of your speaking flow',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Flow Score is the main signal</strong> for how continuously you spoke. Speaking time shows active speech, silence time shows quiet gaps, pause count shows longer breaks, filler count shows repeated hesitation words, and transcript lets you review the actual words.
        </p>
        <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated text-sm font-sans">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-surface-card px-4 py-3 text-xs font-bold text-muted-foreground">
            <span>Example</span>
            <span>Strong session</span>
            <span>Weak session</span>
          </div>
          {[
            ['Flow Score', '214', '47'],
            ['Speaking time', '2m 28s', '54s'],
            ['Silence time', '18s', '1m 34s'],
            ['Pause count', '2', '11'],
            ['Filler count', '3', '18'],
          ].map(([metric, strong, weak]) => (
            <div key={metric} className="grid grid-cols-[1fr_1fr_1fr] border-t border-border px-4 py-3">
              <span className="text-muted-foreground">{metric}</span>
              <span className="font-bold text-primary">{strong}</span>
              <span className="text-foreground">{weak}</span>
            </div>
          ))}
        </div>
        <p>
          <strong>The transcript gives the numbers context.</strong> Use it to see where you stopped, repeated yourself, or found a cleaner way to say the same idea.
        </p>
      </div>
    ),
    visual: 'time',
  },
  {
    title: 'What Flow Score Means',
    summary: 'A higher score usually means steadier speech with fewer long stops.',
    subheader: 'Use Flow Score as a progress signal, not a grade',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Flow Score summarizes how well you kept speech moving.</strong> More active speaking and fewer long stops usually push the score higher.
        </p>
        <p>
          A single score is only one snapshot. <strong>The useful pattern is whether your baseline improves across repeated sessions.</strong>
        </p>
      </div>
    ),
    visual: 'score',
  },
  {
    title: 'What Counts As A Pause',
    summary: 'NoPause separates natural gaps from longer breaks in your flow.',
    subheader: 'Not every quiet moment is a problem',
    body: (
      <div className="space-y-4">
        <p>
          <strong>A pause is a longer silence that interrupts the flow of your answer.</strong> Short gaps between words can be normal and do not need to feel wrong.
        </p>
        <p>
          Pause count helps you find the moments where your thought stopped moving. <strong>Reducing those longer breaks is one of the clearest ways to improve flow.</strong>
        </p>
      </div>
    ),
    visual: 'pauses',
  },
  {
    title: 'Prompts And Speaking Topics',
    summary: 'Use prompts when you want a quick topic for practice.',
    subheader: 'Prompts reduce the friction before recording',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Prompts give you something to answer right away.</strong> They are useful when you want to practice speaking instead of spending time choosing a topic.
        </p>
        <p>
          You can also ignore prompts and speak freely. <strong>The topic helps you start, but your speaking flow is what NoPause measures.</strong>
        </p>
      </div>
    ),
    visual: 'prompts',
  },
  {
    title: 'Streaks And Progress',
    summary: 'Streaks track consistent practice across days.',
    subheader: 'Progress comes from repeated sessions',
    body: (
      <div className="space-y-4">
        <p>
          <strong>A streak helps you keep the habit visible.</strong> Saving a practice session for the day keeps your consistency moving.
        </p>
        <p>
          Your history matters more than one result. <strong>Look for fewer long pauses, more speaking time, and steadier scores over time.</strong>
        </p>
      </div>
    ),
    visual: 'streaks',
  },
  {
    title: 'Privacy And Data',
    summary: 'Understand what happens to recordings, transcripts, and account links.',
    subheader: 'Your practice history belongs with your account',
    body: (
      <div className="space-y-4">
        <p>
          <strong>NoPause asks for microphone permission so you can record a session.</strong> You stay in control of when a recording starts and ends.
        </p>
        <p>
          <strong>Your transcript, score, and session stats can be saved to your account</strong> so you can review progress later.
        </p>
        <p>
          If you connect Telegram, <strong>NoPause links your Telegram practice to the same account history.</strong> That lets voice-note sessions count alongside web sessions.
        </p>
      </div>
    ),
  },
  {
    title: 'Telegram Practice',
    summary: 'Send a voice note in Telegram and get a NoPause result.',
    subheader: 'Practice without opening the web app',
    body: (
      <div className="space-y-4">
        <p>
          <strong>The Telegram bot lets you practice by sending a voice note.</strong> After your account is connected, the bot can return a NoPause-style result.
        </p>
        <p>
          Telegram practice is useful when you want a quick rep from a chat. <strong>Your saved Telegram sessions can still support your NoPause progress history.</strong>
        </p>
      </div>
    ),
    visual: 'telegram',
  },
  {
    title: 'Challenges',
    summary: 'Speak on the same prompt and compare attempts.',
    subheader: 'Challenges make practice social',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Challenges give people the same prompt</strong> so results are easier to compare.
        </p>
        <p>
          Friend and group challenges can show ranked attempts by Flow Score. <strong>Use them when you want accountability or a shared speaking rep.</strong>
        </p>
      </div>
    ),
    visual: 'challenges',
  },
  {
    title: 'Detailed Scoring FAQ',
    summary: 'Exact scoring formula, pause thresholds, and technical scoring details.',
    subheader: 'Use this section when you want the precise rules',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Flow Score uses whole seconds of speaking time.</strong> The formula is speaking seconds plus 40 points for every completed speaking minute, minus 10 points for each pause unit.
        </p>
        <p>
          <strong>The final score never goes below zero.</strong> If a session has fewer than 5 seconds of speech, it is marked incomplete and receives a score of 0.
        </p>
        <p>
          <strong>Pause thresholds depend on difficulty.</strong> Beginner counts a pause after 1.8 seconds, intermediate after 1.2 seconds, and advanced after 0.8 seconds.
        </p>
        <p>
          <strong>Very short gaps under 300 milliseconds are ignored.</strong> The first 2 seconds and final 1 second of a recording are filtered out of pause penalties so starting and stopping do not distort the result.
        </p>
        <p>
          Longer gaps can create multiple pause units because NoPause divides the silence by the selected threshold and counts whole units. Filler words are tracked from transcripts for feedback, but <strong>they are not part of the Flow Score formula.</strong>
        </p>
        <p>
          <strong>Telegram voice notes use transcript word timing</strong> to estimate speaking time and pause gaps. Voice notes are limited to 5 minutes, and Telegram challenge leaderboards rank attempts by best Flow Score.
        </p>
      </div>
    ),
  },
];

const improveSpeakingArticles: HelpArticle[] = [
  {
    title: 'How to stop saying um and uh',
    summary: 'Replace hesitation sounds with intentional pauses.',
    subheader: 'Replace hesitation sounds with intentional pauses',
    body:
      'Fillers often appear when your brain is buying time between thought formation and sentence production. The sound comes out before the next idea is ready, which makes the hesitation audible to the listener. A quiet pause does the same neurological job without weakening the sentence. It gives your brain time to select the next word while making you sound deliberate instead of uncertain. To catch yourself, record short sessions, review the exact spots where fillers appear, and practice replacing the first filler sound with one silent breath before continuing.',
    visual: 'clean-pauses',
  },
  {
    title: 'How to reduce hesitation when speaking',
    summary: 'Use structure and tracking to keep your flow moving.',
    subheader: "Hesitation breaks your flow and your listener's attention",
    body:
      'A thinking pause is a controlled break that helps the next idea land. Hesitation is different: it feels uncontrolled, repeats often, and pulls attention away from your message. Before speaking, use a simple structure such as point, reason, example, conclusion so your brain always has a next step. Then track hesitation count across sessions instead of judging a single recording. When the count drops over repeated practice, you can see that your speaking flow is becoming more automatic.',
    visual: 'hesitation-trend',
  },
  {
    title: 'How to speak more confidently',
    summary: 'Confidence grows from repeated proof that you can keep going.',
    subheader: 'Confidence comes from repetition not preparation',
    body:
      'Confidence is not built by preparing one perfect speech. It is built by producing many imperfect reps and learning that you can recover while speaking. Recording yourself removes the mystery: you hear what actually happened, review the score, and stop imagining the session was worse than it was. Short daily sessions compound because each one lowers the fear of starting. Over time, the act of speaking becomes familiar, and familiar actions feel more confident.',
    visual: 'confidence-habits',
  },
  {
    title: 'How to think faster while speaking',
    summary: 'Practice forming thoughts while words are already moving.',
    subheader: 'Train your brain to form thoughts at speaking speed',
    body:
      'Most people can think faster than they speak, but pressure changes the timing. In a live moment, you may wait for a complete thought before starting, which creates silence and hesitation. Prompts train the opposite skill: begin with a reasonable first sentence, then let the next thought form while you are already speaking. This builds real-time thinking because your brain learns to organize ideas at speaking speed instead of waiting for a finished script.',
    visual: 'thinking-flow',
  },
  {
    title: 'How to eliminate filler words',
    summary: 'Spot the habit loop, then replace the cue with silence.',
    subheader: 'Awareness is the first step to elimination',
    body:
      'Fillers are a habit loop: uncertainty is the cue, the filler is the routine, and the reward is a tiny bit of extra thinking time. You reduce the habit by seeing where it happens and replacing the routine. NoPause transcript highlights make patterns visible, such as fillers at the start of answers or after long clauses. For daily practice, choose one filler, speak for two minutes, and restart the sentence silently whenever that filler appears. The goal is not instant perfection; it is faster awareness.',
    visual: 'highlighted-transcript',
  },
  {
    title: 'Why do I pause so much when talking',
    summary: 'Long gaps usually come from load, pressure, or unfamiliar topics.',
    subheader: 'Pausing is normal but long gaps hurt your flow',
    body:
      'Pausing is part of normal speech, but long gaps usually mean cognitive load is too high. You are choosing words, organizing ideas, monitoring how you sound, and sometimes managing anxiety at the same time. Anxiety increases pause frequency because it makes your brain self-check while you are trying to speak. Start with familiar topics so idea generation is easier, then move gradually to harder prompts. As topic familiarity increases, your pauses usually become shorter and less frequent.',
    visual: 'topic-familiarity',
  },
  {
    title: 'How to practice public speaking alone',
    summary: 'Use short solo reps to build skill before adding an audience.',
    subheader: 'Solo practice is the most underrated speaking tool',
    body:
      'Early speaking practice works best when the feedback loop is fast and low pressure. Group practice can help later, but solo practice lets you repeat more often, try again immediately, and focus on one weakness at a time. A strong 5 minute NoPause session is simple: pick a prompt, speak for two or three minutes, review Flow Score, pause count, silence time, and transcript, then repeat one focused section. Track Flow Score over weeks to measure whether your baseline is rising.',
    visual: 'weekly-practice',
  },
  {
    title: 'How to speak clearly and fluently',
    summary: 'Increase active speaking time while reducing silence time.',
    subheader: 'Fluency is speaking time divided by total time',
    body:
      'Clear fluency is partly a ratio: how much of the session is active speaking compared with silence. More speaking time and less silence usually means your thoughts are moving more smoothly from idea to sentence. A strong fluency session often has a high speaking-time share with only brief natural gaps, while a weak one has large silent sections that interrupt the listener. Use your session history to compare the ratio over time, not just one recording, and look for a steady trend toward more continuous speech.',
    visual: 'fluency-ratio',
  },
];

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
  const ranges = [
    ['0-49', 'Needs Practice'],
    ['50-99', 'Getting There'],
    ['100-199', 'Good Flow'],
    ['200-299', 'Great Flow'],
    ['300+', 'Perfect Flow'],
  ];

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="overflow-hidden rounded-full border border-border bg-surface-card">
        <div className="grid grid-cols-5">
          {ranges.map(([range, label], index) => (
            <div
              key={range}
              className={`min-h-4 border-r border-surface-base last:border-r-0 ${
                index < 2 ? 'bg-muted-foreground/30' : index < 4 ? 'bg-primary/50' : 'bg-primary'
              }`}
              aria-label={`${range} ${label}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs font-sans text-muted-foreground sm:grid-cols-5">
        {ranges.map(([range, label]) => (
          <div key={range} className="rounded-xl border border-border bg-surface-card px-3 py-2">
            <p className="font-bold text-foreground">{range}</p>
            <p>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PausesVisual() {
  const segments = [
    ['speech', 'w-[24%]', 'Opening'],
    ['pause', 'w-[8%]', 'Pause'],
    ['speech', 'w-[34%]', 'Main point'],
    ['pause', 'w-[10%]', 'Long pause'],
    ['speech', 'w-[24%]', 'Finish'],
  ];

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-sans text-muted-foreground">
        <span>Example speaking timeline</span>
        <span>Speech and pause blocks</span>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-surface-card">
        {segments.map(([kind, width, label], index) => (
          <div
            key={`${label}-${index}`}
            className={`${width} ${kind === 'speech' ? 'bg-primary' : 'bg-muted-foreground/35'}`}
            aria-label={label}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2 text-[0.7rem] font-sans text-muted-foreground">
        {segments.map(([kind, , label], index) => (
          <span key={`${label}-label-${index}`} className={kind === 'speech' ? 'text-primary' : 'text-muted-foreground'}>
            {label}
          </span>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-xs font-sans text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span>Speaking</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
          <span>Pause</span>
        </span>
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

function CleanPausesVisual() {
  const rows = [
    ['With fillers', 'I think, um, the best approach is, uh, to start smaller.'],
    ['With a clean pause', 'I think the best approach is ... to start smaller.'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <table className="w-full text-left text-sm font-sans">
        <tbody>
          {rows.map(([label, sentence]) => (
            <tr key={label} className="border-b border-border last:border-b-0">
              <th className="w-36 bg-surface-card px-4 py-3 align-top text-xs font-bold text-muted-foreground">
                {label}
              </th>
              <td className="px-4 py-3 leading-relaxed text-foreground">{sentence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HesitationTrendVisual() {
  const sessions = [
    ['S1', 14],
    ['S2', 11],
    ['S3', 8],
    ['S4', 6],
    ['S5', 3],
  ];
  const maxCount = 14;

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="mb-4 flex items-center justify-between text-xs font-sans text-muted-foreground">
        <span>Hesitation count</span>
        <span>5 sessions</span>
      </div>
      <div className="grid grid-cols-5 items-end gap-3">
        {sessions.map(([label, count]) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-xl bg-surface-card p-1.5">
              <div
                className="w-full rounded-lg bg-primary"
                style={{ height: `${(Number(count) / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs font-sans font-bold text-foreground">{count}</span>
            <span className="text-[0.7rem] font-sans text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceHabitsVisual() {
  const rows = [
    ['Wait until ready', 'Start with a clear first sentence'],
    ['Avoid recordings', 'Review recordings quickly'],
    ['Judge one mistake', 'Measure the full session'],
    ['Practice rarely', 'Practice in short daily reps'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-2 bg-surface-card text-xs font-sans font-bold text-muted-foreground">
        <span className="border-r border-border px-4 py-3">Low confidence habits</span>
        <span className="px-4 py-3">High confidence habits</span>
      </div>
      {rows.map(([low, high]) => (
        <div key={low} className="grid grid-cols-2 border-t border-border text-sm font-sans">
          <span className="border-r border-border px-4 py-3 text-muted-foreground">{low}</span>
          <span className="px-4 py-3 text-foreground">{high}</span>
        </div>
      ))}
    </div>
  );
}

function ThinkingFlowVisual() {
  const steps = ['Hear prompt', 'Start speaking', 'Thought forms mid-sentence'];

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        {steps.map((step, index) => (
          <div key={step} className="contents">
            <div className="flex min-h-16 items-center justify-center rounded-2xl border border-border bg-surface-card px-4 text-center text-sm font-sans font-bold text-foreground">
              {step}
            </div>
            {index < steps.length - 1 && (
              <span className="hidden text-sm font-sans font-black text-primary sm:block" aria-hidden="true">
                -&gt;
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightedTranscriptVisual() {
  const highlightClass = 'rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-primary';

  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <p className="text-sm font-sans leading-7 text-foreground">
        I wanted to explain the plan,{' '}
        <span className={highlightClass}>um</span> first we should narrow the topic, then{' '}
        <span className={highlightClass}>uh</span> use one example and finish with a clear point.
      </p>
    </div>
  );
}

function TopicFamiliarityVisual() {
  const rows = [
    ['Unfamiliar topic', 'High load', '12 pauses'],
    ['Somewhat familiar', 'Medium load', '7 pauses'],
    ['Familiar topic', 'Low load', '3 pauses'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-[1.2fr_1fr_88px] bg-surface-card px-4 py-3 text-xs font-sans font-bold text-muted-foreground">
        <span>Topic</span>
        <span>Load</span>
        <span className="text-right">Pauses</span>
      </div>
      {rows.map(([topic, load, pauses]) => (
        <div key={topic} className="grid grid-cols-[1.2fr_1fr_88px] border-t border-border px-4 py-3 text-sm font-sans">
          <span className="text-foreground">{topic}</span>
          <span className="text-muted-foreground">{load}</span>
          <span className="text-right font-bold text-primary">{pauses}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyPracticeVisual() {
  const rows = [
    ['Mon', '5 min', 'Baseline flow'],
    ['Tue', '5 min', 'Fewer fillers'],
    ['Wed', '5 min', 'Shorter pauses'],
    ['Thu', '5 min', 'Clear examples'],
    ['Fri', '5 min', 'Review trend'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-[64px_80px_1fr] bg-surface-card px-4 py-3 text-xs font-sans font-bold text-muted-foreground">
        <span>Day</span>
        <span>Length</span>
        <span>Focus</span>
      </div>
      {rows.map(([day, length, focus]) => (
        <div key={day} className="grid grid-cols-[64px_80px_1fr] border-t border-border px-4 py-3 text-sm font-sans text-foreground">
          <span>{day}</span>
          <span className="text-primary">{length}</span>
          <span>{focus}</span>
        </div>
      ))}
    </div>
  );
}

function FluencyRatioVisual() {
  const sessions = [
    ['Weak session', 45, 55],
    ['Strong session', 82, 18],
  ];

  return (
    <div className="space-y-4 rounded-[18px] border border-border bg-surface-elevated p-4">
      {sessions.map(([label, speaking, silence]) => (
        <div key={label}>
          <div className="mb-2 flex items-center justify-between text-xs font-sans text-muted-foreground">
            <span>{label}</span>
            <span>{speaking}% speaking</span>
          </div>
          <div className="flex h-5 overflow-hidden rounded-full bg-surface-card">
            <div className="bg-primary" style={{ width: `${speaking}%` }} />
            <div className="bg-muted-foreground/35" style={{ width: `${silence}%` }} />
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs font-sans text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Speaking
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
          Silence
        </span>
      </div>
    </div>
  );
}

function ArticleVisual({ visual }: { visual?: VisualKey }) {
  if (!visual) return null;
  if (visual === 'flow') return <FlowVisual />;
  if (visual === 'score') return <ScoreVisual />;
  if (visual === 'pauses') return <PausesVisual />;
  if (visual === 'fillers') return <FillerVisual />;
  if (visual === 'streaks') return <StreakVisual />;
  if (visual === 'challenges') return <LeaderboardVisual />;
  if (visual === 'telegram') return <TelegramVisual />;
  if (visual === 'tips') return <TipsVisual />;
  if (visual === 'time') return <SpeakingTimeVisual />;
  if (visual === 'clean-pauses') return <CleanPausesVisual />;
  if (visual === 'hesitation-trend') return <HesitationTrendVisual />;
  if (visual === 'confidence-habits') return <ConfidenceHabitsVisual />;
  if (visual === 'thinking-flow') return <ThinkingFlowVisual />;
  if (visual === 'highlighted-transcript') return <HighlightedTranscriptVisual />;
  if (visual === 'topic-familiarity') return <TopicFamiliarityVisual />;
  if (visual === 'weekly-practice') return <WeeklyPracticeVisual />;
  if (visual === 'fluency-ratio') return <FluencyRatioVisual />;
  return <PromptVisual />;
}

function ArticleContent({ article }: { article: HelpArticle }) {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <p className="mb-2 text-sm font-sans font-bold text-primary">{article.subheader}</p>
        {typeof article.body === 'string' ? (
          <p className="text-sm font-sans leading-relaxed text-foreground md:text-base">{article.body}</p>
        ) : (
          <div className="text-sm font-sans leading-relaxed text-foreground md:text-base">{article.body}</div>
        )}
      </div>
      <ArticleVisual visual={article.visual} />
    </div>
  );
}

function PracticeFlowStrip() {
  const steps = ['Speak', 'Analyze', 'Score', 'Improve'];

  return (
    <div className="mb-6 rounded-[18px] border border-border bg-surface-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-sans font-bold text-foreground">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span>{step}</span>
            {index < steps.length - 1 && (
              <span className="text-muted-foreground" aria-hidden="true">
                &rarr;
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
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

        <PracticeFlowStrip />

        <section className="flex flex-col gap-3">
          {helpArticles.map((article) => {
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

        <section className="mt-12">
          <div className="mb-5">
            <h2 className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              Improve Your Speaking
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {improveSpeakingArticles.map((article) => {
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
          </div>
        </section>
      </main>
    </div>
  );
}
