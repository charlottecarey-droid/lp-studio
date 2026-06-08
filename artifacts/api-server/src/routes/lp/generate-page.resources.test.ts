/**
 * Task #1290 — unit tests for the template-path resource integrity + image-slot
 * preservation helpers. All pure functions: no DB, no network.
 *
 * Asserted contract:
 *   1. enforceResourcesFromLibrary keeps the template's resource items verbatim
 *      by default, never lets the AI rewrite/invent a resource, and swaps to a
 *      library resource (verbatim) only when the AI echoes a library title.
 *   2. With an empty library, every resource item is restored to the template
 *      item — the AI can never invent a resource.
 *   3. buildResourcesSection emits the strict "keep template resources / never
 *      invent" guidance whether or not the library has rows.
 *   4. restoreTemplateImages puts the template's exact image back in the exact
 *      same slot (incl. bento `primary` tiles and non-url `image` fields).
 */
import { describe, it, expect } from "vitest";
import {
  enforceResourcesFromLibrary,
  buildResourcesSection,
  normalizeResourceKey,
  restoreTemplateImages,
  type LibraryResource,
} from "./generate-page";

const lib: LibraryResource[] = [
  { title: "2025 Pricing Guide", description: "Our pricing", category: "Guide", url: "https://x/price", image: "https://x/price.png" },
  { title: "ROI Calculator", description: "Estimate ROI", category: "Tool", url: "https://x/roi", image: "" },
];

function resourcesBlock(items: Array<Record<string, unknown>>) {
  return { id: "r1", type: "resources", props: { headline: "Resources", columns: 3, items } };
}

describe("enforceResourcesFromLibrary", () => {
  it("restores the template item verbatim when the AI rewrote/invented its copy", () => {
    const tpl = [resourcesBlock([
      { title: "Implementation Checklist", description: "Steps", category: "Article", url: "https://t/check", image: "https://t/check.png" },
    ])];
    const merged = [resourcesBlock([
      { title: "The Ultimate Onboarding Mega-Guide", description: "AI made this up", category: "eBook", url: "https://t/check", image: "https://t/check.png" },
    ])];
    enforceResourcesFromLibrary(merged, tpl, lib);
    const item = (merged[0].props as { items: Array<Record<string, unknown>> }).items[0];
    expect(item.title).toBe("Implementation Checklist");
    expect(item.description).toBe("Steps");
    expect(item.category).toBe("Article");
  });

  it("swaps to a library resource verbatim when the AI echoes a library title (conflict path)", () => {
    const tpl = [resourcesBlock([
      { title: "Acme Co Price Sheet", description: "for Acme", category: "Guide", url: "https://t/acme", image: "https://t/acme.png" },
    ])];
    // AI decided the template's Acme price sheet conflicts and put a library resource title.
    const merged = [resourcesBlock([
      { title: "2025 pricing guide", description: "whatever", category: "x", url: "https://t/acme", image: "https://t/acme.png" },
    ])];
    enforceResourcesFromLibrary(merged, tpl, lib);
    const item = (merged[0].props as { items: Array<Record<string, unknown>> }).items[0];
    expect(item.title).toBe("2025 Pricing Guide");
    expect(item.description).toBe("Our pricing");
    expect(item.category).toBe("Guide");
    expect(item.url).toBe("https://x/price");
    expect(item.image).toBe("https://x/price.png");
  });

  it("keeps the template item's image when the matched library resource has none", () => {
    const tpl = [resourcesBlock([
      { title: "Old Tool", description: "d", category: "c", url: "https://t/old", image: "https://t/old.png" },
    ])];
    const merged = [resourcesBlock([
      { title: "ROI Calculator", description: "d", category: "c", url: "https://t/old", image: "https://t/old.png" },
    ])];
    enforceResourcesFromLibrary(merged, tpl, lib);
    const item = (merged[0].props as { items: Array<Record<string, unknown>> }).items[0];
    expect(item.title).toBe("ROI Calculator");
    expect(item.image).toBe("https://t/old.png"); // library image empty → keep template image
  });

  it("restores every template item when the library is empty (AI cannot invent)", () => {
    const tpl = [resourcesBlock([
      { title: "Real One", description: "d", category: "c", url: "https://t/1", image: "" },
      { title: "Real Two", description: "d2", category: "c2", url: "https://t/2", image: "" },
    ])];
    const merged = [resourcesBlock([
      { title: "Fake invented", description: "x", category: "x", url: "https://t/1", image: "" },
      { title: "Another fake", description: "x", category: "x", url: "https://t/2", image: "" },
    ])];
    enforceResourcesFromLibrary(merged, tpl, []);
    const items = (merged[0].props as { items: Array<Record<string, unknown>> }).items;
    expect(items.map((i) => i.title)).toEqual(["Real One", "Real Two"]);
  });

  it("ignores non-resources blocks and preserves item count", () => {
    const tpl = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
      resourcesBlock([{ title: "A", description: "", category: "", url: "", image: "" }]),
    ];
    const merged = [
      { id: "h", type: "hero", props: { headline: "AI rewrote hero" } },
      resourcesBlock([
        { title: "A-renamed", description: "", category: "", url: "", image: "" },
        { title: "extra item AI added", description: "", category: "", url: "", image: "" },
      ]),
    ];
    enforceResourcesFromLibrary(merged, tpl, []);
    expect((merged[0].props as { headline: string }).headline).toBe("AI rewrote hero");
    const items = (merged[1].props as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(1); // count locked to template
    expect(items[0].title).toBe("A");
  });
});

