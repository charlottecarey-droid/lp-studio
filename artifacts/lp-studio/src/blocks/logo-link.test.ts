import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * The four blocks under test pull in browser-only leaf components (modals,
 * Chili Piper button, image picker) that touch `window`/portals at render time
 * and are irrelevant to the logo→website link. Stub them so each render is a
 * pure, node-safe SSR pass that still exercises the real `getLogoLinkUrl`
 * wiring and the `<a>` wrapper each block emits around its `BrandLogo`.
 */
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));
vi.mock("@/components/ChiliPiperButton", () => ({ ChiliPiperButton: () => null }));
vi.mock("@/components/CtaButton", () => ({ CtaButton: () => null }));
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null }));
vi.mock("./ChiliPiperModal", () => ({ ChiliPiperModal: () => null }));

import { BlockNavHeader } from "./BlockNavHeader";
import { BlockHero } from "./BlockHero";
import { BlockFooter } from "./BlockFooter";
import { BlockFullBleedHero } from "./BlockFullBleedHero";
import { DEFAULT_BRAND, getLogoLinkUrl, type BrandConfig } from "@/lib/brand-config";

/**
 * A raster (non-SVG) logo so `BrandLogo` renders a plain `<img src=…>` (its
 * auto-recolor path only triggers for SVGs). This gives every block a single,
 * uniquely identifiable logo node to locate in the rendered markup.
 */
const LOGO_SRC = "https://cdn.example/logo.png";
const WEBSITE_URL = "https://acme.example";

function brandWith(overrides: Partial<BrandConfig>): BrandConfig {
  return {
    ...DEFAULT_BRAND,
    brandName: "Acme",
    logoUrl: LOGO_SRC,
    // SVG auto-recolor off is implied by the .png src; keep raster <img>.
    logoAutoRecolor: false,
    ...overrides,
  };
}

/**
 * Return the opening `<a …>` tag that directly wraps the brand logo `<img>`,
 * or null when the logo is not wrapped in an anchor. Works by locating the
 * unique logo `<img>` and walking back to the nearest preceding `<a `, then
 * confirming no `</a>` sits between them (i.e. that anchor really does wrap
 * the logo rather than being an earlier, unrelated link).
 */
function logoAnchorTag(markup: string): string | null {
  const imgIdx = markup.indexOf(`<img src="${LOGO_SRC}"`);
  if (imgIdx === -1) {
    throw new Error("logo <img> not found in rendered markup");
  }
  const before = markup.slice(0, imgIdx);
  const aIdx = before.lastIndexOf("<a ");
  if (aIdx === -1) return null;
  if (markup.slice(aIdx, imgIdx).includes("</a>")) return null;
  const end = markup.indexOf(">", aIdx);
  return markup.slice(aIdx, end + 1);
}

function navMarkup(brand: BrandConfig): string {
  return renderToStaticMarkup(
    createElement(BlockNavHeader, {
      brand,
      props: {
        logoUrl: "",
        logoText: "Acme",
        navLinks: [],
        cta1: { label: "", url: "#" },
        cta2: { label: "", url: "#" },
      },
    } as never),
  );
}

function heroMarkup(brand: BrandConfig): string {
  return renderToStaticMarkup(
    createElement(BlockHero, {
      brand,
      animationsEnabled: false,
      props: {
        headline: "Headline",
        subheadline: "",
        ctaText: "Get started",
        ctaUrl: "#",
        ctaAction: "url",
        // Explicit empty image → no media render path, no Dandy fallback.
        imageUrl: "",
        heroType: "none",
        layout: "stacked",
        backgroundStyle: "white",
        showSocialProof: false,
      },
    } as never),
  );
}

function footerMarkup(brand: BrandConfig): string {
  return renderToStaticMarkup(
    createElement(BlockFooter, {
      brand,
      props: { columns: [] },
    } as never),
  );
}

const FULL_BLEED_FALLBACK_URL = "https://fallback.example";

function fullBleedMarkup(brand: BrandConfig): string {
  return renderToStaticMarkup(
    createElement(BlockFullBleedHero, {
      brand,
      animationsEnabled: false,
      props: {
        headline: "Headline",
        subheadline: "",
        ctaText: "Get started",
        ctaUrl: "#",
        ctaAction: "url",
        backgroundType: "image",
        backgroundImageUrl: "",
        overlayOpacity: 50,
        minHeight: "full",
        contentAlignment: "center",
        navLinks: [],
        // Block-level logo image comes from the brand; `logoUrl` here is the
        // block's own fallback LINK target used when the brand flag is off.
        logoImageUrl: "",
        logoUrl: FULL_BLEED_FALLBACK_URL,
      },
    } as never),
  );
}

