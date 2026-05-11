import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface Card {
  text: string;
  subtext?: string;
  startSec: number;
  endSec: number;
  color: string;
  emoji: string;
  size?: number;
}

const CARDS: Card[] = [
  { text: 'המלך', subtext: 'איתי', startSec: 10, endSec: 15, color: '#FFD700', emoji: '👑', size: 110 },
  { text: 'גיל 16', subtext: 'מזל טוב!', startSec: 28, endSec: 33, color: '#FF88DD', emoji: '🎂', size: 100 },
  { text: 'ספורטאי', subtext: 'מוטוקרוס #22', startSec: 46, endSec: 51, color: '#FF8800', emoji: '🏍️', size: 90 },
  { text: 'חבר', subtext: 'מהלב', startSec: 64, endSec: 69, color: '#44AAFF', emoji: '❤️', size: 100 },
  { text: 'כוכב', subtext: 'שיאיר חזק', startSec: 82, endSec: 87, color: '#CC44FF', emoji: '⭐', size: 100 },
  { text: 'הצלחה', subtext: 'בכל הדרכים', startSec: 100, endSec: 105, color: '#44EE88', emoji: '🚀', size: 90 },
  { text: 'יום הולדת', subtext: 'שמח איתי! 🎊', startSec: 119, endSec: 124, color: '#FFD700', emoji: '🎉', size: 90 },
  { text: 'אין כמוך', subtext: '16 שנה מדהים', startSec: 138, endSec: 143, color: '#FF4466', emoji: '💫', size: 90 },
  { text: '16 🎂', subtext: 'שנה מושלמת', startSec: 156, endSec: 162, color: '#FFD700', emoji: '✨', size: 110 },
];

const Card: React.FC<{ card: Card }> = ({ card }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = card.startSec * fps;
  const endFrame = card.endSec * fps;
  const localFrame = frame - startFrame;
  const duration = endFrame - startFrame;

  if (localFrame < 0 || localFrame > duration) return null;

  const entrance = spring({ frame: localFrame, fps, config: { damping: 10, stiffness: 120, mass: 0.8 } });
  const scaleIn = interpolate(entrance, [0, 1], [0.3, 1]);
  const rotateIn = interpolate(entrance, [0, 1], [-8, 0]);

  const exitProgress = interpolate(localFrame, [duration - fps * 0.5, duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(exitProgress, [0, 1], [1, 0]);
  const scaleOut = interpolate(exitProgress, [0, 1], [1, 1.15]);

  const pulse = Math.sin(localFrame * 0.1) * 0.02 + 1;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) scale(${scaleIn * scaleOut * pulse}) rotate(${rotateIn}deg)`,
      opacity,
      textAlign: 'center',
      zIndex: 20,
    }}>
      {/* Glowing background circle */}
      <div style={{
        position: 'absolute',
        inset: -40,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${card.color}22 0%, transparent 70%)`,
        filter: 'blur(20px)',
      }} />

      <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 8 }}>{card.emoji}</div>

      <div style={{
        fontSize: card.size ?? 100,
        fontWeight: 900,
        color: card.color,
        textShadow: `0 0 40px ${card.color}, 0 0 80px ${card.color}66, 0 4px 20px rgba(0,0,0,0.9)`,
        fontFamily: '"Arial Black", "Arial", "Noto Sans Hebrew", sans-serif',
        direction: 'rtl',
        lineHeight: 1.0,
        letterSpacing: -2,
      }}>
        {card.text}
      </div>

      {card.subtext && (
        <div style={{
          fontSize: 50,
          fontWeight: 700,
          color: '#FFFFFF',
          textShadow: '0 0 20px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.8)',
          fontFamily: '"Arial", "Noto Sans Hebrew", sans-serif',
          direction: 'rtl',
          marginTop: 8,
          letterSpacing: 2,
        }}>
          {card.subtext}
        </div>
      )}
    </div>
  );
};

export const CelebrationCards: React.FC = () => (
  <>
    {CARDS.map((card, i) => <Card key={i} card={card} />)}
  </>
);
