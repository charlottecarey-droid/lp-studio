/**
 * Seed-consistency guard for the all-in-one template intent fields
 * (June 2026). The intent selector (lib/ai-prompts/template-intent.ts) only
 * considers lp_pages rows flagged is_all_in_one, which the migrate.ts
 * backfill (global_templates_intent_v1) and the seed upsert derive from these
 * seed entries — so the seed data is the contract. This test pins:
 *   • exactly the expected 14 templates are flagged all-in-one;
 *   • every all-in-one entry carries category + non-empty keywords +
 *     isAllInOne: true (a partial entry would silently never match);
 *   • categories come from the allowed TemplateCategory buckets;
 *   • non-all-in-one templates carry NO keywords (generic starters must
 *     never enter the selector's candidate set);
 *   • all-in-one slugs are unique within the full seed list.
 */
import { describe, it, expect } from "vitest";
import {
  GLOBAL_TEMPLATE_SEEDS,
  ALL_IN_ONE_TEMPLATE_SEEDS,
} from "./globalTemplates";

const EXPECTED_ALL_IN_ONE_SLUGS = [
  "global-flagship-storefront-dtc",
  "global-flagship-content-series-podcast",
  "global-flagship-blog-series-editorial",
  "global-business-case-split",
  "global-business-case-centered",
  "global-business-case-premium-editorial",
  "global-flagship-event-landing",
  "global-flagship-restaurant",
  "global-flagship-creator-portfolio",
  "global-flagship-productized-agency",
  "global-flagship-local-services",
  "global-flagship-ai-product-launch",
  "global-flagship-enterprise-platform",
  "global-flagship-premium-saas",
].sort();

const ALLOWED_CATEGORIES = new Set([
  "storefront",
  "content-series",
  "blog",
  "business-case",
  "customer-story-hub",
  "case-study",
  "event",
  "restaurant",
  "portfolio",
  "services",
  "saas-launch",
  "generic",
]);

describe("all-in-one template seed intent fields", () => {
  it("exactly the 14 expected templates are flagged all-in-one", () => {
    const slugs = ALL_IN_ONE_TEMPLATE_SEEDS.map((t) => t.slug).sort();
    expect(slugs).toEqual(EXPECTED_ALL_IN_ONE_SLUGS);
  });

  it("every all-in-one entry has category + non-empty keywords + isAllInOne", () => {
    for (const tpl of ALL_IN_ONE_TEMPLATE_SEEDS) {
      expect(tpl.isAllInOne, `${tpl.slug} isAllInOne`).toBe(true);
      expect(typeof tpl.category, `${tpl.slug} category`).toBe("string");
      expect(ALLOWED_CATEGORIES.has(tpl.category!), `${tpl.slug} category "${tpl.category}"`).toBe(true);
      expect(Array.isArray(tpl.keywords), `${tpl.slug} keywords array`).toBe(true);
      expect(tpl.keywords!.length, `${tpl.slug} keywords non-empty`).toBeGreaterThan(0);
      for (const kw of tpl.keywords!) {
        expect(typeof kw, `${tpl.slug} keyword type`).toBe("string");
        expect(kw.trim().length, `${tpl.slug} keyword "${kw}" non-blank`).toBeGreaterThan(0);
      }
    }
  });

  it("every all-in-one slug exists exactly once in the full seed list", () => {
    for (const slug of EXPECTED_ALL_IN_ONE_SLUGS) {
      const matches = GLOBAL_TEMPLATE_SEEDS.filter((t) => t.slug === slug);
      expect(matches.length, `seed list occurrences of ${slug}`).toBe(1);
      expect(matches[0].isAllInOne, `${slug} flagged in full list`).toBe(true);
    }
  });

  it("non-all-in-one templates carry no intent keywords (selector candidate set stays curated)", () => {
    for (const tpl of GLOBAL_TEMPLATE_SEEDS) {
      if (tpl.isAllInOne === true) continue;
      expect(tpl.keywords === undefined || tpl.keywords.length === 0,
        `non-all-in-one "${tpl.slug}" must not carry keywords`).toBe(true);
      expect(tpl.isAllInOne ?? false, `"${tpl.slug}" isAllInOne default`).toBe(false);
    }
  });
});
