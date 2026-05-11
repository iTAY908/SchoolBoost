import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introDuration = fps * 4;

  // Background photo fade in
  const bgOpacity = interpolate(frame, [0, fps * 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "16" number big entrance
  const numberEntrance = spring({
    frame: frame - fps * 0.3,
    fps,
    config: { damping: 10, stiffness: 100, mass: 1.2 },
  });
  const numberScale = interpolate(numberEntrance, [0, 1], [0.2, 1]);
  const numberOpacity = interpolate(frame, [fps * 0.3, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title text slide up
  const titleEntrance = spring({
    frame: frame - fps * 1.0,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const titleY = interpolate(titleEntrance, [0, 1], [60, 0]);
  const titleOpacity = interpolate(frame, [fps * 1.0, fps * 1.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtitle
  const subtitleOpacity = interpolate(frame, [fps * 1.8, fps * 2.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pulse glow on number
  const pulse = Math.sin(frame * 0.1) * 0.03 + 1;

  // Overall fade out at end
  const overallOpacity = interpolate(frame, [introDuration - fps * 0.6, introDuration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: overallOpacity }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, opacity: bgOpacity }}>
        <Img
          src={staticFile('photos/60dc236f-1000065510.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%)',
          }}
        />
      </div>

      {/* Golden particles effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, rgba(255,215,0,0.08) 0%, transparent 70%)`,
        }}
      />

      {/* "16" big number */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
        }}
      >
        <div
          style={{
            opacity: numberOpacity,
            transform: `scale(${numberScale * pulse})`,
          }}
        >
          <span
            style={{
              fontSize: 320,
              fontWeight: 900,
              color: '#FFD700',
              textShadow: '0 0 60px #FFD700, 0 0 120px #FFD70066, 0 4px 30px rgba(0,0,0,0.9)',
              fontFamily: 'Arial Black, Arial, sans-serif',
              lineHeight: 0.9,
              display: 'block',
            }}
          >
            16
          </span>
        </div>

        {/* "יום הולדת שמח" */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginTop: -20,
          }}
        >
          <p
            style={{
              fontSize: 90,
              fontWeight: 900,
              color: '#FFFFFF',
              textShadow: '0 0 30px rgba(255,215,0,0.5), 0 2px 20px rgba(0,0,0,0.9)',
              margin: 0,
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              direction: 'rtl',
              letterSpacing: 2,
            }}
          >
            יום הולדת שמח
          </p>
        </div>

        {/* Name */}
        <div style={{ opacity: subtitleOpacity, marginTop: 20 }}>
          <p
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: '#FFD700',
              textShadow: '0 0 20px rgba(255,215,0,0.7), 0 2px 15px rgba(0,0,0,0.9)',
              margin: 0,
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              direction: 'rtl',
              letterSpacing: 4,
            }}
          >
            ✨ איתי ✨
          </p>
        </div>
      </div>
    </div>
  );
};
