// Tiny in-memory rate limiter for Cloud Functions instances.
// In a single Cloud Functions instance the same uid hitting the function
// will share state. Across cold starts state resets — that's fine for
// abuse prevention; it's not a hard SLA.
//
// For production we'd back this with Firestore or Memcache; for our
// current scale this is plenty.

const buckets = new Map(); // uid -> { count, resetAt }

export function rateLimit(uid, { max = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const cur = buckets.get(uid);
  if (!cur || cur.resetAt < now) {
    buckets.set(uid, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  if (cur.count >= max) {
    return { ok: false, retryAfterMs: cur.resetAt - now, remaining: 0 };
  }
  cur.count += 1;
  return { ok: true, remaining: max - cur.count };
}
