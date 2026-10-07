import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { MetricCard } from "../components/MetricCard";
import { COLORS, METRICS } from "../config";
import { fontFamily } from "../font";

/**
 * שקופית 3 — "עריכת וידאו מקצועית ברמה הגבוהה ביותר!"
 * עם ממשק ניתוח תוצאות ומדדי שביעות רצון.
 */
export const SceneResults: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="SceneResults"
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 56,
        padding: 90,
      }}
    >
      <Interactive.Div
        name="Headline"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 900,
          fontSize: 88,
          lineHeight: 1.16,
          color: COLORS.white,
          textAlign: "center",
          maxWidth: 900,
          textShadow:
            "0 0 40px rgba(255,255,255,0.25), 0 8px 28px rgba(70,0,35,0.45)",
          opacity: interpolate(frame, [0, 9], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 16], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        עריכת וידאו מקצועית
        <br />
        <span style={{ color: COLORS.gold }}>ברמה הגבוהה ביותר!</span>
      </Interactive.Div>

      {/* כרטיסי המדדים נכנסים אחד אחרי השני */}
      <Interactive.Div
        name="Metrics"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 26,
          /* גובה קבוע — הכרטיסים נכנסים בהדרגה בלי להזיז את הכותרת */
          height: 526,
        }}
      >
        {METRICS.map((metric, i) => (
          <MetricCard
            key={metric.label}
            value={metric.value}
            suffix={metric.suffix}
            label={metric.label}
            decimals={Number.isInteger(metric.value) ? 0 : 1}
            appearAt={14 + i * 9}
          />
        ))}
      </Interactive.Div>

      {/* שורת אישור שנחתמת בסוף השקופית */}
      <Interactive.Div
        name="Stamp"
        style={{
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily,
          fontWeight: 700,
          fontSize: 42,
          color: COLORS.white,
          padding: "16px 38px",
          borderRadius: 999,
          background: "rgba(46,213,115,0.22)",
          border: `3px solid ${COLORS.green}`,
          opacity: interpolate(frame, [52, 62], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [52, 66], [0.8, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.5, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <span style={{ color: COLORS.green, fontSize: 46 }}>✓</span>
        נמדד על פני מאות סרטונים
      </Interactive.Div>
    </AbsoluteFill>
  );
};
