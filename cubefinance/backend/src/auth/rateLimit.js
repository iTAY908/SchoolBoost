// ============================================================================
// Rate limiting for the verification flow.
//
// Two independent buckets, because they stop different attacks:
//   • per EMAIL  — stops someone spamming one inbox, and caps how many codes a
//                  single account can burn through.
//   • per IP     — stops one machine walking through many addresses, which is
//                  what an actual brute-force / enumeration script looks like.
//
// This is an in-memory implementation: it resets on restart and does not span
// multiple server instances. For production behind more than one process, back
// it with Redis (INCR + EXPIRE) — the interface below is deliberately small so
// that swap is a drop-in.
// ============================================================================

const WINDOW_MS = 60 * 60 * 1000;   // one hour

const LIMITS = {
  sendPerEmail: { max: 5, windowMs: WINDOW_MS },   // codes mailed to one address
  sendPerIp: { max: 20, windowMs: WINDOW_MS },     // codes requested by one IP
  verifyPerIp: { max: 50, windowMs: WINDOW_MS },   // verify attempts from one IP
};

const buckets = new Map(); // key -> { count, resetAt }

function hit(kind, id) {
  const cfg = LIMITS[kind];
  if (!cfg) throw new Error(`unknown limit: ${kind}`);
  const key = `${kind}:${id}`;
  const now = Date.now();
  let b = buckets.get(key);

  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + cfg.windowMs };
    buckets.set(key, b);
  }
  b.count += 1;

  const allowed = b.count <= cfg.max;
  return {
    allowed,
    remaining: Math.max(0, cfg.max - b.count),
    retryAfterSec: allowed ? 0 : Math.ceil((b.resetAt - now) / 1000),
  };
}

/** Check without consuming a slot. */
function peek(kind, id) {
  const cfg = LIMITS[kind];
  const b = buckets.get(`${kind}:${id}`);
  const now = Date.now();
  if (!b || now > b.resetAt) return { allowed: true, remaining: cfg.max, retryAfterSec: 0 };
  return {
    allowed: b.count < cfg.max,
    remaining: Math.max(0, cfg.max - b.count),
    retryAfterSec: Math.max(0, Math.ceil((b.resetAt - now) / 1000)),
  };
}

/** Clear a bucket — used after a successful verification. */
function reset(kind, id) {
  buckets.delete(`${kind}:${id}`);
}

/** Drop expired buckets so the map can't grow without bound. */
function sweep() {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}
const sweeper = setInterval(sweep, 10 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

/** Client IP, honouring a proxy header only when the app is behind one. */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd && process.env.TRUST_PROXY === 'true') return String(fwd).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = { LIMITS, hit, peek, reset, sweep, clientIp };
