import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SseParser,
  streamGeneration,
  GenerationStreamError,
  type GenerationStageEvent,
} from "./generationStream";

function collect(): { frames: Array<{ event: string; data: string }>; parser: SseParser } {
  const frames: Array<{ event: string; data: string }> = [];
  const parser = new SseParser((event, data) => frames.push({ event, data }));
  return { frames, parser };
}

describe("SseParser", () => {
  it("parses a simple named event", () => {
    const { frames, parser } = collect();
    parser.push('event: stage\ndata: {"id":"context"}\n\n');
    expect(frames).toEqual([{ event: "stage", data: '{"id":"context"}' }]);
  });

  it("defaults the event name to 'message' when no event: line is present", () => {
    const { frames, parser } = collect();
    parser.push("data: hello\n\n");
    expect(frames).toEqual([{ event: "message", data: "hello" }]);
  });

  it("reassembles frames split across arbitrary chunk boundaries", () => {
    const { frames, parser } = collect();
    const stream = 'event: block\ndata: {"index":0,"block":{"type":"hero"}}\n\nevent: block\ndata: {"index":1}\n\n';
    // Feed one character at a time — the cruellest chunking possible.
    for (const ch of stream) parser.push(ch);
    expect(frames).toEqual([
      { event: "block", data: '{"index":0,"block":{"type":"hero"}}' },
      { event: "block", data: '{"index":1}' },
    ]);
  });

  it("handles a chunk boundary in the middle of the field name and of the blank separator", () => {
    const { frames, parser } = collect();
    parser.push("eve");
    parser.push("nt: stage\nda");
    parser.push("ta: one\n");
    parser.push("\nevent: stage\ndata: two\n\n");
    expect(frames).toEqual([
      { event: "stage", data: "one" },
      { event: "stage", data: "two" },
    ]);
  });

  it("ignores comment lines and retry: lines interleaved with frames", () => {
    const { frames, parser } = collect();
    parser.push("retry: 5000\n\n");
    parser.push(": connected\n\n");
    parser.push("event: stage\n: hb\ndata: abc\n\n");
    parser.push(": hb\n\n");
    parser.push("data: def\n\n");
    expect(frames).toEqual([
      { event: "stage", data: "abc" },
      { event: "message", data: "def" },
    ]);
  });

  it("joins multi-line data with newlines", () => {
    const { frames, parser } = collect();
    parser.push("event: result\ndata: line1\ndata: line2\ndata: line3\n\n");
    expect(frames).toEqual([{ event: "result", data: "line1\nline2\nline3" }]);
  });

  it("tolerates CRLF line endings", () => {
    const { frames, parser } = collect();
    parser.push('event: stage\r\ndata: {"a":1}\r\n\r\n');
    expect(frames).toEqual([{ event: "stage", data: '{"a":1}' }]);
  });

  it("strips exactly one leading space after the colon, preserving the rest", () => {
    const { frames, parser } = collect();
    parser.push("data:no-space\n\n");
    parser.push("data:  two-spaces\n\n");
    expect(frames).toEqual([
      { event: "message", data: "no-space" },
      { event: "message", data: " two-spaces" },
    ]);
  });

  it("does not dispatch when a frame has an event name but no data", () => {
    const { frames, parser } = collect();
    parser.push("event: stage\n\n");
    parser.push("data: real\n\n");
    // The empty 'stage' frame is dropped AND its event name does not leak
    // into the next frame.
    expect(frames).toEqual([{ event: "message", data: "real" }]);
  });

  it("ignores unknown fields and fields without colons", () => {
    const { frames, parser } = collect();
    parser.push("id: 7\nwhatever\nevent: stage\ndata: x\n\n");
    expect(frames).toEqual([{ event: "stage", data: "x" }]);
  });

  it("flush() dispatches a trailing frame missing its final blank line", () => {
    const { frames, parser } = collect();
    parser.push("event: error\ndata: boom");
    expect(frames).toEqual([]);
    parser.flush();
    expect(frames).toEqual([{ event: "error", data: "boom" }]);
  });
});

