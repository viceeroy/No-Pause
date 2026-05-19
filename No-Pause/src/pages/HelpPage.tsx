import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  CircleHelp,
  Flame,
  MessageCircle,
  Mic,
  Play,
  ShieldCheck,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type IconCard = {
  label: string;
  icon: LucideIcon;
};

type StepCard = {
  label: string;
  body: string;
  icon: LucideIcon;
};

type ScoreRange = {
  range: string;
  meaning: string;
  width: string;
  colorClassName: string;
};

type MetricRow = {
  name: string;
  value: string;
  body: string;
};

type TimelineStage = {
  label: string;
  title: string;
  body: string;
};

type ImproveTip = {
  lead: string;
  before: string;
  after: string;
  body: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type MobileSection = {
  title: string;
  eyebrow?: string;
  content: ReactNode;
};

const introCards: IconCard[] = [
  { label: 'Speak freely', icon: Mic },
  { label: 'Get a Flow Score', icon: BarChart3 },
  { label: 'Improve over time', icon: TrendingUp },
];

const sessionSteps: StepCard[] = [
  {
    label: 'Start Speaking',
    body: 'Tap the practice button and begin with whatever thought is easiest to say first. You do not need a perfect opening.',
    icon: Play,
  },
  {
    label: 'Speak freely',
    body: 'Talk in your own words for a short session. No Pause is listening for flow, not judging your ideas.',
    icon: MessageCircle,
  },
  {
    label: 'See your results',
    body: 'Review your Flow Score, speaking time, pauses, and transcript. The results show what happened in plain language.',
    icon: BarChart3,
  },
  {
    label: 'Come back tomorrow',
    body: 'Repeat the loop often enough that speaking starts to feel familiar. Small daily reps are the point.',
    icon: CalendarCheck,
  },
];

const scoreRanges: ScoreRange[] = [
  {
    range: '0-60',
    meaning: 'Common starting point',
    width: '28%',
    colorClassName: 'bg-red-400/55',
  },
  {
    range: '60-140',
    meaning: 'Getting comfortable',
    width: '48%',
    colorClassName: 'bg-amber-300/65',
  },
  {
    range: '140-220',
    meaning: 'Solid fluency',
    width: '72%',
    colorClassName: 'bg-emerald-400/70',
  },
  {
    range: '220+',
    meaning: 'Strong session',
    width: '92%',
    colorClassName: 'bg-teal-300/80',
  },
];

const metricRows: MetricRow[] = [
  {
    name: 'Flow Score',
    value: '156',
    body: 'A quick signal for how smoothly the session moved. Higher usually means you kept speaking with fewer long stops.',
  },
  {
    name: 'Speaking time',
    value: '2 min 14 sec',
    body: 'How much of the session contained your voice. More active speaking gives you more useful practice to review.',
  },
  {
    name: 'Silence time',
    value: '0 min 22 sec',
    body: 'The quiet space between your words. Some silence is normal, but long quiet stretches can interrupt your flow.',
  },
  {
    name: 'Pause count',
    value: '3',
    body: 'How often the session had longer breaks. Use this to spot where your thought process is getting stuck.',
  },
];

const progressStages: TimelineStage[] = [
  {
    label: 'Stage 1',
    title: 'First few sessions',
    body: 'Scores may feel low, and that adjustment is normal. You are learning how it feels to speak while being recorded.',
  },
  {
    label: 'Stage 2',
    title: 'Sessions 5-10',
    body: 'Scores often start rising naturally as the loop becomes familiar. You spend less energy starting and more energy speaking.',
  },
  {
    label: 'Stage 3',
    title: '2-3 weeks in',
    body: 'Patterns become visible, and transcripts usually get cleaner. You can see whether your baseline is moving up.',
  },
];

const improveTips: ImproveTip[] = [
  {
    lead: 'Start with the simplest true sentence.',
    before: 'I think maybe I should start by explaining everything...',
    after: 'I think the best answer is to start small.',
    body: 'A clear first sentence gives your brain momentum. You can add nuance after the sentence is already moving.',
  },
  {
    lead: 'Use one example before you explain everything.',
    before: 'The reason is complicated because there are many factors...',
    after: 'For example, in a team meeting, one clear point is easier to follow.',
    body: 'Examples reduce pressure because they make the idea concrete. They also keep you speaking instead of searching for an abstract answer.',
  },
  {
    lead: 'Finish the thought before judging it.',
    before: 'This is not coming out right... let me restart.',
    after: 'This is not the perfect wording, but the main point is clear.',
    body: 'Stopping too early can create more hesitation than the imperfect sentence itself. Practice recovering while speaking.',
  },
];

const pauseExplanationCards = [
  {
    label: 'Quiet gaps',
    body: 'NoPause watches for longer quiet breaks between words, not every tiny breath or normal comma-length pause.',
  },
  {
    label: 'Momentum',
    body: 'Long pauses can break your rhythm and make the next sentence harder to start.',
  },
  {
    label: 'Progress',
    body: 'Aim for fewer long stops over several sessions instead of trying to force a perfect single score.',
  },
];

const privacyCollect = ['Transcript', 'Score', 'Speaking time', 'Session metadata'];
const privacyDont = ['Raw audio after transcription', 'Anything outside recording', 'Third-party sharing'];

const faqItems: FaqItem[] = [
  {
    question: "What's a good Flow Score when I am starting out?",
    answer:
      'A good starting score is one you can repeat and improve from. Many people start lower than they expect because recorded speaking feels different from casual conversation. Look for a rising trend across sessions instead of treating one number as your identity.',
  },
  {
    question: 'Why did my score drop even though I felt like I spoke better?',
    answer:
      'That can happen because one session may include longer thinking gaps, a harder topic, or a slower speaking rhythm. Feeling better still matters because confidence often improves before the number catches up. Compare several sessions before deciding whether something is really going backward.',
  },
  {
    question: 'Does No Pause grade my grammar or pronunciation?',
    answer:
      'No Pause is focused on speaking flow, pauses, and consistency. It is not trying to be a grammar judge or pronunciation exam. The goal is to help you speak more steadily, not make you feel corrected after every sentence.',
  },
  {
    question: 'Is No Pause useful for non-native English speakers?',
    answer:
      'Yes, especially if you want more practice forming thoughts out loud in English. It can help you notice where you pause, restart, or lose momentum. You do not need perfect English to benefit from building a steadier speaking habit.',
  },
  {
    question: 'How long should my sessions be?',
    answer:
      'Short sessions are enough when you do them consistently. A few focused minutes gives you a transcript, a score, and one thing to improve next time. Longer sessions are useful later, but daily repetition matters more than one big recording.',
  },
  {
    question: 'Can I use No Pause offline?',
    answer:
      'No Pause needs a connection to process a session and save your results. You can still treat it like a quick practice app when you are online. If you want reliable history and streak tracking, finish sessions while connected.',
  },
  {
    question: "Why isn't my streak updating?",
    answer:
      'A streak usually updates after a completed session is saved to your account. If you stop before the session finishes processing, the day may not count yet. Check that you are signed in, connected, and viewing the latest saved history.',
  },
];

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-border bg-surface-card p-5 shadow-card md:p-7">
      <div className="mb-5">
        {eyebrow && (
          <p className="mb-2 text-xs font-sans font-black uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-serif font-medium leading-tight text-foreground md:text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function IconLabelCards({ cards }: { cards: IconCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map(({ label, icon: Icon }) => (
        <div key={label} className="rounded-[18px] border border-border bg-surface-elevated p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Icon size={19} aria-hidden="true" />
          </div>
          <p className="text-sm font-sans font-black text-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function SessionFlow() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-4">
        {sessionSteps.map(({ label, body, icon: Icon }, index) => (
          <article key={label} className="relative rounded-[18px] border border-border bg-surface-elevated p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Icon size={19} aria-hidden="true" />
              </span>
              {index < sessionSteps.length - 1 && (
                <ArrowRight className="hidden text-muted-foreground lg:block" size={18} aria-hidden="true" />
              )}
            </div>
            <h3 className="mb-2 text-base font-sans font-black text-foreground">{label}</h3>
            <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
          </article>
        ))}
      </div>
      <div className="rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-sans font-black text-primary">
        The whole loop takes 2-5 minutes.
      </div>
    </div>
  );
}

function ScoreTable() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      <div className="grid grid-cols-[82px_1fr_1.25fr] gap-3 bg-surface-card px-4 py-3 text-xs font-sans font-black uppercase tracking-[0.12em] text-muted-foreground">
        <span>Range</span>
        <span>Strength</span>
        <span>Meaning</span>
      </div>
      {scoreRanges.map(({ range, meaning, width, colorClassName }) => (
        <div key={range} className="grid grid-cols-[82px_1fr_1.25fr] items-center gap-3 border-t border-border px-4 py-4">
          <span className="text-sm font-sans font-black text-foreground">{range}</span>
          <div className="h-3 overflow-hidden rounded-full bg-surface-card">
            <div className={`h-full rounded-full ${colorClassName}`} style={{ width }} />
          </div>
          <span className="text-sm font-sans leading-snug text-muted-foreground">{meaning}</span>
        </div>
      ))}
    </div>
  );
}

