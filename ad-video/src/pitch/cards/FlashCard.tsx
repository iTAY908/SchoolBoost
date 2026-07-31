import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../../font";
import { CREATOR, P } from "../theme";

/**
 * סטינגר מיתוגי קצר בין שני שוטים.
 *
 * מכסה את אפקטי המעבר של קובץ המקור (המערבולת ב-6.3 שניות
 * וההבזק השרוף ב-13.3), ובמקום זמן מת מכניס את הסמל והשם.
 */
export const FlashCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const mid = durationInFrames / 2;

  return (
    <AbsoluteFill name="FlashCard">
      {/* שכבת צבע אטומה שמכסה את המעבר המקורי */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${P.violet} 0%, ${P.bright} 46%, ${P.gold} 100%)`,
          /* אטום לכל אורך החלון — מכסה לגמרי את אפקט המעבר של המקור */
          opacity: 1,
        }}
      />

      {/* קווי מהירות שחולפים על פני הפריים */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(112deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 7px, rgba(255,255,255,0) 7px, rgba(255,255,255,0) 46px)`,
          opacity: interpolate(
            frame,
            [0, 3, durationInFrames - 4, durationInFrames - 1],
            [0, 0.9, 0.9, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          translate: interpolate(
            frame,
            [0, durationInFrames - 1],
            ["-420px 0px", "420px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          ),
        }}
      />

      {/* הסמל והשם — הופכים את המעבר לרגע מיתוג */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          opacity: interpolate(
            frame,
            [1, 5, durationInFrames - 4, durationInFrames - 2],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          scale: interpolate(frame, [1, mid, durationInFrames - 1], [0.5, 1, 1.25], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
            output: "perceptual-scale",
          }),
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: P.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "31px solid transparent",
              borderBottom: "31px solid transparent",
              borderRight: `50px solid ${P.violet}`,
              marginRight: 12,
            }}
          />
        </div>

        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 76,
            letterSpacing: 6,
            color: P.white,
            textShadow: "0 8px 26px rgba(0,0,0,0.45)",
          }}
        >
          {CREATOR.name}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
