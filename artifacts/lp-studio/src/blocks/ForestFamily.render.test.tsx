import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the "DSO Page" block family (forest-*, Nov
 * 2026): the premium "Dandy for DSOs" artifact ported section by section.
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND
 * (registry defaults leak no Dandy strings); blocks never emit a broken
 * `<img src="">` and never strand content at opacity 0 under static render;
 * every block is registered, tagged and in NO_REVEAL; the hero renders its
 * own top bar and four numbers; the close renders the inline form in "form"
 * mode and buttons in "button" mode; the comparison renders the provider
 * column with the check prefix converted; the FAQ opens its first answer.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { NO_REVEAL } from "./BlockRenderer";
import { resolveForestPalette } from "./forest/forest-theme";
import { BlockForestHero } from "./BlockForestHero";
import { BlockForestLogos } from "./BlockForestLogos";
import { BlockForestProof } from "./BlockForestProof";
import { BlockForestConvergence } from "./BlockForestConvergence";
import { BlockForestRouter } from "./BlockForestRouter";
import { BlockForestStory } from "./BlockForestStory";
import { BlockForestSystem } from "./BlockForestSystem";
import { BlockForestComparison } from "./BlockForestComparison";
import { BlockForestBuyers } from "./BlockForestBuyers";
import { BlockForestFaq } from "./BlockForestFaq";
import { BlockForestReading } from "./BlockForestReading";
import { BlockForestClose } from "./BlockForestClose";
import { BlockForestFooter } from "./BlockForestFooter";

const FAMILY = [
  ["forest-hero", BlockForestHero],
  ["forest-logos", BlockForestLogos],
  ["forest-proof", BlockForestProof],
  ["forest-convergence", BlockForestConvergence],
  ["forest-router", BlockForestRouter],
  ["forest-story", BlockForestStory],
  ["forest-system", BlockForestSystem],
  ["forest-comparison", BlockForestComparison],
  ["forest-buyers", BlockForestBuyers],
  ["forest-faq", BlockForestFaq],
  ["forest-reading", BlockForestReading],
  ["forest-close", BlockForestClose],
  ["forest-footer", BlockForestFooter],
] as const;

function defaultsFor(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function render(Component: (p: never) => ReactElement, props: Record<string, unknown>, staticRender = true): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND } as never);
  return renderToStaticMarkup(staticRender ? createElement(StaticRenderContext.Provider, { value: true }, el) : el);
}

const DANDY_LEAK = /meetdandy|#003a30|#00261f|#c7e738|\bDandy\b|\bProvo\b|Indianapolis|Dental Care Alliance|Apex Dental|Enable Dental|Vision scanner/i;
/** "dandy-green" is the legacy storage key of the brand-colour preset (and its CSS variable), not a leak. */
const withoutPresetKey = (s: string) => s.replace(/dandy-green/g, "brand-preset");
/** Decorative hover layers live in scoped <style> rules and the system block's sticky frame stacks every
 *  step image with only the active one visible; only inline opacity:0 on COPY counts as stranded. */
const withoutStyles = (s: string) => s.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<img[^>]*>/g, "");

