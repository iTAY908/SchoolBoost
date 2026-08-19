import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../config";

/**
 * רקע מג'נטה־קורל מתמשך לכל אורך הסרטון.
 * יושב מתחת לכל השקופיות כך שהמעברים מרגישים רציפים.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Backdrop"
      style={{
        background: `linear-gradient(165deg, ${COLORS.magentaDeep} 0%, ${COLORS.magenta} 38%, ${COLORS.pink} 68%, ${COLORS.coral} 100%)`,
      }}
    >
      {/* הילת אור עליונה שנעה לאורך הסרטון */}
      <AbsoluteFill
        name="GlowTop"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(255,140,190,0.85) 0%, rgba(255,140,190,0) 62%)`,
          width: 1500,
          height: 1500,
          left: -220,
          top: -420,
          translate: interpolate(
            frame,
            [0, durationInFrames - 1],
            ["0px 0px", "260px 180px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.ease),
            },
          ),
        }}
      />

      {/* הילה תחתונה בגוון קורל */}
      <AbsoluteFill
        name="GlowBottom"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(255,150,90,0.75) 0%, rgba(255,150,90,0) 60%)`,
          width: 1400,
          height: 1400,
          left: 120,
          top: 1180,
          translate: interpolate(
            frame,
            [0, durationInFrames - 1],
            ["0px 0px", "-240px -140px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.ease),
            },
          ),
        }}
      />

      {/* ויניה שמכהה את הפינות ומרכזת את העין */}
      <AbsoluteFill
        name="Vignette"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 42%, rgba(60,0,30,0.55) 100%)",
        }}
      />

      {/* גרעיניות עדינה שמונעת פסי גרדיאנט */}
      <AbsoluteFill
        name="Grain"
        style={{
          opacity: 0.14,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>`,
          )}")`,
        }}
      />
    </AbsoluteFill>
  );
};
