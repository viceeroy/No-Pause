import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Flame, Target, Clock, Shield, Zap, Timer, Download, Instagram, Send, ExternalLink } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { LEMON_MIN_TOTAL_SECONDS, TOPIC_MIN_TOTAL_SECONDS } from '@/lib/scoringConstants';
import { usePWAInstall } from '@/contexts/PWAInstallContext';
import { useInstallPlatform } from '@/hooks/useInstallPlatform';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const toMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

const StatCard = ({ icon: Icon, label, value, sub, className }: StatCardProps) => (
  <div className={`card-hover rounded-3xl p-3.5 md:p-5 ${className}`}>
    <div className="flex items-start justify-between mb-2 md:mb-3">
      <div className="p-1.5 md:p-2.5 rounded-2xl bg-surface-elevated border border-border">
        <Icon size={16} className="text-primary md:hidden" />
        <Icon size={20} className="text-primary hidden md:block" />
      </div>
    </div>
    <p className="text-2xl md:text-4xl font-serif font-medium text-foreground drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">{value}</p>
    <p className="text-[11px] md:text-sm text-muted-foreground/90 mt-0.5 font-sans">{label}</p>
    {sub && <p className="text-[10px] md:text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
  </div>
);

interface CompactModeCardProps {
  title: string;
  subtitle: string;
  actionLabel: string;
  timeLabel: string;
  onClick: () => void;
  icon: React.ElementType;
  className?: string;
  iconWrapClass?: string;
  iconClass?: string;
  actionClass?: string;
}

const CompactModeCard = ({
  title, subtitle, actionLabel, timeLabel, onClick, icon: Icon,
  className, iconWrapClass, iconClass, actionClass,
}: CompactModeCardProps) => (
  <button
    onClick={onClick}
    className={cn(
      'rounded-[22px] p-4 md:p-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden',
      'min-h-[220px] flex flex-col items-center justify-between',
      className
    )}
  >
    <div className={cn('p-2.5 rounded-2xl border', iconWrapClass)}>
      <Icon size={18} className={iconClass} />
    </div>
    <div className="mt-3">
      <h3 className="text-sm md:text-lg font-serif text-foreground leading-tight">{title}</h3>
      <p className="text-[11px] md:text-sm text-muted-foreground font-sans leading-tight mt-1">{subtitle}</p>
    </div>
    <div className={cn(
      'mt-3 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-sans font-semibold border',
      actionClass
    )}>
      {actionLabel}
    </div>
    <div className="mt-3">
      <p className="text-lg md:text-xl font-serif font-semibold text-foreground leading-none">{timeLabel}</p>
      <p className="text-[9px] md:text-[10px] text-muted-foreground font-sans uppercase tracking-[0.14em] mt-1">Time Limit</p>
    </div>
  </button>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const { userId } = useAuth();
  const [stats, setStats] = useState<ReturnType<typeof storage.getStats> | null>(null);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();

  useEffect(() => {
    setStats(storage.getStats());
  }, []);

  const remoteStats = useQuery(
    api.sessions.getUserStats,
    userId ? { userId } : 'skip',
  );
  const remoteStreak = useQuery(
    api.streaks.getStreak,
    userId ? { userId } : 'skip',
  );

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const handleCardClick = (mode: string) => {
    if (mode === 'free') navigate('/practice/free-speaking');
    else if (mode === 'lemon') navigate('/practice?mode=lemon');
    else if (mode === 'topic') navigate('/practice?mode=topic');
  };

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

  const handleDismissInstallBanner = () => {
    setInstallBannerDismissed(true);
    localStorage.setItem('nopause_install_banner_dismissed', 'true');
  };

  const showInstallBanner = isInstallEligible && !isInstalled && !installBannerDismissed;

  if (!stats) return null;

  const backendTotalSessions = remoteStats?.totalSessions ?? stats.totalSessions;
  const backendTotalPracticeTime = remoteStats?.totalSpeakingTime ?? stats.totalPracticeTime;
  const backendCurrentStreak = remoteStreak?.currentStreak ?? stats.currentStreak;
  const backendBestStreak = stats.bestStreak;

  return (
    <div className="min-h-screen pb-32 px-5 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-12">
        <div className="text-left">
          <h1 className="text-4xl md:text-6xl font-serif font-medium text-foreground mb-4 tracking-tight">No Pause</h1>
          <h2 className="text-lg md:text-2xl font-serif font-semibold text-foreground/95 tracking-tight">
            Real-time speaking analytics tool.
          </h2>
          <button
            type="button"
            onClick={() => setShowPrivacyInfo(true)}
            className="md:hidden inline-flex items-center gap-2 text-[11px] font-sans text-muted-foreground/90 hover:text-foreground transition-colors mt-2"
          >
            <Shield size={12} className="text-primary" />
            Offline &amp; Private
          </button>
        </div>
        <div className="flex items-center justify-center gap-2">
          {showInstallBanner && (
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border text-xs font-sans text-foreground hover:bg-surface-card transition-colors"
              >
                <Download size={14} className="text-primary" />
                Install
              </button>
              <button
                type="button"
                onClick={handleDismissInstallBanner}
                className="px-2.5 py-2 rounded-full border border-border text-[11px] font-sans text-muted-foreground hover:text-foreground hover:bg-surface-card transition-colors"
              >
                ✕
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowPrivacyInfo(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border/80 text-primary rounded-full text-xs md:text-sm font-sans font-semibold hover:bg-surface-card transition-colors"
          >
            <Shield size={14} />
            Offline & Private
          </button>
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

      <Dialog open={showPrivacyInfo} onOpenChange={setShowPrivacyInfo}>
        <DialogContent className="bg-[var(--surface-card)] border-border/60 rounded-[20px] p-0 max-w-md mx-auto gap-0 overflow-hidden">
          <div className="p-6 pb-4">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-xl font-serif text-foreground">Offline &amp; Private</DialogTitle>
              <DialogDescription asChild>
                <div className="text-sm font-sans text-muted-foreground leading-relaxed space-y-2">
                  <p>• Your sessions stay on your device</p>
                  <p>• Audio and transcripts are stored locally</p>
                  <p>• Nothing is sent to servers unless you export it</p>
                  <p>• Works without internet</p>
                  <p className="text-xs text-muted-foreground/80 pt-1">You control your data.</p>
                </div>
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>

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
      <div className="flex flex-col mb-14">
        <div
          onClick={() => handleCardClick('free')}
          className="rounded-[24px] bg-gradient-to-b from-surface-card to-surface-elevated border border-border/80 shadow-card p-8 md:p-12 mb-4 md:mb-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden group"
        >
          <div className="flex justify-center mb-6">
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-secondary transition-transform duration-300 group-hover:scale-110 night-glow">
              <div className="absolute inset-0 rounded-full animate-pulse bg-primary opacity-30"></div>
              <Mic size={40} className="md:hidden text-primary relative z-10" />
              <Mic size={56} className="hidden md:block text-primary relative z-10" />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-serif text-foreground mb-1">Free Speaking</h3>
          <p className="text-sm md:text-base text-muted-foreground font-sans">Practice continuous speaking without time limits</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <CompactModeCard
            onClick={() => handleCardClick('lemon')}
            icon={Timer}
            title="Lemon Technique"
            subtitle={`${toMMSS(LEMON_MIN_TOTAL_SECONDS)} pressure speak`}
            actionLabel="Random word"
            timeLabel={toMMSS(LEMON_MIN_TOTAL_SECONDS)}
            className="bg-gradient-to-b from-ember-200/14 to-surface-primary border border-ember-500/40 shadow-card"
            iconWrapClass="bg-ember-200/35 border-ember-500/35"
            iconClass="text-ember-600"
            actionClass="bg-surface-interactive border-ember-500/35 text-ember-600"
          />
          <CompactModeCard
            onClick={() => handleCardClick('topic')}
            icon={Target}
            title="Topic Score"
            subtitle={`${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} critical thinking`}
            actionLabel="Random topic"
            timeLabel={toMMSS(TOPIC_MIN_TOTAL_SECONDS)}
            className="bg-gradient-to-b from-cyan-500/12 to-surface-primary border border-cyan-400/40 shadow-card"
            iconWrapClass="bg-cyan-500/18 border-cyan-400/35"
            iconClass="text-cyan-300"
            actionClass="bg-surface-interactive border-cyan-400/35 text-cyan-300"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Flame} label="Day Streak" value={backendCurrentStreak} sub={`Best: ${backendBestStreak}`} className="elevation-card" />
        <StatCard icon={Target} label="Sessions" value={backendTotalSessions} className="elevation-card" />
        <StatCard icon={Clock} label="Practice Time" value={formatTime(backendTotalPracticeTime)} className="elevation-card" />
        <StatCard icon={Zap} label="Flow Score" value={`${stats.avgScore}%`} sub={stats.bestScore > 0 ? `Best: ${stats.bestScore}%` : ''} className="elevation-card-elevated border border-ember-500/35" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-14">
        <button
          onClick={() => openExternal('https://instagram.com/nopause_org')}
          className="rounded-2xl night-panel p-4 md:p-5 text-left card-hover btn-press min-h-[96px] border border-rose-400/25 bg-gradient-to-b from-rose-400/10 to-surface-elevated relative"
        >
          <ExternalLink size={12} className="absolute right-3 top-3 text-muted-foreground" />
          <div className="inline-flex items-center gap-2 mb-1">
            <Instagram size={14} className="text-rose-300" />
            <p className="text-sm md:text-lg font-serif text-foreground">Join Instagram</p>
          </div>
          <p className="text-xs md:text-sm text-rose-200/85 font-sans">@nopause_org</p>
          <p className="text-[11px] md:text-xs text-muted-foreground font-sans mt-1">Daily speaking motivation</p>
        </button>
        <button
          onClick={() => openExternal('https://t.me/nopause_org')}
          className="rounded-2xl night-panel p-4 md:p-5 text-left card-hover btn-press min-h-[96px] border border-cyan-400/25 bg-gradient-to-b from-cyan-400/10 to-surface-elevated relative"
        >
          <ExternalLink size={12} className="absolute right-3 top-3 text-muted-foreground" />
          <div className="inline-flex items-center gap-2 mb-1">
            <Send size={14} className="text-cyan-300" />
            <p className="text-sm md:text-lg font-serif text-foreground">Discuss on Telegram</p>
          </div>
          <p className="text-xs md:text-sm text-cyan-200/85 font-sans">t.me/nopause_org</p>
          <p className="text-[11px] md:text-xs text-muted-foreground font-sans mt-1">Community chat &amp; feedback</p>
        </button>
      </div>

    </div>
  );
}
