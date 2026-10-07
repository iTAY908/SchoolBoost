import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * קטע צילום עם דירוג צבע, ויניה וזום איטי.
 *
 * הווידאו מושתק. שני הצילומים הוקלטו בעוצמות רחוקות מאוד זו מזו,
 * ולכן הדיבור מגיע מרצועות מנורמלות נפרדות שנוצרות ב-
 * `scripts/prepare-clips.mjs` וממוקמות באותו חלון זמן.
 */
export const Clip: React.FC<{
  src: string;
  /** מאיזו שנייה בקובץ המקור להתחיל */
  trimBefore: number;
  /** אורך הקטע בפריימים */
  durationInFrames: number;
  /** עוצמת הזום לאורך הקטע */
  zoom?: [number, number];
}> = ({ src, trimBefore, durationInFrames, zoom = [1.04, 1.12] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Clip">
      <Video
        src={staticFile(src)}
        trimBefore={Math.round(trimBefore * fps)}
        durationInFrames={durationInFrames}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          /* המקור דחוס ושטוח — קצת ניגודיות ורוויה מחזירות לו חיים */
          filter: "contrast(1.1) saturate(1.18) brightness(1.03)",
          scale: interpolate(frame, [0, durationInFrames], zoom, {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.ease),
            output: "perceptual-scale",
          }),
        }}
      />

      <AbsoluteFill
        name="Vignette"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(8,2,22,0.72) 100%)",
        }}
      />

      {/* גוון סגול שמחבר את הצילום לקלפים המעוצבים */}
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
