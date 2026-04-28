import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Download, Flame, Target, Clock, TrendingUp, Play } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { usePWAInstall } from '@/providers/PWAInstallContext';
import { useInstallPlatform } from '@/shared/hooks/useInstallPlatform';
import { useAuth } from '@/providers/AuthContext';
import { getPracticeStats, type PracticeStats } from '@/lib/practiceApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';

const homepagePrompts = [
  'Talk about a small win you had recently.',
  'Describe a conversation that changed your mind.',
  'Explain something you are learning right now.',
  'Share an opinion you used to disagree with.',
  'Talk about a place that helps you think clearly.',
  'Describe a habit you want to improve.',
  'Explain a decision you made this week.',
  'Talk about a person who influenced your communication style.',
  'Describe what makes a team work well.',
  'Share what you would do with one extra hour today.',
];

function getDurationParts(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return {
    mins: Math.floor(safeSeconds / 60),
    secs: safeSeconds % 60,
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
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
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();

  const handleCardClick = () => {
    navigate('/practice/free-speaking');
  };

  const handlePromptClick = (prompt: string) => {
    navigate(`/practice/free-speaking?prompt_text=${encodeURIComponent(prompt)}`);
  };

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

  const OverviewCard = ({ icon: Icon, label, value, sub, valueClassName }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    sub?: string;
    valueClassName?: string;
  }) => (
	    <div className="rounded-[16px] md:rounded-[20px] border shadow-card elevation-card p-3 md:p-5 min-h-[76px] md:min-h-[112px]">
	      <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
	        <p className="text-[11px] md:text-sm text-muted-foreground font-sans leading-tight">{label}</p>
	        <div className="rounded-lg md:rounded-xl bg-surface-elevated border border-border p-1 md:p-1.5">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
	      <p className={cn('text-lg md:text-3xl font-serif font-medium text-foreground leading-none', valueClassName)}>{value}</p>
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

  useEffect(() => {
    let cancelled = false;

    setStatsLoading(true);
    getPracticeStats(user?.id ?? null, 15)
      .then((nextStats) => {
        if (!cancelled) setStats(nextStats);
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
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
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  return (
	    <div className="min-h-dvh md:min-h-screen pb-8 md:pb-32 px-4 md:px-12 lg:px-20 pt-4 md:pt-8 max-w-6xl mx-auto scrollbar-hidden">
      {/* Header */}
	      <div className="flex items-start justify-between gap-3 mb-3 md:mb-12">
	        <div className="text-left">
	          <h1 className="text-3xl md:text-6xl font-serif font-medium text-foreground mb-1 md:mb-4 tracking-tight">No Pause</h1>
	          <h2 className="text-sm md:text-2xl font-serif font-semibold text-foreground/95 tracking-tight">
	            Real-time speaking analytics tool.
	          </h2>
        </div>
        <div className="flex items-center justify-center gap-2">
          {showInstallButton && (
            <button
              type="button"
              onClick={handleInstallClick}
	            className="inline-flex min-h-10 items-center gap-1.5 px-2.5 md:px-4 py-1.5 rounded-full border border-border text-xs md:text-sm font-sans text-foreground hover:bg-surface-card transition-colors"
            >
              <Download size={14} className="text-primary" />
              Install
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/stats')}
	          className="h-10 w-10 rounded-full border border-border bg-surface-elevated text-sm font-sans font-semibold text-foreground shadow-card overflow-hidden flex items-center justify-center btn-press hover:bg-surface-card transition-colors"
            aria-label="Open stats"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
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

      <div className="flex min-h-[calc(100dvh-92px)] md:min-h-0 flex-col">
        {/* Speaking Area */}
        <div className="flex flex-1 flex-col mb-3 md:mb-6">
          <div
            onClick={handleCardClick}
            className="rounded-[20px] md:rounded-[24px] bg-gradient-to-b from-surface-card to-surface-elevated border border-border/80 shadow-card p-4 md:p-12 mb-0 md:mb-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden group flex flex-1 min-h-[150px] md:min-h-0 flex-col justify-center"
          >
            <div className="flex justify-center mb-3 md:mb-6">
              <div className="relative h-16 w-16 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-secondary transition-transform duration-300 group-hover:scale-110 night-glow">
                <div className="absolute inset-0 rounded-full animate-pulse bg-primary opacity-30"></div>
                <Mic size={28} className="md:hidden text-primary relative z-10" />
                <Mic size={56} className="hidden md:block text-primary relative z-10" />
              </div>
            </div>
            <h3 className="text-lg md:text-2xl font-serif text-foreground mb-1">Free Speaking</h3>
            <p className="text-xs md:text-base text-muted-foreground font-sans">Practice continuous speaking without time limits</p>
          </div>
        </div>

        <div className="mb-3 md:mb-10">
          <div className="mb-2 md:mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg md:text-3xl font-serif font-medium text-foreground">Prompts</h2>
            <button
              type="button"
              onClick={() => navigate('/prompts')}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs md:text-sm font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-card btn-press transition-colors"
            >
              View more
            </button>
          </div>
          <div className="max-h-[132px] md:max-h-[188px] overflow-hidden">
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 md:gap-4">
              {homepagePrompts.slice(0, 4).map((prompt, index) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  className={cn(
                    'w-[calc(50%-0.3125rem)] max-w-[240px] sm:w-[220px] md:w-[240px] min-h-24 md:min-h-40 rounded-2xl bg-surface-elevated border border-border shadow-card p-3 md:p-5 text-left card-hover btn-press flex flex-col justify-between',
                    index >= 2 && 'hidden sm:flex',
                    index >= 3 && 'sm:hidden lg:flex'
                  )}
                >
                  <span className="text-base md:text-2xl font-serif font-medium text-foreground leading-snug line-clamp-3">{prompt}</span>
                  <span className="mt-3 md:mt-5 w-9 h-9 md:w-11 md:h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft">
                    <Play size={14} fill="currentColor" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4 mb-3 md:mb-8">
          <OverviewCard icon={Flame} label="Current Streak" value={statsLoading ? '...' : `${stats.currentStreak}/${stats.bestStreak}`} />
          <OverviewCard icon={Target} label="Scored Sessions" value={statsLoading ? '...' : stats.scoredSessions} />
          <OverviewCard
            icon={Clock}
            label="Practice Time"
            value={statsLoading ? '...' : renderDurationValue(stats.totalPracticeTime)}
          />
          <OverviewCard icon={TrendingUp} label="Overall Flow" value={statsLoading ? '...' : stats.avgFlowScore} />
        </div>
      </div>

    </div>
  );
}
