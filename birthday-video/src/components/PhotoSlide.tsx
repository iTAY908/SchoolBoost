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

  const fadeInDuration = Math.min(fps * 0.8, duration * 0.2);
  const fadeOutDuration = Math.min(fps * 0.8, duration * 0.2);

  const opacity = interpolate(
    localFrame,
    [0, fadeInDuration, duration - fadeOutDuration, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const progress = localFrame / duration;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (scene.kenBurns) {
    case 'zoom-in':
      scale = interpolate(progress, [0, 1], [1, 1.12]);
      break;
    case 'zoom-out':
      scale = interpolate(progress, [0, 1], [1.12, 1]);
      break;
    case 'pan-left':
      scale = 1.08;
      translateX = interpolate(progress, [0, 1], [2, -2]);
      break;
    case 'pan-right':
      scale = 1.08;
      translateX = interpolate(progress, [0, 1], [-2, 2]);
      break;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        overflow: 'hidden',
      }}
    >
      <Img
        src={staticFile(`photos/${scene.photo}`)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${translateX}%) translateY(${translateY}%)`,
          transformOrigin: 'center center',
        }}
      />
      {/* Dark gradient overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.85) 100%)',
        }}
      />
    </div>
  );
};
