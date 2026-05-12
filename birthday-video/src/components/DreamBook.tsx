import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface DreamBookProps {
  triggerAtSec: number;
}

const BOOK_W = 560;
const BOOK_H = 420;
const SPINE_W = 22;
const PAGE_W = (BOOK_W - SPINE_W) / 2;

// Dreams list: [startFrame, text, isHeader, isItalic]
const DREAMS: Array<{
  start: number;
  text: string;
  header: boolean;
  italic: boolean;
  fontSize: number;
}> = [
  { start: 95,  text: '✦ החלומות שלי ✦',        header: true,  italic: false, fontSize: 22 },
  { start: 120, text: '✧ להיות בעל עסק',          header: false, italic: false, fontSize: 19 },
  { start: 145, text: '✧ להתנסות בדברים',         header: false, italic: false, fontSize: 19 },
  { start: 170, text: '✧ לבנות עתיד מוצלח',       header: false, italic: false, fontSize: 19 },
  { start: 195, text: '✧ לדעת לעמוד על שלי',      header: false, italic: false, fontSize: 19 },
  { start: 220, text: '✧ משמעת עצמית',            header: false, italic: false, fontSize: 19 },
  { start: 245, text: '✧ בריאות ואושר',           header: false, italic: false, fontSize: 19 },
  { start: 270, text: '✧ ...ועוד רבים',           header: false, italic: true,  fontSize: 17 },
];

