import { describe, it, expect } from "vitest";
import {
  collectImageSlots,
  fillEmptyImages,
  sanitizeAIImageUrls,
  reapplyEventPageImagery,
  applyEventPageBranding,
  enforceAiModes,
  type MediaImage,
} from "./generate-page";

// A small tenant library with an event-grade hero (lp-hero) plus two supporting
// gallery photos (lp-feature). Mirrors the fixtures in generate-page.images.test.ts.
const EVENT_LIB: MediaImage[] = [
  { url: "/objects/event-hero-1", title: "Conference keynote main stage", tags: ["lp-hero", "event", "conference", "stage"] },
  { url: "/objects/event-photo-1", title: "Networking reception", tags: ["lp-feature", "event", "networking"] },
  { url: "/objects/event-photo-2", title: "Hands-on workshop session", tags: ["lp-feature", "event", "workshop"] },
];

const EVENT_CTX = "annual summit conference event keynote networking workshop";

function eventPage(props: Record<string, unknown>): Record<string, unknown> {
  return { id: "ev-1", type: "event-page", props };
}

describe("event-page imagery — sanitizeAIImageUrls", () => {
  it("clears the baked-in /event-assets/* Dandy placeholder hero + gallery photos", () => {
    // The block registry ships event-page with Dandy-specific placeholder imagery
    // (/event-assets/hero-provo.jpg + carousel photos). These are neither library
    // rows nor allowed serve paths, so sanitize must blank them so a non-Dandy
    // tenant's generated event page can pick up its own brand imagery downstream.
    let blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/event-assets/hero-provo.jpg",
      photos: [
        { src: "/event-assets/carousel-hotel.jpg", alt: "Hotel", caption: "The Grand America" },
        { src: "/event-assets/carousel-spa.jpg", alt: "Spa", caption: "Spa & Wellness" },
      ],
    })];
    blocks = sanitizeAIImageUrls(blocks, EVENT_LIB) as Array<Record<string, unknown>>;
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("");
    for (const p of props.photos as Array<{ src: string }>) expect(p.src).toBe("");
  });

  it("keeps real library URLs and clears only hallucinated/off-library hosts", () => {
    let blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/objects/event-hero-1",
      photos: [
        { src: "/objects/event-photo-1", alt: "Networking", caption: "Reception" },
        { src: "https://images.unsplash.com/photo-999", alt: "Off", caption: "Off-library" },
      ],
    })];
    blocks = sanitizeAIImageUrls(blocks, EVENT_LIB) as Array<Record<string, unknown>>;
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    const photos = props.photos as Array<{ src: string }>;
    expect(photos[0].src).toBe("/objects/event-photo-1");
    expect(photos[1].src).toBe("");
  });

  it("does not touch photos on a non-event-page block (gate is event-page-only)", () => {
    let blocks: Array<Record<string, unknown>> = [
      { type: "hero", props: { photos: [{ src: "/event-assets/carousel-hotel.jpg" }] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, EVENT_LIB) as Array<Record<string, unknown>>;
    const props = blocks[0].props as Record<string, unknown>;
    expect((props.photos as Array<{ src: string }>)[0].src).toBe("/event-assets/carousel-hotel.jpg");
  });
});

describe("event-page imagery — fillEmptyImages", () => {
  it("fills an empty hero (lp-hero) and empty gallery photos (lp-feature) from the library", () => {
    let blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "",
      photos: [
        { src: "", alt: "Networking reception", caption: "Reception" },
        { src: "", alt: "Workshop", caption: "Session" },
      ],
    })];
    blocks = fillEmptyImages(blocks, EVENT_LIB, EVENT_CTX) as Array<Record<string, unknown>>;
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    const srcs = (props.photos as Array<{ src: string }>).map((p) => p.src);
    for (const s of srcs) expect(s).toBeTruthy();
    expect(new Set(srcs).size).toBe(srcs.length); // distinct
    // gallery photos draw from the lp-feature pool, never the hero image
    for (const s of srcs) expect(s).not.toBe("/objects/event-hero-1");
  });

  it("leaves an already-set hero/photo untouched (only empty slots fill)", () => {
    let blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/objects/event-hero-1",
      photos: [{ src: "/objects/event-photo-2", alt: "Workshop", caption: "Session" }],
    })];
    blocks = fillEmptyImages(blocks, EVENT_LIB, EVENT_CTX) as Array<Record<string, unknown>>;
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    expect((props.photos as Array<{ src: string }>)[0].src).toBe("/objects/event-photo-2");
  });

  it("end-to-end: baked-in Dandy placeholders are sanitized then swapped for brand imagery", () => {
    let blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/event-assets/hero-provo.jpg",
      photos: [{ src: "/event-assets/carousel-hotel.jpg", alt: "Networking reception", caption: "Reception" }],
    })];
    blocks = sanitizeAIImageUrls(blocks, EVENT_LIB) as Array<Record<string, unknown>>;
    blocks = fillEmptyImages(blocks, EVENT_LIB, EVENT_CTX) as Array<Record<string, unknown>>;
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    const src = (props.photos as Array<{ src: string }>)[0].src;
    expect(src.startsWith("/objects/")).toBe(true);
    expect(src).not.toContain("/event-assets/");
  });
});

