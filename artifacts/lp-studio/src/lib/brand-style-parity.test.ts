import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND,
  getBrandStyleVars,
  type BrandConfig,
} from "./brand-config";

const here = dirname(fileURLToPath(import.meta.url));
const BUILDER = join(here, "../pages/builder/BuilderEditor.tsx");
const VIEWER = join(here, "../pages/landing-page-viewer.tsx");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Brand CSS variables: both surfaces set `style={getBrandStyleVars(<brand>)}`
 * (or spread it) on the `data-lp-page` element. The variable name differs by
 * surface (builder uses `effectiveBrand`, the viewer uses `renderBrand` /
 * `brand`), so we normalize down to the shared `getBrandStyleVars(<ident>)`
 * call shape.
 */
const STYLE_VARS_RE = /getBrandStyleVars\(\s*\w+\s*\)/;

/**
 * Brand fonts: both surfaces mount the headless `<BrandFontLoader brand={...}>`
 * as the first child of the `data-lp-page` wrapper.
 */
const FONT_LOADER_RE = /<BrandFontLoader\s+brand=\{/;

const CUSTOM_CSS_SCOPE = "[data-lp-page]";

/**
 * Returns a window of source AROUND each `data-lp-page` JSX wrapper. Unlike the
 * button injection (always a child, i.e. *after* the wrapper opens),
 * `getBrandStyleVars(...)` lives in the `style=` attribute of the SAME opening
 * tag and can appear before OR after the `data-lp-page` attribute. So we slice a
 * window that reaches back over the opening tag and forward over the first few
 * children.
 *
 * We deliberately exclude the `[data-lp-page]` CSS-scope selector strings (used
 * by `scopeCustomCss`) by only matching ` data-lp-page` followed by whitespace,
 * `/`, or `>` — the selector string is preceded by `[`, never whitespace.
 */
function pageWrapperWindows(src: string): string[] {
  const wrapperRe = /\sdata-lp-page(?=[\s/>])/g;
  const windows: string[] = [];
  for (const m of src.matchAll(wrapperRe)) {
    const start = Math.max(0, (m.index ?? 0) - 400);
    windows.push(src.slice(start, (m.index ?? 0) + 1200));
  }
  return windows;
}

describe("brand style-var + font-loader parity (builder vs published viewer)", () => {
  it("the builder canvas applies getBrandStyleVars and mounts BrandFontLoader inside its data-lp-page wrapper", () => {
    const windows = pageWrapperWindows(read(BUILDER));
    expect(
      windows.length,
      "expected a data-lp-page wrapper in BuilderEditor.tsx",
    ).toBeGreaterThan(0);
    for (const win of windows) {
      expect(
        STYLE_VARS_RE.test(win),
        "BuilderEditor.tsx must apply getBrandStyleVars(<brand>) on its data-lp-page canvas wrapper",
      ).toBe(true);
      expect(
        FONT_LOADER_RE.test(win),
        "BuilderEditor.tsx must mount <BrandFontLoader brand={...}> inside its data-lp-page canvas wrapper",
      ).toBe(true);
    }
  });

  it("every viewer data-lp-page render branch applies getBrandStyleVars and mounts BrandFontLoader", () => {
    // landing-page-viewer.tsx has multiple render branches (builder preview,
    // linked-page variant, legacy DTR/video). Each data-lp-page wrapper must
    // carry its OWN brand-var style + font loader or that branch silently
    // drifts from the builder — exactly the failure mode the button-parity
    // guard exists for.
    const windows = pageWrapperWindows(read(VIEWER));
    expect(
      windows.length,
      "expected at least one data-lp-page JSX wrapper in the viewer",
    ).toBeGreaterThan(0);
    for (const win of windows) {
      expect(
        STYLE_VARS_RE.test(win),
        "each viewer data-lp-page branch must apply getBrandStyleVars within its own wrapper",
      ).toBe(true);
      expect(
        FONT_LOADER_RE.test(win),
        "each viewer data-lp-page branch must mount <BrandFontLoader> within its own wrapper",
      ).toBe(true);
    }
  });
});

describe("tenant custom CSS scope parity (builder vs published viewer)", () => {
  /**
   * Matches a `scopeCustomCss(<arg>, <quoted-literal>)` CALL (not the function
   * definition — its second parameter `scope: string` is not a quoted literal).
   * Captures the scope literal so we can assert it is always `[data-lp-page]`.
   */
  const SCOPE_CALL_RE =
    /scopeCustomCss\(\s*[^,]+?\s*,\s*("(?:[^"]*)"|'(?:[^']*)')\s*\)/g;

  it("every scopeCustomCss call in the viewer scopes to [data-lp-page]", () => {
    const calls = [...read(VIEWER).matchAll(SCOPE_CALL_RE)];
    expect(
      calls.length,
      "expected at least one scopeCustomCss(...) call in the viewer",
    ).toBeGreaterThan(0);
    for (const m of calls) {
      const scope = m[1].slice(1, -1); // strip the surrounding quotes
      expect(
        scope,
        "tenant custom CSS must be scoped to [data-lp-page] in every viewer branch",
      ).toBe(CUSTOM_CSS_SCOPE);
    }
  });

  it("if the builder scopes custom CSS, it uses the same [data-lp-page] scope", () => {
    // The builder canvas does not currently preview tenant custom CSS, so there
    // may be zero call sites — but if a future change adds one, it must use the
    // identical scope or the canvas would diverge from the published page.
    for (const m of read(BUILDER).matchAll(SCOPE_CALL_RE)) {
      expect(m[1].slice(1, -1)).toBe(CUSTOM_CSS_SCOPE);
    }
  });
});

describe("getBrandStyleVars surface-independence", () => {
  it("emits the core brand CSS custom properties", () => {
    const vars = getBrandStyleVars(DEFAULT_BRAND) as Record<string, string>;
    expect(vars["--brand-primary"]).toBeTruthy();
    expect(vars["--brand-accent"]).toBeTruthy();
    expect(vars["--brand-page-bg"]).toBeTruthy();
    expect(vars["--brand-text"]).toBeTruthy();
  });

  it("produces identical vars for structurally-equal brands regardless of caller", () => {
    // Both surfaces call getBrandStyleVars(brand) with the SAME BrandConfig
    // values, so the emitted CSS-var set must depend only on the brand data —
    // never on which surface (builder vs viewer) or which object instance
    // called it. Compare two independently-built but equal brand objects.
    const a: BrandConfig = { ...DEFAULT_BRAND, primaryColor: "#123456", accentColor: "#abcdef" };
    const b: BrandConfig = { ...DEFAULT_BRAND, primaryColor: "#123456", accentColor: "#abcdef" };
    expect(a).not.toBe(b);
    expect(getBrandStyleVars(a)).toEqual(getBrandStyleVars(b));
  });
});
