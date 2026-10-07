import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PitchBackdrop } from "../components/PitchBackdrop";

/**
 * מעטפת משותפת לכל הקלפים המעוצבים —
 * רקע, כניסה ויציאה אחידות. הקלף אטום ולכן מכסה את הצילום שמתחתיו.
 */
export const CardShell: React.FC<{
  children: React.ReactNode;
  name: string;
  /** עוצמת ההילות ברקע */
  intensity?: number;
}> = ({ children, name, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name={name}
      style={{
        /* חיתוך חד בשני הקצוות. כל דהייה — בכניסה או ביציאה — חושפת
           לפריים או שניים את הגרפיקה והכתוביות הצרובות של קובץ המקור,
           ולכן הקלף אטום לכל אורך החלון שלו. התנועה מגיעה מה-scale. */
        opacity: 1,
        scale: interpolate(
          frame,
          [0, 10, durationInFrames - 1],
          [1.08, 1, 1.03],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          },
        ),
      }}
    >
      <PitchBackdrop intensity={intensity} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 90,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
