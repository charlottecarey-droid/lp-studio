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
  it("is tagged builder_copilot and exposes exactly the 6 v1 actions", () => {
    expect(builderCopilotMode.id).toBe("builder_copilot");
    expect(BUILDER_COPILOT_ACTIONS.map((a) => a.type).sort()).toEqual(
      ["fix_contrast", "insert_block", "remove_block", "reorder_block", "replace_image", "rewrite_copy"],
    );
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
