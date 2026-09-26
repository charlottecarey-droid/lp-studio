import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR smoke + contract test for the Invite block family (Sept 2026): the dark
 * editorial invitation-style demo page (invite-demo-hero, invite-details,
 * invite-agenda, invite-showcase, invite-proof, invite-reserve).
 *
 * Pins: every block renders its default copy under the neutral DEFAULT_BRAND
 * on a DARK surface derived from the brand primary; registry defaults leak no
 * Dandy strings; the hero renders its own top bar and jump CTA (and the inline
 * form variant when asked); the reserve form posts the configured fields with
 * a required email and shows the booking link only when a URL is set.
 */
import { StaticRenderContext } from "@/lib/reveal-fallback";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { relativeLuminance } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import { resolveInvitePalette } from "@/lib/invite-theme";
import { BlockInviteDemoHero } from "./BlockInviteDemoHero";
import { BlockInviteDetails } from "./BlockInviteDetails";
import { BlockInviteAgenda } from "./BlockInviteAgenda";
import { BlockInviteShowcase } from "./BlockInviteShowcase";
import { BlockInviteProof } from "./BlockInviteProof";
import { BlockInviteReserve } from "./BlockInviteReserve";

const FAMILY = [
  ["invite-demo-hero", BlockInviteDemoHero],
  ["invite-details", BlockInviteDetails],
  ["invite-agenda", BlockInviteAgenda],
  ["invite-showcase", BlockInviteShowcase],
  ["invite-proof", BlockInviteProof],
  ["invite-reserve", BlockInviteReserve],
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

const DANDY_LEAK = /meetdandy|#003a30|#00231d|#c7e738|\bDandy\b/i;

describe("Invite family — palette", () => {
  it("derives a dark surface from any brand primary and an accent that reads on it", () => {
    const neutral = resolveInvitePalette({}, DEFAULT_BRAND);
    expect(relativeLuminance(neutral.bg)).toBeLessThan(0.08);
    expect(neutral.text).toBe("#FFFFFF");
    const pastel = resolveInvitePalette({}, { ...DEFAULT_BRAND, primaryColor: "#F5D0E0", accentColor: "#F7B5CF" });
    expect(relativeLuminance(pastel.bg)).toBeLessThan(0.08);
  });
});

describe("Invite family — registry defaults render on the neutral brand", () => {
  it.each(FAMILY)("%s renders its default headline, on a dark surface, with no Dandy leak", (type, Component) => {
    const props = defaultsFor(type);
    const html = render(Component as never, props, true);
    const headline = ((props.headline as string) ?? (props.quote as string) ?? "").split("\n")[0];
    expect(headline.length).toBeGreaterThan(0);
    expect(html).toContain(headline.split("'")[0].slice(0, 10));
    expect(html).not.toMatch(DANDY_LEAK);
    expect(html).toMatch(/<section[^>]*style="[^"]*background:#0/);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});

describe("invite-demo-hero — own nav + CTA contract", () => {
  it("renders the sticky top bar with a CTA and the jump CTA pair by default", () => {
    const html = render(BlockInviteDemoHero as never, defaultsFor("invite-demo-hero"));
    expect(html).toMatch(/class="sticky top-0/);
    expect(html).toContain('href="#reserve"');
    expect(html).toContain('href="#agenda"');
    expect(html).not.toContain("<form");
  });

  it("heroForm=inline renders the compact form in the hero instead of the CTA pair", () => {
    const html = render(BlockInviteDemoHero as never, { ...defaultsFor("invite-demo-hero"), heroForm: "inline" });
    expect(html).toContain("<form");
    expect(html).toMatch(/name="email"[^>]*required|required[^>]*name="email"/);
  });

  it("renders a background clip when a native video URL is set", () => {
    const html = render(BlockInviteDemoHero as never, { ...defaultsFor("invite-demo-hero"), backgroundVideoUrl: "/videos/lab.mp4" });
    expect(html).toMatch(/<video[^>]*src="\/videos\/lab\.mp4"/);
  });
});

describe("invite-reserve — form contract", () => {
  it("renders the configured fields with a required email and the booking link when a URL is set", () => {
    const html = render(BlockInviteReserve as never, {
      ...defaultsFor("invite-reserve"),
      fields: ["name", "email", "phone", "locations"],
      chilipiperUrl: "https://example.chilipiper.com/x",
    });
    expect(html).toMatch(/<input[^>]*name="name"/);
    expect(html).toMatch(/name="email"[^>]*required|required[^>]*name="email"/);
    expect(html).toMatch(/<input[^>]*name="phone"/);
    expect(html).toMatch(/<select[^>]*name="locations"/);
    expect(html).not.toMatch(/name="company"/);
    expect(html).toContain("or pick a time now");
    expect(html).toContain('id="reserve"');
  });

  it("omits the booking link without a URL and supports the message textarea", () => {
    const html = render(BlockInviteReserve as never, { ...defaultsFor("invite-reserve"), chilipiperUrl: "", fields: ["name", "email", "message"] });
    expect(html).not.toContain("or pick a time now");
    expect(html).toMatch(/<textarea[^>]*name="message"/);
  });
});

describe("invite-showcase — accent phrase", () => {
  it("wraps the accent phrase inside the headline in the accent color", () => {
    const html = render(BlockInviteShowcase as never, { ...defaultsFor("invite-showcase"), headline: "Where precision meets scale.", headlineAccent: "scale" });
    expect(html).toMatch(/<span style="color:[^"]+">scale<\/span>/);
  });
});
