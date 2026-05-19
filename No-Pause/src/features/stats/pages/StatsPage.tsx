import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart3, ChevronLeft, Clock, Flame, LogOut, Send, TrendingUp, Trophy } from 'lucide-react';
import {
  getPracticeStats,
  getWeeklyActivityDays,
  getWeeklyStatsComparison,
  type PracticeStats,
  type WeeklyActivityDay,
  type WeeklyStatsComparison,
} from '@/lib/practiceApi';
import { MODE_LABELS, normalizeMode } from '@/lib/core/modes';
import { formatDuration } from '@/lib/core/time';
import { useAuth } from '@/providers/AuthContext';

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

function hasRecentFlowScore(score: number | null | undefined): score is number {
  return score !== null && score !== undefined && Number.isFinite(Number(score));
}

function createEmptyWeeklyActivity(): WeeklyActivityDay[] {
  return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => ({
    label: label as WeeklyActivityDay['label'],
    dateKey: '',
    completed: false,
  }));
}

function createEmptyWeeklyStats(): WeeklyStatsComparison {
  return {
    currentWeek: {
      bestFlowScore: 0,
      avgFlowScore: 0,
      sessionCount: 0,
      totalPracticeTime: 0,
      hasScoredSession: false,
    },
    lastWeek: {
      bestFlowScore: 0,
      avgFlowScore: 0,
      sessionCount: 0,
      totalPracticeTime: 0,
      hasScoredSession: false,
    },
  };
}

function formatStatsPracticeTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

function formatCompactCount(count: number): string {
  const safeCount = Math.max(0, Math.floor(count || 0));
  if (safeCount < 1_000) return String(safeCount);
  if (safeCount < 1_000_000) return `${Math.floor(safeCount / 1_000)}k`;
  return `${Math.floor(safeCount / 1_000_000)}m`;
}

function WeeklyActivityRow({
  days,
  loading,
}: {
  days: WeeklyActivityDay[];
  loading: boolean;
}) {
  return (
    <article className="col-span-2 rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-sans font-semibold text-muted-foreground">Weekly activity</p>
          <p className="mt-1 text-sm font-sans text-muted-foreground">Completed sessions this week</p>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const completed = !loading && day.completed;
          return (
            <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-2">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-sans font-black transition-colors md:h-10 md:w-10 ${
                  completed
                    ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                    : 'border-border bg-surface-elevated text-muted-foreground'
                } ${loading ? 'animate-pulse' : ''}`}
                aria-label={`${day.label}: ${completed ? 'completed' : 'not completed'}`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
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
  const { user, signOut } = useAuth();
  const [limit, setLimit] = useState(50);
  const [stats, setStats] = useState<PracticeStats>({
    scoredSessions: 0,
    totalSessions: 0,
    totalPracticeTime: 0,
    avgFlowScore: 0,
    bestFlowScore: 0,
    lastSessionDate: null,
    currentStreak: 0,
    bestStreak: 0,
    modeBreakdown: [],
    recentSessions: [],
  });
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivityDay[]>(() => createEmptyWeeklyActivity());
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatsComparison>(() => createEmptyWeeklyStats());
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
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
      const [nextStats, nextWeeklyActivity, nextWeeklyStats] = await Promise.all([
        getPracticeStats(user?.id ?? null, limit),
        getWeeklyActivityDays(user?.id ?? null),
        getWeeklyStatsComparison(user?.id ?? null),
      ]);
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setStats(nextStats);
      setWeeklyActivity(nextWeeklyActivity);
      setWeeklyStats(nextWeeklyStats);
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

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const recentSessions = stats.recentSessions;
  const hasAnySession = recentSessions.length > 0;
  const weeklyBestScore = weeklyStats.currentWeek.bestFlowScore;
  const weeklyScoreTrend = weeklyStats.lastWeek.hasScoredSession
    ? weeklyBestScore - weeklyStats.lastWeek.bestFlowScore
    : null;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
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
              <p className="mb-2 text-sm font-sans font-bold text-muted-foreground">Weekly best score</p>
              <p className="font-serif text-7xl font-medium leading-none text-primary md:text-8xl">
                {statsLoading ? '...' : weeklyBestScore}
              </p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-primary">
              <TrendingUp size={22} />
            </span>
          </div>
          <p className="mb-4 text-sm font-sans text-muted-foreground">
            {statsLoading ? 'Loading scored sessions...' : `${weeklyStats.currentWeek.sessionCount} sessions this week`}
          </p>
          {!statsLoading && weeklyScoreTrend !== null && (
            <p className={`text-sm font-sans font-bold ${weeklyScoreTrend >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {weeklyScoreTrend >= 0 ? '↑' : '↓'} {Math.abs(weeklyScoreTrend)} from last week
            </p>
          )}
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4">
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <BarChart3 size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Weekly avg score</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {statsLoading ? '...' : weeklyStats.currentWeek.avgFlowScore}
            </p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Flame size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">Current streak</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {statsLoading ? '...' : `${stats.currentStreak} days`}
            </p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <TrendingUp size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">All-time sessions</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {statsLoading ? '...' : formatCompactCount(stats.totalSessions)}
            </p>
          </article>
          <article className="rounded-[22px] border border-border bg-surface-card p-4 shadow-card md:p-5">
            <Clock size={20} className="mb-5 text-primary" />
            <p className="mb-2 text-xs font-sans font-semibold text-muted-foreground">All-time practice</p>
            <p className="text-2xl font-serif font-medium text-foreground md:text-3xl">
              {statsLoading ? '...' : formatStatsPracticeTime(stats.totalPracticeTime)}
            </p>
          </article>
          <WeeklyActivityRow days={weeklyActivity} loading={statsLoading} />
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
                        {session.isAllTimeBest && (
                          <span
                            className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 text-[10px] font-sans font-black uppercase text-primary"
                            aria-label="Best all-time session"
                            title="Best all-time session"
                          >
                            <Trophy size={12} aria-hidden="true" />
                            Best
                          </span>
                        )}
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
                    {shouldShowRecentFlowScore(session.flowScore) || (session.isAllTimeBest && hasRecentFlowScore(session.flowScore)) ? (
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
