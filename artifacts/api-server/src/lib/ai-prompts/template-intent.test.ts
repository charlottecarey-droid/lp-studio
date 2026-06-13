/**
 * All-in-one template intent selector (June 2026).
 *
 * Pure-function tests for matchTemplateIntent — keyword/phrase matching
 * against the user's generation prompt. Realistic cases run against the REAL
 * seed data (ALL_IN_ONE_TEMPLATE_SEEDS) so keyword drift in the seed files
 * fails here; mechanics (word boundaries, thresholds, tie-breaks, malformed
 * input) use small synthetic candidate sets.
 */
import { describe, it, expect } from "vitest";
import {
  matchTemplateIntent,
  normalizeForIntentMatch,
  type TemplateIntentCandidate,
} from "./template-intent";
import { ALL_IN_ONE_TEMPLATE_SEEDS } from "../../seeds/globalTemplates";

const seedCandidates: TemplateIntentCandidate[] = ALL_IN_ONE_TEMPLATE_SEEDS.map((t) => ({
  slug: t.slug,
  category: t.category,
  keywords: t.keywords,
  isAllInOne: t.isAllInOne,
}));

describe("matchTemplateIntent — real seed library", () => {
  it("podcast prompt → content-series podcast template", () => {
    const m = matchTemplateIntent("build me a podcast page for my new show", seedCandidates);
    expect(m?.slug).toBe("global-flagship-content-series-podcast");
    expect(m!.score).toBeGreaterThanOrEqual(2);
  });

  it("'online store for my candle business' → storefront-dtc", () => {
    const m = matchTemplateIntent("an online store for my candle business", seedCandidates);
    expect(m?.slug).toBe("global-flagship-storefront-dtc");
  });

  it("generic business-case prompt → one of the business-case templates (deterministic)", () => {
    const m = matchTemplateIntent("build the business case for switching to Dandy", seedCandidates);
    expect(m?.slug).toMatch(/^global-business-case-/);
    // Equal scores tie-break deterministically to the first-seeded variant.
    expect(matchTemplateIntent("build the business case for switching to Dandy", seedCandidates))
      .toEqual(m);
  });

  it("exec-summary business-case prompt disambiguates to the split variant", () => {
    const m = matchTemplateIntent(
      "an executive summary business case for the leadership team",
      seedCandidates,
    );
    expect(m?.slug).toBe("global-business-case-split");
  });

  it("restaurant prompt with menu + reservations → restaurant flagship", () => {
    const m = matchTemplateIntent(
      "a page for our restaurant with the menu and reservations info",
      seedCandidates,
    );
    expect(m?.slug).toBe("global-flagship-restaurant");
  });

  it("event prompt → event landing flagship", () => {
    const m = matchTemplateIntent(
      "a conference landing page with the agenda and speakers",
      seedCandidates,
    );
    expect(m?.slug).toBe("global-flagship-event-landing");
  });

  it("generic 'landing page for my company' → null (no false positive)", () => {
    expect(matchTemplateIntent("a landing page for my company", seedCandidates)).toBeNull();
    expect(matchTemplateIntent("make me a simple landing page", seedCandidates)).toBeNull();
  });

  it("vague prompt with zero keyword hits → null", () => {
    expect(
      matchTemplateIntent("we should probably do something interactive", seedCandidates),
    ).toBeNull();
  });

  it("single generic single-word hit is below the confidence threshold", () => {
    // "show" alone (content-series keyword) must not divert a generation.
    expect(matchTemplateIntent("a page to show our pricing", seedCandidates)).toBeNull();
  });

  it("a single multi-word phrase IS confident enough ('e-commerce page')", () => {
    const m = matchTemplateIntent("I need an e-commerce page", seedCandidates);
    expect(m?.slug).toBe("global-flagship-storefront-dtc");
  });

  it("matching is case-insensitive (DTC / PODCAST)", () => {
    expect(matchTemplateIntent("a DTC storefront", seedCandidates)?.slug).toBe(
      "global-flagship-storefront-dtc",
    );
    expect(matchTemplateIntent("OUR PODCAST HUB", seedCandidates)?.slug).toBe(
      "global-flagship-content-series-podcast",
    );
  });

  it("word-boundary negatives: 'restore' is not 'store', 'shopping' is not 'shop'", () => {
    expect(
      matchTemplateIntent("help me restore and reshop my old furniture page", seedCandidates),
    ).toBeNull();
    expect(matchTemplateIntent("a page about shopping habits", seedCandidates)).toBeNull();
  });

  it("every all-in-one seed is reachable via its own keywords", () => {
    for (const tpl of ALL_IN_ONE_TEMPLATE_SEEDS) {
      const prompt = (tpl.keywords ?? []).join(" ");
      // Storefront requires a commerce signal — its own keyword list carries
      // real commerce words (shop/cart/checkout), so it still self-matches.
      const m = matchTemplateIntent(prompt, seedCandidates);
      expect(m?.slug, `expected "${tpl.slug}" to win its own keyword prompt`).toBe(tpl.slug);
    }
  });

  it("storefront seed keywords no longer include the over-broad product-page terms", () => {
    const storefront = ALL_IN_ONE_TEMPLATE_SEEDS.find(
      (t) => t.slug === "global-flagship-storefront-dtc",
    );
    const kws = (storefront?.keywords ?? []).map((k) => k.toLowerCase());
    expect(kws).not.toContain("product page");
    expect(kws).not.toContain("products");
    expect(kws).not.toContain("catalog");
    // …but it keeps the genuine commerce signals.
    expect(kws).toContain("checkout");
    expect(kws).toContain("cart");
    expect(kws).toContain("storefront");
  });
});

