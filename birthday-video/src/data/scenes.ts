export interface Scene {
  photo: string;
  startSec: number;
  endSec: number;
  kenBurns: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  caption?: string;
}

// Photo filenames (copied to /public/photos/)
const P = {
  darkPortrait: '60dc236f-1000065510.png',       // professional dark bg portrait
  motoRain: '06bb47d9-1000064571.jpg',            // motocross in rain, dramatic
  motoSunset: '72c8c8b1-1000064497.png',          // standing with bike at sunset
  motoForest: 'cde173e4-1000059489.jpg',          // riding in forest
  gtaArt: '9ee0e4d7-1000063408.png',              // GTA-style illustration
  redPortrait: '75dd113d-1000062478.jpg',         // red dramatic portrait
  rooftopNight: 'eda0532d-1000062476.jpg',        // night rooftop selfie
  graffiti2026: '6d46f087-1000060496.jpg',        // 2026 graffiti background
  familyGathering1: 'b87abfbf-1000077548.jpg',   // family with grandma
  familyGathering2: 'af247da9-1000077546.jpg',   // same family 2
  hospitalFamily: '5dfb6224-1000061012.jpg',     // hospital with parents
  hospitalSmile: 'fe97519b-1000061009.jpg',      // smiling in hospital
  maccabi: 'c89933dc-1000072061.jpg',            // Maccabi Tel Aviv store
  beanieSelfie: '99801f41-1000068124.jpg',       // black beanie selfie
  beanieStyle: '78a98282-1000068125.jpg',        // beanie sideways
  mirrorSelfie: '5ede07f5-1000068122.jpg',       // mirror selfie
  cosplay: '40351e12-1000068117.jpg',            // cosplay/friends
  homeSofa: '23c2cea8-1000066645.jpg',           // home on sofa
  nikeSelfie: '6e55969e-1000075653.jpg',         // nike selfie
};

export const SCENES: Scene[] = [
  // Intro (0-4s)
  { photo: P.darkPortrait, startSec: 0, endSec: 8, kenBurns: 'zoom-in' },

  // Verse 1 (4-21s)
  { photo: P.rooftopNight, startSec: 8, endSec: 17, kenBurns: 'pan-left' },
  { photo: P.homeSofa, startSec: 17, endSec: 25, kenBurns: 'zoom-in' },

  // Pre-chorus - fear, life, sea (21-51s)
  { photo: P.graffiti2026, startSec: 25, endSec: 33, kenBurns: 'zoom-out' },
  { photo: P.hospitalSmile, startSec: 33, endSec: 40.5, kenBurns: 'zoom-in' },   // "שמחה בריאות"
  { photo: P.motoRain, startSec: 40.5, endSec: 51, kenBurns: 'pan-right' },      // "הים סוער"

  // Chorus 1 (51-75s)
  { photo: P.familyGathering1, startSec: 51, endSec: 59, kenBurns: 'zoom-in' },  // love
  { photo: P.familyGathering2, startSec: 59, endSec: 67, kenBurns: 'pan-left' },
  { photo: P.motoSunset, startSec: 67, endSec: 75, kenBurns: 'zoom-out' },       // triumph

  // Bridge 1 (75-93s) - every person rises
  { photo: P.redPortrait, startSec: 75, endSec: 83.5, kenBurns: 'zoom-in' },
  { photo: P.darkPortrait, startSec: 83.5, endSec: 93, kenBurns: 'zoom-out' },

  // Verse 2 (93-124s) - flow/rap
  { photo: P.mirrorSelfie, startSec: 93, endSec: 101, kenBurns: 'pan-right' },
  { photo: P.beanieSelfie, startSec: 101, endSec: 109, kenBurns: 'zoom-in' },     // praying, trying
  { photo: P.maccabi, startSec: 109, endSec: 117, kenBurns: 'pan-left' },         // "נהיה עשירים"
  { photo: P.cosplay, startSec: 117, endSec: 124, kenBurns: 'zoom-out' },

  // Chorus 2 (124-148s)
  { photo: P.familyGathering1, startSec: 124, endSec: 132, kenBurns: 'zoom-in' },
  { photo: P.gtaArt, startSec: 132, endSec: 140, kenBurns: 'pan-left' },
  { photo: P.motoForest, startSec: 140, endSec: 148, kenBurns: 'zoom-out' },

  // Bridge + Outro (148-160s)
  { photo: P.hospitalFamily, startSec: 148, endSec: 155, kenBurns: 'zoom-in' },
  { photo: P.darkPortrait, startSec: 155, endSec: 160, kenBurns: 'zoom-out' },
];
