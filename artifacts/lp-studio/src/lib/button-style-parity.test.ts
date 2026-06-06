import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND,
  getBrandButtonCss,
  getButtonClasses,
  type BrandConfig,
  type ImportedButtonStyle,
} from "./brand-config";

const here = dirname(fileURLToPath(import.meta.url));
const BUILDER = join(here, "../pages/builder/BuilderEditor.tsx");
const VIEWER = join(here, "../pages/landing-page-viewer.tsx");

/**
 * Matches the brand-button stylesheet injection as it appears in both render
 * surfaces, ignoring whitespace and the brand variable name (the builder uses
 * `brand`, the viewer uses `renderBrand`). The whole point of this guard is
 * that both surfaces inject the SAME `getBrandButtonCss(...)` <style>, so the
 * pattern is deliberately normalized down to that shared shape.
 */
const INJECTION_RE =
  /getBrandButtonCss\(\s*(\w+)\s*\)\s*&&\s*<style>\{\s*getBrandButtonCss\(\s*\1\s*\)\s*\}<\/style>/;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Finds the JSX wrapper element carrying `data-lp-page` and returns a slice of
 * source starting at it, so we can assert the injection lives INSIDE the
 * landing-page wrapper (not somewhere unrelated in the file).
 */
function pageWrapperSlice(src: string): string {
  const idx = src.indexOf("data-lp-page");
  expect(idx, "expected a data-lp-page wrapper").toBeGreaterThan(-1);
  // Take a generous window after the wrapper opens; the injection sits a few
  // lines below the opening tag in both files.
  return src.slice(idx, idx + 2000);
}

describe("brand button stylesheet parity (builder vs published viewer)", () => {
  it("both the builder canvas and the published viewer inject getBrandButtonCss inside their data-lp-page wrapper", () => {
    const builderSrc = read(BUILDER);
    const viewerSrc = read(VIEWER);

    const builderSlice = pageWrapperSlice(builderSrc);
    const viewerSlice = pageWrapperSlice(viewerSrc);

    const builderMatch = builderSlice.match(INJECTION_RE);
    const viewerMatch = viewerSlice.match(INJECTION_RE);

    expect(
      builderMatch,
      "BuilderEditor.tsx must inject getBrandButtonCss(<brand>) as a <style> inside its data-lp-page canvas wrapper",
    ).not.toBeNull();
    expect(
      viewerMatch,
      "landing-page-viewer.tsx must inject getBrandButtonCss(<brand>) as a <style> inside its data-lp-page wrapper",
    ).not.toBeNull();
  });

  it("the viewer injects the brand button stylesheet in every data-lp-page render branch", () => {
    const viewerSrc = read(VIEWER);
    // landing-page-viewer.tsx has multiple render branches (builder preview,
    // linked-page variant, legacy DTR/video). Each data-lp-page wrapper must
    // carry its own injection or that branch silently drifts from the builder.
    // Locate every JSX wrapper attribute (` data-lp-page`, optionally followed
    // by another attribute / `>`) and exclude the `[data-lp-page]` CSS-scope
    // selector strings, then assert the injection appears in EACH wrapper's
    // own slice — not merely somewhere in the file.
    const wrapperRe = /\sdata-lp-page(?=[\s/>])/g;
    const branches = [...viewerSrc.matchAll(wrapperRe)];
    expect(
      branches.length,
      "expected at least one data-lp-page JSX wrapper in the viewer",
    ).toBeGreaterThan(0);
    for (const m of branches) {
      const slice = viewerSrc.slice(m.index, m.index + 2000);
      expect(
        INJECTION_RE.test(slice),
        "each data-lp-page render branch must inject getBrandButtonCss within its own wrapper",
      ).toBe(true);
    }
  });
});

const IMPORTED_STYLE: ImportedButtonStyle = {
  category: "pill",
  radiusPx: 999,
  paddingX: "28px",
  paddingY: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  background: { type: "solid", value: "#ff0066" },
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  raw: {},
  visionAgreed: true,
  visionNotes: "",
};

const IMPORTED_BRAND: BrandConfig = {
  ...DEFAULT_BRAND,
  buttonStyleRaw: IMPORTED_STYLE,
};

describe("getBrandButtonCss import gating", () => {
  it("emits a single .lp-brand-btn rule when a brand has an imported button style", () => {
    const css = getBrandButtonCss(IMPORTED_BRAND);
    expect(css).toContain(".lp-brand-btn{");
    expect(css).toContain("background:#ff0066 !important");
    expect(css).toContain("border-radius:999px !important");
  });

  it("emits nothing when the brand has no imported button style", () => {
    expect(getBrandButtonCss(DEFAULT_BRAND)).toBe("");
    expect(getBrandButtonCss({ ...DEFAULT_BRAND, buttonStyleRaw: undefined })).toBe("");
  });

  it("produces identical CSS for structurally-equal brands regardless of caller (no surface-specific branching)", () => {
    // Both surfaces call getBrandButtonCss(brand) with the SAME BrandConfig
    // values, so the emitted stylesheet must depend only on the brand data —
    // never on which surface (builder vs viewer) or which object instance
    // called it. Compare two independently-built but equal brand objects.
    const clone: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, raw: { ...IMPORTED_STYLE.raw } },
    };
    expect(clone).not.toBe(IMPORTED_BRAND);
    expect(getBrandButtonCss(clone)).toBe(getBrandButtonCss(IMPORTED_BRAND));
  });
});

describe("getButtonClasses marker class", () => {
  it("adds the lp-brand-btn marker to primary CTAs", () => {
    expect(getButtonClasses(IMPORTED_BRAND).split(/\s+/)).toContain("lp-brand-btn");
    expect(getButtonClasses(DEFAULT_BRAND).split(/\s+/)).toContain("lp-brand-btn");
  });

  it("omits the marker when { imported: false } is passed (outline/secondary buttons)", () => {
    expect(
      getButtonClasses(IMPORTED_BRAND, "", { imported: false }).split(/\s+/),
    ).not.toContain("lp-brand-btn");
  });
});
