import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
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
    body: 'Sessions improve when you keep ideas moving instead of waiting for perfect wording.',
  },
  {
    title: 'Long Pauses',
    body: 'Repeated long stops can break the listener rhythm and lower the quality of the session.',
  },
  {
    title: 'Speech Stability',
    body: 'A steadier rhythm helps No Pause give clearer feedback about your speaking habits.',
  },
];

const sampleResults = [
  ['Flow Score', 'Good flow with a weaker middle section'],
  ['Hesitation Pattern', 'Several pauses clustered around one idea'],
  ['Speaking Continuity', 'Strong opening and recovery, interrupted middle'],
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

const privacyNotes = [
  'Private practice by default',
  'Designed for personal speech training',
  'Installable app experience',
  'No public sharing by default',
];

const faqs = [
  {
    question: 'Does No Pause correct my English?',
    answer:
      'No Pause is focused on speaking continuity and hesitation patterns. It helps you notice where speech flow breaks down, not memorize grammar rules.',
  },
  {
    question: 'Why does my score change between sessions?',
    answer:
      'Your score can change when your rhythm, completion, pause pattern, topic comfort, or speaking consistency changes.',
  },
  {
    question: 'Do natural pauses count against me?',
    answer:
      'Natural pauses are part of normal speech. No Pause is more concerned with repeated stops that interrupt your flow or make the response hard to continue.',
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
  const pauseMarkerPositions = [22, 42, 63, 81].slice(0, pauseMarkerCount);

  const waveformPoints = useMemo(() => {
    const roughness = 24 - continuousSpeaking * 6 - speechStability * 5 + longPauses * 7;
    const base = 58;

    return Array.from({ length: 18 }, (_, index) => {
      const x = 4 + index * 5.4;
      const wave = Math.sin(index * 0.95) * roughness;
      const interruption = longPauses > 0 && index % (5 - longPauses) === 0 ? longPauses * 4 : 0;
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
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
                {pauseMarkerPositions.map((position) => (
                  <g key={position}>
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
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();

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
              No Pause looks at how consistently you keep speech moving. Continuous speaking improves flow, repeated long
              pauses reduce flow, stable rhythm improves feedback, and finishing a session gives you a clearer signal to
              compare over time.
            </p>
          </div>
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
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">long hesitation</span>{' '}
                because it makes speaking feel less risky. The difficult part is staying with the thought{' '}
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">lost flow</span>{' '}
                and then finding the next sentence without starting over{' '}
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">recovery pause</span>{' '}
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
          <p className="mt-4 rounded-[20px] border border-border bg-surface-elevated p-4 text-sm font-sans leading-relaxed text-foreground">
            You kept the answer moving, but repeated pauses broke the flow in the middle.
          </p>
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

        <Section title="What No Pause Is / Is Not">
          <div className="grid gap-3 md:grid-cols-2">
            {productBoundaries.map((card) => (
              <ListCard key={card.title} title={card.title} items={card.items} />
            ))}
          </div>
        </Section>

        <Section title="Privacy + Offline">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {privacyNotes.map((note) => (
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
              <article key={faq.question} className="rounded-[20px] border border-border bg-surface-card p-4 shadow-card md:p-5">
                <h3 className="mb-2 text-lg font-serif font-medium text-foreground">{faq.question}</h3>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground md:text-base">{faq.answer}</p>
              </article>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
