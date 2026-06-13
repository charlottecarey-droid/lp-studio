/**
 * Builder Copilot — chat SSE client (June 2026 chatbot spec).
 *
 * `POST /api/lp/copilot/chat` answers with a Server-Sent-Events stream (see
 * api-server's lib/conversation/chatEmitter.ts for the producer) that streams
 * the assistant's reply token-by-token and proposes structured edits as
 * `action` events, ending with a `done` event. This module mirrors
 * generationStream.ts: it reuses the same battle-tested `SseParser` (event:/
 * data: framing, multi-line data, `: hb` comments, CRLF, split chunks) and adds
 * typed per-event handlers.
 *
 * If the response Content-Type is NOT text/event-stream the server refused with
 * a plain JSON error (401/403/429/400) — surfaced as an `http`-kind error.
 */
import { SseParser } from "./generationStream";

/** One structured edit the bot proposes — mirrors the server CopilotAction. */
export interface CopilotAction {
  type:
    | "insert_block"
    | "rewrite_copy"
    | "replace_image"
    | "remove_block"
    | "reorder_block"
    | "fix_contrast"
    | string;
  label: string;
  args: Record<string, unknown>;
  rationale: string;
}

export interface CopilotDoneEvent {
  conversationId: number;
  messageId: number | null;
}

export interface CopilotStreamHandlers {
  /** A streamed assistant text delta — append to the live bubble. */
  onToken?: (text: string) => void;
  /** A proposed action — render an action card. */
  onAction?: (action: CopilotAction) => void;
}

export interface CopilotChatRequest {
  conversationId?: number;
  pageId: number;
  userMessage: string;
  /** Optional live (possibly-unsaved) page state so the bot reasons about
   *  exactly what the user sees. */
  blocks?: unknown[];
  title?: string;
}

export type CopilotStreamErrorKind = "http" | "server" | "transport" | "aborted";

export class CopilotStreamError extends Error {
  readonly kind: CopilotStreamErrorKind;
  readonly status?: number;
  constructor(message: string, opts: { kind: CopilotStreamErrorKind; status?: number }) {
    super(message);
    this.name = "CopilotStreamError";
    this.kind = opts.kind;
    this.status = opts.status;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Run a streaming copilot turn. Streams tokens + actions through `handlers` and
 * resolves with the terminal `done` payload; rejects with a typed
 * `CopilotStreamError`. The caller's AbortSignal cancels the fetch — the
 * backend treats client disconnect as an abort (and cancels the OpenAI call).
 */
export async function streamCopilotChat(
  body: CopilotChatRequest,
  handlers: CopilotStreamHandlers,
  signal?: AbortSignal,
): Promise<CopilotDoneEvent> {
  const fail = (message: string, kind: CopilotStreamErrorKind, status?: number) =>
    new CopilotStreamError(message, { kind, status });

  let res: Response;
  try {
    res = await fetch(`/api/lp/copilot/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw fail("Cancelled", "aborted");
    throw fail(err instanceof Error ? err.message : "Could not reach the server", "transport");
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/event-stream")) {
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw fail(errBody?.error ?? `Request failed (${res.status})`, "http", res.status);
  }
  if (!res.body) {
    throw fail("Streaming is not supported in this browser", "transport");
  }

  let done: CopilotDoneEvent | null = null;
  let serverError: CopilotStreamError | null = null;

  const parser = new SseParser((name, data) => {
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return; // malformed frame — skip rather than kill the stream
    }
    switch (name) {
      case "token":
        handlers.onToken?.((payload as { text?: string }).text ?? "");
        break;
      case "action":
        handlers.onAction?.(payload as CopilotAction);
        break;
      case "done":
        done = payload as CopilotDoneEvent;
        break;
      case "error":
        serverError = fail((payload as { message?: string }).message ?? "Assistant error", "server");
        break;
      default:
        break;
    }
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (done !== null || serverError !== null) break;
    }
    if (done === null && serverError === null) {
      parser.push(decoder.decode());
      parser.flush();
    }
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw fail("Cancelled", "aborted");
    throw fail("Connection lost", "transport");
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }

  if (serverError !== null) throw serverError;
  if (done !== null) return done;
  throw fail("The stream ended unexpectedly", "transport");
}
