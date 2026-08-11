import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { P } from "../../pitch/theme";

/**
 * ── Emphasis ────────────────────────────────────────────
 *
 * מבזק קטן שמדגיש פעימה — נועד לרוץ על מכה במוזיקה או על הרגע
 * שבו כרטיס נוחת. אין בו טקסט, אין בו נתון: רק אנרגיה.
 *
 * שלוש וריאציות:
 *   • `burst` — קווים שמתפרצים מהמרכז החוצה (ברירת מחדל)
 *   • `ring`  — טבעת אחת שמתרחבת ומתדקקת
 *   • `sweep` — הבזק אור אלכסוני שחוצה את האזור
 *
 * כל האנימציה מקובעת (clamp) בשני הקצוות — אפשר להרכיב את הרכיב
 * על חלון ארוך יותר מהמבזק עצמו: לפני `startFrame` הוא שקוף לגמרי,
 * ואחרי `durationInFrames` הוא נשאר שקוף.
 *
 * המבזק **לא** חוסם כלום: `pointerEvents: none` והוא תמיד קצר.
 */

export type EmphasisVariant = "burst" | "ring" | "sweep";

export type EmphasisProps = {
  /** מרכז האפקט — פיקסלים מהקצה השמאלי של הקנבס */
  x: number;
  /** מרכז האפקט — פיקסלים מראש הקנבס */
  y: number;
  /** קוטר האפקט בפיקסלים */
  size?: number;
  /** הפריים שבו המבזק יוצא, יחסית ל-Sequence העוטף */
  startFrame?: number;
  /** אורך המבזק בפריימים */
  durationInFrames?: number;
  variant?: EmphasisVariant;
  /** צבע הקווים/הטבעת */
  color?: string;
  /** מספר הקווים ב-`burst` */
  rays?: number;
  /** עוצמה כללית 0..1 — הורידו אם זה נלחם בדובר */
  intensity?: number;
  /** זווית ההבזק ב-`sweep`, במעלות */
  angle?: number;
  style?: React.CSSProperties;
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const Emphasis: React.FC<EmphasisProps> = ({
  x,
  y,
  size = 320,
  startFrame = 0,
  durationInFrames = 20,
  variant = "burst",
  color = P.gold,
  rays = 9,
  intensity = 1,
  angle = -24,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const span = Math.max(2, durationInFrames);

  /** ההתקדמות 0..1 — יוצאת מהר ונרגעת */
  const p = interpolate(local, [0, span], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  /** דהייה: עולה בשלושה פריימים ואז נעלמת עד סוף החלון */
  const fade =
    interpolate(local, [0, 3], [0, 1], clamp) *
    interpolate(local, [span * 0.35, span], [1, 0], clamp) *
    intensity;

  if (fade <= 0) {
    return null;
  }

  return (
    <Interactive.Div
      name={`Emphasis-${variant}`}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        translate: "-50% -50%",
        pointerEvents: "none",
        opacity: fade,
        ...style,
      }}
    >
      {variant === "sweep" ? (
        <Sweep p={p} size={size} color={color} angle={angle} />
      ) : null}

      {variant === "ring" ? <Ring p={p} size={size} color={color} /> : null}

      {variant === "burst"
        ? Array.from({ length: rays }, (_, i) => {
            const a = (360 / rays) * i + 8;
            /* קווים ארוכים ודקים — "קווי מהירות", לא נקודות מפוזרות.
               הסירוגין קטן בכוונה: מספיק כדי שזה לא ייראה שמש,
               לא מספיק כדי שזה ייראה קונפטי. */
            const odd = i % 2 === 1;
            const dist =
              interpolate(p, [0, 1], [size * 0.14, size * 0.46]) *
              (odd ? 0.88 : 1);
            const len =
              interpolate(p, [0, 1], [size * 0.3, size * 0.1]) *
              (odd ? 0.82 : 1);

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 0,
                  height: 0,
                  rotate: `${a}deg`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: dist,
                    top: -2,
                    width: len,
                    height: 4,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${color}00 0%, ${color} 100%)`,
                    boxShadow: `0 0 14px ${color}AA`,
                  }}
                />
              </div>
            );
          })
        : null}
    </Interactive.Div>
  );
};

/** טבעת שמתרחבת ומתדקקת */
const Ring: React.FC<{ p: number; size: number; color: string }> = ({
  p,
  size,
  color,
}) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      width: size,
      height: size,
      borderRadius: "50%",
      translate: "-50% -50%",
      border: `${interpolate(p, [0, 1], [9, 1.5])}px solid ${color}`,
      boxShadow: `0 0 26px ${color}66`,
      scale: interpolate(p, [0, 1], [0.18, 1], {
        output: "perceptual-scale",
      }),
      opacity: interpolate(p, [0, 0.6, 1], [1, 0.7, 0], clamp),
    }}
  />
);

/** הבזק אלכסוני שחוצה את האזור */
const Sweep: React.FC<{
  p: number;
  size: number;
  color: string;
  angle: number;
}> = ({ p, size, color, angle }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      borderRadius: 40,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: -size * 0.6,
        left: interpolate(p, [0, 1], [-size * 0.7, size * 1.1]),
        width: size * 0.3,
        height: size * 2.2,
        rotate: `${angle}deg`,
        background: `linear-gradient(90deg, ${color}00 0%, ${color}CC 50%, ${color}00 100%)`,
        filter: "blur(10px)",
      }}
    />
  </div>
);
