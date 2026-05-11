import React from 'react';
import { useCurrentFrame, useVideoConfig, Audio, AbsoluteFill, staticFile } from 'remotion';
import { SCENES } from './data/scenes';
import { PhotoSlide } from './components/PhotoSlide';
import { BokehLayer } from './components/BokehLayer';
import { FloatingParticles } from './components/FloatingParticles';
import { LightLeak } from './components/LightLeak';
import { CinematicOverlay } from './components/CinematicOverlay';
import { IntroScene } from './components/IntroScene';

// Light leak transition times (at each scene change)
const TRANSITION_TIMES = SCENES.slice(1).map((s) => s.startSec + 1);

export const BirthdayVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTimeSec = frame / fps;
  const introDurationSec = 5;
  const introFrames = introDurationSec * fps;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('song.mp3')} />

      {/* Photo slides with Ken Burns */}
      {SCENES.map((scene, i) => {
        const startFrame = Math.round(scene.startSec * fps);
        const endFrame = Math.round(scene.endSec * fps);
        const isVisible = frame >= startFrame - fps * 1.5 && frame < endFrame + fps * 1.5;
        if (!isVisible) return null;
        return (
          <PhotoSlide
            key={i}
            scene={scene}
            globalStartFrame={startFrame}
            globalEndFrame={endFrame}
          />
        );
      })}

      {/* Bokeh circles floating in background */}
      <BokehLayer />

      {/* Tiny floating particles */}
      <FloatingParticles />

      {/* Cinematic color grade, vignette, grain */}
      <CinematicOverlay />

      {/* Light leaks on every transition */}
      {TRANSITION_TIMES.map((t, i) => (
        <LightLeak
          key={i}
          triggerAtSec={t}
          color={i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF8C00' : '#FFF5CC'}
        />
      ))}

      {/* Intro overlay (first 5 seconds) */}
      {frame < introFrames + fps * 1.2 && <IntroScene />}

      {/* Closing fade to black */}
      {currentTimeSec > 158 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#000',
          opacity: Math.min(1, (currentTimeSec - 158) / 4),
        }} />
      )}
    </AbsoluteFill>
  );
};
