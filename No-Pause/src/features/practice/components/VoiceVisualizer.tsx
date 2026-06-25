import { useRef, useEffect } from 'react';

interface VoiceVisualizerProps {
  frequencyData?: number[];
  volume?: number;
  isSilent?: boolean;
  isRecording?: boolean;
}

export const VoiceVisualizer = ({ frequencyData, volume, isSilent, isRecording }: VoiceVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const smoothedHeightsRef = useRef(new Array(32).fill(4));
  const sizeRef = useRef({ width: 0, height: 0 });
  const frequencyDataRef = useRef(frequencyData);
  const volumeRef = useRef(volume);
  const isSilentRef = useRef(isSilent);

  frequencyDataRef.current = frequencyData;
  volumeRef.current = volume;
  isSilentRef.current = isSilent;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const updateSize = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      sizeRef.current = { width, height };
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const barCount = 32;
    const barWidth = 6;
    const gap = 4;
    const primaryToken = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const primaryFill = (alpha: number) => `hsl(${primaryToken} / ${alpha})`;

    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    };

    const animate = (time = 0) => {
      if (!canvas) return;
      const { width: w, height: h } = sizeRef.current;
      if (w === 0 || h === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const t = time / 1000;

      if (!isRecording) {
        const totalWidth = barCount * (barWidth + gap) - gap;
        const startX = centerX - totalWidth / 2;
        for (let i = 0; i < barCount; i++) {
          const idleHeight = 4 + Math.sin(t * 2 + i * 0.2) * 2;
          smoothedHeightsRef.current[i] += (idleHeight - smoothedHeightsRef.current[i]) * 0.08;
          const height = smoothedHeightsRef.current[i];
          const x = startX + i * (barWidth + gap);
          const y = centerY - height / 2;
          ctx.fillStyle = primaryFill(0.1);
          drawRoundedRect(ctx, x, y, barWidth, height, barWidth / 2);
        }
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const data = frequencyDataRef.current || [];
      const currentIsSilent = isSilentRef.current;
      const totalWidth = barCount * (barWidth + gap) - gap;
      const startX = centerX - totalWidth / 2;

      for (let i = 0; i < barCount; i++) {
        let targetHeight = 4;
        if (!currentIsSilent && data.length > 0) {
          const mid = barCount / 2;
          const distFromMid = Math.abs(i - mid);
          const freqIndex = Math.floor(distFromMid * 2);
          const primary = data[freqIndex] ?? 0;
          const secondary = data[freqIndex + 1] ?? primary;
          const val = (primary + secondary) / 2;
          targetHeight = (val / 255) * h * 0.8;
          if (targetHeight < 6) targetHeight = 6;
        } else {
          targetHeight = 4 + Math.sin(t * 4 + i * 0.5) * 3;
        }

        const lerpSpeed = currentIsSilent ? 0.12 : 0.22;
        smoothedHeightsRef.current[i] += (targetHeight - smoothedHeightsRef.current[i]) * lerpSpeed;
        const height = smoothedHeightsRef.current[i];
        const x = startX + i * (barWidth + gap);
        const y = centerY - height / 2;

        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        if (currentIsSilent) {
          gradient.addColorStop(0, primaryFill(0.15));
          gradient.addColorStop(1, primaryFill(0.15));
        } else {
          const intensity = Math.min(1, height / (h * 0.6));
          gradient.addColorStop(0, primaryFill(0.4 + intensity * 0.4));
          gradient.addColorStop(0.5, primaryFill(0.7 + intensity * 0.3));
          gradient.addColorStop(1, primaryFill(0.4 + intensity * 0.4));
        }

        ctx.fillStyle = gradient;
        drawRoundedRect(ctx, x, y, barWidth, height, barWidth / 2);

        if (!currentIsSilent && height > h * 0.3) {
          ctx.shadowBlur = 10 * (height / h);
          ctx.shadowColor = primaryFill(0.3);
        } else {
          ctx.shadowBlur = 0;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRecording]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Real-time voice activity visualizer"
      className="w-full h-full waveform-canvas"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
