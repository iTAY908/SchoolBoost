import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../font";
import { P } from "../theme";
import { CardShell } from "./CardShell";

/** "אומנם אני בן 15" — המספר הוא הגיבור של הקלף */
export const AgeCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="AgeCard">
      <Interactive.Div
        name="Kicker"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 700,
          fontSize: 72,
          color: P.white,
          textShadow: "0 6px 26px rgba(0,0,0,0.5)",
          opacity: interpolate(frame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 14], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        אומנם אני בן
      </Interactive.Div>

      {/* המספר 15 — קופץ פנימה עם זוהר זהב */}
      <Interactive.Div
        name="Number"
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 420,
          lineHeight: 1,
          color: P.gold,
          textShadow: `0 0 90px ${P.gold}77, 0 16px 50px rgba(0,0,0,0.55)`,
          marginTop: 10,
          scale: interpolate(frame, [4, 24], [0.4, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.5, 0.3, 1),
            output: "perceptual-scale",
          }),
          rotate: interpolate(frame, [4, 26], ["-9deg", "0deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.3, 0.3, 1),
          }),
        }}
      >
        15
      </Interactive.Div>

      {/* קו מודגש שנפתח מתחת למספר */}
      <Interactive.Div
        name="Underline"
        style={{
          height: 10,
          borderRadius: 999,
          background: P.gold,
          boxShadow: `0 0 34px ${P.gold}`,
          marginTop: 18,
          width: interpolate(frame, [20, 38], [0, 360], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </CardShell>
  );
};
