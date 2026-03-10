import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Flame, Clock, TrendingUp, LogOut } from 'lucide-react';
import { useUser, useClerk, UserButton, useAuth } from '@clerk/clerk-react';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { useInstallPlatform } from '@/hooks/useInstallPlatform';
import {
  THRESHOLD_ADVANCED,
  THRESHOLD_BEGINNER,
  THRESHOLD_INTERMEDIATE,
  type PauseThresholdLevel,
} from '@/lib/scoringConstants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
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
  const { user } = useUser();
  const { signOut } = useClerk();
  const { userId } = useAuth();
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const [pauseThresholdLevel, setPauseThresholdLevel] = useState<PauseThresholdLevel>(
    () => storage.getPreferences().pauseThresholdLevel
  );
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();

  const convex = useConvex();
  const [remoteStats, setRemoteStats] = useState<any | undefined>(undefined);
  const remoteStreak = useQuery(api.streaks.getStreak, userId ? { userId } : 'skip');
  const [remoteRecentSessions, setRemoteRecentSessions] = useState<any[] | null | undefined>(undefined);

  useEffect(() => {
    if (userId) {
      setRemoteStats(undefined);
      setRemoteStreak(undefined);
      setRemoteRecentSessions(undefined);
      const fetchConvexData = async () => {
        try {
          const stats = await convex.query(api.sessions.getUserStats, { userId });
          setRemoteStats(stats);
        } catch (error) {
          console.warn('Convex getUserStats failed, using zeroed stats:', error);
          setRemoteStats(null);
        }

        try {
          const sessionsCall = await convex.query(api.sessions.getSessions, { userId });
          setRemoteRecentSessions(sessionsCall);
        } catch (error) {
          console.warn('Convex getSessions failed, showing empty history:', error);
          setRemoteRecentSessions(null);
        }
      };

      fetchConvexData();
    } else {
      setRemoteStats(null);
      setRemoteRecentSessions(null);
    }
  }, [userId, convex]);

  const isRemoteStatsLoading = remoteStats === undefined;
  const isRemoteStreakLoading = userId ? remoteStreak === undefined : false;
  const isRemoteRecentSessionsLoading = remoteRecentSessions === undefined;

  const backendScoredSessions = remoteStats?.scoredSessions ?? 0;
  const backendTotalPracticeTime = remoteStats?.totalSpeakingTime ?? 0;
  const backendAvgFlowScore = remoteStats?.avgFlowScore ?? 0;
  const backendCurrentStreak = remoteStreak?.currentStreak ?? 0;
  const backendBestStreak = remoteStreak?.bestStreak ?? 0;

  const recentSessions = (remoteRecentSessions ?? []).map((session) => ({
    id: session._id,
    created_at: new Date(session.createdAt).toISOString(),
    duration: session.duration,
    hesitationCount: session.pauses,
    flowScore: session.flowScore ?? 0,
    mode: session.mode || 'free',
  }));

  const hasAnySession = recentSessions.length > 0;

  const OverviewCard = ({ icon: Icon, label, value, sub }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
  }) => (
    <div className="rounded-[20px] border shadow-card elevation-card p-4 md:p-5 min-h-[112px]">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-muted-foreground font-sans">{label}</p>
        <div className="rounded-xl bg-surface-elevated border border-border p-1.5">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
      <p className="text-2xl md:text-3xl font-serif font-medium text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground/80 mt-1 font-sans">{sub}</p>}
    </div>
  );

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
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-12 h-12",
                  userButtonPopoverFooter: "hidden"
                }
              }}
            />
            {/* Fallback image manually defined underneath in case UserButton is overriding anything, but UserButton covers it. */}
            <div className="absolute inset-0 pointer-events-none -z-10 bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <>{user?.firstName?.[0] || ''}{user?.lastName?.[0] || ''}</>
              )}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-foreground text-base truncate leading-tight">
              {user?.fullName || 'User'}
            </span>
            <span className="text-muted-foreground text-sm truncate leading-tight">
              {user?.primaryEmailAddress?.emailAddress || ''}
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
            onClick={() => signOut()}
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
        <OverviewCard icon={Flame} label="Current Streak" value={isRemoteStreakLoading ? '...' : backendCurrentStreak} sub={`Best: ${backendBestStreak}`} />
        <OverviewCard icon={Target} label="Scored Sessions" value={isRemoteStatsLoading ? '...' : backendScoredSessions} />
        <OverviewCard icon={Clock} label="Practice Time" value={isRemoteStatsLoading ? '...' : formatDuration(backendTotalPracticeTime)} />
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
                  : 'Free';
              return (
                <div key={session.id || session.created_at} className="rounded-2xl bg-surface-elevated border border-border shadow-card p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-sans font-semibold">{modeLabel}</p>
                    <p className="text-xs text-muted-foreground font-sans">
                      {formatDate(session.created_at)} • {formatDuration(session.duration || 0)} • {session.hesitationCount || 0} hesitations
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-serif text-primary">{session.flowScore ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-sans">Flow</p>
                  </div>
                </div>
              );
            })}
          </div>
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
