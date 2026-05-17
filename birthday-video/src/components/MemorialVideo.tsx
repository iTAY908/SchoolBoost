import React from 'react';
import {
  useCurrentFrame, useVideoConfig,
  interpolate, spring,
  Audio, AbsoluteFill, staticFile,
  Img, OffthreadVideo, Sequence,
} from 'remotion';

// ─── Media sources ────────────────────────────────────────────────
const PHOTO_DINNER1 = staticFile('memorial/9e753e37-1000078989.jpg');   // happy family dinner
const PHOTO_FAMILY  = staticFile('memorial/d5568da9-1000078986.jpg');   // big family gathering
const PHOTO_HOSP    = staticFile('memorial/58188550-1000078988.jpg');   // hospital – emotional
const VID1 = staticFile('memorial/50cabf0c-VID20260424WA0011.mp4'); // 10.6s, 1024×576 landscape
const VID2 = staticFile('memorial/5a67505f-VID20260424WA0031.mp4'); // 25.7s, 392×848 portrait
const VID3 = staticFile('memorial/video3.mp4');                      // 37.6s, transcoded h264

// ─── Helpers ──────────────────────────────────────────────────────
const clamp = (v: number) => ({ extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const });
const fade = (frame: number, inStart: number, inEnd: number, outStart: number, outEnd: number) =>
  interpolate(frame, [inStart, inEnd, outStart, outEnd], [0, 1, 1, 0], clamp(0));

// Film colour grade – warm, slightly desaturated memory look
const GRADE = 'saturate(0.78) contrast(1.08) sepia(0.12) brightness(0.93)';

// ─── Photo panel (Ken Burns) ──────────────────────────────────────
const PhotoPanel: React.FC<{
  src: string; from: number; duration: number;
  kbScale?: [number, number]; kbX?: [number, number]; kbY?: [number, number];
}> = ({ src, from, duration, kbScale = [1, 1.08], kbX = [0, 0], kbY = [0, 0] }) => {
  const frame = useCurrentFrame();
  const lf = frame - from;
  if (lf < 0 || lf >= duration) return null;

  const progress = lf / duration;
  const scale  = interpolate(progress, [0, 1], kbScale);
  const transX = interpolate(progress, [0, 1], kbX);
  const transY = interpolate(progress, [0, 1], kbY);

  const opacity = fade(lf, 0, 6, duration - 8, duration);

  // Zoom punch on cut
  const punchF = spring({ frame: lf, fps: 30, config: { damping: 22, stiffness: 400, mass: 0.4 } });
  const punch  = interpolate(punchF, [0, 1], [1.06, 1.0]);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, overflow: 'hidden' }}>
      <Img
        src={src}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center top',
          transform: `scale(${scale * punch}) translate(${transX}%, ${transY}%)`,
          filter: GRADE,
        }}
      />
    </div>
  );
};

// ─── Video panel (blur-bg technique for landscape) ─────────────────
const VideoPanel: React.FC<{
  src: string; from: number; duration: number; srcStart?: number;
  landscape?: boolean;
}> = ({ src, from, duration, srcStart = 0, landscape = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lf = frame - from;
  if (lf < 0 || lf >= duration) return null;

  const opacity = fade(lf, 0, 5, duration - 6, duration);

  const punchF = spring({ frame: lf, fps, config: { damping: 22, stiffness: 400, mass: 0.4 } });
  const punch  = interpolate(punchF, [0, 1], [1.05, 1.0]);

  const sharedProps = { src, startFrom: srcStart, volume: 0 as const };

  if (landscape) {
    return (
      <div style={{ position: 'absolute', inset: 0, opacity, overflow: 'hidden', transform: `scale(${punch})` }}>
        {/* Blurred background fill */}
        <OffthreadVideo {...sharedProps} style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          filter: `blur(22px) brightness(0.45) ${GRADE}`,
          transform: 'scale(1.1)',
        }} />
        {/* Centered main video */}
        <OffthreadVideo {...sharedProps} style={{
          position: 'absolute',
          left: 0, right: 0,
          top: '50%', transform: 'translateY(-50%)',
          width: '100%', height: 'auto',
          filter: GRADE,
        }} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, transform: `scale(${punch})`, overflow: 'hidden' }}>
      <OffthreadVideo {...sharedProps} style={{
        width: '100%', height: '100%',
        objectFit: 'cover',
        filter: GRADE,
      }} />
    </div>
  );
};

// ─── White flash on cut ─────────────────────────────────────────────
const CutFlash: React.FC<{ atSec: number }> = ({ atSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lf = frame - atSec * fps;
  if (lf < 0 || lf > 6) return null;
  const opacity = interpolate(lf, [0, 1, 6], [0.85, 0.3, 0], clamp(0));
  return <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity, zIndex: 10, pointerEvents: 'none' }} />;
};

// ─── Text overlay ────────────────────────────────────────────────────
const MemText: React.FC<{
  text: string; sub?: string;
  fromSec: number; toSec: number;
  size?: number; align?: 'top' | 'center' | 'bottom';
}> = ({ text, sub, fromSec, toSec, size = 80, align = 'center' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lf = frame - fromSec * fps;
  const dur = (toSec - fromSec) * fps;
  if (lf < 0 || lf > dur) return null;

  const opacity = fade(lf, 0, 15, dur - 15, dur);
  const ty = interpolate(lf, [0, 20], [24, 0], clamp(0));

  const pos: React.CSSProperties =
    align === 'top'    ? { top: 120 } :
    align === 'bottom' ? { bottom: 160 } :
    { top: '50%', transform: `translateY(calc(-50% + ${ty}px))` };

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      ...pos,
      opacity,
      textAlign: 'center',
      zIndex: 30,
      padding: '0 40px',
    }}>
      <p style={{
        fontSize: size, fontWeight: 900, color: '#FFFFFF', margin: 0,
        textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)',
        fontFamily: '"Arial Black", Arial, "Noto Sans Hebrew", sans-serif',
        direction: 'rtl', lineHeight: 1.1,
        letterSpacing: 2,
      }}>{text}</p>
      {sub && (
        <p style={{
          fontSize: Math.round(size * 0.42), fontWeight: 400, color: 'rgba(255,255,255,0.85)',
          margin: '10px 0 0',
          textShadow: '0 1px 12px rgba(0,0,0,0.9)',
          fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
          direction: 'rtl', letterSpacing: 4,
        }}>{sub}</p>
      )}
    </div>
  );
};

