import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { PopWords } from "../components/PopWords";
import { BRAND, COLORS } from "../config";
import { fontFamily } from "../font";

/** שקופית 5 — הנעה לפעולה */
export const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="SceneCta"
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 64,
        padding: 90,
      }}
    >
      <PopWords
        words={[
          { text: "רוצים" },
          { text: "סרטון" },
          { text: "כזה" },
          { text: "לעסק", accent: true },
          { text: "שלכם?", accent: true },
        ]}
        startAt={2}
        stagger={4}
        fontSize={132}
        maxWidth={920}
      />

      {/* כפתור הפעולה — פועם כדי למשוך את העין */}
      <Interactive.Div
        name="CtaButton"
        style={{
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 22,
          fontFamily,
          fontWeight: 900,
          fontSize: 66,
          color: COLORS.ink,
          padding: "34px 68px",
          borderRadius: 999,
          background: `linear-gradient(150deg, ${COLORS.white} 0%, #FFE3B8 100%)`,
          boxShadow: "0 26px 60px rgba(60,0,32,0.45)",
          opacity: interpolate(frame, [26, 36], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(
            frame < 44 ? frame : 44 + ((frame - 44) % 30),
            [26, 44, 52, 60, 74],
            [0.7, 1, 1.06, 1, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.3, 0.3, 1),
              output: "perceptual-scale",
            },
          ),
        }}
      >
        <span style={{ fontSize: 62 }}>📩</span>
        שלחו הודעה עכשיו!
      </Interactive.Div>

      {/* שורת "דברו איתי בפרטי" */}
      <Interactive.Div
        name="DmLine"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 700,
          fontSize: 56,
          color: COLORS.white,
          textAlign: "center",
          textShadow: "0 6px 24px rgba(70,0,35,0.5)",
          opacity: interpolate(frame, [40, 52], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [40, 56], ["0px 26px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        דברו איתי בפרטי
      </Interactive.Div>

      {/* חתימת המותג בתחתית */}
      <Interactive.Div
        name="Signature"
        style={{
          position: "absolute",
          bottom: 210,
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontFamily,
          fontWeight: 900,
          fontSize: 46,
          letterSpacing: 2,
          color: COLORS.white,
          textShadow: "0 4px 18px rgba(70,0,35,0.6)",
          padding: "16px 42px",
          borderRadius: 999,
          border: "3px solid rgba(255,255,255,0.75)",
          background: "rgba(120,4,60,0.28)",
          opacity: interpolate(frame, [56, 68], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {BRAND.name}
        <span style={{ opacity: 0.55, fontWeight: 700, direction: "ltr" }}>
          {BRAND.handle}
        </span>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
