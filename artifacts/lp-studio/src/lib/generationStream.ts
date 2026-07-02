/**
 * Live AI page generation — SSE client (June 2026).
 *
 * `POST /api/lp/generate-page?stream=1` answers with a Server-Sent-Events
 * stream (see api-server's generationEmitter.ts for the producer) that
 * narrates the pipeline and ends with a `result` event whose payload is
 * byte-identical to the non-streaming JSON body. This module owns:
 *
 *   • A small, spec-faithful SSE frame parser (`SseParser`) — handles
 *     event:/data: framing, multi-line data, comment lines (`: hb`
 *     heartbeats), `retry:` lines, CRLF endings, and frames split across
 *     arbitrary chunk boundaries. Exported for unit tests.
 *   • `streamGeneration(body, handlers, signal)` — fetch + ReadableStream
 *     consumption with typed per-event handlers. Resolves with the terminal
 *     `result` payload; rejects with a `GenerationStreamError` carrying the
 *     server `error` message or the transport failure.
 *
 * If the response Content-Type is NOT text/event-stream the server refused
 * streaming with a plain JSON error (401/403/429/400) — surfaced as an
 * `http`-kind error exactly like today's non-streaming error handling.
 */
import type { PageBlock } from "@/lib/block-types";

// ── Event payload types (mirror api-server generationEmitter contract) ──────

export type GenerationStageId =
  | "research"
  | "context"
  | "references"
  | "model"
  | "images"
  | "polish"
  | "finalize";

export interface GenerationReferenceFailure {
  url: string;
  reason: string;
}

export interface GenerationStageMeta {
  /** references done — URLs scraped successfully. */
  scraped?: string[];
  /** references done — per-request URLs that failed, with a reason. */
  failed?: GenerationReferenceFailure[];
  /** references done — inspiration-site URLs (brand settings). */
  fromInspiration?: string[];
  [key: string]: unknown;
}

export interface GenerationStageEvent {
  id: GenerationStageId;
  status: "start" | "done";
  label: string;
  meta?: GenerationStageMeta;
}

export interface GenerationBlockEvent {
  index: number;
  block: unknown;
}

export type GenerationBlocksPhase = "normalized" | "images" | "polish";

export interface GenerationBlocksEvent {
  /** FULL replacement of the page's block array — reconcile, don't append. */
  blocks: unknown[];
  phase: GenerationBlocksPhase;
}

export interface GenerationRestartEvent {
  reason: "repeat_guard";
  message: string;
}

export interface GenerationReceipt {
  /** Layout recipe id (freeform path) — null on the template path. */
  recipeId: string | null;
  /** Set when prompt intent routed through a template (no explicit templateId). */
  intentMatchedTemplate: { slug: string; score: number } | null;
  referenceUrls: string[];
  scrapedUrls: string[];
  usedReference: boolean;
  referenceFailureReason: string | null;
  /** Quality ledger — silent fallbacks taken during this generation (July
   *  2026). Optional: older server builds omit it. */
  degradations?: { code: string; severity: "info" | "warn"; detail: string }[];
  inspirationReferences: { url: string; fromCache: boolean }[];
  imageFitFlagCount: number;
  critiqueCount: number;
  usedScreenshot: boolean;
  /** Recipe ids the caller asked to avoid (shuffle) — echoed back by the
   *  server when `excludeRecipeIds` was sent. Absent otherwise. */
  excludedRecipeIds?: string[];
}

/** Terminal payload — same JSON body the non-streaming endpoint returns. */
export interface GenerationResult {
  title: string;
  slug: string;
  blocks: PageBlock[];
  trustedFactForms?: string[];
  intentMatchedTemplate?: { slug: string; score: number } | null;
  [key: string]: unknown;
}

/** Request body — identical to today's non-streaming POST body. */
export interface GenerationRequestBody {
  prompt: string;
  segmentContext?: Record<string, unknown>;
  templateId?: number;
  /** Task #1345 — "Rewrite copy with AI" on an existing page. The id of a page
   *  whose layout is preserved while the AI rewrites its copy. Used instead of
   *  `templateId` when the source isn't a saved template. */
  sourcePageId?: number;
  replaceImagery?: boolean;
  referenceUrls?: string[];
  /** Singular reference URL — the sales microsite modal's historical field
   *  (scraped for voice + visual style). The server accepts both forms. */
  referenceUrl?: string;
  /** data:image/* URL of a pasted/dropped screenshot of a page the user
   *  likes — the server preprocesses/resizes it and uses it for layout cues. */
  screenshotDataUrl?: string;
  /** Layout recipe ids to avoid ("Shuffle layout") — accumulated across
   *  shuffles in one modal session, capped at 10. Freeform path only. */
  excludeRecipeIds?: string[];
}

export interface GenerationStreamHandlers {
  onStage?: (e: GenerationStageEvent) => void;
  onBlock?: (e: GenerationBlockEvent) => void;
  onBlocks?: (e: GenerationBlocksEvent) => void;
  onRestart?: (e: GenerationRestartEvent) => void;
  onReceipt?: (r: GenerationReceipt) => void;
}

// ── Typed error ──────────────────────────────────────────────────────────────

export type GenerationStreamErrorKind =
  /** Server refused streaming with a plain JSON error (401/403/429/400…). */
  | "http"
  /** Terminal `error` SSE event mid-stream. */
  | "server"
  /** Network/parse failure (connection dropped, stream ended without result). */
  | "transport"
  /** The caller's AbortSignal fired. */
  | "aborted";

