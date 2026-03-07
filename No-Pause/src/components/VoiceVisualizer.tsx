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
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const barCount = 32;
    const barWidth = 6;
    const gap = 4;

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

    const animate = () => {
      if (!canvas) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;

      if (!isRecording) {
        const totalWidth = barCount * (barWidth + gap) - gap;
        const startX = centerX - totalWidth / 2;
        for (let i = 0; i < barCount; i++) {
          const idleHeight = 4 + Math.sin(Date.now() / 1000 + i * 0.2) * 2;
          smoothedHeightsRef.current[i] += (idleHeight - smoothedHeightsRef.current[i]) * 0.05;
          const height = smoothedHeightsRef.current[i];
          const x = startX + i * (barWidth + gap);
          const y = centerY - height / 2;
          ctx.fillStyle = 'rgba(90, 125, 124, 0.1)';
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
          const val = data[freqIndex] || 0;
          targetHeight = (val / 255) * h * 0.8;
          if (targetHeight < 6) targetHeight = 6 + Math.random() * 2;
        } else {
          targetHeight = 4 + Math.sin(Date.now() / 500 + i * 0.5) * 3;
        }

        const lerpSpeed = currentIsSilent ? 0.1 : 0.3;
        smoothedHeightsRef.current[i] += (targetHeight - smoothedHeightsRef.current[i]) * lerpSpeed;
        const height = smoothedHeightsRef.current[i];
        const x = startX + i * (barWidth + gap);
        const y = centerY - height / 2;

        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        if (currentIsSilent) {
          gradient.addColorStop(0, 'rgba(90, 125, 124, 0.15)');
          gradient.addColorStop(1, 'rgba(90, 125, 124, 0.15)');
        } else {
          const intensity = Math.min(1, height / (h * 0.6));
          gradient.addColorStop(0, `rgba(90, 125, 124, ${0.4 + intensity * 0.4})`);
          gradient.addColorStop(0.5, `rgba(90, 125, 124, ${0.7 + intensity * 0.3})`);
          gradient.addColorStop(1, `rgba(90, 125, 124, ${0.4 + intensity * 0.4})`);
        }

        ctx.fillStyle = gradient;
        drawRoundedRect(ctx, x, y, barWidth, height, barWidth / 2);

        if (!currentIsSilent && height > h * 0.3) {
          ctx.shadowBlur = 10 * (height / h);
          ctx.shadowColor = 'rgba(90, 125, 124, 0.3)';
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
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
