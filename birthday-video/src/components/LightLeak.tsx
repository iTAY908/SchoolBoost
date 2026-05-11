import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface LightLeakProps {
  triggerAtSec: number;
  color?: string;
}

export const LightLeak: React.FC<LightLeakProps> = ({
  triggerAtSec,
  color = '#FFD700',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const triggerFrame = triggerAtSec * fps;
  const localFrame = frame - triggerFrame;
  const duration = fps * 2.5;

  if (localFrame < 0 || localFrame > duration) return null;

  const opacity = interpolate(
    localFrame,
    [0, duration * 0.2, duration * 0.6, duration],
    [0, 0.35, 0.2, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const translateX = interpolate(
    localFrame,
    [0, duration],
    [-30, 110],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: `${translateX}%`,
          width: '40%',
          height: '120%',
          background: `linear-gradient(105deg, transparent 0%, ${color}88 40%, ${color}cc 50%, ${color}88 60%, transparent 100%)`,
          filter: 'blur(30px)',
          transform: 'skewX(-15deg)',
        }}
      />
    </div>
  );
};
