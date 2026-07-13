/**
 * Brand-aware quote cards (July 2026).
 *
 * The quote family (carousel / wall-of-love / with-image) sets its cards on a
 * surface that contrasts with the section. The old auto pick hardcoded slate
 * (#1E293B), so every tenant's quote cards read as generic navy-on-white.
 * resolveQuoteCardBg makes that surface brand-derived:
 *
 *   light section → dark brand primary becomes the card; light-primary brands
 *   get a soft accent-tinted light card; slate only when the brand has neither.
 *   dark section  → light card, accent-tinted when possible.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, resolveQuoteCardBg, type BrandConfig } from "./brand-config";

const brandWith = (overrides: Partial<BrandConfig>): BrandConfig => ({
  ...DEFAULT_BRAND,
  ...overrides,
});

describe("resolveQuoteCardBg", () => {
  it("uses a dark brand primary as the card on light sections", () => {
    const brand = brandWith({ primaryColor: "#003a30" });
    expect(resolveQuoteCardBg(brand, "#c7e738", "#ffffff")).toBe("#003a30");
  });

  it("gives light-primary brands a soft accent-tinted light card, not slate", () => {
    // e.g. a cream primary + orange accent — the old pick returned #1E293B here.
    const brand = brandWith({ primaryColor: "#f9ede7" });
    expect(resolveQuoteCardBg(brand, "#e04410", "#ffffff")).toBe(
      "color-mix(in srgb, #e04410 7%, #FFFFFF)",
    );
  });

  it("falls back to the legacy slate only when the brand offers no usable color", () => {
    const brand = brandWith({ primaryColor: "#f9ede7" });
    expect(resolveQuoteCardBg(brand, "", "#ffffff")).toBe("#1E293B");
    expect(resolveQuoteCardBg(brand, "var(--brand-accent)", "#ffffff")).toBe("#1E293B");
  });

  it("keeps the neutral-dark default brand on a dark card (unbranded tenants unchanged)", () => {
    // DEFAULT_BRAND primary is slate-900 — dark enough to stay the card color.
    expect(resolveQuoteCardBg(DEFAULT_BRAND, DEFAULT_BRAND.accentColor, "#ffffff")).toBe(
      DEFAULT_BRAND.primaryColor,
    );
  });

  it("flips to a light (accent-tinted) card on dark sections", () => {
    const brand = brandWith({ primaryColor: "#003a30" });
    expect(resolveQuoteCardBg(brand, "#c7e738", "#0B1120")).toBe(
      "color-mix(in srgb, #c7e738 6%, #FFFFFF)",
    );
    expect(resolveQuoteCardBg(brand, "", "#0B1120")).toBe("#FFFFFF");
  });

  it("treats a missing/non-hex section base as light", () => {
    const brand = brandWith({ primaryColor: "#003a30" });
    expect(resolveQuoteCardBg(brand, "#c7e738", undefined)).toBe("#003a30");
    expect(resolveQuoteCardBg(brand, "#c7e738", "var(--x)")).toBe("#003a30");
  });
});