export const DreamBook: React.FC<DreamBookProps> = ({ triggerAtSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = 14 * fps; // 420 frames = 14 seconds
  const localFrame = frame - triggerAtSec * fps;

  if (localFrame < 0 || localFrame > totalFrames) return null;

  // ── Entrance: book scales up (F0–20) ─────────────────────────────────────
  const entranceSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const bookScale = interpolate(entranceSpring, [0, 1], [0.3, 1]);
  const bookOpacity = interpolate(localFrame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Cover opens (F45–90): rotateY 0° → −152° ─────────────────────────────
  const coverOpenSpring = spring({
    frame: Math.max(0, localFrame - 45),
    fps,
    config: { damping: 14, stiffness: 80, mass: 1.2 },
  });
  const coverAngle = interpolate(coverOpenSpring, [0, 1], [0, -152]);

  // ── Inside content opacity (F90–110) ─────────────────────────────────────
  const contentOpacity = interpolate(localFrame, [90, 110], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Fade out (F360–420) ───────────────────────────────────────────────────
  const overallOpacity = interpolate(localFrame, [360, 420], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Breathing glow pulse ──────────────────────────────────────────────────
  const glowPulse = Math.sin(localFrame * 0.09) * 8 + 20;
  const breathe = Math.sin(localFrame * 0.06) * 0.008 + 1;

  // ── Star rotation for right page ─────────────────────────────────────────
  const starRotation = localFrame * 1.2;

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
        background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.18) 0%, transparent 70%)',
        filter: `blur(${glowPulse}px)`,
        transform: `scale(${bookScale * breathe})`,
      }} />

      {/* ── BOOK CONTAINER (3D perspective) ── */}
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
            background: 'linear-gradient(90deg, #070720, #14146b, #070720)',
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
            }}>
              חלומות
            </div>
          </div>

          {/* ── BACK COVER + INNER PAGES (always visible) ── */}
          <div style={{
            position: 'absolute',
            left: SPINE_W, top: 0,
            width: BOOK_W - SPINE_W, height: BOOK_H,
            background: 'linear-gradient(135deg, #f5f0e8 0%, #ede4d0 100%)',
            borderRadius: '0 6px 6px 0',
            overflow: 'hidden',
            display: 'flex',
          }}>

            {/* Left inner page — dreams list */}
            <div style={{
              width: PAGE_W, height: '100%',
              borderRight: '1px solid rgba(180,140,80,0.4)',
              background: 'linear-gradient(135deg, #f0ead8 0%, #e8dfc8 100%)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              padding: '18px 16px 18px 10px',
              gap: 6,
              opacity: contentOpacity,
              direction: 'rtl',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              boxSizing: 'border-box',
            }}>
              {DREAMS.map((dream, i) => {
                const lineOpacity = interpolate(localFrame, [dream.start, dream.start + 20], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                return (
                  <div key={i} style={{
                    opacity: lineOpacity,
                    fontSize: dream.fontSize,
                    fontWeight: dream.header ? 900 : 400,
                    fontStyle: dream.italic ? 'italic' : 'normal',
                    color: dream.header ? '#B8860B' : '#2a1a00',
                    textAlign: 'right',
                    direction: 'rtl',
                    lineHeight: 1.3,
                    width: '100%',
                    fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                  }}>
                    {dream.text}
                  </div>
                );
              })}
            </div>

            {/* Right inner page */}
            <div style={{
              width: PAGE_W, height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 20, gap: 10,
              opacity: contentOpacity,
            }}>
              {/* Rotating star border */}
              <div style={{
                fontSize: 60, lineHeight: 1,
                transform: `rotate(${starRotation}deg)`,
                display: 'inline-block',
                filter: `drop-shadow(0 0 ${glowPulse * 0.5}px #FFD700)`,
              }}>
                ⭐
              </div>

              <div style={{
                fontSize: 50, fontWeight: 900, color: '#FFD700',
                textShadow: `0 0 ${glowPulse}px #FFD700, 0 0 40px #FFD70066`,
                fontFamily: '"Arial Black", Arial, sans-serif',
                lineHeight: 1,
              }}>
                16 שנה
              </div>

              <div style={{
                width: 80, height: 1,
                background: 'linear-gradient(90deg, transparent, #B8860B, transparent)',
              }} />

              <div style={{
                fontSize: 18, color: '#3a2a00',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', textAlign: 'center',
                lineHeight: 1.5,
              }}>
                כל חלום מתחיל
              </div>

              <div style={{
                fontSize: 18, color: '#3a2a00',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', textAlign: 'center',
                lineHeight: 1.5,
              }}>
                בצעד אחד קדימה
              </div>

              <div style={{
                fontSize: 22, fontWeight: 900, color: '#FFD700',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl',
                textShadow: `0 0 12px #FFD70088`,
              }}>
                ✦ איתי ✦
              </div>
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
              background: 'linear-gradient(135deg, #0a0a2e 0%, #1a1060 40%, #0d0d40 100%)',
              borderRadius: '0 6px 6px 0',
              backfaceVisibility: 'hidden',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 14, padding: 24,
              boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.4), inset 4px 0 8px rgba(255,255,255,0.03)',
            }}>
              {/* Gold double border */}
              <div style={{
                position: 'absolute', inset: 12,
                border: '2px solid rgba(255,215,0,0.6)',
                borderRadius: 4,
              }} />
              <div style={{
                position: 'absolute', inset: 17,
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: 2,
              }} />

              {/* Cover title */}
              <div style={{
                fontSize: 22, fontWeight: 900, color: '#FFD700',
                textShadow: '0 0 15px #FFD700, 0 1px 3px rgba(0,0,0,0.8)',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', letterSpacing: 3, zIndex: 1,
              }}>
                ✦ ספר החלומות ✦
              </div>

              {/* Large star emoji */}
              <div style={{
                fontSize: 90, lineHeight: 1, zIndex: 1,
                filter: `drop-shadow(0 0 ${glowPulse}px #FFD700)`,
              }}>
                🌟
              </div>

              {/* Subtitle */}
              <div style={{
                fontSize: 18, color: 'rgba(255,215,0,0.85)',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', letterSpacing: 4, zIndex: 1,
              }}>
                ✦ איתי ✦
              </div>
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
              <div style={{
                fontSize: 14, color: '#8B6914',
                fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
                direction: 'rtl', opacity: 0.5,
              }}>
                פנים הכריכה
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
