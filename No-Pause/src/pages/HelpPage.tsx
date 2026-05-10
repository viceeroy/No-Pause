import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type HelpArticle = {
  title: string;
  description: string;
  body: string;
};

const helpArticles: HelpArticle[] = [
  {
    title: 'What NoPause is',
    description: 'A speaking practice app that scores your flow from real speech.',
    body:
      'NoPause helps you practice speaking out loud, then shows a Flow Score, pause count, speaking time, and feedback so you can see how smoothly you spoke.',
  },
  {
    title: 'How Flow Score is calculated',
    description: 'Your score rewards speaking time and penalizes pause units.',
    body:
      'Flow Score is based on how long you keep speaking, with bonus points for completed minutes and penalties for pauses. Very short sessions are not treated as complete scored practice.',
  },
  {
    title: 'How pauses are detected',
    description: 'NoPause watches for silence gaps while you speak.',
    body:
      'During recording, NoPause analyzes microphone activity and counts meaningful silent gaps as pause units. One long gap can count more than once because it interrupts the flow for longer.',
  },
  {
    title: 'What filler words are',
    description: 'Words like um, uh, and like can signal hesitation.',
    body:
      'Filler words are common hesitation words that can make speech sound less direct. NoPause highlights them so you can notice patterns and replace them with cleaner transitions.',
  },
  {
    title: 'How streaks work',
    description: 'Streaks track consistent practice across days.',
    body:
      'A streak grows when you complete scored practice on consecutive days. The stats page shows your current streak and best streak so you can track consistency over time.',
  },
  {
    title: 'How challenges work',
    description: 'Challenges let people speak on the same prompt and compare scores.',
    body:
      'NoPause challenges are built around a shared speaking prompt. Participants record their attempts, receive a Flow Score, and can compare results on the challenge leaderboard.',
  },
  {
    title: 'How the Telegram bot works',
    description: 'Send a voice note in Telegram and get a NoPause result.',
    body:
      'The Telegram bot connects your account to NoPause. After connecting, you can send voice notes, request prompts, check stats, and join challenges without opening the web app.',
  },
  {
    title: 'Tips for improving your Flow Score',
    description: 'Speak in complete thoughts and reduce long silent gaps.',
    body:
      'Start with short sessions, keep talking through imperfect wording, and use prompts to avoid overthinking. Aim for steady speech first, then work on cleaner phrasing.',
  },
  {
    title: 'Speaking time vs silence',
    description: 'Speaking time is active speech; silence is time without speech.',
    body:
      'Speaking time measures the parts of a session where your voice is active. Silence measures the gaps. More speaking time and fewer long gaps usually create a stronger Flow Score.',
  },
  {
    title: 'How to use prompts',
    description: 'Pick a topic when you want a quick idea for practice.',
    body:
      'Prompts give you something to answer immediately. Choose one from the home page or Prompts page, then speak naturally instead of trying to prepare a perfect response.',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [openArticleTitle, setOpenArticleTitle] = useState<string | null>(helpArticles[0]?.title ?? null);

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

        <section className="grid gap-3 sm:grid-cols-2">
          {helpArticles.map((article) => {
            const isOpen = openArticleTitle === article.title;

            return (
              <button
                key={article.title}
                type="button"
                onClick={() => setOpenArticleTitle(isOpen ? null : article.title)}
                className="min-h-[150px] rounded-[20px] border border-border bg-surface-card p-4 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated md:min-h-[170px] md:p-5"
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
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">
                  {article.description}
                </p>
                {isOpen && (
                  <p className="mt-4 border-t border-border pt-4 text-sm font-sans leading-relaxed text-foreground">
                    {article.body}
                  </p>
                )}
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
