// Light abuse control for extension-link: a sliding-window counter per key,
// held in the isolate's memory.
//
// Isolates are recycled and several may run at once, so this bounds bursts from
// one caller rather than guaranteeing a global rate. The Auth server's own
// limits and the single-use, expiring token hash are the other layers.

export interface RateLimitDecision {
  ok: boolean;
  /** Whole seconds until the oldest hit leaves the window (0 when ok). */
  retryAfterSec: number;
}

export interface RateLimiter {
  take(key: string, nowMs: number): RateLimitDecision;
}

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 10_000;
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('limit must be a positive integer');
  if (!(windowMs > 0)) throw new RangeError('windowMs must be positive');

  // Insertion order doubles as least-recently-used order: a key is re-inserted on every hit.
  const hits = new Map<string, number[]>();

  return {
    take(key, nowMs) {
      const cutoff = nowMs - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      hits.delete(key);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] as number;
        return {
          ok: false,
          retryAfterSec: Math.max(
            1,
            Math.ceil((oldest + windowMs - nowMs) / 1000),
          ),
        };
      }

      recent.push(nowMs);
      hits.set(key, recent);
      while (hits.size > maxKeys) {
        const lru = hits.keys().next().value;
        if (lru === undefined) break;
        hits.delete(lru);
      }
      return { ok: true, retryAfterSec: 0 };
    },
  };
}
