/**
 * Dandy-only supporting-section style variability — selector guards.
 *
 * applyDandySupportingVariability is the companion to the hero pass: it varies
 * the SUPPORTING sections' background styling per account so whole generated
 * Dandy microsites feel distinct, not just the hero. These tests pin the
 * contract the task cares about, exercising the exact pure helper the sales
 * route calls (the Dandy gate lives in the route and is covered separately):
 *
 *   1. SAFE PRESETS ONLY — a section's backgroundStyle is only ever swapped
 *      among the three interchangeable LIGHT NEUTRAL presets
 *      (white / light-gray / muted). Dark/accent sections (dark, dandy-green,
 *      black, gradient) and the hero are left untouched.
 *   2. DETERMINISTIC — the same account (seed) always resolves to the same
 *      result, but different accounts spread across more than one scheme.
 *   3. ORDER PRESERVED — only backgroundStyle changes; block ids/types/order
 *      and every other prop are untouched.
 *   4. RHYTHM — consecutive light sections never share the same background.
 */
import { describe, expect, it } from "vitest";
import { applyDandySupportingVariability } from "./generate-microsite";

type Block = Record<string, unknown>;

const LIGHT_NEUTRALS = ["white", "light-gray", "muted"];
const ACCENT_BGS = ["dark", "dandy-green", "black", "gradient"];

// A representative curated Dandy page: hero + a mix of light + accent sections.
function page(): Block[] {
  return [
    { id: "hero-0", type: "dso-heartland-hero", props: { layout: "full-bleed" } },
    { id: "stat-1", type: "dso-stat-bar", props: { backgroundStyle: "white", stats: [] } },
    { id: "chal-2", type: "dso-challenges", props: { backgroundStyle: "muted", challenges: [] } },
    { id: "dash-3", type: "dso-insights-dashboard", props: { backgroundStyle: "muted" } },
    { id: "succ-4", type: "dso-success-stories", props: { backgroundStyle: "dandy-green", cases: [] } },
    { id: "cta-5", type: "bottom-cta", props: { backgroundStyle: "dark" } },
  ];
}

function bgOf(blocks: Block[], id: string): unknown {
  return (blocks.find(b => b.id === id)!.props as Block).backgroundStyle;
}

describe("applyDandySupportingVariability — safe presets only", () => {
  it("only ever assigns light-neutral backgrounds to the light sections", () => {
    for (let i = 0; i < 200; i++) {
      const out = applyDandySupportingVariability(page(), `acct-${i}:Company ${i}`);
      for (const id of ["stat-1", "chal-2", "dash-3"]) {
        expect(LIGHT_NEUTRALS).toContain(bgOf(out, id));
      }
    }
  });

  it("never touches the hero or accent/dark sections", () => {
    for (let i = 0; i < 200; i++) {
      const out = applyDandySupportingVariability(page(), `acct-${i}:Company ${i}`);
      expect((out.find(b => b.id === "hero-0")!.props as Block).layout).toBe("full-bleed");
      expect((out.find(b => b.id === "hero-0")!.props as Block).backgroundStyle).toBeUndefined();
      expect(bgOf(out, "succ-4")).toBe("dandy-green");
      expect(bgOf(out, "cta-5")).toBe("dark");
    }
  });

  it("leaves an accent-only page completely unchanged", () => {
    const blocks: Block[] = ACCENT_BGS.map((bg, i) => ({
      id: `b-${i}`,
      type: "dso-stat-bar",
      props: { backgroundStyle: bg },
    }));
    const out = applyDandySupportingVariability(blocks, "x:Co");
    expect(out).toEqual(blocks);
  });
});

describe("applyDandySupportingVariability — determinism", () => {
  it("returns the same result for the same seed across calls", () => {
    const seed = "acct-42:Bright Smiles";
    const a = applyDandySupportingVariability(page(), seed);
    const b = applyDandySupportingVariability(page(), seed);
    expect(a).toEqual(b);
  });

  it("produces more than one distinct scheme across many accounts", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const out = applyDandySupportingVariability(page(), `acct-${i}:Company ${i}`);
      seen.add(["stat-1", "chal-2", "dash-3"].map(id => bgOf(out, id)).join(","));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("applyDandySupportingVariability — order + rhythm", () => {
  it("preserves block order, ids, types and all other props", () => {
    const before = page();
    const out = applyDandySupportingVariability(before, "keep:Co");
    expect(out.map(b => b.id)).toEqual(before.map(b => b.id));
    expect(out.map(b => b.type)).toEqual(before.map(b => b.type));
    // The stats array on the stat-bar is untouched (only backgroundStyle varies).
    expect((out.find(b => b.id === "stat-1")!.props as Block).stats).toEqual([]);
  });

  it("gives consecutive light sections distinct backgrounds (visual rhythm)", () => {
    // stat-1, chal-2, dash-3 are three consecutive light sections.
    for (let i = 0; i < 200; i++) {
      const out = applyDandySupportingVariability(page(), `acct-${i}:Company ${i}`);
      const seq = ["stat-1", "chal-2", "dash-3"].map(id => bgOf(out, id));
      expect(seq[0]).not.toBe(seq[1]);
      expect(seq[1]).not.toBe(seq[2]);
    }
  });
});