describe("getLogoLinkUrl", () => {
  it("returns null when the link flag is off (even with a website URL set)", () => {
    expect(
      getLogoLinkUrl(brandWith({ logoLinkEnabled: false, websiteUrl: WEBSITE_URL })),
    ).toBeNull();
  });

  it("returns null when the flag is on but no website URL is set", () => {
    expect(
      getLogoLinkUrl(brandWith({ logoLinkEnabled: true, websiteUrl: "" })),
    ).toBeNull();
  });

  it("returns the trimmed URL when the flag is on and a valid URL is set", () => {
    expect(
      getLogoLinkUrl(brandWith({ logoLinkEnabled: true, websiteUrl: `  ${WEBSITE_URL}  ` })),
    ).toBe(WEBSITE_URL);
  });

  it("returns null when the flag is on but the URL is whitespace-only", () => {
    expect(
      getLogoLinkUrl(brandWith({ logoLinkEnabled: true, websiteUrl: "   " })),
    ).toBeNull();
  });
});

/**
 * Render-level regression guard: each of the four blocks must wrap its logo in
 * a new-tab anchor pointing at the brand website ONLY when the opt-in flag is
 * on and a URL is configured, and leave the logo unwrapped otherwise.
 */
describe.each([
  { name: "BlockNavHeader", render: navMarkup },
  { name: "BlockHero", render: heroMarkup },
  { name: "BlockFooter", render: footerMarkup },
])("$name logo link", ({ render }) => {
  it("wraps the logo in a new-tab anchor when enabled with a URL", () => {
    const markup = render(brandWith({ logoLinkEnabled: true, websiteUrl: WEBSITE_URL }));
    const anchor = logoAnchorTag(markup);
    expect(anchor).not.toBeNull();
    expect(anchor).toContain(`href="${WEBSITE_URL}"`);
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener noreferrer"');
  });

  it("leaves the logo unlinked when the flag is off", () => {
    const markup = render(brandWith({ logoLinkEnabled: false, websiteUrl: WEBSITE_URL }));
    expect(logoAnchorTag(markup)).toBeNull();
  });

  it("leaves the logo unlinked when enabled but no URL is set", () => {
    const markup = render(brandWith({ logoLinkEnabled: true, websiteUrl: "" }));
    expect(logoAnchorTag(markup)).toBeNull();
  });
});

/**
 * The hero logo lives in the top nav, which paints `brand.navBgColor` (not the
 * hero body surface). A raster logo (auto-recolor off) is force-whitened only on
 * a DARK surface; on a light nav it must render in its native colors so it does
 * not vanish into a white-on-light silhouette. These guard that the nav logo
 * tone tracks `navBgColor`.
 */
function heroImgTag(markup: string): string {
  const imgIdx = markup.indexOf(`<img src="${LOGO_SRC}"`);
  if (imgIdx === -1) throw new Error("logo <img> not found in rendered markup");
  const end = markup.indexOf(">", imgIdx);
  return markup.slice(imgIdx, end + 1);
}

const WHITEN_FILTER = "filter:brightness(0) invert(1)";

describe("BlockHero nav logo tone follows navBgColor", () => {
  it("whitens the logo on a dark nav background", () => {
    const markup = heroMarkup(brandWith({ navBgColor: "#000000" }));
    expect(heroImgTag(markup)).toContain(WHITEN_FILTER);
  });

  it("leaves the logo in native colors on a light nav background", () => {
    const markup = heroMarkup(brandWith({ navBgColor: "#ffffff" }));
    expect(heroImgTag(markup)).not.toContain(WHITEN_FILTER);
  });
});

describe("BlockFullBleedHero logo link", () => {
  it("wraps the logo in a new-tab anchor to the website when enabled", () => {
    const markup = fullBleedMarkup(brandWith({ logoLinkEnabled: true, websiteUrl: WEBSITE_URL }));
    const anchor = logoAnchorTag(markup);
    expect(anchor).not.toBeNull();
    expect(anchor).toContain(`href="${WEBSITE_URL}"`);
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener noreferrer"');
  });

  it("falls back to its own logoUrl (same-tab, no website link) when the flag is off", () => {
    const markup = fullBleedMarkup(brandWith({ logoLinkEnabled: false, websiteUrl: WEBSITE_URL }));
    const anchor = logoAnchorTag(markup);
    expect(anchor).not.toBeNull();
    expect(anchor).toContain(`href="${FULL_BLEED_FALLBACK_URL}"`);
    expect(anchor).not.toContain('target="_blank"');
  });

  it("falls back to its own logoUrl when enabled but no website URL is set", () => {
    const markup = fullBleedMarkup(brandWith({ logoLinkEnabled: true, websiteUrl: "" }));
    const anchor = logoAnchorTag(markup);
    expect(anchor).not.toBeNull();
    expect(anchor).toContain(`href="${FULL_BLEED_FALLBACK_URL}"`);
    expect(anchor).not.toContain('target="_blank"');
  });
});
