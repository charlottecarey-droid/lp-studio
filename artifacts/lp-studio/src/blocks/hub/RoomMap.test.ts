import { describe, expect, it } from "vitest";
import { fanOut, fitMap, mapGroups, mapMark, MAP_GROUP_COLORS, MAP_OTHER_COLOR } from "./RoomMap";
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
});
