import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mic, TrendingUp, VolumeX, Zap, Flame, Send, Shield, Brain, RefreshCw, Target, Megaphone, type LucideIcon } from 'lucide-react';
import { HELP_ARTICLES } from '@/features/help/helpContent';

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
import { FAQ_ITEMS } from '@/features/help/faqContent';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>
        <header className="mb-6">
          <h1 className="text-3xl font-serif font-medium text-foreground">Help</h1>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {HELP_ARTICLES.map((article) => (
            <button
              key={article.slug}
              type="button"
              onClick={() => navigate(`/help/${article.slug}`)}
              className="flex min-h-[160px] flex-col justify-between rounded-[22px] border border-border bg-surface-card p-5 shadow-card cursor-pointer transition-colors btn-press hover:bg-surface-elevated text-left min-w-0"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-elevated"
                aria-hidden="true"
              >
                {(() => { const Icon = SLUG_ICONS[article.slug]; return Icon ? <Icon size={20} className="text-primary" /> : null; })()}
              </span>
              <div>
                <h2 className="text-base font-serif font-medium text-foreground break-words">
                  {article.title}
                </h2>
                <p className="mt-1 text-sm font-sans text-muted-foreground break-words">
                  {article.summary}
                </p>
              </div>
            </button>
          ))}
        </div>

        <hr className="my-10 border-border" />

        <section>
          <h2 className="text-xl font-serif font-medium text-foreground">Frequently Asked Questions</h2>
          <p className="mt-1 mb-6 text-sm font-sans text-muted-foreground">Quick answers to common questions.</p>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="rounded-[18px] border border-border bg-surface-card px-5 shadow-card"
              >
                <AccordionTrigger className="text-sm font-sans font-semibold text-foreground hover:no-underline py-4 text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm font-sans leading-relaxed text-muted-foreground pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </div>
  );
}
