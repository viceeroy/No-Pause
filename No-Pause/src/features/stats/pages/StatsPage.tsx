import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Send, TrendingUp } from 'lucide-react';
import { getPracticeStats, type PracticeStats } from '@/lib/practiceApi';
import { useAuth } from '@/providers/AuthContext';

function getDurationParts(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return {
    mins: Math.floor(safeSeconds / 60),
    secs: safeSeconds % 60,
  };
}

function formatDate(isoString?: string): string {
  if (!isoString) return 'Unknown date';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type StatsPageProps = {
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  showEmptyStateAction?: boolean;
};

export default function StatsPage({
  emptyStateTitle = 'No sessions yet',
  emptyStateMessage = 'Complete a Free Speaking session to see scored stats.',
  showEmptyStateAction = true,
}: StatsPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [limit, setLimit] = useState(15);
  const [stats, setStats] = useState<PracticeStats>({
    scoredSessions: 0,
    totalPracticeTime: 0,
    avgFlowScore: 0,
    bestFlowScore: 0,
    lastSessionDate: null,
    currentStreak: 0,
    bestStreak: 0,
    modeBreakdown: [],
    recentSessions: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatsLoading(true);
    setStatsError(null);
    getPracticeStats(user?.id ?? null, limit)
      .then((nextStats) => {
        if (!cancelled) setStats(nextStats);
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message)
            : 'Failed to load Supabase stats.';
        setStatsError(message);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit, user?.id]);

  const recentSessions = stats.recentSessions;
  const hasAnySession = recentSessions.length > 0;
  const flowProgress = Math.max(0, Math.min(100, stats.avgFlowScore || 0));

  const renderDurationValue = (seconds: number) => {
    const { mins, secs } = getDurationParts(seconds);
    return `${mins}m ${secs}s`;
  };

  const renderDurationInline = (seconds: number) => {
    const { mins, secs } = getDurationParts(seconds);
    return `${mins}m ${secs}s`;
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
          <h1 className="mb-2 text-4xl font-serif font-medium text-foreground md:text-5xl">Stats</h1>
          <p className="text-base font-sans text-muted-foreground">Free Speaking progress</p>
        </header>

        <section className="mb-6 rounded-[28px] border border-border bg-surface-card p-6 shadow-card md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-sans font-bold text-muted-foreground">Overall Flow Score</p>
              <p className="font-serif text-7xl font-medium leading-none text-primary md:text-8xl">
                {statsLoading ? '...' : stats.avgFlowScore}
              </p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-primary">
              <TrendingUp size={22} />
            </span>
          </div>
          <p className="mb-4 text-sm font-sans text-muted-foreground">
            {statsLoading ? 'Loading scored sessions...' : `${stats.scoredSessions} scored sessions`}
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full rounded-full bg-primary" style={{ width: `${flowProgress}%` }} />
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4">
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <TrendingUp size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Current streak</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {statsLoading ? '...' : `${stats.currentStreak} days`}
            </p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Clock size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Total practice</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {statsLoading ? '...' : renderDurationValue(stats.totalPracticeTime)}
            </p>
          </article>
        </section>

        <section className="mb-8 flex items-center gap-4 rounded-[20px] border border-border bg-surface-card p-5 shadow-card">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-primary">
            <Send size={22} />
          </span>
          <div className="min-w-0 text-left">
            <h2 className="mb-1 text-base font-serif font-medium text-foreground">Telegram integration</h2>
            <p className="text-sm font-sans leading-relaxed text-muted-foreground">
              Optional voice note practice outside the web app.
            </p>
          </div>
        </section>

        {statsError && (
          <div className="mb-8 rounded-2xl border border-border bg-surface-card p-4 text-sm font-sans text-destructive shadow-card">
            {statsError}
          </div>
        )}

        <section className="text-left">
          <h2 className="mb-4 text-xl font-serif font-medium text-foreground">Recent sessions</h2>

          {statsLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[64px] rounded-[18px] border border-border bg-surface-card shadow-card animate-pulse"
                />
              ))}
            </div>
          )}

          {!statsLoading && hasAnySession && (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <article
                  key={session.id || session.created_at}
                  className="flex min-h-[64px] items-center justify-between gap-4 rounded-[18px] border border-border bg-surface-card p-4 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-sans font-semibold text-foreground">Free Speaking</p>
                    <p className="truncate text-xs font-sans text-muted-foreground">
                      {formatDate(session.created_at)} | {renderDurationInline(session.duration || 0)} - {session.hesitationCount || 0} pauses
                    </p>
                  </div>
                  {session.flowScore ? (
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-serif font-medium leading-none text-primary">{session.flowScore}</p>
                      <p className="mt-1 text-[10px] font-sans font-bold uppercase tracking-[0.14em] text-muted-foreground">Flow</p>
                    </div>
                  ) : null}
                </article>
              ))}
              {recentSessions.length === limit && (
                <button
                  type="button"
                  onClick={() => setLimit((prev) => prev + 15)}
                  className="mt-2 rounded-full border border-border bg-surface-card px-5 py-2 text-sm font-sans font-bold text-foreground transition-colors hover:bg-surface-elevated"
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {!statsLoading && !hasAnySession && (
            <div className="rounded-[22px] border border-border bg-surface-card px-5 py-10 text-center shadow-card">
              <p className="mb-2 text-lg font-serif text-foreground">{emptyStateTitle}</p>
              <p className="mb-6 text-sm font-sans text-muted-foreground">{emptyStateMessage}</p>
              {showEmptyStateAction && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-sans font-bold text-primary-foreground shadow-soft btn-press hover:brightness-110"
                >
                  Start Practicing
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
