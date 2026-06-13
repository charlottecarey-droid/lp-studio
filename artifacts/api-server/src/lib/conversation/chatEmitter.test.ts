/**
 * ChatEmitter SSE serialization tests (mock req/res — no DB, no HTTP). Covers
 * header setup + opening frames, token/action framing, flush-after-write, the
 * heartbeat, terminal done/error ending the stream, and client-disconnect abort.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSseChatEmitterForTest,
  type SseRequestLike,
  type SseResponseLike,
} from "./chatEmitter";

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
  const emitter = createSseChatEmitterForTest(req, res);
  return { req, res, emitter };
}

describe("SseChatEmitter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sets SSE + compression-bypass headers and opening frames", () => {
    const { res } = makeEmitter();
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.writes[0]).toBe("retry: 5000\n\n");
    expect(res.writes[1]).toBe(": connected\n\n");
  });

  it("frames token + action events and flushes after each", () => {
    const { res, emitter } = makeEmitter();
    const flushesBefore = res.flushCalls;
    emitter.token("hello");
    emitter.action({ type: "remove_block", label: "Remove", args: { blockId: "b1" }, rationale: "dup" });
    expect(res.writes).toContain('event: token\ndata: {"text":"hello"}\n\n');
    expect(res.writes).toContain(
      'event: action\ndata: {"type":"remove_block","label":"Remove","args":{"blockId":"b1"},"rationale":"dup"}\n\n',
    );
    expect(res.flushCalls).toBeGreaterThan(flushesBefore);
  });

  it("skips empty token frames", () => {
    const { res, emitter } = makeEmitter();
    const before = res.writes.length;
    emitter.token("");
    expect(res.writes.length).toBe(before);
  });

  it("emits a heartbeat comment every 15s", () => {
    const { res, emitter } = makeEmitter();
    const before = res.writes.length;
    vi.advanceTimersByTime(15_000);
    expect(res.writes.slice(before)).toContain(": hb\n\n");
    emitter.close();
  });

  it("done frames the payload and ends the stream", () => {
    const { res, emitter } = makeEmitter();
    emitter.done({ conversationId: 7, messageId: 3 });
    expect(res.writes).toContain('event: done\ndata: {"conversationId":7,"messageId":3}\n\n');
    expect(res.ended).toBe(true);
  });

  it("error frames the message and ends the stream", () => {
    const { res, emitter } = makeEmitter();
    emitter.error("boom");
    expect(res.writes).toContain('event: error\ndata: {"message":"boom"}\n\n');
    expect(res.ended).toBe(true);
  });

  it("aborts the signal + ends the stream on client disconnect", () => {
    const { req, res, emitter } = makeEmitter();
    expect(emitter.signal.aborted).toBe(false);
    req.emitClose();
    expect(emitter.aborted).toBe(true);
    expect(emitter.signal.aborted).toBe(true);
    expect(res.ended).toBe(true);
  });
});
