/**
 * Premium DSO microsite blocks — normalizer field-name drift guard (Task #1422).
 *
 * Task #1421 made 5 premium DSO blocks generatable in tenant microsites by
 * adding `mergeWithDefaults` cases that coerce raw model output into the EXACT
 * renderer prop names. If a future prompt/schema tweak drifts a field name, the
 * block silently renders empty columns/visuals on a published microsite with no
 * error.
 *
 * These tests feed raw AI output (including the alias forms the model emits)
 * through the real `normalizeBlock` (which runs `mergeWithDefaults`) and assert
 * the output uses the renderer's exact field names from
 * `artifacts/lp-studio/src/lib/block-types/dso-blocks.ts` with non-empty paired
 * content where the renderer needs it. They fail the moment a normalizer case
 * stops producing a field the renderer interface declares.
 */
import { describe, expect, it } from "vitest";
import { normalizeBlock } from "./generate-microsite";

const BRAND = { name: "Acme", tagline: "Better dentistry", valuePropPairs: [] };

const propsOf = (type: string, rawProps: Record<string, unknown>) =>
  normalizeBlock({ type, props: rawProps }, 0, BRAND).props as Record<string, unknown>;

describe("premium DSO microsite blocks — normalizer field-name drift guard", () => {
  it("dso-paradigm-shift remaps oldWayBullets/newWayBullets -> oldWayItems/newWayItems with paired content", () => {
    const props = propsOf("dso-paradigm-shift", {
      headline: "A better way",
      oldWayBullets: ["Slow turnaround", "Costly remakes"],
      newWayBullets: ["Same-day results", "Predictable cost"],
    });

    // Renderer interface field names (DsoParadigmShiftBlockProps).
    expect(props.oldWayItems).toEqual(["Slow turnaround", "Costly remakes"]);
    expect(props.newWayItems).toEqual(["Same-day results", "Predictable cost"]);
    // The alias forms must not leak through as their own keys.
    expect(props.oldWayBullets).toBeUndefined();
    expect(props.newWayBullets).toBeUndefined();
    // Both columns must be non-empty so the comparison never renders blank.
    expect((props.oldWayItems as string[]).length).toBeGreaterThan(0);
    expect((props.newWayItems as string[]).length).toBeGreaterThan(0);
  });

  it("dso-paradigm-shift also accepts the canonical oldWayItems/newWayItems names", () => {
    const props = propsOf("dso-paradigm-shift", {
      oldWayItems: ["Old"],
      newWayItems: ["New"],
    });
    expect(props.oldWayItems).toEqual(["Old"]);
    expect(props.newWayItems).toEqual(["New"]);
  });

  it("dso-stat-row remaps `stats` -> `items` with value/label/detail shape", () => {
    const props = propsOf("dso-stat-row", {
      stats: [
        { value: "98%", label: "Satisfaction", detail: "across all practices" },
        { value: "2x", label: "Faster" },
      ],
    });

    // Renderer interface field name is `items` (DsoStatRowBlockProps).
    const items = props.items as Record<string, string>[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(2);
    expect(items[0]).toEqual({ value: "98%", label: "Satisfaction", detail: "across all practices" });
    expect(items[1]).toEqual({ value: "2x", label: "Faster", detail: "" });
    // The alias key must not leak through.
    expect(props.stats).toBeUndefined();
  });

  it("dso-final-cta remaps heading/ctaText -> headline/primaryCtaText", () => {
    const props = propsOf("dso-final-cta", {
      heading: "Ready to scale?",
      ctaText: "Book a demo",
      ctaUrl: "https://example.com/demo",
    });

    // Renderer interface field names (DsoFinalCtaBlockProps).
    expect(props.headline).toBe("Ready to scale?");
    expect(props.primaryCtaText).toBe("Book a demo");
    expect(props.primaryCtaUrl).toBe("https://example.com/demo");
    expect(typeof props.secondaryCtaText).toBe("string");
    expect(typeof props.secondaryCtaUrl).toBe("string");
    // Headline must never be empty so the closing CTA always has a title.
    expect((props.headline as string).length).toBeGreaterThan(0);
    expect((props.primaryCtaText as string).length).toBeGreaterThan(0);
  });

  it("dso-software-showcase remaps feature `title` -> `label` and leaves imageUrl empty for the fill pass", () => {
    const props = propsOf("dso-software-showcase", {
      headline: "Software that works",
      features: [
        { icon: "zap", title: "Fast scans" },
        { label: "Cloud sync" },
      ],
    });

    // Renderer interface field names (DsoSoftwareShowcaseBlockProps).
    const features = props.features as Record<string, string>[];
    expect(features.length).toBe(2);
    expect(features[0]).toEqual({ icon: "zap", label: "Fast scans" });
    expect(features[1].label).toBe("Cloud sync");
    // Every feature must carry a non-empty label so chips never render blank.
    for (const f of features) {
      expect(f.label.length).toBeGreaterThan(0);
    }
    // Image-bearing block: imageUrl is present but empty so the image-fill pass
    // supplies a real image instead of the visual collapsing.
    expect(props.imageUrl).toBe("");
  });

  it("dso-ai-feature keeps bullets/stats and leaves imageUrl empty for the fill pass", () => {
    const props = propsOf("dso-ai-feature", {
      headline: "AI that helps",
      bullets: ["Auto-detect margins", "Flag remakes early"],
      stats: [
        { value: "40%", label: "Fewer remakes" },
      ],
    });

    // Renderer interface field names (DsoAiFeatureBlockProps).
    expect(props.bullets).toEqual(["Auto-detect margins", "Flag remakes early"]);
    const stats = props.stats as Record<string, string>[];
    expect(stats).toEqual([{ value: "40%", label: "Fewer remakes" }]);
    expect((props.bullets as string[]).length).toBeGreaterThan(0);
    expect(stats.length).toBeGreaterThan(0);
    // Image-bearing block: imageUrl present but empty for the fill pass.
    expect(props.imageUrl).toBe("");
  });
});
