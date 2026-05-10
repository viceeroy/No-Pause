import { useNavigate } from 'react-router-dom';

export function HelpSection() {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="help-heading" className="mt-4 md:mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="help-heading" className="text-[1.1rem] font-serif font-medium text-foreground md:text-[1.375rem]">
          Help
        </h2>
        <button
          type="button"
          onClick={() => navigate('/help')}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-border bg-surface-card px-4 text-xs font-sans font-bold text-foreground transition-colors btn-press hover:bg-surface-elevated md:text-sm"
        >
          Help
        </button>
      </div>
    </section>
  );
}
