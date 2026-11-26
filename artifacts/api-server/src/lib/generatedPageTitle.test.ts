import { describe, it, expect } from "vitest";
import { buildGeneratedPageTitle } from "./generatedPageTitle";

const date = new Date("2026-11-26T12:00:00Z");

describe("buildGeneratedPageTitle", () => {
  it("never returns just the account name", () => {
    expect(buildGeneratedPageTitle({ company: "ATX", aiTitle: "ATX", date })).toBe("ATX — Microsite · Nov 26");
    expect(buildGeneratedPageTitle({ company: "ATX", date, objective: "book-meeting" })).toBe("ATX — Book meeting · Nov 26");
  });
  it("prefixes the company to a descriptive AI title", () => {
    expect(buildGeneratedPageTitle({ company: "ATX", aiTitle: "Clinical quality partnership", date })).toBe("ATX — Clinical quality partnership · Nov 26");
  });
  it("keeps an AI title that already names the company, and adds the contact", () => {
    expect(buildGeneratedPageTitle({ company: "ATX", aiTitle: "Dandy x ATX: lab partnership", contactName: "Jane Doe", date })).toBe("Dandy x ATX: lab partnership · for Jane Doe · Nov 26");
  });
});
