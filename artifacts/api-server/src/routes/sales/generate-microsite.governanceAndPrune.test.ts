/**
 * Issue 3b + Issue 4 (sales/microsite path):
 *
 *   • Case-study availability gating + No-AI governance exclusion — a block in
 *     the `exclude` set is ABSENT from every AVAILABLE-BLOCKS guide the model
 *     sees (freeform, DSO-freeform, segment-pool). Blocks NOT excluded stay.
 *   • Empty-block prune — content-bearing blocks (case-study, success-stories,
 *     testimonials, stats, products-grid) with no real content are dropped
 *     post-generation; structural + populated blocks survive; a degenerate
 *     all-empty page is left intact (never blanked).
 *
 * Pure (no DB / no model): we call the exported prompt-guide builders + the
 * prune helper directly.
 */
import { describe, it, expect } from "vitest";
import {
  buildFreeformBlockGuide,
  buildDsoFreeformBlockGuide,
  buildSegmentPoolBlockGuide,
  pruneEmptyContentBlocks,
  blockHasNoRealContent,
} from "./generate-microsite";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";

function bulletTypes(guide: string): string[] {
  return [...guide.matchAll(/^- "([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

const NO_CASE_STUDIES = new Set<string>(
  ["dso-success-stories", "dso-case-study", "case-studies"].map((t) => canonicalizeBlockType(t)),
);

describe("AI vocabulary exclusion (case-study gating + No-AI governance)", () => {
  it("DSO-freeform guide drops case-study blocks when excluded", () => {
    const withCS = bulletTypes(buildDsoFreeformBlockGuide("enterprise", []));
    expect(withCS).toContain("dso-success-stories");
    expect(withCS).toContain("dso-case-study");

    const withoutCS = bulletTypes(buildDsoFreeformBlockGuide("enterprise", [], NO_CASE_STUDIES));
    expect(withoutCS).not.toContain("dso-success-stories");
    expect(withoutCS).not.toContain("dso-case-study");
    // Non-case-study DSO blocks are still offered.
    expect(withoutCS).toContain("dso-heartland-hero");
    expect(withoutCS).toContain("dso-final-cta");
  });

  it("freeform guide drops an excluded (No-AI) block but keeps the rest", () => {
    // `testimonial` is in the neutral freeform vocab; treat it as a No-AI block.
    const exclude = new Set<string>([canonicalizeBlockType("testimonial")]);
    const types = bulletTypes(buildFreeformBlockGuide([], exclude));
    expect(types).not.toContain("testimonial");
    expect(types).toContain("hero");
    expect(types).toContain("bottom-cta");
  });

  it("segment-pool guide drops an excluded approved block (still builder-available)", () => {
    const pool = ["benefits-grid", "dso-success-stories"];
    const types = bulletTypes(buildSegmentPoolBlockGuide(pool, NO_CASE_STUDIES));
    // Excluded from the AI vocabulary even though it's in the approved pool…
    expect(types).not.toContain("dso-success-stories");
    // …but the rest of the pool + structural essentials remain.
    expect(types).toContain("benefits-grid");
    expect(types).toContain("hero");
    expect(types).toContain("footer");
  });

  it("no exclusions: every guide is unchanged (fail-open)", () => {
    expect(bulletTypes(buildFreeformBlockGuide([]))).toContain("testimonial");
    expect(bulletTypes(buildDsoFreeformBlockGuide("practices", []))).toContain("dso-final-cta");
  });
});

describe("empty-block prune (no real content to fill)", () => {
  it("drops a success-stories block with an empty cases array", () => {
    expect(
      blockHasNoRealContent({ type: "dso-success-stories", props: { headline: "Customer wins", cases: [] } }),
    ).toBe(true);
  });

  it("keeps a success-stories block that has real cases", () => {
    expect(
      blockHasNoRealContent({
        type: "dso-success-stories",
        props: { cases: [{ name: "Acme", quote: "It worked", stat: "30%" }] },
      }),
    ).toBe(false);
  });

  it("drops a dso-case-study with only an empty heading + empty section bodies", () => {
    expect(
      blockHasNoRealContent({
        type: "dso-case-study",
        props: {
          headline: "",
          quote: "",
          stats: [],
          results: [],
          challenge: { heading: "The Challenge", body: "" },
          solution: { heading: "The Solution", body: "" },
        },
      }),
    ).toBe(true);
  });

  it("keeps a dso-case-study that carries a real headline", () => {
    expect(
      blockHasNoRealContent({ type: "dso-case-study", props: { headline: "How Acme cut costs 30%", stats: [] } }),
    ).toBe(false);
  });

  it("drops an empty stats band but keeps one with numbers", () => {
    expect(blockHasNoRealContent({ type: "stats", props: { stats: [] } })).toBe(true);
    expect(
      blockHasNoRealContent({ type: "stats", props: { stats: [{ value: "98%", label: "uptime" }] } }),
    ).toBe(false);
  });

  it("never flags a structural block (hero/footer/cta) as empty", () => {
    expect(blockHasNoRealContent({ type: "hero", props: {} })).toBe(false);
    expect(blockHasNoRealContent({ type: "footer", props: {} })).toBe(false);
    expect(blockHasNoRealContent({ type: "bottom-cta", props: {} })).toBe(false);
  });

  it("pruneEmptyContentBlocks removes empty content blocks, keeps the page spine", () => {
    const blocks = [
      { type: "hero", props: { headline: "Hi Acme" } },
      { type: "dso-success-stories", props: { headline: "Wins", cases: [] } }, // empty → drop
      { type: "benefits-grid", props: { items: [{ title: "x" }] } },
      { type: "stats", props: { stats: [] } }, // empty → drop
      { type: "bottom-cta", props: { headline: "Book a demo" } },
      { type: "footer", props: {} },
    ];
    const out = pruneEmptyContentBlocks(blocks);
    expect(out.map((b) => b.type)).toEqual(["hero", "benefits-grid", "bottom-cta", "footer"]);
  });

  it("never empties the page — a degenerate all-empty list is returned intact", () => {
    const blocks = [
      { type: "dso-success-stories", props: { cases: [] } },
      { type: "stats", props: { stats: [] } },
    ];
    const out = pruneEmptyContentBlocks(blocks);
    expect(out).toBe(blocks);
  });
});
