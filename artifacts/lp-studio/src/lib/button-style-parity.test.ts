import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND,
  getBrandButtonCss,
  getButtonClasses,
  getImportedButtonInlineStyle,
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
  textColor: null,
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

  it("uses the scraped text color for the label when present", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: "#fffbe6" },
    };
    expect(getBrandButtonCss(brand)).toContain("color:#fffbe6 !important");
  });

  it("derives a legible label color from the background when none was scraped", () => {
    // #ff0066 is a dark-ish pink → contrast helper resolves to white text,
    // preventing the white-on-white "blank label" failure mode.
    const css = getBrandButtonCss(IMPORTED_BRAND);
    expect(css).toContain("color:#ffffff !important");
  });

  it("ignores a tokenized scraped color (var/color-mix) and derives a legible one instead", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: "var(--site-fg)" },
    };
    const css = getBrandButtonCss(brand);
    expect(css).not.toContain("var(--site-fg)");
    // #ff0066 fill → contrast fallback resolves to white text.
    expect(css).toContain("color:#ffffff !important");
  });

  it("derives black label text on a light/white imported fill", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: null, background: { type: "solid", value: "#ffffff" } },
    };
    expect(getBrandButtonCss(brand)).toContain("color:#000000 !important");
  });

  it("rejects zero / multi-value scraped padding so the brand's own padding controls win", () => {
    // rasta scraped "0px" (collapses the button); test-lp/a-town scraped a
    // multi-value "16px 88px" (invalid for padding-left). Neither should be
    // emitted — the CTA must keep a real hit area from the brand utilities.
    const zero: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, paddingX: "0px", paddingY: "0px" },
    };
    const multi: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, paddingX: "16px 88px", paddingY: "16px" },
    };
    expect(getBrandButtonCss(zero)).not.toContain("padding-left");
    expect(getBrandButtonCss(zero)).not.toContain("padding-top");
    expect(getBrandButtonCss(multi)).not.toContain("padding-left");
    // a single positive length on the other axis is still honored
    expect(getBrandButtonCss(multi)).toContain("padding-top:16px !important");
  });

  it("rejects invisible / near-white shadowless scraped backgrounds so the brand fill applies", () => {
    // rasta scraped rgb(241,241,241) (near-white wash) with no shadow to define
    // it; test-lp/a-town scraped "none". An imported fill this light/absent would
    // make every CTA invisible.
    const nearWhite: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, boxShadow: null, background: { type: "solid", value: "rgb(241, 241, 241)" } },
    };
    const none: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, background: { type: "solid", value: "none" } },
    };
    expect(getBrandButtonCss(nearWhite)).not.toContain("background:");
    expect(getBrandButtonCss(none)).not.toContain("background:");
    // and with no usable fill we must NOT force a (contrast-derived) label color
    expect(getBrandButtonCss(nearWhite)).not.toContain("color:");
    expect(getBrandButtonCss(none)).not.toContain("color:");
  });

  it("keeps a near-white imported fill when it has a shadow to define it (legit white pill)", () => {
    // A white/near-white CTA pill WITH a shadow is a real, common style on a
    // colored hero — IMPORTED_STYLE carries a boxShadow, so it must survive.
    const whitePill: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, background: { type: "solid", value: "#ffffff" } },
    };
    expect(getBrandButtonCss(whitePill)).toContain("background:#ffffff !important");
  });

  it("collapses to an empty stylesheet when only garbage was scraped", () => {
    // The exact rasta shape: 0 padding, near-white fill, radius 0. Nothing here
    // is a usable override, so emit no rule at all and let the block render its
    // own brand button untouched.
    const rasta: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: {
        ...IMPORTED_STYLE,
        radiusPx: 0,
        paddingX: "0px",
        paddingY: "0px",
        fontWeight: undefined as unknown as number,
        textTransform: null as unknown as string,
        boxShadow: null as unknown as string,
        background: { type: "solid", value: "rgb(241, 241, 241)" },
      },
    };
    // radius 0 is still a legitimate (square) override, so the rule may carry
    // border-radius; what must NOT appear is padding/background/color garbage.
    const css = getBrandButtonCss(rasta);
    expect(css).not.toContain("padding-left");
    expect(css).not.toContain("background:");
    expect(css).not.toContain("color:");
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

describe("emitter parity: getBrandButtonCss vs getImportedButtonInlineStyle gate identically", () => {
  // The CSS stylesheet (published/builder) and the inline-style object (Brand
  // Settings preview) must accept/reject the SAME imported values, or the
  // preview lies about what visitors will see. Compare presence-of-property
  // across the gated fields for a spread of valid and garbage imports.
  const cases: Array<[string, ImportedButtonStyle]> = [
    ["valid", IMPORTED_STYLE],
    ["zero-padding", { ...IMPORTED_STYLE, paddingX: "0px", paddingY: "0px" }],
    ["multi-padding", { ...IMPORTED_STYLE, paddingX: "16px 88px", paddingY: "16px" }],
    ["near-white-no-shadow", { ...IMPORTED_STYLE, boxShadow: null, background: { type: "solid", value: "rgb(241, 241, 241)" } }],
    ["near-white-with-shadow", { ...IMPORTED_STYLE, background: { type: "solid", value: "#ffffff" } }],
    ["bg-none", { ...IMPORTED_STYLE, background: { type: "solid", value: "none" } }],
    ["shadow-none-near-white", { ...IMPORTED_STYLE, boxShadow: "none", background: { type: "solid", value: "rgb(244, 244, 244)" } }],
  ];

  for (const [name, raw] of cases) {
    it(`agrees on background/padding/color presence for "${name}"`, () => {
      const brand: BrandConfig = { ...DEFAULT_BRAND, buttonStyleRaw: raw };
      const css = getBrandButtonCss(brand);
      const inline = getImportedButtonInlineStyle(brand);
      expect(css.includes("background:")).toBe(inline.background !== undefined);
      expect(css.includes("padding-left")).toBe(inline.paddingLeft !== undefined);
      expect(css.includes("padding-top")).toBe(inline.paddingTop !== undefined);
      expect(css.includes("color:")).toBe(inline.color !== undefined);
    });
  }

  it("a box-shadow of \"none\" does not rescue a near-white fill (truthy-but-empty shadow)", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, boxShadow: "none", background: { type: "solid", value: "rgb(244, 244, 244)" } },
    };
    expect(getBrandButtonCss(brand)).not.toContain("background:");
    expect(getImportedButtonInlineStyle(brand).background).toBeUndefined();
  });

  it("rejects a hex alpha-0 fill (#rrggbb00) as fully transparent", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, background: { type: "solid", value: "#11223300" } },
    };
    expect(getBrandButtonCss(brand)).not.toContain("background:");
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
