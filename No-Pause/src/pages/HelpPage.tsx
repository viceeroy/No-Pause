import { useNavigate } from 'react-router-dom';
import { HELP_ARTICLES } from '@/features/help/helpContent';

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Help</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Short guides for getting the most out of NoPause.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_ARTICLES.map((article) => (
            <button
              key={article.slug}
              type="button"
              onClick={() => navigate(`/help/${article.slug}`)}
              className="rounded-2xl border bg-card p-5 cursor-pointer hover:shadow-md transition-shadow text-left min-w-0"
            >
              <p className="text-3xl leading-none" aria-hidden="true">
                {article.icon}
              </p>
              <h2 className="mt-2 text-base font-semibold text-foreground break-words">
                {article.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground break-words">
                {article.summary}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
