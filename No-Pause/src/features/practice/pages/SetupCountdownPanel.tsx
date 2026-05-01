import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PracticeState } from './types';

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
  handleStart: () => Promise<void>;
  countdown: number;
};

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
  handleStart,
  countdown,
}: SetupCountdownPanelProps) {
  return (
    <div className={cn(
      'flex flex-1 flex-col justify-start overflow-visible pb-6 text-center md:pb-8'
    )}>
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

      <div className={cn('transition-all duration-500 flex-1 flex flex-col justify-start min-h-0', state === 'countdown' && 'opacity-30 scale-95 blur-[2px]')}>
        <div className="flex min-h-[calc(100dvh-230px)] flex-col items-center justify-between py-1 md:min-h-[calc(100dvh-260px)] md:py-8">
          <div className="w-full rounded-[28px] border border-border bg-surface-card px-5 py-8 shadow-card md:px-10 md:py-12">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary">Free Speaking</p>
            <p className={cn(
              'mx-auto font-serif font-medium leading-tight text-balance text-foreground',
              promptText
                ? 'text-2xl md:text-5xl lg:text-6xl max-w-4xl mx-auto'
                : 'text-3xl md:text-5xl lg:text-6xl'
            )}>
              {promptText || 'Speak freely'}
            </p>
            <div className="mx-auto mt-8 flex h-36 w-36 items-center justify-center rounded-full border border-primary/20 bg-primary/10 md:h-44 md:w-44">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-card md:h-28 md:w-28">
                <span className="h-8 w-8 rounded-full bg-primary" />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-center gap-4 pb-2 pt-6 md:pb-6">
            {state === 'setup' && (
              <>
                <div className="flex flex-nowrap items-center justify-center gap-2 md:gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTimerMenuOpen(!timerMenuOpen)}
                      className="min-h-10 rounded-full bg-surface-card border border-border px-3 py-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated btn-press transition-colors inline-flex items-center gap-1.5 md:min-h-11 md:px-4 md:text-sm md:gap-2"
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
                </div>
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    className="flex w-full items-center justify-center gap-4 rounded-full bg-primary px-10 py-4 text-base font-sans font-black text-primary-foreground shadow-soft btn-press hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto sm:px-16 sm:text-lg"
                  >
                  Start Speaking
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-3">
        {state === 'countdown' && (
          <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">{countdown}</div>
        )}
      </div>
    </div>
  );
}
