/**
 * ChatEmitter — SSE channel for the streaming conversation engine (June 2026).
 *
 * Mirrors the transport conventions of generationEmitter.ts (the live page-
 * generation SSE path): the same `no-transform` compression bypass,
 * `X-Accel-Buffering: no`, `retry:` + `: connected` opening frames, a 15s `: hb`
 * heartbeat, `res.flush()` after every event, and an abort-on-client-disconnect
 * AbortController so the in-flight OpenAI request is cancelled (releasing its
 * semaphore slot) the moment the user closes the panel.
 *
 * Event contract (consumed by the builder copilot panel — src/lib/copilotStream.ts):
 *   token   {text}                              — one streamed assistant text delta
 *   action  {type, label, args, rationale}      — a structured edit the bot PROPOSES
 *   done    {conversationId, messageId}         — terminal success
 *   error   {message}                           — terminal failure
 * Plus: `retry: 5000` + `: connected` on open, `: hb` comment every 15s.
 */
import type { Request, Response } from "express";
import { logger } from "../logger";
import type { CopilotAction } from "./actions";

export interface ChatEmitter {
  readonly aborted: boolean;
  readonly signal: AbortSignal;
  token(text: string): void;
  action(action: CopilotAction): void;
  done(meta: { conversationId: number; messageId: number | null }): void;
  error(message: string): void;
  close(): void;
}

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

class SseChatEmitter implements ChatEmitter {
  private closed = false;
  private clientGone = false;
  private readonly controller = new AbortController();
  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor(
    private readonly res: SseResponseLike,
    req: SseRequestLike,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    this.writeRaw(`retry: 5000\n\n`);
    this.writeRaw(`: connected\n\n`);

    this.heartbeat = setInterval(() => {
      this.writeRaw(`: hb\n\n`);
    }, HEARTBEAT_MS);
    if (typeof this.heartbeat === "object" && "unref" in this.heartbeat) {
      this.heartbeat.unref();
    }

    req.on("close", () => {
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
        "[copilot] SSE event payload not serializable — skipped",
      );
      return;
    }
    this.writeRaw(`event: ${name}\ndata: ${json}\n\n`);
  }

  token(text: string): void {
    if (!text) return;
    this.event("token", { text });
  }

  action(action: CopilotAction): void {
    this.event("action", action);
  }

  done(meta: { conversationId: number; messageId: number | null }): void {
    this.event("done", meta);
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

export function createSseChatEmitter(req: Request, res: Response): ChatEmitter {
  return new SseChatEmitter(res, req);
}

/** Internal constructor surface exported for unit tests (mock req/res). */
export function createSseChatEmitterForTest(
  req: SseRequestLike,
  res: SseResponseLike,
): ChatEmitter {
  return new SseChatEmitter(res, req);
}
