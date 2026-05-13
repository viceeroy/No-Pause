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
    summary: 'Speak, get a score, and build confidence over time.',
    subheader: 'A simple loop for steadier speaking',
    body: (
      <div className="space-y-4">
        <p>
          <strong>You speak, NoPause listens and scores you, and you improve over time.</strong> That is the whole idea.
        </p>
        <p>
          <strong>The goal is better speaking confidence, stronger fluency, and less hesitation.</strong> Each session gives you another chance to sound steadier than before.
        </p>
      </div>
    ),
    visual: 'flow',
  },
  {
    title: 'Who NoPause Helps',
    summary: 'For people who want to sound clearer and more confident.',
    subheader: 'A friendly place to practice out loud',
    body: (
      <div className="space-y-4">
        <p>
          <strong>NoPause helps people preparing for interviews, presentations, and everyday moments where they want to speak clearly.</strong> It gives you a private place to practice before the moment matters.
        </p>
        <p>
          <strong>It is useful for anyone building speaking confidence, reducing filler words, and lowering hesitation.</strong> It also fits English fluency practice when you want more real speaking reps.
        </p>
        <p>
          <strong>It also helps if you want to hear yourself more clearly.</strong> Listening back can make practice speaking feel more concrete and less mysterious.
        </p>
      </div>
    ),
  },
  {
    title: 'How A Practice Session Works',
    summary: 'Choose a topic, record, review, and repeat.',
    subheader: 'Practice is action-oriented by design',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Start by choosing a prompt or speaking freely.</strong> Pick the path that gets you talking fastest.
        </p>
        <p>
          <strong>Record your answer, review your results, then try again.</strong> The loop stays simple so you can focus on fluency instead of setup.
        </p>
        <p>
          <strong>Repeat with a small focus for the next attempt.</strong> Short, regular reps help you reduce pauses and keep moving through imperfect sentences.
        </p>
      </div>
    ),
    visual: 'tips',
  },
  {
    title: 'Understanding Your Results',
    summary: 'See what each result tells you after a session.',
    subheader: 'Each result explains a different part of your speaking',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Flow Score shows how continuously you spoke.</strong> Use it as a quick signal for whether your answer kept moving.
        </p>
        <p>
          <strong>Speaking time is how long your voice was active, and silence time is the gaps between speech.</strong> Together they show whether you are filling the session with clear speaking or getting stuck.
        </p>
        <p>
          <strong>Pause count shows how often you stopped too long, and filler count shows hesitation words.</strong> These help you spot habits you can work on in your next session.
        </p>
        <p>
          <strong>The transcript is what you said.</strong> Read it back to hear your ideas more clearly and find a better way to say the same thought.
        </p>
      </div>
    ),
  },
  {
    title: 'What Flow Score Means',
    summary: 'Higher scores mean steadier speech with fewer long stops.',
    subheader: 'Use Flow Score as a progress signal',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Flow Score measures how continuously you speak with fewer long hesitations.</strong> Higher is better because it usually means your thoughts kept moving.
        </p>
        <p>
          <strong>Do not treat a single score like a final judgment.</strong> The useful question is whether your speaking is getting smoother over time.
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
          <strong>NoPause ignores tiny natural gaps between words.</strong> Normal breaths and quick spaces do not need to feel like mistakes.
        </p>
        <p>
          <strong>Only longer silences count as pauses.</strong> Easier difficulty is more forgiving, while harder difficulty catches shorter gaps.
        </p>
        <p>
          <strong>Reducing those longer breaks helps your answer feel more fluent.</strong> The timeline below shows speech blocks in the brand color and pause markers in the muted color.
        </p>
      </div>
    ),
    visual: 'pauses',
  },
  {
    title: 'How To Improve Your Flow Score',
    summary: 'Keep speaking, use prompts, and practice consistently.',
    subheader: 'Small steady habits improve speaking flow',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Keep talking through imperfect sentences.</strong> You can often recover while speaking instead of stopping completely to find the perfect wording.
        </p>
        <p>
          <strong>Use prompts when overthinking slows you down.</strong> A topic gives your brain a starting point so you can practice speaking sooner.
        </p>
        <p>
          <strong>Practice short sessions consistently.</strong> Repetition makes fluency feel more automatic and helps reduce pauses over time.
        </p>
      </div>
    ),
    visual: 'tips',
  },
  {
    title: 'Prompts And Speaking Topics',
    summary: 'Pick a topic or speak freely when you are ready.',
    subheader: 'Prompts reduce startup friction',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Prompts give you something to answer right away.</strong> They help you start faster when choosing a topic creates hesitation.
        </p>
        <p>
          <strong>You can speak freely or pick a topic.</strong> The categories are Argue, Inform, Describe, and Opinion.
        </p>
        <p>
          <strong>The topic is just the starting point.</strong> The real goal is to speak clearly and keep your thought moving.
        </p>
      </div>
    ),
    visual: 'prompts',
  },
  {
    title: 'Streaks And Progress',
    summary: 'Daily streaks make consistency visible.',
    subheader: 'Progress compounds through repeated practice',
    body: (
      <div className="space-y-4">
        <p>
          <strong>A daily streak helps you keep the habit visible.</strong> It turns practice speaking into something you can return to regularly.
        </p>
        <p>
          <strong>Consistency compounds over time.</strong> Your history can show more fluency, fewer hesitation patterns, and steadier speaking confidence.
        </p>
      </div>
    ),
    visual: 'streaks',
  },
  {
    title: 'Privacy And Data',
    summary: 'Plain-language details about recording and saved history.',
    subheader: 'Your practice history stays connected to your account',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Your microphone is used only during recording.</strong> You choose when a session starts and ends.
        </p>
        <p>
          <strong>Transcripts and scores are saved to your account.</strong> That lets you see your full history and track progress over time.
        </p>
        <p>
          <strong>Telegram linking connects your bot account to your NoPause account.</strong> That lets Telegram voice-note practice appear with the rest of your history.
        </p>
      </div>
    ),
  },
  {
    title: 'Telegram Practice',
    summary: 'Practice from Telegram without opening the app.',
    subheader: 'An optional extra channel for voice notes',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Telegram practice is an optional extra channel.</strong> You can send voice notes without opening the web app.
        </p>
        <p>
          <strong>Connect once, then send voice notes anytime.</strong> It is a quick way to practice speaking when you are already in Telegram.
        </p>
      </div>
    ),
    visual: 'telegram',
  },
  {
    title: 'Challenges',
    summary: 'Use the same prompt and compare results socially.',
    subheader: 'Social practice with shared prompts',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Challenges give everyone the same prompt.</strong> Each person speaks, gets scored, and appears on a leaderboard.
        </p>
        <p>
          <strong>Friend challenges and group challenges make practice social.</strong> They are useful when comparison and accountability help you keep going.
        </p>
      </div>
    ),
    visual: 'challenges',
  },
  {
    title: 'Detailed Scoring FAQ',
    summary: 'Exact scoring details, examples, and implementation notes.',
    subheader: 'Technical details live here',
    body: (
      <div className="space-y-4">
        <p>
          <strong>Flow Score is calculated from whole seconds of speaking time.</strong> You earn 1 point for every second you speak, plus a 40 point bonus for every completed speaking minute.
        </p>
        <p>
          <strong>Pause units subtract from the score.</strong> Each pause unit subtracts 10 points, and the final score is never allowed to go below 0.
        </p>
        <p>
          <strong>Very short sessions are incomplete.</strong> If you speak for fewer than 5 seconds, the session receives a Flow Score of 0.
        </p>
        <p>
          <strong>Difficulty changes the silence threshold.</strong> Beginner counts pauses after 1.8 seconds, intermediate after 1.2 seconds, and advanced after 0.8 seconds.
        </p>
        <p>
          <strong>Tiny gaps under 300 milliseconds are ignored.</strong> The first 2 seconds and final 1 second of a recording are also filtered out of pause penalties.
        </p>
        <p>
          <strong>Long silences can create multiple pause units.</strong> NoPause divides the silence by the active threshold and counts the whole units.
        </p>
        <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated text-sm font-sans">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-surface-card px-4 py-3 text-xs font-bold text-muted-foreground">
            <span>Example</span>
            <span>Strong session</span>
            <span>Weak session</span>
          </div>
          {[
            ['Flow Score', '246', '42'],
            ['Speaking time', '2:06', '0:48'],
            ['Silence time', '0:18', '1:35'],
            ['Pause count', '2', '14'],
            ['Filler count', '1', '11'],
          ].map(([metric, strong, weak]) => (
            <div key={metric} className="grid grid-cols-[1fr_1fr_1fr] border-t border-border px-4 py-3">
              <span className="text-muted-foreground">{metric}</span>
              <span className="font-bold text-primary">{strong}</span>
              <span className="text-foreground">{weak}</span>
            </div>
          ))}
        </div>
        <p>
          <strong>These examples use fake numbers to show how sessions differ.</strong> A stronger session has more active speaking, fewer long pauses, fewer filler words, and a cleaner transcript.
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
    ['Top', 'Maya', 'Great Flow'],
    ['Next', 'Jordan', 'Good Flow'],
    ['Next', 'Sam', 'Getting There'],
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-[72px_1fr_112px] bg-surface-card px-4 py-3 text-xs font-sans font-bold text-muted-foreground">
        <span>Place</span>
        <span>Name</span>
        <span className="text-right">Result</span>
      </div>
      {rows.map(([place, name, result]) => (
        <div key={`${place}-${name}`} className="grid grid-cols-[72px_1fr_112px] border-t border-border px-4 py-3 text-sm font-sans text-foreground">
          <span>{place}</span>
          <span>{name}</span>
          <span className="text-right font-bold text-primary">{result}</span>
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
        {steps.map((step) => (
          <div key={step} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-sans font-black text-primary-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
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
    ['Track trends across sessions', 'Judge progress from a single score'],
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
          <div className="max-w-2xl space-y-1 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
            <p>Improve speaking flow and reduce hesitation with real speaking practice. Track pauses, speaking time, Flow Score, and progress over time.</p>
          </div>
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
