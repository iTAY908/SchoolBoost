import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// טעינת .env בלי תלויות חיצוניות
function loadDotEnv(file = '.env') {
  const full = path.resolve(process.cwd(), file);
  if (!existsSync(full)) return;
  const raw = readFileSync(full, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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
