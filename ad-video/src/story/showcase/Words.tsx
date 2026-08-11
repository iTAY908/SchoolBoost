import { Easing, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P } from "../../pitch/theme";

export type Word = {
  text: string;
  /** מילה מודגשת — צבע זהב והילה חמה */
  accent?: boolean;
};

/**
 * ── Words ───────────────────────────────────────────────
 * טקסט עברי שנכנס מילה־אחר־מילה בקפיצה קצרה, בפלטת הסגול־זהב
 * של ITAY EDITS. גרסה עצמאית של המוטיב מ-`components/PopWords`,
 * עם יציאה אופציונלית כדי ששתי שורות יוכלו להתחלף באותה שקופית.
 */
export const Words: React.FC<{
  words: readonly Word[];
  /** הפריים המקומי שבו המילה הראשונה מופיעה */
  startAt?: number;
  /** מרווח בפריימים בין מילה למילה */
  stagger?: number;
  /** פריים שבו כל השורה מתחילה לצאת. undefined = נשארת עד הסוף */
  exitAt?: number;
  fontSize?: number;
  lineHeight?: number;
  maxWidth?: number;
}> = ({
  words,
  startAt = 0,
  stagger = 5,
  exitAt,
  fontSize = 124,
  lineHeight = 1.16,
  maxWidth = 900,
}) => {
  const frame = useCurrentFrame();

  /* היציאה משותפת לכל השורה — כך היא עוזבת כגוש אחד ולא מתפרקת */
  const exitOpacity =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt, exitAt + 9], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const exitShift =
    exitAt === undefined
      ? 0
      : interpolate(frame, [exitAt, exitAt + 12], [0, -46], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        });

  return (
    <div
      style={{
        direction: "rtl",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: `${fontSize * 0.08}px ${fontSize * 0.26}px`,
        maxWidth,
        fontFamily,
        fontWeight: 900,
        fontSize,
        lineHeight,
        textAlign: "center",
        opacity: exitOpacity,
        translate: `0px ${exitShift}px`,
      }}
    >
      {words.map((word, i) => {
        const appear = startAt + i * stagger;

        return (
          <span
            key={`${word.text}-${i}`}
            style={{
              display: "inline-block",
              color: word.accent ? P.gold : P.white,
              textShadow: word.accent
                ? `0 0 54px ${P.gold}80, 0 10px 30px rgba(8,2,22,0.6)`
                : "0 0 44px rgba(255,255,255,0.22), 0 10px 30px rgba(8,2,22,0.6)",
              opacity: interpolate(frame, [appear, appear + 5], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [appear, appear + 12], [0.62, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1.45, 0.3, 1),
                output: "perceptual-scale",
              }),
              translate: interpolate(
                frame,
                [appear, appear + 14],
                ["0px 30px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
