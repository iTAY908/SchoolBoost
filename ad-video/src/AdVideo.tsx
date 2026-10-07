import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Backdrop } from "./components/Backdrop";
import { SCENE_DURATIONS, TRANSITION_FRAMES } from "./config";
import { SceneBrand } from "./scenes/SceneBrand";
import { SceneCta } from "./scenes/SceneCta";
import { SceneGallery } from "./scenes/SceneGallery";
import { SceneHook } from "./scenes/SceneHook";
import { SceneResults } from "./scenes/SceneResults";

const punchy = springTiming({
  config: { damping: 200 },
  durationInFrames: TRANSITION_FRAMES,
});

/**
 * הסרטון המלא. הרקע יושב מתחת ל-TransitionSeries כדי
 * שהגרדיאנט יזרום ברציפות בזמן שהתוכן מתחלף.
 */
export const AdVideo: React.FC = () => {
  return (
    <AbsoluteFill name="AdVideo">
      <Backdrop />

      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.hook}
          name="1 · הוק"
        >
          <SceneHook />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={punchy}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.gallery}
          name="2 · גלריית עבודות"
        >
          <SceneGallery />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={punchy}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.results}
          name="3 · תוצאות"
        >
          <SceneResults />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={punchy} />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.brand}
          name="4 · מותג"
        >
          <SceneBrand />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={punchy}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.cta}
          name="5 · הנעה לפעולה"
        >
          <SceneCta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
