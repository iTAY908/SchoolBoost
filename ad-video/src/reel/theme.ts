/**
 * הרכב הריל המחבר בין שני הצילומים.
 * הפלטה והמיתוג מגיעים מ-`pitch` כדי שיישאר מקור אמת אחד.
 */
export { P, CREATOR } from "../pitch/theme";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** אורך ההרכב — חייב להתאים לאורך `music-bed.wav` (scripts/make-audio.mjs) */
export const TOTAL_SECONDS = 19.0;
export const TOTAL_DURATION = Math.round(TOTAL_SECONDS * FPS);

export const sec = (s: number) => Math.round(s * FPS);
