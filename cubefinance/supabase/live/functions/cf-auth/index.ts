// CubeFinance — cf-auth: the email code that signs a user in to the server.
//
// The app calls this function (POST, JSON) with one of three actions:
//
//   { action: "ping" }
//       → { ok, emailReady }   is the function deployed and the email key set?
//   { action: "send", email }
//       → { ok, accepted, expires_in, resend_in }   EmailJS accepted the email
//       → { ok:false, error:"send_failed", reason, retryable }   it did not; no code exists
//       → { ok:false, error:"too_soon"|"rate_limited", retry_after }
//   { action: "verify", email, code, session: false }
//       → { ok, verified }     code right and used up (apps that keep accounts on the device)
//   { action: "verify", email, code, device_id, device_name, platform, replace_device? }
//       → { ok, session, existing }      signed in on this device
//       → { ok:false, error:"device_limit", devices, max }   2 devices already
//
// Only this function — holding the service-role key and the EmailJS private
// key, neither of which ever reaches the app — can turn a right code into a
// Supabase session. So typing someone else's email gets nobody in: the code
// goes to the owner's inbox. Codes are stored only as salted SHA-256 hashes
// (account_sync.sql: cf3_code_issue / cf3_code_check), last 10 minutes, allow
// 5 tries, and at most one is sent per 30 seconds and 6 per hour per address.
//
// Deploy: Supabase → Edge Functions → Deploy a new function → Via Editor,
// name it cf-auth, paste this file, Deploy. Then turn OFF "Verify JWT" for it
// (the app sends the publishable key, which is not a JWT). Secret to add under
// Edge Functions → Secrets: EMAILJS_PRIVATE_KEY (EmailJS → Account → API keys).
// No imports: plain fetch to the project's own Auth and REST APIs.

const EMAILJS = {
  serviceId: "service_upg7kqp",
  templateId: "template_7q8srkg",
  publicKey: "g7STyZwRjLgIMZXrA",
};
// Public by design (it is in the app too); used only when the platform does
// not provide the project's anon/publishable key to the function.
const PUBLISHABLE_FALLBACK = "sb_publishable_kbdGeoyPH5Wof7yf4rnc6g_QzPSF1_q";

type Env = { get(name: string): string | undefined };
type Json = Record<string, unknown>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 254;

function firstKey(env: Env, single: string, jsonList: string): string | undefined {
  const v = env.get(single);
  if (v) return v;
  const raw = env.get(jsonList);
  if (!raw) return undefined;
  try {
    const o = JSON.parse(raw);
    if (typeof o === "string") return o;
    if (o && typeof o === "object") return (o.default as string) || (Object.values(o)[0] as string);
  } catch (_) { /* not JSON */ }
  return raw;
}

// New-style keys (sb_secret_…, sb_publishable_…) go in `apikey` only; the
// gateway turns them into a role. Legacy JWT keys also go in Authorization.
function keyHeaders(key: string): Record<string, string> {
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return h;
}

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomDigits(n: number): string {
  const out: string[] = [];
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(String(buf[i] % 10));
  return out.join("");
}

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// What went wrong at the email provider, from its status code and message.
//   provider_auth         401/403 — wrong private key, or "API calls are disabled for
//                         non-browser applications" (EmailJS → Account → Security)
//   provider_account      412 — the connected Gmail/Outlook service needs reconnecting
//   provider_config       400/404/422 — wrong service/template id or template fields
//   provider_rate_limited 429 — monthly quota used up or too many requests
//   provider_unavailable  5xx or no answer — try again later
export function providerReason(status: number, text: string): string {
  const t = (text || "").toLowerCase();
  if (status === 401 || status === 403 || t.includes("non-browser") || t.includes("public key") || t.includes("private key")) return "provider_auth";
  if (status === 412 || t.includes("gmail") || t.includes("invalid grant") || t.includes("reconnect")) return "provider_account";
  if (status === 429 || t.includes("limit")) return "provider_rate_limited";
  if (status === 400 || status === 404 || status === 422) return "provider_config";
  return "provider_unavailable";
}

