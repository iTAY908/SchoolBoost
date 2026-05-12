import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

// ─── Fixed star positions ────────────────────────────────────────────────────
const STARS: { x: number; y: number }[] = [
  { x: 120, y: 80 }, { x: 340, y: 150 }, { x: 560, y: 60 }, { x: 780, y: 110 },
  { x: 950, y: 45 }, { x: 200, y: 260 }, { x: 430, y: 230 }, { x: 680, y: 200 },
  { x: 890, y: 175 }, { x: 60, y: 380 }, { x: 300, y: 420 }, { x: 510, y: 350 },
  { x: 730, y: 310 }, { x: 1010, y: 290 }, { x: 140, y: 550 }, { x: 400, y: 500 },
  { x: 620, y: 470 }, { x: 850, y: 440 }, { x: 970, y: 530 }, { x: 250, y: 620 },
];

// ─── Stair steps: feet-contact [x, y] ───────────────────────────────────────
const STEPS: [number, number][] = [
  [130, 1650], // 0: ground
  [245, 1570], // 1
  [360, 1490], // 2
  [475, 1410], // 3
  [590, 1330], // 4
  [705, 1250], // 5
  [820, 1170], // 6
  [935, 1090], // 7 (top)
  [990, 1090], // 8: top platform
];

// ─── Linear interpolation helper ─────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ─── Character SVG ────────────────────────────────────────────────────────────
interface CharProps {
  cx: number;
  cy: number;
  legAngle: number;
  triumphArms: boolean;
  lying: boolean;
  bodyRotation: number;
}

const CharacterSVG: React.FC<CharProps> = ({
  cx, cy, legAngle, triumphArms, lying, bodyRotation,
}) => {
  const outerTransform = lying
    ? `translate(${cx}, ${cy}) rotate(90)`
    : `translate(${cx}, ${cy}) rotate(${bodyRotation})`;

  return (
    <g transform={outerTransform}>
      {/* Shadow */}
      <ellipse cx="0" cy="6" rx="30" ry="10" fill="rgba(0,0,0,0.5)" />

      {/* Left leg */}
      <rect
        x="-14" y="-2" width="12" height="55" rx="6" fill="#1a2a4a"
        transform={`rotate(${legAngle}, 0, 0)`}
      />
      {/* Right leg */}
      <rect
        x="2" y="-2" width="12" height="55" rx="6" fill="#1a2a4a"
        transform={`rotate(${-legAngle}, 0, 0)`}
      />

      {/* Body (maroon shirt) */}
      <rect x="-20" y="-85" width="40" height="58" rx="12" fill="#7B1515" />

      {/* Left arm */}
      <rect
        x="-32" y="-82" width="11" height="45" rx="5" fill="#F5CBA7"
        transform={`rotate(${triumphArms ? -120 : -legAngle * 0.7}, -20, -72)`}
      />
      {/* Right arm */}
      <rect
        x="21" y="-82" width="11" height="45" rx="5" fill="#F5CBA7"
        transform={`rotate(${triumphArms ? 120 : legAngle * 0.7}, 20, -72)`}
      />

      {/* Neck */}
      <rect x="-7" y="-100" width="14" height="18" rx="5" fill="#F5CBA7" />

      {/* Head */}
      <circle cx="0" cy="-120" r="30" fill="#F5CBA7" />

      {/* Blonde curly hair */}
      <ellipse cx="0" cy="-146" rx="26" ry="14" fill="#C8971A" />
      <ellipse cx="-17" cy="-142" rx="12" ry="10" fill="#D4A835" />
      <ellipse cx="17" cy="-142" rx="12" ry="10" fill="#D4A835" />
      <ellipse cx="-8" cy="-151" rx="10" ry="9" fill="#D4A835" />
      <ellipse cx="8" cy="-151" rx="10" ry="9" fill="#C8971A" />
      <ellipse cx="-28" cy="-130" rx="8" ry="13" fill="#C8971A" />
      <ellipse cx="28" cy="-130" rx="8" ry="13" fill="#C8971A" />

      {/* Glasses (blue square) */}
      <rect x="-28" y="-128" width="22" height="15" rx="3"
        fill="none" stroke="#4A7DC4" strokeWidth="3" />
      <rect x="6" y="-128" width="22" height="15" rx="3"
        fill="none" stroke="#4A7DC4" strokeWidth="3" />
      <line x1="-6" y1="-120" x2="6" y2="-120" stroke="#4A7DC4" strokeWidth="2.5" />

      {/* Eyes */}
      <circle cx="-17" cy="-121" r="3" fill="#333" />
      <circle cx="17" cy="-121" r="3" fill="#333" />

      {/* Smile */}
      <path d="M-9,-109 Q0,-102 9,-109" stroke="#333" strokeWidth="2" fill="none" />
    </g>
  );
};

// ─── Motivational text helper ─────────────────────────────────────────────────
interface MotivTextProps {
  lf: number;
  startF: number;
  endF: number;
  text: string;
  fontSize?: number;
  color?: string;
  top?: number;
}

