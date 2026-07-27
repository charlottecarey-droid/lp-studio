import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND,
  getBrandButtonCss,
  getBrandButtonShapeCss,
  getBrandStyleVars,
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
  it("emits a single rule covering both primary-button markers", () => {
    const css = getBrandButtonCss(IMPORTED_BRAND);
    // `.lp-cta-filled` (shared CtaButtons given an opaque inline fill) joined
    // `.lp-brand-btn` so a page-level fill reaches CtaButton primaries too;
    // outline/secondary CtaButtons never carry the marker.
    expect(css).toContain(".lp-brand-btn,.lp-cta-filled{");
    expect(css.match(/\{/g) ?? []).toHaveLength(1);
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

  it("drops a scraped label color equal to its own fill (same color text + background)", () => {
    // The reported invo bug: the importer captured a CTA whose text color
    // equalled its background. Emitted with !important page-wide it paints every
    // primary button as same-color-on-same-color (invisible). The label must
    // fall back to a guaranteed-legible color instead of the scraped match.
    const sameColor: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: "#ff0066", background: { type: "solid", value: "#ff0066" } },
    };
    const css = getBrandButtonCss(sameColor);
    expect(css).not.toContain("color:#ff0066 !important");
    expect(css).toContain("color:#ffffff !important");
  });

  it("drops a scraped label color too low-contrast against its fill and derives a legible one", () => {
    const lowContrast: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: "#ff3377", background: { type: "solid", value: "#ff0066" } },
    };
    const css = getBrandButtonCss(lowContrast);
    expect(css).not.toContain("color:#ff3377 !important");
    expect(css).toContain("color:#ffffff !important");
  });

  it("keeps a scraped label color that contrasts adequately with its fill", () => {
    const ok: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: "#ffffff", background: { type: "solid", value: "#1d4ed8" } },
    };
    expect(getBrandButtonCss(ok)).toContain("color:#ffffff !important");
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
    // Padding is all-or-nothing (July 2026): forcing one axis while the other
    // keeps the brand token produced squished mixes (live tenants stored
    // paddingY "0" beside a real paddingX). One bad axis drops BOTH.
    expect(getBrandButtonCss(multi)).not.toContain("padding-top");
  });

  it("emits padding only when BOTH axes are usable", () => {
    const both: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, paddingX: "28px", paddingY: "14px" },
    };
    const css = getBrandButtonCss(both);
    expect(css).toContain("padding-left:28px !important");
    expect(css).toContain("padding-top:14px !important");
    // petco stored paddingY "0" beside paddingX "16px" — neither may emit.
    const mixed: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, paddingX: "16px", paddingY: "0" },
    };
    expect(getBrandButtonCss(mixed)).not.toContain("padding-");
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

describe("imported values that cannot resolve on our pages (July 2026)", () => {
  // Live tenants stored buttonStyleRaw built from the SOURCE site's design
  // tokens: `background: var(--petco__dk-blue)`, `var(--fides-overlay-…)` (a
  // cookie banner), shadows referencing var(). Emitted with !important these
  // don't just drop — they win the cascade and then compute to the property's
  // initial value, painting transparent CTAs with unreadable labels.
  it("rejects a var() background and emits neither fill nor label", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: {
        ...IMPORTED_STYLE,
        background: { type: "solid", value: "var(--petco__dk-blue)" },
        textColor: "var(--petco__white)",
      },
    };
    const css = getBrandButtonCss(brand);
    expect(css).not.toContain("background:");
    expect(css).not.toContain("color:");
    const inline = getImportedButtonInlineStyle(brand);
    expect(inline.background).toBeUndefined();
    expect(inline.color).toBeUndefined();
  });

  it("rejects a gradient background containing var() stops", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, background: { type: "gradient", value: "linear-gradient(90deg, var(--a), #112233)" } },
    };
    expect(getBrandButtonCss(brand)).not.toContain("background:");
  });

  it("rejects a value with an embedded !important (would emit an invalid double-important declaration)", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, background: { type: "solid", value: "var(--color-white)!important" } },
    };
    expect(getBrandButtonCss(brand)).not.toContain("background:");
  });

  it("rejects a box-shadow referencing var()", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, boxShadow: "inset 0 0 0 var(--border-light) rgb(0,0,0)" },
    };
    const css = getBrandButtonCss(brand);
    expect(css).not.toContain("box-shadow");
    expect(getImportedButtonInlineStyle(brand).boxShadow).toBeUndefined();
  });

  it("drops a visible-but-unmeasurable fill instead of forcing it without a legible label", () => {
    // An exotic color function passes the visibility checks but its contrast
    // can't be measured, so no label can be guaranteed — fill and label are
    // emitted together or not at all.
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, textColor: null, background: { type: "solid", value: "oklch(0.6 0.2 30)" } },
    };
    const css = getBrandButtonCss(brand);
    expect(css).not.toContain("background:");
    expect(css).not.toContain("color:");
  });
});