// ─── Brand-aware storefront gating (June 2026 generation-quality fix) ────────
describe("matchTemplateIntent — brand-aware storefront gating", () => {
  const b2bDental = {
    industry: "dental",
    segments: ["DSOs", "Solo practices", "Group practices"],
  };
  const dtcBrand = {
    industry: "ecommerce",
    isEcommerce: true,
    segments: ["Direct shoppers"],
  };

  it("B2B dental brand asking for a 'product page for dentures' does NOT route to storefront", () => {
    const m = matchTemplateIntent(
      "a product page for dentures for Dandy",
      seedCandidates,
      b2bDental,
    );
    expect(m?.slug).not.toBe("global-flagship-storefront-dtc");
  });

  it("'product page' alone (no commerce word, no brand signal) never routes to storefront", () => {
    expect(
      matchTemplateIntent("build me a product page", seedCandidates)?.slug,
    ).not.toBe("global-flagship-storefront-dtc");
    // Even with a brand whose signal is unknown/ambiguous, a bare product-page
    // prompt must not reach storefront.
    expect(
      matchTemplateIntent("build me a product page", seedCandidates, { segments: [] })?.slug,
    ).not.toBe("global-flagship-storefront-dtc");
  });

  it("DTC/ecommerce brand asking for 'online store with cart and checkout' → storefront", () => {
    const m = matchTemplateIntent(
      "an online store with cart and checkout",
      seedCandidates,
      dtcBrand,
    );
    expect(m?.slug).toBe("global-flagship-storefront-dtc");
  });

  it("a real commerce word in the prompt re-enables storefront even for a non-DTC brand", () => {
    // The prompt itself names cart/checkout — the user clearly wants a shop.
    const m = matchTemplateIntent(
      "an online store with a cart and checkout",
      seedCandidates,
      b2bDental,
    );
    expect(m?.slug).toBe("global-flagship-storefront-dtc");
  });

  it("a B2B brand can still reach NON-storefront templates (gating is storefront-only)", () => {
    const m = matchTemplateIntent(
      "build the business case for switching to Dandy",
      seedCandidates,
      b2bDental,
    );
    expect(m?.slug).toMatch(/^global-business-case-/);
  });

  it("category-only ecommerce gating works for synthetic candidates", () => {
    const storefront: TemplateIntentCandidate = {
      slug: "shop",
      category: "storefront",
      keywords: ["online store", "shop"],
      isAllInOne: true,
    };
    // Non-DTC brand, no commerce word in a bare product prompt → excluded.
    expect(
      matchTemplateIntent("a product page", [storefront], { industry: "dental" }),
    ).toBeNull();
    // Same brand, commerce word present → allowed.
    expect(
      matchTemplateIntent("an online store", [storefront], { industry: "dental" })?.slug,
    ).toBe("shop");
    // DTC brand → allowed even on bare product wording (its own keywords match).
    expect(
      matchTemplateIntent("an online store", [storefront], { isEcommerce: true })?.slug,
    ).toBe("shop");
  });

  it("ecommerce-industry template is gated by industry tag even when category differs", () => {
    const ecomTpl: TemplateIntentCandidate = {
      slug: "ecom-by-industry",
      category: "generic",
      industry: "ecommerce",
      keywords: ["online store", "shop"],
      isAllInOne: true,
    };
    expect(
      matchTemplateIntent("an online store", [ecomTpl], { industry: "dental" })?.slug,
    ).toBe("ecom-by-industry"); // commerce word in prompt re-enables it
    expect(
      matchTemplateIntent("a product page", [ecomTpl], { industry: "dental" }),
    ).toBeNull(); // no commerce word + non-DTC brand → excluded
  });
});

