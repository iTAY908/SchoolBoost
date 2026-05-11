import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface SparkleProps {
  count?: number;
  active: boolean;
}

const SPARKLE_POSITIONS = [
  { x: 10, y: 15, size: 8, delay: 0 },
  { x: 85, y: 20, size: 6, delay: 0.3 },
  { x: 25, y: 75, size: 10, delay: 0.6 },
  { x: 70, y: 70, size: 7, delay: 0.1 },
  { x: 50, y: 10, size: 9, delay: 0.45 },
  { x: 15, y: 45, size: 5, delay: 0.8 },
  { x: 90, y: 55, size: 8, delay: 0.2 },
  { x: 40, y: 85, size: 6, delay: 0.7 },
  { x: 60, y: 35, size: 7, delay: 0.55 },
  { x: 80, y: 88, size: 5, delay: 0.35 },
  { x: 5, y: 90, size: 6, delay: 0.9 },
  { x: 95, y: 8, size: 7, delay: 0.15 },
];

export const Sparkles: React.FC<SparkleProps> = ({ active }) => {
  const frame = useCurrentFrame();

  if (!active) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {SPARKLE_POSITIONS.map((sp, i) => {
        const cycleLength = 60;
        const offset = sp.delay * cycleLength;
        const cycleFrame = (frame + offset) % cycleLength;

        const opacity = interpolate(
          cycleFrame,
          [0, 15, 30, 45, 60],
          [0, 1, 0.5, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const scale = interpolate(
          cycleFrame,
          [0, 15, 30, 45, 60],
          [0.3, 1.2, 0.8, 1.1, 0.3],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              width: sp.size,
              height: sp.size,
              opacity,
              transform: `scale(${scale}) rotate(${frame * 2}deg)`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="#FFD700" width={sp.size * 2} height={sp.size * 2}>
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};