export class GenerationStreamError extends Error {
  readonly kind: GenerationStreamErrorKind;
  readonly status?: number;
  /** True when at least one `stage` event arrived before the failure — the
   *  caller uses this to decide between a silent non-streaming fallback
   *  (nothing was shown yet) and a visible mid-stream error state. */
  readonly receivedStage: boolean;

  constructor(
    message: string,
    opts: { kind: GenerationStreamErrorKind; status?: number; receivedStage?: boolean },
  ) {
    super(message);
    this.name = "GenerationStreamError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.receivedStage = opts.receivedStage ?? false;
  }
}

// ── SSE frame parser ─────────────────────────────────────────────────────────

/**
 * Incremental SSE parser. Feed raw text via `push()` (any chunking — frames
 * may split mid-line or mid-frame); each completed frame fires the callback
 * with the event name (default "message") and the joined data payload.
 * Comment lines (`:`-prefixed) and `retry:`/`id:`/unknown fields are ignored.
 * Tolerates CRLF line endings. Call `flush()` at end-of-stream to process a
 * final unterminated line / undispatched frame (lenient — real servers end
 * with a blank line, but a truncated stream shouldn't drop a whole frame).
 */
export class SseParser {
  private buffer = "";
  private eventName = "";
  private dataLines: string[] = [];

  constructor(private readonly onFrame: (eventName: string, data: string) => void) {}

  push(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      let line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      this.processLine(line);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      let line = this.buffer;
      this.buffer = "";
      if (line.endsWith("\r")) line = line.slice(0, -1);
      this.processLine(line);
    }
    this.dispatch();
  }

  private processLine(line: string): void {
    if (line === "") {
      this.dispatch();
      return;
    }
    if (line.startsWith(":")) return; // comment (heartbeats, ": connected")

    let field: string;
    let value: string;
    const colon = line.indexOf(":");
    if (colon === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
    }

    switch (field) {
      case "event":
        this.eventName = value;
        break;
      case "data":
        this.dataLines.push(value);
        break;
      // "retry", "id" and any unknown fields are intentionally ignored.
      default:
        break;
    }
  }

  private dispatch(): void {
    // Per the SSE spec: no data → nothing to dispatch (event name resets).
    if (this.dataLines.length === 0) {
      this.eventName = "";
      return;
    }
    const data = this.dataLines.join("\n");
    const name = this.eventName || "message";
    this.eventName = "";
    this.dataLines = [];
    this.onFrame(name, data);
  }
}

// ── Stream consumer ──────────────────────────────────────────────────────────

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Run a streaming generation. Resolves with the terminal `result` payload
 * (same JSON as the non-streaming endpoint); rejects with a typed
 * `GenerationStreamError`. The caller's AbortSignal cancels the fetch —
 * the backend treats client disconnect as an abort.
 */
export async function streamGeneration<
  TBody = GenerationRequestBody,
  TResult = GenerationResult,
>(
  body: TBody,
  handlers: GenerationStreamHandlers,
  signal?: AbortSignal,
  opts?: {
    /** Streaming endpoint to POST to. Defaults to the marketing page
     *  generator; the sales microsite path passes its own account endpoint.
     *  Must already include `?stream=1`. */
    endpoint?: string;
  },
): Promise<TResult> {
  const endpoint = opts?.endpoint ?? `/api/lp/generate-page?stream=1`;
  let receivedStage = false;
  const fail = (message: string, kind: GenerationStreamErrorKind, status?: number) =>
    new GenerationStreamError(message, { kind, status, receivedStage });

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw fail("Generation cancelled", "aborted");
    throw fail(
      err instanceof Error ? err.message : "Could not reach the server",
      "transport",
    );
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/event-stream")) {
    // Plain JSON error (401/403/429/400…) — same handling as the
    // non-streaming path today.
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw fail(errBody?.error ?? `Generation failed (${res.status})`, "http", res.status);
  }
  if (!res.body) {
    throw fail("Streaming is not supported in this browser", "transport");
  }

  let result: TResult | null = null;
  let serverError: GenerationStreamError | null = null;

  const parser = new SseParser((name, data) => {
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return; // malformed frame — skip rather than kill the stream
    }
    switch (name) {
      case "stage":
        receivedStage = true;
        handlers.onStage?.(payload as GenerationStageEvent);
        break;
      case "block":
        handlers.onBlock?.(payload as GenerationBlockEvent);
        break;
      case "blocks":
        handlers.onBlocks?.(payload as GenerationBlocksEvent);
        break;
      case "restart":
        handlers.onRestart?.(payload as GenerationRestartEvent);
        break;
      case "receipt":
        handlers.onReceipt?.(payload as GenerationReceipt);
        break;
      case "result":
        result = payload as TResult;
        break;
      case "error":
        serverError = fail(
          (payload as { message?: string }).message ?? "Generation failed",
          "server",
        );
        break;
      default:
        break; // "done" + any future events — ignore
    }
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (result !== null || serverError !== null) break; // terminal event seen
    }
    if (result === null && serverError === null) {
      parser.push(decoder.decode());
      parser.flush();
    }
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw fail("Generation cancelled", "aborted");
    throw fail("Connection lost during generation", "transport");
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* stream already closed */
    }
  }

  if (serverError !== null) throw serverError;
  if (result !== null) return result;
  throw fail("The generation stream ended unexpectedly", "transport");
}
