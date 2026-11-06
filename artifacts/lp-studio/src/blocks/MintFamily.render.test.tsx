import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the "DSO Page (Light)" block family (mint-*,
 * Nov 2026): the second "Dandy for DSOs" artifact (Ramp / Apple register)
 * ported section by section.
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND
 * (registry defaults leak no Dandy strings); blocks never emit a broken
 * `<img src="">` and never strand copy at opacity 0 under static render;
 * every block is registered in the DSO category, tagged and in NO_REVEAL;
 * the hero renders its own top bar, the highlight bar and its numbers; the
 * close renders the inline form in "form" mode and buttons in "button" mode;
 * the comparison converts the check prefix; the FAQ opens its first answer;
 * the footer hides its footnotes when empty.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { NO_REVEAL } from "./BlockRenderer";
import { resolveMintPalette } from "./mint/mint-theme";
import { BlockMintHero } from "./BlockMintHero";
import { BlockMintProof } from "./BlockMintProof";
import { BlockMintBand } from "./BlockMintBand";
import { BlockMintFeatures } from "./BlockMintFeatures";
import { BlockMintRouter } from "./BlockMintRouter";
import { BlockMintStory } from "./BlockMintStory";
import { BlockMintComparison } from "./BlockMintComparison";
import { BlockMintSteps } from "./BlockMintSteps";
import { BlockMintFaq } from "./BlockMintFaq";
import { BlockMintReading } from "./BlockMintReading";
import { BlockMintClose } from "./BlockMintClose";
import { BlockMintFooter } from "./BlockMintFooter";

const FAMILY = [
  ["mint-hero", BlockMintHero],
  ["mint-proof", BlockMintProof],
  ["mint-band", BlockMintBand],
  ["mint-features", BlockMintFeatures],
  ["mint-router", BlockMintRouter],
  ["mint-story", BlockMintStory],
  ["mint-comparison", BlockMintComparison],
  ["mint-steps", BlockMintSteps],
  ["mint-faq", BlockMintFaq],
  ["mint-reading", BlockMintReading],
  ["mint-close", BlockMintClose],
  ["mint-footer", BlockMintFooter],
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
/** Decorative layers live in scoped <style> rules; only inline opacity:0 on copy counts as stranded. */
const withoutStyles = (s: string) => s.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<img[^>]*>/g, "");

describe("Mint family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders without a Dandy leak, a broken image or stranded opacity-0 copy", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props);
    expect(html).toContain(`data-block="${type}"`);
    expect(withoutPresetKey(html)).not.toMatch(DANDY_LEAK);
    expect(html).not.toMatch(/<img[^>]*src=""/);
    expect(withoutStyles(html)).not.toMatch(/opacity:\s*0[;"]/);
    expect(withoutPresetKey(JSON.stringify(props))).not.toMatch(DANDY_LEAK);
  });

  it("every mint block is registered in the DSO category, tagged, and in the renderer's NO_REVEAL set", () => {
    for (const [type] of FAMILY) {
      const def = BLOCK_REGISTRY.find((d) => d.type === type);
      expect(def, type).toBeTruthy();
      expect(def?.category, `${type} category`).toBe("DSO");
      expect(def?.tags?.length ?? 0, `${type} tags`).toBeGreaterThan(0);
      expect(NO_REVEAL.has(type), `${type} NO_REVEAL`).toBe(true);
    }
  });

  it("derives light tints from the brand primary/accent and a dark green for the close", () => {
    const light = resolveMintPalette({ backgroundStyle: "white" }, DEFAULT_BRAND, "#FFFFFF");
    expect(light.dark).toBe(false);
    expect(light.mint).not.toBe(light.green);
    expect(light.limeSoft).not.toBe(light.lime);
    const green = resolveMintPalette({ backgroundStyle: "dandy-green" }, DEFAULT_BRAND, "#003A30");
    expect(green.dark).toBe(true);
  });
});

describe("mint-hero — top bar, highlight, numbers", () => {
  it("renders the nav links, the CTA pair, the highlighted phrase, the floating cards and the numbers", () => {
    const d = defaultsFor("mint-hero") as { highlight: string; stats: Array<{ label: string }>; floats: unknown[] };
    const html = render(BlockMintHero as never, d);
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain("Talk to the enterprise team");
    expect(html).toContain("See the proof");
    expect(html).toContain(`>${d.highlight}<`);
    expect(html.match(/data-float-kind=/g)?.length ?? 0).toBe(d.floats.length);
    for (const s of d.stats) expect(html).toContain(s.label);
  });

  it("mounts the interactive Insights dashboard in the frame instead of the photo", () => {
    const html = render(BlockMintHero as never, { ...defaultsFor("mint-hero"), mediaKind: "dashboard", dashboardUrl: "insights/network" });
    expect(html).toContain("insights/network");
    expect(html).toContain(">Live<");
    expect(html).not.toContain("data-float-kind");
    expect(html).not.toContain('role="img"');
  });

  it("hides the top bar, the photo and the names when switched off", () => {
    const html = render(BlockMintHero as never, { ...defaultsFor("mint-hero"), showNav: false, showImage: false, names: [] });
    expect(html).not.toContain('aria-label="Primary"');
    expect(html).not.toContain("data-float-kind");
  });
});

describe("mint-close — form and button modes", () => {
  it("renders the inline form with three required inputs, three selects and the submit pill", () => {
    const html = render(BlockMintClose as never, defaultsFor("mint-close"));
    expect(html).toContain("<form");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="submit"');
    expect(html.match(/<select/g)?.length ?? 0).toBe(3);
  });

  it("renders CTA buttons instead of the form in button mode", () => {
    const html = render(BlockMintClose as never, { ...defaultsFor("mint-close"), mode: "button", ctaText: "Book a call", ctaSecondaryText: "Call us" });
    expect(html).not.toContain("<form");
    expect(html).toContain("Book a call");
    expect(html).toContain("Call us");
  });
});

describe("mint-comparison — provider column", () => {
  it("converts the check prefix into a dot and hides the third column when switched off", () => {
    const d = defaultsFor("mint-comparison") as { rows: Array<Record<string, string>>; columnCLabel: string };
    const html = render(BlockMintComparison as never, { ...d, rows: [{ need: "Scanner", provider: "✓ Included", b: "Purchase", c: "Lease" }, ...d.rows.slice(1)] });
    expect(html).toContain("Included");
    expect(html).not.toContain("✓ Included");
    const none = render(BlockMintComparison as never, { ...d, showColumnC: false });
    expect(none).not.toContain(d.columnCLabel);
  });
});

describe("mint-faq — accordion", () => {
  it("renders every question and the first answer open", () => {
    const d = defaultsFor("mint-faq") as { items: Array<{ question: string; answer: string }> };
    const html = render(BlockMintFaq as never, d);
    for (const it of d.items) expect(html).toContain(it.question.split("?")[0].slice(0, 20));
    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/aria-expanded="false"/g)?.length ?? 0).toBe(d.items.length - 1);
  });
});

describe("mint-footer — footnotes", () => {
  it("renders the numbered notes and the link row, and hides the notes when empty", () => {
    const d = defaultsFor("mint-footer") as { notes: string[]; links: Array<{ label: string }> };
    const html = render(BlockMintFooter as never, d);
    expect(html).toContain("<ol");
    // renderToStaticMarkup escapes apostrophes ("Where it&#x27;s made"); assert on the part before one.
    for (const l of d.links) expect(html).toContain(l.label.split("'")[0]);
    const none = render(BlockMintFooter as never, { ...d, notes: [] });
    expect(none).not.toContain("<ol");
  });
});
