import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Flame, Clock, TrendingUp, LogOut } from 'lucide-react';
import { storage } from '@/shared/lib/storage';
import { cn } from '@/shared/lib/utils';
import { usePWAInstall } from '@/providers/PWAInstallContext';
import { useInstallPlatform } from '@/shared/hooks/useInstallPlatform';
import { useAuth } from '@/providers/AuthContext';
import {
  THRESHOLD_ADVANCED,
  THRESHOLD_BEGINNER,
  THRESHOLD_INTERMEDIATE,
  type PauseThresholdLevel,
} from '@/features/practice/lib/scoringConstants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';

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

const THRESHOLD_DESCRIPTIONS: Record<PauseThresholdLevel, string> = {
  beginner: 'Relaxed timing — longer pauses are forgiven.',
  intermediate: 'Normal timing — keep momentum without rushing.',
  advanced: 'Strict timing — minimal pauses between thoughts.',
};

const THRESHOLD_OPTIONS: { level: PauseThresholdLevel; label: string; value: number }[] = [
  { level: 'beginner', label: 'Relaxed', value: THRESHOLD_BEGINNER },
  { level: 'intermediate', label: 'Normal', value: THRESHOLD_INTERMEDIATE },
  { level: 'advanced', label: 'Strict', value: THRESHOLD_ADVANCED },
];

