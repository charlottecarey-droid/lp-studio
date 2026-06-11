/**
 * AI-mode enforcement (task #4). `enforceAiModes` is the post-generation pass
 * that applies a tenant's per-block AI mode to a freshly generated/merged block
 * list. Pure (no DB): we hand it an in-memory GovernanceMap + default-props map
 * and assert the three modes behave per the documented precedence model:
 *   • locked ⇒ props reset to the curated catalog defaults (place only)
 *   • copy   ⇒ AI copy kept, image-bearing fields reverted to defaults
 *   • open   ⇒ untouched (fail-open default)
 */
import { describe, it, expect } from "vitest";
import { governanceMapFromRows } from "@workspace/lp-template-engine";
import { enforceAiModes } from "./generate-page";

function defaults() {
  return new Map<string, Record<string, unknown>>([
    ["hero", { headline: "Default Headline", imageUrl: "https://cdn/default-hero.jpg", subhead: "Default sub" }],
    [
      "gallery",
      {
        title: "Default Title",
        images: ["https://cdn/d1.jpg", "https://cdn/d2.jpg"],
        items: [{ caption: "d-cap", image: "https://cdn/di.jpg" }],
      },
    ],
  ]);
}

describe("enforceAiModes", () => {
  it("locked: resets props to the catalog defaults (place only)", () => {
    const blocks = [
      { type: "hero", props: { headline: "AI Headline", imageUrl: "https://cdn/ai-hero.jpg", subhead: "AI sub" } },
    ];
    const gov = governanceMapFromRows([{ blockType: "hero", aiMode: "locked", enabled: null, segments: [] }]);
    enforceAiModes(blocks, gov, defaults());
    expect(blocks[0].props).toEqual({
      headline: "Default Headline",
      imageUrl: "https://cdn/default-hero.jpg",
      subhead: "Default sub",
    });
  });

  it("copy: keeps AI copy but reverts image fields (string + array + nested) to defaults", () => {
    const blocks = [
      {
        type: "gallery",
        props: {
          title: "AI Title",
          images: ["https://cdn/ai1.jpg", "https://cdn/ai2.jpg"],
          items: [{ caption: "ai-cap", image: "https://cdn/ai-item.jpg" }],
        },
      },
    ];
    const gov = governanceMapFromRows([{ blockType: "gallery", aiMode: "copy", enabled: null, segments: [] }]);
    enforceAiModes(blocks, gov, defaults());
    const p = blocks[0].props as Record<string, unknown>;
    expect(p.title).toBe("AI Title"); // copy preserved
    expect(p.images).toEqual(["https://cdn/d1.jpg", "https://cdn/d2.jpg"]); // images reverted
    expect((p.items as Array<{ caption: string; image: string }>)[0].caption).toBe("ai-cap"); // nested copy kept
    expect((p.items as Array<{ caption: string; image: string }>)[0].image).toBe("https://cdn/di.jpg"); // nested image reverted
  });

  it("copy: clears an image field to empty when the default has none", () => {
    const blocks = [{ type: "hero", props: { headline: "AI", imageUrl: "https://cdn/ai.jpg" } }];
    const gov = governanceMapFromRows([{ blockType: "hero", aiMode: "copy", enabled: null, segments: [] }]);
    const noImgDefaults = new Map<string, Record<string, unknown>>([["hero", { headline: "X" }]]);
    enforceAiModes(blocks, gov, noImgDefaults);
    const p = blocks[0].props as Record<string, unknown>;
    expect(p.headline).toBe("AI");
    expect(p.imageUrl).toBe("");
  });

  it("open: leaves the block untouched (fail-open default)", () => {
    const original = { headline: "AI Headline", imageUrl: "https://cdn/ai.jpg" };
    const blocks = [{ type: "hero", props: { ...original } }];
    const gov = governanceMapFromRows([{ blockType: "hero", aiMode: "open", enabled: null, segments: [] }]);
    enforceAiModes(blocks, gov, defaults());
    expect(blocks[0].props).toEqual(original);
  });

  it("no governance row: block is untouched", () => {
    const original = { headline: "AI Headline", imageUrl: "https://cdn/ai.jpg" };
    const blocks = [{ type: "hero", props: { ...original } }];
    enforceAiModes(blocks, governanceMapFromRows([]), defaults());
    expect(blocks[0].props).toEqual(original);
  });

  it("locked with no usable defaults falls back to copy behaviour (keep copy, clear images)", () => {
    const blocks = [{ type: "hero", props: { headline: "AI", imageUrl: "https://cdn/ai.jpg" } }];
    const gov = governanceMapFromRows([{ blockType: "hero", aiMode: "locked", enabled: null, segments: [] }]);
    enforceAiModes(blocks, gov, new Map()); // no defaults at all
    const p = blocks[0].props as Record<string, unknown>;
    expect(p.headline).toBe("AI"); // copy survives
    expect(p.imageUrl).toBe(""); // image cleared
  });

  it("empty governance map is a no-op (returns the same array)", () => {
    const blocks = [{ type: "hero", props: { headline: "x" } }];
    const out = enforceAiModes(blocks, governanceMapFromRows([]), defaults());
    expect(out).toBe(blocks);
  });
});
