import { describe, expect, it } from "vitest";
import { fmtDwell, pageMineRank } from "./sales-pages";

describe("fmtDwell", () => {
  it("renders a dash for pages without dwell data (never a fake 0)", () => {
    expect(fmtDwell(null)).toBe("—");
  });
  it("formats sub-minute and minute+ values", () => {
    expect(fmtDwell(48)).toBe("48s");
    expect(fmtDwell(60)).toBe("1m 00s");
    expect(fmtDwell(125)).toBe("2m 05s");
  });
});

describe("pageMineRank — the 'my pages first' contract", () => {
  const me = "rep@meetdandy.com";
  it("ranks created < edited < others", () => {
    expect(pageMineRank({ createdBy: "Rep@MeetDandy.com", updatedBy: null }, me)).toBe(0);
    expect(pageMineRank({ createdBy: "other@x.com", updatedBy: me }, me)).toBe(1);
    expect(pageMineRank({ createdBy: "other@x.com", updatedBy: "other@x.com" }, me)).toBe(2);
    expect(pageMineRank({ createdBy: null, updatedBy: null }, me)).toBe(2);
  });
  it("treats an unknown session email as nothing-is-mine", () => {
    expect(pageMineRank({ createdBy: "rep@meetdandy.com", updatedBy: null }, "")).toBe(2);
  });
});
