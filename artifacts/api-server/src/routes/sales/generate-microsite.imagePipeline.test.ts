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
