import React from 'react';
import { useCurrentFrame } from 'remotion';

const BOKEH_CIRCLES = [
  { x: 8,  startY: 110, size: 120, opacity: 0.07, speed: 0.018, blur: 28, color: '#FFD700' },
  { x: 22, startY: 95,  size: 70,  opacity: 0.05, speed: 0.024, blur: 20, color: '#FFA500' },
  { x: 45, startY: 105, size: 160, opacity: 0.04, speed: 0.012, blur: 40, color: '#FFE066' },
  { x: 68, startY: 100, size: 90,  opacity: 0.06, speed: 0.022, blur: 22, color: '#FFD700' },
  { x: 82, startY: 108, size: 50,  opacity: 0.08, speed: 0.030, blur: 14, color: '#FFFFFF' },
  { x: 15, startY: 80,  size: 200, opacity: 0.03, speed: 0.008, blur: 55, color: '#FFB347' },
  { x: 55, startY: 90,  size: 80,  opacity: 0.05, speed: 0.020, blur: 25, color: '#FFD700' },
  { x: 90, startY: 102, size: 110, opacity: 0.04, speed: 0.015, blur: 35, color: '#FFA500' },
  { x: 35, startY: 98,  size: 60,  opacity: 0.07, speed: 0.026, blur: 18, color: '#FFFFFF' },
  { x: 75, startY: 115, size: 140, opacity: 0.03, speed: 0.010, blur: 45, color: '#FFE066' },
  { x: 50, startY: 88,  size: 45,  opacity: 0.09, speed: 0.034, blur: 12, color: '#FFD700' },
  { x: 30, startY: 112, size: 95,  opacity: 0.05, speed: 0.016, blur: 30, color: '#FFA500' },
];

export const BokehLayer: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {BOKEH_CIRCLES.map((b, i) => {
        const y = ((b.startY - frame * b.speed * 100) % 120) - 10;
        const pulse = Math.sin(frame * 0.04 + i * 1.3) * 0.3 + 0.7;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              top: `${y}%`,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${b.color}44 0%, ${b.color}11 50%, transparent 70%)`,
              opacity: b.opacity * pulse,
              filter: `blur(${b.blur}px)`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </div>
  );
};
