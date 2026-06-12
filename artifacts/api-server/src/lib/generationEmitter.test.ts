/**
 * GenerationEmitter SSE serialization tests (mock req/res — no DB, no HTTP).
 * Covers: header setup, opening frames, event framing for every event type,
 * flush-after-every-write, the 15s heartbeat, terminal result/error ending
 * the stream, and client-disconnect abort semantics.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSseGenerationEmitterForTest,
  NOOP_GENERATION_EMITTER,
  type SseRequestLike,
  type SseResponseLike,
} from "./generationEmitter";

class MockRes implements SseResponseLike {
  headers = new Map<string, string>();
  writes: string[] = [];
  flushHeadersCalls = 0;
  flushCalls = 0;
  ended = false;
  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
  flushHeaders(): void {
    this.flushHeadersCalls++;
  }
  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
  end(): void {
    this.ended = true;
  }
  flush(): void {
    this.flushCalls++;
  }
}

class MockReq implements SseRequestLike {
  private closeListeners: Array<() => void> = [];
  on(event: "close", listener: () => void): void {
    if (event === "close") this.closeListeners.push(listener);
  }
  emitClose(): void {
    for (const l of this.closeListeners) l();
  }
}

function makeEmitter() {
  const req = new MockReq();
  const res = new MockRes();
  const emitter = createSseGenerationEmitterForTest(req, res);
  return { req, res, emitter };
}

describe("SseGenerationEmitter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets SSE + compression-bypass headers, flushes them, and sends the opening frames", () => {
    const { res } = makeEmitter();
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("Connection")).toBe("keep-alive");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.flushHeadersCalls).toBe(1);
    expect(res.writes[0]).toBe("retry: 5000\n\n");
    expect(res.writes[1]).toBe(": connected\n\n");
  });

  it("frames every event type as `event: <name>` + JSON data and flushes after each", () => {
    const { res, emitter } = makeEmitter();
    const before = res.writes.length;
    emitter.stage("context", "start", "Loading context");
    emitter.stage("references", "done", "References", {
      scraped: ["https://a.com"],
      failed: [],
      fromInspiration: [],
    });
    emitter.block(0, { type: "hero" });
    emitter.blocksSnapshot([{ type: "hero" }], "normalized");
    emitter.restart("repeat_guard", "regenerating");
    emitter.receipt({ recipeId: "r1" });

    const frames = res.writes.slice(before);
    expect(frames[0]).toBe(
      `event: stage\ndata: ${JSON.stringify({ id: "context", status: "start", label: "Loading context" })}\n\n`,
    );
    expect(frames[1]).toBe(
      `event: stage\ndata: ${JSON.stringify({
        id: "references",
        status: "done",
        label: "References",
        meta: { scraped: ["https://a.com"], failed: [], fromInspiration: [] },
      })}\n\n`,
    );
    expect(frames[2]).toBe(`event: block\ndata: ${JSON.stringify({ index: 0, block: { type: "hero" } })}\n\n`);
    expect(frames[3]).toBe(
      `event: blocks\ndata: ${JSON.stringify({ blocks: [{ type: "hero" }], phase: "normalized" })}\n\n`,
    );
    expect(frames[4]).toBe(
      `event: restart\ndata: ${JSON.stringify({ reason: "repeat_guard", message: "regenerating" })}\n\n`,
    );
    expect(frames[5]).toBe(`event: receipt\ndata: ${JSON.stringify({ recipeId: "r1" })}\n\n`);
    // Every write (including the two opening frames) is followed by a flush.
    expect(res.flushCalls).toBe(res.writes.length);
  });

  it("emits a heartbeat comment every 15s until the stream ends", () => {
    const { res, emitter } = makeEmitter();
    const before = res.writes.length;
    vi.advanceTimersByTime(15_000);
    expect(res.writes.slice(before)).toEqual([": hb\n\n"]);
    vi.advanceTimersByTime(15_000);
    expect(res.writes.slice(before)).toEqual([": hb\n\n", ": hb\n\n"]);
    emitter.result({ ok: true });
    const afterEnd = res.writes.length;
    vi.advanceTimersByTime(60_000);
    expect(res.writes.length).toBe(afterEnd); // heartbeat stopped
  });

  it("result emits the terminal event then ends the response; later events are dropped", () => {
    const { res, emitter } = makeEmitter();
    emitter.result({ title: "T", blocks: [] });
    expect(res.writes.at(-1)).toBe(
      `event: result\ndata: ${JSON.stringify({ title: "T", blocks: [] })}\n\n`,
    );
    expect(res.ended).toBe(true);
    const n = res.writes.length;
    emitter.stage("finalize", "done", "late");
    emitter.error("late error");
    expect(res.writes.length).toBe(n);
  });

  it("error emits a terminal error event and ends the stream", () => {
    const { res, emitter } = makeEmitter();
    emitter.error("AI returned invalid JSON");
    expect(res.writes.at(-1)).toBe(
      `event: error\ndata: ${JSON.stringify({ message: "AI returned invalid JSON" })}\n\n`,
    );
    expect(res.ended).toBe(true);
  });

  it("client disconnect aborts the signal, stops the heartbeat, and silences writes", () => {
    const { req, res, emitter } = makeEmitter();
    expect(emitter.aborted).toBe(false);
    expect(emitter.signal?.aborted).toBe(false);
    req.emitClose();
    expect(emitter.aborted).toBe(true);
    expect(emitter.signal?.aborted).toBe(true);
    const n = res.writes.length;
    vi.advanceTimersByTime(60_000);
    emitter.block(0, { type: "hero" });
    expect(res.writes.length).toBe(n);
  });

  it("a close event AFTER a normal end is not treated as a client abort", () => {
    const { req, emitter } = makeEmitter();
    emitter.result({ ok: true });
    req.emitClose(); // socket teardown after normal completion
    expect(emitter.aborted).toBe(false);
    expect(emitter.signal?.aborted).toBe(false);
  });

  it("NOOP emitter is disabled and inert", () => {
    expect(NOOP_GENERATION_EMITTER.enabled).toBe(false);
    expect(NOOP_GENERATION_EMITTER.aborted).toBe(false);
    expect(NOOP_GENERATION_EMITTER.signal).toBeUndefined();
    // None of these should throw or do anything.
    NOOP_GENERATION_EMITTER.stage("model", "start", "x");
    NOOP_GENERATION_EMITTER.block(0, {});
    NOOP_GENERATION_EMITTER.result({});
    NOOP_GENERATION_EMITTER.error("x");
    NOOP_GENERATION_EMITTER.close();
  });
});