describe("matchTemplateIntent — mechanics (synthetic candidates)", () => {
  const a: TemplateIntentCandidate = {
    slug: "a-phrase",
    category: "storefront",
    keywords: ["online store"],
    isAllInOne: true,
  };
  const b: TemplateIntentCandidate = {
    slug: "b-words",
    category: "storefront",
    keywords: ["store", "shop"],
    isAllInOne: true,
  };

  it("multi-word keywords are matched as phrases, not bags of words", () => {
    // "store online" (reversed) must not match the "online store" phrase.
    expect(matchTemplateIntent("a store that is online", [a])).toBeNull();
    expect(matchTemplateIntent("an online store please", [a])?.slug).toBe("a-phrase");
  });

  it("equal scores tie-break to the longer (more specific) matched keyword", () => {
    // a: "online store" phrase = 2; b: "store" + "shop" = 2 → tie on score,
    // a wins because its matched keyword is longer / more specific.
    const m = matchTemplateIntent("an online store and shop", [b, a]);
    expect(m).toEqual({ slug: "a-phrase", score: 2 });
    // Candidate ordering is irrelevant to the outcome.
    expect(matchTemplateIntent("an online store and shop", [a, b])).toEqual(m);
  });

  it("two distinct single-word hits clear the threshold", () => {
    expect(matchTemplateIntent("a store and shop page", [b])).toEqual({
      slug: "b-words",
      score: 2,
    });
  });

  it("duplicate keyword variants that normalize identically count once", () => {
    const cafe: TemplateIntentCandidate = {
      slug: "cafe",
      keywords: ["café", "cafe"],
      isAllInOne: true,
    };
    // Single distinct hit, single word → below threshold.
    expect(matchTemplateIntent("a cafe in portland", [cafe])).toBeNull();
  });

  it("ignores candidates that are not all-in-one or have malformed keywords", () => {
    const candidates: TemplateIntentCandidate[] = [
      { slug: "not-all-in-one", keywords: ["online store"], isAllInOne: false },
      { slug: "null-keywords", keywords: null, isAllInOne: true },
      { slug: "string-keywords", keywords: "online store", isAllInOne: true },
      { slug: "mixed-keywords", keywords: [42, null, "online store"], isAllInOne: true },
    ];
    const m = matchTemplateIntent("an online store please", candidates);
    expect(m?.slug).toBe("mixed-keywords"); // only valid entry survives
  });

  it("empty / degenerate inputs return null", () => {
    expect(matchTemplateIntent("", [a])).toBeNull();
    expect(matchTemplateIntent("   ", [a])).toBeNull();
    expect(matchTemplateIntent("an online store", [])).toBeNull();
    expect(matchTemplateIntent("!!! ... ???", [a])).toBeNull();
  });

  it("normalizeForIntentMatch strips punctuation and preserves unicode letters", () => {
    expect(normalizeForIntentMatch("  E-Commerce,   Store!! ")).toBe("e commerce store");
    expect(normalizeForIntentMatch("Café & bistro")).toBe("café bistro");
    expect(normalizeForIntentMatch("1:1 sales page")).toBe("1 1 sales page");
  });

  it("punctuated phrase keywords still match ('1:1 sales page')", () => {
    const split: TemplateIntentCandidate = {
      slug: "split",
      keywords: ["1:1 sales page"],
      isAllInOne: true,
    };
    expect(matchTemplateIntent("a 1:1 sales page for Acme", [split])?.slug).toBe("split");
  });
});
