import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Mic, TrendingUp, VolumeX, Zap, Flame, Send, Shield, Brain, RefreshCw, Target, Megaphone, ExternalLink, type LucideIcon } from 'lucide-react';
import {
  getArticleBySlug,
  type HelpSection,
  type ScoreExampleCard,
  type ReferenceLink,
} from './helpContent';

const SLUG_ICONS: Record<string, LucideIcon> = {
  'what-is-nopause': Megaphone,
  'how-a-session-works': Mic,
  'understanding-flow-score': TrendingUp,
  'what-counts-as-a-pause': VolumeX,
  'how-to-improve': Zap,
  'streaks-and-progress': Flame,
  'telegram-practice': Send,
  'privacy-and-data': Shield,
  'why-speaking-feels-hard': Brain,
  'why-practice-works': RefreshCw,
  'before-your-interview-or-presentation': Target,
};

function TextSection({ content }: { content: string }) {
  return (
    <p className="text-base font-sans leading-relaxed text-foreground break-words">{content}</p>
  );
}

function CalloutSection({ content }: { content: { label: string; value: string }[] }) {
  return (
    <div className="rounded-[22px] border border-border bg-surface-card p-5 shadow-card">
      <div className="grid grid-cols-2 gap-3">
        {content.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-xs font-sans font-semibold uppercase tracking-[0.14em] text-muted-foreground break-words">
              {item.label}
            </p>
            <p className="mt-1 text-sm font-sans font-semibold text-foreground break-words">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreExampleSection({ content }: { content: ScoreExampleCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {content.map((card) => (
        <div
          key={card.label}
          className="rounded-[22px] border border-border bg-surface-card p-5 shadow-card min-w-0"
        >
          <p className="text-sm font-sans font-medium text-muted-foreground break-words">
            {card.label}
          </p>
          <p className="mt-3 font-serif text-4xl font-medium leading-none text-primary">
            {card.flowScore}
          </p>
          <p className="mt-1 text-xs font-sans font-black uppercase tracking-[0.14em] text-muted-foreground">
            Flow Score
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-xs font-sans font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Speaking
              </p>
              <p className="mt-1 text-sm font-serif font-medium text-foreground">
                {card.speakingTime}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-sans font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Silence
              </p>
              <p className="mt-1 text-sm font-serif font-medium text-foreground">
                {card.silenceSec}s
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PauseVisualSection({ content }: { content: { caption?: string } }) {
  const segments: { kind: 'speech' | 'silence'; weight: number }[] = [
    { kind: 'speech', weight: 6 },
    { kind: 'silence', weight: 1 },
    { kind: 'speech', weight: 4 },
    { kind: 'silence', weight: 1 },
    { kind: 'speech', weight: 8 },
    { kind: 'silence', weight: 4 },
    { kind: 'speech', weight: 5 },
    { kind: 'silence', weight: 1 },
    { kind: 'speech', weight: 7 },
  ];
  const total = segments.reduce((sum, s) => sum + s.weight, 0);

  return (
    <div className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card">
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {segments.map((segment, idx) => (
          <div
            key={idx}
            className={
              segment.kind === 'speech'
                ? 'bg-primary'
                : 'bg-surface-elevated border-y border-primary/20'
            }
            style={{ width: `${(segment.weight / total) * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs font-sans text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-primary" aria-hidden="true" />
          Speech
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm bg-surface-elevated border border-primary/20"
            aria-hidden="true"
          />
          Silence
        </span>
      </div>
      {content.caption && (
        <p className="mt-3 text-sm font-sans text-muted-foreground break-words">
          {content.caption}
        </p>
      )}
    </div>
  );
}

function TipSection({ content }: { content: string }) {
  return (
    <div className="border-l-4 border-primary pl-4 py-2 text-sm font-sans text-foreground break-words">
      <span className="mr-1" aria-hidden="true">💡</span>
      {content}
    </div>
  );
}

function ReferencesSection({ content }: { content: ReferenceLink[] }) {
  return (
    <div className="rounded-[22px] border border-border bg-surface-card p-5 shadow-card">
      <p className="text-xs font-sans font-black uppercase tracking-[0.14em] text-muted-foreground">
        Sources
      </p>
      <ul className="mt-3 space-y-3">
        {content.map((ref) => (
          <li key={ref.url}>
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-start gap-2 text-sm font-sans text-primary underline underline-offset-4 break-words hover:text-foreground transition-colors"
            >
              <ExternalLink
                size={14}
                className="mt-0.5 shrink-0 opacity-70 group-hover:opacity-100"
                aria-hidden="true"
              />
              <span className="break-words">{ref.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderSection(section: HelpSection, index: number) {
  switch (section.type) {
    case 'text':
      return <TextSection key={index} content={section.content} />;
    case 'callout':
      return <CalloutSection key={index} content={section.content} />;
    case 'score-example':
      return <ScoreExampleSection key={index} content={section.content} />;
    case 'pause-visual':
      return <PauseVisualSection key={index} content={section.content} />;
    case 'tip':
      return <TipSection key={index} content={section.content} />;
    case 'references':
      return <ReferencesSection key={index} content={section.content} />;
    default:
      return null;
  }
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const article = slug ? getArticleBySlug(slug) : undefined;

  if (!article) {
    return <Navigate to="/help" replace />;
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground"
          aria-label="Back to Help"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Back to Help
        </button>

        <header className="mt-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-elevated"
            aria-hidden="true"
          >
            {(() => { const Icon = SLUG_ICONS[article.slug]; return Icon ? <Icon size={28} className="text-primary" /> : null; })()}
          </span>
          <h1 className="mt-4 text-3xl font-serif font-medium text-foreground break-words">
            {article.title}
          </h1>
          <p className="mt-3 text-base font-sans text-muted-foreground break-words">
            {article.summary}
          </p>
        </header>

        <hr className="my-6 border-border" />

        <article className="space-y-6">
          {article.sections.map((section, index) => renderSection(section, index))}
        </article>
      </div>
    </div>
  );
}
