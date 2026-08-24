import { esc, bold, italic, keyboard, BACK_ROW } from '../ui.js';
import { parseDate, humanDate, todayKey, daysBetween } from '../time.js';

const MAX_LIST = 12;

export function openItems(chat) {
  return chat.homework
    .filter((h) => !h.done)
    .sort((a, b) => {
      if (!a.due && !b.due) return a.id - b.id;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    });
}

/** מוסיף מטלה ומחזיר אותה. משמש גם בתפריט וגם בקיצור הכתיבה החופשית. */
export function addHomework(store, chatId, { subject, title, due }) {
  const chat = store.chat(chatId);
  const item = {
    id: store.nextId(chatId, 'homework'),
    subject: subject || 'כללי',
    title,
    due: due || null,
    done: false,
    createdAt: Date.now(),
  };
  chat.homework.push(item);
  store.markDirty();
  return item;
}

function dueLabel(item, tz) {
  if (!item.due) return italic('בלי תאריך');
  const diff = daysBetween(todayKey(tz), item.due);
  const text = humanDate(item.due, tz);
  if (diff < 0) return `🔴 ${esc(text)} — באיחור`;
  if (diff === 0) return `🔴 ${esc(text)}`;
  if (diff === 1) return `🟠 ${esc(text)}`;
  return `🟢 ${esc(text)}`;
}

export function renderList(chat, tz) {
  const items = openItems(chat);
  const lines = [bold('📝 שיעורי בית פתוחים'), ''];

  if (!items.length) {
    lines.push(italic('אין מטלות פתוחות. כל הכבוד! 🎉'));
  } else {
    items.slice(0, MAX_LIST).forEach((item, i) => {
      lines.push(`${i + 1}. ${bold(item.subject)} — ${esc(item.title)}`);
      lines.push(`    ${dueLabel(item, tz)}`);
    });
    if (items.length > MAX_LIST) {
      lines.push('', italic(`ועוד ${items.length - MAX_LIST} מטלות…`));
    }
  }

  const doneCount = chat.homework.filter((h) => h.done).length;
  const rows = [];
  const shown = items.slice(0, MAX_LIST);
  for (let i = 0; i < shown.length; i += 3) {
    rows.push(shown.slice(i, i + 3).map((item, j) => [`✅ ${i + j + 1}`, `hw:done:${item.id}`]));
  }
  rows.push([['➕ מטלה חדשה', 'hw:add']]);
  if (shown.length) rows.push([['🗑 מחיקה', 'hw:delmenu']]);
  if (doneCount) rows.push([[`📦 שהושלמו (${doneCount})`, 'hw:archive']]);
  rows.push([BACK_ROW]);

  return { text: lines.join('\n'), ...keyboard(rows) };
}

function renderArchive(chat, tz) {
  const items = chat.homework.filter((h) => h.done).slice(-MAX_LIST).reverse();
  const lines = [bold('📦 מטלות שהושלמו'), ''];
  if (!items.length) lines.push(italic('עוד לא סימנת מטלות כבוצעו.'));
  else items.forEach((item) => {
    const when = item.due ? ` (${humanDate(item.due, tz)})` : '';
    lines.push(`✔️ ${bold(item.subject)} — ${esc(item.title)}${esc(when)}`);
  });
  return {
    text: lines.join('\n'),
    ...keyboard([[['⬅️ חזרה למטלות', 'hw:menu']], [BACK_ROW]]),
  };
}

function renderDeleteMenu(chat) {
  const items = openItems(chat).slice(0, MAX_LIST);
  const rows = [];
  for (let i = 0; i < items.length; i += 3) {
    rows.push(items.slice(i, i + 3).map((item, j) => [`🗑 ${i + j + 1}`, `hw:del:${item.id}`]));
  }
  rows.push([['⬅️ חזרה', 'hw:menu']]);
  return {
    text: [bold('🗑 מחיקת מטלה'), '', 'בחר את מספר המטלה שברצונך למחוק:'].join('\n'),
    ...keyboard(rows),
  };
}

export default {
  name: 'hw',

  commands: {
    '/hw': (ctx) => ctx.render(renderList(ctx.chat, ctx.tz)),
    '/homework': (ctx) => ctx.render(renderList(ctx.chat, ctx.tz)),
  },

  async onCallback(ctx, action, arg) {
    const chat = ctx.chat;

    switch (action) {
      case 'menu':
        return ctx.render(renderList(chat, ctx.tz));

      case 'archive':
        return ctx.render(renderArchive(chat, ctx.tz));

      case 'delmenu':
        return ctx.render(renderDeleteMenu(chat));

      case 'add':
        ctx.setState('hw:subject', {});
        await ctx.answer();
        return ctx.reply(
          [bold('➕ מטלה חדשה'), '', 'באיזה מקצוע? (למשל: מתמטיקה)', '', italic('/cancel לביטול')].join('\n'),
        );

      case 'done': {
        const item = chat.homework.find((h) => h.id === Number(arg));
        if (!item) return ctx.answer('המטלה כבר לא קיימת');
        item.done = true;
        item.doneAt = Date.now();
        ctx.store.markDirty();
        await ctx.answer(`✅ ${item.title}`);
        return ctx.render(renderList(chat, ctx.tz));
      }

      case 'del': {
        const idx = chat.homework.findIndex((h) => h.id === Number(arg));
        if (idx === -1) return ctx.answer('המטלה כבר לא קיימת');
        const [removed] = chat.homework.splice(idx, 1);
        ctx.store.markDirty();
        await ctx.answer(`🗑 נמחק: ${removed.title}`);
        return ctx.render(renderList(chat, ctx.tz));
      }

      default:
        return ctx.answer();
    }
  },

  states: {
    'hw:subject': (ctx) => {
      ctx.setState('hw:title', { subject: ctx.text.trim() });
      return ctx.reply('מה צריך לעשות? (למשל: תרגילים 4-7 בעמוד 92)');
    },

    'hw:title': (ctx) => {
      ctx.setState('hw:due', { ...ctx.state.data, title: ctx.text.trim() });
      return ctx.reply(
        ['מתי צריך להגיש?', '', italic('היום · מחר · יום ראשון · 12.6 · או "בלי" אם אין תאריך')].join('\n'),
      );
    },

    'hw:due': (ctx) => {
      const raw = ctx.text.trim();
      let due = null;
      if (!/^(בלי|ללא|אין|-)$/.test(raw)) {
        due = parseDate(raw, ctx.tz);
        if (!due) {
          return ctx.reply('לא הצלחתי להבין את התאריך 🤔 נסה למשל: מחר, יום שני, 12.6 — או "בלי".');
        }
      }
      const item = addHomework(ctx.store, ctx.chatId, { ...ctx.state.data, due });
      ctx.clearState();
      return ctx.reply(
        [
          '✅ נוספה מטלה:',
          `${bold(item.subject)} — ${esc(item.title)}`,
          `📅 ${due ? esc(humanDate(due, ctx.tz)) : italic('בלי תאריך')}`,
        ].join('\n'),
        keyboard([[['📝 לרשימת המטלות', 'hw:menu']], [BACK_ROW]]),
      );
    },
  },
};