// Curated catalog defaults for the event-page block — the Dandy-specific
// /event-assets/* placeholder files that enforceAiModes reverts a governed
// (copy/locked) block's imagery to. Mirrors the block-registry defaults.
const EVENT_PAGE_CATALOG_DEFAULTS = {
  heroImageUrl: "/event-assets/hero-provo.jpg",
  photos: [
    { src: "/event-assets/carousel-hotel.jpg", alt: "Hotel", caption: "The Grand America" },
    { src: "/event-assets/carousel-spa.jpg", alt: "Spa", caption: "Spa & Wellness" },
  ],
};

describe("event-page imagery — reapplyEventPageImagery (post-governance safeguard)", () => {
  it("clears reverted /event-assets/* placeholders and refills hero+gallery from the library", () => {
    // Simulates the state AFTER enforceAiModes reverted a governed event-page's
    // imagery to the catalog defaults: heroImageUrl + every photo point at the
    // Dandy /event-assets/* placeholders.
    const blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/event-assets/hero-provo.jpg",
      photos: [
        { src: "/event-assets/carousel-hotel.jpg", alt: "Networking reception", caption: "Reception" },
        { src: "/event-assets/carousel-spa.jpg", alt: "Workshop session", caption: "Session" },
      ],
    })];
    reapplyEventPageImagery(blocks, EVENT_LIB, EVENT_LIB, EVENT_CTX);
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    const srcs = (props.photos as Array<{ src: string }>).map((p) => p.src);
    for (const s of srcs) {
      expect(s.startsWith("/objects/")).toBe(true);
      expect(s).not.toContain("/event-assets/");
    }
  });

  it("clears the placeholders even when the library is empty (never ships /event-assets/*)", () => {
    const blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/event-assets/hero-provo.jpg",
      photos: [{ src: "/event-assets/carousel-hotel.jpg", alt: "a", caption: "b" }],
    })];
    // Empty library + empty fill pool — the placeholders must still be cleared,
    // leaving the renderer's built-in fallback rather than wrong-brand imagery.
    reapplyEventPageImagery(blocks, [], [], EVENT_CTX);
    const props = blocks[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("");
    for (const p of props.photos as Array<{ src: string }>) expect(p.src).toBe("");
  });

  it("is scoped to event-page — a co-located governed block's imagery is untouched", () => {
    const blocks: Array<Record<string, unknown>> = [
      { type: "hero", props: { photos: [{ src: "/event-assets/carousel-hotel.jpg" }] } },
      eventPage({ heroImageUrl: "/event-assets/hero-provo.jpg", photos: [] }),
    ];
    reapplyEventPageImagery(blocks, EVENT_LIB, EVENT_LIB, EVENT_CTX);
    // Non-event block is left exactly as-is (not this safeguard's concern).
    expect(((blocks[0].props as Record<string, unknown>).photos as Array<{ src: string }>)[0].src)
      .toBe("/event-assets/carousel-hotel.jpg");
    // Event-page hero was cleared + refilled.
    expect((blocks[1].props as Record<string, unknown>).heroImageUrl).toBe("/objects/event-hero-1");
  });

  it("preserves the brand accent/font theme applied just before it", () => {
    const blocks: Array<Record<string, unknown>> = [eventPage({
      heroImageUrl: "/event-assets/hero-provo.jpg",
      photos: [{ src: "/event-assets/carousel-hotel.jpg", alt: "a", caption: "b" }],
    })];
    // Branding runs first (mirrors the generate-page ordering), then the imagery
    // safeguard. The theme object must survive sanitize's shallow block copy.
    applyEventPageBranding(blocks, { accentColor: "#3366FF", displayFont: "Poppins", bodyFont: "Roboto" });
    reapplyEventPageImagery(blocks, EVENT_LIB, EVENT_LIB, EVENT_CTX);
    const props = blocks[0].props as Record<string, unknown>;
    const theme = props.theme as Record<string, unknown>;
    expect(theme.primary).toBe("#3366FF");
    expect(theme.displayFontFamily).toBe("Poppins");
    expect(theme.bodyFontFamily).toBe("Roboto");
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
  });

  it("end-to-end (copy governance): enforceAiModes reverts gallery photos to /event-assets/*, safeguard swaps to brand imagery", () => {
    // Start from a page whose event-page imagery was already swapped to library
    // imagery by the normal fill pass.
    const blocks: unknown[] = [eventPage({
      heroImageUrl: "/objects/event-hero-1",
      photos: [{ src: "/objects/event-photo-1", alt: "Networking reception", caption: "Reception" }],
    })];
    const governanceByType = new Map([
      ["event-page", { aiMode: "copy" }],
    ]) as unknown as Parameters<typeof enforceAiModes>[1];
    const defaultPropsByType = new Map([
      ["event-page", EVENT_PAGE_CATALOG_DEFAULTS],
    ]) as unknown as Parameters<typeof enforceAiModes>[2];

    // In copy mode restoreImageFieldsDeep reverts the GOVERNED image keys to the
    // catalog defaults. `src` is a governed key, so the gallery photo snaps back
    // to the Dandy /event-assets/* placeholder (the reported bug); `heroImageUrl`
    // is NOT a governed key, so the swapped hero survives copy mode.
    const governed = enforceAiModes(blocks, governanceByType, defaultPropsByType) as Array<Record<string, unknown>>;
    const govProps = governed[0].props as Record<string, unknown>;
    expect((govProps.photos as Array<{ src: string }>)[0].src).toBe("/event-assets/carousel-hotel.jpg");
    expect(govProps.heroImageUrl).toBe("/objects/event-hero-1");

    // The post-governance safeguard clears the reverted placeholder and refills
    // brand imagery, so no /event-assets/* URL can ship.
    reapplyEventPageImagery(governed, EVENT_LIB, EVENT_LIB, EVENT_CTX);
    const props = governed[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    expect((props.photos as Array<{ src: string }>)[0].src.startsWith("/objects/")).toBe(true);
    expect(JSON.stringify(props)).not.toContain("/event-assets/");
  });

  it("end-to-end (locked governance): full catalog reset to /event-assets/* is cleared by the safeguard", () => {
    const blocks: unknown[] = [eventPage({
      heroImageUrl: "/objects/event-hero-1",
      photos: [{ src: "/objects/event-photo-1", alt: "Networking reception", caption: "Reception" }],
    })];
    const governanceByType = new Map([
      ["event-page", { aiMode: "locked" }],
    ]) as unknown as Parameters<typeof enforceAiModes>[1];
    const defaultPropsByType = new Map([
      ["event-page", EVENT_PAGE_CATALOG_DEFAULTS],
    ]) as unknown as Parameters<typeof enforceAiModes>[2];

    const governed = enforceAiModes(blocks, governanceByType, defaultPropsByType) as Array<Record<string, unknown>>;
    // locked → props fully replaced by the catalog defaults (Dandy placeholders).
    expect((governed[0].props as Record<string, unknown>).heroImageUrl).toBe("/event-assets/hero-provo.jpg");

    reapplyEventPageImagery(governed, EVENT_LIB, EVENT_LIB, EVENT_CTX);
    const props = governed[0].props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("/objects/event-hero-1");
    expect(JSON.stringify(props)).not.toContain("/event-assets/");
  });
});

describe("event-page imagery — collectImageSlots (replace-imagery + template-restore coverage)", () => {
  it("collects the hero + gallery photo slots but excludes the tenant logo mark", () => {
    const block = eventPage({
      heroImageUrl: "/event-assets/hero-provo.jpg",
      photos: [
        { src: "/event-assets/carousel-hotel.jpg", alt: "a", caption: "b" },
        { src: "/event-assets/carousel-spa.jpg", alt: "c", caption: "d" },
      ],
      logoUrl: "/objects/tenant-logo",
    });
    // Mirrors the template-path "Replace imagery" ON clear loop, which blanks
    // every collected slot before refilling from the library.
    for (const slot of collectImageSlots(block)) slot.set("");
    const props = block.props as Record<string, unknown>;
    expect(props.heroImageUrl).toBe("");
    for (const p of props.photos as Array<{ src: string }>) expect(p.src).toBe("");
    // the brand mark is never collected → survives the clear
    expect(props.logoUrl).toBe("/objects/tenant-logo");
  });
});
