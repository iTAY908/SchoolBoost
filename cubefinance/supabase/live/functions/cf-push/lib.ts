// Pure logic for the cf-push Edge Function (runs on Deno in Supabase; the
// tests run the same file on Node). No Supabase or Deno APIs in here.

export type OutboxItem = {
  id: string;
  kind: string;
  goal_id: string;
  goal_name: string;
  actor_name: string;
  amount_minor: number | null;
  attempt: number;
  account_key: string;
  tokens: string[];
};

export type SendResult = { ok: boolean; status: number; body: string };

export const TITLE = "חיסכון משותף 🤝";
/** What a locked screen with "hide sensitive content" shows instead (the app swaps it in). */
export const GENERIC_BODY = "יש עדכון חדש בחיסכון המשותף";

/** ₪200 · ₪1,250 · ₪200.50 — from agorot, never floating point arithmetic on money. */
export function formatShekels(minor: number): string {
  const neg = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + "₪" + w + (cents ? "." + String(cents).padStart(2, "0") : "");
}

const q = (s: string) => "״" + s + "״";

/**
 * The text of each event. Contributions are RECORDS (this app moves no real
 * money), so the wording says "recorded", never "transferred".
 */
export function composeBody(n: Pick<OutboxItem, "kind" | "actor_name" | "goal_name" | "amount_minor">): string {
  const who = n.actor_name || "משתתף/ת";
  const goal = q(n.goal_name || "");
  const amt = n.amount_minor != null ? formatShekels(n.amount_minor) : "";
  switch (n.kind) {
    case "member_joined": return who + " הצטרף/ה לחיסכון המשותף " + goal + ".";
    case "invited": return who + " הזמין/ה אותך לחיסכון המשותף " + goal + ".";
    case "contribution": return who + " רשם/ה הפקדה של " + amt + " לחיסכון המשותף " + goal + ".";
    case "recurring": return who + " רשם/ה הפקדה חודשית של " + amt + " לחיסכון המשותף " + goal + ".";
    case "reversal": return who + " ביטל/ה רישום של " + amt + " בחיסכון המשותף " + goal + ".";
    case "member_left": return who + " יצא/ה מהחיסכון המשותף " + goal + ".";
    case "deletion_requested": return who + " ביקש/ה למחוק את החיסכון המשותף " + goal + ". נדרש אישור שלך.";
    case "deletion_rejected": return who + " דחה/תה את בקשת המחיקה של " + goal + ". החיסכון נשאר.";
    case "deletion_cancelled": return who + " ביטל/ה את בקשת המחיקה של " + goal + ".";
    case "deletion_invalidated": return "בקשת המחיקה של " + goal + " בוטלה כי היו שינויים בחיסכון. אפשר לבקש שוב.";
    case "goal_deleted": return "כל המשתתפים אישרו — החיסכון המשותף " + goal + " נמחק.";
    default: return GENERIC_BODY;
  }
}

/**
 * FCM HTTP v1 message. Data-only and high priority, so the app's own service
 * builds the notification — it checks the account, drops duplicates (eventId)
 * and hides the text on the lock screen when the user asked for that.
 */
export function buildFcmMessage(token: string, n: OutboxItem) {
  return {
    message: {
      token,
      data: {
        type: "shared",
        acct: n.account_key,
        goalId: n.goal_id,
        eventId: n.id,
        kind: n.kind,
        title: TITLE,
        body: composeBody(n),
      },
      android: { priority: "HIGH", ttl: "86400s", collapse_key: n.id },
    },
  };
}

/** A token FCM says will never work again → remove it from cf_devices. */
export function isDeadToken(r: SendResult): boolean {
  if (r.status === 404) return true;   // UNREGISTERED
  if (r.status === 400 && /registration[- ]token|UNREGISTERED|INVALID_ARGUMENT.*token/i.test(r.body)) return true;
  return false;
}

/** Worth trying again later (the outbox retries with backoff). */
export function isTransient(r: SendResult): boolean {
  return r.status === 429 || r.status >= 500 || r.status === 0;
}

export type Deps = {
  claim: (limit: number) => Promise<OutboxItem[]>;
  result: (id: string, ok: boolean, error: string | null, deadTokens: string[]) => Promise<void>;
  send: (token: string, message: unknown) => Promise<SendResult>;
  maxRounds?: number;
};

/**
 * Drain the outbox. An item counts as delivered when at least one device
 * accepted it, or when the account has no device at all (the in-app inbox
 * already holds it). It is left for a retry only when every failure was
 * transient. Delivery itself is never guaranteed — that is what the inbox is for.
 */
export async function dispatch(deps: Deps) {
  let sent = 0, retried = 0, pruned = 0;
  for (let round = 0; round < (deps.maxRounds ?? 10); round++) {
    const items = await deps.claim(50);
    if (!items.length) break;
    for (const n of items) {
      const dead: string[] = [];
      let delivered = n.tokens.length === 0, transient = false, lastErr = "";
      for (const t of n.tokens) {
        let r: SendResult;
        try { r = await deps.send(t, buildFcmMessage(t, n)); }
        catch (e) { r = { ok: false, status: 0, body: String((e as Error)?.message || e) }; }
        if (r.ok) { delivered = true; continue; }
        lastErr = r.status + " " + r.body.slice(0, 200);
        if (isDeadToken(r)) dead.push(t);
        else if (isTransient(r)) transient = true;
      }
      const ok = delivered || !transient;
      await deps.result(n.id, ok, ok ? null : lastErr, dead);
      if (ok) sent++; else retried++;
      pruned += dead.length;
    }
  }
  return { sent, retried, pruned };
}

// ---- Google OAuth for FCM (service account → access token) ------------------

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

export type ServiceAccount = { client_email: string; private_key: string; project_id: string; token_uri?: string };

/** RS256-signed JWT assertion for the token endpoint (Web Crypto: works on Deno and Node). */
export async function signAssertion(sa: ServiceAccount, nowSec: number): Promise<string> {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = enc({ alg: "RS256", typ: "JWT" });
  const body = enc({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body));
  return head + "." + body + "." + b64url(sig);
}

export async function getAccessToken(sa: ServiceAccount, fetchFn: typeof fetch, nowSec: number): Promise<string> {
  const assertion = await signAssertion(sa, nowSec);
  const res = await fetchFn(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + assertion,
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error("google oauth " + res.status);
  return j.access_token as string;
}

/** Constant-time comparison for the shared secret header. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
