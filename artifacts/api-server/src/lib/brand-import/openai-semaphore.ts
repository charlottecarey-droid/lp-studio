/**
 * Process-wide concurrency limiter for OpenAI proxy calls.
 *
 * The brand importer's orchestrator fires 6 extractors in parallel, several
 * of which make 1-3 OpenAI vision/chat calls. Without a shared cap, the
 * Replit AI Integrations proxy 429s the back half of the burst — most
 * visibly, the voice extractor (which runs two sequential calls) lost the
 * race in every 5-URL test run.
 *
 * This module exposes `withOpenAIConcurrency(fn)` which serializes calls
 * behind a small semaphore (default n=3). Each call is FIFO-queued; if the
 * queue gets long we still let everything through, we just don't burst.
 *
 * NOTE: this is per Node.js process. Multi-process / multi-replica
 * deployments would need a distributed limiter (e.g. Redis token bucket).
 * For the importer's expected concurrency (single user clicking "import"
 * once or twice a minute), a per-process limiter is sufficient.
 */
const MAX_CONCURRENT = Number(process.env["BRAND_IMPORT_OPENAI_CONCURRENCY"] ?? "3");

let inFlight = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) {
    // Hand the slot directly to the next waiter without decrementing —
    // they were already counted against MAX_CONCURRENT when they queued.
    next();
  } else {
    inFlight--;
  }
}

export async function withOpenAIConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
