import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SOURCE_DURATION, sec } from "../theme";

/**
 * הצילום המקורי — רץ ברצף מההתחלה ועד הסוף כדי לשמור סנכרון מוחלט
 * עם פס הקול. הקלפים המעוצבים יושבים מעליו ומכסים אותו בחלונות שלהם.
 *
 * הווידאו מושתק; הקול מגיע מרצועת אודיו נפרדת ורציפה.
 */
export const Footage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Footage">
      <Video
        src={staticFile("source/pitch.mp4")}
        muted
        durationInFrames={sec(SOURCE_DURATION)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          /* דירוג צבע קולנועי קל — המקור דחוס ושטוח */
          filter: "contrast(1.1) saturate(1.18) brightness(1.03)",
          /* זום איטי לאורך כל הסרטון כדי שהפריים לא ירגיש סטטי */
          scale: interpolate(
            frame,
            [0, SOURCE_DURATION * fps],
            [1.04, 1.12],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.ease),
              output: "perceptual-scale",
            },
          ),
        }}
      />

      {/* ויניה שמכהה את הקצוות ומרכזת את הדמות */}
      <AbsoluteFill
        name="Vignette"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(8,2,22,0.72) 100%)",
        }}
      />

      {/* גוון סגול קל שמחבר את הצילום לפלטה של הקלפים */}
      <AbsoluteFill
        name="Tint"
        style={{
          background:
            "linear-gradient(180deg, rgba(76,29,149,0.28) 0%, rgba(14,5,36,0.1) 45%, rgba(124,58,237,0.22) 100%)",
          mixBlendMode: "soft-light",
        }}
      />
    </AbsoluteFill>
  );
};
