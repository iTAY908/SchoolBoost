// ============================================================================
// Mock Auth Service — a simulated secure local user store (no external DB yet).
//
// Users live in AsyncStorage. Passwords are salted + key-stretched with a mock
// hash. NOTE: this hash is NOT cryptographically secure — it only demonstrates
// that we never store raw passwords. A production app must hash server-side
// (bcrypt/scrypt/argon2) over TLS.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = 'cubefinance:users';
const SESSION_KEY = 'cubefinance:session';

export interface AuthUser {
  id: string;
  email: string;
}
interface StoredUser extends AuthUser {
  salt: string;
  hash: string;
  onboarded: boolean;
  createdAt: number;
}
export interface AuthResult {
  user?: AuthUser;
  error?: string;
}

// ---- mock hashing ----------------------------------------------------------
function mockHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  for (let r = 0; r < 800; r++) h = ((h * 33) ^ (h >>> 7)) >>> 0; // key-stretch
  return h.toString(16);
}
const hashPw = (pw: string, salt: string) => mockHash(`${salt}::${pw}`);
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const norm = (e: string) => (e || '').trim().toLowerCase();

// ---- storage helpers -------------------------------------------------------
async function loadUsers(): Promise<Record<string, StoredUser>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(USERS_KEY)) || '{}');
  } catch {
    return {};
  }
}
async function saveUsers(users: Record<string, StoredUser>) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ---- public API ------------------------------------------------------------

/** Register a new account. Fails if the email already exists. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const e = norm(email);
  if (!validEmail(e)) return { error: 'כתובת אימייל לא תקינה' };
  if ((password || '').length < 4) return { error: 'הסיסמה חייבת להכיל לפחות 4 תווים' };

  const users = await loadUsers();
  if (users[e]) return { error: 'האימייל כבר רשום במערכת' }; // "Email already registered"

  const salt = Math.random().toString(36).slice(2);
  const id = 'acc_' + mockHash(e).slice(0, 8) + Date.now().toString(36);
  users[e] = { id, email: e, salt, hash: hashPw(password, salt), onboarded: false, createdAt: Date.now() };
  await saveUsers(users);
  await setSession(e);
  return { user: { id, email: e } };
}

/** Log in. Blocks access unless the exact password matches. */
export async function logIn(email: string, password: string): Promise<AuthResult> {
  const e = norm(email);
  const users = await loadUsers();
  const u = users[e];
  if (!u) return { error: 'לא נמצא משתמש עם אימייל זה' };
  if (u.hash !== hashPw(password, u.salt)) return { error: 'שגיאה: סיסמה שגויה' };
  await setSession(e);
  return { user: { id: u.id, email: u.email } };
}

/** Whether this account already finished onboarding (drives login routing). */
export async function isOnboarded(email: string): Promise<boolean> {
  const users = await loadUsers();
  return !!users[norm(email)]?.onboarded;
}

export async function markOnboarded(email: string) {
  const users = await loadUsers();
  const u = users[norm(email)];
  if (u) {
    u.onboarded = true;
    await saveUsers(users);
  }
}

export async function setSession(email: string) {
  await AsyncStorage.setItem(SESSION_KEY, norm(email));
}
export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
export async function getSessionUser(): Promise<AuthUser | null> {
  const email = await AsyncStorage.getItem(SESSION_KEY);
  if (!email) return null;
  const users = await loadUsers();
  const u = users[email];
  return u ? { id: u.id, email: u.email } : null;
}
