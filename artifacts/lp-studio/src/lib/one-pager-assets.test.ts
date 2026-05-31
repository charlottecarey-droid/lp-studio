// resolveOnePagerAssets logo-fallback tests.
//
// The one-pager generator pulls its header logo from resolveOnePagerAssets.
// For non-Dandy tenants the logo must fall back, in order:
//   onePagerLogoUrl → logoUrlDark → logoUrl → (none).
// Dandy must keep its bundled white wordmark when no override is set, and a
// non-Dandy tenant must NEVER receive a Dandy asset — even if it renames its
// brand to "Dandy" — because the fallback is gated on the server-authoritative
// isDandy flag, not the editable brandName.

import { describe, it, expect } from "vitest";
import {
  resolveOnePagerAssets,
  DEFAULT_BRAND,
  type BrandConfig,
} from "@/lib/brand-config";

function brand(overrides: Partial<BrandConfig>): BrandConfig {
  return { ...DEFAULT_BRAND, ...overrides };
}

describe("resolveOnePagerAssets — non-Dandy logo fallback chain", () => {
  it("prefers onePagerLogoUrl over logoUrlDark and logoUrl", () => {
    const assets = resolveOnePagerAssets(
      brand({
        isDandy: false,
        logoUrl: "https://cdn.example.com/logo.png",
        logoUrlDark: "https://cdn.example.com/logo-dark.png",
        salesConsole: { onePagerLogoUrl: "https://cdn.example.com/one-pager-logo.png" },
      }),
    );
    expect(assets.logoUrl).toBe("https://cdn.example.com/one-pager-logo.png");
  });

  it("falls back to logoUrlDark when no onePagerLogoUrl is set", () => {
    const assets = resolveOnePagerAssets(
      brand({
        isDandy: false,
        logoUrl: "https://cdn.example.com/logo.png",
        logoUrlDark: "https://cdn.example.com/logo-dark.png",
        salesConsole: {},
      }),
    );
    expect(assets.logoUrl).toBe("https://cdn.example.com/logo-dark.png");
  });

  it("falls back to logoUrl when neither onePagerLogoUrl nor logoUrlDark is set", () => {
    const assets = resolveOnePagerAssets(
      brand({
        isDandy: false,
        logoUrl: "https://cdn.example.com/logo.png",
        logoUrlDark: "",
        salesConsole: {},
      }),
    );
    expect(assets.logoUrl).toBe("https://cdn.example.com/logo.png");
  });

  it("returns null (no Dandy asset) when a non-Dandy tenant has no logos at all", () => {
    const assets = resolveOnePagerAssets(
      brand({ isDandy: false, logoUrl: "", logoUrlDark: "", salesConsole: {} }),
    );
    expect(assets.logoUrl).toBeNull();
  });

  it("never inherits the bundled Dandy wordmark, even if a non-Dandy tenant is named 'Dandy'", () => {
    const assets = resolveOnePagerAssets(
      brand({
        isDandy: false,
        brandName: "Dandy",
        logoUrl: "",
        logoUrlDark: "",
        salesConsole: {},
      }),
    );
    expect(assets.logoUrl).toBeNull();
  });
});

describe("resolveOnePagerAssets — Dandy keeps its bundled assets", () => {
  it("keeps the bundled white wordmark when no override is set", () => {
    const assets = resolveOnePagerAssets(brand({ isDandy: true, salesConsole: {} }));
    expect(assets.logoUrl).toBe("/dandy-logo-white.svg");
  });

  it("lets a Dandy tenant override the bundled wordmark via onePagerLogoUrl", () => {
    const assets = resolveOnePagerAssets(
      brand({
        isDandy: true,
        salesConsole: { onePagerLogoUrl: "https://cdn.example.com/custom-dandy.png" },
      }),
    );
    expect(assets.logoUrl).toBe("https://cdn.example.com/custom-dandy.png");
  });

  it("restores bundled per-audience header images and product screenshot for Dandy", () => {
    const assets = resolveOnePagerAssets(brand({ isDandy: true, salesConsole: {} }));
    expect(assets.headerImages.executive).toBe("/one-pager/ai-scan-review-news.jpg");
    expect(assets.headerImages.clinical).toBe("/one-pager/ai-scan-review-clinical.png");
    expect(assets.headerImages["practice-manager"]).toBe(
      "/one-pager/dandy-dso-enterprise-data.webp",
    );
    expect(assets.productScreenshot).toBe("/one-pager/dandy-scanner-transparent.png");
  });

  it("gives non-Dandy tenants neutral (null) header images and product screenshot", () => {
    const assets = resolveOnePagerAssets(brand({ isDandy: false, salesConsole: {} }));
    expect(assets.headerImages.executive).toBeNull();
    expect(assets.headerImages.clinical).toBeNull();
    expect(assets.headerImages["practice-manager"]).toBeNull();
    expect(assets.productScreenshot).toBeNull();
  });
});
