import React from 'react';
import { useCurrentFrame } from 'remotion';

const COLORS = ['#FFD700', '#FF4466', '#44AAFF', '#44EE88', '#FF88DD', '#FF8800', '#CC44FF', '#FF3333', '#00DDFF', '#FFEE00'];

const PIECES = Array.from({ length: 80 }, (_, i) => ({
  x: (i * 137.508 + 23) % 100,
  startY: -((i * 53.7 + 11) % 30),
  speed: 0.22 + (i * 7 % 30) / 100,
  rotSpeed: ((i * 13) % 40 - 20) * 0.8,
  width: 7 + (i % 3) * 5,
  height: (i % 4 === 0) ? 7 + (i % 3) * 5 : 4 + (i % 2) * 3,
  isCircle: i % 5 === 0,
  color: COLORS[i % COLORS.length],
  drift: ((i * 11) % 20 - 10) * 0.008,
  delay: (i * 17) % 90,
  opacity: 0.7 + (i % 4) * 0.07,
}));

export const Confetti: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {PIECES.map((p, i) => {
        const effectiveFrame = Math.max(0, frame - p.delay);
        const progress = (effectiveFrame * p.speed) % 140;
        const y = p.startY + progress;
        const x = p.x + Math.sin(effectiveFrame * 0.02 + i) * 2 + p.drift * effectiveFrame;
        const rotation = effectiveFrame * p.rotSpeed;

        if (y > 115 || y < -15) return null;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
              borderRadius: p.isCircle ? '50%' : 2,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              opacity: p.opacity * intensity,
            }}
          />
        );
      })}
    </div>
  );
};
