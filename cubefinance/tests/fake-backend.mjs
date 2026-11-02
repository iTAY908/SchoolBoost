// Test double for the production backend, used by the verification tests.
// - Runs the REAL Edge Function code (supabase/live/functions/cf-auth/index.ts).
// - Its database calls run the REAL SQL (account_sync.sql) in a local Postgres
//   through psql, as the service_role, exactly like PostgREST would.
// - Only EmailJS is simulated: `scenario` decides what it answers, and the codes
//   it "mails" are kept in memory so a test can read them (never logged).
import { execFileSync } from "node:child_process";
import http from "node:http";
import { handle } from "../supabase/live/functions/cf-auth/index.ts";

const PG = ["-h", process.env.PGHOST || "/tmp/cfpg", "-p", process.env.PGPORT || "54329", "-U", "postgres", "-d", process.env.PGDB || "cf4db", "-At", "-q", "-v", "ON_ERROR_STOP=1"];
export const sql = (q) => execFileSync("psql", [...PG, "-c", q], { encoding: "utf8" }).trim();
const argTypes = {};
function types(fn) {
  if (argTypes[fn]) return argTypes[fn];
  const row = sql(`select array_to_string(proargnames, ','), oidvectortypes(proargtypes) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = '${fn}'`);
  const [names, tys] = row.split("|");
  const t = tys.split(",").map((x) => x.trim());
  return (argTypes[fn] = names.split(",").map((n, i) => [n, t[i]]));
}
const lit = (v) => v === null || v === undefined ? "NULL" : "$q$" + String(v) + "$q$";
function rpc(fn, args) {
  const call = types(fn).filter(([n]) => n in args).map(([n, t]) => `${n} => ${lit(args[n])}::${t}`).join(", ");
  const out = sql(`set role service_role; select public.${fn}(${call})::text;`);
  return out.split("\n").pop();
}

export const state = { scenario: "ok", mailed: [], emailCalls: 0 };
export function lastCode(email) { const m = state.mailed.filter((x) => x.to === email).pop(); return m && m.code; }

async function fakeFetch(url, init) {
  const u = String(url);
  if (u.startsWith("https://api.emailjs.com/")) {
    state.emailCalls++;
    const b = JSON.parse(init.body);
    const s = state.scenario;
    if (s === "network") throw new TypeError("fetch failed");
    if (s === "ok") { state.mailed.push({ to: b.template_params.to_email, code: b.template_params.code }); return new Response("OK", { status: 200 }); }
    if (s === "non_browser") return new Response("API calls are disabled for non-browser applications", { status: 403 });
    if (s === "gmail") return new Response("Gmail_API: Invalid grant. Please reconnect your Gmail account", { status: 412 });
    if (s === "quota") return new Response("Too many requests", { status: 429 });
    if (s === "outage") return new Response("Internal error", { status: 500 });
    if (s === "ok_but_weird") return new Response("Accepted?", { status: 200 });
  }
  const m = u.match(/\/rest\/v1\/rpc\/(\w+)$/);
  if (m) {
    try { return new Response(rpc(m[1], JSON.parse(init.body)), { status: 200, headers: { "Content-Type": "application/json" } }); }
    catch (e) { return new Response(JSON.stringify({ message: String(e.message).slice(0, 300) }), { status: 400 }); }
  }
  return new Response("{}", { status: 404 });
}

const env = new Map(Object.entries({ SUPABASE_URL: "http://fake.supabase", SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}', EMAILJS_PRIVATE_KEY: "test-private-key" }));
export const callAuth = async (body) => (await handle(new Request("http://f/functions/v1/cf-auth", { method: "POST", body: JSON.stringify(body) }), env, fakeFetch)).json();

// An HTTP server the app can talk to (CORS like the real function).
export function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
      if (req.method === "OPTIONS") { res.writeHead(200, cors); res.end("ok"); return; }
      let body = ""; for await (const c of req) body += c;
      if (req.url === "/__test/scenario") { state.scenario = JSON.parse(body).scenario; res.writeHead(200, cors); res.end("{}"); return; }
      if (req.url === "/__test/code") { res.writeHead(200, cors); res.end(JSON.stringify({ code: lastCode(JSON.parse(body).email) || null })); return; }
      if (req.url === "/__test/sql") { res.writeHead(200, cors); res.end(JSON.stringify({ out: sql(JSON.parse(body).q) })); return; }
      if (req.url === "/__test/stats") { res.writeHead(200, cors); res.end(JSON.stringify({ emailCalls: state.emailCalls })); return; }
      if (req.url === "/__test/hang") { return; }   // never answers (network timeout simulation)
      if (req.url === "/functions/v1/cf-auth") {
        if (state.scenario === "down") { res.writeHead(503, cors); res.end("upstream down"); return; }
        try {
          const fwd = new Headers(); for (const k of ["x-forwarded-for", "content-type"]) if (req.headers[k]) fwd.set(k, req.headers[k]);
          const r = await handle(new Request("http://f" + req.url, { method: "POST", body, headers: fwd }), env, fakeFetch);
          res.writeHead(r.status, { ...cors, "Content-Type": "application/json" }); res.end(await r.text());
        } catch (e) { console.error("fake backend:", e.message); res.writeHead(500, cors); res.end("{}"); }
        return;
      }
      res.writeHead(404, cors); res.end("{}");
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}
