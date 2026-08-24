import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * מפרש תוכן של קובץ .env.
 * סובלני למה שקורה בפועל: BOM שנוצר ב-PowerShell, סופי שורה של Windows,
 * רווחים סביב ה-=, מרכאות עוטפות ותווי RTL נסתרים שנדבקים בהעתקה.
 */
export function parseEnv(raw) {
  const out = {};
  const text = String(raw).replace(/^\uFEFF/, ''); // BOM מתחילת הקובץ

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim().replace(/[\u200e\u200f\u202a-\u202e]/g, '');
    if (!key) continue;

    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // סימני כיווניות נדבקים כשמעתיקים טוקן מצ'אט בעברית
    value = value.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();

    out[key] = value;
  }
  return out;
}

// טעינת .env בלי תלויות חיצוניות
function loadDotEnv(file = '.env') {
  const full = path.resolve(process.cwd(), file);
  if (!existsSync(full)) return;
  const parsed = parseEnv(readFileSync(full, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

export const config = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  tz: process.env.TZ_NAME || 'Asia/Jerusalem',
  dataFile: process.env.DATA_FILE || './data/schoolboost.json',
  // ניתן להפניה לשרת מדומה בבדיקות, או ל-Bot API server עצמאי
  apiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
  logLevel: process.env.LOG_LEVEL || 'info',
  // IPv6 שבור הוא הסיבה הנפוצה ל-UND_ERR_CONNECT_TIMEOUT. אפשר לכבות ב-PREFER_IPV4=0
  preferIPv4: process.env.PREFER_IPV4 !== '0',

  // ── מוח ה-AI ────────────────────────────────────────────
  // בלי מפתח, הבוט עובד כרגיל עם התפריטים והקיצורים בלבד.
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'claude-opus-5',
  // medium נותן תשובות מהירות בצ'אט. high לתשובות עמוקות יותר, low לזול ומהיר.
  aiEffort: process.env.AI_EFFORT || 'medium',
  aiFiles: process.env.AI_FILES !== '0',

  // ── חיבור לשירותים חיצוניים דרך שרת MCP ─────────────────
  // כתובת אחת שמביאה איתה את כל החשבונות המחוברים (מייל, יומן, זום...).
  mcpUrl: process.env.MCP_SERVER_URL || '',
  mcpName: process.env.MCP_SERVER_NAME || 'connectors',
  mcpToken: process.env.MCP_SERVER_TOKEN || '',
};

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level, args) {
  if (LEVELS[level] < (LEVELS[config.logLevel] ?? 20)) return;
  const stamp = new Date().toISOString();
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${stamp}] ${level.toUpperCase().padEnd(5)}`, ...args);
}

export const log = {
  debug: (...a) => emit('debug', a),
  info: (...a) => emit('info', a),
  warn: (...a) => emit('warn', a),
  error: (...a) => emit('error', a),
};
