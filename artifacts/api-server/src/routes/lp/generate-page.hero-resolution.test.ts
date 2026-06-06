/**
 * Task #1065 — the AI page generator must refuse undersized images as
 * full-bleed / parallax hero backgrounds (they pixelate stretched edge-to-edge)
 * while keeping properly-sized (incl. AI-generated) heroes full-bleed.
 *
 * These tests exercise the pure post-pass `enforceHeroResolution` with a
 * pre-seeded dimensions map (no DB, no storage probe, no network):
 *   - a large library photo stays full-bleed
 *   - an AI-sized 1536×1024 photo stays full-bleed
 *   - a too-small photo downgrades full-bleed-hero → inset generic hero,
 *     preserving headline / subheadline / CTA wiring
 *   - parallax-image-hero downgrades the same way (imageUrl, ctaMode→ctaAction)
 *   - a tiny photo (below the inset floor) downgrades to a text-only hero
 *   - a video hero is never touched
 *   - unknown / unmeasured dimensions fail safe (stay full-bleed)
 *   - a hero with no background image is left alone
 *   - non-hero blocks are ignored
 */
import { describe, it, expect } from "vitest";
import { enforceHeroResolution } from "./generate-page";

type Block = Record<string, unknown>;

const LARGE = "/api/storage/objects/large.jpg";
const AI_SIZED = "/api/storage/objects/ai.png";
const SMALL = "/api/storage/objects/small.jpg";
const TINY = "/api/storage/objects/tiny.png";

const dims = new Map<string, { width?: number | null; height?: number | null }>([
  [LARGE, { width: 2400, height: 1350 }],
  [AI_SIZED, { width: 1536, height: 1024 }],
  [SMALL, { width: 900, height: 600 }],
  [TINY, { width: 480, height: 320 }],
]);

function fullBleed(bg: string, extra: Block = {}): Block {
  return {
    id: "b1",
    type: "full-bleed-hero",
    props: {
      headline: "Big bold headline",
      subheadline: "A supporting line that sells the value.",
      ctaText: "Get started",
      ctaUrl: "#signup",
      ctaAction: "chilipiper",
      chilipiperUrl: "https://cp.example.com/book",
      backgroundType: "image",
      backgroundImageUrl: bg,
      overlayOpacity: 50,
      ...extra,
    },
  };
}

function parallax(bg: string, extra: Block = {}): Block {
  return {
    id: "b2",
    type: "parallax-image-hero",
    props: {
      eyebrow: "Our story",
      headline: "Cinematic headline",
      ctaText: "Learn more",
      ctaUrl: "#learn",
      ctaMode: "modal-form",
      imageUrl: bg,
      brandMark: "Acme",
      overlayOpacity: 45,
      ...extra,
    },
  };
}

describe("enforceHeroResolution", () => {
  it("keeps a large library photo full-bleed", async () => {
    const blocks = await enforceHeroResolution([fullBleed(LARGE)], dims);
    expect(blocks[0].type).toBe("full-bleed-hero");
    expect((blocks[0].props as Block).backgroundImageUrl).toBe(LARGE);
  });

  it("keeps an AI-sized 1536×1024 photo full-bleed", async () => {
    const blocks = await enforceHeroResolution([fullBleed(AI_SIZED)], dims);
    expect(blocks[0].type).toBe("full-bleed-hero");
    expect((blocks[0].props as Block).backgroundImageUrl).toBe(AI_SIZED);
  });

  it("downgrades a too-small full-bleed-hero to an inset generic hero, preserving copy + CTA", async () => {
    const blocks = await enforceHeroResolution([fullBleed(SMALL)], dims);
    const b = blocks[0];
    const p = b.props as Block;
    expect(b.type).toBe("hero");
    expect(p.heroType).toBe("static-image");
    expect(p.layout).toBe("split");
    // The small image is shown inset rather than full-bleed.
    expect(p.imageUrl).toBe(SMALL);
    // Copy + CTA wiring preserved.
    expect(p.headline).toBe("Big bold headline");
    expect(p.subheadline).toBe("A supporting line that sells the value.");
    expect(p.ctaText).toBe("Get started");
    expect(p.ctaUrl).toBe("#signup");
    expect(p.ctaAction).toBe("chilipiper");
    expect(p.chilipiperUrl).toBe("https://cp.example.com/book");
    // The full-bleed-only field is gone.
    expect(p.backgroundImageUrl).toBeUndefined();
  });

  it("downgrades a too-small parallax-image-hero, mapping ctaMode → ctaAction and eyebrow → subheadline", async () => {
    const blocks = await enforceHeroResolution([parallax(SMALL)], dims);
    const p = blocks[0].props as Block;
    expect(blocks[0].type).toBe("hero");
    expect(p.heroType).toBe("static-image");
    expect(p.imageUrl).toBe(SMALL);
    expect(p.ctaAction).toBe("modal-form");
    // parallax has no subheadline; the eyebrow carries over so the hero isn't blank.
    expect(p.subheadline).toBe("Our story");
  });

  it("drops the image entirely (text-only hero) when the photo is below the inset floor", async () => {
    const blocks = await enforceHeroResolution([fullBleed(TINY)], dims);
    const p = blocks[0].props as Block;
    expect(blocks[0].type).toBe("hero");
    expect(p.heroType).toBe("none");
    expect(p.layout).toBe("centered");
    expect(p.imageUrl).toBe("");
    expect(p.headline).toBe("Big bold headline");
  });

  it("never touches a video-backed hero, even when the poster image is small", async () => {
    const fb = fullBleed(SMALL, { backgroundType: "video", backgroundVideoUrl: "/api/storage/objects/clip.mp4" });
    const px = parallax(SMALL, { videoUrl: "/api/storage/objects/clip2.mp4" });
    const blocks = await enforceHeroResolution([fb, px], dims);
    expect(blocks[0].type).toBe("full-bleed-hero");
    expect(blocks[1].type).toBe("parallax-image-hero");
  });

  it("fails safe — unknown / unmeasured dimensions stay full-bleed", async () => {
    // URL absent from the dims map AND not an internal object we can probe in a
    // unit test (the probe is best-effort and returns null here).
    const blocks = await enforceHeroResolution(
      [fullBleed("https://cdn.example.com/external.jpg")],
      dims,
    );
    expect(blocks[0].type).toBe("full-bleed-hero");
  });

  it("leaves a hero with no background image alone", async () => {
    const blocks = await enforceHeroResolution([fullBleed("")], dims);
    expect(blocks[0].type).toBe("full-bleed-hero");
    expect((blocks[0].props as Block).backgroundImageUrl).toBe("");
  });

  it("ignores non-hero blocks", async () => {
    const other: Block = { id: "x", type: "zigzag-features", props: { imageUrl: SMALL } };
    const blocks = await enforceHeroResolution([other], dims);
    expect(blocks[0].type).toBe("zigzag-features");
    expect((blocks[0].props as Block).imageUrl).toBe(SMALL);
  });
});
