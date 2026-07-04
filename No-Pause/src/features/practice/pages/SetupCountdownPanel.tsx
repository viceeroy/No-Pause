import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, ListChecks, Shuffle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PracticeState } from './types';

export type StartSelection =
  | { type: 'free' }
  | { type: 'prompt'; text: string };

type SetupCountdownPanelProps = {
  state: PracticeState;
  transcriptError: string | null;
  showMicRetry: boolean;
  handleRetryMicrophone: () => void;
  timerLabel: string;
  timerMenuOpen: boolean;
  setTimerMenuOpen: (open: boolean) => void;
  selectedTimerSeconds: number;
  setSelectedTimerSeconds: (seconds: number) => void;
  timerOptions: { label: string; seconds: number }[];
  promptText: string;
  prompts: string[];
  onStart: (selection: StartSelection) => void;
  onOpenPrompts: () => void;
  countdown: number;
};

const pillBase =
  'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-sans font-semibold transition-colors btn-press md:min-h-[46px] md:px-5 md:text-sm';
const pillActive = 'border-primary bg-primary/10 text-foreground';
const pillIdle =
  'border-border bg-surface-card text-muted-foreground hover:bg-surface-elevated hover:text-foreground';

export function SetupCountdownPanel({
  state,
  transcriptError,
  showMicRetry,
  handleRetryMicrophone,
  timerLabel,
  timerMenuOpen,
  setTimerMenuOpen,
  selectedTimerSeconds,
  setSelectedTimerSeconds,
  timerOptions,
  promptText,
  prompts,
  onStart,
  onOpenPrompts,
  countdown,
}: SetupCountdownPanelProps) {
  // Card 0 = free speak, cards 1…N = one prompt each.
  // A picked prompt (from /prompts) arrives via promptText — surface it as the first prompt card.
  const slides = useMemo(() => {
    const ordered = promptText
      ? [promptText, ...prompts.filter((p) => p !== promptText)]
      : prompts;
    return ['__free__', ...ordered];
  }, [prompts, promptText]);

  const [activeIndex, setActiveIndex] = useState(promptText ? 1 : 0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [nudgeOffset, setNudgeOffset] = useState(0);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const wheelLockRef = useRef(false);
  const wheelAccumRef = useRef(0);
  const wheelQuietRef = useRef<ReturnType<typeof setTimeout>>();

  // One-time nudge: shift deck slightly left to reveal card 1's edge, then snap back.
  useEffect(() => {
    if (slides.length < 2) return;
    const t1 = setTimeout(() => setNudgeOffset(-30), 400);
    const t2 = setTimeout(() => setNudgeOffset(0), 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [slides.length]);

  // Detacher for the active drag's window listeners (set on pointerdown).
  const detachDragRef = useRef<(() => void) | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Let toggle buttons receive their click; don't hijack as a drag.
    if ((e.target as HTMLElement).closest('button')) return;
    startXRef.current = e.clientX;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setDragging(true);

    // Attach move/up on window SYNCHRONOUSLY (no render gap) so a fast flick's
    // pointerup is never missed — that race is what glued the card to the cursor.
    const onMove = (ev: PointerEvent) => {
      const offset = ev.clientX - startXRef.current;
      dragOffsetRef.current = offset;
      setDragOffset(offset);
    };
    const onUp = () => {
      const width = containerRef.current?.offsetWidth ?? 1;
      const threshold = Math.min(60, width * 0.2);
      const offset = dragOffsetRef.current;
      setActiveIndex((idx) => {
        if (offset <= -threshold) return Math.min(idx + 1, slides.length - 1);
        if (offset >= threshold) return Math.max(idx - 1, 0);
        return idx;
      });
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setDragging(false);
      detachDragRef.current?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    detachDragRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      detachDragRef.current = null;
    };
  };

  // Safety: drop any dangling drag listeners / timers on unmount.
  useEffect(
    () => () => {
      detachDragRef.current?.();
      clearTimeout(wheelQuietRef.current);
    },
    []
  );

  // Trackpad two-finger horizontal swipe. Trackpads emit many small deltaX
  // events per swipe — plus an inertial momentum tail after the fingers lift.
  // Accumulate until threshold, fire ONCE, then lock until the wheel stream
  // goes quiet (150ms gap = gesture truly ended). The momentum tail keeps
  // resetting the quiet timer, so one physical swipe = one card (no double-skip).
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical intent
    // Any horizontal wheel event (incl. momentum) defers the unlock.
    clearTimeout(wheelQuietRef.current);
    wheelQuietRef.current = setTimeout(() => {
      wheelLockRef.current = false;
      wheelAccumRef.current = 0;
    }, 150);
    if (wheelLockRef.current) return; // absorbing momentum after a nav
    if (Math.sign(e.deltaX) !== Math.sign(wheelAccumRef.current)) {
      wheelAccumRef.current = 0;
    }
    wheelAccumRef.current += e.deltaX;
    if (Math.abs(wheelAccumRef.current) < 40) return;
    const dir = wheelAccumRef.current > 0 ? 1 : -1;
    wheelAccumRef.current = 0;
    wheelLockRef.current = true;
    setActiveIndex((i) =>
      dir > 0 ? Math.min(i + 1, slides.length - 1) : Math.max(i - 1, 0)
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, slides.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleStartClick();
    }
  };

  const showRandomPrompt = () => {
    const promptCount = slides.length - 1;
    if (promptCount < 1) return;
    let next = 1 + Math.floor(Math.random() * promptCount);
    if (promptCount > 1 && next === activeIndex) {
      next = next === slides.length - 1 ? 1 : next + 1;
    }
    setActiveIndex(next);
  };

  const handleStartClick = () => {
    if (activeIndex === 0) onStart({ type: 'free' });
    else onStart({ type: 'prompt', text: slides[activeIndex] });
  };

  return (
    <div className={cn('flex flex-1 flex-col justify-start overflow-visible pb-6 text-center md:pb-8')}>
      {transcriptError && (
        <div className="mx-auto mb-4 w-full max-w-md shrink-0 rounded-2xl border border-border bg-surface-card p-4 shadow-card">
          <div className="mb-1 flex items-center gap-2 text-destructive">
            <AlertTriangle size={16} />
            <span className="font-sans font-semibold text-sm">Warning</span>
          </div>
          <p className="text-sm font-sans text-muted-foreground">{transcriptError}</p>
          {showMicRetry && (
            <button
              onClick={handleRetryMicrophone}
              className="mt-3 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-sans font-semibold text-foreground btn-press hover:bg-surface-interactive"
            >
              Retry microphone
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          'transition-[opacity,transform,filter] duration-300 ease-out flex-1 flex flex-col justify-start min-h-0',
          state === 'countdown' && 'opacity-30 scale-95 blur-[2px]'
        )}
      >
        {state === 'setup' ? (
          <div className="flex min-h-[calc(100dvh-230px)] flex-col items-center justify-between py-1 md:min-h-0 md:justify-start md:gap-8 md:py-0">
            <div
              ref={containerRef}
              tabIndex={0}
              role="region"
              aria-label="Select a prompt"
              className={cn(
                'w-full overflow-hidden select-none rounded-[28px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none',
                dragging ? 'cursor-grabbing' : 'cursor-grab'
              )}
              style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
              onPointerDown={onPointerDown}
              onWheel={onWheel}
              onKeyDown={onKeyDown}
            >
              <div
                className="flex"
                style={{
                  transform: `translateX(calc(${-activeIndex * 100}% + ${dragOffset + nudgeOffset}px))`,
                  transition: dragging ? 'none' : 'transform 300ms ease',
                }}
              >
                {slides.map((slide, i) => (
                  <div key={i} className="w-full shrink-0 select-none px-1">
                    <div className="flex w-full flex-col items-center justify-center rounded-[28px] border border-border bg-surface-card px-5 py-8 shadow-card md:min-h-[300px] md:px-10 md:py-12">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary">Speaking Mode</p>
                      <p
                        className={cn(
                          'mx-auto font-serif font-medium leading-tight text-balance text-foreground',
                          i === 0
                            ? 'text-3xl md:text-5xl lg:text-6xl'
                            : 'text-2xl md:text-5xl lg:text-6xl max-w-4xl'
                        )}
                      >
                        {i === 0 ? 'Speak freely' : slide}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex w-full flex-col items-center gap-4 pb-2 pt-6 md:pt-0 md:pb-0">
              {/* Fixed control row — stays put while the carousel prompt changes. */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTimerMenuOpen(!timerMenuOpen)}
                    className={cn(pillBase, selectedTimerSeconds > 0 ? pillActive : pillIdle)}
                  >
                    <Clock size={15} className="text-primary shrink-0" />
                    {timerLabel}
                  </button>
                  {timerMenuOpen && (
                    <div className="absolute bottom-full left-1/2 z-50 mb-2 w-36 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-float">
                      {timerOptions.map((option) => (
                        <button
                          key={option.seconds}
                          type="button"
                          onClick={() => {
                            setSelectedTimerSeconds(option.seconds);
                            setTimerMenuOpen(false);
                          }}
                          className={cn(
                            'w-full rounded-xl px-3 py-2 text-left text-xs font-sans font-semibold transition-colors',
                            selectedTimerSeconds === option.seconds
                              ? 'bg-primary/15 text-foreground'
                              : 'text-muted-foreground hover:bg-surface-card hover:text-foreground'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onOpenPrompts}
                  className={cn(pillBase, activeIndex > 0 ? pillActive : pillIdle)}
                >
                  <ListChecks size={15} className="shrink-0 text-primary" />
                  Prompts
                </button>
                <button
                  type="button"
                  disabled={slides.length < 2}
                  onClick={showRandomPrompt}
                  className={cn(pillBase, pillIdle, 'disabled:cursor-not-allowed disabled:opacity-50')}
                >
                  <Shuffle size={15} className="shrink-0 text-primary" />
                  Random
                </button>
              </div>
              <button
                type="button"
                onClick={handleStartClick}
                className="flex w-full items-center justify-center gap-4 rounded-full bg-primary px-10 py-4 text-base font-sans font-black text-primary-foreground shadow-soft btn-press hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto sm:px-16 sm:text-lg"
              >
                Start Speaking
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[calc(100dvh-230px)] flex-col items-center justify-between py-1 md:min-h-0 md:justify-start md:gap-8 md:py-0">
            <div
              className={cn(
                'flex w-full flex-col items-center rounded-[28px] border border-border bg-surface-card px-5 py-8 shadow-card md:px-10 md:py-12',
                promptText && 'justify-center md:min-h-[300px]'
              )}
            >
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary">Speaking Mode</p>
              <p
                className={cn(
                  'mx-auto font-serif font-medium leading-tight text-balance text-foreground',
                  promptText
                    ? 'text-2xl md:text-5xl lg:text-6xl max-w-4xl mx-auto'
                    : 'text-3xl md:text-5xl lg:text-6xl'
                )}
              >
                {promptText || 'Speak freely'}
              </p>
            </div>
          </div>
        )}
      </div>

      {state === 'countdown' && (
        <div
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">
            {countdown}
          </div>
        </div>
      )}
    </div>
  );
}
