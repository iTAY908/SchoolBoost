import React from 'react';
import { useCurrentFrame } from 'remotion';

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  startY: (i * 53 + 7) % 120,
  size: 2 + (i % 4),
  speed: 0.006 + (i % 8) * 0.002,
  opacity: 0.3 + (i % 5) * 0.1,
  delay: i * 13,
  wobble: (i % 3) * 0.5,
}));

export const FloatingParticles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {PARTICLES.map((p, i) => {
        const effectiveFrame = frame + p.delay;
        const y = ((p.startY - effectiveFrame * p.speed * 100) % 120) - 10;
        const wobbleX = Math.sin(effectiveFrame * 0.03 + i) * 3;
        const pulse = Math.sin(effectiveFrame * 0.05 + i * 0.7) * 0.4 + 0.6;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x + wobbleX}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FFFFFF' : '#FFA500',
              opacity: p.opacity * pulse,
              boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${i % 2 === 0 ? '#FFD70066' : '#FFFFFF44'}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </div>
  );
};
