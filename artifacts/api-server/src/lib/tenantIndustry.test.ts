import { describe, expect, it } from "vitest";
import { getIndustryImageKeywords } from "./tenantIndustry";

describe("getIndustryImageKeywords", () => {
  it("returns dental topic keywords for the dental industry", () => {
    const kw = getIndustryImageKeywords("dental");
    expect(kw.length).toBeGreaterThan(0);
    expect(kw).toContain("dental");
    expect(kw).toContain("dentures");
  });

  it("returns no keywords for the generic industry (prompt is the only signal)", () => {
    expect(getIndustryImageKeywords("generic")).toEqual([]);
  });
});
