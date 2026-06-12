/**
 * Shared in-process fixed-window rate limiter — launch hardening (June 2026).
 *
 * Why not express-rate-limit everywhere? The AI endpoints already use it
 * (lib/ai-rate-limit.ts), but the PUBLIC, unauthenticated ingest endpoints
 * (/lp/track, /lp/heatmap, /lp/leads) need two properties it doesn't give us
 * out of the box:
 *
 *   1. A hard bound on tracked keys. A spoofed-X-Forwarded-For flood can
 *      manufacture unlimited distinct keys; we cap the table (default 50k)
 *      and evict the stalest entries so the limiter itself can't OOM the
 *      process.
 *   2. Structured, sampled abuse logging — one logger.warn per key per
 *      window, with the limiter name + key, so launch-day floods are visible
 *      without one log line per rejected request.
 *
 * Response contract on limit: HTTP 429, `Retry-After: <seconds>` header, and
 * JSON body `{ error: "rate_limited", retryAfter }`.
 *
 * NOTE: per Node.js process, like every limiter in this codebase (see
 * lib/brand-import/openai-semaphore.ts) — the Replit deployment is
 * single-instance. Multi-replica would need a distributed store.
 */
import type { Request, RequestHandler } from "express";
import { logger } from "./logger";
import { getClientIp } from "./geo";

export interface RateLimitOptions {
  /** Name used in 429 warn logs (e.g. "lp-track"). */
  name: string;
  /** Window length in ms (fixed window — resets `windowMs` after first hit). */
  windowMs: number;
  /** Requests allowed per key per window. */
  max: number;
  /**
   * Key extractor. Defaults to the client IP via the app's existing
   * X-Forwarded-For-aware helper (lib/geo.ts getClientIp — first XFF entry,
   * matching `app.set("trust proxy", 1)` in app.ts).
   */
  keyFn?: (req: Request) => string;
  /** Hard cap on tracked keys (memory bound). Default 50_000. */
  maxKeys?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
  /** True once this key's over-limit warn fired for the current window. */
  warned: boolean;
}

const DEFAULT_MAX_KEYS = 50_000;

function defaultKeyFn(req: Request): string {
  return getClientIp(req) || req.ip || "unknown";
}

/**
 * Build an Express middleware enforcing `max` requests per `keyFn(req)` per
 * `windowMs`. Fixed-window: the first request for a key opens its window;
 * counts reset when the window expires.
 */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const { name, windowMs, max } = opts;
  const maxKeys = opts.maxKeys ?? DEFAULT_MAX_KEYS;
  const keyFn = opts.keyFn ?? defaultKeyFn;
  const buckets = new Map<string, Bucket>();
  let lastSweepAt = Date.now();

  function sweepExpired(now: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return (req, res, next) => {
    const now = Date.now();

    // Lazy prune: at most once per window, drop expired buckets so idle keys
    // don't accumulate between bursts (no interval handle to leak in tests).
    if (now - lastSweepAt >= windowMs) {
      lastSweepAt = now;
      sweepExpired(now);
    }

    let key: string;
    try {
      key = keyFn(req) || "unknown";
    } catch {
      key = "unknown";
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      // (Re)open the window. Delete-then-set refreshes Map insertion order so
      // the size-cap eviction below always removes the stalest windows first.
      if (bucket) buckets.delete(key);
      bucket = { count: 0, resetAt: now + windowMs, warned: false };
      buckets.set(key, bucket);

      if (buckets.size > maxKeys) {
        // Spoofed-IP flood guard: free expired windows first, then evict the
        // oldest live windows until we're back under the cap. Evicted keys
        // get a fresh allowance if they return — bounded memory wins over
        // perfect accounting for an attacker-controlled key space.
        sweepExpired(now);
        while (buckets.size > maxKeys) {
          const oldest = buckets.keys().next().value;
          if (oldest === undefined) break;
          buckets.delete(oldest);
        }
      }
    }

    bucket.count++;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      // Sampled abuse log: at most one warn per key per window.
      if (!bucket.warned) {
        bucket.warned = true;
        logger.warn(
          {
            event: "rate_limited",
            limiter: name,
            key,
            max,
            windowMs,
            trackedKeys: buckets.size,
          },
          `[rateLimit] ${name}: key over limit`,
        );
      }
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "rate_limited", retryAfter });
      return;
    }

    next();
  };
}

/**
 * Read a positive-integer per-window limit from the environment (e.g.
 * RATE_LIMIT_TRACKING_PER_MIN), falling back for missing/zero/garbage values.
 */
export function envLimit(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}
