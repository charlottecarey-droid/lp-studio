import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the Kit block family (Oct 2026): the page a
 * physical kit's QR code opens (kit-hero, kit-contents, kit-steps,
 * kit-support).
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND
 * on a DARK surface derived from the brand primary; registry defaults leak no
 * Dandy strings; blocks without images never emit a broken `<img src="">` and
 * never hide content at opacity 0; the hero renders its own sticky top bar and
 * the jump CTA pair; the steps block renders six code cells (filled only when
 * a code is set), the store listing and the stream chips; the support close
 * falls back to a mailto: when only an email is given.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { relativeLuminance } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { resolveInvitePalette } from "@/lib/invite-theme";
import { BlockKitHero } from "./BlockKitHero";
import { BlockKitContents } from "./BlockKitContents";
import { BlockKitSteps } from "./BlockKitSteps";
import { BlockKitSupport } from "./BlockKitSupport";

const FAMILY = [
  ["kit-hero", BlockKitHero],
  ["kit-contents", BlockKitContents],
  ["kit-steps", BlockKitSteps],
  ["kit-support", BlockKitSupport],
] as const;

function defaultsFor(type: string): Record<string, unknown> {
  const def = BLOCK_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`missing registry entry: ${type}`);
  return def.defaultProps() as Record<string, unknown>;
}

function render(Component: (p: never) => ReactElement, props: Record<string, unknown>, staticRender = false): string {
  const el = createElement(Component as never, { props, brand: DEFAULT_BRAND } as never);
  return renderToStaticMarkup(staticRender ? createElement(StaticRenderContext.Provider, { value: true }, el) : el);
}

const DANDY_LEAK = /meetdandy|#003a30|#00231d|#c7e738|\bDandy\b|Immersa|Meta Quest|Fusion Denture/i;

describe("Kit family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders its default headline, on a dark surface, with no Dandy / kit-specific leak", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props, true);
    const headline = ((props.headline as string) ?? "").split("\n")[0];
    expect(headline.length).toBeGreaterThan(0);
    expect(html).toContain(headline.split("'")[0].slice(0, 10));
    expect(html).not.toMatch(DANDY_LEAK);
    expect(html).toMatch(/<section[^>]*style="[^"]*background:#0/);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    expect(html).not.toMatch(/<img[^>]*src=""/);
  });

  it("derives the same dark palette as the Invite family (one idiom)", () => {
    const pal = resolveInvitePalette({}, DEFAULT_BRAND);
    expect(relativeLuminance(pal.bg)).toBeLessThan(0.08);
  });
});

describe("kit-hero — own top bar + product stage contract", () => {
  it("renders the sticky top bar, the jump CTA pair and the fallback glyph tiles without images", () => {
    const html = render(BlockKitHero as never, defaultsFor("kit-hero"), true);
    expect(html).toMatch(/class="sticky top-0/);
    expect(html).toContain('href="#steps"');
    expect(html).toContain('href="#inside"');
    expect(html).toContain('href="#help"');
    expect(html).not.toMatch(/<img/);
  });

  it("multiplies a contain-fit product shot onto the light tile and covers with a cover-fit one", () => {
    const html = render(BlockKitHero as never, { ...defaultsFor("kit-hero"), heroImageUrl: "/images/kit/a.webp", secondaryImageUrl: "/images/kit/b.webp" }, true);
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    const a = imgs.find((t) => t.includes('src="/images/kit/a.webp"')) ?? "";
    const b = imgs.find((t) => t.includes('src="/images/kit/b.webp"')) ?? "";
    expect(a).toContain("mix-blend-mode:multiply");
    expect(a).toContain("object-contain");
    expect(b).toContain("object-cover");
    expect(b).not.toContain("mix-blend-mode");
  });
});

describe("kit-steps — inline visuals", () => {
  it("renders six empty code cells by default and fills them when a code is set", () => {
    const empty = render(BlockKitSteps as never, defaultsFor("kit-steps"), true);
    expect(empty.match(/data-kit-visual="code"/g)).toHaveLength(1);
    expect(empty).toContain("Six-digit access code");
    expect(empty).toContain("Your code is on the card in the box.");

    const filled = render(BlockKitSteps as never, { ...defaultsFor("kit-steps"), code: "48-21 93" }, true);
    expect(filled).toContain("Access code 4 8 2 1 9 3");
    expect(filled).toMatch(/>4<\/span>/);
  });

  it("renders the store listing and the stream chips from the step visuals", () => {
    const html = render(BlockKitSteps as never, defaultsFor("kit-steps"), true);
    expect(html).toMatch(/data-kit-visual="store"/);
    expect(html).toContain("Companion app");
    expect(html).toContain(">Get<");
    expect(html).toMatch(/data-kit-visual="stream"/);
    expect(html).toContain("Download");
  });

  it("renders a help link only when both text and URL are set", () => {
    const base = defaultsFor("kit-steps") as { steps: Array<Record<string, unknown>> };
    const steps = [{ ...base.steps[0], linkText: "Setup help", linkUrl: "https://example.com/help" }, { ...base.steps[1], linkText: "No URL" }];
    const html = render(BlockKitSteps as never, { ...base, steps }, true);
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com\/help"[^>]*target="_blank"/);
    expect(html).not.toContain("No URL");
  });
});

describe("kit-support — contact contract", () => {
  it("falls back to mailto: for the CTA when only an email is given and renders tel: for the phone", () => {
    const html = render(BlockKitSupport as never, { ...defaultsFor("kit-support"), email: "help@example.com", phone: "(555) 010-2030", linkUrl: "https://example.com/tour" }, true);
    expect(html).toContain('href="mailto:help@example.com"');
    expect(html).toContain('href="tel:5550102030"');
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com\/tour"[^>]*target="_blank"/);
    expect(html).toContain('id="help"');
  });

  it("omits the share link without a URL", () => {
    const html = render(BlockKitSupport as never, { ...defaultsFor("kit-support"), linkUrl: "" }, true);
    expect(html).not.toContain("Book a live tour");
  });
});
