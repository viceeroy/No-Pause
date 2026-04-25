import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, Target, Timer, Download, Instagram, Send } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { LEMON_MIN_TOTAL_SECONDS, TOPIC_MIN_TOTAL_SECONDS } from '@/features/practice/lib/scoringConstants';
import { usePWAInstall } from '@/providers/PWAInstallContext';
import { useInstallPlatform } from '@/shared/hooks/useInstallPlatform';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';

const toMMSS = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

interface CompactModeCardProps {
  title: string;
  subtitle: string;
  actionLabel: string;
  timeSeconds: number;
  onClick: () => void;
  icon: React.ElementType;
  className?: string;
  iconWrapClass?: string;
  iconClass?: string;
  actionClass?: string;
}

const CompactModeCard = ({
  title, subtitle, actionLabel, timeSeconds, onClick, icon: Icon,
  className, iconWrapClass, iconClass, actionClass,
}: CompactModeCardProps) => (
  <button
    onClick={onClick}
    className={cn(
	      'rounded-[18px] md:rounded-[22px] p-3.5 md:p-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden',
	      'min-h-[176px] md:min-h-[220px] flex flex-col items-center justify-between',
      className
    )}
  >
	    <div className={cn('p-2 md:p-2.5 rounded-xl md:rounded-2xl border', iconWrapClass)}>
	      <Icon size={16} className={iconClass} />
	    </div>
	    <div className="mt-2 md:mt-3">
	      <h3 className="text-sm md:text-lg font-serif text-foreground leading-tight">{title}</h3>
	      <p className="text-[11px] md:text-sm text-muted-foreground font-sans leading-tight mt-1">{subtitle}</p>
	    </div>
	    <div className={cn(
	      'mt-2 md:mt-3 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-sans font-semibold border',
	      actionClass
	    )}>
      {actionLabel}
    </div>
	    <div className="mt-2 md:mt-3">
	      <p className="text-base md:text-xl font-serif font-semibold text-foreground leading-none">
        {Math.floor(timeSeconds / 60)}
        <span className="ml-1 text-xs md:text-sm font-sans font-semibold text-muted-foreground/80">m</span>
        <span className="ml-2">
          {timeSeconds % 60}
          <span className="ml-1 text-xs md:text-sm font-sans font-semibold text-muted-foreground/80">s</span>
        </span>
      </p>
	      <p className="text-[9px] md:text-[10px] text-muted-foreground font-sans uppercase tracking-[0.14em] mt-1">Time Limit</p>
    </div>
  </button>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();

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
          onClick={() => handleCardClick('free')}
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

        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <CompactModeCard
            onClick={() => handleCardClick('lemon')}
            icon={Timer}
            title="Lemon Technique"
            subtitle={`${toMMSS(LEMON_MIN_TOTAL_SECONDS)} pressure speak`}
            actionLabel="Random word"
            timeSeconds={LEMON_MIN_TOTAL_SECONDS}
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
            timeSeconds={TOPIC_MIN_TOTAL_SECONDS}
            className="bg-gradient-to-b from-cyan-500/12 to-surface-primary border border-cyan-400/40 shadow-card"
            iconWrapClass="bg-cyan-500/18 border-cyan-400/35"
            iconClass="text-cyan-300"
            actionClass="bg-surface-interactive border-cyan-400/35 text-cyan-300"
          />
        </div>
      </div>

      {/* Stats */}
	      <div className="mb-8">
	        <div
	          onClick={() => navigate('/practice?mode=readingchallenge')}
	          className="rounded-[20px] md:rounded-[24px] bg-gradient-to-b from-surface-card to-surface-elevated border border-border/80 shadow-card p-4 md:p-8 text-left md:text-center cursor-pointer card-hover btn-press relative overflow-hidden group flex items-center md:block gap-4"
	        >
	          <div className="flex justify-center md:mb-4 shrink-0">
	            <div className="relative w-14 h-14 md:w-24 md:h-24 rounded-full flex items-center justify-center bg-secondary transition-transform duration-300 group-hover:scale-110 night-glow">
	              <div className="absolute inset-0 rounded-full animate-pulse bg-primary opacity-30"></div>
	              <BookOpen size={24} className="md:hidden text-primary relative z-10" />
	              <BookOpen size={44} className="hidden md:block text-primary relative z-10" />
	            </div>
	          </div>
	          <div className="min-w-0">
	            <h3 className="text-lg md:text-2xl font-serif text-foreground mb-1">Reading Challenge</h3>
	            <p className="text-xs md:text-base text-muted-foreground font-sans">Read a passage with clarity</p>
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
