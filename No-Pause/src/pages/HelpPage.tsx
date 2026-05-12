import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const heroCards = [
  {
    title: 'Speaking Flow',
    body: 'How smoothly ideas continue from one sentence to the next.',
  },
  {
    title: 'Hesitation Awareness',
    body: 'Where speech breaks down, restarts, or loses rhythm.',
  },
  {
    title: 'Real-Time Feedback',
    body: 'Feedback after each session so you can adjust the next rep.',
  },
];

const flowSignals = [
  {
    title: 'Continuous Speaking',
    body: 'Repeated speaking sessions train you to keep an answer moving while the next idea is still forming.',
  },
  {
    title: 'Long Pauses',
    body: 'Long breaks are most useful when they turn into recovery. The goal is to continue naturally after a difficult moment.',
  },
  {
    title: 'Speech Stability',
    body: 'A stable rhythm makes your session easier to compare over time, so you can see hesitation patterns changing.',
  },
];

const sampleResults = [
  ['Flow Score', 'Strong opening with a recoverable break'],
  ['Hesitation Pattern', 'A cluster appeared when the answer became less certain'],
  ['Speaking Continuity', 'The response recovered instead of restarting completely'],
];

const hesitationCards = [
  {
    title: 'Natural pauses',
    items: ['breathing', 'sentence pacing', 'short thinking moments', 'quick transitions'],
  },
  {
    title: 'Flow-breaking pauses',
    items: ['stopping mid-thought', 'repeated silence', 'restarting ideas', 'losing response rhythm'],
  },
];

const improvementStages = [
  {
    title: 'Translating',
    body: 'Frequent stopping while searching for words, organizing thoughts, or translating before speaking.',
  },
  {
    title: 'Building Flow',
    body: 'Fewer long pauses, smoother sentence completion, and better recovery when an idea gets difficult.',
  },
  {
    title: 'Automatic Speech',
    body: 'Ideas connect with stable rhythm and less hesitation, even when the answer is not fully planned.',
  },
];

const productBoundaries = [
  {
    title: 'Not',
    items: ['grammar tutoring', 'vocabulary memorization', 'pronunciation drills', 'translation practice'],
  },
  {
    title: 'Is',
    items: [
      'speaking continuity training',
      'hesitation awareness',
      'automatic speech development',
      'behavioral fluency feedback',
    ],
  },
];

const practiceExperienceNotes = [
  'Focused speaking reps',
  'Installable app experience',
  'Session history and progress',
  'Personal speaking practice',
];

