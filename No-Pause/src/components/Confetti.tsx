import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  opacity: number;
  shape: 'square' | 'circle' | 'strip';
}

const COLORS = [
  'hsl(18, 69%, 64%)',   // primary/terracotta
  'hsl(43, 56%, 58%)',   // gold
  'hsl(198, 45%, 58%)',  // blue
  'hsl(165, 34%, 55%)',  // teal
  'hsl(336, 48%, 62%)',  // pink
  'hsl(18, 69%, 74%)',   // light terracotta
  'hsl(0, 0%, 95%)',     // white
];

const PARTICLE_COUNT = 80;

export default function Confetti() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const initial: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const fromLeft = i % 2 === 0;
      initial.push({
        id: i,
        x: fromLeft ? -5 + Math.random() * 10 : 95 + Math.random() * 10,
        y: 20 + Math.random() * 40,
        vx: fromLeft ? 1.5 + Math.random() * 3 : -(1.5 + Math.random() * 3),
        vy: -(3 + Math.random() * 5),
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        opacity: 1,
        shape: (['square', 'circle', 'strip'] as const)[Math.floor(Math.random() * 3)],
      });
    }
    setParticles(initial);

    let frame: number;
    const gravity = 0.12;
    const friction = 0.99;

    const animate = () => {
      setParticles(prev =>
        prev.map(p => ({
          ...p,
          x: p.x + p.vx * 0.3,
          y: p.y + p.vy * 0.3,
          vy: p.vy + gravity,
          vx: p.vx * friction,
          rotation: p.rotation + p.rotationSpeed,
          opacity: Math.max(0, p.opacity - 0.004),
        })).filter(p => p.opacity > 0 && p.y < 120)
      );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.shape === 'strip' ? p.size * 0.4 : p.size,
            height: p.shape === 'strip' ? p.size * 1.5 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'strip' ? '2px' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            opacity: p.opacity,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}
