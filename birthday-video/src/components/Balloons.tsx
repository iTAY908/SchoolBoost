import React from 'react';
import { useCurrentFrame } from 'remotion';

const BALLOON_DATA = [
  { x: 5,  color: '#FF4466', stripeColor: '#FF88AA', size: 70, speed: 0.06, delay: 0  },
  { x: 95, color: '#44AAFF', stripeColor: '#88CCFF', size: 65, speed: 0.05, delay: 40 },
  { x: 8,  color: '#FFD700', stripeColor: '#FFE866', size: 60, speed: 0.07, delay: 80 },
  { x: 92, color: '#44EE88', stripeColor: '#88FFBB', size: 68, speed: 0.055, delay: 20 },
  { x: 3,  color: '#CC44FF', stripeColor: '#EE88FF', size: 55, speed: 0.065, delay: 60 },
  { x: 97, color: '#FF8800', stripeColor: '#FFBB44', size: 62, speed: 0.05, delay: 100 },
];

const Balloon: React.FC<typeof BALLOON_DATA[0] & { frame: number }> = ({
  x, color, stripeColor, size, speed, delay, frame,
}) => {
  const ef = Math.max(0, frame - delay);
  const baseY = 105;
  const y = ((baseY - ef * speed) % 125) - 20;
  if (y > 108 || y < -25) return null;

  const sway = Math.sin(ef * 0.025) * 2.5;
  const tilt = Math.sin(ef * 0.025) * 6;

  return (
    <div style={{
      position: 'absolute',
      left: `${x + sway}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
    }}>
      {/* Balloon body */}
      <div style={{
        width: size, height: size * 1.2,
        borderRadius: '50% 50% 50% 50% / 45% 45% 55% 55%',
        background: `radial-gradient(ellipse at 35% 35%, ${stripeColor} 0%, ${color} 50%, ${color}88 100%)`,
        boxShadow: `inset -${size * 0.15}px -${size * 0.1}px ${size * 0.25}px rgba(0,0,0,0.2), 0 4px 15px rgba(0,0,0,0.3)`,
        position: 'relative',
      }}>
        {/* Shine */}
        <div style={{
          position: 'absolute', top: '15%', left: '20%',
          width: '25%', height: '20%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          filter: 'blur(2px)',
        }} />
      </div>
      {/* Knot */}
      <div style={{
        width: 8, height: 8,
        background: color,
        borderRadius: '50%',
        margin: '0 auto',
      }} />
      {/* String */}
      <svg width="20" height="40" style={{ display: 'block', margin: '0 auto' }}>
        <path
          d={`M 10 0 Q ${10 + Math.sin(ef * 0.05) * 6} 20 10 40`}
          stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none"
        />
      </svg>
    </div>
  );
};

export const Balloons: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {BALLOON_DATA.map((b, i) => <Balloon key={i} {...b} frame={frame} />)}
    </div>
  );
};
