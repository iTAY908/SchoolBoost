import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { LyricLine as LyricLineType } from '../data/lyrics';

interface LyricLineProps {
  lyric: LyricLineType;
}

export const LyricLine: React.FC<LyricLineProps> = ({ lyric }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = Math.round(lyric.startSec * fps);
  const endFrame = Math.round(lyric.endSec * fps);
  const duration = endFrame - startFrame;
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > duration) return null;

  const isLarge = lyric.size === 'large';
  const color = lyric.color ?? '#FFFFFF';
  const fontSize = isLarge ? 80 : 62;

  // Entrance animation
  const entranceProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.8 },
  });

  // Exit fade
  const exitStart = duration - Math.min(fps * 0.5, duration * 0.25);
  const exitOpacity = interpolate(localFrame, [exitStart, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const baseOpacity = Math.min(entranceProgress, exitOpacity);

  // Effect-specific styles
  let extraStyle: React.CSSProperties = {};
  let textShadow = '0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6)';

  switch (lyric.effect) {
    case 'shake': {
      const shakeIntensity = interpolate(localFrame, [0, fps * 0.5, fps * 1.5], [0, 6, 3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const shakeX = Math.sin(localFrame * 1.2) * shakeIntensity;
      extraStyle = { transform: `translateX(${shakeX}px)` };
      break;
    }
    case 'wave': {
      // Wave effect handled per-word below
      break;
    }
    case 'glow': {
      textShadow = `0 0 30px ${color}, 0 0 60px ${color}88, 0 2px 20px rgba(0,0,0,0.9)`;
      break;
    }
    case 'sparkle': {
      textShadow = `0 0 20px #FFD700, 0 0 40px #FFD70066, 0 2px 20px rgba(0,0,0,0.9)`;
      break;
    }
    case 'rise': {
      const riseY = interpolate(entranceProgress, [0, 1], [40, 0]);
      extraStyle = { transform: `translateY(${riseY}px)` };
      textShadow = `0 0 30px ${color}88, 0 2px 20px rgba(0,0,0,0.9)`;
      break;
    }
    case 'fall-rise': {
      // Text drops in then bounces
      const fallRiseY = interpolate(entranceProgress, [0, 0.6, 0.8, 1], [60, -10, 5, 0]);
      extraStyle = { transform: `translateY(${fallRiseY}px)` };
      break;
    }
  }

  if (lyric.effect === 'wave') {
    const words = lyric.text.split(' ');
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 180,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row-reverse',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          paddingInline: 60,
          opacity: baseOpacity,
          direction: 'rtl',
        }}
      >
        {words.map((word, i) => {
          const waveY = Math.sin((localFrame * 0.15) + i * 0.8) * 10;
          return (
            <span
              key={i}
              style={{
                fontSize,
                fontWeight: 900,
                color,
                textShadow,
                transform: `translateY(${waveY}px)`,
                display: 'inline-block',
                fontFamily: 'Arial, sans-serif',
                direction: 'rtl',
                unicodeBidi: 'embed',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  const scaleIn = interpolate(entranceProgress, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        paddingInline: 60,
        opacity: baseOpacity,
        transform: `scale(${scaleIn})`,
        ...extraStyle,
      }}
    >
      <p
        style={{
          fontSize,
          fontWeight: 900,
          color,
          textShadow,
          margin: 0,
          textAlign: 'center',
          fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
          direction: 'rtl',
          lineHeight: 1.3,
          letterSpacing: '-0.5px',
        }}
      >
        {lyric.text}
      </p>
    </div>
  );
};
