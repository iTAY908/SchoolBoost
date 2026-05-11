import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const COLORS = ['#FFD700', '#FF4466', '#44AAFF', '#FF8800', '#FFFFFF', '#CC44FF', '#44EE88', '#FF3333'];

interface Burst {
  cx: number; // % from left
  cy: number; // % from top
  triggerSec: number;
}

const BURSTS: Burst[] = [
  { cx: 50, cy: 45, triggerSec: 0.5 },
  { cx: 20, cy: 35, triggerSec: 1.2 },
  { cx: 80, cy: 30, triggerSec: 1.8 },
  { cx: 35, cy: 55, triggerSec: 2.4 },
  { cx: 65, cy: 40, triggerSec: 2.9 },
  { cx: 50, cy: 45, triggerSec: 51 },
  { cx: 25, cy: 30, triggerSec: 51.6 },
  { cx: 75, cy: 35, triggerSec: 52.1 },
  { cx: 50, cy: 45, triggerSec: 124 },
  { cx: 30, cy: 40, triggerSec: 124.7 },
  { cx: 70, cy: 38, triggerSec: 125.3 },
  { cx: 50, cy: 50, triggerSec: 157 },
  { cx: 20, cy: 35, triggerSec: 157.8 },
  { cx: 80, cy: 40, triggerSec: 158.5 },
];

const PARTICLES_PER_BURST = 24;

export const FireworkBursts: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {BURSTS.map((burst, bi) => {
        const triggerFrame = burst.triggerSec * fps;
        const localFrame = frame - triggerFrame;
        const duration = fps * 1.8;

        if (localFrame < 0 || localFrame > duration) return null;

        return Array.from({ length: PARTICLES_PER_BURST }, (_, pi) => {
          const angle = (pi / PARTICLES_PER_BURST) * Math.PI * 2;
          const speed = (40 + (pi % 4) * 20) * (localFrame / duration);
          const gravity = 0.5 * (localFrame / fps) ** 2 * 60;

          const px = burst.cx + Math.cos(angle) * speed;
          const py = burst.cy + Math.sin(angle) * speed + gravity;

          const opacity = interpolate(localFrame, [0, duration * 0.3, duration], [1, 0.9, 0], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });

          const size = interpolate(localFrame, [0, duration * 0.2, duration], [3, 6, 2], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });

          const color = COLORS[(bi * 3 + pi) % COLORS.length];

          return (
            <div
              key={`${bi}-${pi}`}
              style={{
                position: 'absolute',
                left: `${px}%`,
                top: `${py}%`,
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 ${size * 2}px ${color}`,
                opacity,
                transform: 'translate(-50%, -50%)',
              }}
            />
          );
        });
      })}
    </div>
  );
};