describe("imported radius vs vision category reconciliation (July 2026)", () => {
  // The CSS parse regularly lands on the wrong rule while the vision check
  // correctly identifies the shape: live tenants stored radiusPx 4 — and -2 —
  // against category "pill". The category is the shape authority.
  it("corrects a sub-pill radius parse to fully round when the category is pill", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "pill", radiusPx: 4 },
    };
    expect(getBrandButtonCss(brand)).toContain("border-radius:9999px !important");
  });

  it("corrects a negative radius parse on a pill", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "pill", radiusPx: -2 },
    };
    expect(getBrandButtonCss(brand)).toContain("border-radius:9999px !important");
  });

  it("keeps a real pill radius verbatim", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "pill", radiusPx: 999 },
    };
    expect(getBrandButtonCss(brand)).toContain("border-radius:999px !important");
  });

  it("keeps a genuinely square parse and drops a contradicting one for category square", () => {
    const square: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "square", radiusPx: 0 },
    };
    expect(getBrandButtonCss(square)).toContain("border-radius:0px !important");
    const contradicting: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "square", radiusPx: 24 },
    };
    expect(getBrandButtonCss(contradicting)).not.toContain("border-radius");
  });

  it("keeps a plausible rounded radius and drops an implausible one", () => {
    const plausible: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "rounded", radiusPx: 10 },
    };
    expect(getBrandButtonCss(plausible)).toContain("border-radius:10px !important");
    const implausible: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "rounded", radiusPx: 60 },
    };
    expect(getBrandButtonCss(implausible)).not.toContain("border-radius");
  });

  it("emits no radius when none was parsed (the buttonRadius token owns the shape)", () => {
    const brand: BrandConfig = {
      ...DEFAULT_BRAND,
      buttonStyleRaw: { ...IMPORTED_STYLE, category: "pill", radiusPx: null },
    };
    expect(getBrandButtonCss(brand)).not.toContain("border-radius");
  });
});

describe("getBrandStyleVars CTA label legibility (July 2026)", () => {
  // ~80 blocks consume --brand-cta-text directly, so the var itself must be
  // contrast-guarded: a live tenant stored ctaText #0E71EB on ctaBackground
  // #2848A8 (~1.4:1) and every var-driven CTA rendered blue-on-blue.
  it("replaces an illegible ctaText with a contrasting label", () => {
    const vars = getBrandStyleVars({
      ...DEFAULT_BRAND,
      ctaBackground: "#2848A8",
      ctaText: "#0E71EB",
    }) as Record<string, string>;
    expect(vars["--brand-cta-bg"]).toBe("#2848A8");
    expect(vars["--brand-cta-text"]).toBe("#ffffff");
  });

  it("keeps a legible ctaText verbatim", () => {
    const vars = getBrandStyleVars({
      ...DEFAULT_BRAND,
      ctaBackground: "#2848A8",
      ctaText: "#FFFFFF",
    }) as Record<string, string>;
    expect(vars["--brand-cta-text"]).toBe("#FFFFFF");
  });

  it("derives the label from the fill when no ctaText is set", () => {
    const vars = getBrandStyleVars({
      ...DEFAULT_BRAND,
      ctaBackground: "#F5F1ED",
      ctaText: "",
    }) as Record<string, string>;
    // light fill → near-black label
    expect(vars["--brand-cta-text"].toLowerCase()).not.toBe("#ffffff");
  });
});

