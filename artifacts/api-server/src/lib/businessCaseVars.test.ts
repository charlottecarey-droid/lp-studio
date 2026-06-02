import { describe, it, expect } from "vitest";
import { deriveCompanyName, derivePracticeCount } from "./businessCaseVars";

describe("deriveCompanyName", () => {
  it("prefers displayName over name", () => {
    expect(deriveCompanyName({ displayName: "Heartland Dental", name: "heartland" })).toBe("Heartland Dental");
  });
  it("falls back to name when displayName is missing", () => {
    expect(deriveCompanyName({ displayName: null, name: "Acme" })).toBe("Acme");
  });
  it("trims whitespace and handles null account", () => {
    expect(deriveCompanyName({ displayName: "  Spaced  " })).toBe("Spaced");
    expect(deriveCompanyName(null)).toBe("");
  });
});

describe("derivePracticeCount", () => {
  it("uses briefing locationCount first (mirrors generation-time bake)", () => {
    expect(derivePracticeCount({ sizeAndLocations: { locationCount: "200+" } }, { numLocations: 12 })).toBe("200+");
  });
  it("falls back to account numLocations when briefing has no count", () => {
    expect(derivePracticeCount(undefined, { numLocations: 12 })).toBe("12");
    expect(derivePracticeCount({ sizeAndLocations: { locationCount: "" } }, { numLocations: 12 })).toBe("12");
  });
  it("falls back to 'multiple' when neither source has a value", () => {
    expect(derivePracticeCount(undefined, null)).toBe("multiple");
    expect(derivePracticeCount({ sizeAndLocations: {} }, {})).toBe("multiple");
  });
});
