import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { PopWords } from "../../components/PopWords";
import { P } from "../theme";
import { CardShell } from "./CardShell";

/** פתיח — "למה לבחור דווקא בי?" */
export const IntroCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="IntroCard">
      {/* סימן שאלה ענק ורפאי מאחורי הטקסט */}
      <Interactive.Div
        name="GhostMark"
        style={{
          position: "absolute",
          fontSize: 900,
          fontWeight: 900,
          color: P.gold,
          opacity: 0.14,
          top: 180,
          scale: interpolate(frame, [0, 26], [0.7, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.2, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        ?
      </Interactive.Div>

      <PopWords
        words={[
          { text: "למה" },
          { text: "לבחור" },
          { text: "דווקא" },
          { text: "בי?", accent: true },
        ]}
        startAt={1}
        stagger={3}
        fontSize={148}
        maxWidth={900}
        accentColor={P.gold}
      />
    </CardShell>
  );
};