const faqs = [
  {
    question: 'Does No Pause correct my English?',
    answer:
      'No Pause is focused on speaking continuity and hesitation patterns. It helps you notice where speech flow breaks down, not memorize grammar rules.',
  },
  {
    question: 'Why does NoPause focus on pauses instead of grammar?',
    answer:
      'Grammar matters, but a person can know the right words and still freeze while speaking. No Pause focuses on the behavioral side of fluency: continuing, recovering, and keeping a response connected.',
  },
  {
    question: 'Why does my score change between sessions?',
    answer:
      'Your score can change when your rhythm, completion, pause pattern, topic comfort, or speaking consistency changes.',
  },
  {
    question: 'What affects my Flow Score?',
    answer:
      'Your speaking continuity, long-break pattern, response completion, and overall rhythm all influence the session result. Think of it as a signal for how well your speech kept moving.',
  },
  {
    question: 'Do natural pauses count against me?',
    answer:
      'Natural pauses are part of normal speech. No Pause is more concerned with repeated stops that interrupt your flow or make the response hard to continue.',
  },
  {
    question: 'Can pauses ever be helpful?',
    answer:
      'Yes. A pause can help you breathe, emphasize a point, or prepare the next idea. The problem is not silence by itself; it is losing the thread and struggling to continue.',
  },
  {
    question: 'Why do I lose flow in the middle of answers?',
    answer:
      'The middle is where you often run out of prepared language and need to generate ideas in real time. No Pause helps you notice that moment so you can train recovery instead of restarting.',
  },
  {
    question: 'Does speaking faster improve my score?',
    answer:
      'Not by itself. Fast speech can still feel unstable if it has abrupt stops or unclear recovery. The better target is steady speech that stays connected.',
  },
  {
    question: 'Why do repeated sessions matter?',
    answer:
      'One session shows a snapshot. Repeated sessions show whether you are recovering faster, pausing less disruptively, and building more automatic response flow over time.',
  },
  {
    question: 'What happens when I restart a sentence?',
    answer:
      'Restarting is normal, especially for beginners. The useful question is whether you recover and continue, or whether the restart turns into a larger break in the answer.',
  },
  {
    question: 'Does NoPause understand different accents?',
    answer:
      'No Pause is designed around speech-flow behavior rather than accent correction. Audio and transcript quality can vary by environment, but the training goal is continuity, not sounding like one accent.',
  },
  {
    question: 'Why can one topic feel easier than another?',
    answer:
      'Familiar topics require less idea generation. Harder topics increase the mental load, which can create more stops, restarts, and slower recovery.',
  },
  {
    question: 'What makes a strong speaking session?',
    answer:
      'A strong session usually has a clear start, connected ideas, manageable pauses, and recovery when the answer gets difficult. It does not need to be perfect.',
  },
  {
    question: 'Is the goal to remove all pauses?',
    answer:
      'No. Strong speakers are not pause-free. They recover faster and continue more naturally.',
  },
  {
    question: 'Why do I sound smoother on some days?',
    answer:
      'Topic familiarity, energy, anxiety, environment, and practice consistency all affect speech flow. That is why trends over repeated sessions are more useful than judging one recording.',
  },
  {
    question: 'How should beginners use NoPause?',
    answer:
      'Start with short sessions and familiar topics. Focus on finishing the answer, then gradually train smoother continuation and faster recovery.',
  },
  {
    question: 'How long should I practice?',
    answer:
      'Start with short, repeatable sessions. A few focused minutes are useful when you review the feedback and try again with one specific improvement.',
  },
  {
    question: 'Can I get a perfect score?',
    answer:
      'The goal is not perfection. The goal is more automatic speech flow, fewer hesitation patterns, and better recovery when you lose your place.',
  },
  {
    question: 'Does No Pause work on Telegram?',
    answer:
      'Yes. Telegram practice lets you send a voice note and receive No Pause feedback from a private chat flow.',
  },
  {
    question: 'How does Telegram practice work?',
    answer:
      'You connect your account, send a voice note, and receive a No Pause result from the bot. It is useful when you want a quick speaking rep without opening the web app.',
  },
];