export async function handle(req: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);

  const url = (env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const service = firstKey(env, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
  const anon = firstKey(env, "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS") || PUBLISHABLE_FALLBACK;
  const emailKey = env.get("EMAILJS_PRIVATE_KEY") || "";
  if (!url || !service) return reply({ ok: false, error: "server_not_configured" }, 500);

  let body: Json;
  try { body = await req.json(); } catch (_) { return reply({ ok: false, error: "bad_json" }, 400); }
  const action = String(body.action || "");

  async function rpc(fn: string, args: Json): Promise<any> {
    const r = await fetchImpl(url + "/rest/v1/rpc/" + fn, {
      method: "POST", headers: keyHeaders(service!), body: JSON.stringify(args),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(fn + " HTTP " + r.status + " " + text.slice(0, 200));
    return text ? JSON.parse(text) : null;
  }

  async function authCall(path: string, payload: Json, key: string) {
    const r = await fetchImpl(url + "/auth/v1" + path, {
      method: "POST", headers: keyHeaders(key), body: JSON.stringify(payload),
    });
    let data: any = null;
    try { data = await r.json(); } catch (_) { /* empty */ }
    return { status: r.status, ok: r.ok, data };
  }

  try {
    if (action === "ping") return reply({ ok: true, v: 1, emailReady: !!emailKey });

    const email = normEmail(body.email);
    if (!validEmail(email)) return reply({ ok: false, error: "bad_email" });

    if (action === "send") {
      if (!emailKey) return reply({ ok: false, error: "email_not_configured" });
      const code = randomDigits(6);
      const salt = randomHex(16);
      const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "").split(",")[0].trim() || null;
      const issued = await rpc("cf3_code_issue", { p_email: email, p_ip: ip, p_code_hash: await sha256hex(salt + code), p_salt: salt });
      if (!issued || issued.ok !== true) return reply(issued || { ok: false, error: "server" });

      // Hand the email to EmailJS. Only HTTP 200 with the body "OK" counts as
      // accepted; anything else (or no answer) withdraws the code, so the app
      // never shows a countdown for a code nobody was sent. "Accepted" means
      // EmailJS took the message — it does not prove it reached the inbox.
      let sentStatus = 0, sentText = "";
      try {
        const sent = await fetchImpl("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: env.get("EMAILJS_SERVICE_ID") || EMAILJS.serviceId,
            template_id: env.get("EMAILJS_TEMPLATE_ID") || EMAILJS.templateId,
            user_id: env.get("EMAILJS_PUBLIC_KEY") || EMAILJS.publicKey,
            accessToken: emailKey,
            template_params: { to_email: email, code },
          }),
        });
        sentStatus = sent.status;
        sentText = (await sent.text()).slice(0, 300);
      } catch (e) {
        sentStatus = 0;
        sentText = String((e as Error)?.message || e).slice(0, 200);
      }
      if (sentStatus === 200 && sentText.trim().toUpperCase() === "OK") {
        return reply({ ok: true, accepted: true, expires_in: issued.expires_in ?? 600, resend_in: issued.resend_in ?? 30 });
      }
      await rpc("cf3_code_cancel", { p_email: email }).catch(() => null);
      const reason = providerReason(sentStatus, sentText);
      // The provider's own words go to the function log (no code, no key in them).
      console.error("EmailJS did not accept the email:", sentStatus, reason, sentText);
      return reply({ ok: false, error: "send_failed", reason, provider_status: sentStatus,
        retryable: reason === "provider_unavailable" || reason === "provider_rate_limited" });
    }

    if (action === "verify") {
      const code = String(body.code ?? "").replace(/\D/g, "");
      const device = String(body.device_id ?? "");
      if (code.length !== 6) return reply({ ok: false, error: "bad_code", attempts_left: null });
      if (body.session !== false && (device.length < 8 || device.length > 128)) return reply({ ok: false, error: "bad_device" });

      const check = await rpc("cf3_code_check", { p_email: email, p_code: code });
      if (!check || check.ok !== true) return reply(check || { ok: false, error: "server" });

      // Verification only (the app keeps its accounts on the device): the code
      // is right, so use it up and say so. No server account, no device slot.
      if (body.session === false) {
        await rpc("cf3_code_consume", { p_email: email });
        return reply({ ok: true, verified: true });
      }

      // The address is proven. Make sure it has a Supabase user, then get a
      // one-time sign-in token for it (no email is sent by Supabase).
      const created = await authCall("/admin/users", { email, email_confirm: true }, service);
      if (!created.ok && created.status !== 422 && created.status !== 400) {
        throw new Error("create user HTTP " + created.status + " " + JSON.stringify(created.data).slice(0, 200));
      }
      const link = await authCall("/admin/generate_link", { type: "magiclink", email }, service);
      const props = (link.data && (link.data.properties || link.data)) || {};
      const hashed = props.hashed_token as string | undefined;
      const uid = (link.data && ((link.data.user && link.data.user.id) || link.data.id)) as string | undefined;
      if (!link.ok || !hashed || !uid) {
        throw new Error("generate_link HTTP " + link.status + " " + JSON.stringify(link.data).slice(0, 200));
      }

      const slot = await rpc("cf3_claim_device", {
        p_uid: uid, p_email: email, p_device: device,
        p_name: String(body.device_name ?? "").slice(0, 80) || null,
        p_platform: String(body.platform ?? "").slice(0, 20) || null,
        p_replace: body.replace_device ? String(body.replace_device) : null,
      });
      if (!slot || slot.ok !== true) return reply(slot || { ok: false, error: "server" });

      let session = await authCall("/verify", { type: "magiclink", token_hash: hashed }, anon);
      if (!session.ok || !session.data || !session.data.access_token) {
        session = await authCall("/verify", { type: "email", token_hash: hashed }, anon);
      }
      const s = session.data || {};
      if (!session.ok || !s.access_token) {
        throw new Error("verify HTTP " + session.status + " " + JSON.stringify(s).slice(0, 200));
      }
      if (s.user && normEmail(s.user.email) !== email) throw new Error("session for another email");
      await rpc("cf3_code_consume", { p_email: email });
      return reply({
        ok: true,
        existing: !!slot.existing,
        session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in },
      });
    }

    return reply({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    console.error("cf-auth", action, String((e as Error)?.message || e));
    return reply({ ok: false, error: "server" }, 500);
  }
}

const DenoNs = (globalThis as any).Deno;
if (DenoNs && DenoNs.serve) {
  DenoNs.serve((req: Request) => handle(req, DenoNs.env));
}
