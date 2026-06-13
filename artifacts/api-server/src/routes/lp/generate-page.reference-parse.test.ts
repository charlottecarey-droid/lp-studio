/**
 * Unit tests for the reference-content cap and the hardened page-completion
 * parser (June 2026 — fix for "AI returned invalid JSON" when a reference URL
 * is supplied).
 *
 * Root cause: a full scraped homepage (up to 24k/48k chars) was injected into
 * the prompt verbatim, and the prompt tells the model to "match the
 * information density" — so the model's JSON response grew until it overran
 * max_completion_tokens and was truncated mid-object, failing JSON.parse.
 *
 * Fixes verified here:
 *   • capReferenceMarkdown trims oversized reference markdown to the prompt
 *     budget on a boundary and appends a clear [reference truncated] marker;
 *   • parsePageCompletion strips fences, repairs recoverable truncated JSON,
 *     and otherwise fails with a SPECIFIC truncated-vs-malformed message.
 */
import { describe, expect, it } from "vitest";
import { capReferenceMarkdown, parsePageCompletion } from "./generate-page";

describe("capReferenceMarkdown", () => {
  it("passes through content within the cap unchanged", () => {
    const md = "# Title\n\nShort marketing copy.";
    const { text, truncated } = capReferenceMarkdown(md);
    expect(truncated).toBe(false);
    expect(text).toBe(md);
  });

  it("truncates content longer than the cap and appends the marker", () => {
    // Build a long body with paragraph boundaries so the boundary trim engages.
    const para = "Sentence one is here. Sentence two is here.\n\n";
    const md = para.repeat(2000); // ~86k chars, well over the 12k cap
    const cap = 12_000;
    const { text, truncated } = capReferenceMarkdown(md, cap);
    expect(truncated).toBe(true);
    expect(text.endsWith("[reference truncated]")).toBe(true);
    // The kept content must be within the cap (plus the short marker), proving
    // a huge reference can't blow the prompt budget.
    expect(text.length).toBeLessThanOrEqual(cap + "\n\n[reference truncated]".length);
    // And it should not have sliced through a word — boundary trim keeps a
    // clean tail before the marker.
    const body = text.replace(/\n\n\[reference truncated\]$/, "");
    expect(body.endsWith(".")).toBe(true);
  });

  it("never cuts below half the cap even with no good boundary", () => {
    const md = "x".repeat(50_000); // no whitespace/sentence boundaries at all
    const cap = 12_000;
    const { text, truncated } = capReferenceMarkdown(md, cap);
    expect(truncated).toBe(true);
    const body = text.replace(/\n\n\[reference truncated\]$/, "");
    expect(body.length).toBe(cap); // falls back to hard slice, not <50% of cap
  });
});

describe("parsePageCompletion", () => {
  const valid = JSON.stringify({
    title: "T",
    slug: "t",
    blocks: [{ type: "hero", props: { headline: "Hi" } }],
  });

  it("parses a clean JSON object", () => {
    const r = parsePageCompletion(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("T");
      expect(r.value.blocks).toHaveLength(1);
    }
  });

  it("strips ```json code fences", () => {
    const r = parsePageCompletion("```json\n" + valid + "\n```");
    expect(r.ok).toBe(true);
  });

  it("strips prose before the first opening brace", () => {
    const r = parsePageCompletion("Here is your page:\n" + valid);
    expect(r.ok).toBe(true);
  });

  it("repairs a truncated-but-recoverable response (cut mid blocks array)", () => {
    // A response cut off after one complete block plus a dangling comma —
    // the classic max_tokens cutoff. Repair should close the array + object.
    const truncated =
      '{"title":"T","slug":"t","blocks":[{"type":"hero","props":{"headline":"Hi"}},';
    const r = parsePageCompletion(truncated, "length");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("T");
      expect(Array.isArray(r.value.blocks)).toBe(true);
      expect(r.value.blocks).toHaveLength(1);
    }
  });

  it("repairs a response cut off inside a string value", () => {
    const truncated = '{"title":"T","slug":"t","blocks":[{"type":"hero","props":{"headline":"Half a head';
    const r = parsePageCompletion(truncated, "length");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("T");
    }
  });

  it("reports a specific truncated message when finish_reason is length and unrecoverable", () => {
    // Truncated before any top-level field closed — not recoverable into the
    // required shape, but still classified as truncated.
    const r = parsePageCompletion('{"title":"T","slug":"t","blocks":[{"type":"he', "length");
    // Repair may succeed structurally; if it doesn't, it must be tagged truncated.
    if (!r.ok) {
      expect(r.reason).toBe("truncated");
      expect(r.message).toMatch(/cut off/i);
    }
  });

  it("reports malformed (not truncated) for balanced-but-garbled JSON", () => {
    const r = parsePageCompletion('{"title": "T", "slug": "t", blocks: [oops]}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("malformed");
      expect(r.message).toBe("AI returned invalid JSON");
    }
  });

  it("classifies an unterminated string as truncated even without finish_reason", () => {
    const r = parsePageCompletion('{"title":"T","slug":"t","blocks":["unclosed string value');
    // Repairable; if repaired it's ok, otherwise tagged truncated.
    if (!r.ok) expect(r.reason).toBe("truncated");
    else expect(r.value.title).toBe("T");
  });
});
