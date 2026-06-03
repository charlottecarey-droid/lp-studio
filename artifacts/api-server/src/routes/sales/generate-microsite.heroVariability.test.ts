/**
 * Dandy-only hero variability — selector guards.
 *
 * applyDandyHeroVariability varies the lead `dso-heartland-hero` layout per
 * account so generated Dandy microsites don't all look identical. These tests
 * pin the contract the task cares about, exercising the *exact* pure helper the
 * sales route calls (the Dandy gate + asset wiring live in the route and are
 * covered separately):
 *
 *   1. ASSET-GATED — `split` only appears when a hero image exists; the video
 *      layouts only when a video exists; with no assets the only outcome is the
 *      polished `full-bleed` gradient default (never a broken/empty layout).
 *   2. DETERMINISTIC — the same account (seed) always resolves to the same
 *      layout, but different accounts spread across the available pool.
 *   3. CORRECT WIRING — the chosen layout sets the matching asset field
 *      (heroImageUrl / heroVideoUrl) drawn only from the supplied library.
 *   4. NO-OP — a block list without a `dso-heartland-hero` is returned
 *      untouched (other segments use different hero blocks).
 */
import { describe, expect, it } from "vitest";
import { applyDandyHeroVariability, type HeroLayout } from "./generate-microsite";

type Block = Record<string, unknown>;

const HERO_BLOCK: Block = {
  id: "dso-heartland-hero-0",
  type: "dso-heartland-hero",
  props: { headline: "Hi", subheadline: "There" },
};

function heroBlocks(): Block[] {
  return [structuredClone(HERO_BLOCK), { id: "cta-1", type: "cta-button", props: {} }];
}

const IMAGES = ["/objects/hero-a", "/objects/hero-b"];
const VIDEOS = ["/objects/clip-a.mp4", "/objects/clip-b.mp4"];

function heroOf(blocks: Block[]): Block {
  return blocks.find(b => b.type === "dso-heartland-hero")!;
}
function layoutOf(blocks: Block[]): HeroLayout {
  return (heroOf(blocks).props as Block).layout as HeroLayout;
}

// Sweep a wide set of distinct seeds; collect the layouts produced.
function layoutsAcrossSeeds(images: string[], videos: string[]): Set<HeroLayout> {
  const seen = new Set<HeroLayout>();
  for (let i = 0; i < 200; i++) {
    const out = applyDandyHeroVariability(heroBlocks(), images, videos, `acct-${i}:Company ${i}`);
    seen.add(layoutOf(out));
  }
  return seen;
}

describe("applyDandyHeroVariability — asset gating", () => {
  it("with NO assets, only ever produces the full-bleed gradient default", () => {
    expect([...layoutsAcrossSeeds([], [])]).toEqual(["full-bleed"]);
  });

  it("with a hero image (no video), uses only full-bleed or split", () => {
    const layouts = layoutsAcrossSeeds(IMAGES, []);
    expect(layouts.has("split")).toBe(true); // image unlocks split
    for (const l of layouts) expect(["full-bleed", "split"]).toContain(l);
    expect(layouts.has("split-video")).toBe(false);
    expect(layouts.has("stacked-video")).toBe(false);
  });

  it("with a video (no image), unlocks the video layouts but never split", () => {
    const layouts = layoutsAcrossSeeds([], VIDEOS);
    expect(layouts.has("split")).toBe(false); // no image → no split
    expect(layouts.has("split-video") || layouts.has("stacked-video")).toBe(true);
    for (const l of layouts) expect(["full-bleed", "split-video", "stacked-video"]).toContain(l);
  });

  it("with both assets, spreads across all four designed layouts", () => {
    const layouts = layoutsAcrossSeeds(IMAGES, VIDEOS);
    for (const l of ["full-bleed", "split", "split-video", "stacked-video"] as HeroLayout[]) {
      expect(layouts.has(l)).toBe(true);
    }
  });
});

describe("applyDandyHeroVariability — determinism", () => {
  it("returns the same layout for the same seed across calls", () => {
    const seed = "acct-42:Bright Smiles";
    const a = applyDandyHeroVariability(heroBlocks(), IMAGES, VIDEOS, seed);
    const b = applyDandyHeroVariability(heroBlocks(), IMAGES, VIDEOS, seed);
    expect(layoutOf(a)).toBe(layoutOf(b));
    expect((heroOf(a).props as Block).heroImageSide).toBe((heroOf(b).props as Block).heroImageSide);
  });

  it("produces more than one distinct layout across many accounts", () => {
    expect(layoutsAcrossSeeds(IMAGES, VIDEOS).size).toBeGreaterThan(1);
  });
});

describe("applyDandyHeroVariability — asset wiring", () => {
  it("split sets heroImageUrl from the supplied library + an image side", () => {
    // Find a seed that resolves to split with an image-only library.
    let split: Block[] | null = null;
    for (let i = 0; i < 200 && !split; i++) {
      const out = applyDandyHeroVariability(heroBlocks(), IMAGES, [], `s-${i}:Co`);
      if (layoutOf(out) === "split") split = out;
    }
    expect(split).not.toBeNull();
    const props = heroOf(split!).props as Block;
    expect(IMAGES).toContain(props.heroImageUrl);
    expect(["left", "right"]).toContain(props.heroImageSide);
    expect(props.heroVideoUrl).toBeUndefined();
  });

  it("video layouts set heroVideoUrl from the library and enable autoplay", () => {
    let vid: Block[] | null = null;
    for (let i = 0; i < 200 && !vid; i++) {
      const out = applyDandyHeroVariability(heroBlocks(), [], VIDEOS, `v-${i}:Co`);
      if (layoutOf(out) !== "full-bleed") vid = out;
    }
    expect(vid).not.toBeNull();
    const props = heroOf(vid!).props as Block;
    expect(VIDEOS).toContain(props.heroVideoUrl);
    expect(props.videoAutoplay).toBe(true);
  });

  it("full-bleed keeps the gradient default — no forced background image", () => {
    const out = applyDandyHeroVariability(heroBlocks(), [], [], "any:Co");
    const props = heroOf(out).props as Block;
    expect(props.layout).toBe("full-bleed");
    expect(props.backgroundImageUrl).toBeUndefined();
    expect(props.heroImageUrl).toBeUndefined();
    expect(props.heroVideoUrl).toBeUndefined();
  });

  it("preserves the existing hero copy props", () => {
    const out = applyDandyHeroVariability(heroBlocks(), IMAGES, VIDEOS, "keep:Co");
    const props = heroOf(out).props as Block;
    expect(props.headline).toBe("Hi");
    expect(props.subheadline).toBe("There");
  });
});

describe("applyDandyHeroVariability — no-op cases", () => {
  it("returns the list unchanged when there is no dso-heartland-hero block", () => {
    const blocks: Block[] = [
      { id: "hero-0", type: "hero", props: {} },
      { id: "cta-1", type: "cta-button", props: {} },
    ];
    const out = applyDandyHeroVariability(blocks, IMAGES, VIDEOS, "x:Co");
    expect(out).toEqual(blocks);
  });
});
