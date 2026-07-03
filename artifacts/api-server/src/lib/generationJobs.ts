/**
 * Async generation jobs (July 2026 reliability workstream).
 *
 * Generation was one long synchronous request racing gateway idle timeouts;
 * a client disconnect killed work the tenant had already paid tokens for.
 * This module decouples the work from the submitting connection:
 *
 *   submit  → row in lp_generation_jobs + the runner starts immediately
 *   status  → GET the row (works across instance recycles)
 *   stream  → SSE re-attach: buffered replay of everything so far, then live
 *
 * DESIGN
 *  - The runner invokes the EXISTING route handler (generatePageHandler)
 *    through a captured req/res shim with `?stream=1`, parsing the SSE frames
 *    the handler writes. Zero refactor of the 11k-line pipeline; the job path
 *    and the sync path cannot drift because they ARE the same code.
 *  - Auth/quota/rate-limit middleware run on the SUBMIT endpoint; the runner
 *    bypasses them by calling the handler directly with req.authUser set from
 *    the job row. Quota is therefore charged exactly once, at submission.
 *  - Fine-grained events (block deltas) are buffered in process memory for
 *    re-attach; the DB row persists coarse state only (status/stage/result).
 *    If the instance recycles mid-job the buffer is lost and the row's stale
 *    heartbeat lets readers fail the job honestly instead of spinning.
 *  - In-process concurrency is bounded by the generation semaphores the
 *    handler already acquires; the queue adds no second limiter.
 */
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { and, eq, lt } from "drizzle-orm";
import { db, lpGenerationJobsTable, type LpGenerationJob } from "@workspace/db";
import { logger } from "./logger";
import { captureRouteError } from "./sentry";

export type GenerationJobKind = "page" | "microsite";
export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface GenerationJobEvent {
  /** SSE event name (stage, block, blocks, receipt, result, error, …). */
  event: string;
  /** Raw JSON payload string exactly as the handler emitted it. */
  data: string;
}

/** A "running" row whose heartbeat is older than this was orphaned by an
 *  instance recycle — readers fail it honestly. Heartbeats tick ~5s. */
const STALE_HEARTBEAT_MS = 2 * 60 * 1000;
const HEARTBEAT_WRITE_MS = 5_000;
/** Replay buffer cap per job — a full generation stream is typically well
 *  under this; beyond it we drop the oldest non-terminal events and mark the
 *  replay as truncated so a late subscriber still gets stage + result. */
const MAX_BUFFERED_EVENTS = 2_000;
/** Jobs older than this are swept lazily on submit. */
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface LiveJob {
  events: GenerationJobEvent[];
  truncated: boolean;
  subscribers: Set<(e: GenerationJobEvent) => void>;
  done: boolean;
}

/** Process-local registry of in-flight jobs (buffer + live subscribers). */
const liveJobs = new Map<string, LiveJob>();

type GenerationHandler = (req: Request, res: Response) => Promise<void>;

/** The generators the queue can run. Registered at route-mount time to avoid
 *  a module cycle (generate-page imports libs that import this module's
 *  neighbors). Submit endpoints live where their middleware lives: "page" on
 *  routes/lp/generation-jobs.ts, "microsite" on the sales router behind the
 *  salesConsole plan gate (routes/sales/generate-microsite.ts). */
const handlers = new Map<GenerationJobKind, GenerationHandler>();
export function registerGenerationJobHandler(kind: GenerationJobKind, handler: GenerationHandler): void {
  handlers.set(kind, handler);
}

// ── SSE frame parsing ────────────────────────────────────────────────────────
// The handler writes standard SSE frames ("event: x\ndata: {...}\n\n" plus
// ": comment" keepalives). This incremental parser mirrors the FE client.
export class SseFrameParser {
  private buf = "";
  /** Feed a chunk; returns completed events (comments/keepalives dropped). */
  push(chunk: string): GenerationJobEvent[] {
    this.buf += chunk;
    const out: GenerationJobEvent[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf("\n\n")) !== -1) {
      const frame = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith(":")) continue; // comment / keepalive
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length > 0) out.push({ event, data: dataLines.join("\n") });
    }
    return out;
  }
}

