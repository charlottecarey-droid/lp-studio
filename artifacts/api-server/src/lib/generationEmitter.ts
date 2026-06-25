/**
 * GenerationEmitter — SSE channel for live AI page generation (June 2026).
 *
 * POST /lp/generate-page?stream=1 (or Accept: text/event-stream) switches the
 * route into streaming mode: instead of one terminal JSON body, the response
 * is a Server-Sent-Events stream that narrates the pipeline (stage events),
 * previews blocks as the model writes them (block / blocks events) and ends
 * with the EXACT same JSON the non-streaming path returns (result event).
 *
 * The route threads ONE emitter through its phases; the non-streaming path
 * gets the shared no-op emitter so the existing behavior is byte-identical.
 *
 * Event contract (consumed by the builder's live-generation canvas):
 *   stage   {id, status: "start"|"done", label, meta?}
 *   block   {index, block}                       — freeform model stream only
 *   blocks  {blocks, phase: "normalized"|"images"|"polish"} — full replacement
 *   restart {reason: "repeat_guard", message}    — client clears the canvas
 *   receipt {recipeId, intentMatchedTemplate, ...} — provenance summary
 *   result  {...}                                — same body as the JSON path
 *   error   {message}                            — terminal
 * Plus: `retry: 5000` + `: connected` on open, `: hb` comment every 15s.
 *
 * Transport notes (same pattern as routes/notifications.ts):
 *   • `Cache-Control: no-cache, no-transform` makes the compression
 *     middleware's shouldTransform() skip this response so events are not
 *     buffered in a gzip stream; `X-Accel-Buffering: no` does the same for
 *     nginx-style proxies.
 *   • compression() patches a `res.flush()` onto every response — call it
 *     (when present) after each event so nothing sits in an upstream buffer.
 *   • On client disconnect the emitter aborts `signal` so the route can
 *     cancel the in-flight OpenAI request (releasing its semaphore slot) and
 *     stop all remaining work.
 */
import type { Request, Response } from "express";
import { logger } from "./logger";

export type GenerationStageId =
  | "research"
  | "context"
  | "references"
  | "model"
  | "images"
  | "polish"
  | "finalize";

export type GenerationBlocksPhase = "normalized" | "images" | "polish";

export interface GenerationEmitter {
  /** True when this request is in streaming (SSE) mode. */
  readonly enabled: boolean;
  /** True once the client disconnected (streaming mode only). */
  readonly aborted: boolean;
  /** Abort signal tied to client disconnect; undefined when non-streaming. */
  readonly signal: AbortSignal | undefined;
  stage(
    id: GenerationStageId,
    status: "start" | "done",
    label: string,
    meta?: Record<string, unknown>,
  ): void;
  block(index: number, block: unknown): void;
  blocksSnapshot(blocks: unknown[], phase: GenerationBlocksPhase): void;
  restart(reason: "repeat_guard", message: string): void;
  receipt(data: Record<string, unknown>): void;
  /** Emit the terminal `result` event (same JSON body as the non-streaming
   *  response) and end the stream. */
  result(body: unknown): void;
  /** Emit a terminal `error` event and end the stream. */
  error(message: string): void;
  /** Stop the heartbeat and end the stream without a further event (used when
   *  the client disconnected mid-generation). Idempotent. */
  close(): void;
}

/** Shared no-op emitter for the non-streaming path. */
export const NOOP_GENERATION_EMITTER: GenerationEmitter = {
  enabled: false,
  aborted: false,
  signal: undefined,
  stage: () => {},
  block: () => {},
  blocksSnapshot: () => {},
  restart: () => {},
  receipt: () => {},
  result: () => {},
  error: () => {},
  close: () => {},
};

const HEARTBEAT_MS = 15_000;

/** Minimal Response surface the emitter needs — widened for unit tests. */
export interface SseResponseLike {
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): void;
  write(chunk: string): boolean;
  end(): unknown;
  flush?(): void;
}

export interface SseRequestLike {
  on(event: "close", listener: () => void): unknown;
}

class SseGenerationEmitter implements GenerationEmitter {
  readonly enabled = true;
  private closed = false;
  private clientGone = false;
  private readonly controller = new AbortController();
  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor(
    private readonly res: SseResponseLike,
    req: SseRequestLike,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    // `no-transform` makes the compression middleware skip this response so
    // events aren't buffered; the rest disables proxy/browser caching.
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    this.writeRaw(`retry: 5000\n\n`);
    this.writeRaw(`: connected\n\n`);

    this.heartbeat = setInterval(() => {
      this.writeRaw(`: hb\n\n`);
    }, HEARTBEAT_MS);
    // Don't let the heartbeat keep the process alive on its own.
    if (typeof this.heartbeat === "object" && "unref" in this.heartbeat) {
      this.heartbeat.unref();
    }

    req.on("close", () => {
      // Fires both on client disconnect AND after a normal end; only the
      // former (stream not yet closed by us) is an abort.
      if (!this.closed) {
        this.clientGone = true;
        this.controller.abort();
        this.close();
      }
    });
  }

  get aborted(): boolean {
    return this.clientGone;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  private writeRaw(text: string): void {
    if (this.closed) return;
    try {
      this.res.write(text);
      this.res.flush?.();
    } catch {
      // Connection gone — the close handler does the cleanup.
    }
  }

  private event(name: string, data: unknown): void {
    let json: string;
    try {
      json = JSON.stringify(data);
    } catch (err) {
      logger.warn(
        { err: String(err), event: name },
        "[generate-page] SSE event payload not serializable — skipped",
      );
      return;
    }
    this.writeRaw(`event: ${name}\ndata: ${json}\n\n`);
  }

  stage(
    id: GenerationStageId,
    status: "start" | "done",
    label: string,
    meta?: Record<string, unknown>,
  ): void {
    this.event("stage", meta ? { id, status, label, meta } : { id, status, label });
  }

  block(index: number, block: unknown): void {
    this.event("block", { index, block });
  }

  blocksSnapshot(blocks: unknown[], phase: GenerationBlocksPhase): void {
    this.event("blocks", { blocks, phase });
  }

  restart(reason: "repeat_guard", message: string): void {
    this.event("restart", { reason, message });
  }

  receipt(data: Record<string, unknown>): void {
    this.event("receipt", data);
  }

  result(body: unknown): void {
    this.event("result", body);
    this.close();
  }

  error(message: string): void {
    this.event("error", { message });
    this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    try {
      this.res.end();
    } catch {
      /* already gone */
    }
  }
}

/** Create the live SSE emitter for a streaming generate-page request. Sets
 *  the SSE headers + opening frames immediately (so call it only AFTER all
 *  plain-JSON validation responses have had their chance). */
export function createSseGenerationEmitter(req: Request, res: Response): GenerationEmitter {
  return new SseGenerationEmitter(res, req);
}

/** Internal constructor surface exported for unit tests (mock req/res). */
export function createSseGenerationEmitterForTest(
  req: SseRequestLike,
  res: SseResponseLike,
): GenerationEmitter {
  return new SseGenerationEmitter(res, req);
}

/** True when the request opted into streaming: `?stream=1` or an Accept
 *  header that includes `text/event-stream`. */
export function wantsGenerationStream(req: Request): boolean {
  if (req.query?.stream === "1") return true;
  const accept = req.headers?.accept;
  return typeof accept === "string" && accept.includes("text/event-stream");
}
