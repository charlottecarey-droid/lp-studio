/**
 * Dandy-only supporting-section LAYOUT variability — selector guards.
 *
 * applyDandyLayoutVariability is the sibling of the background pass: several
 * supporting blocks ship with more than one already-designed layout/variant
 * preset (dso-challenges' 4-col/2-col grid, dso-insights-dashboard's
 * light/dark dashboard theme) that is otherwise fixed on every page. This pass
 * picks one deterministically per account so whole Dandy microsites feel even
 * more distinct. These tests pin the contract the task cares about, exercising
 * the exact pure helper the sales route calls (the Dandy gate lives in the
 * route and is covered separately):
 *
 *   1. ALREADY-DESIGNED PRESETS ONLY — a block's layout/variant prop is only
 *      ever set to one of that block's own designed options. Blocks with no
 *      registered layout knob (and the hero) are left untouched.
 *   2. DETERMINISTIC — the same account (seed) always resolves to the same
 *      result, but different accounts spread across more than one combination.
 *   3. ORDER PRESERVED — only the named layout/variant prop changes; block
 *      ids/types/order and every other prop are untouched.
 *   4. INDEPENDENT KNOBS — the two layout knobs vary independently of each
 *      other (they are not perfectly correlated across accounts).
 */
import { describe, expect, it } from "vitest";
import { applyDandyLayoutVariability } from "./generate-microsite";

type Block = Record<string, unknown>;

const CHALLENGES_LAYOUTS = ["4-col", "2-col"];
const DASHBOARD_VARIANTS = ["light", "dark"];

// A representative curated Dandy page: hero + the two layout-bearing supporting
// blocks + sections that have no registered layout knob.
function page(): Block[] {
  return [
    { id: "hero-0", type: "dso-heartland-hero", props: { layout: "full-bleed" } },
    { id: "stat-1", type: "dso-stat-bar", props: { backgroundStyle: "white", stats: [] } },
    { id: "chal-2", type: "dso-challenges", props: { backgroundStyle: "muted", layout: "4-col", challenges: [] } },
    { id: "dash-3", type: "dso-insights-dashboard", props: { backgroundStyle: "muted", dashboardVariant: "light" } },
    { id: "succ-4", type: "dso-success-stories", props: { backgroundStyle: "dandy-green", cases: [] } },
    { id: "cta-5", type: "bottom-cta", props: { backgroundStyle: "dark" } },
  ];
}

function propOf(blocks: Block[], id: string, key: string): unknown {
  return (blocks.find(b => b.id === id)!.props as Block)[key];
}

describe("applyDandyLayoutVariability — already-designed presets only", () => {
  it("only ever assigns a block's own designed layout/variant options", () => {
    for (let i = 0; i < 200; i++) {
      const out = applyDandyLayoutVariability(page(), `acct-${i}:Company ${i}`);
      expect(CHALLENGES_LAYOUTS).toContain(propOf(out, "chal-2", "layout"));
      expect(DASHBOARD_VARIANTS).toContain(propOf(out, "dash-3", "dashboardVariant"));
    }
  });

  it("never touches the hero or blocks without a registered layout knob", () => {
    for (let i = 0; i < 200; i++) {
      const out = applyDandyLayoutVariability(page(), `acct-${i}:Company ${i}`);
      // hero keeps its own layout (varied by the hero pass, not here)
      expect(propOf(out, "hero-0", "layout")).toBe("full-bleed");
      // these blocks have no entry in DANDY_LAYOUT_VARIANTS
      expect((out.find(b => b.id === "stat-1")!.props as Block)).toEqual(
        (page().find(b => b.id === "stat-1")!.props as Block),
      );
      expect((out.find(b => b.id === "succ-4")!.props as Block)).toEqual(
        (page().find(b => b.id === "succ-4")!.props as Block),
      );
      expect((out.find(b => b.id === "cta-5")!.props as Block)).toEqual(
        (page().find(b => b.id === "cta-5")!.props as Block),
      );
    }
  });

  it("leaves a page with no layout-bearing blocks completely unchanged", () => {
    const blocks: Block[] = [
      { id: "a", type: "dso-stat-bar", props: { backgroundStyle: "white" } },
      { id: "b", type: "bottom-cta", props: { backgroundStyle: "dark" } },
    ];
    const out = applyDandyLayoutVariability(blocks, "x:Co");
    expect(out).toEqual(blocks);
  });
});

describe("applyDandyLayoutVariability — determinism", () => {
  it("returns the same result for the same seed across calls", () => {
    const seed = "acct-42:Bright Smiles";
    const a = applyDandyLayoutVariability(page(), seed);
    const b = applyDandyLayoutVariability(page(), seed);
    expect(a).toEqual(b);
  });

  it("produces more than one distinct combination across many accounts", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const out = applyDandyLayoutVariability(page(), `acct-${i}:Company ${i}`);
      seen.add(`${propOf(out, "chal-2", "layout")}|${propOf(out, "dash-3", "dashboardVariant")}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("varies the two layout knobs independently across accounts", () => {
    // If the two knobs were perfectly correlated they'd only ever produce two
    // of the four possible combinations. Independence should surface 3+.
    const combos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const out = applyDandyLayoutVariability(page(), `acct-${i}:Company ${i}`);
      combos.add(`${propOf(out, "chal-2", "layout")}|${propOf(out, "dash-3", "dashboardVariant")}`);
    }
    expect(combos.size).toBeGreaterThan(2);
  });
});

describe("applyDandyLayoutVariability — order + other props preserved", () => {
  it("preserves block order, ids, types and all other props", () => {
    const before = page();
    const out = applyDandyLayoutVariability(before, "keep:Co");
    expect(out.map(b => b.id)).toEqual(before.map(b => b.id));
    expect(out.map(b => b.type)).toEqual(before.map(b => b.type));
    // The challenges array and the dashboard's backgroundStyle are untouched —
    // only the named layout/variant prop varies.
    expect((out.find(b => b.id === "chal-2")!.props as Block).challenges).toEqual([]);
    expect((out.find(b => b.id === "chal-2")!.props as Block).backgroundStyle).toBe("muted");
    expect((out.find(b => b.id === "dash-3")!.props as Block).backgroundStyle).toBe("muted");
  });
});
