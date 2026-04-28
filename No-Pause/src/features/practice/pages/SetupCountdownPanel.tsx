import { AlertTriangle, Clock, FileText, Mic, Shuffle, Sparkles, Timer } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '../lib/scoringConstants';
import type { LemonPrompt, TopicPrompt } from '../lib/promptService';
import type { PracticeState } from './types';
import { toMMSS } from './time';

type SetupCountdownPanelProps = {
  mode: string;
  state: PracticeState;
  transcriptError: string | null;
  showMicRetry: boolean;
  handleRetryMicrophone: () => void;
  lemonPrompt: LemonPrompt | null;
  topicPrompt: TopicPrompt | null;
  promptLoading: boolean;
  handleRandomPrompt: () => Promise<void>;
  handlePromptClick: () => void;
  handleRandomFreePrompt: () => Promise<void>;
  selectedTimerSeconds: number;
  timerLabel: string;
  timerMenuOpen: boolean;
  setTimerMenuOpen: (open: boolean) => void;
  setSelectedTimerSeconds: (seconds: number) => void;
  timerOptions: { label: string; seconds: number }[];
  promptText: string;
  randomPromptLoading: boolean;
  canStart: boolean;
  handleStart: () => Promise<void>;
  countdown: number;
};

export function SetupCountdownPanel({
  mode,
  state,
  transcriptError,
  showMicRetry,
  handleRetryMicrophone,
  lemonPrompt,
  topicPrompt,
  promptLoading,
  handleRandomPrompt,
  handlePromptClick,
  handleRandomFreePrompt,
  selectedTimerSeconds,
  timerLabel,
  timerMenuOpen,
  setTimerMenuOpen,
  setSelectedTimerSeconds,
  timerOptions,
  promptText,
  randomPromptLoading,
  canStart,
  handleStart,
  countdown,
}: SetupCountdownPanelProps) {
  const isPromptMode = mode === 'lemon' || mode === 'topic';

  return (
    <div className={cn(
      'text-center flex-1 flex flex-col justify-start',
	      isPromptMode ? 'overflow-y-auto scrollbar-hidden pb-10' : 'overflow-y-auto scrollbar-hidden pb-28'
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

      <div className={cn('transition-all duration-500 flex-1 flex flex-col justify-start md:justify-center min-h-0', state === 'countdown' && 'opacity-30 scale-95 blur-[2px]')}>
        {mode === 'lemon' && (
          <div className={cn(
            'bg-ember-200/10 border border-ember-500/35 rounded-[28px] shadow-card',
            isPromptMode ? 'p-4 md:p-8' : 'p-6 md:p-10'
          )}>
            <p className="text-[10px] text-ember-600 uppercase tracking-widest font-bold mb-2">You will speak about:</p>
            <div className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3">{lemonPrompt?.word || 'Loading...'}</div>
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              <span className="px-3 py-1 bg-ember-300/25 text-ember-600 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-ember-500/30">{lemonPrompt?.category || 'Object'}</span>
              <span className="px-3 py-1 bg-ember-300/25 text-ember-600 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-ember-500/30">{toMMSS(LEMON_MIN_TOTAL_SECONDS)} total</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-ember-300/25 text-ember-600 rounded-full text-xs font-sans font-bold border border-ember-500/30 mb-2">
              <Timer size={16} /> {toMMSS(LEMON_MIN_TOTAL_SECONDS)} Session Target
            </div>
          </div>
        )}

        {mode === 'topic' && topicPrompt && (
          <div className={cn(
            'bg-cyan-500/10 border border-cyan-400/35 rounded-[28px] shadow-card',
            isPromptMode ? 'p-4 md:p-8' : 'p-6 md:p-10'
          )}>
            <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-bold mb-2">You will speak about:</p>
            <div className="text-lg md:text-2xl font-serif font-medium text-foreground leading-snug mb-3">{topicPrompt.topicTitle}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-cyan-400/35">{topicPrompt.category}</span>
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-cyan-400/35">{topicPrompt.difficulty}</span>
              <span className="px-3 py-1 bg-cyan-500 text-slate-950 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                <Timer size={12} /> {toMMSS(TOPIC_MIN_TOTAL_SECONDS)}
              </span>
            </div>
	            <div className="mt-3 text-left max-w-xl mx-auto">
	              <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-bold mb-2">You should say:</p>
	              <ul className="space-y-0.5">
	                {topicPrompt.cueCard.map((step) => (
	                  <li key={step} className="text-xs text-muted-foreground font-sans leading-snug">• {step}</li>
	                ))}
	              </ul>
	            </div>
          </div>
        )}

        {(mode === 'lemon' || mode === 'topic') && promptLoading && (
          <p className="text-sm text-muted-foreground font-sans mt-4">Loading prompt...</p>
        )}

        {mode === 'free' && (
          <div className="py-4 md:py-6">
            <div className="mb-4 min-h-[52px]">
              {promptText ? (
                <>
                  <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">Prompt</p>
                  <p className="text-2xl md:text-4xl font-serif font-medium text-foreground leading-tight max-w-2xl mx-auto">{promptText}</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">Prompt</p>
                  <p className="text-2xl md:text-4xl font-serif font-medium text-foreground leading-tight">Speak freely</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!canStart || promptLoading}
              className="w-24 h-24 md:w-28 md:h-28 bg-surface-card border border-border/80 rounded-full flex items-center justify-center mx-auto mb-2 night-glow btn-press hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Start speaking"
            >
              <Mic size={36} className="text-primary" />
            </button>
            {state === 'setup' && (
              <>
                <p className="mb-4 text-xs md:text-sm font-sans text-muted-foreground/70">
                  Tap the mic to start speaking
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTimerMenuOpen(!timerMenuOpen)}
                      className="min-h-10 rounded-full bg-surface-card border border-border px-3.5 py-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated btn-press transition-colors inline-flex items-center gap-2"
                    >
                      <Clock size={15} className="text-primary" />
                      {timerLabel}
                    </button>
                    {timerMenuOpen && (
                      <div className="absolute left-1/2 bottom-full z-20 mb-2 w-36 -translate-x-1/2 rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-float">
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
                    className="min-h-10 rounded-full bg-surface-card border border-border px-3.5 py-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated btn-press transition-colors inline-flex items-center gap-2"
                  >
                    <FileText size={15} className="text-primary" />
                    Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRandomFreePrompt()}
                    disabled={randomPromptLoading}
                    className="min-h-10 rounded-full bg-surface-card border border-border px-3.5 py-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed btn-press transition-colors inline-flex items-center gap-2"
                  >
                    <Shuffle size={15} className="text-primary" />
                    Random
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 pt-3">
        {state === 'setup' ? (
          <div className="flex flex-col items-center justify-center gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 w-full">
              {(mode === 'lemon' || mode === 'topic') && (
                <button
                  onClick={() => void handleRandomPrompt()}
                  disabled={promptLoading}
                  className={cn(
                    'w-full md:w-auto rounded-full bg-surface-card border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-card',
	                    isPromptMode ? 'min-h-11 px-6 py-2.5 text-sm' : 'min-h-11 px-8 py-3'
                  )}
                >
                  <Sparkles size={18} className="text-primary" /> Randomize
                </button>
              )}
              {mode !== 'free' && (
                <button
                  onClick={() => void handleStart()}
                  disabled={!canStart || promptLoading}
                  className={cn(
                    'w-full md:w-auto rounded-full bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-soft night-glow',
                    isPromptMode ? 'min-h-11 px-8 py-2.5 text-sm' : 'min-h-11 px-10 py-3'
                  )}
                  aria-label="Start speaking"
                >
                  <Mic size={20} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">{countdown}</div>
        )}
      </div>
    </div>
  );
}
