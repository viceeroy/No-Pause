import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Download, TrendingUp, Clock, Flame, CircleHelp, type LucideIcon } from 'lucide-react';
import { usePWAInstall } from '@/providers/PWAInstallContext';
import { useInstallPlatform } from '@/shared/hooks/useInstallPlatform';
import { useAuth } from '@/providers/AuthContext';
import { getPracticeStats, type PracticeStats } from '@/lib/practiceApi';
import { formatPracticeTotalDuration } from '@/lib/core/time';
import { getShuffledPrompts } from '@/lib/core/prompts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';

const emptyStats: PracticeStats = {
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
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [stats, setStats] = useState<PracticeStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const dashboardPrompts = useMemo(() => getShuffledPrompts(10), []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadStats = useCallback(async () => {
    // Guests have no stored sessions — skip DB fetches, show empty values.
    if (isGuest) {
      setStats(emptyStats);
      setStatsLoading(false);
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatsLoading(true);
    try {
      const nextStats = await getPracticeStats(user?.id ?? null, 1000);
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      setStats(nextStats);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      if (isMountedRef.current && requestId === requestIdRef.current) setStats(emptyStats);
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) setStatsLoading(false);
    }
  }, [user?.id, isGuest]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleCardClick = () => {
    navigate('/practice');
  };

  const handleInstallClick = async () => {
    if (!isInstallEligible || isInstalled) return;

    if (isIos || (isAndroid && !isAndroidChrome)) {
      setShowInstallHelp(true);
      return;
    }

    if (isInstallable && deferredPrompt) {
      await triggerInstall();
      return;
    }
    setShowInstallHelp(true);
  };

  const showInstallButton = isInstallEligible && !isInstalled;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'NP';
  const metricCards: Array<{
    label: string;
    value: string | number;
    icon: LucideIcon;
    valueClassName: string;
  }> = [
    {
      label: 'Flow score',
      value: statsLoading ? '...' : stats.avgFlowScore,
      icon: TrendingUp,
      valueClassName: 'text-primary',
    },
    {
      label: 'Practice time',
      value: statsLoading ? '...' : formatPracticeTotalDuration(stats.totalPracticeTime),
      icon: Clock,
      valueClassName: 'text-foreground',
    },
  ];

  return (
    <div className="min-h-dvh bg-surface-base px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 md:px-12 md:pb-16 md:pt-8 lg:px-20">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col">
        <div className="mb-4 flex items-center justify-between gap-4 md:mb-6">
          <div className="min-w-0 text-left">
            <h1 className="text-4xl font-serif font-medium tracking-tight text-foreground md:text-6xl">No Pause</h1>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-2">
            {showInstallButton && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 py-1.5 text-xs font-sans font-bold text-foreground transition-colors hover:bg-surface-elevated md:px-4 md:text-sm"
              >
                <Download size={14} className="text-primary" />
                Install
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/stats')}
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-card text-sm font-sans font-bold text-foreground shadow-card transition-colors btn-press hover:bg-surface-elevated md:h-12 md:w-12"
              aria-label="Open stats"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{isGuest ? 'NP' : initials}</span>
              )}
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:mb-6 md:gap-4 2xl:grid-cols-3">
          {metricCards.map(({ label, value, icon: Icon, valueClassName }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate('/stats')}
              aria-label={`Open stats — ${label}`}
              className="flex min-h-[116px] flex-col justify-between rounded-[20px] border border-border bg-surface-card p-4 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated md:min-h-[124px] md:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-sans font-bold leading-snug text-muted-foreground">{label}</p>
                <Icon size={18} className="shrink-0 text-primary" />
              </div>
              <p className={`text-3xl font-serif font-medium leading-none md:text-4xl ${valueClassName}`}>
                {value}
              </p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/stats')}
            aria-label="Open stats — Streak"
            className="hidden min-h-[116px] flex-col justify-between rounded-[20px] border border-border bg-surface-card p-4 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated md:min-h-[124px] md:p-5 2xl:flex"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-sans font-bold leading-snug text-muted-foreground">Streak</p>
              <Flame size={18} className="shrink-0 text-primary" />
            </div>
            <p className="text-3xl font-serif font-medium leading-none text-foreground md:text-4xl">
              {statsLoading ? '...' : `${stats.currentStreak}d`}
            </p>
          </button>
        </div>

        <div className="flex flex-1 flex-col">
          <button
            type="button"
            onClick={handleCardClick}
            className="group flex flex-1 min-h-[332px] flex-col items-center justify-center rounded-[28px] border border-border bg-surface-card p-7 text-center shadow-card transition-all btn-press hover:bg-surface-elevated md:min-h-[420px] md:p-12"
          >
            <div className="relative mb-8 flex h-44 w-44 items-center justify-center md:h-56 md:w-56">
              <div className="dashboard-mic-ping absolute inset-0 rounded-full border-2 border-primary/55" />
              <div className="dashboard-mic-glow absolute inset-0 rounded-full border border-primary/50" />
              <Mic size={64} className="relative z-10 text-primary drop-shadow-[0_0_14px_hsl(var(--primary)/0.22)] md:size-20" />
            </div>
            <h3 className="mb-3 text-3xl font-serif font-medium text-foreground md:text-4xl">Start with your voice</h3>
            <p className="max-w-md text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              Speak freely — we'll track your flow and pinpoint every silence.
            </p>
            <div className="mt-7 hidden items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-sans font-bold text-primary-foreground shadow-soft md:inline-flex">
              <Mic size={16} aria-hidden="true" /> Start Speaking
            </div>
          </button>
        </div>

        <section aria-labelledby="prompt-blocks-heading" className="mt-4 md:mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="prompt-blocks-heading" className="text-[1.1rem] font-serif font-medium text-foreground md:text-[1.375rem]">
              Prompts
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/prompts')}
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-border bg-surface-card px-4 text-xs font-sans font-bold text-foreground transition-colors btn-press hover:bg-surface-elevated md:text-sm"
              >
                More
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => navigate('/help')}
                    aria-label="Help"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-muted-foreground shadow-card transition-colors btn-press hover:bg-surface-elevated hover:text-foreground"
                  >
                    <CircleHelp size={18} aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  How Flow Score works
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="relative">
            <div className="-mx-5 overflow-x-auto px-5 pb-2 scrollbar-hidden min-[769px]:mx-0 min-[769px]:px-0">
              <div className="flex w-max gap-3">
                {dashboardPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => navigate(`/practice?prompt_text=${encodeURIComponent(prompt)}`)}
                    className="flex min-h-[118px] w-[calc((100vw-2.5rem)*0.8)] shrink-0 items-center rounded-[18px] border border-border bg-surface-card p-4 text-left shadow-card transition-colors btn-press hover:bg-surface-elevated min-[640px]:max-[768px]:w-[calc((100vw-2.5rem-0.75rem)/2)] min-[769px]:w-[240px]"
                  >
                    <p className="line-clamp-3 text-sm font-serif font-medium leading-tight text-foreground md:text-base">
                      {prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-y-0 -right-5 w-16 bg-gradient-to-r from-transparent to-[var(--background-base)] min-[769px]:right-0 min-[769px]:w-20" />
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-base/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={handleCardClick}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-primary px-6 text-base font-sans font-black text-primary-foreground shadow-soft btn-press"
          >
            <Mic size={20} /> Start Speaking
          </button>
        </div>
      </div>
      <Dialog open={showInstallHelp} onOpenChange={setShowInstallHelp}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[20px] border-border bg-surface-card p-0">
          <div className="p-6 pb-4">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-xl font-serif text-foreground">Install No Pause</DialogTitle>
              <DialogDescription className="text-sm font-sans leading-relaxed text-muted-foreground">
                {isIos ? (
                  <>
                    1. Tap the Share button at the bottom of the screen.
                    <br />
                    2. Tap "Add to Home Screen".
                    <br />
                    3. Tap "Add".
                  </>
                ) : isAndroid && !isAndroidChrome ? (
                  <>
                    For the best experience, open this page in Chrome.
                    <br />
                    Then tap Install.
                  </>
                ) : isAndroidChrome ? (
                  <>
                    1. Tap Install when Chrome shows the prompt
                    <br />
                    2. Confirm install
                    <br />
                    3. If no prompt appears, open Chrome menu and choose "Add to Home screen"
                  </>
                ) : isDesktop ? (
                  <>Click the install icon in your browser address bar, or open this page in Chrome for the easiest install.</>
                ) : (
                  <>Open this page in a browser that supports web app install prompts.</>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
