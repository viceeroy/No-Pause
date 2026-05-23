import { useNavigate } from 'react-router-dom';
import { HELP_ARTICLES } from '@/features/help/helpContent';
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
        <header className="mb-8">
          <h1 className="text-3xl font-serif font-medium text-foreground">Help</h1>
          <p className="mt-2 text-base font-sans text-muted-foreground">
            Short guides for getting the most out of NoPause.
          </p>
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
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-elevated text-xl"
                aria-hidden="true"
              >
                {article.icon}
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
                <AccordionTrigger className="text-sm font-sans font-semibold text-foreground hover:no-underline py-4">
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