describe("buildResourcesSection", () => {
  it("emits keep-as-is / never-invent guidance when the library is empty", () => {
    const s = buildResourcesSection([]);
    expect(s).toMatch(/none/i);
    expect(s).toMatch(/do not invent/i.test(s) || /never invent/i.test(s) ? /invent/i : /keep/i);
    expect(s.toLowerCase()).toContain("keep");
  });

  it("lists library resources and the swap-only-on-conflict rules", () => {
    const s = buildResourcesSection(lib);
    expect(s).toContain("2025 Pricing Guide");
    expect(s).toContain("ROI Calculator");
    expect(s.toLowerCase()).toContain("conflict");
    expect(s.toLowerCase()).toContain("verbatim");
  });
});

describe("normalizeResourceKey", () => {
  it("is case/punctuation/whitespace-insensitive", () => {
    expect(normalizeResourceKey("2025  Pricing-Guide!")).toBe(normalizeResourceKey("2025 pricing guide"));
    expect(normalizeResourceKey(undefined)).toBe("");
    expect(normalizeResourceKey(42)).toBe("");
  });
});

describe("restoreTemplateImages", () => {
  it("restores a bento image tile (primary) and a non-url item image to the template value", () => {
    const orig = {
      type: "bento-showcase",
      props: { tiles: [{ kind: "image", primary: "https://t/tile1.png" }, { kind: "stat", primary: "98%" }] },
    };
    const merged = {
      type: "bento-showcase",
      props: { tiles: [{ kind: "image", primary: "https://ai/changed.png" }, { kind: "stat", primary: "98%" }] },
    };
    const ok = restoreTemplateImages(orig, merged);
    expect(ok).toBe(true);
    expect((merged.props.tiles[0] as { primary: string }).primary).toBe("https://t/tile1.png");
    expect((merged.props.tiles[1] as { primary: string }).primary).toBe("98%"); // stat untouched
  });

  it("preserves an imageUrl scalar and returns true when there are no slots", () => {
    const orig = { type: "hero", props: { imageUrl: "https://t/hero.png", headline: "x" } };
    const merged = { type: "hero", props: { imageUrl: "https://ai/hero.png", headline: "y" } };
    expect(restoreTemplateImages(orig, merged)).toBe(true);
    expect((merged.props as { imageUrl: string }).imageUrl).toBe("https://t/hero.png");
    expect(restoreTemplateImages({ type: "spacer", props: {} }, { type: "spacer", props: {} })).toBe(true);
  });

  it("restores a blanked slot back to the template image (empty slots still align)", () => {
    const orig = { type: "x", props: { items: [{ image: "https://t/a.png" }, { image: "https://t/b.png" }] } };
    const merged = { type: "x", props: { items: [{ image: "https://ai/a.png" }, { image: "" }] } };
    expect(restoreTemplateImages(orig, merged)).toBe(true);
    expect(merged.props.items.map((i) => i.image)).toEqual(["https://t/a.png", "https://t/b.png"]);
  });

  it("forces a slot the template left empty back to empty (AI cannot add imagery)", () => {
    const orig = { type: "x", props: { items: [{ image: "" }, { image: "https://t/b.png" }] } };
    const merged = { type: "x", props: { items: [{ image: "https://ai/new.png" }, { image: "https://t/b.png" }] } };
    expect(restoreTemplateImages(orig, merged)).toBe(true);
    expect(merged.props.items.map((i) => i.image)).toEqual(["", "https://t/b.png"]);
  });

  it("skips (returns false) only when a structural discriminator diverges (bento tile kind)", () => {
    const orig = { type: "bento-showcase", props: { tiles: [{ kind: "image", primary: "https://t/a.png" }, { kind: "stat", primary: "98%" }] } };
    const merged = { type: "bento-showcase", props: { tiles: [{ kind: "stat", primary: "1,000" }, { kind: "stat", primary: "98%" }] } };
    expect(restoreTemplateImages(orig, merged)).toBe(false);
  });
});
