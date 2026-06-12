/**
 * Streaming block parser — live AI page generation (June 2026).
 *
 * Consumes the token stream of a chat completion whose final payload is a
 * JSON object of the shape `{ "title": ..., "slug": ..., "blocks": [ ... ] }`
 * and yields each element of the top-level `blocks` array AS SOON AS it
 * closes, so the generate-page SSE stream can emit `block` events while the
 * model is still writing the rest of the page.
 *
 * Design constraints (see routes/lp/generate-page.ts streaming mode):
 *   • Incremental: `push()` may be called with arbitrarily small chunks —
 *     including chunks that split a token, an escape sequence, or a UTF-16
 *     surrogate-pair'd string anywhere. Yields are identical regardless of
 *     how the same text is chunked.
 *   • String-aware: braces/brackets/colons/commas inside JSON strings (and
 *     escaped quotes inside those strings) never confuse the scanner.
 *   • Fence-tolerant: leading ```/```json fences (and any prose before the
 *     first `{`) are skipped — same convention as the route's existing
 *     `raw.replace(/^```(?:json)?\n?/, ...)` stripping. Anything after the
 *     blocks array closes is ignored.
 *   • Key-order tolerant: the `blocks` key may appear after `title`/`slug`
 *     (or any other top-level keys); a STRING VALUE equal to "blocks" or a
 *     nested `blocks` key inside an element never triggers array capture.
 *   • Never throws: a malformed element (balanced brackets but invalid JSON)
 *     is skipped silently — the downstream full-array `blocks` replacement
 *     events reconcile the client. A truncated tail simply never yields.
 *
 * This parser is intentionally a BEST-EFFORT preview channel: the route still
 * accumulates the complete completion text and runs the existing (unchanged)
 * parse/normalize pipeline on it; nothing downstream consumes these yields
 * except the SSE `block` events.
 */

export interface StreamedBlock {
  /** Zero-based position of the element within the `blocks` array. Indexes
   *  advance even when a malformed element is skipped, so a yielded block's
   *  index always matches its true array position. */
  index: number;
  /** The JSON.parse'd element. */
  block: unknown;
}

type Phase = "seek-object" | "scan" | "done";

export class StreamingBlockParser {
  private phase: Phase = "seek-object";
  /** Brace/bracket depth; the top-level object itself is depth 1. */
  private depth = 0;
  private inString = false;
  private escaped = false;
  /** Accumulates the contents of a string token at depth 1 (keys + scalar
   *  values of the top-level object) so `pendingKey` can be resolved. */
  private stringBuf = "";
  private trackString = false;
  private lastString: string | null = null;
  /** The top-level key whose value is currently being read. */
  private pendingKey: string | null = null;
  private inBlocksArray = false;
  private blocksDone = false;
  /** Text of the element currently being captured (null = between elements). */
  private elementBuf: string | null = null;
  private elementStartedWithBracket = false;
  private nextIndex = 0;

  /** True once the `blocks` array has fully closed (no further yields). */
  get done(): boolean {
    return this.phase === "done";
  }

  /** Feed the next chunk of completion text; returns any elements of the
   *  top-level `blocks` array that completed within this chunk. Never throws. */
  push(chunk: string): StreamedBlock[] {
    const out: StreamedBlock[] = [];
    for (let i = 0; i < chunk.length; i++) {
      this.processChar(chunk[i], out);
      if (this.phase === "done") break;
    }
    return out;
  }

  private beginElement(c: string): void {
    this.elementBuf = c;
    this.elementStartedWithBracket = c === "{" || c === "[";
  }

  private finishElement(out: StreamedBlock[]): void {
    const text = (this.elementBuf ?? "").trim();
    this.elementBuf = null;
    this.elementStartedWithBracket = false;
    if (!text) return;
    const index = this.nextIndex++;
    try {
      out.push({ index, block: JSON.parse(text) });
    } catch {
      // Malformed element — skip silently; the route's full-array `blocks`
      // replacement events reconcile the client after normalization.
    }
  }

  private processChar(c: string, out: StreamedBlock[]): void {
    if (this.phase === "done") return;

    if (this.phase === "seek-object") {
      // Skip code fences / prose until the top-level object opens.
      if (c === "{") {
        this.phase = "scan";
        this.depth = 1;
      }
      return;
    }

    const capturing = this.elementBuf !== null;

    if (this.inString) {
      if (capturing) this.elementBuf! += c;
      if (this.escaped) {
        this.escaped = false;
        if (this.trackString) this.stringBuf += c;
      } else if (c === "\\") {
        this.escaped = true;
        if (this.trackString) this.stringBuf += c;
      } else if (c === '"') {
        this.inString = false;
        if (this.trackString) this.lastString = this.stringBuf;
        this.trackString = false;
      } else if (this.trackString) {
        this.stringBuf += c;
      }
      return;
    }

    switch (c) {
      case '"': {
        this.inString = true;
        this.stringBuf = "";
        // Only depth-1 strings (top-level keys / scalar values) can become a
        // `pendingKey`; everything else is irrelevant to detection.
        this.trackString = !capturing && this.depth === 1;
        if (capturing) {
          this.elementBuf! += c;
        } else if (this.inBlocksArray && this.depth === 2) {
          // A scalar string element of the blocks array begins.
          this.beginElement(c);
        }
        return;
      }
      case ":": {
        if (!capturing && this.depth === 1) this.pendingKey = this.lastString;
        if (capturing) this.elementBuf! += c;
        return;
      }
      case "{":
      case "[": {
        if (!capturing && this.inBlocksArray && this.depth === 2) {
          // An object/array element of the blocks array begins.
          this.beginElement(c);
          this.depth++;
          return;
        }
        if (
          c === "[" &&
          !capturing &&
          !this.inBlocksArray &&
          !this.blocksDone &&
          this.depth === 1 &&
          this.pendingKey === "blocks"
        ) {
          this.inBlocksArray = true;
          this.depth++;
          return;
        }
        if (capturing) this.elementBuf! += c;
        this.depth++;
        return;
      }
      case "}":
      case "]": {
        if (capturing) {
          if (c === "]" && this.depth === 2 && !this.elementStartedWithBracket) {
            // A scalar element terminated by the blocks array closing.
            this.finishElement(out);
            this.depth--;
            this.inBlocksArray = false;
            this.blocksDone = true;
            this.phase = "done";
            return;
          }
          this.depth--;
          this.elementBuf! += c;
          if (this.elementStartedWithBracket && this.depth === 2) {
            // The element's own bracket just closed — yield immediately.
            this.finishElement(out);
          }
          return;
        }
        this.depth--;
        if (c === "]" && this.inBlocksArray && this.depth === 1) {
          this.inBlocksArray = false;
          this.blocksDone = true;
          this.phase = "done";
          return;
        }
        if (this.depth <= 0) this.phase = "done";
        return;
      }
      case ",": {
        if (capturing) {
          if (this.depth === 2 && this.inBlocksArray) {
            // A scalar element terminated by a comma.
            this.finishElement(out);
          } else {
            this.elementBuf! += c;
          }
        }
        return;
      }
      default: {
        if (capturing) {
          this.elementBuf! += c;
          return;
        }
        if (this.inBlocksArray && this.depth === 2 && !/\s/.test(c)) {
          // A bare scalar element (number / true / false / null) begins.
          this.beginElement(c);
        }
        return;
      }
    }
  }
}
