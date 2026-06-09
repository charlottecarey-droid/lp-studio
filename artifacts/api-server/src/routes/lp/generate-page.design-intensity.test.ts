/**
 * Task #900 — brand fonts & design intensity feed into AI page generation.
 *
 * These tests exercise the pure helpers (no DB, no network):
 *   1. `inferDesignIntensity` maps tone keywords to the right axis value,
 *      respects an explicit override, and defaults to "balanced".
 *   2. `buildTypographySection` names the brand fonts (and only emits when a
 *      font is set); `buildDesignIntensitySection` emits the resolved axis.
 *   3. `applyDesignIntensityBackgrounds` enforces the expected `backgroundStyle`
 *      per intensity, mirroring the deterministic color-injection pattern.
 */
import { describe, it, expect } from "vitest";
import {
  inferDesignIntensity,
  buildTypographySection,
  buildDesignIntensitySection,
  applyDesignIntensityBackgrounds,
  seedLandingPageSectionBackgrounds,
  applyLandingPageSectionRhythm,
  enforceHeroLegibility,
  cleanFamilyName,
} from "./generate-page";

describe("inferDesignIntensity", () => {
  it("maps luxury / premium / editorial / sophisticated → editorial-dense", () => {
    expect(inferDesignIntensity({ toneOfVoice: "Luxury and refined" })).toBe("editorial-dense");
    expect(inferDesignIntensity({ toneKeywords: ["premium", "bold"] })).toBe("editorial-dense");
    expect(inferDesignIntensity({ toneOfVoice: "an editorial, sophisticated voice" })).toBe("editorial-dense");
  });

  it("maps clean / minimal / airy / calm → airy-minimal", () => {
    expect(inferDesignIntensity({ toneOfVoice: "Clean and minimal" })).toBe("airy-minimal");
    expect(inferDesignIntensity({ toneKeywords: ["airy", "calm"] })).toBe("airy-minimal");
  });

  it("maps bold / playful / energetic → energetic-visual", () => {
    expect(inferDesignIntensity({ toneOfVoice: "Bold and energetic" })).toBe("energetic-visual");
    expect(inferDesignIntensity({ toneKeywords: ["playful"] })).toBe("energetic-visual");
  });

  it("defaults to balanced with no recognizable signal", () => {
    expect(inferDesignIntensity({})).toBe("balanced");
    expect(inferDesignIntensity({ toneOfVoice: "trustworthy and helpful" })).toBe("balanced");
  });

  it("respects an explicit designIntensity over inferred keywords", () => {
    expect(
      inferDesignIntensity({ designIntensity: "airy-minimal", toneOfVoice: "Luxury premium" }),
    ).toBe("airy-minimal");
  });

  it("reads the imported voiceProfile tone + summary when other fields are blank", () => {
    expect(
      inferDesignIntensity({ voiceProfile: { profile: { tone: ["sophisticated"] } } }),
    ).toBe("editorial-dense");
    expect(
      inferDesignIntensity({ voiceProfile: { profile: { summary: "A calm, minimal brand voice." } } }),
    ).toBe("airy-minimal");
  });

  // Higher-priority keyword wins when several axes match (editorial > airy > energetic).
  it("prefers the first matching axis when multiple keywords appear", () => {
    expect(inferDesignIntensity({ toneKeywords: ["minimal", "bold"] })).toBe("airy-minimal");
    expect(inferDesignIntensity({ toneKeywords: ["luxury", "minimal", "bold"] })).toBe("editorial-dense");
  });
});

describe("cleanFamilyName", () => {
  it("strips quotes and trailing weight/style tokens", () => {
    expect(cleanFamilyName('"Inter Bold Italic"')).toBe("Inter");
    expect(cleanFamilyName("Playfair Display")).toBe("Playfair Display"); // "Display" kept (>1 meaningful token)
    expect(cleanFamilyName("DM Sans Medium")).toBe("DM Sans");
    expect(cleanFamilyName("")).toBe("");
    expect(cleanFamilyName(undefined)).toBe("");
  });
});

