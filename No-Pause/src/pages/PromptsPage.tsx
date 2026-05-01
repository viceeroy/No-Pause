import { ChevronLeft, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { opinionPrompts } from '@/lib/core/prompts';

export default function PromptsPage() {
  const navigate = useNavigate();

  const openPrompt = (prompt: string) => {
    navigate(`/practice/free-speaking?prompt_text=${encodeURIComponent(prompt)}`);
  };

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
          <p className="mb-2 text-xs font-sans font-black uppercase tracking-widest text-primary">Free Speaking</p>
          <h1 className="mb-2 text-4xl font-serif font-medium text-foreground md:text-5xl">Prompts</h1>
          <p className="max-w-2xl text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
            Pick a prompt, then practice it in Free Speaking.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {opinionPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => openPrompt(prompt)}
              className="flex min-h-[154px] flex-col justify-between rounded-[20px] border border-border bg-surface-card p-4 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated md:min-h-[176px] md:p-5"
            >
              <span className="text-lg font-serif font-medium leading-snug text-foreground md:text-xl">
                {prompt}
              </span>
              <span className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                <Play size={16} fill="currentColor" />
              </span>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
