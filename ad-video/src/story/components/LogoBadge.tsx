import { Easing, Img, Interactive, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { CREATOR, P } from "../../pitch/theme";

export type LogoBadgeProps = {
  /**
   * מקור התמונה — תמונת הפרופיל מאינסטגרם שמשמשת גם כלוגו.
   * הקובץ אמור לשבת ב-`public/source/logo.png` ולהיות מועבר
   * לכאן כ-`staticFile("source/logo.png")`.
   * כל עוד הוא לא הגיע — משאירים ריק ומוצג סמל חלופי נקי.
   */
  src?: string;
  /** קוטר התג בפיקסלים */
  size?: number;
  /** עובי טבעת הזהב */
  ringWidth?: number;
  /** הפריים שבו מתחילה כניסת התג */
  startFrame?: number;
  /** לכבות את אנימציית הכניסה (למשל כשהתג יושב בפינה לאורך כל הסרטון) */
  animate?: boolean;
  /** כיתוב קטן מתחת לתג — למשל השם או השם משתמש */
  label?: string;
  /** עיצוב נוסף לעטיפה החיצונית — לשימוש העורך למיקום בפינה או במרכז */
  style?: React.CSSProperties;
};

/** ראשי תיבות מתוך שם היוצר — "ITAY" → "IT", "Itay Leiss" → "IL" */
const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "★";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * ── LogoBadge ───────────────────────────────────────────
 * תג עגול עם טבעת זהב. אם סופק `src` — מוצגת התמונה בתוכו.
 * אם לא — מוצג סמל חלופי מעוצב (מונוגרמה + משולש נגן),
 * כך שהסרטון אף פעם לא נשבר בגלל קובץ שעדיין לא הגיע.
 */
export const LogoBadge: React.FC<LogoBadgeProps> = ({
  src,
  size = 220,
  ringWidth = 10,
  startFrame = 0,
  animate = true,
  label,
  style,
}) => {
  const frame = useCurrentFrame();

  /** כשהאנימציה כבויה — הרכיב יושב ישר על המצב הסופי */
  const local = animate ? frame - startFrame : 999;
  const inner = size - ringWidth * 2;

  return (
    <Interactive.Div
      name="LogoBadge"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        opacity: interpolate(local, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(local, [0, 22], [0.4, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.4, 0.3, 1),
          output: "perceptual-scale",
        }),
        rotate: interpolate(local, [0, 24], ["-8deg", "0deg"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.3, 0.3, 1),
        }),
        ...style,
      }}
    >
      {/* טבעת הזהב */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          padding: ringWidth,
          boxSizing: "border-box",
          background: `linear-gradient(150deg, ${P.gold} 0%, ${P.amber} 52%, ${P.gold} 100%)`,
          boxShadow: `0 20px 52px rgba(0,0,0,0.5), 0 0 ${size * 0.3}px ${P.gold}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: inner,
              height: inner,
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          /* ── סמל חלופי כל עוד תמונת הפרופיל לא סופקה ── */
          <div
            style={{
              width: inner,
              height: inner,
              borderRadius: "50%",
              background: `linear-gradient(155deg, ${P.deep} 0%, ${P.violet} 60%, ${P.bright} 100%)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: inner * 0.03,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: inner * 0.38,
                lineHeight: 1,
                letterSpacing: inner * 0.01,
                color: P.white,
                textShadow: `0 0 ${inner * 0.16}px ${P.gold}88`,
              }}
            >
              {initialsOf(CREATOR.name)}
            </div>
            {/* משולש הנגן — אותו מוטיב שחוזר בשאר הסרטון */}
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: `${inner * 0.055}px solid transparent`,
                borderBottom: `${inner * 0.055}px solid transparent`,
                borderLeft: `${inner * 0.09}px solid ${P.gold}`,
              }}
            />
          </div>
        )}
      </div>

      {label ? (
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: size * 0.13,
            color: P.white,
            textShadow: "0 6px 20px rgba(0,0,0,0.55)",
            opacity: interpolate(local, [10, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {label}
        </div>
      ) : null}
    </Interactive.Div>
  );
};
