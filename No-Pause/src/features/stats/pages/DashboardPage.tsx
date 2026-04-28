import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Download, Activity, Send, CircleUser, Coffee, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
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

  const handlePromptClick = (prompt: string) => {
    navigate(`/practice/free-speaking?prompt_text=${encodeURIComponent(prompt)}`);
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

        <section aria-labelledby="next-steps-heading" className="mb-3 md:mb-8">
          <div className="mb-2 md:mb-3 flex items-center justify-between gap-3">
            <h2 id="next-steps-heading" className="text-base md:text-xl font-serif font-medium text-foreground">
              What to do next
            </h2>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-hidden md:mx-0 md:px-0 md:overflow-visible">
            <div className="flex w-max gap-2.5 md:w-full md:gap-3">
              {infoCards.map(({ title, text, icon: Icon }) => (
                <article
                  key={title}
                  aria-labelledby={`next-step-${title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="min-h-[112px] w-[218px] shrink-0 rounded-[16px] border border-border/80 bg-surface-elevated p-3.5 shadow-card md:min-h-[124px] md:w-auto md:min-w-0 md:flex-1 md:p-4"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4">
            {homepagePrompts.slice(0, 4).map((prompt, index) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  className={cn(
                    'min-h-24 md:min-h-36 rounded-2xl bg-surface-elevated border border-border shadow-card p-3 md:p-5 text-left card-hover btn-press items-start',
                    index === 2 && 'hidden sm:flex',
                    index === 3 && 'hidden lg:flex',
                    index < 2 && 'flex'
                  )}
                >
                  <span className="text-sm sm:text-base md:text-2xl font-serif font-medium text-foreground leading-snug line-clamp-3">{prompt}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

    </div>
  );
}
