import { describe, expect, it } from "vitest";
import { pageKind } from "./page-kind";

describe("pageKind", () => {
  it("a page with the hub block is a Partner Hub", () => {
    expect(pageKind([{ type: "hero" }, { type: "room-workspace" }])).toBe("hub");
  });
  it("a practice sign-up page is a microsite", () => {
    expect(pageKind([{ type: "dso-practice-hero" }, { type: "dso-final-cta" }])).toBe("microsite");
    expect(pageKind([{ type: "dso-heartland-hero" }])).toBe("microsite");
  });
  it("anything else is an ordinary page (a DSO closing CTA alone doesn't make a microsite)", () => {
    expect(pageKind([{ type: "hero" }, { type: "dso-final-cta" }])).toBe("page");
    expect(pageKind(null)).toBe("page");
  });
});
