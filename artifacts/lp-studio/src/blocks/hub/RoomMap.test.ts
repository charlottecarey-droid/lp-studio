import { describe, expect, it } from "vitest";
import { fanOut, fitMap, mapGroups, mapMark, MAP_GROUP_COLORS, MAP_OTHER_COLOR, stateBox, zoomToBox } from "./RoomMap";
import type { RoomMapPoint } from "./room-client";

const point = (over: Partial<RoomMapPoint>): RoomMapPoint => ({ id: 1, name: "Office", stage: "not_started", region: "NC", city: null, state: "NC", zip: null, address: null, regionalManager: null, officeType: null, phone: null, scannerCount: null, lat: 35, lng: -80, ...over });

describe("hub map", () => {
  it("draws a location by how far along it is", () => {
    expect(mapMark("live")).toBe("live");
    expect(mapMark("trained")).toBe("live");
    expect(mapMark("training_booked")).toBe("progress");
    expect(mapMark("scheduling")).toBe("progress");
    expect(mapMark("not_started")).toBe("open");
    expect(mapMark("something else")).toBe("open");
  });

  it("colours by regional manager, largest first, and counts who is live", () => {
    const { by, groups, of } = mapGroups([
      point({ id: 1, regionalManager: "Hollie", stage: "live" }),
      point({ id: 2, regionalManager: "Hollie" }),
      point({ id: 3, regionalManager: "Alease", stage: "live" }),
      point({ id: 4, regionalManager: " " }),
    ]);
    expect(by).toBe("manager");
    expect(groups).toEqual([
      { name: "Hollie", color: MAP_GROUP_COLORS[0], total: 2, live: 1 },
      { name: "Alease", color: MAP_GROUP_COLORS[1], total: 1, live: 1 },
      { name: "Unassigned", color: MAP_OTHER_COLOR, total: 1, live: 0 },
    ]);
    expect(of(point({ regionalManager: "Hollie" }))).toBe("Hollie");
    expect(of(point({ regionalManager: null }))).toBe("Unassigned");
  });

  it("falls back to regions when no location has a manager, and folds a ninth group into Other", () => {
    const states = ["AZ", "CA", "CO", "ID", "NM", "NV", "OR", "UT", "WA", "WY"];
    const { by, groups, of } = mapGroups(states.flatMap((s, i) => Array.from({ length: states.length - i }, (_, n) => point({ id: i * 100 + n, region: s }))));
    expect(by).toBe("region");
    expect(groups.map((g) => g.name)).toEqual([...states.slice(0, 8), "Other"]);
    expect(groups[8]).toMatchObject({ color: MAP_OTHER_COLOR, total: 3 });
    expect(of(point({ region: "WY" }))).toBe("Other");
    expect(new Set(groups.slice(0, 8).map((g) => g.color)).size).toBe(8);
  });

  it("fits every pin inside the drawing, north at the top and east to the right", () => {
    const pts = [{ lat: 36.2, lng: -81.7 }, { lat: 34.0, lng: -81.0 }, { lat: 37.3, lng: -79.9 }];
    const fit = fitMap(pts, 760, 500);
    for (const p of pts) {
      expect(fit.x(p.lng)).toBeGreaterThan(0);
      expect(fit.x(p.lng)).toBeLessThan(760);
      expect(fit.y(p.lat)).toBeGreaterThan(0);
      expect(fit.y(p.lat)).toBeLessThan(500);
    }
    expect(fit.y(37.3)).toBeLessThan(fit.y(34.0));
    expect(fit.x(-79.9)).toBeGreaterThan(fit.x(-81.7));
    // One pin sits in the middle with a region around it rather than filling the map.
    const one = fitMap([{ lat: 35, lng: -80 }], 760, 500);
    expect(one.x(-80)).toBeCloseTo(380);
    expect(one.x(-79) - one.x(-80)).toBeLessThan(300);
    // No pins at all still gives a usable map.
    expect(Number.isFinite(fitMap([], 760, 500).x(-100))).toBe(true);
  });

  it("fans out pins that share a spot and leaves the others where they are", () => {
    const out = fanOut([{ x: 100, y: 100, id: "a" }, { x: 100, y: 100, id: "b" }, { x: 300, y: 50, id: "c" }]);
    const by = Object.fromEntries(out.map((p) => [p.id, p]));
    expect(by.c).toMatchObject({ dx: 0, dy: 0 });
    expect(Math.hypot(by.a.dx - by.b.dx, by.a.dy - by.b.dy)).toBeGreaterThan(10);
  });

  it("zooms to fill the drawing with a state, centred, within the zoom limits", () => {
    const v = zoomToBox({ x0: 100, x1: 200, y0: 50, y1: 100 }, 1000, 500);
    expect(v.k).toBeCloseTo(7.6);
    // The middle of the box lands in the middle of the drawing.
    expect(150 * v.k + v.x).toBeCloseTo(500);
    expect(75 * v.k + v.y).toBeCloseTo(250);
    expect(zoomToBox({ x0: 0, x1: 2, y0: 0, y1: 2 }, 1000, 500).k).toBe(12);
    expect(zoomToBox({ x0: 0, x1: 5000, y0: 0, y1: 5000 }, 1000, 500).k).toBe(1);
  });

  it("zooms a state to its offices when it has any, else to its outline", () => {
    const outline = { x0: 0, x1: 600, y0: 0, y1: 300 };
    expect(stateBox(outline, [], 1000, 500)).toEqual(outline);
    expect(stateBox(outline, [{ x: 100, y: 100 }, { x: 400, y: 250 }], 1000, 500)).toEqual({ x0: 100, x1: 400, y0: 100, y1: 250 });
    // One office: a box around it, not a point.
    const one = stateBox(outline, [{ x: 300, y: 150 }], 1000, 500);
    expect(one.x1 - one.x0).toBeCloseTo(1000 / 6);
    expect(one.y1 - one.y0).toBeCloseTo(500 / 6);
    expect((one.x0 + one.x1) / 2).toBeCloseTo(300);
  });
});
