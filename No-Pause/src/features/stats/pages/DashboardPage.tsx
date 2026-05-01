import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Download, Activity, Send, CircleUser, Coffee, TrendingUp, Clock, type LucideIcon } from 'lucide-react';
import { usePWAInstall } from '@/providers/PWAInstallContext';
import { useInstallPlatform } from '@/shared/hooks/useInstallPlatform';
import { useAuth } from '@/providers/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';

const infoCards: Array<{
  title: string;
  text: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Speak more',
    text: 'Build consistency with short daily speaking sessions.',
    icon: Mic,
  },
  {
    title: 'Reduce pauses',
    text: 'Try to keep speaking without long silent gaps.',
    icon: Activity,
  },
  {
    title: 'Use Telegram',
    text: 'Practice from Telegram with quick voice notes.',
    icon: Send,
  },
  {
    title: 'See stats via avatar',
    text: 'Tap your avatar to view progress and recent sessions.',
    icon: CircleUser,
  },
  {
    title: 'Everyday speaking',
    text: 'Practice real-life answers, not perfect speeches.',
    icon: Coffee,
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deferredPrompt, isInstallable, triggerInstall } = usePWAInstall();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { isIos, isAndroid, isDesktop, isAndroidChrome, isInstallEligible, isInstalled } = useInstallPlatform();

  const handleCardClick = () => {
    navigate('/practice/free-speaking');
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

  return (
    <div className="min-h-dvh bg-surface-base px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 md:px-12 md:pb-16 md:pt-8 lg:px-20">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col">
        <div className="mb-6 flex items-start justify-between gap-4 md:mb-10">
          <div className="min-w-0 text-left">
            <p className="mb-2 text-xs font-sans font-black uppercase tracking-widest text-primary">Free Speaking</p>
            <h1 className="mb-2 text-4xl font-serif font-medium tracking-tight text-foreground md:text-6xl">No Pause</h1>
            <h2 className="max-w-xl text-sm font-sans leading-relaxed text-muted-foreground md:text-lg">
              Minimal speech practice for smoother flow.
            </h2>
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
                <span>{initials}</span>
              )}
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6">
          <button
            type="button"
            onClick={handleCardClick}
            className="group flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-border bg-surface-card p-7 text-center shadow-card transition-all btn-press hover:bg-surface-elevated md:min-h-[560px] md:p-12"
          >
            <div className="relative mb-8 flex h-44 w-44 items-center justify-center rounded-full border border-primary/20 bg-primary/10 md:h-64 md:w-64">
              <div className="absolute inset-5 rounded-full border border-primary/30" />
              <div className="absolute inset-10 rounded-full bg-surface-elevated shadow-card transition-transform duration-300 group-hover:scale-105" />
              <Mic size={64} className="relative z-10 text-primary md:size-24" />
            </div>
            <h3 className="mb-3 text-3xl font-serif font-medium text-foreground md:text-5xl">Start with your voice</h3>
            <p className="max-w-md text-sm font-sans leading-relaxed text-muted-foreground md:text-base">
              Open Free Speaking, record a short session, then review Flow Score and pauses.
            </p>
          </button>

          <div className="grid gap-3 md:gap-4">
            <article className="rounded-[22px] border border-border bg-surface-card p-5 shadow-card">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs font-sans font-bold uppercase tracking-widest text-muted-foreground">Today</p>
                <TrendingUp size={18} className="text-primary" />
              </div>
              <p className="text-5xl font-serif font-medium leading-none text-primary">86</p>
              <p className="mt-2 text-sm font-sans text-muted-foreground">Flow Score target</p>
            </article>
            <article className="rounded-[22px] border border-border bg-surface-card p-5 shadow-card">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs font-sans font-bold uppercase tracking-widest text-muted-foreground">Practice</p>
                <Clock size={18} className="text-primary" />
              </div>
              <p className="text-4xl font-serif font-medium leading-none text-foreground">5 min</p>
              <p className="mt-2 text-sm font-sans text-muted-foreground">A short session is enough.</p>
            </article>
          </div>
        </div>

        <section aria-labelledby="next-steps-heading" className="mt-5 md:mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="next-steps-heading" className="text-base font-serif font-medium text-foreground md:text-xl">
              What to do next
            </h2>
          </div>
          <div className="-mx-5 overflow-x-auto px-5 pb-2 scrollbar-hidden md:mx-0 md:px-0 md:overflow-visible">
            <div className="flex w-max gap-3 md:w-full">
              {infoCards.map(({ title, text, icon: Icon }) => (
                <article
                  key={title}
                  aria-labelledby={`next-step-${title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="min-h-[118px] w-[218px] shrink-0 rounded-[18px] border border-border bg-surface-card p-4 shadow-card md:w-auto md:min-w-0 md:flex-1"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-primary">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <h3
                    id={`next-step-${title.toLowerCase().replace(/\s+/g, '-')}`}
                    className="mb-1 text-sm md:text-base font-serif font-medium leading-tight text-foreground"
                  >
                    {title}
                  </h3>
                  <p className="text-xs md:text-sm font-sans leading-snug text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
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
                    3. If no prompt appears, open Chrome menu and choose "Add to Home screen"
                  </>
                ) : isDesktop ? (
                  <>Click Install in your browser prompt.</>
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
