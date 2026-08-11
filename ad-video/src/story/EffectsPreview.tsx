import { AbsoluteFill } from "remotion";
import { PitchBackdrop } from "../pitch/components/PitchBackdrop";
import { CREATOR } from "../pitch/theme";
import { AgeBar } from "./components/AgeBar";
import { LogoBadge } from "./components/LogoBadge";

/** מתי הפס מתחיל לגדול ובכמה פריימים */
export const PREVIEW_AGE_START = 6;
export const PREVIEW_AGE_DURATION = 40;
export const PREVIEW_DURATION = 90;

/**
 * קומפוזיציית בדיקה זמנית — מציגה את שני האפקטים יחד
 * כדי לרנדר סטילס ולוודא שהם נראים נכון. אינה חלק מהסרטון עצמו.
 */
export const EffectsPreview: React.FC = () => {
  return (
    <AbsoluteFill>
      <PitchBackdrop intensity={0.7} />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AgeBar
          startFrame={PREVIEW_AGE_START}
          durationInFrames={PREVIEW_AGE_DURATION}
          caption="אני בן"
        />
      </AbsoluteFill>

      {/* התג הגדול — כך הוא ייראה במרכז */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 190,
        }}
      >
        <LogoBadge size={300} startFrame={10} label={CREATOR.handle} />
      </AbsoluteFill>

      {/* התג הקטן — כך הוא ייראה בפינה */}
      <AbsoluteFill
        style={{
          alignItems: "flex-end",
          justifyContent: "flex-start",
          padding: 70,
        }}
      >
        <LogoBadge size={150} ringWidth={7} startFrame={4} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
