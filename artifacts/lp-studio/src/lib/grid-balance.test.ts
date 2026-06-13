import { describe, expect, it } from "vitest";
import { balancedGridItemClasses, planBalancedTracks } from "./grid-balance";

describe("planBalancedTracks", () => {
  it("leaves complete rows alone (6 cards, 3 cols)", () => {
    const plan = planBalancedTracks([1, 1, 1, 1, 1, 1], 3);
    expect(plan).toHaveLength(6);
    for (const p of plan) {
      expect(p.spanTracks).toBe(2);
      expect(p.startTrack).toBeNull();
    }
  });

  it("centers a single orphan (4 cards, 3 cols) — the icon-grid r=1 math", () => {
    const plan = planBalancedTracks([1, 1, 1, 1], 3);
    expect(plan.slice(0, 3).every((p) => p.startTrack === null)).toBe(true);
    // remainder 2 cells → start track 3 of 6 (centered single)
    expect(plan[3]).toEqual({ spanTracks: 2, startTrack: 3 });
  });

  it("centers a trailing pair (5 cards, 3 cols) — the icon-grid r=2 math", () => {
    const plan = planBalancedTracks([1, 1, 1, 1, 1], 3);
    // remainder 1 cell → first of the pair starts one track in; the last
    // item auto-flows beside it.
    expect(plan[3]).toEqual({ spanTracks: 2, startTrack: 2 });
    expect(plan[4]).toEqual({ spanTracks: 2, startTrack: null });
  });

  it("a featured (span-2) card counts as two cells: 1 featured + 4 normal fills 3-col rows", () => {
    const plan = planBalancedTracks([2, 1, 1, 1, 1], 3);
    // row 1: featured(2)+normal(1)=3 ✓; row 2: 3 normals ✓ — nothing to center
    expect(plan.every((p) => p.startTrack === null)).toBe(true);
    expect(plan[0].spanTracks).toBe(4);
  });

  it("centers a lone featured card on the last row (3 normal + featured, 3 cols)", () => {
    const plan = planBalancedTracks([1, 1, 1, 2], 3);
    // last row holds only the featured card (2 cells) → remainder 1 → start 2
    expect(plan[3]).toEqual({ spanTracks: 4, startTrack: 2 });
  });

  it("simulates sparse auto-flow: a featured card that doesn't fit wraps", () => {
    // [1, 1, 2, 1] in 3 cols: featured wraps to row 2 (hole left in row 1),
    // last row = featured + normal = 3 cells → complete, no centering.
    const plan = planBalancedTracks([1, 1, 2, 1], 3);
    expect(plan.every((p) => p.startTrack === null)).toBe(true);
  });

  it("handles wide grids (5 cards, 4 cols → lone orphan starts at track 4)", () => {
    const plan = planBalancedTracks([1, 1, 1, 1, 1], 4);
    expect(plan[4]).toEqual({ spanTracks: 2, startTrack: 4 });
  });

  it("centers a trailing trio in a 4-col grid (7 cards → first of trio starts at track 2)", () => {
    const plan = planBalancedTracks([1, 1, 1, 1, 1, 1, 1], 4);
    expect(plan[4]).toEqual({ spanTracks: 2, startTrack: 2 });
    expect(plan[5].startTrack).toBeNull();
    expect(plan[6].startTrack).toBeNull();
  });

  it("centers an under-filled single row (2 cards, 3 cols)", () => {
    const plan = planBalancedTracks([1, 1], 3);
    expect(plan[0]).toEqual({ spanTracks: 2, startTrack: 2 });
    expect(plan[1]).toEqual({ spanTracks: 2, startTrack: null });
  });

  it("clamps spans to the column count and tolerates empty input", () => {
    expect(planBalancedTracks([], 3)).toEqual([]);
    const plan = planBalancedTracks([5, 1], 2);
    expect(plan[0].spanTracks).toBe(4); // clamped to 2 cells
  });
});

describe("balancedGridItemClasses", () => {
  const TESTIMONIAL_SPECS = [
    { prefix: "md", cols: 2 },
    { prefix: "lg", cols: 3 },
  ] as const;

  it("emits plain spans for a complete 6-card grid", () => {
    const cls = balancedGridItemClasses([1, 1, 1, 1, 1, 1], TESTIMONIAL_SPECS);
    expect(cls).toHaveLength(6);
    for (const c of cls) expect(c).toBe("md:col-span-2");
  });

  it("centers the 4th orphan card at lg and resets nothing below", () => {
    const cls = balancedGridItemClasses([1, 1, 1, 1], TESTIMONIAL_SPECS);
    // md 2-col: 4 cards = complete rows → no md start.
    expect(cls[3]).toContain("lg:col-start-3");
    expect(cls[3]).not.toContain("md:col-start");
  });

  it("resets a lower-breakpoint col-start with col-start-auto above", () => {
    // 3 cards: md 2-col leaves an orphan (centered), lg 3-col is complete —
    // the md start must not leak into the lg grid.
    const cls = balancedGridItemClasses([1, 1, 1], TESTIMONIAL_SPECS);
    expect(cls[2]).toContain("md:col-start-2");
    expect(cls[2]).toContain("lg:col-start-auto");
  });

  it("gives featured cards doubled track spans at every breakpoint", () => {
    const cls = balancedGridItemClasses([2, 1, 1, 1, 1], TESTIMONIAL_SPECS);
    expect(cls[0]).toContain("md:col-span-4");
    // span identical at lg (4 tracks) → cascades, no duplicate class needed
    expect(cls[0]).not.toContain("lg:col-span-4");
    expect(cls[1]).toContain("md:col-span-2");
  });

  it("supports the benefits-grid 5-column setup", () => {
    const specs = [
      { prefix: "sm", cols: 2 },
      { prefix: "md", cols: 3 },
      { prefix: "lg", cols: 5 },
    ] as const;
    const cls = balancedGridItemClasses([1, 1, 1, 1, 1, 1, 1], specs);
    // 7 items: sm orphan centered, md 3-col leaves 1 → centered, lg leaves 2 → centered pair
    expect(cls[6]).toContain("sm:col-start-2");
    expect(cls[6]).toContain("md:col-start-3");
    expect(cls[5]).toContain("lg:col-start-4");
  });
});
