import { describe, expect, it } from "vitest";
import { canSitBeside, insertOverviewUnit, moveOverviewUnit, overviewRows, placeOverviewUnit, resolveOverviewOrder } from "./roomOverviewLayout";

const extras = [
  { key: "note", position: "top" as const },
  { key: "video", position: "top" as const },
  { key: "links" }, // bottom by default
];

describe("Overview order", () => {
  it("with nothing saved: the team's top sections, the built-ins in their usual order, then the bottom ones (the old layout)", () => {
    expect(resolveOverviewOrder(extras, undefined)).toEqual(["note", "video", "progress", "steps", "orders", "feed", "links"]);
    expect(resolveOverviewOrder([], [])).toEqual(["progress", "steps", "orders", "feed"]);
  });

  it("keeps a saved order, drops keys that no longer exist and duplicates", () => {
    expect(resolveOverviewOrder(extras, ["links", "steps", "gone", "steps", "progress", "note", "video", "orders", "feed"])).toEqual(["links", "steps", "progress", "note", "video", "orders", "feed"]);
  });

  it("puts a unit missing from the saved order back where it usually goes", () => {
    // A note added after the order was saved follows the unit it comes after in the usual order (the video).
    expect(resolveOverviewOrder([...extras, { key: "note2", position: "top" }], ["video", "note", "progress", "steps", "orders", "feed", "links"])).toEqual(["video", "note2", "note", "progress", "steps", "orders", "feed", "links"]);
    // A built-in missing from an old saved list follows the unit before it in the usual order.
    expect(resolveOverviewOrder([], ["feed", "progress", "orders"])).toEqual(["feed", "progress", "steps", "orders"]);
  });

  it("moves a unit among the ones showing, skipping hidden ones", () => {
    const order = ["note", "video", "progress", "steps", "orders", "feed", "links"];
    const visible = ["note", "video", "steps", "links"]; // progress, orders and feed not showing
    expect(moveOverviewUnit(order, visible, "links", -1)).toEqual(["note", "video", "progress", "links", "steps", "orders", "feed"]);
    expect(moveOverviewUnit(order, visible, "note", 1)).toEqual(["video", "note", "progress", "steps", "orders", "feed", "links"]);
    // Nowhere to go: unchanged.
    expect(moveOverviewUnit(order, visible, "note", -1)).toBe(order);
  });

  it("drops a dragged unit before or after another, and inserts a new one at a spot", () => {
    const order = ["a", "b", "c", "d"];
    expect(placeOverviewUnit(order, "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
    expect(placeOverviewUnit(order, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
    expect(placeOverviewUnit(order, "a", "a", "after")).toBe(order);
    expect(insertOverviewUnit(order, "new", "c")).toEqual(["a", "b", "new", "c", "d"]);
    expect(insertOverviewUnit(order, "new", null)).toEqual(["a", "b", "c", "d", "new"]);
  });

  it("lays out rows: a 'beside' unit shares the row before it, never three to a row, never with a wide unit", () => {
    expect(canSitBeside("progress")).toBe(false);
    expect(canSitBeside("steps")).toBe(false);
    expect(canSitBeside("note")).toBe(true);
    expect(overviewRows(["note", "links", "video"], ["links"])).toEqual([["note", "links"], ["video"]]);
    expect(overviewRows(["note", "links", "video"], ["links", "video"])).toEqual([["note", "links"], ["video"]]);
    expect(overviewRows(["steps", "links"], ["links"])).toEqual([["steps"], ["links"]]);
    expect(overviewRows(["note", "progress"], ["progress"])).toEqual([["note"], ["progress"]]);
  });
});
