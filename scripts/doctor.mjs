// אבחון: למה הבוט לא מגיב, ולמה הוא איטי?
// הרצה:  npm run doctor           (בדיקה בלבד)
//        npm run doctor -- --fix  (מסיר webhook אם הוא חוסם את ה-polling)

import net from 'node:net';
import dnsp from 'node:dns/promises';
import { config } from '../src/config.js';
import { tuneNetwork } from '../src/net.js';

const FIX = process.argv.includes('--fix');
const problems = [];
const notes = [];

const line = (icon, text) => console.log(`${icon} ${text}`);

async function call(method, payload = {}) {
  const res = await fetch(`${config.apiBase}/bot${config.token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    return { ok: false, error_code: res.status, description: `תשובה שאינה JSON: ${raw.slice(0, 120)}` };
  }
}

/** ניסיון חיבור TCP גולמי לכתובת אחת, כדי לבדוק IPv4 מול IPv6 בנפרד. */
function probe(address, family, port = 443, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({ host: address, port, family, autoSelectFamily: false });
    const finish = (ok, reason) => {
      socket.destroy();
      resolve({ ok, ms: Date.now() - started, reason });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'פסק זמן'));
    socket.once('error', (err) => finish(false, err.code || err.message));
  });
}

console.log('\n🩺 אבחון SchoolBoost\n' + '─'.repeat(46));

// ── 1. טוקן ────────────────────────────────────────────────
if (!config.token) {
  line('❌', 'אין TELEGRAM_BOT_TOKEN');
  console.log('\n   תקן כך:');
  console.log('   cp .env.example .env');
  console.log('   # ערוך את .env והדבק את הטוקן מ-@BotFather\n');
  process.exit(1);
}
line('✅', `נמצא טוקן (${config.token.split(':')[0]}:···)`);

// ── 2. איכות החיבור לטלגרם ─────────────────────────────────
const host = new URL(config.apiBase).hostname;
let ipv6Broken = false;

if (host !== 'localhost' && host !== '127.0.0.1') {
  const [v4, v6] = await Promise.all([
    dnsp.resolve4(host).catch(() => []),
    dnsp.resolve6(host).catch(() => []),
  ]);

  if (!v4.length && !v6.length) {
    line('❌', `לא הצלחתי לתרגם את הכתובת ${host}`);
    problems.push('בעיית DNS - בדוק חיבור לאינטרנט או נסה DNS אחר (למשל 1.1.1.1)');
  }

  if (v4.length) {
    const r = await probe(v4[0], 4);
    line(r.ok ? '✅' : '❌', `IPv4 → ${v4[0]}  ${r.ok ? `מחובר תוך ${r.ms}ms` : `נכשל (${r.reason})`}`);
    if (!r.ok) problems.push('גם IPv4 לא מצליח להתחבר לטלגרם - ייתכן חסימה של הספק, אנטי-וירוס או חומת אש');
    else if (r.ms > 1500) notes.push(`החיבור איטי (${r.ms}ms). ברשת סלולרית או VPN זה יורגש בזמן התגובה.`);
  }

  if (v6.length) {
    const r = await probe(v6[0], 6);
    line(r.ok ? '✅' : '⚠️', `IPv6 → ${v6[0]}  ${r.ok ? `מחובר תוך ${r.ms}ms` : `לא זמין (${r.reason})`}`);
    if (!r.ok) {
      ipv6Broken = true;
      notes.push('ה-IPv6 שלך מפורסם אבל לא עובד. הבוט מעדיף IPv4 אוטומטית, אז זה מטופל.');
    }
  }
}

tuneNetwork({ preferIPv4: config.preferIPv4 });

// ── 3. הטוקן תקף? ─────────────────────────────────────────
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
  line('❌', `אין חיבור לטלגרם: ${err.cause?.code || err.message}`);
  problems.push('הבקשה לטלגרם נכשלה. ראה את בדיקת IPv4/IPv6 למעלה');
  console.log();
  process.exit(1);
}

// ── 4. webhook תפוס? ──────────────────────────────────────
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

// ── 5. מישהו אחר כבר מושך עדכונים? ────────────────────────
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

// ── 6. יציבות: 5 קריאות רצופות ────────────────────────────
const times = [];
let failed = 0;
for (let i = 0; i < 5; i++) {
  const started = Date.now();
  try {
    const res = await call('getMe');
    if (res.ok) times.push(Date.now() - started);
    else failed += 1;
  } catch {
    failed += 1;
  }
}

if (times.length) {
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const worst = Math.max(...times);
  const icon = failed ? '⚠️' : avg > 1200 ? '⚠️' : '✅';
  line(icon, `יציבות: ${times.length}/5 הצליחו · ממוצע ${avg}ms · הגרוע ${worst}ms`);
  if (failed) problems.push(`${failed} מתוך 5 קריאות נכשלו — החיבור לטלגרם לא יציב, ותהיה השהיה בתגובות`);
  else if (avg > 1200) notes.push('החיבור עובד אבל איטי. תגובות הבוט יורגשו כאיטיות.');
} else {
  line('❌', 'כל 5 הקריאות נכשלו');
  problems.push('החיבור לטלגרם לא עובד כרגע');
}

// ── 7. מוח ה-AI והחיבור לשירותים חיצוניים ─────────────────
if (!config.anthropicKey) {
  line('ℹ️', 'סוכן ה-AI כבוי (אין ANTHROPIC_API_KEY) — הבוט יעבוד עם התפריטים בלבד');
  if (config.mcpUrl) {
    problems.push('הגדרת MCP_SERVER_URL אבל אין ANTHROPIC_API_KEY. בלי מוח AI, החיבור לשירותים לא עושה כלום');
  }
} else {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.anthropicKey });

  const request = {
    model: config.aiModel,
    max_tokens: 1024,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'ענה במילה אחת: אישור' }],
  };

  if (config.mcpUrl) {
    request.betas = ['mcp-client-2025-11-20'];
    request.tools = [{ type: 'mcp_toolset', mcp_server_name: config.mcpName }];
    request.mcp_servers = [{
      type: 'url',
      name: config.mcpName,
      url: config.mcpUrl,
      ...(config.mcpToken ? { authorization_token: config.mcpToken } : {}),
    }];
  }

  try {
    await anthropic.beta.messages.create(request);
    line('✅', `סוכן ה-AI עונה (${config.aiModel})`);
    if (config.mcpUrl) {
      line('✅', `שרת ה-MCP "${config.mcpName}" נענה — היומן והמייל המחוברים זמינים לבוט`);
    } else {
      line('ℹ️', 'אין MCP_SERVER_URL — הבוט לא רואה יומן, מייל או שירותים חיצוניים');
    }
  } catch (err) {
    const detail = err?.message || String(err);
    if (err?.status === 401) {
      line('❌', 'מפתח ה-AI נדחה (401) — בדוק את ANTHROPIC_API_KEY');
      problems.push('ANTHROPIC_API_KEY לא תקף');
    } else if (config.mcpUrl && /mcp/i.test(detail)) {
      line('❌', `שרת ה-MCP נדחה: ${detail.slice(0, 160)}`);
      problems.push('כתובת ה-MCP או הטוקן שגויים. העתק אותם מחדש מדף ההגדרות של Zapier MCP');
    } else {
      line('❌', `קריאת ה-AI נכשלה: ${detail.slice(0, 160)}`);
      problems.push('הקריאה למודל נכשלה — ראה את השגיאה למעלה');
    }
  }
}

// ── סיכום ─────────────────────────────────────────────────
console.log('─'.repeat(46));
if (!problems.length) {
  console.log('\n✅ הכול תקין.\n');
} else {
  console.log('\n🔎 מה מצאתי:\n');
  problems.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
  console.log('\n▶️  להפעלת הבוט:  npm start');
  console.log('   (השאר את החלון פתוח — כשהתהליך נסגר, הבוט מפסיק לענות)\n');
}
if (ipv6Broken) {
  notes.push('אם עדיין איטי: כבה IPv6 בהגדרות המתאם ברשת Windows, או הפעל VPN.');
}
if (notes.length) console.log('💡 ' + notes.join('\n💡 ') + '\n');
