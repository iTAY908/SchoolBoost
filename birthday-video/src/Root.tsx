import React from 'react';
import "./index.css";
import { Composition } from "remotion";
import { BirthdayVideo } from "./Composition";
import { MemorialVideo } from "./components/MemorialVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Birthday video – 165s */}
      <Composition
        id="BirthdayVideo"
        component={BirthdayVideo}
        durationInFrames={4950}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Memorial video for Willy – 38s */}
      <Composition
        id="MemorialVideo"
        component={MemorialVideo}
        durationInFrames={1140}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
