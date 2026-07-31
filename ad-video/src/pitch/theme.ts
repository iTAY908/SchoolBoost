/**
 * פלטת צבעים לסרטון המשודרג — סגול־אינדיגו עם זהב.
 * שונה בכוונה מהפלטה המג'נטה־קורל של `AdVideo`.
 */
export const P = {
  ink: "#0E0524",
  deep: "#1E0A47",
  violet: "#4C1D95",
  bright: "#7C3AED",
  glow: "#A855F7",
  gold: "#FBBF24",
  amber: "#F59E0B",
  cyan: "#22D3EE",
  white: "#FFFFFF",
};

/**
 * ── פרטי היוצר לקלף הסיום ──────────────────────────────
 * החליפו בשם ובשם המשתמש שלכם.
 */
export const CREATOR = {
  name: "ITAY",
  handle: "@itay",
  cta: "רוצה סרטון כזה?",
  action: "שלח לי הודעה עכשיו",
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** אורך קובץ המקור בשניות */
export const SOURCE_DURATION = 15.433;
/** זנב מעוצב אחרי שהדיבור נגמר */
export const OUTRO_TAIL = 2.6;

export const TOTAL_DURATION = Math.round(
  (SOURCE_DURATION + OUTRO_TAIL) * FPS,
);

/** ממיר שניות בציר המקור לפריימים — הציר של הפלט זהה לציר המקור */
export const sec = (s: number) => Math.round(s * FPS);
