/**
 * StreamingBlockParser — chunk-boundary property tests + edge-case fixtures.
 *
 * The riskiest property of the parser is chunking invariance: the SSE stream
 * delivers the SAME completion text split at arbitrary token boundaries, and
 * the yields must be identical no matter where the splits land. Each fixture
 * below is therefore re-parsed (a) whole, (b) split into two chunks at EVERY
 * possible boundary, and (c) sliced into fixed chunk sizes 1..7 — all runs
 * must yield exactly the same blocks at the same indexes.
 */
import { describe, expect, it } from "vitest";
import { StreamingBlockParser, type StreamedBlock } from "./streamingBlockParser";

function parseAll(chunks: string[]): StreamedBlock[] {
  const p = new StreamingBlockParser();
  const out: StreamedBlock[] = [];
  for (const c of chunks) out.push(...p.push(c));
  return out;
}

/** Assert chunking invariance: every 2-way split and every fixed chunk size
 *  yields the same result as a single whole-string push. */
function assertChunkInvariant(payload: string): StreamedBlock[] {
  const baseline = parseAll([payload]);
  // Every possible 2-chunk split.
  for (let i = 1; i < payload.length; i++) {
    const got = parseAll([payload.slice(0, i), payload.slice(i)]);
    expect(got, `2-way split at ${i}`).toEqual(baseline);
  }
  // Fixed chunk sizes (1 = char-at-a-time, the worst case).
  for (const size of [1, 2, 3, 4, 5, 6, 7]) {
    const chunks: string[] = [];
    for (let i = 0; i < payload.length; i += size) chunks.push(payload.slice(i, i + size));
    const got = parseAll(chunks);
    expect(got, `chunk size ${size}`).toEqual(baseline);
  }
  return baseline;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Typical model output: fenced, title/slug before blocks, nested objects and
 *  arrays, strings full of braces/brackets/colons/escaped quotes. */
const FENCED_NESTED = [
  "```json",
  `{`,
  `  "title": "Building Blocks {for} [Growth]",`,
  `  "slug": "building-blocks",`,
  `  "blocks": [`,
  `    {`,
  `      "id": "block-hero-0",`,
  `      "type": "hero",`,
  `      "props": {`,
  `        "headline": "Say \\"hello\\" to {curly} and [square] worlds: now",`,
  `        "nested": { "deep": { "deeper": [1, 2, { "x": "y[z]{w}" }] } },`,
  `        "escape": "back\\\\slash and \\"quote\\" and \\u00e9"`,
  `      }`,
  `    },`,
  `    {`,
  `      "id": "block-stats-1",`,
  `      "type": "stats",`,
  `      "props": { "items": [ { "label": "a,b", "value": "1]" }, { "label": "c:d", "value": "{2" } ] }`,
  `    },`,
  `    { "id": "block-footer-2", "type": "footer", "props": {} }`,
  `  ]`,
  `}`,
  "```",
].join("\n");

/** Decoys: a top-level string VALUE equal to "blocks", a nested "blocks" key
 *  inside an element, and the real blocks key appearing LAST. */
const DECOYS = `{
  "title": "blocks",
  "meta": { "blocks": [ "this is NOT the top-level array" ] },
  "slug": "decoy-page",
  "blocks": [
    { "type": "hero", "props": { "note": "the word blocks appears: \\"blocks\\": [" } },
    { "type": "cta", "props": { "blocks": { "inner": [3, 4] } } }
  ],
  "after": "trailing keys are ignored"
}`;

/** No fences, tight whitespace, unicode escapes + surrogate pairs (emoji). */
const COMPACT = `{"title":"T","slug":"s","blocks":[{"type":"a","props":{"t":"\\ud83d\\ude00 ok 😀"}},{"type":"b"}]}`;

describe("StreamingBlockParser", () => {
  it("yields each block of a fenced, nested payload — chunk-invariant", () => {
    const blocks = assertChunkInvariant(FENCED_NESTED);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.index)).toEqual([0, 1, 2]);
    expect((blocks[0].block as { id: string }).id).toBe("block-hero-0");
    expect(
      (blocks[0].block as { props: { headline: string } }).props.headline,
    ).toBe('Say "hello" to {curly} and [square] worlds: now');
    expect(
      (blocks[1].block as { props: { items: unknown[] } }).props.items,
    ).toHaveLength(2);
    expect((blocks[2].block as { type: string }).type).toBe("footer");
  });

  it("ignores decoy 'blocks' strings/keys and finds the real array — chunk-invariant", () => {
    const blocks = assertChunkInvariant(DECOYS);
    expect(blocks).toHaveLength(2);
    expect((blocks[0].block as { type: string }).type).toBe("hero");
    expect((blocks[1].block as { type: string }).type).toBe("cta");
    expect(
      ((blocks[1].block as { props: { blocks: { inner: number[] } } }).props.blocks.inner),
    ).toEqual([3, 4]);
  });

  it("handles compact payloads with unicode escapes — chunk-invariant", () => {
    const blocks = assertChunkInvariant(COMPACT);
    expect(blocks).toHaveLength(2);
    expect((blocks[0].block as { props: { t: string } }).props.t).toBe("\u{1F600} ok \u{1F600}");
  });

  it("yields an object element as soon as its closing brace arrives", () => {
    const p = new StreamingBlockParser();
    expect(p.push(`{"blocks":[{"type":"hero"`)).toEqual([]);
    // The closing brace alone completes the element — no comma needed yet.
    const got = p.push(`}`);
    expect(got).toEqual([{ index: 0, block: { type: "hero" } }]);
  });

  it("skips a malformed (but bracket-balanced) element silently and keeps indexes positional", () => {
    const p = new StreamingBlockParser();
    const got = p.push(`{"blocks":[{bad json},{"type":"ok"}]}`);
    expect(got).toEqual([{ index: 1, block: { type: "ok" } }]);
  });

  it("never throws on a truncated tail and yields only completed elements", () => {
    const p = new StreamingBlockParser();
    const got = p.push(`{"title":"t","blocks":[{"type":"a"},{"type":"b","props":{"x":`);
    expect(got).toEqual([{ index: 0, block: { type: "a" } }]);
    // Stream dies mid-element: nothing more, no throw.
    expect(p.push("")).toEqual([]);
    expect(p.done).toBe(false);
  });

  it("handles an empty blocks array", () => {
    const p = new StreamingBlockParser();
    expect(p.push(`{"title":"t","slug":"s","blocks":[]}`)).toEqual([]);
    expect(p.done).toBe(true);
  });

  it("tolerates scalar elements (strings/numbers) in the array", () => {
    const got = assertChunkInvariant(`{"blocks":[1,"two,with]chars",{"type":"c"},true]}`);
    expect(got).toEqual([
      { index: 0, block: 1 },
      { index: 1, block: "two,with]chars" },
      { index: 2, block: { type: "c" } },
      { index: 3, block: true },
    ]);
  });

  it("stops yielding after the blocks array closes (trailing fence/garbage ignored)", () => {
    const p = new StreamingBlockParser();
    const got = p.push(`{"blocks":[{"type":"a"}]} , {"blocks":[{"type":"NOT"}]} \n\`\`\``);
    expect(got).toEqual([{ index: 0, block: { type: "a" } }]);
    expect(p.done).toBe(true);
    expect(p.push(`{"blocks":[{"type":"NOT2"}]}`)).toEqual([]);
  });

  it("does not treat a 'blocks' key nested in another top-level object value as the array", () => {
    const p = new StreamingBlockParser();
    const got = p.push(
      `{"layout":{"blocks":["nope"]},"blocks":[{"type":"real"}]}`,
    );
    expect(got).toEqual([{ index: 0, block: { type: "real" } }]);
  });
});
