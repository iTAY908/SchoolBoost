// cf-push — sends the shared-savings notifications queued in cf_push_outbox
// over Firebase Cloud Messaging. Invoked by the database (pg_net, right after
// something is queued, and every minute from pg_cron as the retry net) with a
// shared secret; never by the app.
//
// Secrets (supabase secrets set …):
//   CF_PUSH_SECRET         random string; also stored in Vault as cf_push_secret
//   FCM_SERVICE_ACCOUNT    the Firebase service-account JSON (project cubefinance-e32f3)
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { dispatch, getAccessToken, safeEqual, type OutboxItem, type ServiceAccount } from "./lib.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(fn + " " + res.status + " " + (await res.text()).slice(0, 200));
  return res.json();
}

let cached: { token: string; until: number } | null = null;

Deno.serve(async (req) => {
  const secret = Deno.env.get("CF_PUSH_SECRET") || "";
  if (!safeEqual(req.headers.get("x-cf-push-secret") || "", secret)) return new Response("forbidden", { status: 403 });

  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return new Response("FCM_SERVICE_ACCOUNT is not set — nothing sent, the outbox keeps everything", { status: 503 });
  const sa = JSON.parse(raw) as ServiceAccount;

  const now = Math.floor(Date.now() / 1000);
  if (!cached || cached.until < now + 60) {
    cached = { token: await getAccessToken(sa, fetch, now), until: now + 3500 };
  }
  const access = cached.token;

  const out = await dispatch({
    claim: async (limit) => (await rpc("cf2_push_claim", { p_limit: limit })) as OutboxItem[],
    result: async (id, ok, error, dead) => { await rpc("cf2_push_result", { p_id: id, p_ok: ok, p_error: error, p_dead_tokens: dead }); },
    send: async (_token, message) => {
      const res = await fetch("https://fcm.googleapis.com/v1/projects/" + sa.project_id + "/messages:send", {
        method: "POST",
        headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      return { ok: res.ok, status: res.status, body: res.ok ? "" : await res.text() };
    },
  });
  return Response.json(out);
});
