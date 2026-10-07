import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { PopWords } from "../../components/PopWords";
import { P } from "../theme";
import { CardShell } from "./CardShell";

/** "שהסרטון שלך יהיה אחר" — מסגרת טלפון שנפתחת סביב הטקסט */
export const DifferentCard: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <CardShell name="DifferentCard">
      {/* מסגרת מכשיר שמצטיירת מסביב */}
      <Interactive.Div
        name="DeviceFrame"
        style={{
          position: "absolute",
          width: 620,
          height: 1120,
          borderRadius: 78,
          border: `7px solid ${P.gold}`,
          boxShadow: `0 0 70px ${P.gold}55, inset 0 0 60px ${P.gold}22`,
          opacity: interpolate(frame, [0, 10], [0, 0.9], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 22], [0.78, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1.3, 0.3, 1),
            output: "perceptual-scale",
          }),
          rotate: interpolate(frame, [0, 40], ["4deg", "-2deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          }),
        }}
      />

      <PopWords
        words={[
          { text: "שהסרטון" },
          { text: "שלך" },
          { text: "יהיה" },
          { text: "אחר", accent: true },
        ]}
        startAt={6}
        stagger={4}
        fontSize={116}
        maxWidth={760}
        accentColor={P.gold}
      />
    </CardShell>
  );
};
