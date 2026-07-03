/**
 * Dandy-only hero variability — selector guards.
 *
 * applyDandyHeroVariability varies the lead `dso-heartland-hero` layout per
 * account so generated Dandy microsites don't all look identical. These tests
 * pin the contract the task cares about, exercising the *exact* pure helper the
 * sales route calls (the Dandy gate + asset wiring live in the route and are
 * covered separately):
 *
 *   1. ASSET-GATED — `split` and asset-backed full-bleed (a photo/clip BEHIND
 *      the copy) only appear when the matching asset exists; the split video
 *      layouts only when a video exists; with no assets the only outcome is the
 *      polished `full-bleed` gradient default (never a broken/empty layout).
 *   2. DETERMINISTIC — the same account (seed) always resolves to the same
 *      layout, but different accounts spread across the available pool.
 *   3. CORRECT WIRING — the chosen layout sets the matching asset field
 *      (heroImageUrl / heroVideoUrl / backgroundImageUrl / backgroundVideoUrl)
 *      drawn only from the supplied library; asset-backed full-bleed sets a
 *      moderate base overlay (the renderer scrim guarantees legibility).
 *   4. NO-OP — a block list without a `dso-heartland-hero` is returned
 *      untouched (other segments use different hero blocks).
 */
import { describe, expect, it } from "vitest";
import { applyDandyHeroVariability, type HeroLayout,
  resolveRecipeSkeletonSlots,
} from "./generate-microsite";

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

  it("full-bleed with NO assets keeps the gradient default — no forced background / overlay", () => {
    const out = applyDandyHeroVariability(heroBlocks(), [], [], "any:Co");
    const props = heroOf(out).props as Block;
    expect(props.layout).toBe("full-bleed");
    expect(props.backgroundImageUrl).toBeUndefined();
    expect(props.backgroundVideoUrl).toBeUndefined();
    expect(props.heroImageUrl).toBeUndefined();
    expect(props.heroVideoUrl).toBeUndefined();
    // The curated gradient default must not be dimmed by a forced overlay.
    expect(props.overlayOpacity).toBeUndefined();
  });

  it("asset-backed full-bleed (image) puts a library photo BEHIND the copy with a moderate overlay", () => {
    // A full-bleed result that carries a backgroundImageUrl is the photo-behind-
    // headline treatment (legibility guaranteed by the renderer scrim).
    let bg: Block | null = null;
    for (let i = 0; i < 300 && !bg; i++) {
      const props = heroOf(applyDandyHeroVariability(heroBlocks(), IMAGES, [], `fbi-${i}:Co`)).props as Block;
      if (props.layout === "full-bleed" && props.backgroundImageUrl) bg = props;
    }
    expect(bg).not.toBeNull();
    expect(IMAGES).toContain(bg!.backgroundImageUrl);
    expect(bg!.backgroundVideoUrl).toBeUndefined();
    // Moderate base tint so the photo still reads; the scrim handles contrast.
    expect(typeof bg!.overlayOpacity).toBe("number");
    expect(bg!.overlayOpacity as number).toBeGreaterThan(0);
    expect(bg!.overlayOpacity as number).toBeLessThan(55);
  });

  it("asset-backed full-bleed (video) puts a library clip BEHIND the copy with a moderate overlay", () => {
    let bg: Block | null = null;
    for (let i = 0; i < 300 && !bg; i++) {
      const props = heroOf(applyDandyHeroVariability(heroBlocks(), [], VIDEOS, `fbv-${i}:Co`)).props as Block;
      if (props.layout === "full-bleed" && props.backgroundVideoUrl) bg = props;
    }
    expect(bg).not.toBeNull();
    expect(VIDEOS).toContain(bg!.backgroundVideoUrl);
    expect(bg!.backgroundImageUrl).toBeUndefined();
    expect(typeof bg!.overlayOpacity).toBe("number");
    expect(bg!.overlayOpacity as number).toBeGreaterThan(0);
    expect(bg!.overlayOpacity as number).toBeLessThan(55);
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


// July 2026 — seeded OR-slot resolution: alternatives must rotate ACROSS
// account seeds (not collapse to the model's favorite) while staying stable
// for the SAME seed (regeneration consistency).
describe("resolveRecipeSkeletonSlots", () => {
  const recipe = {
    id: "r",
    label: "R",
    description: "d",
    styleNotes: "s",
    skeleton: [
      "spotlight-glow-hero OR aurora-gradient-hero OR dso-heartland-hero",
      "icon-row",
      "testimonial-grid OR testimonial",
    ],
  };

  it("resolves every OR slot to a single option and leaves plain slots alone", () => {
    const resolved = resolveRecipeSkeletonSlots(recipe, "t::1::core");
    expect(resolved.skeleton).toHaveLength(3);
    expect(resolved.skeleton[1]).toBe("icon-row");
    for (const slot of resolved.skeleton) expect(slot).not.toContain(" OR ");
    expect(["spotlight-glow-hero", "aurora-gradient-hero", "dso-heartland-hero"]).toContain(resolved.skeleton[0]);
  });

  it("is stable for the same seed and varies across seeds", () => {
    const a1 = resolveRecipeSkeletonSlots(recipe, "t::acct-a::core");
    const a2 = resolveRecipeSkeletonSlots(recipe, "t::acct-a::core");
    expect(a1.skeleton).toEqual(a2.skeleton);
    const heroes = new Set(
      Array.from({ length: 40 }, (_, i) =>
        resolveRecipeSkeletonSlots(recipe, `t::acct-${i}::core`).skeleton[0]),
    );
    // 40 seeds over 3 options must hit more than one option — the whole bug
    // was every account getting the same hero.
    expect(heroes.size).toBeGreaterThan(1);
  });
});

describe("applyDandyHeroVariability — gradient treatment owns the background", () => {
  it("clears a model-picked backgroundImageUrl on the gradient full-bleed treatment", () => {
    // No image/video assets → the candidate pool is only the gradient
    // "full-bleed", forcing the else branch. The model's topical pick (in
    // prod: a text-baked promo screenshot) must not survive under it.
    const blocks = heroBlocks();
    (blocks[0].props as Block).backgroundImageUrl = "/objects/promo-shot";
    const out = applyDandyHeroVariability(blocks, [], [], "acct-x:Company X");
    expect(layoutOf(out)).toBe("full-bleed");
    expect((heroOf(out).props as Block).backgroundImageUrl).toBe("");
  });

  it("the image-backed full-bleed treatment still sets its own background from the hero pool", () => {
    // Sweep seeds until the full-bleed-image-bg treatment appears; its
    // background must come from the (lp-hero-filtered) pool, never linger
    // from the model.
    for (let i = 0; i < 200; i++) {
      const blocks = heroBlocks();
      (blocks[0].props as Block).backgroundImageUrl = "/objects/promo-shot";
      const out = applyDandyHeroVariability(blocks, IMAGES, [], `acct-${i}:Company ${i}`);
      const bg = (heroOf(out).props as Block).backgroundImageUrl;
      expect(bg).not.toBe("/objects/promo-shot");
      if (layoutOf(out) === "full-bleed" && bg) {
        expect(IMAGES).toContain(bg);
      }
    }
  });
});
