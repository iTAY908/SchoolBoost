// טקסטים, מקלדות ועזרי עיצוב להודעות.

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function bold(s) { return `<b>${esc(s)}</b>`; }
export function italic(s) { return `<i>${esc(s)}</i>`; }

/** בונה מקלדת inline משורות של [טקסט, data]. */
export function keyboard(rows) {
  return {
    reply_markup: {
      inline_keyboard: rows.map((row) =>
        row.filter(Boolean).map(([text, data]) => ({ text, callback_data: data }))),
    },
  };
}

export const MAIN_MENU = keyboard([
  [['📅 מערכת שעות', 'sc:menu'], ['📝 שיעורי בית', 'hw:menu']],
  [['🎯 מבחנים', 'ex:menu'], ['💯 ציונים', 'gr:menu']],
  [['⏰ תזכורות', 'rm:menu'], ['⚙️ הגדרות', 'st:menu']],
  [['☀️ הסיכום של היום', 'core:today']],
]);

export const BACK_ROW = ['⬅️ תפריט ראשי', 'core:menu'];

export const WELCOME = [
  '👋 שלום! אני <b>SchoolBoost</b> — עוזר הלימודים שלך.',
  '',
  'אני יכול לזכור בשבילך:',
  '📅 <b>מערכת שעות</b> — מה יש היום ומחר',
  '📝 <b>שיעורי בית</b> — מה צריך להגיש ומתי',
  '🎯 <b>מבחנים</b> — כמה ימים נשארו',
  '💯 <b>ציונים</b> — ממוצע לפי מקצוע',
  '⏰ <b>תזכורות</b> — אני אזכיר לך בזמן',
  '',
  'כל בוקר אשלח לך סיכום של היום. בחר מה לעשות:',
].join('\n');

export const HELP = [
  bold('📖 מדריך מהיר'),
  '',
  '<b>פקודות</b>',
  '/start — פתיחה ותפריט',
  '/menu — תפריט ראשי',
  '/today — הסיכום של היום',
  '/week — מערכת שעות שבועית',
  '/hw — שיעורי בית פתוחים',
  '/exams — מבחנים קרובים',
  '/grades — ציונים וממוצעים',
  '/remind — תזכורת חדשה',
  '/cancel — ביטול פעולה נוכחית',
  '/help — העזרה הזו',
  '',
  '<b>קיצורי דרך בכתיבה חופשית</b>',
  '• <code>שיעורי בית מתמטיקה תרגילים 4-7 מחר</code>',
  '• <code>מבחן אנגלית 12.6</code>',
  '• <code>ציון 95 בהיסטוריה</code>',
  '• <code>תזכיר לי מחר ב-18:00 להביא ציוד ספורט</code>',
  '',
  '<b>פורמט תאריכים</b>',
  'היום · מחר · מחרתיים · יום שלישי · 12.6 · 12/06/2026 · בעוד 3 ימים',
].join('\n');

/** רשימה ממוספרת עם תבליטים, או טקסט ריק מנומס. */
export function listOr(items, emptyText) {
  return items.length ? items.join('\n') : italic(emptyText);
}
