import { AlertTriangle, Mic, Sparkles, Timer } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { LEMON_MIN_TOTAL_SECONDS, TOPIC_MIN_TOTAL_SECONDS } from '../lib/scoringConstants';
import type { LemonPrompt, TopicPrompt } from '../lib/promptService';
import type { PracticeState, TopicDifficultyMode } from './types';
import { toMMSS } from './time';

type SetupCountdownPanelProps = {
  mode: string;
  state: PracticeState;
  transcriptError: string | null;
  showMicRetry: boolean;
  handleRetryMicrophone: () => void;
  lemonPrompt: LemonPrompt | null;
  topicPrompt: TopicPrompt | null;
  topicDifficultyMode: TopicDifficultyMode;
  handleTopicDifficultySelect: (difficultyMode: TopicDifficultyMode) => Promise<void>;
  promptLoading: boolean;
  handleRandomPrompt: () => Promise<void>;
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
  topicDifficultyMode,
  handleTopicDifficultySelect,
  promptLoading,
  handleRandomPrompt,
  canStart,
  handleStart,
  countdown,
}: SetupCountdownPanelProps) {
  const isPromptMode = mode === 'lemon' || mode === 'topic';

  return (
    <div className={cn(
      'text-center flex-1 flex flex-col justify-start',
      isPromptMode ? 'overflow-hidden pb-10' : 'overflow-y-auto pb-28'
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
            <div className="mt-4 text-left max-w-xl mx-auto">
              <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-bold mb-2">You should say:</p>
              <ul className="space-y-1">
                {topicPrompt.cueCard.map((step) => (
                  <li key={step} className="text-xs text-muted-foreground font-sans">• {step}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-bold mb-2">Difficulty Mode</p>
              <div className="flex flex-wrap justify-center gap-2">
                {(['random', 'easy', 'medium'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => void handleTopicDifficultySelect(level)}
                    disabled={promptLoading || state !== 'setup'}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                      topicDifficultyMode === level
                        ? 'bg-cyan-500 text-slate-950 border-cyan-500'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/35 hover:bg-cyan-500/30'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(mode === 'lemon' || mode === 'topic') && promptLoading && (
          <p className="text-sm text-muted-foreground font-sans mt-4">Loading prompt...</p>
        )}

        {mode === 'free' && (
          <div className="py-6">
            <div className="w-20 h-20 bg-surface-card border border-border/80 rounded-full flex items-center justify-center mx-auto mb-4 night-glow">
              <Mic size={36} className="text-primary" />
            </div>
            {topicPrompt && (
              <div className="bg-surface-card border border-border/80 rounded-[28px] shadow-card p-5 md:p-7 mb-5 max-w-xl mx-auto">
                <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-2">Argue this:</p>
                <p className="text-xl md:text-2xl font-serif font-medium text-foreground leading-snug">{topicPrompt.topicTitle}</p>
              </div>
            )}
            <p className="text-lg font-serif text-foreground max-w-md mx-auto leading-relaxed">
              Speak freely without time limits. Focus on continuous speech and minimizing pauses.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 pt-3">
        {state === 'setup' ? (
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {(mode === 'lemon' || mode === 'topic') && (
              <button
                onClick={() => void handleRandomPrompt()}
                disabled={promptLoading}
                className={cn(
                  'w-full md:w-auto rounded-full bg-surface-card border border-border hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-card',
                  isPromptMode ? 'px-6 py-3 text-sm' : 'px-8 py-4'
                )}
              >
                <Sparkles size={18} className="text-primary" /> Randomize
              </button>
            )}
            <button
              onClick={() => void handleStart()}
              disabled={!canStart || promptLoading}
              className={cn(
                'w-full md:w-auto rounded-full bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-sans font-bold btn-press flex items-center justify-center gap-2 shadow-soft night-glow',
                isPromptMode ? 'px-8 py-3 text-sm' : 'px-10 py-4'
              )}
            >
              <Mic size={20} /> Start Speaking
            </button>
          </div>
        ) : (
          <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">{countdown}</div>
        )}
      </div>
    </div>
  );
}
