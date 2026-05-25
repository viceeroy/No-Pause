import { MessageSquare, Mic, Pause, TrendingUp } from 'lucide-react';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-full bg-surface-elevated ${className}`}
    />
  );
}

function MetricSkeleton({ icon: Icon, label }: { icon: typeof Pause; label: string }) {
  return (
    <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
      <Icon size={20} className="mb-5 text-primary" />
      <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">{label}</p>
      <SkeletonBlock className="h-8 w-28 md:h-9" />
    </article>
  );
}

export function ResultSkeletonPanel() {
  return (
    <div
      className="mx-auto w-full max-w-5xl overflow-hidden pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-8 text-left">
        <h2 className="mb-2 text-3xl font-serif font-medium text-foreground md:text-5xl">Results</h2>
        <SkeletonBlock className="h-4 w-64 max-w-full" />
      </div>

      <div className="space-y-6">
        <section className="rounded-[28px] border border-border bg-surface-card p-6 text-left shadow-card md:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-sans font-black uppercase tracking-[0.14em] text-muted-foreground">
                Flow Score
              </p>
              <SkeletonBlock className="h-20 w-36 md:h-24 md:w-44" />
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-primary">
              <TrendingUp size={22} />
            </span>
          </div>
          <SkeletonBlock className="h-2.5 w-full" />
          <SkeletonBlock className="mt-3 h-4 w-72 max-w-full" />
        </section>

        <section className="grid grid-cols-2 gap-3 md:gap-4">
          <MetricSkeleton icon={Pause} label="Pauses" />
          <MetricSkeleton icon={Mic} label="Speaking time" />
        </section>

        <section className="rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card md:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-serif font-medium text-foreground">
            <MessageSquare size={20} className="text-primary" /> Feedback
          </h3>
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-11/12" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        </section>
      </div>
    </div>
  );
}
