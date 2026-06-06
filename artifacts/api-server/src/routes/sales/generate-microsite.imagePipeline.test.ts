/**
 * Sales microsite generator — image pipeline parity guards.
 *
 * The sales generator (generate-microsite.ts) no longer carries its own bespoke
 * media helpers; it imports the marketing generator's exported pipeline so both
 * paths behave identically. These tests pin the two behaviours the original bug
 * report cared about, exercised through the *exact* helpers the sales route now
 * calls:
 *
 *   1. UNTAGGED tenant images (the typical "drawer" upload has no auto-tags) are
 *      surfaced and placed into empty image slots — the reported regression was
 *      that these were being ignored entirely.
 *   2. An empty library never produces fabricated URLs — empty slots stay empty
 *      so the editor's storage defaults / AI-image-gen fallback take over.
 *
 * The relevance/dedupe/purpose behaviour is covered exhaustively for tagged
 * libraries in ../lp/generate-page.images.test.ts; here we focus on the
 * untagged + empty cases that file does not cover.
 */
import { describe, expect, it } from "vitest";
import {
  fillEmptyImages,
  sanitizeAIImageUrls,
  validateAndDedupeAIImages,
  type MediaImage,
} from "../lp/generate-page";
import { restoreTemplateImages } from "./generate-microsite";

// A tenant "drawer" of real uploads with NO auto-tags — the common case.
const UNTAGGED: MediaImage[] = [
  { url: "/objects/drawer-1", title: "Office lobby", tags: [] },
  { url: "/objects/drawer-2", title: "Team at work", tags: [] },
  { url: "/objects/drawer-3", title: "Close-up product", tags: [] },
];

const CTX = "modern office software team landing page";

describe("sales image pipeline — untagged tenant images", () => {
  it("places untagged images into empty hero + zigzag slots (no longer ignored)", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Welcome", imageUrl: "" } },
      { type: "zigzag-features", props: { rows: [
        { headline: "Fast", imageUrl: "" },
        { headline: "Reliable", imageUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, UNTAGGED, CTX) as any[];

    const hero = blocks[0].props.imageUrl as string;
    const rows = blocks[1].props.rows as Array<{ imageUrl: string }>;
    const urls = [hero, ...rows.map(r => r.imageUrl)];

    // Every slot filled from the untagged library, all distinct.
    for (const u of urls) {
      expect(u).toBeTruthy();
      expect(UNTAGGED.some(i => i.url === u)).toBe(true);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("keeps an untagged image the model already picked (neutral score, not churned)", () => {
    const blocks = [
      { type: "hero", props: { headline: "Welcome", imageUrl: "/objects/drawer-1" } },
    ];
    validateAndDedupeAIImages(blocks, UNTAGGED, CTX);
    expect((blocks[0].props as any).imageUrl).toBe("/objects/drawer-1");
  });
});

describe("sales image pipeline — empty library never fabricates URLs", () => {
  it("leaves empty slots empty when the tenant library is empty", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Welcome", imageUrl: "" } },
      { type: "zigzag-features", props: { rows: [{ headline: "Fast", imageUrl: "" }] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, []) as any[];
    blocks = validateAndDedupeAIImages(blocks, [], CTX) as any[];
    blocks = fillEmptyImages(blocks, [], CTX) as any[];

    expect(blocks[0].props.imageUrl).toBe("");
    expect(blocks[1].props.rows[0].imageUrl).toBe("");
  });

  it("clears a hallucinated (non-library) URL the model invented for an empty library", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Welcome", imageUrl: "https://images.example.com/made-up.jpg" } },
    ];
    blocks = sanitizeAIImageUrls(blocks, []) as any[];
    expect(blocks[0].props.imageUrl).toBe("");
  });
});

describe("sales template image restore — stat bars stay numeric", () => {
  it("never restores a legacy template trust-bar/stats item image", () => {
    // A legacy template ships per-item images on a trust-bar / stats block.
    // restoreTemplateImages must NOT copy them back onto the AI output, or the
    // numeric proof bar regains a "stat label above a random photo" mismatch.
    const tmpl: any[] = [
      { type: "trust-bar", props: { items: [
        { value: "100%", label: "Old", image: "/objects/legacy-1" },
        { value: "5x", label: "Faster", image: "/objects/legacy-2" },
      ] } },
      { type: "stats", props: { items: [
        { value: "24/7", label: "Support", image: "/objects/legacy-3" },
      ] } },
    ];
    const generated: any[] = [
      { type: "trust-bar", props: { items: [
        { value: "98%", label: "Satisfaction", image: "" },
        { value: "2 days", label: "Setup", image: "" },
      ] } },
      { type: "stats", props: { items: [
        { value: "10,000+", label: "Teams", image: "" },
      ] } },
    ];
    const out = restoreTemplateImages(generated, tmpl) as any[];
    for (const item of out[0].props.items as Array<{ image: string }>) expect(item.image).toBe("");
    expect((out[1].props.items as Array<{ image: string }>)[0].image).toBe("");
  });

  it("still restores per-card photos for benefits-grid / features (no over-filtering)", () => {
    const tmpl: any[] = [
      { type: "benefits-grid", props: { items: [
        { title: "A", image: "/objects/bg-1" },
        { title: "B", image: "/objects/bg-2" },
      ] } },
    ];
    const generated: any[] = [
      { type: "benefits-grid", props: { items: [
        { title: "A", image: "" },
        { title: "B", image: "" },
      ] } },
    ];
    const out = restoreTemplateImages(generated, tmpl) as any[];
    const items = out[0].props.items as Array<{ image: string }>;
    expect(items[0].image).toBe("/objects/bg-1");
    expect(items[1].image).toBe("/objects/bg-2");
  });
});
