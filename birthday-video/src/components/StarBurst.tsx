import React from 'react';
import { useCurrentFrame } from 'remotion';

// Spinning star decorations in corners + periodic large star bursts
const CORNER_STARS = [
  { x: 6,  y: 6,  size: 55, speed: 1.2 },
  { x: 94, y: 6,  size: 50, speed: -0.9 },
  { x: 6,  y: 94, size: 48, speed: 0.8 },
  { x: 94, y: 94, size: 52, speed: -1.1 },
];

const StarSVG: React.FC<{ size: number; color: string; opacity: number; rotation: number }> = ({
  size, color, opacity, rotation,
}) => (
  <svg
    width={size} height={size}
    viewBox="0 0 50 50"
    style={{ transform: `rotate(${rotation}deg)`, opacity, filter: `drop-shadow(0 0 6px ${color})` }}
  >
    <polygon
      points="25,2 31,18 48,18 35,29 39,46 25,36 11,46 15,29 2,18 19,18"
      fill={color}
    />
  </svg>
);

// Rotating decorative ring of stars around the frame border
const RING_STARS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * 360,
  size: 22 + (i % 3) * 8,
  color: ['#FFD700', '#FF4466', '#44AAFF', '#FF8800'][i % 4],
  speed: 0.15 + (i % 4) * 0.05,
}));

export const StarBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const cx = 50, cy = 50; // center in %
  const rx = 46, ry = 46; // radius in %

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Corner spinning stars */}
      {CORNER_STARS.map((s, i) => {
        const pulse = Math.sin(frame * 0.07 + i * 1.5) * 0.15 + 1;
        const opacity = 0.7 + Math.sin(frame * 0.05 + i) * 0.2;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            transform: `translate(-50%, -50%) scale(${pulse})`,
          }}>
            <StarSVG
              size={s.size} color="#FFD700"
              opacity={opacity}
              rotation={frame * s.speed}
            />
          </div>
        );
      })}

      {/* Orbiting ring of mini stars */}
      {RING_STARS.map((s, i) => {
        const angle = (s.angle + frame * s.speed) * (Math.PI / 180);
        const x = cx + Math.cos(angle) * rx;
        const y = cy + Math.sin(angle) * ry;
        const pulse = Math.sin(frame * 0.08 + i * 0.7) * 0.2 + 0.8;
        const opacity = 0.5 + Math.sin(frame * 0.06 + i) * 0.3;

        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`, top: `${y}%`,
            transform: `translate(-50%, -50%) scale(${pulse})`,
          }}>
            <StarSVG
              size={s.size} color={s.color}
              opacity={opacity}
              rotation={frame * s.speed * 2}
            />
          </div>
        );
      })}
    </div>
  );
};
