import { describe, expect, it } from "vitest";
import { sparkPoints, tileCount, trendDelta } from "./RoomScorecard";

const byStage = { not_started: 10, scheduling: 4, training_booked: 3, trained: 5, live: 8 };

describe("scorecard numbers", () => {
  it("counts each tile; trained includes live, open is everything before trained", () => {
    expect(tileCount(byStage, 30, "all")).toBe(30);
    expect(tileCount(byStage, 30, "live")).toBe(8);
    expect(tileCount(byStage, 30, "trained")).toBe(13);
    expect(tileCount(byStage, 30, "open")).toBe(17);
    expect(tileCount({}, 0, "scheduling")).toBe(0);
  });

  it("compares with a point at least a week old, and says nothing without one", () => {
    const trend = [
      { day: "2026-11-01", total: 28, byStage: { live: 3, trained: 4 } },
      { day: "2026-11-08", total: 29, byStage: { live: 5, trained: 5 } },
      { day: "2026-11-15", total: 30, byStage: { live: 6, trained: 5 } },
      { day: "2026-11-16", total: 30, byStage: { live: 8, trained: 5 } },
    ];
    expect(trendDelta(trend, "live", 7, "2026-11-16")).toBe(3); // against Nov 8, not yesterday
    expect(trendDelta(trend, "trained", 7, "2026-11-16")).toBe(3);
    expect(trendDelta(trend, "all", 7, "2026-11-16")).toBe(1);
    expect(trendDelta(trend.slice(2), "live", 7, "2026-11-16")).toBeNull();
    expect(trendDelta([], "live")).toBeNull();
  });

  it("draws a line across the width, scaled to the largest value", () => {
    expect(sparkPoints([0, 5, 10], 100, 50)).toBe("0.0,50.0 50.0,25.0 100.0,0.0");
    expect(sparkPoints([5], 100, 50, 10)).toBe("0.0,25.0");
    expect(sparkPoints([], 100, 50)).toBe("");
  });
});
