import { esc, bold, italic, keyboard, BACK_ROW } from '../ui.js';
import { parseTime } from '../time.js';

function render(chat) {
  const s = chat.settings;
  const lines = [
    bold('⚙️ הגדרות'),
    '',
    `☀️ סיכום יומי: ${s.digestEnabled ? bold('פעיל') : italic('כבוי')}`,
    `🕐 שעת הסיכום: ${bold(`${String(s.digestHour).padStart(2, '0')}:00`)}`,
    `🌍 אזור זמן: ${esc(s.tz)}`,
    '',
    italic('הסיכום היומי כולל את מערכת השעות, מטלות להיום ומבחנים קרובים.'),
  ];

  const rows = [
    [[s.digestEnabled ? '🔕 כיבוי סיכום יומי' : '🔔 הפעלת סיכום יומי', 'st:toggle']],
    [['🕐 שינוי שעת הסיכום', 'st:hour']],
    [['🧹 מחיקת כל הנתונים', 'st:wipe']],
    [BACK_ROW],
  ];

  return { text: lines.join('\n'), ...keyboard(rows) };
}

export default {
  name: 'st',

  commands: {
    '/settings': (ctx) => ctx.render(render(ctx.chat)),
  },

  async onCallback(ctx, action) {
    const s = ctx.chat.settings;

    switch (action) {
      case 'menu':
        return ctx.render(render(ctx.chat));

      case 'toggle':
        s.digestEnabled = !s.digestEnabled;
        ctx.store.markDirty();
        await ctx.answer(s.digestEnabled ? '🔔 הופעל' : '🔕 כובה');
        return ctx.render(render(ctx.chat));

      case 'hour':
        ctx.setState('st:hour', {});
        await ctx.answer();
        return ctx.reply(['באיזו שעה לשלוח את הסיכום היומי?', '', italic('למשל: 7 או 06:30')].join('\n'));

      case 'wipe':
        await ctx.answer();
        return ctx.render({
          text: [bold('🧹 מחיקת כל הנתונים'), '', 'זה ימחק מערכת שעות, מטלות, מבחנים, ציונים ותזכורות.',
            bold('אי אפשר לשחזר.'), '', 'להמשיך?'].join('\n'),
          ...keyboard([
            [['כן, מחק הכול', 'st:wipeyes'], ['לא, בטל', 'st:menu']],
          ]),
        });

      case 'wipeyes': {
        const chat = ctx.chat;
        chat.schedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        chat.homework = [];
        chat.exams = [];
        chat.grades = [];
        chat.reminders = [];
        chat.digest = { lastSent: null };
        ctx.store.markDirty();
        await ctx.answer('🧹 נמחק');
        return ctx.render({
          text: [bold('🧹 הכול נמחק'), '', 'מתחילים מדף חלק.'].join('\n'),
          ...keyboard([[BACK_ROW]]),
        });
      }

      default:
        return ctx.answer();
    }
  },

  states: {
    'st:hour': (ctx) => {
      const t = parseTime(ctx.text.trim());
      if (!t) return ctx.reply('צריך שעה תקינה, למשל 7 או 06:30.');
      ctx.chat.settings.digestHour = t.hour;
      ctx.store.markDirty();
      ctx.clearState();
      return ctx.reply(
        `✅ הסיכום היומי יישלח בשעה ${bold(`${String(t.hour).padStart(2, '0')}:00`)}`,
        keyboard([[['⚙️ להגדרות', 'st:menu']], [BACK_ROW]]),
      );
    },
  },
};
