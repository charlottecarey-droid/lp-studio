import { describe, it, expect } from "vitest";
import {
  buildTemplateGroups,
  isIndustryTemplate,
  templateMatchesType,
  type TemplateGroupShape,
} from "./template-library";

function tpl(over: Partial<TemplateGroupShape> & { id: number }): TemplateGroupShape {
  return { isGlobal: true, ...over };
}

describe("isIndustryTemplate", () => {
  it("recognizes seeded industry starters by the ind- slug prefix even when industry is null", () => {
    expect(
      isIndustryTemplate(tpl({ id: 1, slug: "ind-dental-family-practice", industry: null })),
    ).toBe(true);
  });

  it("recognizes globals carrying a real industry tag", () => {
    expect(isIndustryTemplate(tpl({ id: 2, slug: "whatever", industry: "dental" }))).toBe(true);
  });

  it("does not treat generic untagged globals as industry templates", () => {
    expect(isIndustryTemplate(tpl({ id: 3, slug: "starter-saas", industry: null }))).toBe(false);
    expect(isIndustryTemplate(tpl({ id: 4, slug: "blank", industry: "generic" }))).toBe(false);
  });

  it("ignores tenant-owned (non-global) templates even with an ind- slug", () => {
    expect(
      isIndustryTemplate(tpl({ id: 5, isGlobal: false, slug: "ind-dental-copy", industry: null })),
    ).toBe(false);
  });
});

describe("buildTemplateGroups industry section", () => {
  it("places ind- slug globals into an 'Industry templates' section after 'Block templates'", () => {
    const templates: TemplateGroupShape[] = [
      tpl({ id: 1, slug: "starter-generic", industry: null }), // block
      tpl({ id: 2, slug: "ind-dental-family-practice", industry: null }), // industry
      tpl({ id: 3, slug: "ind-fitness-yoga-studio", industry: null }), // industry
    ];

    const groups = buildTemplateGroups(templates, new Set());
    const labels = groups.map((g) => g.label);
    const blockIdx = labels.indexOf("Block templates");
    const industryIdx = labels.indexOf("Industry templates");

    expect(blockIdx).toBeGreaterThanOrEqual(0);
    expect(industryIdx).toBeGreaterThan(blockIdx);

    const industryGroup = groups[industryIdx];
    expect(industryGroup.items.map((t) => t.id).sort()).toEqual([2, 3]);
  });

  it("keeps starred industry templates in 'Featured', not 'Industry templates'", () => {
    const templates: TemplateGroupShape[] = [
      tpl({ id: 1, slug: "ind-dental-family-practice", industry: null, featured: true }),
      tpl({ id: 2, slug: "ind-fitness-yoga-studio", industry: null }),
    ];
    const groups = buildTemplateGroups(templates, new Set());
    const featured = groups.find((g) => g.label === "Featured");
    const industry = groups.find((g) => g.label === "Industry templates");
    expect(featured?.items.map((t) => t.id)).toEqual([1]);
    expect(industry?.items.map((t) => t.id)).toEqual([2]);
  });
});

describe("templateMatchesType Industry-specific", () => {
  it("matches ind- slug globals", () => {
    expect(
      templateMatchesType(
        tpl({ id: 1, slug: "ind-dental-family-practice", industry: null }),
        "Industry-specific",
      ),
    ).toBe(true);
  });
});
