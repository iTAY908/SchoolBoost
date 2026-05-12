import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface GreetingCardProps {
  triggerAtSec: number;
}

const BOOK_W = 560;
const BOOK_H = 420;
const SPINE_W = 22;
const PAGE_W = (BOOK_W - SPINE_W) / 2;

export const GreetingCard: React.FC<GreetingCardProps> = ({ triggerAtSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = 8 * fps; // 240 frames = 8 seconds
  const localFrame = frame - triggerAtSec * fps;

  if (localFrame < 0 || localFrame > totalFrames) return null;

  // === Entrance: book scales up (frames 0–20) ===
  const entranceSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const bookScale = interpolate(entranceSpring, [0, 1], [0.3, 1]);
  const bookOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // === Cover opens (frames 45–90): rotateY 0° → −150° ===
  const coverOpenEased = spring({
    frame: Math.max(0, localFrame - 45),
    fps,
    config: { damping: 14, stiffness: 80, mass: 1.2 },
  });
  const coverAngle = interpolate(coverOpenEased, [0, 1], [0, -152]);

  // === Inside content fades in (frames 90–150) ===
  const contentOpacity = interpolate(localFrame, [90, 130], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const line1Opacity = interpolate(localFrame, [95, 115], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line2Opacity = interpolate(localFrame, [110, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line3Opacity = interpolate(localFrame, [125, 145], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line4Opacity = interpolate(localFrame, [140, 158], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // === Fade out (frames 210–240) ===
  const overallOpacity = interpolate(localFrame, [210, 240], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Breathing glow pulse
  const glowPulse = Math.sin(localFrame * 0.09) * 8 + 22;
  const breathe = Math.sin(localFrame * 0.06) * 0.008 + 1;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: bookOpacity * overallOpacity,
      zIndex: 50,
    }}>
      {/* Dark backdrop blur */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
      }} />

      {/* Outer glow behind book */}
      <div style={{
        position: 'absolute',
        width: BOOK_W + 60, height: BOOK_H + 60,
        borderRadius: 8,
        background: `radial-gradient(ellipse at center, rgba(255,215,0,0.18) 0%, transparent 70%)`,
        filter: `blur(${glowPulse}px)`,
        transform: `scale(${bookScale * breathe})`,
      }} />

      {/* === BOOK CONTAINER (3D perspective) === */}
      <div style={{
        perspective: '1400px',
        transform: `scale(${bookScale * breathe})`,
      }}>
        <div style={{
          width: BOOK_W,
          height: BOOK_H,
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}>

          {/* ── SPINE ── */}
          <div style={{
            position: 'absolute',
            left: 0, top: 0,
            width: SPINE_W, height: BOOK_H,
            background: 'linear-gradient(90deg, #3d0a0a, #6b1212, #3d0a0a)',
            borderRadius: '4px 0 0 4px',
            zIndex: 5,
            boxShadow: '2px 0 8px rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontSize: 10, color: '#FFD700', fontWeight: 700,
              letterSpacing: 3, opacity: 0.8,
              fontFamily: 'Arial, sans-serif',
            }}>ברכות</div>
          </div>

          {/* ── BACK COVER + RIGHT PAGE (always visible) ── */}
          <div style={{
            position: 'absolute',
            left: SPINE_W, top: 0,
            width: BOOK_W - SPINE_W, height: BOOK_H,
            background: 'linear-gradient(135deg, #f5f0e8 0%, #ede4d0 100%)',
            borderRadius: '0 6px 6px 0',
            overflow: 'hidden',
            display: 'flex',
          }}>
            {/* Left inner page (inside of front cover, shows after open) */}
            <div style={{
              width: PAGE_W, height: '100%',
              borderRight: '1px solid rgba(180,140,80,0.4)',
              background: 'linear-gradient(135deg, #f0ead8 0%, #e8dfc8 100%)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 24, gap: 10,
              opacity: contentOpacity,
            }}>
              <div style={{ fontSize: 32, opacity: line1Opacity }}>✦</div>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#5c2e00', direction: 'rtl',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif', margin: 0, textAlign: 'center',
                opacity: line1Opacity, lineHeight: 1.4 }}>
                יום הולדת שמח
              </p>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#8B1A1A', direction: 'rtl',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif', margin: 0, textAlign: 'center',
                opacity: line2Opacity, textShadow: '0 0 12px rgba(139,26,26,0.4)' }}>
                ✦ איתי ✦
              </p>
              <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg, transparent, #b8860b, transparent)',
                opacity: line2Opacity }} />
              <p style={{ fontSize: 16, color: '#4a3000', direction: 'rtl',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif', margin: 0, textAlign: 'center',
                opacity: line3Opacity, lineHeight: 1.7 }}>
                בגיל 16 אתה<br />מיוחד, חזק,<br />ומלא עתיד ✨
              </p>
              <p style={{ fontSize: 16, color: '#4a3000', direction: 'rtl',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif', margin: 0, textAlign: 'center',
                opacity: line4Opacity, lineHeight: 1.7 }}>
                שתמשיך לדהור<br />קדימה! 🏍️
              </p>
            </div>

            {/* Right inner page */}
            <div style={{
              width: PAGE_W, height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 20, gap: 12,
              opacity: contentOpacity,
            }}>
              <div style={{ fontSize: 56, lineHeight: 1 }}>👑</div>
              <p style={{ fontSize: 44, fontWeight: 900, color: '#FFD700', margin: 0,
                textShadow: `0 0 ${glowPulse}px #FFD700, 0 0 40px #FFD70066`,
                fontFamily: '"Arial Black", Arial, sans-serif', lineHeight: 1,
                opacity: line2Opacity }}>
                16
              </p>
              <div style={{ fontSize: 28, opacity: line3Opacity, display: 'flex', gap: 6 }}>
                {'★★★'.split('').map((s, i) => (
                  <span key={i} style={{
                    color: '#FFD700',
                    textShadow: `0 0 10px #FFD700`,
                    transform: `rotate(${Math.sin(localFrame * 0.08 + i) * 8}deg)`,
                    display: 'inline-block',
                    opacity: interpolate(localFrame, [125 + i * 12, 145 + i * 12], [0, 1], {
                      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                    }),
                  }}>★</span>
                ))}
              </div>
              <p style={{ fontSize: 13, color: '#8B6914', direction: 'rtl',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif', margin: 0,
                textAlign: 'center', opacity: line4Opacity, letterSpacing: 1 }}>
                מאת כל מי שאוהב אותך ❤️
              </p>
            </div>
          </div>

          {/* ── FRONT COVER (rotates open) ── */}
          <div style={{
            position: 'absolute',
            left: SPINE_W, top: 0,
            width: BOOK_W - SPINE_W, height: BOOK_H,
            transformOrigin: 'left center',
            transform: `rotateY(${coverAngle}deg)`,
            transformStyle: 'preserve-3d',
          }}>
            {/* Outside face of cover */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #9b1f1f 0%, #6b0f0f 40%, #8b1a1a 100%)',
              borderRadius: '0 6px 6px 0',
              backfaceVisibility: 'hidden',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: 24,
              boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.3), inset 4px 0 8px rgba(255,255,255,0.05)',
            }}>
              {/* Golden border */}
              <div style={{
                position: 'absolute', inset: 12,
                border: '2px solid rgba(255,215,0,0.6)',
                borderRadius: 4,
              }} />
              <div style={{
                position: 'absolute', inset: 16,
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: 2,
              }} />

              {/* Cover title */}
              <p style={{ fontSize: 22, fontWeight: 900, color: '#FFD700', margin: 0,
                textShadow: `0 0 15px #FFD700, 0 1px 3px rgba(0,0,0,0.8)`,
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', letterSpacing: 3, zIndex: 1 }}>
                ✦ ספר ברכות ✦
              </p>

              {/* Big "16" embossed */}
              <p style={{ fontSize: 110, fontWeight: 900, color: '#FFD700', margin: 0,
                textShadow: `0 0 ${glowPulse}px #FFD700, 0 0 60px #FFD70066, 2px 2px 0 rgba(0,0,0,0.5)`,
                fontFamily: '"Arial Black", Arial, sans-serif', lineHeight: 1, zIndex: 1,
                letterSpacing: -4 }}>
                16
              </p>

              <p style={{ fontSize: 16, color: 'rgba(255,215,0,0.8)', margin: 0,
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', letterSpacing: 4, zIndex: 1 }}>
                ✦ איתי ✦
              </p>
            </div>

            {/* Inside face of cover (visible after full open) */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #f0ead8 0%, #e8dfc8 100%)',
              borderRadius: '0 6px 6px 0',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{ fontSize: 14, color: '#8B6914', fontFamily: 'Arial, sans-serif',
                direction: 'rtl', opacity: 0.5 }}>פנים הכריכה</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
