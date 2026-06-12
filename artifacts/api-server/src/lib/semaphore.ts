/**
 * Generic in-process FIFO semaphore — launch hardening (June 2026).
 *
 * Generalizes the brand importer's openai-semaphore (which now delegates
 * here) so every expensive shared resource — headless-Chromium prerenders,
 * Firecrawl scrapes, OpenAI page-generation calls — can be capped with the
 * same primitive instead of copy-pasted counters.
 *
 * Semantics:
 *   • At most `max` callbacks run concurrently; excess `run()` calls queue
 *     FIFO and start as earlier ones release their slot.
 *   • A slot is ALWAYS released, including when the wrapped fn throws or
 *     rejects (the error still propagates to the caller).
 *   • When the queue grows past `warnQueueDepth`, a structured logger.warn
 *     fires (rate-limited to once per 10s per semaphore) so saturation is
 *     visible without flooding the logs.
 *
 * NOTE: this is per Node.js process. Multi-process / multi-replica
 * deployments would need a distributed limiter (e.g. Redis token bucket).
 * The Replit deployment is single-instance, which is the existing codebase
 * convention (see lib/brand-import/openai-semaphore.ts).
 */
import { logger } from "./logger";

export interface Semaphore {
  /** Run `fn` once a slot is free. The slot is released when `fn` settles. */
  run<T>(fn: () => Promise<T> | T): Promise<T>;
  /** Number of callbacks currently holding a slot (diagnostics/tests). */
  inFlight(): number;
  /** Number of callbacks waiting for a slot (diagnostics/tests). */
  queueLength(): number;
}

export interface SemaphoreOptions {
  /** Name used in queue-depth warnings (e.g. "prerender"). */
  name: string;
  /** Max concurrent callbacks. Values < 1 are clamped to 1. */
  max: number;
  /** Warn when the queue grows beyond this depth. Default 3. */
  warnQueueDepth?: number;
}

const WARN_INTERVAL_MS = 10_000;

export function makeSemaphore(opts: SemaphoreOptions): Semaphore {
  const max = Math.max(1, Math.floor(opts.max));
  const warnQueueDepth = opts.warnQueueDepth ?? 3;
  let inFlight = 0;
  const waiters: Array<() => void> = [];
  let lastWarnAt = 0;

  function acquire(): Promise<void> {
    if (inFlight < max) {
      inFlight++;
      return Promise.resolve();
    }
    const queued = new Promise<void>((resolve) => waiters.push(resolve));
    if (waiters.length > warnQueueDepth) {
      const now = Date.now();
      if (now - lastWarnAt >= WARN_INTERVAL_MS) {
        lastWarnAt = now;
        logger.warn(
          {
            event: "semaphore_queue_depth",
            semaphore: opts.name,
            max,
            inFlight,
            queueDepth: waiters.length,
          },
          `[semaphore] ${opts.name}: queue depth ${waiters.length} (max concurrency ${max})`,
        );
      }
    }
    return queued;
  }

  function release(): void {
    const next = waiters.shift();
    if (next) {
      // Hand the slot directly to the next FIFO waiter without decrementing —
      // they were already counted against `max` when they queued. (Same
      // handoff the original brand-import openai-semaphore used.)
      next();
    } else {
      inFlight--;
    }
  }

  return {
    async run<T>(fn: () => Promise<T> | T): Promise<T> {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
    inFlight: () => inFlight,
    queueLength: () => waiters.length,
  };
}

/**
 * Read a positive-integer concurrency limit from the environment, falling
 * back to `fallback` for missing/zero/garbage values (a semaphore with
 * max=0 would deadlock, so 0 is treated as "unset").
 */
export function envConcurrency(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}
