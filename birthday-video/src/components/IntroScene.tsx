import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';

export const IntroScene: React.FC<{ startSec?: number }> = ({ startSec = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lf = frame - startSec * fps; // localFrame
  const introDuration = fps * 5;

  if (lf < 0 || lf > introDuration + fps) return null;

  const bgOpacity = interpolate(lf, [0, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const numberEntrance = spring({
    frame: lf - fps * 0.5,
    fps,
    config: { damping: 12, stiffness: 80, mass: 1.5 },
  });
  const numberScale = interpolate(numberEntrance, [0, 1], [0.1, 1]);
  const numberOpacity = interpolate(lf, [fps * 0.5, fps * 1.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(lf, [fps * 1.8, fps * 2.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const titleY = interpolate(lf, [fps * 1.8, fps * 2.8], [30, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const nameOpacity = interpolate(lf, [fps * 2.8, fps * 3.6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const overallOpacity = interpolate(lf, [introDuration - fps * 1, introDuration], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const pulse = Math.sin(lf * 0.08) * 0.02 + 1;
  const glowIntensity = Math.sin(lf * 0.06) * 20 + 60;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: overallOpacity }}>
      <div style={{ position: 'absolute', inset: 0, opacity: bgOpacity }}>
        <Img
          src={staticFile('photos/60dc236f-1000065510.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.75) 100%)',
        }} />
      </div>

      {/* Animated golden ring behind 16 */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: numberOpacity,
      }}>
        <div style={{
          width: 420, height: 420, borderRadius: '50%',
          border: `3px solid rgba(255,215,0,${Math.sin(lf * 0.05) * 0.3 + 0.4})`,
          boxShadow: `0 0 ${glowIntensity}px rgba(255,215,0,0.3), inset 0 0 ${glowIntensity * 0.5}px rgba(255,215,0,0.1)`,
          transform: `scale(${numberScale * pulse})`,
          position: 'absolute',
        }} />
        <div style={{
          width: 380, height: 380, borderRadius: '50%',
          border: '1px solid rgba(255,215,0,0.2)',
          transform: `scale(${numberScale * pulse * 1.05}) rotate(${lf * 0.3}deg)`,
          position: 'absolute',
        }} />
      </div>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}>
        {/* "16" */}
        <div style={{
          opacity: numberOpacity,
          transform: `scale(${numberScale * pulse})`,
        }}>
          <span style={{
            fontSize: 280, fontWeight: 900, color: '#FFD700',
            textShadow: `0 0 ${glowIntensity}px #FFD700, 0 0 ${glowIntensity * 2}px #FFD70066, 0 0 ${glowIntensity * 0.5}px #FFF`,
            fontFamily: '"Arial Black", Arial, sans-serif',
            lineHeight: 0.9, display: 'block',
            letterSpacing: -8,
          }}>
            16
          </span>
        </div>

        {/* Divider line */}
        <div style={{
          opacity: titleOpacity,
          width: interpolate(lf, [fps * 1.8, fps * 2.6], [0, 300], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          height: 1,
          background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
          marginTop: 10, marginBottom: 20,
        }} />

        {/* "יום הולדת שמח" */}
        <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
          <p style={{
            fontSize: 72, fontWeight: 700, color: '#FFFFFF',
            textShadow: '0 0 40px rgba(255,215,0,0.6), 0 2px 30px rgba(0,0,0,0.9)',
            margin: 0, textAlign: 'center',
            fontFamily: '"Arial", "Noto Sans Hebrew", sans-serif',
            direction: 'rtl', letterSpacing: 4,
          }}>
            יום הולדת שמח
          </p>
        </div>

        {/* Name */}
        <div style={{ opacity: nameOpacity, marginTop: 16 }}>
          <p style={{
            fontSize: 52, fontWeight: 400, color: '#FFD700',
            textShadow: '0 0 30px rgba(255,215,0,0.8)',
            margin: 0, textAlign: 'center',
            fontFamily: '"Arial", "Noto Sans Hebrew", sans-serif',
            direction: 'rtl', letterSpacing: 12,
            textTransform: 'uppercase',
          }}>
            ✦ איתי ✦
          </p>
        </div>
      </div>
    </div>
  );
};