function MetricRows() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      {metricRows.map(({ name, value, body }) => (
        <div key={name} className="grid gap-3 p-4 md:grid-cols-[160px_132px_1fr] md:items-center">
          <p className="text-sm font-sans font-black text-foreground">{name}</p>
          <span className="inline-flex w-fit items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-sans font-black text-primary">
            {value}
          </span>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}

function ProgressTimeline() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {progressStages.map(({ label, title, body }, index) => (
        <article key={title} className="rounded-[18px] border border-border bg-surface-elevated p-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-sans font-black text-primary-foreground">
              {index + 1}
            </span>
            <span className="text-xs font-sans font-black uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
          </div>
          <h3 className="mb-2 text-base font-sans font-black text-foreground">{title}</h3>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </article>
      ))}
    </div>
  );
}

function QuoteExample({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-2 rounded-[16px] border border-border bg-surface-elevated p-3 text-sm font-sans">
      <p className="rounded-xl bg-surface-card px-3 py-2 leading-relaxed text-muted-foreground">
        <span className="font-black text-foreground">Before:</span> {before}
      </p>
      <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 leading-relaxed text-foreground">
        <span className="font-black text-primary">After:</span> {after}
      </p>
    </div>
  );
}

function ImproveTips() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {improveTips.map(({ lead, before, after, body }) => (
        <article key={lead} className="rounded-[18px] border border-border bg-surface-elevated p-4">
          <h3 className="mb-3 text-base font-sans font-black text-foreground">{lead}</h3>
          <QuoteExample before={before} after={after} />
          <p className="mt-3 text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </article>
      ))}
    </div>
  );
}

function PauseExplanationCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {pauseExplanationCards.map(({ label, body }) => (
        <article key={label} className="rounded-[18px] border border-border bg-surface-elevated p-4">
          <h3 className="mb-2 text-base font-sans font-black text-foreground">{label}</h3>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </article>
      ))}
    </div>
  );
}

function PracticeModes() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article className="rounded-[20px] border border-primary/45 bg-primary/10 p-5 night-glow">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-serif font-medium text-foreground">Free Speaking</h3>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-sans font-black text-primary-foreground">
            Primary
          </span>
        </div>
        <p className="text-sm font-sans leading-relaxed text-muted-foreground">
          Speak about anything without waiting for the perfect topic. Use this when you want the fastest path into a real session.
        </p>
      </article>
      <article className="rounded-[20px] border border-border bg-surface-elevated p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-serif font-medium text-foreground">Topic Prompts</h3>
          <span className="rounded-full border border-border bg-surface-card px-3 py-1 text-xs font-sans font-black text-muted-foreground">
            Optional
          </span>
        </div>
        <p className="text-sm font-sans leading-relaxed text-muted-foreground">
          Pick a topic when starting from a blank page slows you down. Use prompts to reduce setup time and practice answering clearly.
        </p>
      </article>
    </div>
  );
}

function StreakDots() {
  return (
    <div className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, index) => {
          const filled = index < 5;
          return (
            <div key={index} className="flex flex-col items-center gap-2">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-sans font-black ${
                  filled
                    ? 'border-primary/45 bg-primary text-primary-foreground'
                    : 'border-border bg-surface-card text-muted-foreground'
                }`}
              >
                {index + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistColumn({ title, items, icon: Icon }: { title: string; items: string[]; icon: LucideIcon }) {
  return (
    <article className="rounded-[18px] border border-border bg-surface-elevated p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <h3 className="text-base font-sans font-black text-foreground">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm font-sans text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function MiniFlow({ steps }: { steps: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => (
        <article key={step} className="rounded-[18px] border border-border bg-surface-elevated p-4">
          <p className="mb-3 text-xs font-sans font-black uppercase tracking-[0.14em] text-primary">
            Step {index + 1}
          </p>
          <p className="text-sm font-sans font-black text-foreground">{step}</p>
        </article>
      ))}
    </div>
  );
}

function FaqList() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[18px] border border-border bg-surface-elevated">
      {faqItems.map(({ question, answer }) => (
        <article key={question} className="p-4 md:p-5">
          <h3 className="mb-2 text-base font-sans font-black text-foreground">{question}</h3>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground md:text-base">{answer}</p>
        </article>
      ))}
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsMobile(query.matches);

    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

function MobileScoreRanges() {
  return (
    <div className="space-y-2">
      {scoreRanges.map(({ range, meaning, colorClassName }) => (
        <div key={range} className="flex items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorClassName}`} />
          <span className="shrink-0 text-sm font-sans font-black text-foreground">{range}</span>
          <span className="min-w-0 text-sm font-sans text-muted-foreground">{meaning}</span>
        </div>
      ))}
    </div>
  );
}