describe("buildTypographySection", () => {
  it("names heading, body, and numbers fonts when set", () => {
    const section = buildTypographySection({
      displayFont: "Playfair Display",
      bodyFont: "Inter",
      numbersFont: "Roboto Mono",
    });
    expect(section).toContain("TYPOGRAPHY");
    expect(section).toContain("Playfair Display");
    expect(section).toContain("Inter");
    expect(section).toContain("Roboto Mono");
    expect(section).toContain("complement");
  });

  it("emits only the fields that are set", () => {
    const section = buildTypographySection({ displayFont: "Lora" });
    expect(section).toContain("Lora");
    expect(section).not.toContain("Body text:");
    expect(section).not.toContain("Big numeric");
  });

  it("returns empty string when no font is set", () => {
    expect(buildTypographySection({})).toBe("");
    expect(buildTypographySection({ displayFont: "", bodyFont: "  " })).toBe("");
  });
});

describe("buildDesignIntensitySection", () => {
  it("names the resolved value and includes per-value guidance", () => {
    const dense = buildDesignIntensitySection("editorial-dense");
    expect(dense).toContain("DESIGN INTENSITY: editorial-dense");
    expect(dense.toLowerCase()).toContain("magazine");

    const airy = buildDesignIntensitySection("airy-minimal");
    expect(airy).toContain("DESIGN INTENSITY: airy-minimal");
    expect(airy.toLowerCase()).toContain("whitespace");

    const energetic = buildDesignIntensitySection("energetic-visual");
    expect(energetic).toContain("DESIGN INTENSITY: energetic-visual");
    expect(energetic.toLowerCase()).toContain("vibrant");

    const balanced = buildDesignIntensitySection("balanced");
    expect(balanced).toContain("DESIGN INTENSITY: balanced");
  });
});

/** Build N simple blocks that each support backgroundStyle. */
function blocks(n: number, type = "hero", bg = "white") {
  return Array.from({ length: n }, (_, i) => ({
    type,
    id: `b-${i}`,
    props: { backgroundStyle: bg },
  }));
}
const bgOf = (b: unknown) => ((b as { props: { backgroundStyle: string } }).props.backgroundStyle);

describe("applyDesignIntensityBackgrounds", () => {
  it("balanced makes no changes", () => {
    const input = blocks(4, "hero", "white");
    const out = applyDesignIntensityBackgrounds(input, "balanced");
    expect(out.map(bgOf)).toEqual(["white", "white", "white", "white"]);
  });

  it("editorial-dense gives at least 2 of the first 5 blocks a dark background", () => {
    const out = applyDesignIntensityBackgrounds(blocks(6, "hero", "white"), "editorial-dense");
    const darkInFirst5 = out
      .slice(0, 5)
      .filter((b) => ["dark", "black", "dandy-green", "gradient"].includes(bgOf(b))).length;
    expect(darkInFirst5).toBeGreaterThanOrEqual(2);
  });

  it("editorial-dense counts pre-existing dark blocks toward the quota", () => {
    const input = [
      { type: "hero", id: "a", props: { backgroundStyle: "black" } },
      { type: "hero", id: "b", props: { backgroundStyle: "gradient" } },
      { type: "hero", id: "c", props: { backgroundStyle: "white" } },
    ];
    const out = applyDesignIntensityBackgrounds(input, "editorial-dense");
    // Already had 2 dark blocks; the white one must remain untouched.
    expect(bgOf(out[2])).toBe("white");
  });

  it("airy-minimal alternates light neutrals instead of one identical white wall", () => {
    const input = [
      { type: "hero", id: "a", props: { backgroundStyle: "dark" } },
      { type: "benefits-grid", id: "b", props: { backgroundStyle: "muted" } },
    ];
    const out = applyDesignIntensityBackgrounds(input, "airy-minimal");
    // Both light, but adjacent sections differ (no all-white stack).
    expect(out.map(bgOf)).toEqual(["white", "light-gray"]);
  });

  it("airy-minimal preserves dark-required blocks (dso-problem etc.)", () => {
    const input = [
      { type: "hero", id: "a", props: { backgroundStyle: "dark" } },
      { type: "dso-problem", id: "b", props: { backgroundStyle: "black" } },
    ];
    const out = applyDesignIntensityBackgrounds(input, "airy-minimal");
    expect(bgOf(out[0])).toBe("white");
    expect(bgOf(out[1])).toBe("black"); // preserved
  });

  // Regression for the white-on-white hero bug: every dso-* block hard-renders
  // white copy, so the airy-minimal "force everything white" pass must skip ALL
  // of them, not just dso-problem.
  it("airy-minimal preserves ALL dso-* blocks (dark surface keeps white text legible)", () => {
    const input = [
      { type: "dso-heartland-hero", id: "a", props: { backgroundStyle: "dark" } },
      { type: "dso-insights-dashboard", id: "b", props: { backgroundStyle: "dandy-green" } },
      { type: "dso-insights-video", id: "c", props: { backgroundStyle: "black" } },
    ];
    const out = applyDesignIntensityBackgrounds(input, "airy-minimal");
    expect(bgOf(out[0])).toBe("dark");
    expect(bgOf(out[1])).toBe("dandy-green");
    expect(bgOf(out[2])).toBe("black");
  });

  it("energetic-visual ensures an accent block in the first 3", () => {
    const out = applyDesignIntensityBackgrounds(blocks(4, "hero", "white"), "energetic-visual");
    const accentInFirst3 = out.slice(0, 3).filter((b) => bgOf(b) === "dandy-green").length;
    expect(accentInFirst3).toBeGreaterThanOrEqual(1);
  });

  it("energetic-visual leaves an existing accent block alone", () => {
    const input = [
      { type: "hero", id: "a", props: { backgroundStyle: "white" } },
      { type: "hero", id: "b", props: { backgroundStyle: "dandy-green" } },
      { type: "hero", id: "c", props: { backgroundStyle: "white" } },
    ];
    const out = applyDesignIntensityBackgrounds(input, "energetic-visual");
    expect(out.map(bgOf)).toEqual(["white", "dandy-green", "white"]);
  });

  it("ignores blocks that do not support backgroundStyle", () => {
    const input = [{ type: "form", id: "a", props: { headline: "Hi" } }];
    const out = applyDesignIntensityBackgrounds(input, "airy-minimal");
    expect((out[0] as { props: Record<string, unknown> }).props).not.toHaveProperty("backgroundStyle");
  });
});