// ─── Vignette ────────────────────────────────────────────────────────
const Vignette: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
    background: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.65) 100%)',
  }} />
);

// ─── Main composition ────────────────────────────────────────────────
export const MemorialVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Overall fade in/out
  const introOpacity = interpolate(frame, [0, 15], [0, 1], clamp(0));
  const outroOpacity = interpolate(frame, [fps * 36, fps * 38], [1, 0], clamp(0));
  const globalOpacity = Math.min(introOpacity, outroOpacity);

  // ─── CUT SCHEDULE (seconds) ───────────────────────────────────────
  // 0-5s   photo1 (happy dinner)
  // 5-9s   video1 (landscape WhatsApp, 0-4s)
  // 9-13s  photo2 (big family)
  // 13-17s video2 (portrait WhatsApp, 0-4s)
  // 17-23s photo3 (hospital – 6s, slow zoom)
  // 23-28s video3 (0-5s)
  // 28-32s photo1 again (different KB)
  // 32-36s video2 (4-8s of source)
  // 36-38s title card

  const F = (s: number) => Math.round(s * fps);

  const CUT_TIMES = [5, 9, 13, 17, 23, 28, 32, 36];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: globalOpacity }}>
      <Audio src={staticFile('memorial/song.mp3')} />

      {/* ── PHOTOS ────────────────────────────────────────────── */}
      <PhotoPanel src={PHOTO_DINNER1} from={F(0)}  duration={F(5.4)}
        kbScale={[1.0, 1.09]} kbX={[0, -2]} />
      <PhotoPanel src={PHOTO_FAMILY}  from={F(9)}  duration={F(4.4)}
        kbScale={[1.05, 1.0]} kbX={[2, 0]} />
      <PhotoPanel src={PHOTO_HOSP}    from={F(17)} duration={F(6.4)}
        kbScale={[1.0, 1.06]} kbY={[-1, 0]} />   {/* very slow zoom */}
      <PhotoPanel src={PHOTO_DINNER1} from={F(28)} duration={F(4.4)}
        kbScale={[1.08, 1.0]} kbX={[1, -1]} />

      {/* ── VIDEO CLIPS ───────────────────────────────────────── */}
      <Sequence from={F(5)} durationInFrames={F(4)}>
        <VideoPanel src={VID1} from={F(5)} duration={F(4)} srcStart={0} landscape />
      </Sequence>
      <Sequence from={F(13)} durationInFrames={F(4)}>
        <VideoPanel src={VID2} from={F(13)} duration={F(4)} srcStart={0} />
      </Sequence>
      <Sequence from={F(23)} durationInFrames={F(5)}>
        <VideoPanel src={VID3} from={F(23)} duration={F(5)} srcStart={0} landscape />
      </Sequence>
      <Sequence from={F(32)} durationInFrames={F(4)}>
        <VideoPanel src={VID2} from={F(32)} duration={F(4)} srcStart={F(4)} />
      </Sequence>

      {/* ── VIGNETTE ─────────────────────────────────────────── */}
      <Vignette />

      {/* ── CUT FLASHES ──────────────────────────────────────── */}
      {CUT_TIMES.map(s => <CutFlash key={s} atSec={s} />)}

      {/* ── TEXT OVERLAYS ────────────────────────────────────── */}
      <MemText text="וילי" sub="♦  לזכרו  ♦" fromSec={1} toSec={4.5} size={110} align="center" />
      <MemText text="משפחה" fromSec={10} toSec={12.5} size={70} align="bottom" />
      <MemText text="שנאהב תמיד" fromSec={18.5} toSec={22.5} size={72} align="bottom" />

      {/* ── TITLE CARD ─────────────────────────────────────────── */}
      {t >= 36 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 24,
          opacity: interpolate(frame, [F(36), F(36.8)], [0, 1], clamp(0)),
          zIndex: 40,
        }}>
          <div style={{ fontSize: 36, letterSpacing: 10, color: 'rgba(255,215,0,0.5)' }}>✦  ✦  ✦</div>
          <p style={{
            fontSize: 120, fontWeight: 900, color: '#FFFFFF', margin: 0,
            textShadow: '0 0 60px rgba(255,255,255,0.3)',
            fontFamily: '"Arial Black", Arial, "Noto Sans Hebrew", sans-serif',
            letterSpacing: 4,
          }}>וילי</p>
          <div style={{
            width: 200, height: 2,
            background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
          }} />
          <p style={{
            fontSize: 44, fontWeight: 400, color: 'rgba(255,255,255,0.85)', margin: 0,
            fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
            direction: 'rtl', letterSpacing: 3,
            textShadow: '0 1px 20px rgba(0,0,0,0.8)',
          }}>יהי זכרו ברוך</p>
          <div style={{ fontSize: 32, letterSpacing: 10, color: 'rgba(255,215,0,0.5)', marginTop: 8 }}>✦  ✦  ✦</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
