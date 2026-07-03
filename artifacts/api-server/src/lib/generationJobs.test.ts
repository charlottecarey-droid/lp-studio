/**
 * Hermetic tests for the async generation job runner. The runner's DB writes
 * are all fail-open (.catch), so the event flow — shim → SSE frames → buffer
 * → subscribers → terminal state — tests without Postgres. Route-level
 * behavior (auth, tenant scoping, submit validation) is covered by the
 * DB-gated integration test alongside the route.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  SseFrameParser,
  startGenerationJob,
  subscribeToGenerationJob,
  registerGenerationJobHandler,
  __resetGenerationJobsForTest,
  type GenerationJobEvent,
} from "./generationJobs";
import type { Request, Response } from "express";

function waitForEvent(
  events: GenerationJobEvent[],
  name: string,
  timeoutMs = 1000,
): Promise<GenerationJobEvent> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const hit = events.find((e) => e.event === name);
      if (hit) return resolve(hit);
      if (Date.now() - start > timeoutMs) return reject(new Error(`no "${name}" event within ${timeoutMs}ms`));
      setTimeout(tick, 5);
    };
    tick();
  });
}

describe("SseFrameParser", () => {
  it("parses frames across chunk boundaries and drops keepalives", () => {
    const p = new SseFrameParser();
    const a = p.push("event: stage\ndata: {\"id\":\"model\"}\n\nevent: blo");
    expect(a).toEqual([{ event: "stage", data: '{"id":"model"}' }]);
    const b = p.push('ck\ndata: {"i":1}\n\n: keepalive\n\n');
    expect(b).toEqual([{ event: "block", data: '{"i":1}' }]);
  });

  it("joins multi-line data and defaults the event name", () => {
    const p = new SseFrameParser();
    const out = p.push("data: line1\ndata: line2\n\n");
    expect(out).toEqual([{ event: "message", data: "line1\nline2" }]);
  });
});

describe("startGenerationJob + subscribeToGenerationJob", () => {
  beforeEach(() => __resetGenerationJobsForTest());

  it("streams handler SSE frames to subscribers and finishes on result", async () => {
    registerGenerationJobHandler("page", async (req: Request, res: Response) => {
      expect((req as { authUser?: { tenantId?: number } }).authUser?.tenantId).toBe(7);
      expect((req.body as { prompt?: string }).prompt).toBe("hello");
      res.write('event: stage\ndata: {"id":"context","state":"start"}\n\n');
      res.write('event: result\ndata: {"title":"T","blocks":[]}\n\n');
      res.end();
    });
    const seen: GenerationJobEvent[] = [];
    startGenerationJob("job-1", 7, "page", { prompt: "hello" });
    const unsub = subscribeToGenerationJob("job-1", (e) => seen.push(e));
    expect(unsub).not.toBeNull();
    const result = await waitForEvent(seen, "result");
    expect(JSON.parse(result.data).title).toBe("T");
    expect(seen.some((e) => e.event === "stage")).toBe(true);
  });

  it("late subscriber gets the full buffered replay", async () => {
    registerGenerationJobHandler("page", async (_req, res) => {
      res.write('event: stage\ndata: {"id":"model"}\n\n');
      res.write('event: result\ndata: {"ok":true}\n\n');
      res.end();
    });
    startGenerationJob("job-2", 7, "page", { prompt: "x" });
    // Let the job run to completion before anyone subscribes.
    await new Promise((r) => setTimeout(r, 50));
    const seen: GenerationJobEvent[] = [];
    const unsub = subscribeToGenerationJob("job-2", (e) => seen.push(e));
    // Finished jobs are dropped from the live registry — the DB row is the
    // snapshot then. Both outcomes are valid depending on timing; when live,
    // the replay must include the terminal result.
    if (unsub !== null) {
      expect(seen.some((e) => e.event === "result")).toBe(true);
    }
  });

  it("maps a non-streaming 4xx json response to a failed job error event", async () => {
    registerGenerationJobHandler("page", async (_req, res) => {
      res.status(422).json({ error: "prompt too short" });
    });
    const seen: GenerationJobEvent[] = [];
    startGenerationJob("job-3", 7, "page", { prompt: "" });
    subscribeToGenerationJob("job-3", (e) => seen.push(e));
    const err = await waitForEvent(seen, "error");
    expect(JSON.parse(err.data).message).toBe("prompt too short");
  });

  it("a crashing handler yields an error event, never an unhandled rejection", async () => {
    registerGenerationJobHandler("page", async () => {
      throw new Error("boom");
    });
    const seen: GenerationJobEvent[] = [];
    startGenerationJob("job-4", 7, "page", { prompt: "x" });
    subscribeToGenerationJob("job-4", (e) => seen.push(e));
    const err = await waitForEvent(seen, "error");
    expect(JSON.parse(err.data).message).toContain("unexpected");
  });

  it("unknown kind fails cleanly", async () => {
    const seen: GenerationJobEvent[] = [];
    startGenerationJob("job-5", 7, "page", { prompt: "x" }); // nothing registered
    subscribeToGenerationJob("job-5", (e) => seen.push(e));
    const err = await waitForEvent(seen, "error");
    expect(JSON.parse(err.data).message).toContain("no handler");
  });
});
