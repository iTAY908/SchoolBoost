export interface Scene {
  photo: string;
  startSec: number;
  endSec: number;
  kenBurns: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'diagonal';
}

const P = {
  darkPortrait:     '60dc236f-1000065510.png',
  motoRain:         '06bb47d9-1000064571.jpg',
  motoSunset:       '72c8c8b1-1000064497.png',
  motoForest:       'cde173e4-1000059489.jpg',
  gtaArt:           '9ee0e4d7-1000063408.png',
  redPortrait:      '75dd113d-1000062478.jpg',
  rooftopNight:     'eda0532d-1000062476.jpg',
  graffiti2026:     '6d46f087-1000060496.jpg',
  familyGathering1: 'b87abfbf-1000077548.jpg',
  familyGathering2: 'af247da9-1000077546.jpg',
  hospitalFamily:   '5dfb6224-1000061012.jpg',
  hospitalSmile:    'fe97519b-1000061009.jpg',
  maccabi:          'c89933dc-1000072061.jpg',
  beanieSelfie:     '99801f41-1000068124.jpg',
  beanieStyle:      '78a98282-1000068125.jpg',
  mirrorSelfie:     '5ede07f5-1000068122.jpg',
  cosplay:          '40351e12-1000068117.jpg',
  homeSofa:         '23c2cea8-1000066645.jpg',
  nikeSelfie:       '6e55969e-1000075653.jpg',
};

// Photos start at 25s (after stair animation). Each photo 4s, 0.5s crossfade overlap → step 3.5s.
export const SCENES: Scene[] = [
  { photo: P.darkPortrait,     startSec: 25.0, endSec: 29.0, kenBurns: 'zoom-in' },
  { photo: P.rooftopNight,     startSec: 28.5, endSec: 32.5, kenBurns: 'pan-left' },
  { photo: P.redPortrait,      startSec: 32.0, endSec: 36.0, kenBurns: 'zoom-in' },
  { photo: P.graffiti2026,     startSec: 35.5, endSec: 39.5, kenBurns: 'zoom-out' },
  { photo: P.motoRain,         startSec: 39.0, endSec: 43.0, kenBurns: 'pan-right' },
  { photo: P.motoSunset,       startSec: 42.5, endSec: 46.5, kenBurns: 'zoom-in' },
  { photo: P.motoForest,       startSec: 46.0, endSec: 50.0, kenBurns: 'diagonal' },
  { photo: P.familyGathering1, startSec: 49.5, endSec: 53.5, kenBurns: 'zoom-in' },
  { photo: P.familyGathering2, startSec: 53.0, endSec: 57.0, kenBurns: 'pan-left' },
  { photo: P.hospitalFamily,   startSec: 56.5, endSec: 60.5, kenBurns: 'zoom-out' },
  { photo: P.hospitalSmile,    startSec: 60.0, endSec: 64.0, kenBurns: 'zoom-in' },
  { photo: P.beanieSelfie,     startSec: 63.5, endSec: 67.5, kenBurns: 'pan-up' },
  { photo: P.mirrorSelfie,     startSec: 67.0, endSec: 71.0, kenBurns: 'zoom-in' },
  { photo: P.cosplay,          startSec: 70.5, endSec: 74.5, kenBurns: 'pan-right' },
  { photo: P.maccabi,          startSec: 74.0, endSec: 78.0, kenBurns: 'zoom-out' },
  { photo: P.homeSofa,         startSec: 77.5, endSec: 81.5, kenBurns: 'zoom-in' },
  { photo: P.gtaArt,           startSec: 81.0, endSec: 85.0, kenBurns: 'pan-left' },
  { photo: P.nikeSelfie,       startSec: 84.5, endSec: 88.5, kenBurns: 'zoom-in' },
  { photo: P.darkPortrait,     startSec: 88.0, endSec: 92.0, kenBurns: 'zoom-out' },
];
