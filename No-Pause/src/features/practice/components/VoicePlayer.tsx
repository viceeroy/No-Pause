import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface VoicePlayerProps {
  audioBlob: Blob;
  audioMimeType?: string;
  className?: string;
}

const BAR_COUNT = 32;

function generateWaveformBars(count: number): number[] {
  // Generate a natural-looking waveform pattern
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const position = i / count;
    // Create a natural speech-like envelope
    const envelope = Math.sin(position * Math.PI) * 0.6 + 0.4;
    const noise = 0.3 + Math.random() * 0.7;
    bars.push(envelope * noise);
  }
  return bars;
}

export const VoicePlayer = ({ audioBlob, audioMimeType, className }: VoicePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform] = useState(() => generateWaveformBars(BAR_COUNT));
  const waveformRef = useRef<HTMLDivElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const playbackBlob = audioMimeType && audioBlob.type !== audioMimeType
      ? new Blob([audioBlob], { type: audioMimeType })
      : audioBlob;
    const url = URL.createObjectURL(playbackBlob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    });
    audio.addEventListener('durationchange', () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    });
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.pause();
      audio.src = '';
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [audioBlob]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const container = waveformRef.current;
    if (!audio || !container || !duration) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 sm:gap-4 bg-foreground/[0.03] backdrop-blur-sm border border-border/60 rounded-2xl sm:rounded-full px-4 sm:px-5 py-3 sm:py-3.5 transition-all",
      className
    )}>
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-all hover:brightness-110 active:scale-95 shadow-md"
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Time */}
      <span className="flex-shrink-0 text-xs font-mono text-muted-foreground w-9 sm:w-10 tabular-nums">
        {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
      </span>

      {/* Waveform */}
      <div
        ref={waveformRef}
        className="flex-1 flex items-center gap-[2px] h-8 sm:h-10 cursor-pointer group min-w-0"
        onClick={seekTo}
      >
        {waveform.map((height, i) => {
          const barProgress = i / BAR_COUNT;
          const isActive = barProgress <= progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-150"
              style={{
                height: `${Math.max(16, height * 100)}%`,
                minWidth: '2px',
                backgroundColor: isActive
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--muted-foreground) / 0.2)',
              }}
            />
          );
        })}
      </div>

      {/* Volume Icon */}
      <Volume2 size={16} className="flex-shrink-0 text-muted-foreground/60 hidden sm:block" />
    </div>
  );
};