function MobileMetricRows() {
  return (
    <div className="space-y-2">
      {metricRows.map(({ name, value, body }) => (
        <div key={name} className="rounded-xl bg-surface-elevated p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-sans font-black text-foreground">{name}</span>
            <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-sans font-black text-primary">
              {value}
            </span>
          </div>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}

function MobileProgressTimeline() {
  return (
    <div className="space-y-3">
      {progressStages.map(({ title, body }, index) => (
        <div key={title} className="flex gap-3 rounded-xl bg-surface-elevated p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-sans font-black text-primary-foreground">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-sans font-black text-foreground">{title}</p>
            <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileImproveTips() {
  return (
    <div className="space-y-3">
      {improveTips.map(({ lead, before, after, body }) => (
        <div key={lead} className="rounded-xl bg-surface-elevated p-3">
          <p className="mb-2 text-sm font-sans font-black text-foreground">{lead}</p>
          <div className="mb-2 space-y-1 border-l border-primary/35 pl-3 text-sm font-sans leading-relaxed">
            <p className="text-muted-foreground">Before: {before}</p>
            <p className="text-foreground">After: {after}</p>
          </div>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}

function MobilePauseExplanationCards() {
  return (
    <div className="space-y-2">
      {pauseExplanationCards.map(({ label, body }) => (
        <div key={label} className="rounded-xl bg-surface-elevated p-3">
          <p className="text-sm font-sans font-black text-foreground">{label}</p>
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}

function MobilePracticeModes() {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-primary/35 bg-primary/10 p-3">
        <p className="text-sm font-sans font-black text-foreground">Free Speaking</p>
        <p className="text-sm font-sans leading-relaxed text-muted-foreground">
          Primary mode for talking about anything and starting fast.
        </p>
      </div>
      <div className="rounded-xl bg-surface-elevated p-3">
        <p className="text-sm font-sans font-black text-foreground">Topic Prompts</p>
        <p className="text-sm font-sans leading-relaxed text-muted-foreground">
          Optional mode for when a starting idea helps you speak sooner.
        </p>
      </div>
    </div>
  );
}

function MobileStreakDots() {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 7 }, (_, index) => {
        const filled = index < 5;
        return (
          <span
            key={index}
            className={`h-4 w-4 rounded-full border ${
              filled ? 'border-primary bg-primary' : 'border-border bg-surface-elevated'
            }`}
          />
        );
      })}
    </div>
  );
}

function MobileBulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-sans font-black text-foreground">{title}</p>
      <ul className="space-y-1 pl-4 text-sm font-sans leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileFaqRows() {
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({});

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-surface-elevated">
      {faqItems.map(({ question, answer }, index) => {
        const isOpen = openFaq[index] ?? false;

        return (
          <div key={question}>
            <button
              type="button"
              onClick={() => setOpenFaq((current) => ({ ...current, [index]: !isOpen }))}
              className="flex w-full items-center justify-between gap-3 p-3 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-sans font-black text-foreground">{question}</span>
              <ChevronLeft
                size={15}
                aria-hidden="true"
                className={`shrink-0 text-primary transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`}
              />
            </button>
            {isOpen && <p className="px-3 pb-3 text-sm font-sans leading-relaxed text-muted-foreground">{answer}</p>}
          </div>
        );
      })}
    </div>
  );
}

function MobileSectionRow({
  section,
  index,
  isOpen,
  onToggle,
}: {
  section: MobileSection;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[18px] border border-border bg-surface-card shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          {section.eyebrow && (
            <span className="mb-0.5 block text-xs font-sans font-black uppercase tracking-[0.14em] text-primary">
              {section.eyebrow}
            </span>
          )}
          <span className="block text-base font-sans font-black leading-tight text-foreground">
            {index + 1}. {section.title}
          </span>
        </span>
        <ChevronLeft
          size={17}
          aria-hidden="true"
          className={`shrink-0 text-primary transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`}
        />
      </button>
      {isOpen && <div className="border-t border-border p-3">{section.content}</div>}
    </article>
  );
}

function HelpMobile() {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const mobileSections: MobileSection[] = [
    {
      title: 'What No Pause Is',
      content: (
        <div className="space-y-3 text-sm font-sans leading-relaxed text-muted-foreground">
          <p>No Pause is a simple practice loop for speaking out loud.</p>
          <p>You record a short session, get a Flow Score, and see where your speech felt smooth or interrupted.</p>
          <p>It is not a grammar grade and it is not a judgment; it is a friendly way to build steadier speaking over time.</p>
          <div className="grid gap-2">
            {introCards.map(({ label }) => (
              <div key={label} className="rounded-xl bg-surface-elevated px-3 py-2 text-sm font-sans font-black text-foreground">
                {label}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'How a Session Works',
      content: (
        <div className="space-y-3">
          {sessionSteps.map(({ label, body }, index) => (
            <div key={label} className="flex gap-3 rounded-xl bg-surface-elevated p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-sans font-black text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-sans font-black text-foreground">{label}</p>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-sans font-black text-primary">
            The whole loop takes 2-5 minutes.
          </p>
        </div>
      ),
    },
    {
      title: 'Understanding Your Flow Score',
      content: (
        <div className="space-y-3">
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">
            Flow Score is a simple signal for how smoothly your session moved. Higher usually means you spent more of the session speaking and less of it stuck in long stops.
          </p>
          <MobileScoreRanges />
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-sans font-black text-primary">
            Don't optimize the number. Optimize the habit.
          </p>
        </div>
      ),
    },
    {
      title: 'What Your Results Mean',
      content: (
        <div className="space-y-3">
          <MobileMetricRows />
          <p className="text-sm font-sans italic leading-relaxed text-muted-foreground">
            One session won't tell you much. Ten sessions will tell you a lot.
          </p>
        </div>
      ),
    },
    {
      title: 'What Good Progress Looks Like',
      content: (
        <div className="space-y-3">
          <MobileProgressTimeline />
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-sans font-black text-primary">
            You don't need a high score. You need a rising trend.
          </p>
        </div>
      ),
    },
    {
      title: 'How to Improve Your Flow Score',
      content: <MobileImproveTips />,
    },
    {
      title: 'Pauses Explained',
      content: (
        <div className="space-y-3">
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">
            A pause is a quiet break in your flow. Longer quiet gaps can interrupt momentum and make ideas harder to follow.
          </p>
          <MobilePauseExplanationCards />
          <p className="text-sm font-sans font-black text-primary">Use shorter pauses to keep your thoughts moving.</p>
        </div>
      ),
    },
    {
      title: 'Practice Modes',
      content: <MobilePracticeModes />,
    },
    {
      title: 'Streaks & Habit Building',
      content: (
        <div className="space-y-3 text-sm font-sans leading-relaxed text-muted-foreground">
          <MobileStreakDots />
          <p>Consistency beats session length.</p>
          <p className="font-black text-foreground">One session a day. That's the whole habit.</p>
          <p className="font-black text-primary">3 min daily for 7 days &gt; 20 min once a week.</p>
        </div>
      ),
    },
    {
      title: 'Privacy',
      content: (
        <div className="space-y-3">
          <MobileBulletList title="What we collect" items={privacyCollect} />
          <MobileBulletList title="What we don't" items={privacyDont} />
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">
            You choose when recording starts and ends.
          </p>
        </div>
      ),
    },
    {
      title: 'Telegram Practice',
      content: (
        <div className="space-y-2 text-sm font-sans leading-relaxed text-muted-foreground">
          <p className="text-xs font-sans font-black uppercase tracking-[0.14em] text-primary">Optional</p>
          <p><span className="font-black text-foreground">Link account.</span> Connect Telegram to No Pause once.</p>
          <p><span className="font-black text-foreground">Send voice note.</span> Practice from Telegram when it is convenient.</p>
          <p><span className="font-black text-foreground">Review history.</span> Results appear with your NoPause sessions.</p>
        </div>
      ),
    },
    {
      title: 'Challenges',
      content: (
        <div className="space-y-2 text-sm font-sans leading-relaxed text-muted-foreground">
          <p className="text-xs font-sans font-black uppercase tracking-[0.14em] text-primary">Optional</p>
          <p>Friend challenges let two people answer the same prompt.</p>
          <p>Group challenges add a shared prompt and leaderboard.</p>
          <p>They help with accountability and make practice easier to repeat.</p>
        </div>
      ),
    },
    {
      title: 'Common Questions',
      content: <MobileFaqRows />,
    },
    {
      title: 'Ready to practice?',
      content: (
        <div className="space-y-3">
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">
            Start with one short session and give yourself something real to improve tomorrow.
          </p>
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-sans font-black text-primary-foreground btn-press"
          >
            Start Speaking
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-surface-base px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5">
      <main className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="-ml-2 mb-5 inline-flex min-h-10 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>

        <header className="mb-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-card px-3 py-1.5 text-xs font-sans font-black uppercase tracking-[0.14em] text-primary">
            <CircleHelp size={14} aria-hidden="true" />
            Help
          </div>
          <h1 className="text-3xl font-serif font-medium leading-tight text-foreground">
            Build smoother speaking flow.
          </h1>
        </header>

        <div className="space-y-3">
          {mobileSections.map((section, index) => {
            const isOpen = openSections[index] ?? false;

            return (
              <MobileSectionRow
                key={section.title}
                section={section}
                index={index}
                isOpen={isOpen}
                onToggle={() => setOpenSections((current) => ({ ...current, [index]: !isOpen }))}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}

function HelpDesktop() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-base px-5 pb-24 pt-6 md:px-12 md:pt-8 lg:px-20">
      <main className="mx-auto w-full max-w-6xl">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="-ml-2 mb-8 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>

        <header className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-card px-3 py-1.5 text-xs font-sans font-black uppercase tracking-[0.14em] text-primary">
            <CircleHelp size={14} aria-hidden="true" />
            Help
          </div>
          <h1 className="max-w-3xl text-4xl font-serif font-medium leading-tight text-foreground md:text-6xl">
            Learn how to build smoother speaking flow.
          </h1>
        </header>

        <div className="space-y-5 md:space-y-6">
          <Section title="What No Pause Is">
            <div className="mb-5 max-w-3xl space-y-3 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              <p>No Pause is a simple practice loop for speaking out loud.</p>
              <p>You record a short session, get a Flow Score, and see where your speech felt smooth or interrupted.</p>
              <p>It is not a grammar grade and it is not a judgment; it is a friendly way to build steadier speaking over time.</p>
            </div>
            <IconLabelCards cards={introCards} />
          </Section>

          <Section title="How a Session Works">
            <SessionFlow />
          </Section>

          <Section title="Understanding Your Flow Score">
            <div className="mb-5 max-w-3xl space-y-3 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              <p>Flow Score is a simple signal for how smoothly your session moved.</p>
              <p>Higher usually means you spent more of the session speaking and less of it stuck in long stops.</p>
            </div>
            <ScoreTable />
            <div className="mt-4 rounded-[18px] border border-primary/25 bg-primary/10 p-4">
              <p className="text-base font-sans font-black text-primary">
                Don't optimize the number. Optimize the habit.
              </p>
            </div>
          </Section>

          <Section title="What Your Results Mean">
            <MetricRows />
            <p className="mt-4 text-sm font-sans italic leading-relaxed text-muted-foreground md:text-base">
              One session won't tell you much. Ten sessions will tell you a lot.
            </p>
          </Section>

          <Section title="What Good Progress Looks Like">
            <ProgressTimeline />
            <div className="mt-4 rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3">
              <p className="text-sm font-sans font-black text-primary md:text-base">
                You don't need a high score. You need a rising trend.
              </p>
            </div>
          </Section>

          <Section title="How to Improve Your Flow Score">
            <ImproveTips />
          </Section>

          <Section title="Pauses Explained">
            <div className="mb-5 space-y-4">
              <p className="max-w-3xl text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
                Pauses are quiet breaks in your flow. They are normal, but long pauses can interrupt momentum and make ideas harder to follow.
              </p>
            </div>
            <PauseExplanationCards />
            <div className="mt-4 rounded-[18px] border border-border bg-surface-elevated p-4">
              <p className="text-base font-sans font-black text-primary">
                Use shorter pauses to keep your thoughts moving.
              </p>
            </div>
          </Section>

          <Section title="Practice Modes">
            <PracticeModes />
          </Section>

          <Section title="Streaks & Habit Building">
            <div className="grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-center">
              <StreakDots />
              <div className="space-y-3 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
                <p>Consistency beats session length because the habit gets easier every time you return.</p>
                <p className="font-black text-foreground">One session a day. That's the whole habit.</p>
                <p className="rounded-[18px] border border-primary/20 bg-primary/10 px-4 py-3 font-black text-primary">
                  3 min daily for 7 days &gt; 20 min once a week.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Privacy">
            <div className="grid gap-3 md:grid-cols-2">
              <ChecklistColumn title="What we collect" items={privacyCollect} icon={ShieldCheck} />
              <ChecklistColumn title="What we don't" items={privacyDont} icon={ShieldCheck} />
            </div>
            <p className="mt-4 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              You choose when recording starts and ends. The goal is to keep your practice history useful without making the product feel invasive.
            </p>
          </Section>

          <Section eyebrow="Optional" title="Telegram Practice">
            <MiniFlow steps={['Link account', 'Send voice note in Telegram', 'Results appear in NoPause history']} />
            <p className="mt-4 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              Telegram practice is useful when you want to send a quick voice note and review it with the rest of your No Pause sessions later.
            </p>
          </Section>

          <Section eyebrow="Optional" title="Challenges">
            <div className="grid gap-3 md:grid-cols-2">
              <article className="rounded-[18px] border border-border bg-surface-elevated p-4">
                <Trophy className="mb-3 text-primary" size={22} aria-hidden="true" />
                <h3 className="mb-2 text-base font-sans font-black text-foreground">Friend challenges</h3>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">
                  Invite a friend to answer the same prompt and compare how each session went.
                </p>
              </article>
              <article className="rounded-[18px] border border-border bg-surface-elevated p-4">
                <Flame className="mb-3 text-primary" size={22} aria-hidden="true" />
                <h3 className="mb-2 text-base font-sans font-black text-foreground">Group challenges</h3>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">
                  Practice around a shared prompt and use the leaderboard for accountability.
                </p>
              </article>
            </div>
            <p className="mt-4 text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              Challenges help because accountability, a shared prompt, and a leaderboard make practice easier to repeat.
            </p>
          </Section>

          <Section title="Common Questions">
            <FaqList />
          </Section>

          <section className="rounded-[24px] border border-primary/25 bg-primary/10 p-6 shadow-card md:p-8">
            <h2 className="mb-3 text-3xl font-serif font-medium text-foreground md:text-4xl">Ready to practice?</h2>
            <p className="mb-5 max-w-2xl text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              Start with one short session and give yourself something real to improve tomorrow.
            </p>
            <button
              type="button"
              onClick={() => navigate('/practice')}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-sans font-black text-primary-foreground shadow-card transition-colors btn-press hover:bg-accent"
            >
              Start Speaking
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function HelpPage() {
  const isMobile = useIsMobile();

  return isMobile ? <HelpMobile /> : <HelpDesktop />;
}