const MotivText: React.FC<MotivTextProps> = ({
  lf, startF, endF, text,
  fontSize = 58, color = '#FFFFFF', top = 120,
}) => {
  const fadeIn = interpolate(lf, [startF, startF + 18], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(lf, [endF - 18, endF], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = fadeIn * fadeOut;
  if (opacity <= 0) return null;
  return (
    <div style={{
      position: 'absolute',
      top,
      left: 0,
      width: '100%',
      textAlign: 'center',
      direction: 'rtl',
      fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
      fontSize,
      fontWeight: 900,
      color,
      opacity,
      textShadow: '0 0 24px rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.8)',
      padding: '0 40px',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const StairClimber: React.FC = () => {
  const lf = useCurrentFrame();
  useVideoConfig(); // width/height/fps available if needed

  // ── Overall fade in/out ──────────────────────────────────────────────────
  const sceneOpacity = interpolate(lf, [0, 20, 720, 750], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Twinkling stars ──────────────────────────────────────────────────────
  const starOpacities = STARS.map((_, i) =>
    0.4 + Math.abs(Math.sin(lf * 0.04 + i * 1.37)) * 0.6
  );

  // ── Character state defaults ─────────────────────────────────────────────
  let charX = STEPS[0][0];
  let charY = STEPS[0][1];
  let legAngle = 0;
  let bodyRotation = 0;
  let triumphArms = false;
  let lying = false;

  const landedX = STEPS[5][0] - 70; // where fall #1 lands

  // ── Phase 1 (F0–F30): Walk in from left ──────────────────────────────────
  if (lf >= 0 && lf < 30) {
    charX = interpolate(lf, [0, 30], [-80, STEPS[0][0]], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    charY = STEPS[0][1];
    legAngle = Math.sin(lf * 0.3) * 28;
  }

  // ── Phase 2 (F30–F120): Climb steps 0→5 (18f per step) ──────────────────
  else if (lf >= 30 && lf < 120) {
    const rel = lf - 30;
    const stepIdx = Math.min(4, Math.floor(rel / 18));
    const progress = (rel % 18) / 18;
    charX = lerp(STEPS[stepIdx][0], STEPS[stepIdx + 1][0], progress);
    charY = lerp(STEPS[stepIdx][1], STEPS[stepIdx + 1][1], progress);
    legAngle = Math.sin(lf * 0.35) * 28;
  }

  // ── Phase 3 (F120–F210): FALL off step 5 ─────────────────────────────────
  else if (lf >= 120 && lf < 210) {
    const fallF = lf - 120;
    charX = STEPS[5][0] + fallF * 1.5 - fallF * fallF * 0.08;
    charY = Math.min(1650, STEPS[5][1] + fallF * fallF * 0.14);
    bodyRotation = fallF * 5;
    legAngle = Math.sin(lf * 0.3) * 15;
  }

  // ── Phase 4 (F210–F270): Lying on ground, shake head ─────────────────────
  else if (lf >= 210 && lf < 270) {
    lying = true;
    charX = landedX;
    charY = 1650;
    bodyRotation = 90;
    legAngle = Math.sin(lf * 0.3) * 5;
  }

  // ── Phase 5 (F270–F330): Get up ──────────────────────────────────────────
  else if (lf >= 270 && lf < 330) {
    const upP = (lf - 270) / 60;
    charX = lerp(landedX, STEPS[0][0], upP);
    charY = lerp(1650, STEPS[0][1], upP);
    bodyRotation = lerp(90, 0, upP);
    legAngle = Math.sin(lf * 0.3) * 20;
  }

  // ── Phase 6 (F330–F450): Second climb (0→4 steps, 30f per step) ──────────
  else if (lf >= 330 && lf < 450) {
    const rel = lf - 330;
    const stepIdx = Math.min(3, Math.floor(rel / 30));
    const progress = Math.min(1, (rel % 30) / 30);
    charX = lerp(STEPS[stepIdx][0], STEPS[Math.min(4, stepIdx + 1)][0], progress);
    charY = lerp(STEPS[stepIdx][1], STEPS[Math.min(4, stepIdx + 1)][1], progress);
    legAngle = Math.sin(lf * 0.3) * 28;
  }

  // ── Phase 7 (F450–F510): FALL 2 (from step 4) ────────────────────────────
  else if (lf >= 450 && lf < 510) {
    const fallF = lf - 450;
    charX = STEPS[4][0] + fallF * 1.2;
    charY = Math.min(1650, STEPS[4][1] + fallF * fallF * 0.2);
    bodyRotation = fallF * 4;
    legAngle = Math.sin(lf * 0.3) * 12;
  }

  // ── Phase 8 (F510–F540): Quick get up ────────────────────────────────────
  else if (lf >= 510 && lf < 540) {
    const upP = (lf - 510) / 30;
    charX = lerp(STEPS[4][0] + 130, STEPS[0][0], upP);
    charY = lerp(1650, STEPS[0][1], upP);
    bodyRotation = lerp(60, 0, upP);
    legAngle = Math.sin(lf * 0.35) * 22;
  }

  // ── Phase 9 (F540–F660): FINAL CHARGE — all 8 steps (15f per step) ───────
  else if (lf >= 540 && lf < 660) {
    const rel = lf - 540;
    const stepIdx = Math.min(7, Math.floor(rel / 15));
    const progress = Math.min(1, (rel % 15) / 15);
    charX = lerp(STEPS[stepIdx][0], STEPS[stepIdx + 1][0], progress);
    charY = lerp(STEPS[stepIdx][1], STEPS[stepIdx + 1][1], progress);
    legAngle = Math.sin(lf * 0.45) * 35;
  }

  // ── Phase 10 (F660–F730): Triumph at top ─────────────────────────────────
  else if (lf >= 660 && lf < 730) {
    charX = STEPS[8][0];
    charY = STEPS[8][1] - Math.abs(Math.sin((lf - 660) * 0.12)) * 35;
    triumphArms = true;
    legAngle = Math.sin(lf * 0.2) * 8;
  }

  // ── Phase 11 (F730–F750): Fade (same as triumph) ─────────────────────────
  else if (lf >= 730) {
    charX = STEPS[8][0];
    charY = STEPS[8][1] - Math.abs(Math.sin((lf - 660) * 0.12)) * 35;
    triumphArms = true;
    legAngle = Math.sin(lf * 0.2) * 8;
  }

  // ── Staircase SVG paths ────────────────────────────────────────────────────
  // Each step N: tread top-left (STEPS[N-1][0], STEPS[N][1]),
  //              top-right (STEPS[N][0]+115, STEPS[N][1]),
  //              bottom-right (STEPS[N][0]+115, STEPS[N-1][1])
  const stepPolygons = STEPS.slice(1).map((step, i) => {
    const prev = STEPS[i];
    const x1 = prev[0];
    const y1 = step[1];
    const x2 = step[0] + 115;
    const y2 = step[1];
    const x3 = step[0] + 115;
    const y3 = prev[1];
    return `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x1},${y3}`;
  });

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 200,
      opacity: sceneOpacity,
      background: 'linear-gradient(180deg, #050510 0%, #0d1a3a 60%, #1a0530 100%)',
      overflow: 'hidden',
    }}>
      {/* ── Stars ── */}
      {STARS.map((star, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: star.x,
          top: star.y,
          width: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1.5,
          height: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1.5,
          borderRadius: '50%',
          background: '#FFFFFF',
          opacity: starOpacities[i],
        }} />
      ))}

      {/* ── Staircase + character SVG ── */}
      <svg
        width="1080"
        height="1920"
        viewBox="0 0 1080 1920"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <filter id="stairGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ground line */}
        <line
          x1="0" y1="1650" x2="1080" y2="1650"
          stroke="#44AAFF" strokeWidth="3" opacity="0.7"
        />

        {/* Stair steps */}
        {stepPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="rgba(70, 130, 200, 0.7)"
            stroke="#88CCFF"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 0 8px #44AAFF)' }}
          />
        ))}

        {/* Character */}
        <CharacterSVG
          cx={charX}
          cy={charY}
          legAngle={legAngle}
          triumphArms={triumphArms}
          lying={lying}
          bodyRotation={lying ? 0 : bodyRotation}
        />
      </svg>

      {/* ── Motivational text overlays ── */}
      <MotivText lf={lf} startF={150} endF={210} text="נפלת..." top={120} fontSize={58} />
      <MotivText lf={lf} startF={250} endF={300} text="אבל קמת!" top={120} fontSize={58} color="#FFD700" />
      <MotivText lf={lf} startF={445} endF={510} text="שוב?!" top={120} fontSize={70} color="#FF6B6B" />
      <MotivText lf={lf} startF={515} endF={540} text="אתה לא מוותר." top={120} fontSize={52} color="#88EEFF" />
      <MotivText lf={lf} startF={660} endF={730} text="הגעת לשיא! ✦" top={120} fontSize={58} color="#FFD700" />

      {/* ── Triumph title ── */}
      {lf >= 660 && lf < 730 && (
        <div style={{
          position: 'absolute',
          top: 210,
          left: 0,
          width: '100%',
          textAlign: 'center',
          direction: 'rtl',
          fontFamily: 'Arial, "Noto Sans Hebrew", sans-serif',
          fontSize: 55,
          fontWeight: 900,
          color: '#FFD700',
          textShadow: '0 0 20px #FFD700, 0 2px 8px rgba(0,0,0,0.8)',
          padding: '0 30px',
          boxSizing: 'border-box',
          opacity: interpolate(lf, [660, 678], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }}>
          כי אתה לא מוותר על החלומות שלך
        </div>
      )}
    </div>
  );
};
