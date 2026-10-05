// CubeFinance — cf-auth: the email code that signs a user in to the server.
//
// The app calls this function (POST, JSON) with one of three actions:
//
//   { action: "ping" }
//       → { ok, emailReady }   is the function deployed and the email key set?
//   { action: "send", email }
//       → { ok }               a 6-digit code goes to that inbox through EmailJS
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
      if (!sent.ok) {
        const detail = (await sent.text()).slice(0, 200);
        await rpc("cf3_code_cancel", { p_email: email }).catch(() => null);
        console.error("EmailJS refused:", sent.status, detail);
        return reply({ ok: false, error: "send_failed", status: sent.status, detail });
      }
      return reply({ ok: true });
    }

    if (action === "verify") {
      const code = String(body.code ?? "").replace(/\D/g, "");
      const device = String(body.device_id ?? "");
      if (code.length !== 6) return reply({ ok: false, error: "bad_code", attempts_left: null });
      if (device.length < 8 || device.length > 128) return reply({ ok: false, error: "bad_device" });

      const check = await rpc("cf3_code_check", { p_email: email, p_code: code });
      if (!check || check.ok !== true) return reply(check || { ok: false, error: "server" });

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
