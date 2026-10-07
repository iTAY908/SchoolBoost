import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BRAND, COLORS } from "../config";
import { fontFamily } from "../font";

/** שקופית 4 — הצגת המותג עם סמל נגן זוהר */
export const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="SceneBrand"
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 56,
        padding: 90,
      }}
    >
      {/* טבעות ניאון שמסתובבות מאחורי הלוגו */}
      <Interactive.Div
        name="GlowRings"
        style={{
          position: "absolute",
          top: 470,
          width: 620,
          height: 620,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          rotate: interpolate(frame, [0, 78], ["-25deg", "20deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          }),
        }}
      >
        {[620, 470, 330].map((size, i) => (
          <div
            key={size}
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: "50%",
              border: `${4 - i}px solid rgba(255,216,77,${0.75 - i * 0.18})`,
              boxShadow: `0 0 ${50 - i * 10}px rgba(255,216,77,0.5)`,
              scale: interpolate(frame, [0, 20 + i * 6], [0.6, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1.3, 0.3, 1),
                output: "perceptual-scale",
              }),
            }}
          />
        ))}
      </Interactive.Div>

      {/* סמל נגן — מסמן "וידאו" בלי להסתמך על קובץ חיצוני */}
      <Interactive.Div
        name="PlayMark"
        style={{
          width: 210,
          height: 210,
          borderRadius: "50%",
          background: `linear-gradient(150deg, ${COLORS.white} 0%, #FFE9F4 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 26px 60px rgba(60,0,32,0.45)",
          scale: interpolate(frame, [4, 24], [0.3, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.4, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "42px solid transparent",
            borderBottom: "42px solid transparent",
            borderRight: `68px solid ${COLORS.magenta}`,
            marginRight: 16,
          }}
        />
      </Interactive.Div>

      {/* שם המותג */}
      <Interactive.Div
        name="BrandName"
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 148,
          letterSpacing: 4,
          color: COLORS.white,
          textShadow:
            "0 0 60px rgba(255,255,255,0.45), 0 10px 34px rgba(70,0,35,0.5)",
          opacity: interpolate(frame, [16, 28], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [16, 34], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {BRAND.name}
      </Interactive.Div>

      {/* קו מפריד שנפתח מהמרכז */}
      <Interactive.Div
        name="Divider"
        style={{
          height: 6,
          borderRadius: 999,
          background: COLORS.gold,
          boxShadow: `0 0 26px ${COLORS.gold}`,
          width: interpolate(frame, [28, 46], [0, 420], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />

      {/* סלוגן */}
      <Interactive.Div
        name="Tagline"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 700,
          fontSize: 62,
          color: COLORS.white,
          textAlign: "center",
          whiteSpace: "nowrap",
          textShadow:
            "0 0 30px rgba(255,255,255,0.3), 0 6px 26px rgba(70,0,35,0.65)",
          opacity: interpolate(frame, [34, 46], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [34, 50], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {BRAND.tagline}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
