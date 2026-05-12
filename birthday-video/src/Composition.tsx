import React from 'react';
import { useCurrentFrame, useVideoConfig, Audio, AbsoluteFill, staticFile } from 'remotion';
import { SCENES } from './data/scenes';
import { PhotoSlide } from './components/PhotoSlide';
import { BokehLayer } from './components/BokehLayer';
import { FloatingParticles } from './components/FloatingParticles';
import { LightLeak } from './components/LightLeak';
import { CinematicOverlay } from './components/CinematicOverlay';
import { IntroScene } from './components/IntroScene';
import { Confetti } from './components/Confetti';
import { FireworkBursts } from './components/FireworkBurst';
import { CelebrationCards } from './components/CelebrationCards';
import { FloatingEmojis } from './components/FloatingEmojis';
import { Balloons } from './components/Balloons';
import { StarBurst } from './components/StarBurst';
import { NameBanners } from './components/NameBanner';
import { GreetingCard } from './components/GreetingCard';
import { DreamBook } from './components/DreamBook';
import { GiftBox } from './components/GiftBox';
import { StairClimber } from './components/StairClimber';

const TRANSITION_TIMES = SCENES.slice(1).map((s) => s.startSec + 1);

export const BirthdayVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTimeSec = frame / fps;

  const isFireworkMoment = [27, 51, 120, 150].some(t => Math.abs(currentTimeSec - t) < 3);
  const confettiIntensity = isFireworkMoment ? 1.8 : 0.9;

  // Photos run 25-92s; suppress decorative layers during full-screen moments
  const inPhotoRange = currentTimeSec >= 25 && currentTimeSec <= 92;
  const inStairRange = currentTimeSec < 25;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Audio src={staticFile('song.mp3')} />

      {/* === LAYER 1: Photos with Ken Burns (25-92s) === */}
      {SCENES.map((scene, i) => {
        const startFrame = Math.round(scene.startSec * fps);
        const endFrame = Math.round(scene.endSec * fps);
        if (frame < startFrame - fps * 1.5 || frame >= endFrame + fps * 1.5) return null;
        return (
          <PhotoSlide key={i} scene={scene} globalStartFrame={startFrame} globalEndFrame={endFrame} />
        );
      })}

      {/* === LAYER 2: Background atmosphere === */}
      {!inStairRange && <BokehLayer />}
      {!inStairRange && <FloatingParticles />}

      {/* === LAYER 3: Cinematic grade & vignette === */}
      <CinematicOverlay />

      {/* === LAYER 4: Celebration elements (only during photo/finale ranges) === */}
      {inPhotoRange && <Balloons />}
      {inPhotoRange && <StarBurst />}
      <FloatingEmojis />
      <Confetti intensity={confettiIntensity} />

      {/* === LAYER 5: Light leaks on photo transitions === */}
      {TRANSITION_TIMES.map((t, i) => (
        <LightLeak key={i} triggerAtSec={t} color={i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF8C00' : '#FF88DD'} />
      ))}

      {/* === LAYER 6: Firework bursts === */}
      <FireworkBursts />

      {/* === LAYER 7: Text overlays === */}
      <CelebrationCards />
      <NameBanners />

      {/* === LAYER 7b: Greeting book (during photo slideshow) === */}
      <GreetingCard triggerAtSec={52} />

      {/* === LAYER 7c: Dream book (after photos) === */}
      <DreamBook triggerAtSec={92} />

      {/* === LAYER 7d: Gift box + note === */}
      <GiftBox triggerAtSec={107} />

      {/* === LAYER 8: Intro (triggered at 23s, after stair animation) === */}
      {frame >= 22 * fps && frame < 29 * fps && <IntroScene startSec={23} />}

      {/* === LAYER 9: Stair climber animation (0-25s, covers everything) === */}
      <StairClimber />

      {/* === Fade to black at end === */}
      {currentTimeSec > 158 && (
        <div style={{
          position: 'absolute', inset: 0, background: '#000',
          opacity: Math.min(1, (currentTimeSec - 158) / 5),
          zIndex: 500,
        }} />
      )}
    </AbsoluteFill>
  );
};
