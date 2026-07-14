/**
 * Buttons extractor — the failure modes behind "buttons never import right"
 * (July 2026). Live tenants had stored buttonStyleRaw built from:
 *   - cookie-consent banner rules (`.fides-banner-button…`) instead of the
 *     site's real CTA,
 *   - unresolved design tokens (`background: var(--petco__dk-blue)`) that
 *     collapse to transparent when emitted on our pages,
 *   - radii parsed out of token NAMES (`var(--radius-4)` → 4px) and negative
 *     radii (-2px) that squared off vision-confirmed pills.
 * These tests pin the fixes: var() resolution against the site's own
 * stylesheets, consent-tooling exclusion, and radius parse hardening.
 *
 * No vision pass runs (screenshotUrl null), so the OpenAI client is a dummy.
 */
import { describe, it, expect } from "vitest";
import type OpenAI from "openai";
import { extractButtons, resolveCssVars } from "./buttons";
import type { Evidence } from "../types";

const dummyOpenAI = {} as OpenAI;

function evidenceWith(css: string): Evidence {
  return {
    homeUrl: "https://x.example/",
    pages: [],
    stylesheets: [{ url: "https://x.example/a.css", css, bytes: css.length }],
    $home: null,
    robots: { allowed: true, checked: true } as unknown as Evidence["robots"],
    screenshotUrl: null,
    screenshotDataUrl: null,
    sampledPalette: [],
    cssVarPaletteHints: [],
    darkCssVarHints: [],
    errors: [],
  };
}

describe("resolveCssVars", () => {
  const props = new Map<string, string>([
    ["--brand", "#e64c0a"],
    ["--alias", "var(--brand)"],
    ["--loop-a", "var(--loop-b)"],
    ["--loop-b", "var(--loop-a)"],
  ]);

  it("substitutes a known token", () => {
    expect(resolveCssVars("var(--brand)", props)).toBe("#e64c0a");
  });

  it("resolves nested aliases", () => {
    expect(resolveCssVars("var(--alias)", props)).toBe("#e64c0a");
  });

  it("uses the fallback for an unknown token", () => {
    expect(resolveCssVars("var(--nope, #123456)", props)).toBe("#123456");
  });

  it("keeps surrounding value text and handles commas inside fallback functions", () => {
    expect(resolveCssVars("0 2px 4px var(--nope, rgba(0, 0, 0, 0.2))", props)).toBe("0 2px 4px rgba(0, 0, 0, 0.2)");
  });

  it("returns null for an unresolvable token with no fallback", () => {
    expect(resolveCssVars("var(--nope)", props)).toBeNull();
  });

  it("returns null for circular references instead of hanging", () => {
    expect(resolveCssVars("var(--loop-a)", props)).toBeNull();
  });

  it("passes through values without var()", () => {
    expect(resolveCssVars("#fff", props)).toBe("#fff");
  });
});

describe("extractButtons", () => {
  it("resolves tokenized CTA declarations against the site's own custom properties", async () => {
    const css = `
      :root { --btn-bg: #e64c0a; --btn-fg: #ffffff; --btn-radius: 9999px; }
      .btn-primary {
        background: var(--btn-bg);
        color: var(--btn-fg);
        border-radius: var(--btn-radius);
        padding: 12px 24px;
      }`;
    const res = await extractButtons(evidenceWith(css), dummyOpenAI);
    const b = res.data?.primaryButton;
    expect(b?.background?.value).toBe("#e64c0a");
    expect(b?.textColor).toBe("#ffffff");
    expect(b?.radiusPx).toBe(9999);
    expect(b?.category).toBe("pill");
  });

  it("drops declarations whose tokens cannot be resolved rather than storing var() strings", async () => {
    const css = `
      .btn-primary {
        background: var(--petco__dk-blue);
        color: var(--petco__white);
        border-radius: 8px;
        padding: 12px 24px;
      }`;
    const res = await extractButtons(evidenceWith(css), dummyOpenAI);
    const b = res.data?.primaryButton;
    // The unresolvable fill/label are gone; the concrete radius/padding survive.
    expect(b?.background).toBeNull();
    expect(b?.textColor).toBeNull();
    expect(b?.radiusPx).toBe(8);
  });

  it("never imports a cookie-consent banner's button style", async () => {
    const css = `
      .fides-banner-button-primary { background: #2d3748; border-radius: 4px; padding: 8px 16px; }
      #onetrust-accept-btn-handler { background: #6aa84f; border-radius: 2px; padding: 10px 20px; }`;
    const res = await extractButtons(evidenceWith(css), dummyOpenAI);
    // With ONLY consent tooling in the CSS there is no usable primary button.
    expect(res.status).toBe("failed");
  });

  it("prefers the site's real CTA over a higher-specificity consent-banner rule", async () => {
    const css = `
      .fides-banner-button-primary { background: #2d3748; border-radius: 4px; padding: 8px 16px; }
      .btn-primary { background: #0f62fe; border-radius: 24px; padding: 12px 24px; }`;
    const res = await extractButtons(evidenceWith(css), dummyOpenAI);
    expect(res.data?.primaryButton?.background?.value).toBe("#0f62fe");
    expect(res.data?.primaryButton?.radiusPx).toBe(24);
  });

  it("does not parse a radius out of an unresolved token name (var(--radius-4) is not 4px)", async () => {
    const css = `
      .btn-primary { background: #0f62fe; border-radius: var(--radius-4); padding: 12px 24px; }`;
    const res = await extractButtons(evidenceWith(css), dummyOpenAI);
    expect(res.data?.primaryButton?.radiusPx).toBeNull();
  });

  it("treats a negative radius as a garbage parse, not a shape", async () => {
    const css = `
      .btn-primary { background: #0f62fe; border-radius: -2px; padding: 12px 24px; }`;
    const res = await extractButtons(evidenceWith(css), dummyOpenAI);
    expect(res.data?.primaryButton?.radiusPx).toBeNull();
  });
});
