/**
 * ציר הזמן של הריל המחובר.
 *
 * שני הצילומים מנוגנים עם פס הקול המקורי שלהם, כל אחד בחלון שלו,
 * כך שהדיבור תמיד מסונכרן לתמונה שלו.
 *
 *   חלק 1  — `part1.mp4`, 0.00–6.30 בקובץ המקור
 *   סטינגר — 6.30–7.00
 *   חלק 2  — `part2.mp4`, 1.00–10.35 בקובץ המקור (הראש השקט נחתך)
 *   סיום   — 16.35–19.00
 */

export const PART1 = { at: 0.0, from: 0.0, to: 6.3 };
export const STING = { at: 6.3, to: 7.0 };
/** הראש של part2 שקט — מתחילים ממש לפני המילה הראשונה */
export const PART2 = { at: 7.0, from: 1.0, to: 10.35 };
export const OUTRO = { at: 16.35, to: 19.0 };

export type CardId = "intro" | "age" | "sting" | "outro";

export type CardBlock = { id: CardId; start: number; end: number };

/**
 * קלפים אטומים. בחלק 1 הם גם מכסים את הגרפיקות והכתוביות
 * הצרובות של קובץ המקור. בחלק 2 אין כתוביות צרובות ולכן אין צורך בהם.
 */
export const CARDS: readonly CardBlock[] = [
  { id: "intro", start: 0.0, end: 1.5 },
  { id: "age", start: 2.7, end: 4.25 },
  { id: "sting", start: STING.at, end: STING.to },
  { id: "outro", start: OUTRO.at, end: OUTRO.to },
];

export type Cue = { text: string; start: number; end: number };

/**
 * כתוביות חלק 1 — נקראו מהכתוביות הצרובות של קובץ המקור
 * ותוקנו לכתיב תקני. מוצגות בפאנל מטושטש שמסתיר את המקוריות.
 */
export const CUES_PART1: readonly Cue[] = [
  { text: "כי גיל לא קובע", start: 1.5, end: 1.98 },
  { text: "את האיכות", start: 1.98, end: 2.7 },
  { text: "אבל הסרטונים שלי מדברים בעד עצמם", start: 4.75, end: 6.3 },
];

/**
 * כתוביות חלק 2 — החלונות אותרו אוטומטית מעוצמת פס הקול
 * (זיהוי פעילות דיבור), ולכן התזמון כבר מדויק.
 *
 * ⚠️ הטקסט חסר: לא הייתה גישה למנוע תמלול בסביבה שבה נבנה הפרויקט,
 * ולקובץ הזה אין כתוביות צרובות שאפשר לקרוא מהן. אין להמציא מילים —
 * מלאו כאן את מה שנאמר בפועל וההנפשה תעבוד מיד.
 */
export const CUES_PART2: readonly Cue[] = [
  { text: "", start: 7.02, end: 8.12 },
  { text: "", start: 8.26, end: 8.86 },
  { text: "", start: 9.0, end: 9.7 },
  { text: "", start: 9.78, end: 10.98 },
  { text: "", start: 11.32, end: 12.24 },
  { text: "", start: 12.38, end: 13.02 },
  { text: "", start: 13.12, end: 14.06 },
  { text: "", start: 14.4, end: 16.26 },
];

export type Sfx = {
  src: "whoosh" | "impact" | "riser" | "sub-drop" | "tick" | "pop";
  at: number;
  volume?: number;
};

/** אפקטי קול שמלווים את ההנפשות והחיתוכים */
export const SFX: readonly Sfx[] = [
  { src: "impact", at: 0.0, volume: 0.7 },
  { src: "pop", at: 0.32, volume: 0.5 },
  { src: "whoosh", at: 1.42, volume: 0.6 },
  { src: "impact", at: 2.7, volume: 0.75 },
  { src: "pop", at: 2.86, volume: 0.55 },
  { src: "whoosh", at: 4.18, volume: 0.55 },
  { src: "riser", at: 6.15, volume: 0.5 },
  { src: "whoosh", at: 6.3, volume: 0.75 },
  { src: "impact", at: 6.62, volume: 0.8 },
  { src: "whoosh", at: 6.95, volume: 0.6 },
  { src: "impact", at: 16.35, volume: 0.8 },
  { src: "sub-drop", at: 16.35, volume: 0.5 },
  { src: "pop", at: 16.75, volume: 0.5 },
];
