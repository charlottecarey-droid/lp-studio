/**
 * Unit coverage for the Builder Copilot mode's PURE grounding builders — the
 * page summary, block catalog, recipe heuristics, and the full grounding
 * assembly (which folds in the strict-facts-aware brand prompt). No OpenAI.
 */
import { describe, it, expect } from "vitest";
import {
  builderCopilotMode,
  buildPageSummary,
  buildBlockCatalogSection,
  buildImageLibrarySection,
  buildRecipeHeuristics,
  BUILDER_COPILOT_ACTIONS,
  type BuilderCopilotContext,
} from "./modes/builderCopilot";

describe("buildPageSummary", () => {
  it("numbers the block sequence with type, id, and a copy preview", () => {
    const out = buildPageSummary("Pricing", [
      { id: "hero-1", type: "hero", props: { headline: "Switch to Acme" } },
      { id: "cta-1", type: "bottom-cta", props: { ctaText: "Get a demo" } },
    ]);
    expect(out).toContain('Page title: "Pricing"');
    expect(out).toContain("1. [hero] (id: hero-1) — \"Switch to Acme\"");
    expect(out).toContain("2. [bottom-cta] (id: cta-1) — \"Get a demo\"");
  });

  it("describes an empty page", () => {
    expect(buildPageSummary("", [])).toContain("empty");
  });

  it("truncates long copy", () => {
    const long = "x".repeat(200);
    const out = buildPageSummary("T", [{ id: "b1", type: "hero", props: { headline: long } }]);
    expect(out).toContain("…");
    expect(out).not.toContain("x".repeat(200));
  });

  it("lists editable field names and image-slot state per block", () => {
    const out = buildPageSummary("T", [
      {
        id: "hero-1",
        type: "hero",
        props: {
          headline: "Switch to Acme",
          ctaText: "Get a demo",
          backgroundImage: "https://cdn.example.com/a.jpg",
          heroImage: "",
        },
      },
    ]);
    expect(out).toContain('headline: "Switch to Acme"');
    expect(out).toContain('ctaText: "Get a demo"');
    expect(out).toContain("backgroundImage=(set)");
    expect(out).toContain("heroImage=(empty)");
    // URL values never leak into the copy-field list.
    expect(out).not.toContain("cdn.example.com");
  });
});

describe("buildImageLibrarySection", () => {
  it("returns empty for a missing/empty library so the section is omitted", () => {
    expect(buildImageLibrarySection(undefined)).toBe("");
    expect(buildImageLibrarySection([])).toBe("");
  });

  it("lists urls with titles + tags and pins the copy-exactly rule", () => {
    const out = buildImageLibrarySection([
      { url: "https://cdn.example.com/team.jpg", title: "Team at work", tags: ["people", "office"] },
    ]);
    expect(out).toContain("https://cdn.example.com/team.jpg");
    expect(out).toContain("Team at work");
    expect(out).toContain("[people, office]");
    expect(out).toContain("EXACTLY");
  });

  it("caps the list at 40 images", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      url: `https://cdn.example.com/${i}.jpg`,
      title: "",
      tags: [],
    }));
    const out = buildImageLibrarySection(many);
    expect(out).toContain("/39.jpg");
    expect(out).not.toContain("/40.jpg");
  });
});

describe("buildBlockCatalogSection", () => {
  it("lists block types with one-line purposes", () => {
    const out = buildBlockCatalogSection();
    expect(out).toContain("testimonial-wall:");
    expect(out).toContain("dso-faq:");
    expect(out).toContain("hero:");
  });
});

describe("buildRecipeHeuristics", () => {
  it("encodes the normalizer rules (adjacent CTAs, social proof, contrast)", () => {
    const out = buildRecipeHeuristics().toLowerCase();
    expect(out).toContain("two call-to-action");
    expect(out).toContain("social proof");
    expect(out).toContain("contrast");
  });
});

describe("builderCopilotMode", () => {
  it("is tagged builder_copilot and exposes exactly the v2 action menu", () => {
    expect(builderCopilotMode.id).toBe("builder_copilot");
    expect(BUILDER_COPILOT_ACTIONS.map((a) => a.type).sort()).toEqual(
      ["fix_contrast", "insert_block", "remove_block", "reorder_block", "replace_image", "rewrite_copy", "update_props"],
    );
  });

  it("replace_image accepts an optional library imageUrl but never requires it", () => {
    const def = BUILDER_COPILOT_ACTIONS.find((a) => a.type === "replace_image")!;
    expect(Object.keys(def.properties)).toContain("imageUrl");
    expect(def.required).not.toContain("imageUrl");
  });

  it("grounding includes the image library when the route provides one", () => {
    const ctx: BuilderCopilotContext = {
      tenantId: 1,
      pageId: 7,
      pageTitle: "Demo",
      pageBlocks: [],
      brand: {},
      mediaLibrary: [{ url: "https://cdn.example.com/hero.jpg", title: "Clinic hero", tags: [] }],
    };
    expect(builderCopilotMode.groundingBuilder(ctx)).toContain("https://cdn.example.com/hero.jpg");
  });

  it("groundingBuilder folds in page summary + catalog + heuristics + approved brand facts only", () => {
    const ctx: BuilderCopilotContext = {
      tenantId: 1,
      pageId: 7,
      pageTitle: "Demo",
      pageBlocks: [{ id: "hero-1", type: "hero", props: { headline: "Hi" } }],
      brand: {
        brandName: "Acme",
        aiStrictFactsMode: true,
        scrapedStats: [
          { value: "99%", label: "uptime", approvedForAi: true },
          { value: "42%", label: "growth", approvedForAi: false }, // NOT approved
        ],
      },
    };
    const grounding = builderCopilotMode.groundingBuilder(ctx);
    expect(grounding).toContain("hero-1");
    expect(grounding).toContain("testimonial-wall:");
    expect(grounding).toContain("Acme");
    // strict facts: approved stat present, unapproved one absent.
    expect(grounding).toContain("99%");
    expect(grounding).not.toContain("42%");
  });

  it("systemPromptBuilder describes the copilot persona", () => {
    const ctx = { tenantId: 1, pageId: null } as BuilderCopilotContext;
    expect(builderCopilotMode.systemPromptBuilder(ctx).toLowerCase()).toContain("copilot");
  });
});