// ── streamGeneration (mocked fetch + ReadableStream) ─────────────────────────

function sseResponse(frames: string[], opts?: { chunkSize?: number }): Response {
  const text = frames.join("");
  const encoder = new TextEncoder();
  const size = opts?.chunkSize ?? 7; // deliberately misaligned with frame boundaries
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < text.length; i += size) {
        controller.enqueue(encoder.encode(text.slice(i, i + size)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamGeneration", () => {
  it("dispatches typed events in order and resolves with the result payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          "retry: 5000\n\n",
          ": connected\n\n",
          'event: stage\ndata: {"id":"context","status":"start","label":"Context"}\n\n',
          ": hb\n\n",
          'event: block\ndata: {"index":0,"block":{"type":"hero"}}\n\n',
          'event: blocks\ndata: {"phase":"normalized","blocks":[{"type":"hero"}]}\n\n',
          'event: receipt\ndata: {"recipeId":"showcase-heavy","critiqueCount":2}\n\n',
          'event: result\ndata: {"title":"T","slug":"t","blocks":[{"type":"hero"}]}\n\n',
          "event: done\ndata: {}\n\n",
        ]),
      ),
    );
    const stages: GenerationStageEvent[] = [];
    const blocks: number[] = [];
    let snapshotPhase = "";
    let receiptRecipe: string | null = null;
    const result = await streamGeneration(
      { prompt: "p" },
      {
        onStage: (e) => stages.push(e),
        onBlock: (e) => blocks.push(e.index),
        onBlocks: (e) => { snapshotPhase = e.phase; },
        onReceipt: (r) => { receiptRecipe = r.recipeId; },
      },
    );
    expect(stages).toHaveLength(1);
    expect(stages[0].id).toBe("context");
    expect(blocks).toEqual([0]);
    expect(snapshotPhase).toBe("normalized");
    expect(receiptRecipe).toBe("showcase-heavy");
    expect(result.title).toBe("T");
    expect(result.blocks).toEqual([{ type: "hero" }]);
  });

  it("rejects with a server-kind error carrying the error event message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'event: stage\ndata: {"id":"context","status":"start","label":"Context"}\n\n',
          'event: error\ndata: {"message":"AI returned invalid JSON"}\n\n',
        ]),
      ),
    );
    const err = await streamGeneration({ prompt: "p" }, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationStreamError);
    expect((err as GenerationStreamError).kind).toBe("server");
    expect((err as GenerationStreamError).message).toBe("AI returned invalid JSON");
    expect((err as GenerationStreamError).receivedStage).toBe(true);
  });

  it("rejects with an http-kind error when the response is plain JSON (non-SSE)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const err = await streamGeneration({ prompt: "p" }, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationStreamError);
    expect((err as GenerationStreamError).kind).toBe("http");
    expect((err as GenerationStreamError).status).toBe(429);
    expect((err as GenerationStreamError).message).toBe("Rate limit exceeded");
    expect((err as GenerationStreamError).receivedStage).toBe(false);
  });

  it("rejects with a transport-kind error when the stream ends without a result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse(['event: stage\ndata: {"id":"context","status":"start","label":"C"}\n\n']),
      ),
    );
    const err = await streamGeneration({ prompt: "p" }, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationStreamError);
    expect((err as GenerationStreamError).kind).toBe("transport");
    expect((err as GenerationStreamError).receivedStage).toBe(true);
  });

  it("marks receivedStage=false when the failure happens before any stage event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([": connected\n\n"])),
    );
    const err = await streamGeneration({ prompt: "p" }, {}).catch((e: unknown) => e);
    expect((err as GenerationStreamError).kind).toBe("transport");
    expect((err as GenerationStreamError).receivedStage).toBe(false);
  });
});
