import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { P } from "../theme";

/**
 * רקע מעוצב לקלפים — גרדיאנט סגול־אינדיגו עם הילות שנעות.
 * משמש כבסיס של כל קלף מעוצב.
 */
export const PitchBackdrop: React.FC<{ intensity?: number }> = ({
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="PitchBackdrop"
      style={{
        background: `linear-gradient(160deg, ${P.ink} 0%, ${P.deep} 34%, ${P.violet} 66%, ${P.bright} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${P.glow}CC 0%, rgba(168,85,247,0) 62%)`,
          width: 1500,
          height: 1500,
          left: -260,
          top: -360,
          opacity: 0.8 * intensity,
          translate: interpolate(
            frame,
            [0, Math.max(1, durationInFrames - 1)],
            ["0px 0px", "220px 160px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.ease),
            },
          ),
        }}
      />

      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${P.gold}66 0%, rgba(251,191,36,0) 58%)`,
          width: 1200,
          height: 1200,
          left: 160,
          top: 1240,
          opacity: 0.7 * intensity,
          translate: interpolate(
            frame,
            [0, Math.max(1, durationInFrames - 1)],
            ["0px 0px", "-200px -120px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.ease),
            },
          ),
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(8,2,22,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
