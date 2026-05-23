import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { promptCategories } from '@/lib/core/prompts';

export default function PromptsPage() {
  const navigate = useNavigate();
  const [activeCategoryId, setActiveCategoryId] = useState(promptCategories[0]?.id ?? 'argue');
  const activeCategory = promptCategories.find((category) => category.id === activeCategoryId) ?? promptCategories[0];

  const openPrompt = (prompt: string) => {
    navigate(`/practice?prompt_text=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="min-h-screen bg-surface-base px-5 pb-24 pt-6 md:px-12 md:pt-8 lg:px-20">
      <main className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-8 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <header className="mb-8 text-left">
          <h1 className="mb-2 text-4xl font-serif font-medium text-foreground md:text-5xl">Prompts</h1>
          <p className="max-w-2xl text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
            Choose a speaking style, then start a 1 to 3 minute session with a focused prompt.
          </p>
        </header>

        <div className="mb-8 -mx-5 overflow-x-auto px-5 pb-1 scrollbar-hidden md:mx-0 md:px-0">
          <div className="flex w-max gap-2">
            {promptCategories.map((category) => {
              const isActive = category.id === activeCategoryId;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`inline-flex min-h-11 min-w-[96px] items-center justify-center rounded-full border px-5 text-sm font-sans font-bold transition-colors btn-press ${
                    isActive
                      ? 'border-primary/45 bg-surface-elevated text-foreground shadow-card'
                      : 'border-border bg-surface-card text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                  }`}
                  aria-pressed={isActive}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeCategory && (
          <section aria-labelledby={`${activeCategory.id}-prompts-heading`}>
            <div className="mb-4 border-b border-border pb-4">
              <h2
                id={`${activeCategory.id}-prompts-heading`}
                className="text-2xl font-serif font-medium text-foreground md:text-3xl"
              >
                {activeCategory.label}
              </h2>
              <p className="mt-1 max-w-xl text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
                {activeCategory.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {activeCategory.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => openPrompt(prompt)}
                  className="flex min-h-[168px] items-center rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated md:min-h-[196px] md:p-6"
                >
                  <span className="text-xl font-serif font-medium leading-snug text-foreground md:text-2xl">
                    {prompt}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