describe("Forest family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders without a Dandy leak, a broken image or stranded opacity-0 content", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props);
    expect(html).toContain(`data-block="${type}"`);
    expect(withoutPresetKey(html)).not.toMatch(DANDY_LEAK);
    expect(html).not.toMatch(/<img[^>]*src=""/);
    if (type === "forest-system") {
      // The sticky frame stacks every step image and shows only the active one:
      // exactly steps-1 layers sit at opacity 0, and every step's copy is present.
      const steps = props.steps as Array<{ title: string }>;
      expect(withoutStyles(html).match(/opacity:\s*0[;"]/g)?.length ?? 0).toBe(steps.length - 1);
      for (const st of steps) expect(html).toContain(st.title);
    } else {
      expect(withoutStyles(html)).not.toMatch(/opacity:\s*0[;"]/);
    }
    expect(withoutPresetKey(JSON.stringify(props))).not.toMatch(DANDY_LEAK);
  });

  it("every forest block is registered in the DSO category, tagged, and in the renderer's NO_REVEAL set", () => {
    for (const [type] of FAMILY) {
      const def = BLOCK_REGISTRY.find((d) => d.type === type);
      expect(def, type).toBeTruthy();
      expect(def?.category, `${type} category`).toBe("DSO");
      expect(def?.tags?.length ?? 0, `${type} tags`).toBeGreaterThan(0);
      expect(NO_REVEAL.has(type), `${type} NO_REVEAL`).toBe(true);
    }
  });

  it("derives a dark sunk surface for the forest bands and a light one for sand", () => {
    const forest = resolveForestPalette({ backgroundStyle: "dandy-green" }, DEFAULT_BRAND, "#003A30");
    expect(forest.dark).toBe(true);
    expect(forest.deep).not.toBe(forest.base);
    const sand = resolveForestPalette({ backgroundStyle: "muted" }, DEFAULT_BRAND, "#F6F4EE");
    expect(sand.dark).toBe(false);
  });
});

describe("forest-hero — own top bar, headline words, numbers", () => {
  it("renders the nav links, the two CTAs, the scan card and four numbers", () => {
    const d = defaultsFor("forest-hero");
    const html = render(BlockForestHero as never, d);
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain("Talk to the enterprise team");
    expect(html).toContain("See the proof");
    expect(html).toContain("AI scan review");
    // Count-ups start at 0 before hydration (StatCounter); assert the labels.
    for (const stat of (d.stats as Array<{ label: string }>)) expect(html).toContain(stat.label);
  });

  it("hides the top bar and the card when switched off", () => {
    const html = render(BlockForestHero as never, { ...defaultsFor("forest-hero"), showNav: false, showCard: false });
    expect(html).not.toContain('aria-label="Primary"');
    expect(html).not.toContain("AI scan review");
  });
});

describe("forest-close — form and button modes", () => {
  it("renders the inline form with the three required inputs and the submit pill in form mode", () => {
    const html = render(BlockForestClose as never, defaultsFor("forest-close"));
    expect(html).toContain("<form");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="submit"');
    expect(html.match(/<select/g)?.length ?? 0).toBe(4);
  });

  it("drops the selects that are switched off", () => {
    const html = render(BlockForestClose as never, { ...defaultsFor("forest-close"), askRole: false, askWhy: false });
    expect(html.match(/<select/g)?.length ?? 0).toBe(2);
  });

  it("renders CTA buttons instead of the form in button mode", () => {
    const html = render(BlockForestClose as never, { ...defaultsFor("forest-close"), mode: "button", ctaText: "Book a call", ctaSecondaryText: "Call us" });
    expect(html).not.toContain("<form");
    expect(html).toContain("Book a call");
    expect(html).toContain("Call us");
  });
});

describe("forest-comparison — provider column", () => {
  it("renders the four column labels and converts the check prefix into an icon", () => {
    const d = defaultsFor("forest-comparison") as { rows: Array<Record<string, string>> };
    const html = render(BlockForestComparison as never, { ...d, rows: [{ need: "Scanner", provider: "✓ Included", b: "Purchase", c: "Lease" }, ...d.rows.slice(1)] });
    expect(html).toContain("Our platform");
    expect(html).toContain("<svg");
    expect(html).toContain("Included");
    expect(html).not.toContain("✓ Included");
  });

  it("hides the third column when switched off", () => {
    const d = defaultsFor("forest-comparison") as { columnCLabel: string };
    const html = render(BlockForestComparison as never, { ...d, showColumnC: false });
    expect(html).not.toContain(d.columnCLabel);
  });
});

describe("forest-faq — accordion", () => {
  it("renders every question and the first answer open", () => {
    const d = defaultsFor("forest-faq") as { items: Array<{ question: string; answer: string }> };
    const html = render(BlockForestFaq as never, d);
    for (const it of d.items) expect(html).toContain(it.question.split("?")[0].slice(0, 20));
    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/aria-expanded="false"/g)?.length ?? 0).toBe(d.items.length - 1);
  });
});

describe("forest-footer — sources", () => {
  it("renders the link columns and the numbered notes, and hides the notes when empty", () => {
    const d = defaultsFor("forest-footer") as { notes: string[]; columns: Array<{ title: string }> };
    const html = render(BlockForestFooter as never, d);
    expect(html).toContain("<footer");
    expect(html).toContain("<ol");
    for (const c of d.columns) expect(html).toContain(c.title);
    const none = render(BlockForestFooter as never, { ...d, notes: [] });
    expect(none).not.toContain("<ol");
  });
});
