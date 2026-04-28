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
    <div className="flex-1 flex flex-col items-center justify-start text-center max-w-4xl mx-auto animate-in fade-in duration-700 overflow-hidden pb-10 md:pb-20">
      <div className="w-full shrink-0 min-h-[72px] md:min-h-[120px] flex flex-col items-center justify-center mb-5 md:mb-10">
        <p className="text-[10px] text-primary uppercase tracking-widest font-black mb-1.5">
          Free Speak
        </p>
        <p className="font-serif font-medium text-foreground leading-tight text-balance max-w-4xl text-2xl md:text-5xl lg:text-6xl">
          {promptText || 'Speak freely'}
        </p>
      </div>

      <div className="w-full flex-1 flex flex-col items-center justify-start min-h-0 pt-1 md:justify-center md:pt-0">
        <div
          className="relative flex h-52 w-52 items-center justify-center rounded-full md:h-72 md:w-72"
          aria-label="Recording in progress"
        >
          <div
            className="absolute inset-0 rounded-full border-2 border-primary/60 transition-all duration-150 ease-out"
            style={{ opacity: ringOpacity, transform: `scale(${ringScale})` }}
          />
          <div className="relative z-10 font-serif text-5xl font-medium leading-none text-primary md:text-7xl">
            {formatTime(timerValue)}
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-5 md:pt-7">
        <button
          onClick={() => void stopRecording()}
          className="w-full md:w-auto rounded-full bg-primary hover:brightness-110 text-primary-foreground font-sans font-black btn-press shadow-soft night-glow flex items-center justify-center gap-4 px-10 sm:px-16 py-3 sm:py-4 text-base sm:text-lg"
        >
          <Square size={20} fill="white" className="rounded-sm" /> Finish & View Results
        </button>
      </div>
    </div>
  );
}
