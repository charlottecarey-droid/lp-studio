/**
 * Async generation job endpoints (July 2026 reliability workstream).
 *
 *   POST /lp/generation-jobs            — submit; auth + quota + heavy limiters
 *                                         run HERE (the runner bypasses them).
 *   GET  /lp/generation-jobs/:id        — status/result snapshot (tenant-scoped).
 *   GET  /lp/generation-jobs/:id/stream — SSE re-attach: buffered replay then
 *                                         live events; falls back to the DB
 *                                         snapshot when the job isn't live in
 *                                         this process (instance recycle).
 *
 * See lib/generationJobs.ts for the runner design.
 */
import { Router, type Request, type Response } from "express";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { requireAiGenerationQuota } from "../../middleware/requireAiGenerationQuota";
import { aiHeavyLimiter, aiHeavyHourlyLimiter } from "../../lib/ai-rate-limit";
import {
  createGenerationJob,
  getGenerationJob,
  startGenerationJob,
  subscribeToGenerationJob,
  registerGenerationJobHandler,
  type GenerationJobKind,
} from "../../lib/generationJobs";
import { generatePageHandler } from "./generate-page";
import { logger } from "../../lib/logger";

registerGenerationJobHandler("page", generatePageHandler);

const router = Router();

// Deliberately page-only: microsite jobs submit through the sales router
// (routes/sales/generate-microsite.ts) so the salesConsole plan gate and the
// microsite limiter apply — accepting kind:"microsite" HERE would bypass both.
// The GET status/stream endpoints below serve every kind (tenant-scoped reads).
const KINDS: ReadonlySet<string> = new Set(["page"]);

router.post(
  "/lp/generation-jobs",
  requireAuth,
  requireAiGenerationQuota(),
  aiHeavyLimiter,
  aiHeavyHourlyLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const kind = String(req.body?.kind ?? "page");
    if (!KINDS.has(kind)) {
      res.status(400).json({ error: `unknown job kind "${kind}"` });
      return;
    }
    const request = req.body?.request;
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      res.status(400).json({ error: "request body must include a request object" });
      return;
    }
    // Same cheap validation the sync route performs before any spend, so a
    // bad submit fails here instead of as a failed job.
    if (kind === "page" && typeof (request as { prompt?: unknown }).prompt !== "string") {
      res.status(400).json({ error: "request.prompt is required" });
      return;
    }
    try {
      const id = await createGenerationJob({
        tenantId,
        kind: kind as GenerationJobKind,
        request: request as Record<string, unknown>,
      });
      startGenerationJob(id, tenantId, kind as GenerationJobKind, request as Record<string, unknown>);
      res.status(202).json({ jobId: id });
    } catch (err) {
      logger.error({ err: String(err), tenantId }, "[generation-jobs] submit failed");
      res.status(500).json({ error: "failed to create generation job" });
    }
  },
);

router.get(
  "/lp/generation-jobs/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const job = await getGenerationJob(String(req.params.id), tenantId);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({
      id: job.id,
      kind: job.kind,
      status: job.status,
      stage: job.stage,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  },
);

router.get(
  "/lp/generation-jobs/:id/stream",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;
    const job = await getGenerationJob(String(req.params.id), tenantId);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const send = (event: string, data: string): void => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    };
    send("job", JSON.stringify({ id: job.id, status: job.status, stage: job.stage }));

    // Terminal or not-live-here: emit the snapshot and close — the row is the
    // source of truth across instance recycles.
    const finishFromRow = async (): Promise<void> => {
      const fresh = await getGenerationJob(job.id, tenantId);
      if (fresh?.status === "succeeded" && fresh.result) {
        send("result", JSON.stringify(fresh.result));
      } else if (fresh?.status === "failed") {
        send("error", JSON.stringify({ message: fresh.error ?? "generation failed" }));
      }
      res.end();
    };

    const unsubscribe = subscribeToGenerationJob(job.id, (e) => {
      send(e.event, e.data);
      if (e.event === "result" || e.event === "error") {
        // Terminal — close after the loop's write flushes.
        setImmediate(() => res.end());
      }
    });
    if (unsubscribe === null) {
      await finishFromRow();
      return;
    }

    const keepalive = setInterval(() => res.write(`: keepalive\n\n`), 15_000);
    if (typeof keepalive === "object" && "unref" in keepalive) keepalive.unref();
    req.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
    res.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  },
);

export default router;
