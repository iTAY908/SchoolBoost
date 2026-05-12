import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface Banner {
  text: string;
  startSec: number;
  endSec: number;
  position: 'top' | 'bottom';
  color: string;
}

const BANNERS: Banner[] = [
  { text: '🎉 איתי 🎉',           startSec: 27,  endSec: 31,  position: 'top',    color: '#FFD700' },
  { text: '★ HAPPY 16 ★',        startSec: 43,  endSec: 47,  position: 'bottom', color: '#FF88DD' },
  { text: '✦ המלך איתי ✦',       startSec: 68,  endSec: 72,  position: 'top',    color: '#FFD700' },
  { text: '🎂 16 יום הולדת 🎂',  startSec: 109, endSec: 113, position: 'bottom', color: '#44AAFF' },
  { text: '⭐ איתי לייס ⭐',      startSec: 136, endSec: 140, position: 'top',    color: '#44EE88' },
  { text: '🔥 מזל טוב! 🔥',      startSec: 153, endSec: 163, position: 'bottom', color: '#FFD700' },
];

const BannerItem: React.FC<{ banner: Banner }> = ({ banner }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const startFrame = banner.startSec * fps;
  const endFrame = banner.endSec * fps;
  const localFrame = frame - startFrame;
  const duration = endFrame - startFrame;

  if (localFrame < 0 || localFrame > duration) return null;

  const entrance = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 150 } });
  const slideY = interpolate(entrance, [0, 1], [banner.position === 'top' ? -100 : 100, 0]);
  const exitY = interpolate(
    localFrame, [duration - fps * 0.5, duration],
    [0, banner.position === 'top' ? -100 : 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = interpolate(localFrame, [duration - fps * 0.4, duration], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const glow = Math.sin(localFrame * 0.1) * 10 + 25;
  const scroll = (localFrame * 1.5) % (width * 2);

  return (
    <div style={{
      position: 'absolute',
      [banner.position]: 60,
      left: 0, right: 0,
      transform: `translateY(${slideY + exitY}px)`,
      opacity,
      zIndex: 30,
    }}>
      <div style={{
        background: `linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.7) 15%, rgba(0,0,0,0.7) 85%, transparent 100%)`,
        paddingTop: 16, paddingBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: -200 + scroll,
          width: 120,
          background: `linear-gradient(90deg, transparent, ${banner.color}44, transparent)`,
          transform: 'skewX(-20deg)',
        }} />

        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%',
          height: 2,
          background: `linear-gradient(90deg, transparent, ${banner.color}, transparent)`,
        }} />

        <p style={{
          fontSize: 58,
          fontWeight: 900,
          color: banner.color,
          textShadow: `0 0 ${glow}px ${banner.color}, 0 0 ${glow * 1.5}px ${banner.color}66, 0 2px 15px rgba(0,0,0,0.9)`,
          margin: 0,
          textAlign: 'center',
          fontFamily: '"Arial Black", "Arial", "Noto Sans Hebrew", sans-serif',
          direction: 'rtl',
          letterSpacing: 4,
        }}>
          {banner.text}
        </p>

        <div style={{
          position: 'absolute', bottom: 0, left: '10%', right: '10%',
          height: 2,
          background: `linear-gradient(90deg, transparent, ${banner.color}, transparent)`,
        }} />
      </div>
    </div>
  );
};

export const NameBanners: React.FC = () => (
  <>
    {BANNERS.map((b, i) => <BannerItem key={i} banner={b} />)}
  </>
);
