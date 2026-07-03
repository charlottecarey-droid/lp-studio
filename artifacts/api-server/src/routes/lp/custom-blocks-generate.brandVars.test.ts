/**
 * Block maker × brand CSS variables (brand-fidelity, July 2026).
 *
 * Generated custom-block templates used to bake literal brand hex into their
 * inline <style>, freezing the look at generation time. The prompt now asks
 * for `var(--brand-*, <hex fallback>)` expressions — the variables every
 * rendered page defines at its root (getBrandStyleVars) — so blocks re-skin
 * with the live brand wherever the vars exist and keep today's exact look
 * (the fallback) everywhere else. These tests pin the shared prompt section
 * and the hint key-mapping fix (the stored config names are
 * pageBackground/displayFont; the old backgroundColor/headingFont reads
 * matched nothing, so fonts + page background never reached the block maker).
 */
import { describe, it, expect } from "vitest";
import { buildBrandPaletteSection, visualBrandHints, buildSystemPrompt, buildComposeSystemPrompt } from "./custom-blocks-generate";

describe("visualBrandHints — config key mapping", () => {
  it("reads the real BrandConfig keys (pageBackground / displayFont) and the CTA/card colors", () => {
    const hints = visualBrandHints({
      primaryColor: "#112233",
      pageBackground: "#FDFCFA",
      displayFont: "Bagoss Standard",
      bodyFont: "Inter",
      ctaBackground: "#C7E738",
      ctaText: "#000000",
      cardBackground: "#ECEAE6",
    });
    expect(hints.backgroundColor).toBe("#FDFCFA");
    expect(hints.headingFont).toBe("Bagoss Standard");
    expect(hints.ctaBackground).toBe("#C7E738");
    expect(hints.ctaText).toBe("#000000");
    expect(hints.cardBackground).toBe("#ECEAE6");
  });

  it("falls back to the legacy keys when the real ones are absent", () => {
    const hints = visualBrandHints({ backgroundColor: "#ffffff", headingFont: "Lora" });
    expect(hints.backgroundColor).toBe("#ffffff");
    expect(hints.headingFont).toBe("Lora");
  });

  it("drops non-hex color values", () => {
    const hints = visualBrandHints({ primaryColor: "tomato", pageBackground: "var(--x)" });
    expect(hints.primaryColor).toBeUndefined();
    expect(hints.backgroundColor).toBeUndefined();
  });
});

describe("buildBrandPaletteSection", () => {
  const HINTS = {
    primaryColor: "#112233",
    accentColor: "#445566",
    ctaBackground: "#C7E738",
    ctaText: "#000000",
    headingFont: "Bagoss Standard",
    bodyFont: "Inter",
  };

  it("emits var() expressions with the brand hex as the fallback", () => {
    const section = buildBrandPaletteSection(HINTS);
    expect(section).toContain("var(--brand-primary, #112233)");
    expect(section).toContain("var(--brand-accent, #445566)");
    expect(section).toContain("var(--brand-cta-bg, #C7E738)");
    expect(section).toContain("var(--brand-cta-text, #000000)");
  });

  it("keeps color FIELD values literal hex (var() is template-CSS only)", () => {
    const section = buildBrandPaletteSection(HINTS);
    expect(section).toContain("color FIELD values");
    expect(section).toContain("literal hex");
    expect(section).toContain("Do NOT strip the fallback");
  });

  it("omits vars for absent hints and fonts stay literal families", () => {
    const section = buildBrandPaletteSection({ primaryColor: "#112233", bodyFont: "Inter" });
    expect(section).toContain("var(--brand-primary, #112233)");
    expect(section).not.toContain("--brand-accent");
    expect(section).not.toContain("--brand-cta-bg");
    expect(section).toContain("body font: Inter");
    expect(section).not.toContain("var(--brand-font");
  });

  it("returns an empty string when there is nothing to say", () => {
    expect(buildBrandPaletteSection({})).toBe("");
  });
});

// ── Prompt quality doctrines ─────────────────────────────────────────────────
// The art-direction doctrine is why generated blocks look designed instead of
// like HTML demos; these pins keep its load-bearing directives (and the shared
// density doctrine) present in BOTH prompts — single-block and compose used to
// drift, and compose shipped with no density rules at all.
describe("block-maker prompt doctrines", () => {
  const LOAD_BEARING = [
    "ART DIRECTION",
    "clamp(48px, 8vw, 96px)",              // spacing scale
    "clamp(28px, 4.5vw, 44px)",            // display type scale
    "font-family: inherit",                 // inherit brand fonts
    "repeat(auto-fit, minmax(240px, 1fr))", // responsive card grids
    "aspect-ratio",                          // fixed-ratio imagery
    "gradient scrim",                        // text over images
    "NEVER emoji",                           // icon rule
    "ANTI-PATTERNS",
    "SELF-CHECK",
    "DENSITY DOCTRINE",
    "EXACTLY 4–6 row objects",
  ];

  it("the single-block prompt carries every load-bearing directive", () => {
    const prompt = buildSystemPrompt();
    for (const fragment of LOAD_BEARING) {
      expect(prompt, `missing: ${fragment}`).toContain(fragment);
    }
  });

  it("the compose prompt carries the same art-direction + density doctrines", () => {
    const prompt = buildComposeSystemPrompt();
    for (const fragment of LOAD_BEARING) {
      expect(prompt, `missing: ${fragment}`).toContain(fragment);
    }
  });

  it("both prompts keep the safety rails", () => {
    for (const prompt of [buildSystemPrompt(), buildComposeSystemPrompt()]) {
      expect(prompt).toContain("No <script>");
      expect(prompt).toContain("no external <link>/<script src>");
    }
  });
});
