import { Mic, Square, Timer } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { VoiceVisualizer } from '../components/VoiceVisualizer';
import type { AudioDataPayload } from '../lib/speechAnalyzer';
import type { LemonPrompt, TopicPrompt } from '../lib/promptService';
import { formatTime } from './time';

type RecordingPanelProps = {
  mode: string;
  timeLeft: number;
  elapsedTime: number;
  selectedTimerSeconds?: number;
  promptText?: string;
  lemonPrompt: LemonPrompt | null;
  topicPrompt: TopicPrompt | null;
  audioData: AudioDataPayload | null;
  soundDetected: boolean;
  stopRecording: () => Promise<void>;
};

export function RecordingPanel({
  mode,
  timeLeft,
  elapsedTime,
  selectedTimerSeconds = 0,
  promptText,
  lemonPrompt,
  topicPrompt,
  audioData,
  soundDetected,
  stopRecording,
}: RecordingPanelProps) {
  const isPromptMode = mode === 'lemon' || mode === 'topic';
  const displayPromptText =
    mode === 'lemon'
      ? lemonPrompt?.word
      : mode === 'topic'
        ? topicPrompt?.topicTitle
        : promptText;
  const timerValue = selectedTimerSeconds > 0 ? timeLeft : elapsedTime;

  return (
    <div className={cn(
      'flex-1 flex flex-col items-center justify-start text-center max-w-4xl mx-auto animate-in fade-in duration-700 overflow-hidden',
      isPromptMode ? 'pb-6 pt-2' : 'pb-12 md:pb-20'
    )}>
      <div className={cn(
        'w-full shrink-0 min-h-[72px] md:min-h-[120px] flex flex-col items-center justify-center',
        isPromptMode ? 'mb-4 md:mb-6' : 'mb-6 md:mb-8'
      )}>
        <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">
          {mode === 'free' ? 'Free Speak' : 'Prompt'}
        </p>
        <p className={cn(
          'font-serif font-medium text-foreground leading-tight text-balance max-w-4xl',
          mode === 'lemon'
            ? 'text-4xl md:text-6xl lg:text-7xl font-bold'
            : 'text-2xl md:text-5xl lg:text-6xl'
        )}>
          {displayPromptText || 'Speak freely'}
        </p>
      </div>

      <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0">
        <div
          className={cn(
            'relative flex h-52 w-52 items-center justify-center rounded-full border bg-surface-card shadow-card transition-all duration-500 md:h-72 md:w-72',
            soundDetected
              ? 'border-primary/45 night-glow'
              : 'border-border/80'
          )}
          aria-label="Recording in progress"
        >
          <div className={cn(
            'absolute inset-3 rounded-full border transition-colors duration-500',
            soundDetected ? 'border-primary/25' : 'border-border/50'
          )} />
          <div className={cn(
            'absolute inset-8 rounded-full transition-all duration-500',
            soundDetected ? 'bg-primary/10 blur-sm' : 'bg-muted/20'
          )} />
          <div className="absolute top-7 z-10 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-sans font-bold text-foreground shadow-sm backdrop-blur-sm md:top-9 md:px-4 md:text-sm">
            <Timer size={15} className="text-primary" />
            {formatTime(timerValue)}
          </div>
          <div className="absolute inset-x-8 bottom-14 top-20 md:inset-x-10 md:bottom-20 md:top-24">
          {audioData ? (
            <VoiceVisualizer frequencyData={audioData.frequencyData} volume={audioData.volume} isSilent={audioData.isSilent} isRecording={true} />
          ) : (
            <VoiceVisualizer isSilent={true} isRecording={true} />
          )}
          </div>
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft md:h-24 md:w-24">
            <Mic size={38} className={cn(soundDetected && 'animate-pulse')} />
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-5 md:pt-7">
        <button
          onClick={() => void stopRecording()}
          className={cn(
            'w-full md:w-auto rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black btn-press shadow-soft night-glow flex items-center justify-center gap-4',
            isPromptMode ? 'px-8 py-3 text-sm sm:text-base' : 'px-10 sm:px-16 py-3 sm:py-4 text-base sm:text-lg'
          )}
        >
          <Square size={20} fill="white" className="rounded-sm" /> Finish & View Results
        </button>
      </div>
    </div>
  );
}
