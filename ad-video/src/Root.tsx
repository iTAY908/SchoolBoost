import { Composition, Folder } from "remotion";
import "./index.css";
import { AdVideo } from "./AdVideo";
import { FPS, HEIGHT, SCENE_DURATIONS, TOTAL_DURATION, WIDTH } from "./config";
import { Backdrop } from "./components/Backdrop";
import { SceneBrand } from "./scenes/SceneBrand";
import { SceneCta } from "./scenes/SceneCta";
import { SceneGallery } from "./scenes/SceneGallery";
import { SceneHook } from "./scenes/SceneHook";
import { SceneResults } from "./scenes/SceneResults";
import { PitchUpgrade } from "./pitch/PitchUpgrade";
import {
  TOTAL_DURATION as PITCH_DURATION,
  FPS as PITCH_FPS,
  HEIGHT as PITCH_HEIGHT,
  WIDTH as PITCH_WIDTH,
} from "./pitch/theme";

const base = {
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;

/** עוטף שקופית בודדת ברקע כדי שתיראה נכון גם בתצוגה נפרדת */
const withBackdrop = (Scene: React.FC): React.FC => {
  return () => (
    <>
      <Backdrop />
      <Scene />
    </>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AdVideo"
        component={AdVideo}
        durationInFrames={TOTAL_DURATION}
        {...base}
      />

      {/* העריכה המשודרגת של סרטון הפיץ' האישי */}
      <Composition
        id="PitchUpgrade"
        component={PitchUpgrade}
        durationInFrames={PITCH_DURATION}
        fps={PITCH_FPS}
        width={PITCH_WIDTH}
        height={PITCH_HEIGHT}
      />

      {/* כל שקופית רשומה בנפרד — נוח לערוך ולייצא אותה לבד */}
      <Folder name="Scenes">
        <Composition
          id="Scene1-Hook"
          component={withBackdrop(SceneHook)}
          durationInFrames={SCENE_DURATIONS.hook}
          {...base}
        />
        <Composition
          id="Scene2-Gallery"
          component={withBackdrop(SceneGallery)}
          durationInFrames={SCENE_DURATIONS.gallery}
          {...base}
        />
        <Composition
          id="Scene3-Results"
          component={withBackdrop(SceneResults)}
          durationInFrames={SCENE_DURATIONS.results}
          {...base}
        />
        <Composition
          id="Scene4-Brand"
          component={withBackdrop(SceneBrand)}
          durationInFrames={SCENE_DURATIONS.brand}
          {...base}
        />
        <Composition
          id="Scene5-Cta"
          component={withBackdrop(SceneCta)}
          durationInFrames={SCENE_DURATIONS.cta}
          {...base}
        />
      </Folder>
    </>
  );
};
