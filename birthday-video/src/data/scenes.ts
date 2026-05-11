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

// Each photo is 9-10 seconds. 2-second crossfade between photos.
// 19 photos × ~8.4s = 160s total
export const SCENES: Scene[] = [
  { photo: P.darkPortrait,     startSec: 0,   endSec: 11,  kenBurns: 'zoom-in' },
  { photo: P.rooftopNight,     startSec: 9,   endSec: 20,  kenBurns: 'pan-left' },
  { photo: P.redPortrait,      startSec: 18,  endSec: 29,  kenBurns: 'zoom-in' },
  { photo: P.graffiti2026,     startSec: 27,  endSec: 38,  kenBurns: 'zoom-out' },
  { photo: P.motoRain,         startSec: 36,  endSec: 48,  kenBurns: 'pan-right' },
  { photo: P.motoSunset,       startSec: 46,  endSec: 57,  kenBurns: 'zoom-in' },
  { photo: P.motoForest,       startSec: 55,  endSec: 66,  kenBurns: 'diagonal' },
  { photo: P.familyGathering1, startSec: 64,  endSec: 75,  kenBurns: 'zoom-in' },
  { photo: P.familyGathering2, startSec: 73,  endSec: 84,  kenBurns: 'pan-left' },
  { photo: P.hospitalFamily,   startSec: 82,  endSec: 93,  kenBurns: 'zoom-out' },
  { photo: P.hospitalSmile,    startSec: 91,  endSec: 102, kenBurns: 'zoom-in' },
  { photo: P.beanieSelfie,     startSec: 100, endSec: 111, kenBurns: 'pan-up' },
  { photo: P.mirrorSelfie,     startSec: 109, endSec: 120, kenBurns: 'zoom-in' },
  { photo: P.cosplay,          startSec: 118, endSec: 129, kenBurns: 'pan-right' },
  { photo: P.maccabi,          startSec: 127, endSec: 138, kenBurns: 'zoom-out' },
  { photo: P.homeSofa,         startSec: 136, endSec: 147, kenBurns: 'zoom-in' },
  { photo: P.gtaArt,           startSec: 145, endSec: 155, kenBurns: 'pan-left' },
  { photo: P.nikeSelfie,       startSec: 153, endSec: 162, kenBurns: 'zoom-in' },
  { photo: P.darkPortrait,     startSec: 158, endSec: 165, kenBurns: 'zoom-out' },
];
