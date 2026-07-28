/**
 * Page-level tenant-logo size. Blocks size their own marks (a nav lockup is
 * bigger than a footer sign-off), so the page control has to SCALE that set
 * rather than pin it to one height — and it has to reach ~32 blocks without
 * any of them being wired for it. The mechanism is the same utility remap
 * cardRadius/cardShadow use, keyed on the `data-brand-logo` marker that only
 * BrandLogo stamps.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, getBrandSurfaceCss } from "./brand-config";
import { PAGE_STYLE_OVERRIDE_KEYS, mergePageStyleOverrides } from "./page-style-overrides";

const css = (logoSize?: "sm" | "md" | "lg" | "xl") =>
  getBrandSurfaceCss({ ...DEFAULT_BRAND, ...(logoSize ? { logoSize } : {}) });

describe("page-level logo size", () => {
  it("emits nothing when unset or at the library's own scale", () => {
    expect(css()).not.toContain("data-brand-logo");
    expect(css("md")).not.toContain("data-brand-logo");
  });

  it("scales proportionally, preserving each block's logo hierarchy", () => {
    const lg = css("lg");
    // h-7 (1.75rem) and h-9 (2.25rem) must stay in the same ratio, both bigger.
    expect(lg).toContain("[data-brand-logo].h-7{height:2.3625rem !important}");
    expect(lg).toContain("[data-brand-logo].h-9{height:3.0375rem !important}");
  });

  it("small shrinks, extra large grows", () => {
    expect(css("sm")).toContain("[data-brand-logo].h-8{height:1.44rem !important}");
    expect(css("xl")).toContain("[data-brand-logo].h-8{height:3.5rem !important}");
  });

  it("is scoped to the page and to the tenant mark only", () => {
    const lg = css("lg");
    for (const rule of lg.split("}").filter((r) => r.includes("data-brand-logo"))) {
      // Never document-wide, and never a bare `img` — a sponsor or partner
      // logo sitting in the same lockup must not be rescaled.
      expect(rule).toContain("[data-lp-page]");
      expect(rule).toContain("[data-brand-logo]");
    }
  });

  it("covers the height utilities logos are actually built with", () => {
    const lg = css("lg");
    for (const step of [6, 7, 8, 9, 11, 12]) {
      expect(lg).toContain(`[data-brand-logo].h-${step}{`);
    }
  });

  it("survives the page-override whitelist (the control writes through it)", () => {
    expect(PAGE_STYLE_OVERRIDE_KEYS).toContain("logoSize");
    expect(mergePageStyleOverrides(DEFAULT_BRAND, { logoSize: "xl" }).logoSize).toBe("xl");
    // Junk is still rejected — the whitelist is the gate, not a passthrough.
    expect(mergePageStyleOverrides(DEFAULT_BRAND, { logoSize: "gigantic" }).logoSize)
      .toBe(DEFAULT_BRAND.logoSize);
  });
});
