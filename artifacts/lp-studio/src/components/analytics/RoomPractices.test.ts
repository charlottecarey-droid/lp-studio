import { describe, expect, it } from "vitest";
import { filterPractices, kitStatus, pageOf, waveChoices, wavesOf, type PracticeRow } from "./RoomPractices";

const row = (id: number, over: Partial<PracticeRow>): PracticeRow => ({ id, name: `Practice ${id}`, region: null, city: null, state: null, wave: null, stage: "not_started", trainingDate: null, liveDate: null, hasAddress: true, kitSentAt: null, ...over });
const rows = [row(1, { name: "Mesa Dental", wave: "1", city: "Mesa", stage: "live" }), row(2, { name: "Tempe Smiles", wave: "2", region: "Southwest" }), row(3, { name: "Chandler Family", wave: "10" }), row(4, { name: "No Wave Dental" })];

describe("the rep's practice list", () => {
  it("lists waves the way a person counts them", () => {
    expect(wavesOf(rows)).toEqual(["1", "2", "10"]);
  });
  it("filters by wave, stage and a search across name, city and region", () => {
    expect(filterPractices(rows, { q: "", wave: "1", stage: "" }).map((r) => r.id)).toEqual([1]);
    expect(filterPractices(rows, { q: "", wave: "none", stage: "" }).map((r) => r.id)).toEqual([4]);
    expect(filterPractices(rows, { q: "southwest", wave: "", stage: "" }).map((r) => r.id)).toEqual([2]);
    expect(filterPractices(rows, { q: "mesa", wave: "", stage: "live" }).map((r) => r.id)).toEqual([1]);
    expect(filterPractices(rows, { q: "", wave: "", stage: "" })).toHaveLength(4);
  });
  it("says where each practice stands on its welcome kit", () => {
    expect(kitStatus({ kitSentAt: null, hasAddress: true })).toBe("Not sent");
    expect(kitStatus({ kitSentAt: null, hasAddress: false })).toBe("No address");
    expect(kitStatus({ kitSentAt: "2026-11-03T12:00:00Z", hasAddress: true })).toMatch(/^Sent Nov 3$/);
  });
});

describe("pages of practices", () => {
  const list = Array.from({ length: 60 }, (_, i) => i + 1);
  it("shows 25 at a time and says which", () => {
    expect(pageOf(list, 0, 25)).toMatchObject({ page: 0, pages: 3, from: 1, to: 25 });
    expect(pageOf(list, 2, 25)).toMatchObject({ page: 2, from: 51, to: 60 });
    expect(pageOf(list, 2, 25).rows).toHaveLength(10);
    expect(pageOf(list, 0, 100)).toMatchObject({ pages: 1, to: 60 });
  });
  it("falls back to the last page when a filter shortens the list", () => {
    expect(pageOf(list.slice(0, 30), 5, 25)).toMatchObject({ page: 1, from: 26, to: 30 });
    expect(pageOf([], 3, 25)).toMatchObject({ page: 0, pages: 1, from: 0, to: 0 });
  });
});

describe("waves a practice can be moved to", () => {
  it("offers the hub's waves by name, then any other the list already uses", () => {
    expect(waveChoices([{ key: "1", name: "Wave 1" }, { key: "2", name: "Texas" }], ["1", "7", "Pilot"])).toEqual([{ value: "1", label: "Wave 1" }, { value: "2", label: "Texas" }, { value: "7", label: "Wave 7" }, { value: "Pilot", label: "Pilot" }]);
  });
});
