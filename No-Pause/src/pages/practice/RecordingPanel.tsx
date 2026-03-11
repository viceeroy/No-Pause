import { FileText, Mic, Square, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceVisualizer } from '@/components/VoiceVisualizer';
import type { AudioDataPayload } from '@/lib/speechAnalyzer';
import type { LemonPrompt, TopicPrompt } from '@/lib/promptService';
import { formatTime } from './time';

type RecordingPanelProps = {
  mode: string;
  timeLeft: number;
  elapsedTime: number;
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
  lemonPrompt,
  topicPrompt,
  audioData,
  soundDetected,
  stopRecording,
}: RecordingPanelProps) {
  const isPromptMode = mode === 'lemon' || mode === 'topic';

  return (
    <div className={cn(
      'flex-1 flex flex-col items-center max-w-2xl mx-auto animate-in fade-in duration-700 overflow-hidden',
      isPromptMode ? 'pb-6 pt-2' : 'pb-20'
    )}>
      <div className="w-full shrink-0">
        {mode === 'lemon' && (
          <div className={cn(
            'bg-ember-200/10 border-2 border-ember-500/35 rounded-[28px] shadow-card relative overflow-hidden',
            isPromptMode ? 'p-4 md:p-8' : 'p-6 md:p-10'
          )}>
            <div className={cn('absolute top-0 right-0', isPromptMode ? 'p-3 md:p-4' : 'p-4 md:p-6')}>
              <div className={cn(
                'flex items-center gap-2 bg-ember-500 text-slate-950 rounded-full font-bold font-sans shadow-sm',
                isPromptMode ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
              )}>
                <Timer size={14} className="animate-pulse" /> {formatTime(timeLeft)}
              </div>
            </div>
            <p className="text-[10px] text-ember-600 uppercase tracking-widest font-black mb-3">Topic focus:</p>
            <div className="text-3xl md:text-4xl font-serif font-bold text-foreground">{lemonPrompt?.word}</div>
          </div>
        )}
        {mode === 'topic' && topicPrompt && (
          <div className={cn(
            'bg-cyan-500/10 border-2 border-cyan-400/35 rounded-[28px] shadow-card relative overflow-hidden',
            isPromptMode ? 'p-5 md:p-8' : 'p-10'
          )}>
            <div className={cn('absolute top-0 right-0', isPromptMode ? 'p-3 md:p-4' : 'p-6')}>
              <div className={cn(
                'flex items-center gap-2 bg-cyan-500 text-slate-950 rounded-full font-bold font-sans shadow-sm',
                isPromptMode ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
              )}>
                <Timer size={14} className="animate-pulse" /> {formatTime(timeLeft)}
              </div>
            </div>
            <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-black mb-3">Responding to:</p>
            <div className="text-lg md:text-2xl font-serif font-medium text-foreground leading-snug">{topicPrompt.topicTitle}</div>
          </div>
        )}
        {mode === 'free' && (
          <div className="p-6 md:p-10 bg-surface-card border-2 border-border/70 rounded-[32px] shadow-card relative overflow-hidden text-center">
            <div className="absolute top-0 right-0 p-4 md:p-6">
              <div className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-bold font-sans shadow-sm">
                <Timer size={16} className="animate-pulse" /> {formatTime(elapsedTime)}
              </div>
            </div>
            <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-3">Free Speak</p>
            <p className="text-lg font-serif text-foreground italic">"Maintain your flow and speak freely..."</p>
          </div>
        )}
      </div>

      <div className="w-full flex-1 flex flex-col justify-center min-h-0">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className={cn('w-2.5 h-2.5 rounded-full', soundDetected ? 'bg-primary animate-pulse shadow-[0_0_12px_rgba(230,140,106,0.65)]' : 'bg-muted-foreground/40')}></div>
          <p className="text-[10px] font-black text-muted-foreground font-sans uppercase tracking-[0.2em]">
            {soundDetected ? 'Recording Active' : 'Waiting for sound'}
          </p>
        </div>
        <div className={cn(
          'relative flex items-center justify-center bg-surface-card border border-border/80 rounded-[40px] shadow-inner overflow-hidden',
          isPromptMode ? 'h-28 md:h-40' : 'h-32 md:h-44'
        )}>
          {audioData ? (
            <VoiceVisualizer frequencyData={audioData.frequencyData} volume={audioData.volume} isSilent={audioData.isSilent} isRecording={true} />
          ) : (
            <Mic size={40} className="text-muted-foreground/50 animate-pulse" />
          )}
          <div className="absolute bottom-3 right-6 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50">
            <FileText size={12} className="text-primary animate-pulse" />
            <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">Transcribing...</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-3">
        <button
          onClick={() => void stopRecording()}
          className={cn(
            'w-full md:w-auto rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black btn-press shadow-soft night-glow flex items-center justify-center gap-4',
            isPromptMode ? 'px-10 py-3 text-base' : 'px-16 py-4 text-lg'
          )}
        >
          <Square size={20} fill="white" className="rounded-sm" /> Finish & View Results
        </button>
      </div>
    </div>
  );
}