describe("getBrandButtonShapeCss — page-wide button curvature (July 2026)", () => {
  // Only ~17 of ~220 blocks route their CTAs through getButtonClasses; the
  // rest hand-roll radius utilities that the brand token never reached (and
  // that the CARD remap in getBrandSurfaceCss was mis-styling). Every
  // button-shaped element must converge on the single brand radius.
  const SHAPE_INJECTION_RE = /<style>\{\s*getBrandButtonShapeCss\(\s*\w+\s*\)\s*\}<\/style>/;

  it("both the builder canvas and the published viewer inject it inside their data-lp-page wrapper", () => {
    expect(SHAPE_INJECTION_RE.test(pageWrapperSlice(read(BUILDER)))).toBe(true);
    expect(SHAPE_INJECTION_RE.test(pageWrapperSlice(read(VIEWER)))).toBe(true);
  });

  it("the viewer injects it in every data-lp-page render branch", () => {
    const viewerSrc = read(VIEWER);
    const branches = [...viewerSrc.matchAll(/\sdata-lp-page(?=[\s/>])/g)];
    expect(branches.length).toBeGreaterThan(0);
    for (const m of branches) {
      expect(SHAPE_INJECTION_RE.test(viewerSrc.slice(m.index, m.index + 2000))).toBe(true);
    }
  });

  it("emits the token's radius for button-shaped elements only", () => {
    const css = getBrandButtonShapeCss({ ...DEFAULT_BRAND, buttonRadius: "square" });
    expect(css).toContain("border-radius:0px !important");
    // scoped to padded <button>/<a> — icon buttons (p-*/w-* sized) keep their shape
    expect(css).toContain('button[class*="px-"]');
    expect(css).toContain('a[class*="px-"]');
    expect(css).toContain("[data-lp-page]");
  });

  it("maps every ButtonRadius token to its concrete radius", () => {
    expect(getBrandButtonShapeCss({ ...DEFAULT_BRAND, buttonRadius: "pill" })).toContain("border-radius:9999px");
    expect(getBrandButtonShapeCss({ ...DEFAULT_BRAND, buttonRadius: "rounded" })).toContain("border-radius:0.75rem");
    expect(getBrandButtonShapeCss({ ...DEFAULT_BRAND, buttonRadius: "slight" })).toContain("border-radius:0.5rem");
    expect(getBrandButtonShapeCss({ ...DEFAULT_BRAND, buttonRadius: "square" })).toContain("border-radius:0px");
  });

  it("excludes token-driven and imported buttons so their exact radii win", () => {
    const css = getBrandButtonShapeCss(DEFAULT_BRAND);
    expect(css).toContain(":not(.lp-btn)");
    expect(css).toContain(":not(.lp-brand-btn)");
  });

  it("outranks the card-radius remap for hand-rolled buttons (tag selector beats the utility remap)", () => {
    // getBrandSurfaceCss emits `[data-lp-page] .rounded-xl:not(.lp-btn)` at
    // specificity (0,3,0); the shape selector must exceed it so buttons get
    // BUTTON radius, not card radius. Tag + [class*=] + two :not()s = (0,4,1).
    const css = getBrandButtonShapeCss(DEFAULT_BRAND);
    expect(css).toMatch(/\[data-lp-page\] button\[class\*="px-"\]:not\(\.lp-btn\):not\(\.lp-brand-btn\)/);
  });

  it("also targets the shared CtaButton marker (classless, inline-styled CTAs)", () => {
    // CtaButton renders a classless <button> whose radius is an inline style,
    // so the `[class*="px-"]` heuristic misses it (BlockAiScanHero's hero CTA
    // hard-coded borderRadius:0.5rem stayed put). The `.lp-cta-btn` marker
    // selector reaches it, and `!important` overrides the inline radius.
    const css = getBrandButtonShapeCss({ ...DEFAULT_BRAND, buttonRadius: "square" });
    expect(css).toContain(
      '[data-lp-page] .lp-cta-btn:not(.lp-btn):not(.lp-brand-btn)',
    );
    // Same convergence value + !important as the tag selectors.
    expect(css).toContain("border-radius:0px !important");
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
