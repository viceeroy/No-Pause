import { Activity, CircleUser, Coffee, Mic, Send, type LucideIcon } from 'lucide-react';

const infoCards: Array<{
  title: string;
  text: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Speak more',
    text: 'Build consistency with short daily speaking sessions.',
    icon: Mic,
  },
  {
    title: 'Reduce pauses',
    text: 'Try to keep speaking without long silent gaps.',
    icon: Activity,
  },
  {
    title: 'Use Telegram',
    text: 'Practice from Telegram with quick voice notes.',
    icon: Send,
  },
  {
    title: 'See stats via avatar',
    text: 'Tap your avatar to view progress and recent sessions.',
    icon: CircleUser,
  },
  {
    title: 'Everyday speaking',
    text: 'Practice real-life answers, not perfect speeches.',
    icon: Coffee,
  },
];

export function HelpSection() {
  return (
    <section aria-labelledby="next-steps-heading" className="mt-4 md:mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="next-steps-heading" className="text-[1.1rem] font-serif font-medium text-foreground md:text-[1.375rem]">
          Help
        </h2>
      </div>
      <div className="-mx-5 overflow-x-auto px-5 pb-2 scrollbar-hidden md:mx-0 md:px-0 md:overflow-visible">
        <div className="flex w-max gap-3 md:w-full">
          {infoCards.map(({ title, text, icon: Icon }) => (
            <article
              key={title}
              aria-labelledby={`next-step-${title.toLowerCase().replace(/\s+/g, '-')}`}
              className="min-h-[118px] w-[218px] shrink-0 rounded-[18px] border border-border bg-surface-card p-4 shadow-card md:w-auto md:min-w-0 md:flex-1"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-primary">
                <Icon size={18} aria-hidden="true" />
              </div>
              <h3
                id={`next-step-${title.toLowerCase().replace(/\s+/g, '-')}`}
                className="mb-1 text-sm md:text-base font-serif font-medium leading-tight text-foreground"
              >
                {title}
              </h3>
              <p className="text-xs md:text-sm font-sans leading-snug text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