// ── Job store ────────────────────────────────────────────────────────────────

export async function createGenerationJob(opts: {
  tenantId: number;
  kind: GenerationJobKind;
  request: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(lpGenerationJobsTable).values({
    id,
    tenantId: opts.tenantId,
    kind: opts.kind,
    status: "queued",
    request: opts.request,
  });
  // Lazy retention sweep — best-effort, never blocks a submit.
  void db
    .delete(lpGenerationJobsTable)
    .where(lt(lpGenerationJobsTable.createdAt, new Date(Date.now() - JOB_RETENTION_MS)))
    .catch(() => {});
  return id;
}

export async function getGenerationJob(
  id: string,
  tenantId: number,
): Promise<LpGenerationJob | null> {
  const rows = await db
    .select()
    .from(lpGenerationJobsTable)
    .where(and(eq(lpGenerationJobsTable.id, id), eq(lpGenerationJobsTable.tenantId, tenantId)))
    .limit(1);
  const job = rows[0] ?? null;
  if (!job) return null;
  return maybeFailStale(job);
}

/** Detect a job orphaned by an instance recycle: the row says "running" but
 *  no live entry exists in THIS process and the heartbeat is stale. Fails it
 *  in the DB so every future reader agrees. */
async function maybeFailStale(job: LpGenerationJob): Promise<LpGenerationJob> {
  if (job.status !== "running" && job.status !== "queued") return job;
  if (liveJobs.has(job.id)) return job;
  const beat = job.heartbeatAt ?? job.startedAt ?? job.createdAt;
  if (beat && Date.now() - new Date(beat).getTime() < STALE_HEARTBEAT_MS) return job;
  const error =
    "The server restarted while this generation was running. Your quota was used for the attempt — please retry.";
  await db
    .update(lpGenerationJobsTable)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(eq(lpGenerationJobsTable.id, job.id))
    .catch(() => {});
  return { ...job, status: "failed", error };
}

// ── Runner ───────────────────────────────────────────────────────────────────

function emitToJob(live: LiveJob, e: GenerationJobEvent): void {
  live.events.push(e);
  if (live.events.length > MAX_BUFFERED_EVENTS) {
    live.events.splice(0, live.events.length - MAX_BUFFERED_EVENTS);
    live.truncated = true;
  }
  for (const sub of live.subscribers) {
    try {
      sub(e);
    } catch {
      /* a broken subscriber never affects the job or its siblings */
    }
  }
}

/** Start the job's generator in the background. Returns immediately. */
export function startGenerationJob(id: string, tenantId: number, kind: GenerationJobKind, request: Record<string, unknown>): void {
  const handler = handlers.get(kind);
  const live: LiveJob = { events: [], truncated: false, subscribers: new Set(), done: false };
  liveJobs.set(id, live);

  const finish = async (status: GenerationJobStatus, patch: { result?: unknown; error?: string }) => {
    live.done = true;
    liveJobs.delete(id);
    await db
      .update(lpGenerationJobsTable)
      .set({ status, finishedAt: new Date(), result: patch.result ?? null, error: patch.error ?? null })
      .where(eq(lpGenerationJobsTable.id, id))
      .catch((err) => logger.error({ err: String(err), jobId: id }, "[generation-jobs] terminal update failed"));
  };

  setImmediate(async () => {
    if (!handler) {
      emitToJob(live, { event: "error", data: JSON.stringify({ message: `no handler for kind "${kind}"` }) });
      await finish("failed", { error: `no handler registered for kind "${kind}"` });
      return;
    }
    let lastBeat = 0;
    let lastStage: string | null = null;
    const parser = new SseFrameParser();
    let result: unknown = null;
    let errorMsg: string | null = null;

    await db
      .update(lpGenerationJobsTable)
      .set({ status: "running", startedAt: new Date(), heartbeatAt: new Date() })
      .where(eq(lpGenerationJobsTable.id, id))
      .catch(() => {});

    const onChunk = (chunk: string): void => {
      for (const e of parser.push(chunk)) {
        if (e.event === "stage") {
          try {
            const parsed = JSON.parse(e.data) as { id?: string };
            if (typeof parsed.id === "string") lastStage = parsed.id;
          } catch { /* stage id is cosmetic */ }
        }
        if (e.event === "result") {
          try { result = JSON.parse(e.data); } catch { /* handled at finish */ }
        }
        if (e.event === "error") {
          // The SSE emitter's grammar is {message}; plain-JSON fallbacks use
          // {error}. Accept both.
          try {
            const p = JSON.parse(e.data) as { message?: unknown; error?: unknown };
            errorMsg = String(p.message ?? p.error ?? "generation failed");
          } catch { errorMsg = "generation failed"; }
        }
        emitToJob(live, e);
      }
      const now = Date.now();
      if (now - lastBeat > HEARTBEAT_WRITE_MS) {
        lastBeat = now;
        void db
          .update(lpGenerationJobsTable)
          .set({ heartbeatAt: new Date(), stage: lastStage })
          .where(eq(lpGenerationJobsTable.id, id))
          .catch(() => {});
      }
    };

    // Captured req/res shim — exactly the surface the handler + SSE emitter
    // consume (see generatePageHandler's export note). The page handler reads
    // everything from req.body; the microsite handler additionally reads
    // req.params.accountId (its sync route is account-scoped), so the sales
    // submit route stores accountId inside the request row and the shim
    // surfaces it back as a route param here.
    const params: Record<string, string> =
      kind === "microsite"
        ? { accountId: String((request as { accountId?: unknown }).accountId ?? "") }
        : {};
    const req = {
      body: { ...request },
      query: { stream: "1" },
      params,
      headers: {},
      authUser: { tenantId },
      on: () => req, // never fires "close": the job outlives any client
    } as unknown as Request;
    const res = {
      statusCode: 200,
      setHeader: () => res,
      flushHeaders: () => {},
      flush: () => {},
      write: (chunk: unknown): boolean => {
        onChunk(String(chunk));
        return true;
      },
      end: () => res,
      status: (code: number) => {
        res.statusCode = code;
        return res;
      },
      // Non-streaming escape hatches (validation errors respond with plain
      // JSON before the emitter exists).
      json: (body: unknown) => {
        if (res.statusCode >= 400) {
          errorMsg = String((body as { error?: unknown })?.error ?? `request failed (${res.statusCode})`);
          emitToJob(live, { event: "error", data: JSON.stringify({ message: errorMsg }) });
        } else {
          result = body;
          emitToJob(live, { event: "result", data: JSON.stringify(body) });
        }
        return res;
      },
      on: () => res,
      removeListener: () => res,
    } as unknown as Response;

    try {
      await handler(req, res);
      if (errorMsg) {
        await finish("failed", { error: errorMsg });
      } else if (result) {
        await finish("succeeded", { result });
      } else {
        await finish("failed", { error: "generation ended without a result" });
      }
    } catch (err) {
      captureRouteError(err, "lp/generation-jobs", { jobId: id, tenantId, kind });
      logger.error({ err: String(err), jobId: id, tenantId }, "[generation-jobs] runner crashed");
      emitToJob(live, { event: "error", data: JSON.stringify({ message: "generation failed unexpectedly" }) });
      await finish("failed", { error: String(err).slice(0, 500) });
    }
  });
}

// ── Re-attach ────────────────────────────────────────────────────────────────

/** Subscribe to a job's events: replays the buffer, then live-forwards.
 *  Returns an unsubscribe fn, or null when the job isn't live in this
 *  process (caller should fall back to the DB row snapshot). */
export function subscribeToGenerationJob(
  id: string,
  onEvent: (e: GenerationJobEvent) => void,
): (() => void) | null {
  const live = liveJobs.get(id);
  if (!live) return null;
  if (live.truncated) {
    onEvent({ event: "replay-truncated", data: "{}" });
  }
  for (const e of live.events) onEvent(e);
  if (live.done) return () => {};
  live.subscribers.add(onEvent);
  return () => live.subscribers.delete(onEvent);
}

/** Test hook. */
export function __resetGenerationJobsForTest(): void {
  liveJobs.clear();
  handlers.clear();
}
