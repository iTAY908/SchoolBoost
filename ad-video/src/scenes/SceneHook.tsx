import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { PopWords } from "../components/PopWords";
import { COLORS } from "../config";
import { fontFamily } from "../font";

/** שקופית 1 — ההוק: "מה הסוד..." */
export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="SceneHook"
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 40,
        padding: 90,
      }}
    >
      {/* טבעת אור שמתפוצצת מאחורי הטקסט ברגע ההופעה */}
      <Interactive.Div
        name="Burst"
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          border: "6px solid rgba(255,255,255,0.5)",
          opacity: interpolate(frame, [2, 8, 30], [0, 0.55, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [2, 30], [0.25, 1.25], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
            output: "perceptual-scale",
          }),
        }}
      />

      {/* כותרת עליונה קטנה שמכינה את השאלה */}
      <Interactive.Div
        name="Kicker"
        style={{
          direction: "rtl",
          fontFamily,
          fontWeight: 700,
          fontSize: 46,
          letterSpacing: 6,
          color: "rgba(255,255,255,0.85)",
          padding: "14px 40px",
          borderRadius: 999,
          border: "3px solid rgba(255,255,255,0.45)",
          backdropFilter: "blur(4px)",
          opacity: interpolate(frame, [0, 8, 52, 62], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 14], ["0px -30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        שאלה אחת קטנה
      </Interactive.Div>

      {/* הטקסט הראשי — מילה אחר מילה */}
      <Interactive.Div
        name="Headline"
        style={{
          display: "flex",
          justifyContent: "center",
          scale: interpolate(frame, [14, 66], [1, 1.07], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.ease),
            output: "perceptual-scale",
          }),
        }}
      >
        <PopWords
          words={[{ text: "מה" }, { text: "הסוד...", accent: true }]}
          startAt={8}
          stagger={7}
          fontSize={190}
        />
      </Interactive.Div>

      {/* שלוש נקודות פועמות שמרמזות על המשך */}
      <Interactive.Div
        name="Dots"
        style={{
          display: "flex",
          gap: 20,
          opacity: interpolate(frame, [30, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: COLORS.white,
              opacity: interpolate(
                (frame - 30 - i * 4) % 24,
                [0, 6, 12, 24],
                [0.3, 1, 0.3, 0.3],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              ),
            }}
          />
        ))}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
