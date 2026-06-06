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
  collectImageSlots,
  fillEmptyImages,
  sanitizeAIImageUrls,
  validateAndDedupeAIImages,
  type MediaImage,
} from "../lp/generate-page";
import { restoreTemplateImages, mergeAuthored } from "./generate-microsite";

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

describe("sales template image restore — onlyEmpty backstop (Replace imagery)", () => {
  // With "Replace imagery" ON, the library/scraped fill already swapped what it
  // could. The backstop must only fill slots the fill couldn't satisfy and must
  // never clobber a successfully replaced library image.
  it("keeps a library-filled scalar image and only backstops the empty one", () => {
    const tmpl: any[] = [
      { type: "hero", props: { imageUrl: "/objects/tmpl-hero" } },
      { type: "split", props: { imageUrl: "/objects/tmpl-split" } },
    ];
    const generated: any[] = [
      { type: "hero", props: { imageUrl: "/objects/library-hero" } }, // library win
      { type: "split", props: { imageUrl: "" } },                      // fill failed
    ];
    const out = restoreTemplateImages(generated, tmpl, { onlyEmpty: true }) as any[];
    expect(out[0].props.imageUrl).toBe("/objects/library-hero");
    expect(out[1].props.imageUrl).toBe("/objects/tmpl-split");
  });

  it("backstops empty per-item array images without overwriting filled ones", () => {
    const tmpl: any[] = [
      { type: "benefits-grid", props: { items: [
        { title: "A", image: "/objects/tmpl-a" },
        { title: "B", image: "/objects/tmpl-b" },
      ] } },
    ];
    const generated: any[] = [
      { type: "benefits-grid", props: { items: [
        { title: "A", image: "/objects/library-a" }, // library win
        { title: "B", image: "" },                    // fill failed
      ] } },
    ];
    const out = restoreTemplateImages(generated, tmpl, { onlyEmpty: true }) as any[];
    const items = out[0].props.items as Array<{ image: string }>;
    expect(items[0].image).toBe("/objects/library-a");
    expect(items[1].image).toBe("/objects/tmpl-b");
  });
});

describe("sales template prop preservation — authored structure survives", () => {
  // The AI re-emits each block's copy but does NOT re-emit authored structural
  // props it doesn't know about (event-landing-hero embedded form config +
  // backgroundImage). mergeAuthored must keep those authored fields while the
  // personalised AI copy still wins.
  it("preserves the embedded form + hero image while keeping AI copy", () => {
    const authored = {
      headline: "Inside Dandy: After Hours",
      backgroundImage: "/objects/after-hours-hero",
      showDetailsSection: true,
      formId: 42,
      formMode: "native",
      eventDetailsBullets: ["Drinks", "Dinner", "Demos"],
    };
    const ai = {
      headline: "Inside Dandy at Gentle Dental", // personalised copy
      // AI omits backgroundImage, formId, formMode, eventDetailsBullets entirely
    };
    const merged = mergeAuthored(authored, ai) as Record<string, unknown>;
    expect(merged.headline).toBe("Inside Dandy at Gentle Dental");
    expect(merged.backgroundImage).toBe("/objects/after-hours-hero");
    expect(merged.formId).toBe(42);
    expect(merged.formMode).toBe("native");
    expect(merged.showDetailsSection).toBe(true);
    expect(merged.eventDetailsBullets).toEqual(["Drinks", "Dinner", "Demos"]);
  });

  it("falls back to authored value when AI emits a blank string", () => {
    const merged = mergeAuthored(
      { backgroundImage: "/objects/tmpl-hero", ctaText: "RSVP" },
      { backgroundImage: "", ctaText: "Reserve your spot" },
    ) as Record<string, unknown>;
    expect(merged.backgroundImage).toBe("/objects/tmpl-hero");
    expect(merged.ctaText).toBe("Reserve your spot");
  });
});

describe("sales image pipeline — backgroundImage slot (event-landing-hero / dso-*)", () => {
  // The event-landing-hero (and dso-* section blocks) store their full-bleed
  // hero/section photo in `backgroundImage`, not `imageUrl`/`backgroundImageUrl`.
  // collectImageSlots must expose it so the "Replace imagery" clear + fill pass
  // can swap it; restoreTemplateImages must backstop it from the template.
  it("collectImageSlots exposes backgroundImage as an lp-hero slot", () => {
    const block = {
      type: "event-landing-hero",
      props: { headline: "After Hours", backgroundImage: "/objects/tmpl-hero" },
    };
    const slots = collectImageSlots(block as any);
    const bg = slots.find(s => s.get() === "/objects/tmpl-hero");
    expect(bg).toBeDefined();
    expect(bg!.purpose).toBe("lp-hero");
    // The slot accessor mutates in place — this is how "Replace imagery" clears it.
    bg!.set("");
    expect((block.props as any).backgroundImage).toBe("");
  });

  it("fillEmptyImages repopulates an empty backgroundImage from the library", () => {
    let blocks: any[] = [
      { type: "event-landing-hero", props: { headline: "After Hours", backgroundImage: "" } },
    ];
    blocks = fillEmptyImages(blocks, UNTAGGED, CTX) as any[];
    const bg = blocks[0].props.backgroundImage as string;
    expect(bg).toBeTruthy();
    expect(UNTAGGED.some(i => i.url === bg)).toBe(true);
  });

  it("restoreTemplateImages backstops an empty backgroundImage but keeps a library win", () => {
    const tmpl: any[] = [
      { type: "event-landing-hero", props: { backgroundImage: "/objects/tmpl-event" } },
      { type: "dso-challenges", props: { backgroundImage: "/objects/tmpl-dso" } },
    ];
    const generated: any[] = [
      { type: "event-landing-hero", props: { backgroundImage: "/objects/library-event" } }, // library win
      { type: "dso-challenges", props: { backgroundImage: "" } },                            // fill failed
    ];
    const out = restoreTemplateImages(generated, tmpl, { onlyEmpty: true }) as any[];
    expect(out[0].props.backgroundImage).toBe("/objects/library-event");
    expect(out[1].props.backgroundImage).toBe("/objects/tmpl-dso");
  });
});
