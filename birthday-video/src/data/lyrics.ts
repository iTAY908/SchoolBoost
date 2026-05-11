export type LyricEffect = 'none' | 'wave' | 'shake' | 'glow' | 'rise' | 'sparkle' | 'fall-rise';

export interface LyricLine {
  text: string;
  startSec: number;
  endSec: number;
  effect: LyricEffect;
  color?: string;
  size?: 'normal' | 'large';
}

// Total song duration: 160 seconds
// Structure: Verse1 → Bridge1 → Chorus1 → Bridge2 → Verse2 → Chorus2 → Bridge3 → Outro
export const LYRICS: LyricLine[] = [
  // === VERSE 1 ===
  { text: 'אני מאמין באמונה שלמה', startSec: 4, endSec: 8, effect: 'none' },
  { text: 'שכל מה שקורה איתי זה רק לטובתי', startSec: 8, endSec: 12.5, effect: 'none' },
  { text: 'ובאמת שאני לא כועס על אף אחד', startSec: 12.5, endSec: 17, effect: 'none' },
  { text: 'כל יום לומד איך לשחרר קצת מעצמי', startSec: 17, endSec: 21, effect: 'none' },

  // === PRE-CHORUS ===
  { text: 'אפחד לא יודע מה יהיה בסוף', startSec: 21, endSec: 25, effect: 'shake' },
  { text: 'ככה החיים האלה on & off', startSec: 25, endSec: 29, effect: 'none' },
  { text: 'מה שמשנה באמת זה רק הנשמה', startSec: 29, endSec: 33, effect: 'glow' },
  { text: 'שמחה בריאות והפרנסה', startSec: 33, endSec: 36.5, effect: 'none' },
  { text: 'הים סוער ואני בתוך סירה', startSec: 36.5, endSec: 40.5, effect: 'wave' },
  { text: 'אני מיטלטל אבל תופס חזק', startSec: 40.5, endSec: 44, effect: 'shake' },
  { text: 'אחרי הכל', startSec: 44, endSec: 46.5, effect: 'none', size: 'large' },
  { text: 'אני חלק אלוקה ממעל', startSec: 46.5, endSec: 51, effect: 'rise', size: 'large' },

  // === CHORUS 1 ===
  { text: 'כל עכבה לטובה', startSec: 51, endSec: 55, effect: 'sparkle', color: '#FFD700', size: 'large' },
  { text: 'מקבל הכל באהבה', startSec: 55, endSec: 59, effect: 'sparkle' },
  { text: 'גם אם לא נשאר לי שקל', startSec: 59, endSec: 63, effect: 'none' },
  { text: 'יודע הכל זה הבל הבלים', startSec: 63, endSec: 67, effect: 'none' },
  { text: 'מה שלא יבוא אין יאוש בעולם', startSec: 67, endSec: 71, effect: 'glow' },
  { text: 'כל עכבה לטובה', startSec: 71, endSec: 75, effect: 'sparkle', color: '#FFD700', size: 'large' },

  // === BRIDGE 1 ===
  { text: 'כל בן אדם נופל ואז הוא קם', startSec: 75, endSec: 79.5, effect: 'fall-rise' },
  { text: 'כל בן אדם הולך ונעלם', startSec: 79.5, endSec: 83.5, effect: 'none' },
  { text: 'כל בן אדם', startSec: 83.5, endSec: 86, effect: 'none', size: 'large' },
  { text: 'כל בן אדם', startSec: 86, endSec: 88.5, effect: 'none', size: 'large' },
  { text: 'הוא חלק אלוקה ממעל', startSec: 88.5, endSec: 93, effect: 'rise', size: 'large' },

  // === VERSE 2 ===
  { text: 'תני לי לדבר תקשיבי', startSec: 93, endSec: 97, effect: 'none' },
  { text: 'גם ככה אני היפראקטיבי', startSec: 97, endSec: 101, effect: 'shake' },
  { text: 'אני משתדל אני מתפלל', startSec: 101, endSec: 105, effect: 'none' },
  { text: 'שאבא יהיה גאה בי', startSec: 105, endSec: 109, effect: 'glow' },
  { text: 'עם מסר נכון בשירים', startSec: 109, endSec: 113, effect: 'none' },
  { text: 'בסוף עוד נהיה עשירים', startSec: 113, endSec: 117, effect: 'none' },
  { text: 'לא נחכה לעשירי', startSec: 117, endSec: 120, effect: 'none' },
  { text: 'נשמה שלי בסוף תראי', startSec: 120, endSec: 124, effect: 'glow' },

  // === CHORUS 2 ===
  { text: 'כל עכבה לטובה', startSec: 124, endSec: 128, effect: 'sparkle', color: '#FFD700', size: 'large' },
  { text: 'מקבל הכל באהבה', startSec: 128, endSec: 132, effect: 'sparkle' },
  { text: 'גם אם לא נשאר לי שקל', startSec: 132, endSec: 136, effect: 'none' },
  { text: 'יודע הכל זה הבל הבלים', startSec: 136, endSec: 140, effect: 'none' },
  { text: 'מה שלא יבוא אין יאוש בעולם', startSec: 140, endSec: 144, effect: 'glow' },
  { text: 'כל עכבה לטובה', startSec: 144, endSec: 148, effect: 'sparkle', color: '#FFD700', size: 'large' },

  // === BRIDGE 2 + OUTRO ===
  { text: 'כל בן אדם נופל ואז הוא קם', startSec: 148, endSec: 152, effect: 'fall-rise' },
  { text: 'כל בן אדם הולך ונעלם', startSec: 152, endSec: 155, effect: 'none' },
  { text: 'כל בן אדם', startSec: 155, endSec: 157, effect: 'none', size: 'large' },
  { text: 'הוא חלק אלוקה ממעל', startSec: 157, endSec: 160, effect: 'rise', size: 'large', color: '#FFD700' },
];
