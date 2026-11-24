import { describe, expect, it } from "vitest";
import { alignLeadRow } from "./sheet-rows";

const fixed: [string, string, string, string] = ["t", "Page", "slug", ""];
describe("alignLeadRow", () => {
  it("writes a header for an empty tab", () => {
    const r = alignLeadRow(null, fixed, { Gift: "A", "First name": "Bo", _hidden: "x" });
    expect(r.header).toEqual(["Timestamp", "Page", "Slug", "Variant", "Gift", "First name"]);
    expect(r.row).toEqual(["t", "Page", "slug", "", "A", "Bo"]);
    expect(r.headerChanged).toBe(true);
  });
  it("keeps values under their own columns when a form adds Size", () => {
    const header = ["Timestamp", "Page", "Slug", "Variant", "Gift", "First name", "Email"];
    const r = alignLeadRow(header, fixed, { Gift: "Jacket", Size: "L", "First name": "Bo", Email: "b@x.com" });
    expect(r.header).toEqual([...header, "Size"]);
    expect(r.row).toEqual(["t", "Page", "slug", "", "Jacket", "Bo", "b@x.com", "L"]);
    expect(r.headerChanged).toBe(true);
  });
  it("leaves blank cells for columns a form doesn't have and doesn't touch the header", () => {
    const header = ["Timestamp", "Page", "Slug", "Variant", "Gift", "Size", "Email"];
    const r = alignLeadRow(header, fixed, { Gift: "Mug", Email: "b@x.com" });
    expect(r.row).toEqual(["t", "Page", "slug", "", "Mug", "", "b@x.com"]);
    expect(r.headerChanged).toBe(false);
  });
});
