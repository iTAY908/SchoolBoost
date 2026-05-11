import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  Audio,
  AbsoluteFill,
  staticFile,
} from 'remotion';
import { LYRICS } from './data/lyrics';
import { SCENES } from './data/scenes';
import { PhotoSlide } from './components/PhotoSlide';
import { LyricLine } from './components/LyricLine';
import { Sparkles } from './components/Sparkles';
import { IntroScene } from './components/IntroScene';

export const BirthdayVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introDurationSec = 4;
  const introFrames = introDurationSec * fps;

  const currentTimeSec = frame / fps;
  const activeLyric = LYRICS.find(
    (l) => currentTimeSec >= l.startSec && currentTimeSec < l.endSec
  );
  const isSparkleSection = activeLyric?.effect === 'sparkle';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('song.mp3')} />

      {SCENES.map((scene, i) => {
        const startFrame = Math.round(scene.startSec * fps);
        const endFrame = Math.round(scene.endSec * fps);
        const isVisible = frame >= startFrame - fps && frame < endFrame + fps;
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

      {isSparkleSection && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}

      <Sparkles active={isSparkleSection} />

      {LYRICS.map((lyric, i) => {
        const startFrame = Math.round(lyric.startSec * fps);
        const endFrame = Math.round(lyric.endSec * fps);
        if (frame < startFrame || frame > endFrame) return null;
        return <LyricLine key={i} lyric={lyric} />;
      })}

      {frame < introFrames + fps && <IntroScene />}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
