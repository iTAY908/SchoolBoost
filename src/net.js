import dns from 'node:dns';
import net from 'node:net';
import { log } from './config.js';

/**
 * כוונון רשת לפני כל קריאה יוצאת.
 *
 * ל-api.telegram.org יש גם כתובת IPv6, ו-Node מנסה אותה קודם. ברשתות ביתיות
 * רבות (וברוב הספקים בישראל) ה-IPv6 מפורסם אבל לא באמת עובד, אז החיבור
 * "נתקע" עד שנגמר הזמן ומתקבל UND_ERR_CONNECT_TIMEOUT. העדפת IPv4 והפעלת
 * Happy Eyeballs עם חלון קצר פותרות את זה.
 */
export function tuneNetwork({ preferIPv4 = true, attemptTimeoutMs = 400 } = {}) {
  try {
    if (preferIPv4) dns.setDefaultResultOrder('ipv4first');
    if (typeof net.setDefaultAutoSelectFamily === 'function') {
      net.setDefaultAutoSelectFamily(true);
      net.setDefaultAutoSelectFamilyAttemptTimeout(attemptTimeoutMs);
    }
    log.debug(`כוונון רשת: ipv4first=${preferIPv4}, חלון ניסיון=${attemptTimeoutMs}ms`);
  } catch (err) {
    log.warn('כוונון הרשת נכשל, ממשיכים עם ברירות המחדל:', err.message);
  }
}

const TRANSIENT_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT', // לא נפתח חיבור TCP בזמן
  'UND_ERR_SOCKET',          // החיבור נקטע לפני תשובה
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',               // כשל DNS זמני
  'EAI_AGAIN',
]);

/**
 * האם שווה לנסות שוב? רק תקלות שמתרחשות *לפני* שהבקשה נשלחה בפועל,
 * כדי שניסיון חוזר לא ישלח הודעה כפולה למשתמש.
 */
export function isTransient(err) {
  if (!err) return false;
  // 5xx מטלגרם עצמו (502/503 קורים מדי פעם) - שווה ניסיון נוסף
  if (err.name === 'TelegramError') return Number(err.code) >= 500;
  const codes = [err.code, err.cause?.code, err.cause?.cause?.code];
  return codes.some((c) => c && TRANSIENT_CODES.has(c));
}
