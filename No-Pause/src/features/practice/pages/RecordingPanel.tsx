import { Square } from 'lucide-react';
import type { AudioDataPayload } from '../lib/speechAnalyzer';
import { formatTime } from './time';

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
  const volumeLevel = Math.min(1, Math.max(audioData?.volume ?? audioData?.rms ?? 0, 0) * 28);
  const isVisuallyActive = soundDetected || volumeLevel > 0;
  const ringScale = 1 + volumeLevel * 0.18;
  const ringOpacity = (isVisuallyActive ? 0.45 : 0.28) + volumeLevel * 0.45;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-between overflow-hidden pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center animate-in fade-in duration-700 md:pb-12">
      <div className="flex min-h-[92px] w-full shrink-0 flex-col items-center justify-center md:min-h-[128px]">
        <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">
          Free Speaking
        </p>
        <p className="font-serif font-medium text-foreground leading-tight text-balance max-w-4xl text-2xl md:text-5xl lg:text-6xl">
          {promptText || 'Speak freely'}
        </p>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        <div
          className="relative flex h-64 w-64 items-center justify-center rounded-full bg-primary/10 md:h-80 md:w-80"
          aria-label="Recording in progress"
        >
          <div
            className="absolute inset-0 rounded-full border-2 border-primary transition-all duration-150 ease-out"
            style={{ opacity: ringOpacity, transform: `scale(${ringScale})` }}
          />
          <div className="relative z-10 flex h-44 w-44 flex-col items-center justify-center rounded-full border border-border bg-surface-card shadow-card md:h-56 md:w-56">
            <div className="font-serif text-5xl font-medium leading-none text-primary md:text-7xl">
              {formatTime(timerValue)}
            </div>
            <p className="mt-3 text-xs font-sans font-bold uppercase tracking-widest text-muted-foreground">Recording</p>
          </div>
        </div>
      </div>

      <div className="w-full shrink-0 pt-5 md:w-auto md:pt-7">
        <button
          onClick={() => void stopRecording()}
          className="flex w-full items-center justify-center gap-4 rounded-full bg-primary px-10 py-4 text-base font-sans font-black text-primary-foreground shadow-soft btn-press hover:brightness-110 md:w-auto sm:px-16 sm:text-lg"
        >
          <Square size={20} fill="currentColor" className="rounded-sm" /> Finish & View Results
        </button>
      </div>
    </div>
  );
}
