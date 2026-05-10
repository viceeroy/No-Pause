import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, Clock, LogOut, Send, TrendingUp } from 'lucide-react';
import { getPracticeStats, type PracticeStats } from '@/lib/practiceApi';
import { MODE_LABELS, normalizeMode } from '@/lib/core/modes';
import { formatDuration, formatPracticeTotalDuration } from '@/lib/core/time';
import { useAuth, type DifficultyLevel } from '@/providers/AuthContext';
import { getCurrentUtcMonthKey, useMonthlyStatsRefresh } from '@/features/stats/hooks/useMonthlyStatsRefresh';

const difficultyOptions: Array<{ level: DifficultyLevel; label: string }> = [
  { level: 'beginner', label: 'Beginner' },
  { level: 'intermediate', label: 'Intermediate' },
  { level: 'advanced', label: 'Advanced' },
];

function formatDate(isoString?: string): string {
  if (!isoString) return 'Unknown date';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSessionModeLabel(mode: string): string {
  const normalizedMode = mode.toLowerCase();
  if (normalizedMode === 'speaking' || normalizedMode === 'free' || normalizedMode === 'free_speaking') {
    return 'Speaking Mode';
  }

  return MODE_LABELS[normalizeMode(normalizedMode)];
}

function shouldShowRecentFlowScore(score: number | null | undefined): score is number {
  return Number(score) > 10;
}

type StatsPageProps = {
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  showEmptyStateAction?: boolean;
};

export default function StatsPage({
  emptyStateTitle = 'No sessions yet',
  emptyStateMessage = 'Complete a Speaking Mode session to see scored stats.',
  showEmptyStateAction = true,
}: StatsPageProps) {
  const navigate = useNavigate();
  const { user, signOut, difficultyLevel, updateDifficultyLevel } = useAuth();
  const [limit, setLimit] = useState(50);
  const [difficultyError, setDifficultyError] = useState<string | null>(null);
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
  const isMountedRef = useRef(false);
  const lastLoadedMonthRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadStats = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const nextStats = await getPracticeStats(user?.id ?? null, limit);
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setStats(nextStats);
      lastLoadedMonthRef.current = getCurrentUtcMonthKey();
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Failed to load Supabase stats.';
      setStatsError(message);
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) setStatsLoading(false);
    }
  }, [limit, user?.id]);

  useMonthlyStatsRefresh({
    lastLoadedMonthRef,
    refreshStats: loadStats,
  });

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const recentSessions = stats.recentSessions;
  const hasAnySession = recentSessions.length > 0;
  const flowProgress = Math.min(100, Math.max(0, stats.avgFlowScore || 0));
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const currentDifficultyLabel =
    difficultyOptions.find((option) => option.level === difficultyLevel)?.label ?? 'Beginner';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'NP';

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
          <p className="text-base font-sans text-muted-foreground">Speaking progress</p>
        </header>

        <section className="mb-6 flex items-center justify-between gap-4 rounded-[22px] border border-border bg-surface-card p-5 shadow-card md:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated text-sm font-sans font-bold text-primary shadow-card md:h-16 md:w-16">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-lg font-serif font-medium leading-tight text-foreground md:text-xl">
                {displayName}
              </p>
              <p className="mt-1 truncate text-sm font-sans text-muted-foreground">
                {email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground transition-colors btn-press hover:bg-surface-card"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} className="text-primary" />
          </button>
        </section>

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
              {statsLoading ? '...' : formatPracticeTotalDuration(stats.totalPracticeTime)}
            </p>
          </article>
        </section>

        <section className="mb-6 rounded-[22px] border border-border bg-surface-card p-5 text-left shadow-card md:p-6">
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-serif font-medium text-foreground">Difficulty</h2>
              <span
                className="inline-flex min-h-8 items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-sans font-bold text-primary"
                aria-label={`Current difficulty: ${currentDifficultyLabel}`}
              >
                {currentDifficultyLabel}
              </span>
            </div>
            <p className="mt-1 text-sm font-sans text-muted-foreground">
              Higher difficulty catches shorter pauses.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {difficultyOptions.map((option) => {
              const selected = option.level === difficultyLevel;
              return (
                <button
                  key={option.level}
                  type="button"
                  onClick={() => {
                    setDifficultyError(null);
                    void updateDifficultyLevel(option.level).catch((error) => {
                      const message =
                        error && typeof error === 'object' && 'message' in error
                          ? String((error as { message?: unknown }).message)
                          : 'Could not update difficulty.';
                      setDifficultyError(message);
                    });
                  }}
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-sans font-bold transition-colors btn-press ${
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                      : 'border-border bg-surface-elevated text-foreground hover:border-primary/40'
                  }`}
                  aria-pressed={selected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {difficultyError && (
            <p className="mt-3 text-sm font-sans text-destructive">{difficultyError}</p>
          )}
        </section>

        <a
          href="https://t.me/NoPauseAI_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 flex min-h-[88px] cursor-pointer items-center gap-4 rounded-[20px] border border-border bg-surface-card p-5 shadow-card transition-colors btn-press hover:border-primary/40 hover:bg-surface-elevated"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-primary">
            <Send size={22} />
          </span>
          <div className="min-w-0 text-left">
            <h2 className="mb-1 text-base font-serif font-medium text-foreground">Telegram integration</h2>
            <p className="text-sm font-sans leading-relaxed text-muted-foreground">
              Optional voice note practice outside the web app.
            </p>
          </div>
          <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-primary">
            <ArrowUpRight size={16} />
          </span>
        </a>

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
              {recentSessions.map((session) => {
                const isTelegramSession = session.source === 'telegram';

                return (
                  <article
                    key={session.id || session.created_at}
                    className="flex min-h-[64px] items-center justify-between gap-4 rounded-[18px] border border-border bg-surface-card p-4 shadow-card"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-sans font-semibold text-foreground">
                          {getSessionModeLabel(session.mode)}
                        </p>
                        {isTelegramSession && (
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground"
                            aria-label="Telegram session"
                            title="Telegram session"
                          >
                            <Send size={13} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-sans text-muted-foreground">
                        {formatDate(session.created_at)} | Silence {formatDuration(session.totalSilenceTime || 0)} - {session.hesitationCount || 0} pauses
                      </p>
                    </div>
                    {shouldShowRecentFlowScore(session.flowScore) ? (
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-serif font-medium leading-none text-primary">{session.flowScore}</p>
                        <p className="mt-1 text-[10px] font-sans font-bold uppercase tracking-[0.14em] text-muted-foreground">Flow</p>
                      </div>
                    ) : (
                      <div className="w-12 shrink-0" aria-hidden="true" />
                    )}
                  </article>
                );
              })}
              {recentSessions.length === limit && (
                <button
                  type="button"
                  onClick={() => setLimit((prev) => prev + 50)}
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
