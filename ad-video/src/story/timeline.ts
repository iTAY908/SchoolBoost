/**
 * ציר הזמן של סרטון הסטורי החדש.
 *
 * כל הזמנים כאן הם **שניות בציר הפלט** (הקומפוזיציה), לא בציר קובץ המקור.
 * `at` = מתי הקטע מתחיל בפלט, `from`/`to` = החלון בתוך קובץ המקור.
 *
 *   0.00–1.50   כרטיס פתיחה
 *   1.50–6.17   story-a.mp4
 *   6.17–6.90   סטינגר מעבר
 *   6.90–26.70  story-b.mp4
 *   26.70–33.20 רצף ראווה — מדגים בדיוק את מה שהדובר בדיוק סיים למנות
 *   33.20–35.70 כרטיס סיום
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const TOTAL_SECONDS = 35.7;
export const TOTAL_DURATION = 1071;

/** ממיר שניות בציר הפלט לפריימים */
export const sec = (s: number) => Math.round(s * FPS);

export const CLIP_A = { at: 1.5, from: 0.0, to: 4.67 }; // story-a.mp4 → output 1.50–6.17
export const CLIP_B = { at: 6.9, from: 0.0, to: 19.8 }; // story-b.mp4 → output 6.90–26.70
export const STING = { at: 6.17, to: 6.9 };
export const INTRO = { at: 0.0, to: 1.5 };
/** רצף הראווה — 195 פריימים בדיוק, ראו `SHOWCASE_DURATION` */
export const SHOWCASE = { at: 26.7, to: 33.2 };
export const OUTRO = { at: 33.2, to: 35.7 };

/** הרגע שבו נאמר "15" — אותר בתמלול. סרגל הגילים חייב לנחות כאן. */
export const AGE_MOMENT = 9.3;

/** חלון של כתובית בודדת — טקסט וזמני התחלה/סיום בשניות של ציר הפלט */
export type Cue = { text: string; start: number; end: number };

/**
 * התמלול — הופק ב-Whisper-medium ותוקן ידנית.
 * מקור אמת יחיד: אין לשנות את הטקסט או להמציא מילים.
 */
export const CUES: readonly Cue[] = [
  { text: "אם אתם מחפשים עורך וידאו", start: 1.5, end: 3.4 },
  { text: "לעריכת סרטונים", start: 3.4, end: 4.25 },
  { text: "אז הסרטון הזה בשבילכם", start: 4.25, end: 5.85 },
  { text: "שלום, שמי איתי ואני בן 15", start: 6.9, end: 9.45 },
  { text: "ואני מתעסק בתחום הזה כבר מגיל קטן", start: 9.45, end: 12.7 },
  { text: "ואני מאוד אוהב את התחום הזה", start: 12.94, end: 14.85 },
  { text: "אז אם אתם מחפשים עורך וידאו מקצועי", start: 15.02, end: 18.18 },
  { text: "שיערוך בשבילכם סרטון בר מצווה מושקע", start: 18.26, end: 21.35 },
  { text: "סרטון לרשתות חברתיות", start: 21.6, end: 24.35 },
  { text: "אז פנו אליי באינסטגרם", start: 24.74, end: 26.7 },
];

/** חלונות שבהם גרפיקה מלאה משתלטת על המסך — אסור להציג בהם כתובית */
export const BLOCKED: readonly { start: number; end: number }[] = [
  { start: INTRO.at, end: INTRO.to },
  { start: STING.at, end: STING.to },
  { start: OUTRO.at, end: OUTRO.to },
];
