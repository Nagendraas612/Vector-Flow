// Risks review: rate limiting. Fixed-window in-memory limiter, no new
// dependency and no env var.
// Honest limit: the counters live in per-instance memory, so on
// Vercel serverless each function instance keeps its own windows.
// This stops casual abuse (a runaway script, a double-click storm),
// not a distributed attack. The later upgrade path is Upstash
// (shared Redis) once the site needs real shared limits.

// key -> { count, resetAt }. Expired windows are dropped lazily on
// each check, so a key that is never checked again never counts
// against a new window. A size-triggered sweep below keeps stale
// keys from growing the Map without bound.
const windows = new Map();
const MAX_WINDOWS = 1000;

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "127.0.0.1";
  return "127.0.0.1";
}

// Returns { allowed, retryAfterSeconds }. `key` is the route key
// (e.g. "register"), so each route has its own window per IP.
export function checkRateLimit(request, key, limit, windowSeconds) {
  const now = Date.now();
  const mapKey = `${clientIp(request)}:${key}`;
  const entry = windows.get(mapKey);
  if (entry && entry.resetAt <= now) windows.delete(mapKey);
  const current = windows.get(mapKey);
  if (!current) {
    // Cheap guard against unbounded growth: only sweep when the Map
    // is large, so the common case stays O(1).
    if (windows.size >= MAX_WINDOWS) {
      for (const [k, v] of windows) {
        if (v.resetAt <= now) windows.delete(k);
      }
    }
    windows.set(mapKey, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
