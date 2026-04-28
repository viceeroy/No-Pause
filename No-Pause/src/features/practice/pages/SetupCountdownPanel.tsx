import { AlertTriangle, Clock, FileText, Shuffle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PracticeState } from './types';

type SetupCountdownPanelProps = {
  state: PracticeState;
  transcriptError: string | null;
  showMicRetry: boolean;
  handleRetryMicrophone: () => void;
  handlePromptClick: () => void;
  handleRandomFreePrompt: () => Promise<void>;
  timerLabel: string;
  timerMenuOpen: boolean;
  setTimerMenuOpen: (open: boolean) => void;
  setSelectedTimerSeconds: (seconds: number) => void;
  timerOptions: { label: string; seconds: number }[];
  promptText: string;
  randomPromptLoading: boolean;
  handleStart: () => Promise<void>;
  countdown: number;
};

export function SetupCountdownPanel({
  state,
  transcriptError,
  showMicRetry,
  handleRetryMicrophone,
  handlePromptClick,
  handleRandomFreePrompt,
  timerLabel,
  timerMenuOpen,
  setTimerMenuOpen,
  setSelectedTimerSeconds,
  timerOptions,
  promptText,
  randomPromptLoading,
  handleStart,
  countdown,
}: SetupCountdownPanelProps) {
  return (
    <div className={cn(
      'text-center flex-1 flex flex-col justify-start',
      'overflow-visible pb-6 md:pb-8'
    )}>
      {transcriptError && (
        <div className="mb-4 p-3 bg-orange-950/40 border border-orange-500/40 rounded-2xl w-full max-w-md mx-auto shrink-0">
          <div className="flex items-center gap-2 text-orange-200 mb-1">
            <AlertTriangle size={16} />
            <span className="font-sans font-semibold text-sm">Warning</span>
          </div>
          <p className="text-orange-200/90 text-sm font-sans">{transcriptError}</p>
          {showMicRetry && (
            <button
              onClick={handleRetryMicrophone}
              className="mt-3 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-100 text-sm font-sans font-semibold btn-press hover:bg-orange-500/30"
            >
              Retry microphone
            </button>
          )}
        </div>
      )}

      <div className={cn('transition-all duration-500 flex-1 flex flex-col justify-start min-h-0', state === 'countdown' && 'opacity-30 scale-95 blur-[2px]')}>
        <div className="flex min-h-[calc(100dvh-230px)] flex-col items-center justify-start py-1 md:min-h-[calc(100dvh-260px)] md:py-8">
          <div className="mb-8 min-h-[78px] w-full md:mb-12 md:min-h-[120px]">
            <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">Prompt</p>
            <p className={cn(
              'font-serif font-medium text-foreground leading-tight text-balance',
              promptText
                ? 'text-2xl md:text-5xl lg:text-6xl max-w-4xl mx-auto'
                : 'text-3xl md:text-5xl lg:text-6xl'
            )}>
              {promptText || 'Speak freely'}
            </p>
          </div>
          <div className="flex w-full flex-1 flex-col items-center justify-end pb-2 md:pb-6">
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
                  <button
                    type="button"
                    onClick={handlePromptClick}
                    className="min-h-10 rounded-full bg-surface-card border border-border px-3 py-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated btn-press transition-colors inline-flex items-center gap-1.5 md:min-h-11 md:px-4 md:text-sm md:gap-2"
                  >
                    <FileText size={15} className="text-primary shrink-0" />
                    Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRandomFreePrompt()}
                    disabled={randomPromptLoading}
                    className="min-h-10 rounded-full bg-surface-card border border-border px-3 py-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed btn-press transition-colors inline-flex items-center gap-1.5 md:min-h-11 md:px-4 md:text-sm md:gap-2"
                  >
                    <Shuffle size={15} className="text-primary shrink-0" />
                    Random
                  </button>
                </div>
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    className="w-full md:w-auto rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black btn-press shadow-soft night-glow flex items-center justify-center gap-4 px-10 sm:px-16 py-3 sm:py-4 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
