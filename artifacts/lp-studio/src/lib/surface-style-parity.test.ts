/**
 * Brand card/layout tokens (brand-fidelity, July 2026).
 *
 * getBrandSurfaceCss remaps the Tailwind radius/shadow/gap utilities page-wide
 * so every block — current and future — follows the brand's cardRadius /
 * cardShadow / layoutDensity tokens with zero per-block wiring. These tests
 * pin the three load-bearing properties of that design:
 *
 *  1. ZERO-CHANGE GUARANTEE — an unset (or default-valued) token emits no CSS
 *     at all, so every existing tenant renders pixel-identically on deploy.
 *  2. SCOPE + EXCLUSIONS — selectors are scoped to [data-lp-page] (a <style>
 *     tag applies document-wide) and radius/shadow overrides exclude .lp-btn
 *     (buttons follow their own buttonRadius/buttonShadow tokens).
 *  3. INJECTION PARITY — the builder canvas and the published viewer inject
 *     the stylesheet inside every data-lp-page wrapper, same as the brand
 *     button CSS (see button-style-parity.test.ts, whose mechanism this
 *     mirrors).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND,
  getBrandSurfaceCss,
  getButtonClasses,
  getSecondaryButtonClasses,
  type BrandConfig,
} from "./brand-config";

const here = dirname(fileURLToPath(import.meta.url));
const BUILDER = join(here, "../pages/builder/BuilderEditor.tsx");
const VIEWER = join(here, "../pages/landing-page-viewer.tsx");

const INJECTION_RE =
  /getBrandSurfaceCss\(\s*(\w+)\s*\)\s*&&\s*<style>\{\s*getBrandSurfaceCss\(\s*\1\s*\)\s*\}<\/style>/;

const brand = (overrides: Partial<BrandConfig>): BrandConfig => ({
  ...DEFAULT_BRAND,
  ...overrides,
});

describe("getBrandSurfaceCss — zero-change guarantee", () => {
  it("emits nothing for DEFAULT_BRAND (no tokens set)", () => {
    expect(getBrandSurfaceCss(DEFAULT_BRAND)).toBe("");
  });

  it("emits nothing for the default-equivalent token values", () => {
    // "rounded" / "md" / "regular" match the block library's own designed
    // values — picking them must be a designed no-op, not a near-identical
    // override, so untouched-looking brands can't drift by a pixel.
    expect(
      getBrandSurfaceCss(brand({ cardRadius: "rounded", cardShadow: "md", layoutDensity: "regular" })),
    ).toBe("");
  });
});

describe("getBrandSurfaceCss — output shape", () => {
  it("cardRadius remaps the card-scale radius utilities, scoped and button-excluded", () => {
    const css = getBrandSurfaceCss(brand({ cardRadius: "square" }));
    for (const util of ["rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl"]) {
      expect(css).toContain(`[data-lp-page] .${util}:not(.lp-btn){border-radius:0px !important}`);
    }
    // rounded-full (avatars, pills) must never be squared.
    expect(css).not.toContain("rounded-full");
  });

  it("cardRadius preserves the size hierarchy (proportional remap, not a flat value)", () => {
    const css = getBrandSurfaceCss(brand({ cardRadius: "slight" }));
    expect(css).toContain(".rounded-lg:not(.lp-btn){border-radius:0.25rem");
    expect(css).toContain(".rounded-3xl:not(.lp-btn){border-radius:0.75rem");
  });

  it("cardShadow none flattens every shadow utility; lg slides the ladder up", () => {
    const none = getBrandSurfaceCss(brand({ cardShadow: "none" }));
    expect(none).toContain("[data-lp-page] .shadow-sm:not(.lp-btn){box-shadow:none !important}");
    expect(none).toContain("[data-lp-page] .shadow-xl:not(.lp-btn){box-shadow:none !important}");
    const lg = getBrandSurfaceCss(brand({ cardShadow: "lg" }));
    // shadow-sm renders at the md depth on a dramatic-shadow brand.
    expect(lg).toContain(".shadow-sm:not(.lp-btn){box-shadow:0 4px 6px");
  });

  it("layoutDensity rescales gaps proportionally without touching micro gaps or buttons", () => {
    const compact = getBrandSurfaceCss(brand({ layoutDensity: "compact" }));
    expect(compact).toContain("[data-lp-page] .gap-8{gap:1.25rem !important}");
    expect(compact).toContain("[data-lp-page] .gap-4{gap:0.625rem !important}");
    // gap-2/gap-3 are icon/text micro-spacing — never remapped.
    expect(compact).not.toContain(".gap-2{");
    expect(compact).not.toContain(".gap-3{");
    const spacious = getBrandSurfaceCss(brand({ layoutDensity: "spacious" }));
    expect(spacious).toContain("[data-lp-page] .gap-8{gap:2.75rem !important}");
  });

  it("every emitted selector is scoped to [data-lp-page]", () => {
    const css = getBrandSurfaceCss(
      brand({ cardRadius: "soft", cardShadow: "sm", layoutDensity: "spacious" }),
    );
    // Split on rule boundaries; each rule must carry the page scope so the
    // builder's own chrome (dialogs, toolbars) is never restyled.
    const selectors = css.split("}").filter(Boolean);
    expect(selectors.length).toBeGreaterThan(0);
    for (const rule of selectors) {
      expect(rule.startsWith("[data-lp-page] ")).toBe(true);
    }
  });
});

describe("button helpers carry the .lp-btn remap exclusion", () => {
  it("getButtonClasses always includes lp-btn (both primary and sizing-only calls)", () => {
    expect(getButtonClasses(DEFAULT_BRAND).split(" ")).toContain("lp-btn");
    expect(getButtonClasses(DEFAULT_BRAND, "", { imported: false }).split(" ")).toContain("lp-btn");
  });

  it("getSecondaryButtonClasses includes lp-btn", () => {
    expect(getSecondaryButtonClasses(DEFAULT_BRAND).split(" ")).toContain("lp-btn");
  });
});

describe("surface stylesheet injection parity (builder vs published viewer)", () => {
  function pageWrapperBranches(src: string): number[] {
    const wrapperRe = /\sdata-lp-page(?=[\s/>])/g;
    return [...src.matchAll(wrapperRe)].map((m) => m.index);
  }

  it("the builder canvas injects getBrandSurfaceCss inside its data-lp-page wrapper", () => {
    const src = readFileSync(BUILDER, "utf8");
    const idx = src.indexOf("data-lp-page");
    expect(idx).toBeGreaterThan(-1);
    expect(
      INJECTION_RE.test(src.slice(idx, idx + 2000)),
      "BuilderEditor.tsx must inject getBrandSurfaceCss(<brand>) as a <style> inside its data-lp-page canvas wrapper",
    ).toBe(true);
  });

  it("the viewer injects getBrandSurfaceCss in every data-lp-page render branch", () => {
    const src = readFileSync(VIEWER, "utf8");
    const branches = pageWrapperBranches(src);
    expect(branches.length).toBeGreaterThan(0);
    for (const idx of branches) {
      expect(
        INJECTION_RE.test(src.slice(idx, idx + 2000)),
        "each data-lp-page render branch must inject getBrandSurfaceCss within its own wrapper",
      ).toBe(true);
    }
  });
});
