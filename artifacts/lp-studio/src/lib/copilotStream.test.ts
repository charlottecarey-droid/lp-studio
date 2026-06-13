/**
 * Unit coverage for the Builder Copilot SSE client — token/action/done/error
 * dispatch and the typed error kinds. Reuses the same mocked-fetch +
 * ReadableStream harness as generationStream.test.ts (deliberately misaligned
 * chunk boundaries to exercise the shared SseParser).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { streamCopilotChat, CopilotStreamError, type CopilotAction } from "./copilotStream";

function sseResponse(frames: string[], opts?: { chunkSize?: number }): Response {
  const text = frames.join("");
  const encoder = new TextEncoder();
  const size = opts?.chunkSize ?? 5;
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

const REQ = { pageId: 1, userMessage: "review my page" };

describe("streamCopilotChat", () => {
  it("streams tokens + actions in order and resolves with the done payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          "retry: 5000\n\n",
          ": connected\n\n",
          'event: token\ndata: {"text":"Your "}\n\n',
          'event: token\ndata: {"text":"hero looks good. "}\n\n',
          ": hb\n\n",
          'event: action\ndata: {"type":"insert_block","label":"Add social proof","args":{"type":"testimonial-wall","afterBlockId":"hero-1"},"rationale":"No proof above the fold."}\n\n',
          'event: done\ndata: {"conversationId":42,"messageId":99}\n\n',
        ]),
      ),
    );
    let text = "";
    const actions: CopilotAction[] = [];
    const done = await streamCopilotChat(REQ, {
      onToken: (t) => { text += t; },
      onAction: (a) => actions.push(a),
    });
    expect(text).toBe("Your hero looks good. ");
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("insert_block");
    expect(actions[0].args).toEqual({ type: "testimonial-wall", afterBlockId: "hero-1" });
    expect(done.conversationId).toBe(42);
    expect(done.messageId).toBe(99);
  });

  it("rejects with a server-kind error carrying the error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'event: token\ndata: {"text":"…"}\n\n',
          'event: error\ndata: {"message":"AI integration not configured."}\n\n',
        ]),
      ),
    );
    const err = await streamCopilotChat(REQ, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CopilotStreamError);
    expect((err as CopilotStreamError).kind).toBe("server");
    expect((err as CopilotStreamError).message).toBe("AI integration not configured.");
  });

  it("surfaces a plain-JSON refusal (rate limit) as an http-kind error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const err = await streamCopilotChat(REQ, {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CopilotStreamError);
    expect((err as CopilotStreamError).kind).toBe("http");
    expect((err as CopilotStreamError).status).toBe(429);
  });

  it("rejects transport when the stream ends with no done event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse(['event: token\ndata: {"text":"hi"}\n\n'])),
    );
    const err = await streamCopilotChat(REQ, {}).catch((e: unknown) => e);
    expect((err as CopilotStreamError).kind).toBe("transport");
  });
});
