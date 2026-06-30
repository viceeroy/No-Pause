import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { promptCategories, type PromptCategory } from '@/lib/core/prompts';
import { fetchUserGeneratedPrompts, generatePrompts } from '@/lib/practiceApi';
import { useAuth } from '@/providers/AuthContext';

type CategoryId = PromptCategory['id'];

export default function PromptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>(promptCategories[0]?.id ?? 'argue');
  const activeCategory = promptCategories.find((category) => category.id === activeCategoryId) ?? promptCategories[0];

  const [generatedByCategory, setGeneratedByCategory] = useState<Partial<Record<CategoryId, string[]>>>({});
  const [loadingCategory, setLoadingCategory] = useState<CategoryId | null>(null);
  const [errorByCategory, setErrorByCategory] = useState<Partial<Record<CategoryId, string>>>({});
  // Categories whose persisted prompts have been loaded into state. Kept in a
  // ref (not state) so the load-on-visit effect doesn't need generatedByCategory
  // in its deps — state writes from handleGenerate can't retrigger it.
  const loadedCategoriesRef = useRef<Set<CategoryId>>(new Set());

  const generatedPrompts = generatedByCategory[activeCategoryId] ?? [];
  const isLoading = loadingCategory === activeCategoryId;
  const error = errorByCategory[activeCategoryId];

  useEffect(() => {
    if (!user) return;
    if (loadedCategoriesRef.current.has(activeCategoryId)) return;

    let cancelled = false;
    void fetchUserGeneratedPrompts(activeCategoryId).then((prompts) => {
      if (cancelled) return;
      loadedCategoriesRef.current.add(activeCategoryId);
      setGeneratedByCategory((prev) => ({ ...prev, [activeCategoryId]: prompts }));
    });

    return () => {
      cancelled = true;
    };
  }, [user, activeCategoryId]);

  const openPrompt = (prompt: string) => {
    navigate(`/practice?prompt_text=${encodeURIComponent(prompt)}`);
  };

  const handleGenerate = async () => {
    const categoryId = activeCategoryId;
    setLoadingCategory(categoryId);
    setErrorByCategory((prev) => ({ ...prev, [categoryId]: undefined }));

    try {
      await generatePrompts(categoryId);
      // Re-read the persisted row so the rendered list always reflects what's
      // in the DB (server already appended the new prompts). Avoids the mount
      // effect's stale fetch clobbering an optimistic in-memory append.
      const persisted = await fetchUserGeneratedPrompts(categoryId);
      loadedCategoriesRef.current.add(categoryId);
      setGeneratedByCategory((prev) => ({
        ...prev,
        [categoryId]: persisted,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate prompts. Please try again.';
      setErrorByCategory((prev) => ({ ...prev, [categoryId]: message }));
    } finally {
      setLoadingCategory((current) => (current === categoryId ? null : current));
    }
  };

  return (
    <div className="min-h-screen bg-surface-base px-5 pb-24 pt-6 md:px-12 md:pt-8 lg:px-20">
      <main className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-sans text-muted-foreground transition-colors btn-press hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-md"
        >
          <ChevronLeft size={16} /> Back
        </button>

        <header className="mb-6 text-left">
          <h1 className="mb-2 text-4xl font-serif font-medium text-foreground md:text-5xl">Prompts</h1>
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
                      ? 'border-primary bg-surface-card text-primary shadow-card'
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
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div>
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

              {user && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/45 bg-surface-elevated px-5 text-sm font-sans font-bold text-foreground shadow-card transition-colors btn-press hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isLoading ? 'Generating…' : 'Generate new prompts'}
                </button>
              )}
            </div>

            {error && (
              <p className="mb-4 text-sm font-sans text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {[...activeCategory.prompts, ...generatedPrompts].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => openPrompt(prompt)}
                  className="flex min-h-[168px] items-center rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated md:min-h-[196px] md:p-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
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
