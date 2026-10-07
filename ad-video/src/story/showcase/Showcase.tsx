import { AbsoluteFill } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { PitchBackdrop } from "../../pitch/components/PitchBackdrop";
import { HEADLINE_DURATION, ShowcaseHeadline } from "./ShowcaseHeadline";
import { BRAND_DURATION, ShowcaseBrand } from "./ShowcaseBrand";
import { WALL_DURATION, ShowcaseWall } from "./ShowcaseWall";

/** אורך המעבר בין הפעימות */
export const SHOWCASE_TRANSITION = 10;

/**
 * 195 פריימים = 6.5 שניות ב-30fps.
 * הסכום: 62 + 100 + 53 פחות שני מעברים של 10.
 */
export const SHOWCASE_DURATION =
  HEADLINE_DURATION +
  WALL_DURATION +
  BRAND_DURATION -
  SHOWCASE_TRANSITION * 2;

const punchy = springTiming({
  config: { damping: 200 },
  durationInFrames: SHOWCASE_TRANSITION,
});

const soft = linearTiming({ durationInFrames: SHOWCASE_TRANSITION });

/**
 * ── Showcase ────────────────────────────────────────────
 * רצף גרפי עצמאי באורך 6.5 שניות שנועד להתחבר בסוף סרטון
 * הפיץ' (`StoryVideo`). שלוש פעימות:
 *
 *   0–62     כותרת:  "עריכת וידאו מקצועית"
 *   52–152   קיר עבודות + שתי שורות סוגי עבודה
 *   142–195  נחיתת מותג: הסמל, ITAY EDITS, שם המשתמש
 *
 * הרקע יושב מתחת ל-TransitionSeries כדי שהגרדיאנט יזרום ברציפות
 * בזמן שהתוכן מתחלף — בדיוק כמו ב-`AdVideo`.
 *
 * אין ברצף הזה שום מספר, אחוז, דירוג או הבטחה. כל הטקסט לקוח
 * מהמילים שהלקוח עצמו אומר בסרטון.
 */
export const Showcase: React.FC = () => {
  return (
    <AbsoluteFill name="Showcase">
      <PitchBackdrop intensity={1.15} />

      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={HEADLINE_DURATION}
          name="1 · כותרת"
        >
          <ShowcaseHeadline />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={punchy}
        />

        <TransitionSeries.Sequence
          durationInFrames={WALL_DURATION}
          name="2 · קיר עבודות"
        >
          <ShowcaseWall />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={soft} />

        <TransitionSeries.Sequence
          durationInFrames={BRAND_DURATION}
          name="3 · מותג"
        >
          <ShowcaseBrand />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
