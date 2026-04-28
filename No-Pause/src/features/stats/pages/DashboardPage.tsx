import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Download, Instagram, Send, Flame, Target, Clock, TrendingUp, Play } from 'lucide-react';
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
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
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
	    <div className="rounded-[18px] md:rounded-[20px] border shadow-card elevation-card p-3.5 md:p-5 min-h-[92px] md:min-h-[112px]">
	      <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-2">
	        <p className="text-xs md:text-sm text-muted-foreground font-sans leading-tight">{label}</p>
	        <div className="rounded-lg md:rounded-xl bg-surface-elevated border border-border p-1.5">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
	      <p className={cn('text-xl md:text-3xl font-serif font-medium text-foreground leading-none', valueClassName)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/80 mt-1 font-sans">{sub}</p>}
    </div>
  );

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
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

  useEffect(() => {
    const dismissed = localStorage.getItem('nopause_install_banner_dismissed') === 'true';
    setInstallBannerDismissed(dismissed);
  }, []);

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

  const handleDismissInstallBanner = () => {
    setInstallBannerDismissed(true);
    localStorage.setItem('nopause_install_banner_dismissed', 'true');
  };

  const showInstallBanner = isInstallEligible && !isInstalled && !installBannerDismissed;

  return (
	    <div className="min-h-screen pb-32 px-5 md:px-12 lg:px-20 pt-6 md:pt-8 max-w-6xl mx-auto">
      {/* Header */}
	      <div className="flex items-start justify-between gap-3 mb-8 md:mb-12">
	        <div className="text-left">
	          <h1 className="text-3xl md:text-6xl font-serif font-medium text-foreground mb-2 md:mb-4 tracking-tight">No Pause</h1>
	          <h2 className="text-base md:text-2xl font-serif font-semibold text-foreground/95 tracking-tight">
	            Real-time speaking analytics tool.
	          </h2>
        </div>
        <div className="flex items-center justify-center gap-2">
          {showInstallBanner && (
	            <div className="md:hidden flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleInstallClick}
	                className="inline-flex min-h-10 items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs font-sans text-foreground hover:bg-surface-card transition-colors"
              >
                <Download size={14} className="text-primary" />
                Install
              </button>
              <button
                type="button"
                onClick={handleDismissInstallBanner}
	                className="min-h-10 min-w-10 px-2 py-1.5 rounded-full border border-border text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-surface-card transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {showInstallBanner && (
        <div className="hidden md:flex mb-6 md:mb-8 px-5 py-4 md:px-6 md:py-5 rounded-2xl border border-border bg-surface-elevated/80 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-card">
              <Download size={15} className="text-primary animate-bounce" />
            </span>
            <p className="text-sm md:text-base text-muted-foreground font-sans">Install No Pause for faster access</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-full border border-border text-sm md:text-base font-sans text-foreground hover:bg-surface-card transition-colors"
            >
              Install No Pause
            </button>
            <button
              type="button"
              onClick={handleDismissInstallBanner}
              className="px-3 py-2 rounded-full border border-border text-xs md:text-sm font-sans text-muted-foreground hover:text-foreground hover:bg-surface-card transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      {/* Speaking Area */}
      <div className="flex flex-col mb-4 md:mb-6">
        <div
          onClick={handleCardClick}
	          className="rounded-[20px] md:rounded-[24px] bg-gradient-to-b from-surface-card to-surface-elevated border border-border/80 shadow-card p-5 md:p-12 mb-4 md:mb-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden group"
        >
	          <div className="flex justify-center mb-4 md:mb-6">
	            <div className="relative h-[72px] w-[72px] md:w-32 md:h-32 rounded-full flex items-center justify-center bg-secondary transition-transform duration-300 group-hover:scale-110 night-glow">
	              <div className="absolute inset-0 rounded-full animate-pulse bg-primary opacity-30"></div>
	              <Mic size={30} className="md:hidden text-primary relative z-10" />
              <Mic size={56} className="hidden md:block text-primary relative z-10" />
            </div>
          </div>
	          <h3 className="text-lg md:text-2xl font-serif text-foreground mb-1">Free Speaking</h3>
	          <p className="text-xs md:text-base text-muted-foreground font-sans">Practice continuous speaking without time limits</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <OverviewCard icon={Flame} label="Current Streak" value={statsLoading ? '...' : `${stats.currentStreak}/${stats.bestStreak}`} />
        <OverviewCard icon={Target} label="Scored Sessions" value={statsLoading ? '...' : stats.scoredSessions} />
        <OverviewCard
          icon={Clock}
          label="Practice Time"
          value={statsLoading ? '...' : renderDurationValue(stats.totalPracticeTime)}
        />
        <OverviewCard icon={TrendingUp} label="Overall Flow" value={statsLoading ? '...' : stats.avgFlowScore} />
      </div>

      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground mb-4">Prompts</h2>
	      <div className="-mx-5 md:-mx-12 lg:-mx-20 px-5 md:px-12 lg:px-20 overflow-x-auto pb-3">
	        <div className="flex gap-3 md:gap-4 min-w-max">
            {homepagePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePromptClick(prompt)}
	              className="w-60 md:w-80 min-h-32 md:min-h-40 rounded-2xl bg-surface-elevated border border-border shadow-card p-4 md:p-5 text-left card-hover btn-press flex flex-col justify-between"
              >
	              <span className="text-lg md:text-2xl font-serif font-medium text-foreground leading-snug">{prompt}</span>
	              <span className="mt-4 md:mt-5 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft">
                  <Play size={16} fill="currentColor" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Social Icons */}
      <div className="flex items-center justify-center gap-4 mb-14">
        <button
          onClick={() => openExternal('https://instagram.com/nopause_org')}
          className="h-11 w-11 rounded-full flex items-center justify-center text-muted-foreground/80 hover:text-muted-foreground btn-press transition-colors"
          aria-label="Instagram"
        >
          <Instagram size={22} />
        </button>
        <button
          onClick={() => openExternal('https://t.me/nopause_org')}
          className="h-11 w-11 rounded-full flex items-center justify-center text-muted-foreground/80 hover:text-muted-foreground btn-press transition-colors"
          aria-label="Telegram"
        >
          <Send size={22} />
        </button>
      </div>

    </div>
  );
}
