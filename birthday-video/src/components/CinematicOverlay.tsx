import React from 'react';
import { useCurrentFrame } from 'remotion';

export const CinematicOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle breathing grain
  const grainOffset = (frame * 97) % 1000;

  return (
    <>
      {/* Warm color grade overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(20,10,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(10,5,0,0.45) 100%)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Golden warm tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,180,50,0.06) 0%, rgba(120,60,0,0.08) 60%, rgba(0,0,0,0.18) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Heavy vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.80) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom gradient - draws eye upward */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '35%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '20%',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Film grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          backgroundPosition: `${grainOffset % 200}px ${(grainOffset * 1.3) % 200}px`,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
