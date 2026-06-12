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
// June 2026 launch hardening: the FIFO slot-handoff implementation moved to
// the shared `makeSemaphore` factory (src/lib/semaphore.ts) so the prerender,
// Firecrawl, and generate-page caps reuse the exact same primitive. The
// BRAND_IMPORT_OPENAI_CONCURRENCY env (default 3) and the FIFO/handoff
// behavior are unchanged.
import { makeSemaphore, envConcurrency } from "../semaphore";

const MAX_CONCURRENT = envConcurrency("BRAND_IMPORT_OPENAI_CONCURRENCY", 3);

const semaphore = makeSemaphore({
  name: "brand-import-openai",
  max: MAX_CONCURRENT,
});

export async function withOpenAIConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  return semaphore.run(fn);
}
