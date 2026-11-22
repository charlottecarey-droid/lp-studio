import { describe, expect, it } from "vitest";
import { filterPractices, kitStatus, wavesOf, type PracticeRow } from "./RoomPractices";

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
