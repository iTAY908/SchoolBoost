import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { CREATOR, P } from "../theme";
import { CardShell } from "./CardShell";

/** קלף סיום — הנעה לפעולה אחרי שהדיבור נגמר */
export const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="OutroCard" intensity={1.2}>
      {/* סמל נגן */}
      <Interactive.Div
        name="PlayMark"
        style={{
          width: 176,
          height: 176,
          borderRadius: "50%",
          background: `linear-gradient(150deg, ${P.gold} 0%, ${P.amber} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 70px ${P.gold}55`,
          marginBottom: 44,
          scale: interpolate(frame, [2, 22], [0.3, 1], {
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
            borderTop: "36px solid transparent",
            borderBottom: "36px solid transparent",
            borderRight: `58px solid ${P.ink}`,
            marginRight: 14,
          }}
        />
      </Interactive.Div>

      <Interactive.Div
        name="Cta"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 900,
          fontSize: 118,
          color: P.white,
          textAlign: "center",
          textShadow: "0 0 50px rgba(255,255,255,0.28), 0 10px 34px rgba(0,0,0,0.6)",
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [10, 28], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {CREATOR.cta}
      </Interactive.Div>

      <Interactive.Div
        name="Action"
        style={{
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontFamily,
          fontWeight: 900,
          fontSize: 62,
          color: P.ink,
          marginTop: 46,
          padding: "28px 60px",
          borderRadius: 999,
          background: `linear-gradient(150deg, ${P.white} 0%, #FFE9BC 100%)`,
          boxShadow: "0 24px 56px rgba(0,0,0,0.5)",
          opacity: interpolate(frame, [24, 34], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(
            frame < 40 ? frame : 40 + ((frame - 40) % 30),
            [24, 40, 48, 56, 70],
            [0.75, 1, 1.05, 1, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1.3, 0.3, 1),
              output: "perceptual-scale",
            },
          ),
        }}
      >
        <span style={{ fontSize: 58 }}>📩</span>
        {CREATOR.action}
      </Interactive.Div>

      <Interactive.Div
        name="Signature"
        style={{
          position: "absolute",
          bottom: 190,
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontFamily,
          fontWeight: 900,
          fontSize: 46,
          letterSpacing: 2,
          color: P.white,
          padding: "14px 40px",
          borderRadius: 999,
          border: `3px solid ${P.gold}AA`,
          background: "rgba(14,5,36,0.4)",
          opacity: interpolate(frame, [38, 50], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {CREATOR.name}
        <span style={{ opacity: 0.7, fontWeight: 700, direction: "ltr" }}>
          {CREATOR.handle}
        </span>
      </Interactive.Div>
    </CardShell>
  );
};
