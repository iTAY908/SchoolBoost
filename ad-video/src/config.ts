/**
 * ── כאן משנים את פרטי המותג ──────────────────────────────
 * החליפו את השורות הבאות בפרטים שלכם והסרטון יתעדכן אוטומטית.
 */
export const BRAND = {
  name: "STUDIO CUT",
  tagline: "מערכת העריכה שדואגת לתוצאות",
  handle: "@studiocut",
};

/** מדדי התוצאות שמוצגים בשקופית 3 */
export const METRICS = [
  { value: 96, suffix: "%", label: "מעורבות" },
  { value: 3.2, suffix: "x", label: "יותר צפיות" },
  { value: 91, suffix: "%", label: "שימור צופים" },
] as const;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** אורך כל שקופית בפריימים (30 פריימים = שנייה) */
export const SCENE_DURATIONS = {
  hook: 66,
  gallery: 84,
  results: 90,
  brand: 78,
  cta: 108,
} as const;

export const TRANSITION_FRAMES = 10;

const sceneTotal = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);
const transitionCount = Object.keys(SCENE_DURATIONS).length - 1;

/** משך הסרטון הכולל — מעברים חופפים ולכן מקצרים את הציר */
export const TOTAL_DURATION =
  sceneTotal - transitionCount * TRANSITION_FRAMES;

export const COLORS = {
  magentaDeep: "#B3095E",
  magenta: "#E30B79",
  pink: "#FF2D8E",
  coral: "#FF7A59",
  gold: "#FFD84D",
  green: "#2ED573",
  white: "#FFFFFF",
  ink: "#2B0418",
};
