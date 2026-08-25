// אשף התקנה: שואל את מה שחסר, כותב .env נכון, ומריץ אבחון.
// הרצה:  npm run setup

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseEnv } from '../src/config.js';

const ENV_PATH = path.resolve(process.cwd(), '.env');

const FIELDS = [
  {
    key: 'TELEGRAM_BOT_TOKEN',
    title: '🤖 טוקן הבוט בטלגרם',
    where: '@BotFather → /mybots → בחר את הבוט → API Token',
    required: true,
    validate: (v) => (/^\d+:[A-Za-z0-9_-]{30,}$/.test(v)
      ? null
      : 'לא נראה כמו טוקן טלגרם. הוא בצורה 1234567890:AAExxxxx'),
  },
  {
    key: 'ANTHROPIC_API_KEY',
    title: '🧠 מפתח ה-AI (בלעדיו אין שיחה חופשית ואין חיבור ליומן)',
    where: 'https://console.anthropic.com → API Keys → Create Key',
    validate: (v) => (v.startsWith('sk-ant-')
      ? null
      : 'מפתח של Anthropic מתחיל ב-sk-ant-'),
  },
  {
    key: 'MCP_SERVER_URL',
    title: '📅 כתובת שרת ה-MCP (היומן, המייל והשירותים המחוברים)',
    where: 'דף ההגדרות של Zapier MCP → השדה MCP Server URL',
    validate: (v) => (v.startsWith('https://')
      ? null
      : 'הכתובת צריכה להתחיל ב-https://'),
  },
  {
    key: 'MCP_SERVER_TOKEN',
    title: '🔑 טוקן לשרת ה-MCP',
    where: 'אותו דף. אם הטוקן כבר מוטמע בתוך הכתובת — פשוט Enter',
  },
];

function loadExisting() {
  if (!existsSync(ENV_PATH)) return {};
  try {
    return parseEnv(readFileSync(ENV_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function mask(value) {
  if (!value) return '';
  if (value.length <= 12) return `${value.slice(0, 3)}···`;
  return `${value.slice(0, 8)}···${value.slice(-4)}`;
}

/** כותב UTF-8 בלי BOM, ושומר על מפתחות שהמשתמש הוסיף בעצמו. */
function writeEnv(values) {
  const lines = ['# נוצר על ידי npm run setup', ''];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') lines.push(`${key}=${value}`);
  }
  writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, { encoding: 'utf8' });
}

const rl = createInterface({ input: stdin, output: stdout });
const lines = rl[Symbol.asyncIterator]();

/** שאלה אחת. מחזיר null כשהקלט נגמר, כדי לא להיתקע על EOF. */
async function ask(prompt) {
  stdout.write(prompt);
  const { value, done } = await lines.next();
  if (done) {
    stdout.write('\n');
    return null;
  }
  return String(value).trim();
}

console.log('\n🎒 הגדרת SchoolBoost');
console.log('─'.repeat(52));
console.log('לכל שאלה: הדבק ערך, או Enter כדי לדלג / להשאיר כמו שהוא.');
console.log('הדבקה ב-PowerShell = לחיצה ימנית בעכבר.\n');

const existing = loadExisting();
const values = { ...existing };

for (const field of FIELDS) {
  const current = existing[field.key];
  console.log(`${field.title}`);
  console.log(`   מאיפה: ${field.where}`);
  if (current) console.log(`   כרגע מוגדר: ${mask(current)}`);

  for (;;) {
    const answer = await ask('   > ');

    if (!answer) {
      if (current) {
        console.log('   ↩︎ נשאר כמו שהיה\n');
      } else if (field.required) {
        console.log('   ⚠️  זה שדה חובה, בלעדיו הבוט לא יעלה.\n');
      } else {
        console.log('   ⏭︎ מדלג\n');
      }
      break;
    }

    const problem = field.validate ? field.validate(answer) : null;
    if (problem) {
      console.log(`   ❌ ${problem}`);
      continue;
    }

    values[field.key] = answer;
    console.log(`   ✅ נשמר: ${mask(answer)}\n`);
    break;
  }
}

rl.close();

writeEnv(values);
console.log('─'.repeat(52));
console.log(`✅ הקובץ .env נכתב (${Object.keys(values).length} הגדרות)\n`);

const summary = [
  ['טלגרם', values.TELEGRAM_BOT_TOKEN],
  ['מוח AI', values.ANTHROPIC_API_KEY],
  ['יומן ומייל (MCP)', values.MCP_SERVER_URL],
];
for (const [label, value] of summary) {
  console.log(`${value ? '✅' : '⬜'} ${label}${value ? '' : ' — לא מוגדר'}`);
}

if (!values.ANTHROPIC_API_KEY && values.MCP_SERVER_URL) {
  console.log('\n⚠️  יש כתובת MCP אבל אין מפתח AI. בלי מוח, החיבור ליומן לא יעשה כלום.');
}

console.log('\n▶️  מריץ אבחון…\n');
const doctor = spawnSync(process.execPath, ['scripts/doctor.mjs'], { stdio: 'inherit' });

if (doctor.status === 0) {
  console.log('כדי להפעיל את הבוט:  npm start');
}
process.exit(doctor.status ?? 0);
