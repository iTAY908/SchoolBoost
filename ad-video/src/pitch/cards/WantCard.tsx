import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P } from "../theme";
import { CardShell } from "./CardShell";

/** "מה שאתה רוצה" + "דואג לכל פרט קטן" — הקטע הכהה של המקור, מעוצב מחדש */
export const WantCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="WantCard" intensity={1.1}>
      {/* שורה מודגשת על רקע זהב — הטקסט הראשי */}
      <Interactive.Div
        name="Highlight"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 900,
          fontSize: 118,
          color: P.ink,
          background: `linear-gradient(100deg, ${P.gold} 0%, ${P.amber} 100%)`,
          padding: "22px 52px",
          borderRadius: 24,
          boxShadow: `0 26px 60px rgba(0,0,0,0.5), 0 0 70px ${P.gold}55`,
          whiteSpace: "nowrap",
          rotate: "-2deg",
          opacity: interpolate(frame, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 16], [0.72, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.5, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        מה שאתה רוצה
      </Interactive.Div>

      {/* שורה שנייה — נכנסת אחריה */}
      <Interactive.Div
        name="Detail"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 900,
          fontSize: 92,
          color: P.white,
          marginTop: 54,
          textShadow: "0 8px 30px rgba(0,0,0,0.6)",
          opacity: interpolate(frame, [22, 32], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [22, 40], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        דואג לכל פרט קטן
      </Interactive.Div>

      {/* קו הדגשה שנמתח מתחת לשורה השנייה */}
      <Interactive.Div
        name="Stroke"
        style={{
          height: 9,
          borderRadius: 999,
          background: P.cyan,
          boxShadow: `0 0 30px ${P.cyan}`,
          marginTop: 22,
          width: interpolate(frame, [34, 52], [0, 520], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </CardShell>
  );
};
