import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fontFamily } from "../font";
import { P } from "../pitch/theme";
import { AnimeBlast, AnimeBomb } from "./AnimeBomb";
import { CameraSim } from "./CameraSim";
import {
  BOMB_IN,
  CAM_IN,
  CUES,
  CUT_AT,
  FOLLOW_AT,
  HEIGHT,
  SIDE_AT,
  Track,
  WIDTH,
  f,
} from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pad = (i: number) => String(i).padStart(5, "0");

/**
 * חומר הגלם (ב-.gitignore, מופק ע"י scripts/instr/):
 *   public/source/instr/bg/NNNNN.jpg      — פריימי המקור
 *   public/source/instr/person/NNNNN.png  — המסכה של הדובר (RGBA)
 *   public/source/instr/track-smooth.json — מעקב ראש + מעקב מצלמה
 *   public/source/instr/audio.m4a         — פס הקול המקורי
 */
const SRC = "source/instr";

type Props = {
  track: Track | null;
  /** "base" = בלי חיתוך רקע ובלי הדמיה — חומר הגלם לגרסת העיגול ב-HyperFrames */
  variant?: "full" | "base";
};

export const calculateInstrMetadata: CalculateMetadataFunction<Props> =
  async ({ props }) => {
    const res = await fetch(staticFile(`${SRC}/track-smooth.json`));
    return { props: { ...props, track: (await res.json()) as Track } };
  };

/** הפצצה מתפוצצת ממש לפני חיתוך הרקע */
const BOOM_AT = CUT_AT - 12;
/** עוגן הפצצה בפריים שבו הופיעה; מכאן היא זזה רק עם הרקע */
const BOMB_ANCHOR = { x: 230, y: 250 };

/** טרנספורמציית הדובר בחלק השני — מוקטן ומוזז לצד ימין */
const personXf = (frame: number) => {
  const p = interpolate(frame, [SIDE_AT, SIDE_AT + 20], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  return { s: 1 - 0.3 * p, tx: 320 * p };
};
const applyXf = (x: number, y: number, xf: { s: number; tx: number }) => ({
  x: WIDTH / 2 + (x - WIDTH / 2) * xf.s + xf.tx,
  y: HEIGHT + (y - HEIGHT) * xf.s,
});

const avg = (a: number[], from: number, to: number) => {
  const s = a.slice(from, to);
  return s.reduce((x, y) => x + y, 0) / s.length;
};

const Caption: React.FC<{ frame: number; track: Track; base: boolean }> = ({
  frame,
  track,
  base,
}) => {
  const t = frame / 30;
  const cue = CUES.find((c) => t >= c.from && t < c.to);
  if (!cue) return null;
  const age = frame - f(cue.from);

  // 0–8s: מאחוריו במקום קבוע; מ-8.68s: עוקב אחרי הראש
  const follow = interpolate(frame, [FOLLOW_AT, FOLLOW_AT + 10], [0, 1], clamp);
  const i = Math.min(frame, track.n - 1);
  const fixedX = avg(track.cx, 0, FOLLOW_AT);
  const fixedTop = avg(track.top, 0, FOLLOW_AT);
  const hx = fixedX + (track.cx[i] - fixedX) * follow;
  const htop = fixedTop + (track.top[i] - fixedTop) * follow;

  const xf = base ? { s: 1, tx: 0 } : personXf(frame);
  const side = xf.tx > 1;
  const head = applyXf(hx, htop, xf);
  // בגרסת העיגול (HyperFrames) — מהחיתוך הכתובית צרה יותר כדי להיכנס לעיגול
  const inCircle = base && frame >= CUT_AT;
  const maxW = side ? 580 : inCircle ? 700 : 1000;
  const half = maxW / 2;
  // בחלק השני הכתובית נשארת בעמודה הימנית ולא נוגעת בתוויות החלקים
  const minX = side ? 470 + half : half + 20;
  const x = Math.min(Math.max(head.x, minX), WIDTH - half - 20);
  // תחתית הטקסט נכנסת מעט אל מתחת לקודקוד — השיער מסתיר אותה
  const bottom = head.y + (side ? 30 : 48) * xf.s;

  const pop = interpolate(age, [0, 7], [0.6, 1], {
    ...clamp,
    easing: Easing.bezier(0.2, 1.7, 0.4, 1),
  });
  const o = interpolate(age, [0, 3], [0, 1], clamp);
  const size = (side ? 80 : inCircle ? 96 : 124) * (cue.text.length > 16 ? 0.86 : 1);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: bottom,
        width: maxW,
        translate: "-50% -100%",
        transformOrigin: "50% 100%",
        scale: String(pop),
        opacity: o,
        direction: "rtl",
        textAlign: "center",
        fontFamily,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.02,
        color: P.gold,
        WebkitTextStroke: `16px ${P.ink}`,
        paintOrder: "stroke fill",
        filter: "drop-shadow(0 10px 18px rgba(14,5,36,0.45))",
      }}
    >
      {cue.text}
    </div>
  );
};

