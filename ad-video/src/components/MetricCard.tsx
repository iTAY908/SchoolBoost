import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../config";
import { fontFamily } from "../font";

/**
 * כרטיס תוצאות לבן עם מונה שרץ כלפי מעלה —
 * ממשק "ניתוח התוצאות" של שקופית 3.
 */
export const MetricCard: React.FC<{
  value: number;
  suffix: string;
  label: string;
  appearAt: number;
  /** מספרים לא שלמים מוצגים עם ספרה אחת אחרי הנקודה */
  decimals?: number;
}> = ({ value, suffix, label, appearAt, decimals = 0 }) => {
  const frame = useCurrentFrame();

  const counted = interpolate(frame, [appearAt + 2, appearAt + 24], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const barProgress = interpolate(
    frame,
    [appearAt + 4, appearAt + 30],
    [0, value > 10 ? value / 100 : 0.85],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  return (
    <div
      style={{
        direction: "rtl",
        display: "flex",
        alignItems: "center",
        gap: 28,
        width: 820,
        padding: "30px 38px",
        borderRadius: 30,
        background: "rgba(255,255,255,0.97)",
        boxShadow: "0 26px 60px rgba(60,0,32,0.35)",
        opacity: interpolate(frame, [appearAt, appearAt + 7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [appearAt, appearAt + 14], [0.86, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1.4, 0.3, 1),
          output: "perceptual-scale",
        }),
        translate: interpolate(
          frame,
          [appearAt, appearAt + 16],
          ["90px 0px", "0px 0px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 82,
          color: COLORS.green,
          minWidth: 230,
          textAlign: "center",
          letterSpacing: -2,
          direction: "ltr",
        }}
      >
        {counted.toFixed(decimals)}
        {suffix}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 44,
            color: COLORS.ink,
          }}
        >
          {label}
        </div>
        {/* פס התקדמות שממחיש את המדד */}
        <div
          style={{
            height: 16,
            borderRadius: 999,
            background: "rgba(43,4,24,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${barProgress * 100}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${COLORS.green} 0%, #7BE495 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
