// אבחון: למה הבוט לא מגיב?
// הרצה:  npm run doctor        (בדיקה בלבד)
//        npm run doctor -- --fix  (מסיר webhook אם הוא חוסם את ה-polling)

import { config } from '../src/config.js';

const FIX = process.argv.includes('--fix');
const problems = [];
const notes = [];

function line(icon, text) {
  console.log(`${icon} ${text}`);
}

async function call(method, payload = {}) {
  const res = await fetch(`${config.apiBase}/bot${config.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

console.log('\n🩺 אבחון SchoolBoost\n' + '─'.repeat(40));

// 1. טוקן קיים?
if (!config.token) {
  line('❌', 'אין TELEGRAM_BOT_TOKEN');
  console.log('\n   תקן כך:');
  console.log('   cp .env.example .env');
  console.log('   # ערוך את .env והדבק את הטוקן מ-@BotFather\n');
  process.exit(1);
}
line('✅', `נמצא טוקן (${config.token.split(':')[0]}:···)`);

// 2. הטוקן תקף?
let me;
try {
  const res = await call('getMe');
  if (!res.ok) {
    if (res.error_code === 401) {
      line('❌', 'הטוקן נדחה על ידי טלגרם (401)');
      console.log('\n   הטוקן שגוי או בוטל. קח טוקן חדש: @BotFather → /mybots → API Token');
      console.log('   (אם ביצעת /revoke — הטוקן הישן כבר לא תקף, צריך את החדש)\n');
      process.exit(1);
    }
    line('❌', `getMe נכשל: ${res.error_code} ${res.description}`);
    process.exit(1);
  }
  me = res.result;
  line('✅', `הטוקן תקף — הבוט הוא @${me.username}`);
  notes.push(`כתוב לבוט בטלגרם בכתובת: https://t.me/${me.username}`);
} catch (err) {
  line('❌', `אין חיבור לטלגרם: ${err.message}`);
  console.log('\n   בדוק חיבור לאינטרנט, חומת אש או פרוקסי.\n');
  process.exit(1);
}

// 3. webhook תפוס? webhook "גונב" את העדכונים מה-polling
const hook = await call('getWebhookInfo');
if (hook.ok && hook.result.url) {
  line('❌', `מוגדר webhook: ${hook.result.url}`);
  problems.push('webhook פעיל חוסם את ה-long polling — הבוט לא יקבל הודעות');
  if (FIX) {
    const del = await call('deleteWebhook', { drop_pending_updates: false });
    line(del.ok ? '🔧' : '⚠️', del.ok ? 'ה-webhook הוסר' : `הסרת webhook נכשלה: ${del.description}`);
    if (del.ok) problems.pop();
  } else {
    notes.push('הרץ: npm run doctor -- --fix  כדי להסיר את ה-webhook');
  }
} else {
  line('✅', 'אין webhook מוגדר — long polling אמור לעבוד');
}

if (hook.ok && hook.result.pending_update_count) {
  line('📬', `${hook.result.pending_update_count} עדכונים ממתינים (הודעות ששלחת ואף אחד לא קרא)`);
  notes.push('העדכונים הממתינים מוכיחים שההודעות מגיעות לטלגרם — רק אין תהליך שקורא אותן');
}
if (hook.ok && hook.result.last_error_message) {
  line('⚠️', `שגיאת webhook אחרונה: ${hook.result.last_error_message}`);
}

// 4. מישהו אחר כבר מושך עדכונים?
const poll = await call('getUpdates', { timeout: 0, limit: 1 });
if (!poll.ok && poll.error_code === 409) {
  line('❌', 'התנגשות 409 — מופע אחר של הבוט כבר רץ');
  problems.push('רץ יותר ממופע אחד עם אותו טוקן. עצור את כולם והשאר אחד בלבד');
} else if (poll.ok) {
  line('✅', 'אפשר למשוך עדכונים — אין מופע אחר שרץ כרגע');
  problems.push('אף תהליך לא רץ ומקשיב. הבוט יגיב רק כש-`npm start` פועל');
} else {
  line('⚠️', `getUpdates החזיר ${poll.error_code}: ${poll.description}`);
}

// סיכום
console.log('─'.repeat(40));
if (!problems.length) {
  console.log('\n✅ הכול תקין.\n');
} else {
  console.log('\n🔎 מה מצאתי:\n');
  problems.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  console.log('\n▶️  להפעלת הבוט:  npm start');
  console.log('   (השאר את החלון פתוח — כשהתהליך נסגר, הבוט מפסיק לענות)\n');
}
if (notes.length) {
  console.log('💡 ' + notes.join('\n💡 ') + '\n');
}