export default function StatsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const [limit, setLimit] = useState(15);
  const [pauseThresholdLevel, setPauseThresholdLevel] = useState<PauseThresholdLevel>(
    () => storage.getPreferences().pauseThresholdLevel
  );
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();

  const isRemoteStatsLoading = false;
  const isRemoteStreakLoading = false;
  const isRemoteRecentSessionsLoading = false;

  const backendScoredSessions = 0;
  const backendTotalPracticeTime = 0;
  const backendAvgFlowScore = 0;
  const backendCurrentStreak = 0;
  const backendBestStreak = 0;
  const modeBreakdown: Array<{
    mode: string;
    totalSessions: number;
    totalDuration: number;
    avgFlowScore: number | null;
  }> = [];

  const shouldShowScore = (mode: string, score: number | null | undefined) => {
    const normalizedMode = (mode || '').toLowerCase();
    if (normalizedMode === 'free' || normalizedMode === 'readingchallenge') return false;
    if (normalizedMode === 'lemon' || normalizedMode === 'topic') {
      return score !== null && score !== undefined && score > 0;
    }
    return false;
  };

  const recentSessions: Array<{
    id: string;
    created_at: string;
    duration: number;
    hesitationCount: number;
    flowScore: number | null;
    mode: string;
  }> = [];

  const hasAnySession = recentSessions.length > 0;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const OverviewCard = ({ icon: Icon, label, value, sub, valueClassName }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    sub?: string;
    valueClassName?: string;
  }) => (
    <div className="rounded-[20px] border shadow-card elevation-card p-4 md:p-5 min-h-[112px]">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-muted-foreground font-sans">{label}</p>
        <div className="rounded-xl bg-surface-elevated border border-border p-1.5">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
      <p className={cn('text-2xl md:text-3xl font-serif font-medium text-foreground leading-none', valueClassName)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/80 mt-1 font-sans">{sub}</p>}
    </div>
  );

  const renderDurationValue = (seconds: number) => {
    const { mins, secs } = getDurationParts(seconds);
    return (
      <>
        {mins}
        <span className="ml-1 text-sm md:text-base font-sans font-semibold text-muted-foreground/80">m</span>
        <span className="ml-2">
          {secs}
          <span className="ml-1 text-sm md:text-base font-sans font-semibold text-muted-foreground/80">s</span>
        </span>
      </>
    );
  };

  const renderDurationInline = (seconds: number) => {
    const { mins, secs } = getDurationParts(seconds);
    return (
      <>
        {mins}
        <span className="ml-1 text-[10px] md:text-xs font-semibold text-muted-foreground/80">m</span>
        <span className="ml-2">
          {secs}
          <span className="ml-1 text-[10px] md:text-xs font-semibold text-muted-foreground/80">s</span>
        </span>
      </>
    );
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

  return (
    <div className="min-h-screen bg-surface-base pb-32 px-6 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Stats</h1>
          <p className="text-base text-muted-foreground font-sans">Flow score by practice mode.</p>
        </div>
      </div>

      {/* Profile Row */}
      <div className="w-full flex items-center justify-between rounded-[20px] bg-surface-elevated border border-border p-4 mb-8 shadow-card elevation-card max-h-[72px]">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ring-2 ring-border overflow-hidden">
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center text-primary font-bold">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <>{initials}</>
              )}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-foreground text-base truncate leading-tight">
              {displayName}
            </span>
            <span className="text-muted-foreground text-sm truncate leading-tight">
              {email}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isInstallEligible && !isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-full border border-border text-sm font-sans text-foreground hover:bg-surface-card transition-colors hidden sm:block"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="p-2 md:px-4 md:py-2 rounded-full border border-border text-sm font-sans text-foreground hover:bg-surface-card transition-colors flex items-center justify-center"
            title="Sign out"
          >
            <LogOut size={16} className="md:hidden" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </div>

      <Dialog open={showInstallHelp} onOpenChange={setShowInstallHelp}>
        <DialogContent className="bg-[var(--surface-card)] border-border/60 rounded-[20px] p-0 max-w-md mx-auto gap-0 overflow-hidden">
          <div className="p-6 pb-4">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-xl font-serif text-foreground">Install No Pause</DialogTitle>
              <DialogDescription className="text-sm font-sans text-muted-foreground leading-relaxed">
                {isIos ? (
                  <>
                    1. Tap Share icon in Safari
                    <br />
                    2. Select "Add to Home Screen"
                    <br />
                    3. Confirm install
                  </>
                ) : isAndroid && !isAndroidChrome ? (
                  <>
                    Open this page in Chrome to install No Pause on Android.
                    <br />
                    In Chrome, tap Install or "Add to Home screen".
                  </>
                ) : isAndroidChrome ? (
                  <>
                    1. Tap Install when Chrome shows the prompt
                    <br />
                    2. Confirm install
                    <br />
                    3. If no prompt appears, open Chrome menu (⋮) and choose "Add to Home screen"
                  </>
                ) : isDesktop ? (
                  <>Click Install in your browser prompt (Chrome/Edge recommended on desktop).</>
                ) : (
                  <>Open this page in a browser that supports web app install prompts.</>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <OverviewCard icon={Flame} label="Current Streak" value={isRemoteStreakLoading ? '...' : `${backendCurrentStreak}/${backendBestStreak}`} />
        <OverviewCard icon={Target} label="Scored Sessions" value={isRemoteStatsLoading ? '...' : backendScoredSessions} />
        <OverviewCard
          icon={Clock}
          label="Practice Time"
          value={isRemoteStatsLoading ? '...' : renderDurationValue(backendTotalPracticeTime)}
        />
        <OverviewCard icon={TrendingUp} label="Overall Flow" value={isRemoteStatsLoading ? '...' : backendAvgFlowScore} />
      </div>

      <div className="mb-8">
        <h2 className="text-lg md:text-xl font-serif text-foreground mb-3">Pause Threshold</h2>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {THRESHOLD_OPTIONS.map((option) => {
            const isActive = pauseThresholdLevel === option.level;
            return (
              <button
                key={option.level}
                type="button"
                onClick={() => {
                  setPauseThresholdLevel(option.level);
                  storage.savePreferences({ pauseThresholdLevel: option.level });
                }}
                className={cn(
                  'rounded-2xl border p-3 md:p-4 text-center transition-colors',
                  isActive
                    ? 'bg-primary/15 border-primary/45 text-foreground'
                    : 'bg-surface-base border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                )}
              >
                <p className="text-xs md:text-sm font-sans font-semibold">{option.label}</p>
                <p className={cn('text-lg md:text-xl font-serif mt-1', isActive ? 'text-primary' : 'text-foreground')}>
                  {option.value.toFixed(1)}s
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground font-sans mt-3">
          {THRESHOLD_DESCRIPTIONS[pauseThresholdLevel]}
        </p>
      </div>

      {modeBreakdown.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg md:text-xl font-serif text-foreground mb-3">Practice Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {modeBreakdown.map((item) => {
              const label = item.mode === 'free'
                ? 'Free Speaking'
                : item.mode === 'lemon'
                  ? 'Lemon'
                  : item.mode === 'topic'
                    ? 'Topic'
                    : 'Reading Challenge';
              const showScore = item.mode === 'lemon' || item.mode === 'topic';
              return (
                <div key={item.mode} className="rounded-[20px] border shadow-card elevation-card p-4 md:p-5 min-h-[112px]">
                  <p className="text-sm text-muted-foreground font-sans mb-2">{label}</p>
                  <p className="text-2xl md:text-3xl font-serif font-medium text-foreground leading-none">{item.totalSessions}</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 font-sans">
                    <span className="font-sans">
                      {renderDurationValue(item.totalDuration)}
                    </span>
                    <span className="ml-1">total</span>
                  </p>
                  {showScore && (
                    <p className="text-xs text-muted-foreground/80 mt-1 font-sans">
                      Avg flow {item.avgFlowScore ?? 0}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isRemoteRecentSessionsLoading && (
        <div className="mb-8">
          <h2 className="text-xl font-serif text-foreground mb-3">Recent Activity</h2>
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-[82px] rounded-2xl border border-border bg-surface-elevated animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {!isRemoteRecentSessionsLoading && hasAnySession && (
        <div className="mb-8">
          <h2 className="text-xl font-serif text-foreground mb-3">Recent Activity</h2>
          <div className="space-y-3">
            {recentSessions.map((session) => {
              const modeLabel = session.mode === 'lemon'
                ? 'Lemon'
                : session.mode === 'topic'
                  ? 'Topic'
                  : session.mode === 'readingchallenge'
                    ? 'Reading Challenge'
                    : 'Free';
              return (
                <div key={session.id || session.created_at} className="rounded-2xl bg-surface-elevated border border-border shadow-card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-sans font-semibold">{modeLabel}</p>
                    <p className="text-xs text-muted-foreground font-sans">
                      {formatDate(session.created_at)} • {renderDurationInline(session.duration || 0)} • {session.hesitationCount || 0} hesitations
                    </p>
                  </div>
                  {shouldShowScore(session.mode, session.flowScore) ? (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-serif text-primary">{session.flowScore}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-sans">Flow</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {recentSessions.length === limit && (
            <button
              type="button"
              onClick={() => setLimit((prev) => prev + 15)}
              className="mt-4 px-5 py-2 rounded-full border border-border text-sm font-sans text-foreground hover:bg-surface-card transition-colors"
            >
              Load more
            </button>
          )}
        </div>
      )}

      {!isRemoteRecentSessionsLoading && !hasAnySession && (
        <div className="text-center py-12">
          <p className="text-lg font-serif text-foreground mb-2">No sessions yet</p>
          <p className="text-sm text-[#AAB2C5] font-sans mb-6">Complete a Lemon or Topic session to see scored stats.</p>
          <button onClick={() => navigate('/')} className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-sans font-semibold text-sm btn-press hover:brightness-110 night-glow transition-all">
            Start Practicing
          </button>
        </div>
      )}
    </div>
  );
}
