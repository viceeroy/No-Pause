import { AlertTriangle, Clock, ListChecks, Shuffle } from 'lucide-react';
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
  handleOpenPrompts: () => void;
  handleRandomPrompt: () => void;
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
  handleOpenPrompts,
  handleRandomPrompt,
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
          <div className={cn(
            'flex w-full flex-col items-center rounded-[28px] border border-border bg-surface-card px-5 py-8 shadow-card md:px-10 md:py-12',
            promptText && 'justify-center md:min-h-[300px]'
          )}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary">Speaking Mode</p>
            <p className={cn(
              'mx-auto font-serif font-medium leading-tight text-balance text-foreground',
              promptText
                ? 'text-2xl md:text-5xl lg:text-6xl max-w-4xl mx-auto'
                : 'text-3xl md:text-5xl lg:text-6xl'
            )}>
              {promptText || 'Speak freely'}
            </p>
            {!promptText && (
              <div className="mx-auto mt-8 flex max-w-sm flex-col gap-2 text-left">
                {['Set a timer', 'Add a prompt', 'Get a random prompt'].map((tip) => (
                  <div
                    key={tip}
                    className="flex items-center justify-center gap-2 text-xs font-sans font-semibold text-muted-foreground md:text-sm"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex w-full flex-col items-center gap-4 pb-2 pt-6 md:pb-6">
            {state === 'setup' && (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 md:flex-nowrap md:gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTimerMenuOpen(!timerMenuOpen)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-border bg-surface-card px-3.5 py-2 text-xs font-sans font-semibold text-muted-foreground transition-colors btn-press hover:bg-surface-elevated hover:text-foreground md:min-h-[46px] md:px-5 md:text-sm"
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={handleOpenPrompts}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-border bg-surface-card px-3.5 py-2 text-xs font-sans font-semibold text-muted-foreground transition-colors btn-press hover:bg-surface-elevated hover:text-foreground md:min-h-[46px] md:px-5 md:text-sm"
                    >
                      <ListChecks size={15} className="shrink-0 text-primary" />
                      Prompts
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRandomPrompt}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-border bg-surface-card px-3.5 py-2 text-xs font-sans font-semibold text-muted-foreground transition-colors btn-press hover:bg-surface-elevated hover:text-foreground md:min-h-[46px] md:px-5 md:text-sm"
                  >
                    <Shuffle size={15} className="shrink-0 text-primary" />
                    Random
                  </button>
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

      {state === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">{countdown}</div>
        </div>
      )}
    </div>
  );
}
