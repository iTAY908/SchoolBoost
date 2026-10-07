import { AbsoluteFill } from "remotion";
import { Showcase, SHOWCASE_DURATION } from "./showcase/Showcase";

export { SHOWCASE_DURATION };

/**
 * תצוגת בדיקה לרצף ה-Showcase לבדו — אותו רכיב בדיוק שיתחבר
 * בסוף `StoryVideo`, בלי הצילום ובלי הסאונד.
 */
export const ShowcasePreview: React.FC = () => {
  return (
    <AbsoluteFill name="ShowcasePreview">
      <Showcase />
    </AbsoluteFill>
  );
};
