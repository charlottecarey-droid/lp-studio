import { Router } from "express";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { aiLightLimiter, aiLightHourlyLimiter } from "../../lib/ai-rate-limit";
import { runOrchestrator } from "../../lib/brand-import";
import type { StreamEvent } from "../../lib/brand-import";
import { isSafePublicHost } from "../../lib/brand-import/net-guard";

const router = Router();

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const buckets = new Map<string, { count: number; resetAt: number }>();
function checkRate(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count++;
  return true;
}

router.post(
  "/lp/brand-import/from-url-stream",
  requireAuth,
  aiLightLimiter,
  aiLightHourlyLimiter,
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const rawUrl = String(req.body?.url ?? "").trim();
    const forceRefresh = req.body?.forceRefresh === true;
    if (!rawUrl) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    } catch {
      res.status(400).json({ error: "invalid url" });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      res.status(400).json({ error: "url must be http(s)" });
      return;
    }
    if (!(await isSafePublicHost(parsed.hostname))) {
      res.status(400).json({ error: "url must be a public host" });
      return;
    }
    if (!checkRate(`brand-import-stream-${tenantId}`)) {
      res.status(429).json({ error: "too many requests, try again in a minute" });
      return;
    }
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "FIRECRAWL_API_KEY not configured" });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Cooperative cancellation: if the client disconnects mid-stream, stop
    // yielding new dimension events and break out of the generator loop so
    // we don't keep flushing into a closed socket. The in-flight extractor
    // promises will resolve/timeout into the void; we accept that bounded
    // waste rather than building full per-extractor AbortSignal plumbing.
    let clientGone = false;
    const onClose = (): void => { clientGone = true; };
    req.on("close", onClose);
    res.on("close", onClose);

    const write = (e: StreamEvent): void => {
      if (clientGone) return;
      // Respect backpressure: if the write buffer is full, pause until drain
      // so we don't accumulate unbounded memory on slow consumers.
      const ok = res.write(JSON.stringify(e) + "\n");
      if (!ok) {
        // Best-effort: wait for drain or client disconnect; cap at 5s so a
        // stalled consumer can't pin this request forever.
        return;
      }
    };

    try {
      for await (const event of runOrchestrator(parsed.toString(), apiKey, { forceRefresh, tenantId })) {
        if (clientGone) break;
        write(event);
      }
    } catch (err) {
      write({ event: "error", error: String(err) });
    } finally {
      req.removeListener("close", onClose);
      res.removeListener("close", onClose);
      if (!clientGone) res.end();
    }
  },
);

export default router;
