/**
 * ציר הזמן של סרטון ההנחיות — זהה לציר של קובץ המקור (30fps, 1793 פריימים).
 * כל הזמנים בשניות של המקור; `f()` ממיר לפריימים.
 */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION = 1793;

export const f = (s: number) => Math.round(s * FPS);

/** 8.68s — "ותעשה שהם יעקבו אחרי": מכאן הכתוביות עוקבות אחרי הראש */
export const FOLLOW_AT = f(8.68);
/** 19.40s — "פצצה" */
export const BOMB_IN = f(19.4);
/** 34.72s — "תחתוך את הרקע שלי" */
export const CUT_AT = f(34.72);
/** 36.72s — "ותשים אותי בצד" */
export const SIDE_AT = f(36.72);
/** 40.38s — "יש מצלמה" */
export const CAM_IN = f(40.38);
/** 43.10s — "מצלמת הדמיה שמתפרקת לחתיכות" */
export const EXPLODE_AT = f(43.1);
/** 54.68s — "אילו חלקים יש בתוך המצלמה" */
export const SCAN_AT = f(54.68);

export type Cue = { from: number; to: number; text: string };

/** תמלול (Whisper medium, עברית) שעבר תיקון ידני */
export const CUES: Cue[] = [
  { from: 0.08, to: 1.0, text: "קלוד" },
  { from: 1.18, to: 2.2, text: "קלוד, תעשה" },
  { from: 2.44, to: 3.74, text: "שכל הכתוביות" },
  { from: 4.1, to: 5.7, text: "שאני מדבר עכשיו" },
  { from: 5.84, to: 8.42, text: "יהיו מאחוריי" },
  { from: 8.68, to: 10.98, text: "ותעשה שהם יעקבו אחרי" },
  { from: 11.3, to: 12.95, text: "שהכתוביות האלה יעקבו" },
  { from: 12.95, to: 14.92, text: "אחרי התנועה של הראש שלי" },
  { from: 16.48, to: 18.92, text: "ותעשה שמאחוריי יש" },
  { from: 19.4, to: 20.2, text: "פצצה" },
  { from: 20.26, to: 22.1, text: "בסגנון אנימה" },
  { from: 23.48, to: 27.2, text: "ותעשה שהפצצה לא זזה" },
  { from: 27.38, to: 28.6, text: "אם פתאום, נגיד," },
  { from: 28.6, to: 29.96, text: "אני מזיז את המצלמה" },
  { from: 30.14, to: 31.32, text: "מצד לצד" },
  { from: 33.58, to: 34.4, text: "ועכשיו" },
  { from: 34.72, to: 36.52, text: "תחתוך את הרקע שלי" },
  { from: 36.72, to: 38.5, text: "ותשים אותי בצד," },
  { from: 38.5, to: 40.16, text: "ותעשה שלידי" },
  { from: 40.38, to: 42.82, text: "יש מצלמה" },
  { from: 43.1, to: 45.0, text: "מצלמת הדמיה" },
  { from: 45.0, to: 47.36, text: "שמתפרקת לחתיכות" },
  { from: 48.16, to: 50.86, text: "ושזה מצלמת הדמיה" },
  { from: 51.0, to: 52.88, text: "שמראה בדיוק" },
  { from: 53.0, to: 54.2, text: "אילו כלים," },
  { from: 54.68, to: 55.95, text: "אילו חלקים" },
  { from: 55.95, to: 57.54, text: "יש בתוך המצלמה" },
];

/** מסלול מוחלק (פיקסלים של הפלט) — מופק ע"י scripts/instr/smooth.py */
export type Track = {
  n: number;
  /** מרכז הפנים, אופקי */
  cx: number[];
  /** קודקוד הראש (השיער) */
  top: number[];
  /** רוחב הפנים */
  fw: number[];
  /** תזוזת המצלמה המצטברת (מעקב רקע) */
  camx: number[];
  camy: number[];
};