const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = (frame - CUT_AT) * 1.2;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 70% 45%, ${P.violet} 0%, ${P.deep} 45%, ${P.ink} 100%)`,
      }}
    >
      {/* רצפת רשת בפרספקטיבה */}
      <div
        style={{
          position: "absolute",
          left: -600,
          right: -600,
          top: 1180,
          height: 1400,
          transform: "perspective(700px) rotateX(62deg)",
          transformOrigin: "50% 0%",
          backgroundImage: `linear-gradient(rgba(168,85,247,0.55) 2px, transparent 2px), linear-gradient(90deg, rgba(168,85,247,0.55) 2px, transparent 2px)`,
          backgroundSize: "90px 90px",
          backgroundPosition: `0px ${drift}px`,
          maskImage: "linear-gradient(transparent, #000 30%)",
        }}
      />
      {/* רשת עדינה ברקע */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(196,181,253,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(196,181,253,0.07) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </AbsoluteFill>
  );
};

/** תג "מצב הדמיה" ופינות HUD */
const Hud: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [CAM_IN, CAM_IN + 12], [0, 1], clamp);
  const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0.25;
  const corner = (pos: React.CSSProperties, rot: number) => (
    <div
      style={{
        position: "absolute",
        width: 70,
        height: 70,
        borderTop: `6px solid ${P.cyan}`,
        borderLeft: `6px solid ${P.cyan}`,
        rotate: `${rot}deg`,
        opacity: 0.8,
        ...pos,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {corner({ left: 36, top: 36 }, 0)}
      {corner({ right: 36, top: 36 }, 90)}
      {corner({ right: 36, bottom: 36 }, 180)}
      {corner({ left: 36, bottom: 36 }, 270)}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 150,
          display: "flex",
          alignItems: "center",
          gap: 14,
          direction: "rtl",
          fontFamily,
          fontWeight: 900,
          fontSize: 40,
          color: P.cyan,
          letterSpacing: 1,
        }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 10, background: "#EF4444", opacity: blink }} />
        מצב הדמיה
      </div>
    </AbsoluteFill>
  );
};

export const InstrVideo: React.FC<Props> = ({ track, variant = "full" }) => {
  const frame = useCurrentFrame();
  if (!track) return null;
  const base = variant === "base";
  const i = Math.min(frame, track.n - 1);
  const cut = !base && frame >= CUT_AT;
  const xf = base ? { s: 1, tx: 0 } : personXf(frame);

  // הפצצה נעולה לעולם: מיקומה = עוגן + תזוזת הרקע מאז שהופיעה
  const bombVisible = frame >= BOMB_IN && frame < CUT_AT;
  const bx = BOMB_ANCHOR.x + (track.camx[i] - track.camx[BOMB_IN]);
  const by = BOMB_ANCHOR.y + (track.camy[i] - track.camy[BOMB_IN]);
  const boom = interpolate(frame, [BOOM_AT - 18, BOOM_AT], [0, 1], clamp);
  const blast = interpolate(frame, [BOOM_AT, CUT_AT + 6], [0, 1], clamp);
  const whiteout = base ? 0 : interpolate(frame, [CUT_AT - 3, CUT_AT, CUT_AT + 10], [0, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: P.ink }}>
      {/* 1. רקע — החדר המקורי, ואחרי החיתוך רקע מעוצב */}
      {cut ? (
        <Backdrop frame={frame} />
      ) : (
        <Img src={staticFile(`${SRC}/bg/${pad(i)}.jpg`)} style={{ width: WIDTH, height: HEIGHT }} />
      )}

      {/* 2. פצצת אנימה — מאחוריו, נעולה לקיר */}
      {bombVisible && (
        <div style={{ position: "absolute", left: bx, top: by, opacity: frame < BOOM_AT ? 1 : 0 }}>
          <AnimeBomb age={frame - BOMB_IN} boom={boom} />
        </div>
      )}
      {blast > 0 && blast < 1 && (
        <div style={{ position: "absolute", left: bx, top: by }}>
          <AnimeBlast t={blast} />
        </div>
      )}

      {/* 3. כתוביות — מאחוריו */}
      <Caption frame={frame} track={track} base={base} />

      {/* 4. הדובר עצמו (המסכה) — מעל הכתוביות והפצצה */}
      <Img
        src={staticFile(`${SRC}/person/${pad(i)}.png`)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: WIDTH,
          height: HEIGHT,
          transformOrigin: "50% 100%",
          translate: `${xf.tx}px 0px`,
          scale: String(xf.s),
          filter: cut ? `drop-shadow(0 0 22px ${P.glow})` : undefined,
        }}
      />

      {/* 5. החלק השני — HUD והדמיית המצלמה המתפרקת */}
      {cut && <Hud frame={frame} />}
      {!base && <CameraSim frame={frame} />}

      {/* הבזק לבן במעבר */}
      <AbsoluteFill style={{ background: "#fff", opacity: whiteout, pointerEvents: "none" }} />

      <Audio src={staticFile(`${SRC}/audio.m4a`)} />
    </AbsoluteFill>
  );
};