const overlayOf = (b: unknown) => (b as { props: { overlayOpacity?: number } }).props.overlayOpacity;

describe("enforceHeroLegibility", () => {
  it("clamps a too-light overlay on image-overlay heroes up to the minimum", () => {
    const out = enforceHeroLegibility([
      { type: "full-bleed-hero", id: "a", props: { overlayOpacity: 10 } },
      { type: "parallax-image-hero", id: "b", props: { overlayOpacity: 0 } },
    ]);
    expect(overlayOf(out[0])).toBe(45);
    expect(overlayOf(out[1])).toBe(45);
  });

  it("fills a missing overlay with the minimum", () => {
    const out = enforceHeroLegibility([
      { type: "full-bleed-hero", id: "a", props: {} },
    ]);
    expect(overlayOf(out[0])).toBe(45);
  });

  it("leaves an already-strong overlay untouched", () => {
    const out = enforceHeroLegibility([
      { type: "full-bleed-hero", id: "a", props: { overlayOpacity: 70 } },
    ]);
    expect(overlayOf(out[0])).toBe(70);
  });

  it("ignores non-image-overlay hero blocks", () => {
    const out = enforceHeroLegibility([
      { type: "hero", id: "a", props: { overlayOpacity: 5 } },
    ]);
    expect(overlayOf(out[0])).toBe(5);
  });
});

// Task #1315 — landing-page section-background rhythm. Stop generated landing
// pages rendering as a stack of identical-white sections.
describe("seedLandingPageSectionBackgrounds", () => {
  it("seeds 'white' on a supporting section that has no backgroundStyle", () => {
    const input = [{ type: "benefits-grid", id: "a", props: { headline: "Hi" } }];
    seedLandingPageSectionBackgrounds(input);
    expect((input[0] as { props: Record<string, unknown> }).props.backgroundStyle).toBe("white");
  });

  it("does not overwrite an explicit backgroundStyle", () => {
    const input = [{ type: "benefits-grid", id: "a", props: { backgroundStyle: "dark" } }];
    seedLandingPageSectionBackgrounds(input);
    expect((input[0] as { props: Record<string, unknown> }).props.backgroundStyle).toBe("dark");
  });

  it("skips heroes (they manage their own surface)", () => {
    const input = [
      { type: "hero", id: "a", props: { headline: "x" } },
      { type: "full-bleed-hero", id: "b", props: { headline: "y" } },
    ];
    seedLandingPageSectionBackgrounds(input);
    expect((input[0] as { props: Record<string, unknown> }).props).not.toHaveProperty("backgroundStyle");
    expect((input[1] as { props: Record<string, unknown> }).props).not.toHaveProperty("backgroundStyle");
  });

  it("skips dark-required, dso-*, chrome, layout, and full-page blocks", () => {
    const input = [
      { type: "dso-problem", id: "a", props: {} },
      { type: "dso-stat-showcase", id: "b", props: {} },
      { type: "nav-header", id: "c", props: {} },
      { type: "footer", id: "d", props: {} },
      { type: "rich-text", id: "e", props: {} },
      { type: "columns", id: "f", props: {} },
      { type: "content-series", id: "g", props: {} },
      { type: "storefront", id: "h", props: {} },
    ];
    seedLandingPageSectionBackgrounds(input);
    for (const block of input) {
      expect((block as { props: Record<string, unknown> }).props).not.toHaveProperty("backgroundStyle");
    }
  });
});

