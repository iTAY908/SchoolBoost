import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../config";
import { fontFamily } from "../font";

export type Word = {
  text: string;
  /** מילה מודגשת מקבלת צבע זהב והטיה קלה */
  accent?: boolean;
};

/**
 * טקסט שנכנס מילה־אחר־מילה עם קפיצה (pop) —
 * האפקט ה"צעד־אחר־צעד" של השקופית הראשונה.
 */
export const PopWords: React.FC<{
  words: readonly Word[];
  startAt?: number;
  /** מרווח בפריימים בין מילה למילה */
  stagger?: number;
  fontSize?: number;
  lineHeight?: number;
  maxWidth?: number;
}> = ({
  words,
  startAt = 0,
  stagger = 5,
  fontSize = 132,
  lineHeight = 1.14,
  maxWidth = 900,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        direction: "rtl",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: `${fontSize * 0.06}px ${fontSize * 0.24}px`,
        maxWidth,
        fontFamily,
        fontWeight: 900,
        fontSize,
        lineHeight,
        textAlign: "center",
      }}
    >
      {words.map((word, i) => {
        const appear = startAt + i * stagger;

        return (
          <span
            key={`${word.text}-${i}`}
            style={{
              display: "inline-block",
              color: word.accent ? COLORS.gold : COLORS.white,
              textShadow: word.accent
                ? "0 0 46px rgba(255,216,77,0.55), 0 8px 28px rgba(70,0,35,0.4)"
                : "0 0 40px rgba(255,255,255,0.28), 0 8px 28px rgba(70,0,35,0.4)",
              opacity: interpolate(frame, [appear, appear + 5], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [appear, appear + 11], [0.55, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1.5, 0.3, 1),
                output: "perceptual-scale",
              }),
              translate: interpolate(
                frame,
                [appear, appear + 13],
                ["0px 26px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              rotate: interpolate(
                frame,
                [appear, appear + 13],
                [word.accent ? "-4deg" : "-2deg", "0deg"],
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
