import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';
import type { Scene } from '../data/scenes';

interface PhotoSlideProps {
  scene: Scene;
  globalStartFrame: number;
  globalEndFrame: number;
}

export const PhotoSlide: React.FC<PhotoSlideProps> = ({ scene, globalStartFrame, globalEndFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const duration = globalEndFrame - globalStartFrame;
  const localFrame = frame - globalStartFrame;

  const fadeIn = fps * 1.2;
  const fadeOut = fps * 1.2;

  const opacity = interpolate(
    localFrame,
    [0, fadeIn, duration - fadeOut, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const progress = Math.max(0, Math.min(1, localFrame / duration));

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (scene.kenBurns) {
    case 'zoom-in':
      scale = interpolate(progress, [0, 1], [1, 1.18]);
      break;
    case 'zoom-out':
      scale = interpolate(progress, [0, 1], [1.18, 1]);
      break;
    case 'pan-left':
      scale = 1.12;
      translateX = interpolate(progress, [0, 1], [3, -3]);
      break;
    case 'pan-right':
      scale = 1.12;
      translateX = interpolate(progress, [0, 1], [-3, 3]);
      break;
    case 'pan-up':
      scale = 1.12;
      translateY = interpolate(progress, [0, 1], [3, -3]);
      break;
    case 'diagonal':
      scale = interpolate(progress, [0, 1], [1, 1.14]);
      translateX = interpolate(progress, [0, 1], [-2, 2]);
      translateY = interpolate(progress, [0, 1], [2, -2]);
      break;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, overflow: 'hidden' }}>
      <Img
        src={staticFile(`photos/${scene.photo}`)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          transform: `scale(${scale}) translateX(${translateX}%) translateY(${translateY}%)`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};
