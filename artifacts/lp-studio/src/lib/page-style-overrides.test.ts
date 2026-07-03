/**
 * Page style overrides ("Match style from URL") — the render-time merge gate.
 * Pins: whitelist-only merge, per-key value validation, identity return when
 * nothing valid (memoization safety), and that identity/content keys can
 * never ride along.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_BRAND } from "./brand-config";
import {
  hasPageStyleOverrides,
  mergePageStyleOverrides,
  PAGE_STYLE_OVERRIDE_KEYS,
} from "./page-style-overrides";

describe("mergePageStyleOverrides", () => {
  it("merges valid visual tokens over the brand", () => {
    const merged = mergePageStyleOverrides(DEFAULT_BRAND, {
      primaryColor: "#123456",
      buttonRadius: "square",
      cardRadius: "soft",
      layoutDensity: "spacious",
      displayFont: "Fraunces",
    });
    expect(merged.primaryColor).toBe("#123456");
    expect(merged.buttonRadius).toBe("square");
    expect(merged.cardRadius).toBe("soft");
    expect(merged.layoutDensity).toBe("spacious");
    expect(merged.displayFont).toBe("Fraunces");
    // Untouched fields come from the brand.
    expect(merged.brandName).toBe(DEFAULT_BRAND.brandName);
  });

  it("returns the SAME brand reference when there is nothing valid to merge", () => {
    expect(mergePageStyleOverrides(DEFAULT_BRAND, null)).toBe(DEFAULT_BRAND);
    expect(mergePageStyleOverrides(DEFAULT_BRAND, undefined)).toBe(DEFAULT_BRAND);
    expect(mergePageStyleOverrides(DEFAULT_BRAND, {})).toBe(DEFAULT_BRAND);
    expect(mergePageStyleOverrides(DEFAULT_BRAND, [])).toBe(DEFAULT_BRAND);
    expect(mergePageStyleOverrides(DEFAULT_BRAND, { bogusKey: "#123456" })).toBe(DEFAULT_BRAND);
  });

  it("drops invalid values per key type", () => {
    const merged = mergePageStyleOverrides(DEFAULT_BRAND, {
      primaryColor: "not-a-hex",
      accentColor: "#12345",          // 5 digits
      buttonRadius: "circular",       // not in enum
      layoutDensity: 3,               // wrong type
      displayFont: "  ",              // blank
      cardShadow: "lg",               // valid — proves partial merge works
    });
    expect(merged.primaryColor).toBe(DEFAULT_BRAND.primaryColor);
    expect(merged.accentColor).toBe(DEFAULT_BRAND.accentColor);
    expect(merged.buttonRadius).toBe(DEFAULT_BRAND.buttonRadius);
    expect(merged.layoutDensity).toBeUndefined();
    expect(merged.displayFont).toBe(DEFAULT_BRAND.displayFont);
    expect(merged.cardShadow).toBe("lg");
  });

  it("ignores identity/content keys even if a stored blob carries them", () => {
    const merged = mergePageStyleOverrides(DEFAULT_BRAND, {
      brandName: "Evil Corp",
      defaultCtaUrl: "https://evil.example",
      logoUrl: "https://evil.example/logo.png",
      primaryColor: "#123456",
    });
    expect(merged.brandName).toBe(DEFAULT_BRAND.brandName);
    expect(merged.defaultCtaUrl).toBe(DEFAULT_BRAND.defaultCtaUrl);
    expect(merged.logoUrl).toBe(DEFAULT_BRAND.logoUrl);
    expect(merged.primaryColor).toBe("#123456");
  });

  it("accepts buttonStyleRaw as an object only", () => {
    const raw = { category: "pill", radiusPx: 999, raw: {} };
    expect(mergePageStyleOverrides(DEFAULT_BRAND, { buttonStyleRaw: raw }).buttonStyleRaw).toBe(raw);
    expect(mergePageStyleOverrides(DEFAULT_BRAND, { buttonStyleRaw: "pill" })).toBe(DEFAULT_BRAND);
    expect(mergePageStyleOverrides(DEFAULT_BRAND, { buttonStyleRaw: [1] })).toBe(DEFAULT_BRAND);
  });

  it("whitelist never contains identity/content keys", () => {
    for (const k of ["brandName", "logoUrl", "defaultCtaUrl", "defaultCtaText", "chilipiperUrl", "segments"]) {
      expect(PAGE_STYLE_OVERRIDE_KEYS).not.toContain(k);
    }
  });
});

describe("hasPageStyleOverrides", () => {
  it("true only when at least one valid token exists", () => {
    expect(hasPageStyleOverrides({ primaryColor: "#123456" })).toBe(true);
    expect(hasPageStyleOverrides({ primaryColor: "garbage" })).toBe(false);
    expect(hasPageStyleOverrides({})).toBe(false);
    expect(hasPageStyleOverrides(null)).toBe(false);
    expect(hasPageStyleOverrides("x")).toBe(false);
  });
});
