import React from 'react';
import "./index.css";
import { Composition } from "remotion";
import { BirthdayVideo } from "./Composition";

// Total duration: 165 seconds * 30 fps = 4950 frames
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BirthdayVideo"
        component={BirthdayVideo}
        durationInFrames={4950}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
