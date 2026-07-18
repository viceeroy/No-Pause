import { useEffect, useRef } from 'react';
import { Square } from 'lucide-react';
import { VoiceVisualizer } from '../components/VoiceVisualizer';
import type { AudioDataPayload } from '../lib/speechAnalyzer';
import { formatMMSS } from './time';

type RecordingPanelProps = {
  timeLeft: number;
  elapsedTime: number;
  selectedTimerSeconds?: number;
  promptText?: string;
  audioData: AudioDataPayload | null;
  soundDetected: boolean;
  stopRecording: () => Promise<void>;
};

export function RecordingPanel({
  timeLeft,
  elapsedTime,
  selectedTimerSeconds = 0,
  promptText,
  audioData,
  soundDetected,
  stopRecording,
}: RecordingPanelProps) {
  const timerValue = selectedTimerSeconds > 0 ? timeLeft : elapsedTime;
  const isSilent = audioData?.isSilent ?? !soundDetected;

  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        const target = e.target as HTMLElement;
        if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) {
          return;
        }
        e.preventDefault();
        void stopRecordingRef.current();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-between overflow-hidden pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center animate-in fade-in duration-700 md:pb-12">
      <div className="flex min-h-[92px] w-full shrink-0 flex-col items-center justify-center md:min-h-[128px]">
        <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">
          Speaking Mode
        </p>
        <p className="font-serif font-medium text-foreground leading-tight text-balance max-w-4xl text-2xl md:text-5xl lg:text-6xl">
          {promptText || 'Speak freely'}
        </p>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        <div
          className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-border bg-surface-card p-5 shadow-card md:p-8"
          aria-label="Recording in progress"
        >
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 mb-6 flex items-center justify-between gap-4">
            <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 text-xs font-sans font-black uppercase tracking-widest text-foreground shadow-card">
              <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
              Recording
            </div>
            <div className="font-serif text-4xl font-medium leading-none text-primary md:text-6xl">
              {formatMMSS(timerValue)}
            </div>
          </div>
          <div className="relative z-10 overflow-hidden rounded-[22px] border border-border bg-surface-elevated px-2 py-5 shadow-[0_0_36px_hsl(var(--primary)/0.08)] md:px-4 md:py-8">
            <div className="h-28 md:h-36">
              <VoiceVisualizer
                frequencyData={audioData?.frequencyData}
                volume={audioData?.volume}
                isSilent={isSilent}
                isRecording
              />
            </div>
          </div>
          <p className="relative z-10 mt-5 text-center text-sm font-sans font-black uppercase tracking-widest text-foreground md:text-base">
            Speak now
          </p>
        </div>
      </div>

      <div className="w-full shrink-0 pt-5 md:w-auto md:pt-7">
        <button
          onClick={() => void stopRecording()}
          className="flex w-full items-center justify-center gap-4 rounded-full bg-primary px-10 py-4 text-base font-sans font-black text-primary-foreground shadow-soft btn-press hover:brightness-110 md:w-auto sm:px-16 sm:text-lg"
        >
          <Square size={20} fill="currentColor" className="rounded-sm" />
          <span>Finish & View Results</span>
          <span className="hidden opacity-70 md:inline ml-1.5 font-mono text-xs">[Space]</span>
        </button>
      </div>
    </div>
  );
}