function Section({
  title,
  children,
  eyebrow,
}: {
  title: string;
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="mt-12">
      {eyebrow && (
        <p className="mb-2 text-xs font-sans font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="mb-5 text-2xl font-serif font-medium text-foreground md:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
      <h3 className="mb-2 text-lg font-serif font-medium leading-tight text-foreground">{title}</h3>
      <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
      <h3 className="mb-4 text-lg font-serif font-medium text-foreground">{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-sans leading-relaxed text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

const flowControlLabels = ['Low', 'Medium', 'High'];

function FlowControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-sans font-bold text-foreground">{label}</span>
        <span className="rounded-full border border-border bg-surface-card px-3 py-1 text-xs font-sans font-bold text-primary">
          {flowControlLabels[value]}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label={label}
      />
    </label>
  );
}

function FlowPreview() {
  const [continuousSpeaking, setContinuousSpeaking] = useState(1);
  const [longPauses, setLongPauses] = useState(1);
  const [speechStability, setSpeechStability] = useState(1);

  const previewScore = Math.max(
    12,
    Math.min(98, 48 + continuousSpeaking * 16 + speechStability * 14 - longPauses * 13),
  );
  const flowFeel = previewScore >= 76 ? 'Smooth' : previewScore >= 52 ? 'Mixed' : 'Interrupted';
  const pauseMarkerCount = [0, 2, 4][longPauses] ?? 0;
  const pauseMarkerPositions = [19, 38, 61, 82].slice(0, pauseMarkerCount);
  const continuityWidth = Math.max(24, Math.min(96, 44 + continuousSpeaking * 18 + speechStability * 14 - longPauses * 12));

  const waveformPoints = useMemo(() => {
    const roughness = 22 - continuousSpeaking * 6 - speechStability * 5 + longPauses * 7;
    const base = 58;

    return Array.from({ length: 24 }, (_, index) => {
      const x = 3 + index * 4.1;
      const wave = Math.sin(index * 0.78) * roughness;
      const interruption = longPauses > 0 && index % (6 - longPauses) === 0 ? longPauses * 4.5 : 0;
      const y = Math.max(18, Math.min(92, base + wave + interruption));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [continuousSpeaking, longPauses, speechStability]);

  return (
    <article className="mt-5 rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
        <div>
          <p className="mb-2 text-xs font-sans font-bold uppercase tracking-[0.18em] text-primary">
            Flow Preview
          </p>
          <h3 className="mb-3 text-2xl font-serif font-medium text-foreground">Adjust the flow feel</h3>
          <p className="mb-4 text-sm font-sans leading-relaxed text-muted-foreground">
            This preview shows the behavior No Pause rewards: steady speech, fewer long breaks, and smoother continuation.
          </p>
          <p className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm font-sans leading-relaxed text-foreground">
            Your real score is based on your actual session.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <FlowControl
              label="Continuous Speaking"
              value={continuousSpeaking}
              onChange={setContinuousSpeaking}
            />
            <FlowControl
              label="Long Pauses"
              value={longPauses}
              onChange={setLongPauses}
            />
            <FlowControl
              label="Speech Stability"
              value={speechStability}
              onChange={setSpeechStability}
            />
          </div>

          <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-sans font-bold text-muted-foreground">Flow Score Preview</p>
                <p className="mt-1 text-4xl font-serif font-medium text-foreground">{previewScore}</p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-sans font-bold text-primary">
                Flow feel: {flowFeel}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-card p-3">
              <svg viewBox="0 0 100 110" role="img" aria-label="Illustrative speech flow waveform" className="h-40 w-full">
                <polyline
                  points={waveformPoints}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.08"
                  className="transition-all duration-500"
                />
                <polyline
                  points={waveformPoints}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-500"
                />
                {pauseMarkerPositions.map((position) => (
                  <g key={position}>
                    <rect
                      x={position - 2.6}
                      y="18"
                      width="5.2"
                      height="78"
                      rx="2.6"
                      fill="hsl(var(--background))"
                      opacity="0.58"
                    />
                    <line
                      x1={position}
                      x2={position}
                      y1="16"
                      y2="96"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1.5"
                      strokeDasharray="4 5"
                      opacity="0.65"
                    />
                    <circle cx={position} cy="96" r="2.8" fill="hsl(var(--primary))" opacity="0.9" />
                  </g>
                ))}
              </svg>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs font-sans text-muted-foreground">
                <span>Continuity</span>
                <span>{flowFeel}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-card">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${continuityWidth}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProgressOverTime() {
  const sessions = [
    { label: 'Rep 1', markers: 5, width: 42, path: 'M4 56 C18 28 30 82 45 54 C60 24 70 88 96 48' },
    { label: 'Rep 4', markers: 3, width: 64, path: 'M4 56 C20 38 32 70 47 54 C62 36 75 70 96 50' },
    { label: 'Rep 8', markers: 1, width: 84, path: 'M4 55 C22 48 34 61 50 54 C66 47 78 60 96 52' },
  ];

  return (
    <Section title="Progress Over Time">
      <div className="mb-5 rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
        <p className="text-sm font-sans leading-relaxed text-foreground md:text-base">
          Repeated speaking reps help build more automatic response flow over time. The aim is not perfect speech. It is
          faster recovery, steadier rhythm, and less disruptive hesitation when the answer becomes difficult.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {sessions.map((session) => (
          <article key={session.label} className="rounded-[20px] border border-border bg-surface-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-sans font-bold text-foreground">{session.label}</h3>
              <span className="text-xs font-sans text-muted-foreground">continuity</span>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-3">
              <svg viewBox="0 0 100 72" className="h-24 w-full" role="img" aria-label={`${session.label} continuity preview`}>
                <path
                  d={session.path}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                {Array.from({ length: session.markers }, (_, index) => (
                  <circle
                    key={index}
                    cx={18 + index * 14}
                    cy={60}
                    r="2"
                    fill="hsl(var(--muted-foreground))"
                    opacity="0.38"
                  />
                ))}
              </svg>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-card">
                <div className="h-full rounded-full bg-primary" style={{ width: `${session.width}%` }} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-[20px] border border-border bg-surface-card shadow-card transition-colors hover:bg-surface-elevated">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-4 text-left md:p-5"
        aria-expanded={isOpen}
      >
        <h3 className="text-lg font-serif font-medium text-foreground">{question}</h3>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-primary">
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 pb-4 pt-0 md:px-5 md:pb-5">
          <p className="pt-4 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">{answer}</p>
        </div>
      )}
    </article>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<string | null>(null);

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

        <header className="mb-10 text-left">
          <h1 className="mb-4 max-w-3xl text-5xl font-serif font-medium leading-tight text-foreground md:text-6xl">
            Train continuous speech
          </h1>
          <p className="max-w-2xl text-base font-sans leading-relaxed text-muted-foreground md:text-lg">
            No Pause tracks speaking flow and hesitation patterns in real time to help you build automatic speech output.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          {heroCards.map((card) => (
            <InfoCard key={card.title} title={card.title} body={card.body} />
          ))}
        </div>

        <Section title="How Flow Works">
          <div className="mb-5 rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <p className="text-sm font-sans leading-relaxed text-foreground md:text-base">
              No Pause looks at how consistently you keep speech moving across repeated sessions. Continuous speaking,
              response recovery, speaking rhythm, and hesitation patterns over time all help you understand whether your
              answers are becoming more automatic.
            </p>
          </div>
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            {['Frequent stopping', 'smoother continuation', 'more automatic responses'].map((step, index) => (
              <div key={step} className="contents">
                <div className="rounded-[18px] border border-border bg-surface-card p-4 text-center text-sm font-sans font-bold text-foreground shadow-card">
                  {step}
                </div>
                {index < 2 && (
                  <span className="hidden text-center text-sm font-sans font-bold text-primary md:block" aria-hidden="true">
                    -&gt;
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mb-5 rounded-[20px] border border-primary/20 bg-primary/10 p-4 text-sm font-sans leading-relaxed text-foreground">
            Strong speakers are not pause-free. They recover faster and continue more naturally.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {flowSignals.map((signal) => (
              <InfoCard key={signal.title} title={signal.title} body={signal.body} />
            ))}
          </div>
          <FlowPreview />
        </Section>

        <Section title="Example Session">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
              <p className="mb-4 text-sm font-sans font-bold text-primary">Sample transcript</p>
              <p className="text-base font-sans leading-8 text-foreground">
                I think the best way to build confidence is to practice in small sessions{' '}
                <span className="rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-primary/75">long hesitation</span>{' '}
                because it makes speaking feel less risky. The difficult part is staying with the thought{' '}
                <span className="rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-primary/75">lost flow</span>{' '}
                and then finding the next sentence without starting over{' '}
                <span className="rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-primary/75">recovery pause</span>{' '}
                but the more you repeat it, the easier it becomes.
              </p>
            </article>
            <article className="rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
              <div className="space-y-3">
                {sampleResults.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-surface-elevated px-4 py-3">
                    <p className="text-xs font-sans font-bold text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-sans leading-relaxed text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoCard
              title="Behavioral insight"
              body="You kept the answer moving, but repeated pauses broke the flow in the middle."
            />
            <InfoCard
              title="Flow recovery"
              body="The answer improved when you continued the sentence instead of restarting from the beginning."
            />
            <InfoCard
              title="Continuity"
              body="The strongest part was the ending, where the idea connected again and the rhythm became steadier."
            />
          </div>
        </Section>

        <Section title="What Counts as a Hesitation?">
          <div className="grid gap-3 md:grid-cols-2">
            {hesitationCards.map((card) => (
              <ListCard key={card.title} title={card.title} items={card.items} />
            ))}
          </div>
        </Section>

        <Section title="Improvement Arc">
          <div className="grid gap-3 md:grid-cols-3">
            {improvementStages.map((stage) => (
              <InfoCard key={stage.title} title={stage.title} body={stage.body} />
            ))}
          </div>
        </Section>

        <ProgressOverTime />

        <Section title="What No Pause Is / Is Not">
          <div className="grid gap-3 md:grid-cols-2">
            {productBoundaries.map((card) => (
              <ListCard key={card.title} title={card.title} items={card.items} />
            ))}
          </div>
        </Section>

        <Section title="Practice Experience">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {practiceExperienceNotes.map((note) => (
              <div
                key={note}
                className="rounded-[20px] border border-border bg-surface-card p-4 text-sm font-sans font-bold leading-relaxed text-foreground shadow-card"
              >
                {note}
              </div>
            ))}
          </div>
        </Section>

        <Section title="FAQ">
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <FaqItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaq === faq.question}
                onToggle={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
              />
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