describe("applyLandingPageSectionRhythm", () => {
  const SUPPORTING = ["benefits-grid", "features", "trust-bar", "how-it-works", "testimonial", "form"];
  const bg = (b: unknown) => (b as { props: { backgroundStyle?: string } }).props.backgroundStyle;

  it("never leaves the supporting sections as one identical-white stack", () => {
    // The exact regression: every supporting section starts 'white'.
    const input = SUPPORTING.map((type, i) => ({ type, id: `b-${i}`, props: { backgroundStyle: "white" } }));
    applyLandingPageSectionRhythm(input, "tenant-1::Acme::a calm dental landing page");
    const bgs = input.map(bg) as string[];
    // All stay light-neutral…
    expect(bgs.every((v) => ["white", "light-gray", "muted"].includes(v))).toBe(true);
    // …but not all identical (the all-white wall is gone).
    expect(new Set(bgs).size).toBeGreaterThan(1);
    // …and every adjacent pair differs (true alternating rhythm).
    for (let i = 1; i < bgs.length; i++) expect(bgs[i]).not.toBe(bgs[i - 1]);
  });

  it("is deterministic for the same seed key and varies across seed keys", () => {
    const make = () => SUPPORTING.map((type, i) => ({ type, id: `b-${i}`, props: { backgroundStyle: "white" } }));
    const a1 = make(); applyLandingPageSectionRhythm(a1, "k1");
    const a2 = make(); applyLandingPageSectionRhythm(a2, "k1");
    expect(a1.map(bg)).toEqual(a2.map(bg));

    // Across a spread of seed keys, at least one produces a different scheme.
    const baseline = a1.map(bg).join(",");
    let sawDifferent = false;
    for (let i = 0; i < 50; i++) {
      const b = make();
      applyLandingPageSectionRhythm(b, `seed-${i}`);
      if (b.map(bg).join(",") !== baseline) sawDifferent = true;
    }
    expect(sawDifferent).toBe(true);
  });

  it("leaves heroes, dark-required, dso-*, and dark/accent sections untouched", () => {
    const input = [
      { type: "hero", id: "a", props: { backgroundStyle: "dark" } },
      { type: "benefits-grid", id: "b", props: { backgroundStyle: "white" } },
      { type: "dso-problem", id: "c", props: { backgroundStyle: "black" } },
      { type: "bottom-cta", id: "d", props: { backgroundStyle: "dandy-green" } },
      { type: "features", id: "e", props: { backgroundStyle: "white" } },
    ];
    applyLandingPageSectionRhythm(input, "tenant-1::Acme::prompt");
    expect(bg(input[0])).toBe("dark"); // hero untouched
    expect(bg(input[2])).toBe("black"); // dso-* untouched
    expect(bg(input[3])).toBe("dandy-green"); // accent untouched
    // The two light supporting sections get distinct neutrals.
    expect(["white", "light-gray", "muted"]).toContain(bg(input[1]));
    expect(["white", "light-gray", "muted"]).toContain(bg(input[4]));
    expect(bg(input[1])).not.toBe(bg(input[4]));
  });

  it("seed + design(balanced) + rhythm yields a non-all-white page end to end", () => {
    // Models often omit backgroundStyle entirely; the full pipeline must still
    // produce visual separation between supporting sections.
    const input = SUPPORTING.map((type, i) => ({ type, id: `b-${i}`, props: { headline: `H${i}` } }));
    seedLandingPageSectionBackgrounds(input);
    applyDesignIntensityBackgrounds(input, "balanced");
    applyLandingPageSectionRhythm(input, "tenant-1::Acme::ordinary saas page");
    const bgs = input.map(bg) as string[];
    expect(bgs.every((v) => ["white", "light-gray", "muted"].includes(v))).toBe(true);
    expect(new Set(bgs).size).toBeGreaterThan(1);
  });
});
