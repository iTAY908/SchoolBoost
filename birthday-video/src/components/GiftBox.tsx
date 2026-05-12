import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface GiftBoxProps {
  triggerAtSec: number;
}

export const GiftBox: React.FC<GiftBoxProps> = ({ triggerAtSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - triggerAtSec * fps;

  if (localFrame < 0 || localFrame > 840) return null;

  // ─── Phase 1: Box falls from sky (F0–F60) ───────────────────────────────────
  const dropSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 2 },
  });
  const boxY = interpolate(dropSpring, [0, 1], [-200, 960]);
  const boxOpacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const boxX = 540;

  // ─── Phase 2: Box bounces/jiggles (F60–F120) ────────────────────────────────
  const jiggleProgress = Math.max(0, localFrame - 60);
  const scaleX = 1 + Math.sin(jiggleProgress * 0.3) * 0.06;
  const scaleY = 1 - Math.sin(jiggleProgress * 0.3) * 0.06;
  const boxRotation = Math.sin(jiggleProgress * 0.25) * 4;

  // ─── Phase 3: Lid pops off (F120–F200) ──────────────────────────────────────
  const lidRotateX = interpolate(localFrame, [120, 160], [0, -160], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lidY = interpolate(localFrame, [120, 200], [0, -300], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lidOpacity = interpolate(localFrame, [150, 200], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── Phase 4: Note slides out of box (F160–F240) ────────────────────────────
  const noteExitY = interpolate(localFrame, [160, 240], [980, 400], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const noteExitScale = interpolate(localFrame, [160, 240], [0.3, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const noteExitRotation = Math.sin((localFrame - 160) * 0.1) * 8;

  // ─── Phase 5: Note zooms to camera (F240–F360) ──────────────────────────────
  const noteZoomScale = interpolate(localFrame, [240, 360], [0.7, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const noteZoomY = interpolate(localFrame, [240, 360], [400, 960], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const noteZoomRotation = interpolate(localFrame, [240, 360], [noteExitRotation, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── Phase 6: Note holds on screen (F360–F780) ──────────────────────────────
  const breathingScale = 1 + Math.sin(localFrame * 0.04) * 0.01;

  // ─── Phase 7: Note fades (F780–F840) ────────────────────────────────────────
  const noteOpacity = interpolate(localFrame, [780, 840], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── Composite note position/scale/rotation ──────────────────────────────────
  let noteY: number;
  let noteScale: number;
  let noteRotation: number;

  if (localFrame < 240) {
    noteY = noteExitY;
    noteScale = noteExitScale;
    noteRotation = noteExitRotation;
  } else if (localFrame < 360) {
    noteY = noteZoomY;
    noteScale = noteZoomScale;
    noteRotation = noteZoomRotation;
  } else {
    noteY = 960;
    noteScale = breathingScale;
    noteRotation = 0;
  }

  // ─── Sparkle particles (F120–F200) ──────────────────────────────────────────
  const sparkleColors = ['#FF6B6B', '#FFD700', '#00E5FF', '#FF69B4', '#7CFF7C', '#FF8C00', '#DA70D6', '#00FFCC'];
  const sparkleOpacity = interpolate(localFrame, [120, 200], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sparkleProgress = interpolate(localFrame, [120, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sparkles = sparkleColors.map((color, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const distance = sparkleProgress * 200;
    const sx = boxX + Math.cos(angle) * distance;
    const sy = boxY - 20 + Math.sin(angle) * distance;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: sx - 10,
          top: sy - 10,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color,
          opacity: sparkleOpacity,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
    );
  });

  // ─── Background overlay (after F200) ────────────────────────────────────────
  const backdropOpacity = interpolate(localFrame, [200, 260], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      {/* Dark backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          opacity: backdropOpacity,
        }}
      />

      {/* Sparkle particles */}
      {localFrame >= 120 && localFrame <= 200 && sparkles}

      {/* Gift box body */}
      <div
        style={{
          position: 'absolute',
          left: boxX - 140,
          top: boxY,
          width: 280,
          height: 240,
          background: 'linear-gradient(135deg, #CC2233 0%, #991122 50%, #CC2233 100%)',
          borderRadius: '0 0 16px 16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.2)',
          transform: `scaleX(${scaleX}) scaleY(${scaleY}) rotate(${boxRotation}deg)`,
          transformOrigin: 'center bottom',
          opacity: boxOpacity,
        }}
      >
        {/* Ribbon vertical */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 36,
            marginLeft: -18,
            background: 'linear-gradient(90deg, #FFD700, #FFF8B0, #FFD700)',
            boxShadow: '0 0 12px rgba(255,215,0,0.6)',
          }}
        />
      </div>

      {/* Gift box lid */}
      <div
        style={{
          position: 'absolute',
          left: boxX - 150,
          top: boxY - 70 + lidY,
          width: 300,
          height: 80,
          background: 'linear-gradient(135deg, #DD3344 0%, #BB1122 100%)',
          borderRadius: '12px 12px 0 0',
          transform: `rotateX(${lidRotateX}deg) rotate(${boxRotation}deg)`,
          transformOrigin: 'center bottom',
          perspective: '400px',
          opacity: lidOpacity * boxOpacity,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Ribbon horizontal on lid */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 30,
            marginTop: -15,
            background:
              'linear-gradient(90deg, transparent 0%, #FFD700 30%, #FFF8B0 50%, #FFD700 70%, transparent 100%)',
          }}
        />
        {/* Bow at top center */}
        <div
          style={{
            position: 'absolute',
            top: -30,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 60,
          }}
        >
          🎀
        </div>
      </div>

      {/* The note / letter */}
      {localFrame >= 160 && (
        <div
          style={{
            position: 'absolute',
            left: 540 - 350,
            top: noteY - 450,
            width: 700,
            height: 900,
            background: 'linear-gradient(170deg, #FFFDE7 0%, #FFF9C4 50%, #FFFDE7 100%)',
            borderRadius: 8,
            boxShadow: '0 20px 80px rgba(0,0,0,0.8), 0 0 0 2px rgba(180,140,60,0.4)',
            transform: `scale(${noteScale}) rotate(${noteRotation}deg)`,
            transformOrigin: 'center center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 50,
            gap: 20,
            opacity: noteOpacity,
            boxSizing: 'border-box',
          }}
        >
          {/* Top decoration */}
          <div style={{ fontSize: 50 }}>💌</div>

          {/* Heading */}
          <p
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#8B4513',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            מכתב לאיתי 🎂
          </p>

          {/* Divider */}
          <div
            style={{
              width: 200,
              height: 2,
              background: 'linear-gradient(90deg,transparent,#b8860b,transparent)',
            }}
          />

          {/* Line 1 */}
          <p
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#4a2000',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              lineHeight: 1.8,
              opacity: interpolate(localFrame, [360, 400], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            כמו שאני תמיד אומר –
          </p>

          {/* Line 2 */}
          <p
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#4a2000',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              lineHeight: 1.8,
              opacity: interpolate(localFrame, [400, 440], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            אין צורך במתנה
          </p>

          {/* Line 3 – emphasis */}
          <p
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: '#8B1A1A',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              lineHeight: 1.5,
              opacity: interpolate(localFrame, [440, 480], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              textShadow: '0 0 20px rgba(139,26,26,0.3)',
            }}
          >
            בגיל 16
          </p>

          {/* Line 4 */}
          <p
            style={{
              fontSize: 28,
              color: '#4a2000',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              lineHeight: 1.8,
              opacity: interpolate(localFrame, [480, 520], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            יש בנק על שמך
          </p>

          {/* Line 5 */}
          <p
            style={{
              fontSize: 28,
              color: '#4a2000',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              lineHeight: 1.8,
              opacity: interpolate(localFrame, [520, 560], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            ותעודת זהות! 🎉
          </p>

          {/* Bottom divider */}
          <div
            style={{
              width: 200,
              height: 1,
              background: 'linear-gradient(90deg,transparent,#b8860b,transparent)',
              opacity: interpolate(localFrame, [560, 600], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />

          {/* Signature */}
          <p
            style={{
              fontSize: 22,
              color: '#8B6914',
              fontStyle: 'italic',
              direction: 'rtl',
              textAlign: 'center',
              fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
              margin: 0,
              opacity: interpolate(localFrame, [560, 600], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            ❤️ אוהבים אותך ❤️
          </p>
        </div>
      )}
    </div>
  );
};
