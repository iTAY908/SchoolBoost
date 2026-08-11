import { AbsoluteFill } from "remotion";
import { PitchBackdrop } from "../pitch/components/PitchBackdrop";
import { CREATOR } from "../pitch/theme";
import { AgeBar } from "./components/AgeBar";
import { LogoBadge } from "./components/LogoBadge";

/** מתי הפס מתחיל לגדול ובכמה פריימים */
export const PREVIEW_AGE_START = 6;
export const PREVIEW_AGE_DURATION = 40;
export const PREVIEW_DURATION = 90;

/** תמונת דמה מוטמעת — רק כדי לבדוק את הענף שמציג `src` */
const SAMPLE_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F97316"/><stop offset="1" stop-color="#DB2777"/>
      </linearGradient></defs>
      <rect width="400" height="400" fill="url(#g)"/>
      <circle cx="200" cy="150" r="66" fill="#ffffff"/>
      <ellipse cx="200" cy="330" rx="118" ry="96" fill="#ffffff"/>
    </svg>`,
  );

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

      {/* בדיקה של הענף עם תמונה — כשתגיע תמונת הפרופיל היא תיכנס לכאן.
          כאן משמשת תמונת דמה מוטמעת, בלי תלות בקובץ חיצוני. */}
      <AbsoluteFill
        style={{
          alignItems: "flex-start",
          justifyContent: "flex-start",
          padding: 70,
        }}
      >
        <LogoBadge size={150} ringWidth={7} startFrame={4} src={SAMPLE_SRC} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
