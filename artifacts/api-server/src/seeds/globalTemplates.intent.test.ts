/**
 * Seed-consistency guard for the all-in-one template intent fields
 * (June 2026). The intent selector (lib/ai-prompts/template-intent.ts) only
 * considers lp_pages rows flagged is_all_in_one, which the migrate.ts
 * backfill (global_templates_intent_v1) and the seed upsert derive from these
 * seed entries — so the seed data is the contract. This test pins:
 *   • exactly the expected set of templates is flagged all-in-one;
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
import {
  NAV_TYPES,
  SELF_NAV_TYPES,
  stripRedundantLeadingNav,
} from "../lib/nav-dedup";

const EXPECTED_ALL_IN_ONE_SLUGS = [
  "global-flagship-storefront-dtc",
  "global-flagship-content-series-podcast",
  "global-flagship-blog-series-editorial",
  "global-business-case-split",
  "global-business-case-centered",
  "global-business-case-premium-editorial",
  "global-business-case-split-generic",
  "global-business-case-centered-generic",
  "global-business-case-premium-editorial-generic",
  "global-storybrand-journey",
  "global-exec-decision-brief",
  "global-challenger-insight",
  "global-deal-room",
  "global-account-microsite",
  "global-onboarding-hub",
  "global-value-renewal-review",
  "global-flagship-event-rsvp",
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
  it("exactly the expected templates are flagged all-in-one", () => {
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

// ─── Brand-neutral business-case siblings (June 2026) ────────────────────────
// The three "-generic" templates exist so the business-case monographs can
// absorb ANY tenant brand. This block pins the brand-neutrality contract:
// universal industry tag, business-case intent overlap, and — critically —
// zero dental/Dandy vocabulary anywhere in the default block props.

const GENERIC_BUSINESS_CASE_SLUGS = [
  "global-business-case-split-generic",
  "global-business-case-centered-generic",
  "global-business-case-premium-editorial-generic",
];

/** Dental/Dandy vocabulary that must never appear in the generic siblings'
 *  rendered copy. Deliberately scans string VALUES only (not object keys —
 *  the comparison-table rows use the legacy `withDandy` prop KEY, which the
 *  block renders under a brand-driven "With <brandName>" header) and strips
 *  `{{...}}` personalization tokens first (`{{practice_count}}` is the wired
 *  token name from lib/businessCaseVars.ts, not copy). "practice"/"practices"
 *  stays in the deny list because the generic copy should say "team(s)" /
 *  "location(s)" — but "best practices" would be a false positive, so that
 *  phrase is whitelisted before matching. */
const DENTAL_VOCAB = /\b(dandy|dental|dentist\w*|denture\w*|crown\w*|chairside|chair\s?time|practice\w*|clinic\w*|doctor\w*|scanner\w*|remake\w*|DSO\w*|intraoral|aligner\w*|removables)\b/i;

function collectStringValues(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStringValues(item, out);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) collectStringValues(v, out);
  }
}

function findVocabLeaks(seed: (typeof GLOBAL_TEMPLATE_SEEDS)[number]): string[] {
  const strings: string[] = [];
  collectStringValues(seed.blocks.map((b) => b.props), strings);
  // The marketplace card copy must be brand-neutral too.
  strings.push(seed.title, seed.templateLabel, seed.templateDescription);
  const leaks: string[] = [];
  for (const s of strings) {
    const scrubbed = s
      .replace(/\{\{[^}]*\}\}/g, " ") // personalization tokens
      .replace(/best practices/gi, " "); // benign idiom
    if (DENTAL_VOCAB.test(scrubbed)) leaks.push(s);
  }
  return leaks;
}

describe("brand-neutral business-case siblings", () => {
  const generics = GENERIC_BUSINESS_CASE_SLUGS.map((slug) => {
    const seed = GLOBAL_TEMPLATE_SEEDS.find((t) => t.slug === slug);
    return { slug, seed };
  });

  it("all three generic slugs exist in the seed list", () => {
    for (const { slug, seed } of generics) {
      expect(seed, `seed for ${slug}`).toBeDefined();
    }
  });

  it("each is universal (industry null) and all-in-one", () => {
    for (const { slug, seed } of generics) {
      expect(seed!.industry, `${slug} industry`).toBeNull();
      expect(seed!.isAllInOne, `${slug} isAllInOne`).toBe(true);
      expect(seed!.category, `${slug} category`).toBe("business-case");
    }
  });

  it("keywords overlap the business-case intent set (incl. 'executive brief')", () => {
    // The dental originals define the business-case intent vocabulary; each
    // generic sibling must share at least the core "business case" phrase so
    // the selector treats them as the same intent bucket.
    for (const { slug, seed } of generics) {
      const kws = (seed!.keywords ?? []).map((k) => k.toLowerCase());
      expect(kws, `${slug} keywords include "business case"`).toContain("business case");
      expect(kws, `${slug} keywords include "executive brief"`).toContain("executive brief");
      const dentalSibling = GLOBAL_TEMPLATE_SEEDS.find(
        (t) => t.slug === slug.replace(/-generic$/, ""),
      );
      expect(dentalSibling, `dental sibling of ${slug}`).toBeDefined();
      const overlap = (dentalSibling!.keywords ?? []).filter((k) =>
        kws.includes(k.toLowerCase()),
      );
      expect(overlap.length, `${slug} keyword overlap with dental sibling`).toBeGreaterThan(0);
    }
  });

  it("no dental/Dandy vocabulary leaks into default props or marketplace copy", () => {
    for (const { slug, seed } of generics) {
      const leaks = findVocabLeaks(seed!);
      expect(leaks, `${slug} dental-vocabulary leaks`).toEqual([]);
    }
  });

  it("block props omit the Dandy palette so tenant brand colors flow through", () => {
    const PALETTE_KEYS = [
      "bgColor", "inkColor", "darkColor", "accentColor",
      "accentInkColor", "headlineColor", "headlineOnDarkColor",
    ];
    for (const { slug, seed } of generics) {
      for (const block of seed!.blocks) {
        for (const key of PALETTE_KEYS) {
          expect(key in block.props, `${slug} props must omit ${key}`).toBe(false);
        }
        // Brand logo must come from BrandConfig, never a baked Dandy asset.
        expect(block.props.logoUrl, `${slug} logoUrl empty`).toBe("");
      }
    }
  });
});

// ─── Sales-narrative monograph templates (June 2026) ─────────────────────────
// StoryBrand Journey, Exec Decision Brief, and Challenger Insight are
// industry-neutral full-page templates that absorb ANY tenant brand. They share
// the business-case intent bucket (via "business case" + "executive brief"
// keywords) while adding their own methodology vocabulary. This block pins the
// same brand-neutrality contract as the generic siblings above.

const SALES_NARRATIVE_SLUGS = [
  "global-storybrand-journey",
  "global-exec-decision-brief",
  "global-challenger-insight",
];

describe("sales-narrative monograph templates", () => {
  const monographs = SALES_NARRATIVE_SLUGS.map((slug) => {
    const seed = GLOBAL_TEMPLATE_SEEDS.find((t) => t.slug === slug);
    return { slug, seed };
  });

  it("all three slugs exist in the seed list", () => {
    for (const { slug, seed } of monographs) {
      expect(seed, `seed for ${slug}`).toBeDefined();
    }
  });

  it("each is universal (industry null) and all-in-one", () => {
    for (const { slug, seed } of monographs) {
      expect(seed!.industry, `${slug} industry`).toBeNull();
      expect(seed!.isAllInOne, `${slug} isAllInOne`).toBe(true);
      expect(seed!.category, `${slug} category`).toBe("business-case");
    }
  });

  it("keywords overlap the business-case intent set (incl. 'executive brief')", () => {
    for (const { slug, seed } of monographs) {
      const kws = (seed!.keywords ?? []).map((k) => k.toLowerCase());
      expect(kws, `${slug} keywords include "business case"`).toContain("business case");
      expect(kws, `${slug} keywords include "executive brief"`).toContain("executive brief");
    }
  });

  it("each carries its own methodology keywords", () => {
    const expectedSignals: Record<string, string[]> = {
      "global-storybrand-journey": ["storybrand", "brandscript", "customer journey"],
      "global-exec-decision-brief": ["meddic", "meddpicc", "decision brief", "economic buyer", "champion"],
      "global-challenger-insight": ["challenger", "commercial insight", "reframe", "status quo"],
    };
    for (const { slug, seed } of monographs) {
      const kws = (seed!.keywords ?? []).map((k) => k.toLowerCase());
      const signals = expectedSignals[slug];
      const hit = signals.filter((s) => kws.includes(s));
      expect(hit.length, `${slug} methodology keyword overlap (${signals.join(", ")})`).toBeGreaterThan(0);
    }
  });

  it("no dental/Dandy vocabulary leaks into default props or marketplace copy", () => {
    for (const { slug, seed } of monographs) {
      const leaks = findVocabLeaks(seed!);
      expect(leaks, `${slug} dental-vocabulary leaks`).toEqual([]);
    }
  });

  it("the three framework monographs are tagged funnelStage 'first-meeting'", () => {
    for (const { slug, seed } of monographs) {
      expect(seed!.funnelStage, `${slug} funnelStage`).toBe("first-meeting");
    }
  });
});

// ─── ABM funnel-stage microsite templates (June 2026) ────────────────────────
// Deal Room, Onboarding Hub, and Value & Renewal Review are industry-neutral
// full-page ABM microsites grouped by sales intent in the create-microsite
// modal. They share the same brand-neutral, all-in-one contract as the
// framework monographs and each carries its funnelStage tag + own keywords.

const ABM_MICROSITE_SLUGS = [
  "global-deal-room",
  "global-onboarding-hub",
  "global-value-renewal-review",
];

const ABM_EXPECTED_STAGE: Record<string, string> = {
  "global-deal-room": "deal-acceleration",
  "global-onboarding-hub": "onboarding",
  "global-value-renewal-review": "expansion-renewal",
};

describe("ABM funnel-stage microsite templates", () => {
  const microsites = ABM_MICROSITE_SLUGS.map((slug) => {
    const seed = GLOBAL_TEMPLATE_SEEDS.find((t) => t.slug === slug);
    return { slug, seed };
  });

  it("all three slugs exist exactly once in the seed list", () => {
    for (const { slug, seed } of microsites) {
      expect(seed, `seed for ${slug}`).toBeDefined();
      const matches = GLOBAL_TEMPLATE_SEEDS.filter((t) => t.slug === slug);
      expect(matches.length, `seed list occurrences of ${slug}`).toBe(1);
    }
  });

  it("each is universal (industry null), all-in-one, category business-case", () => {
    for (const { slug, seed } of microsites) {
      expect(seed!.industry, `${slug} industry`).toBeNull();
      expect(seed!.isAllInOne, `${slug} isAllInOne`).toBe(true);
      expect(seed!.category, `${slug} category`).toBe("business-case");
    }
  });

  it("each carries non-empty keywords and the 'ABM' intent signal", () => {
    for (const { slug, seed } of microsites) {
      const kws = (seed!.keywords ?? []).map((k) => k.toLowerCase());
      expect(kws.length, `${slug} keywords non-empty`).toBeGreaterThan(0);
      expect(kws, `${slug} keywords include "abm"`).toContain("abm");
    }
  });

  it("each carries its expected funnelStage tag", () => {
    for (const { slug, seed } of microsites) {
      expect(seed!.funnelStage, `${slug} funnelStage`).toBe(ABM_EXPECTED_STAGE[slug]);
    }
  });

  it("no dental/Dandy vocabulary leaks into default props or marketplace copy", () => {
    for (const { slug, seed } of microsites) {
      const leaks = findVocabLeaks(seed!);
      expect(leaks, `${slug} dental-vocabulary leaks`).toEqual([]);
    }
  });
});

// ─── No double navbar in seeded template lineups (#1415) ──────────────────────
// A template whose lineup starts with a standalone nav block (nav-header /
// dso-practice-nav) directly followed by a self-nav hero (which renders its own
// internal navbar) would ship TWO stacked navbars on every page created from it
// — and in the marketplace preview. The migrate.ts seed loop runs
// stripRedundantLeadingNav over each lineup before insert; this pins the
// contract so a future seed edit that re-introduces the bad pair fails CI.

/** Mirrors exactly what the migrate.ts seed loop does to each lineup before
 *  insert: shallow-copy the blocks, then strip a redundant leading nav. */
function dedupe(blocks: Array<{ type: string }>): Array<{ type: string }> {
  const copy = blocks.map((b) => ({ ...b }));
  stripRedundantLeadingNav(copy);
  return copy;
}

describe("seeded template lineups never ship a double navbar", () => {
  it("after the seed-time strip, no template begins with a standalone nav before a self-nav hero", () => {
    const offenders: string[] = [];
    for (const tpl of GLOBAL_TEMPLATE_SEEDS) {
      const deduped = dedupe(tpl.blocks as Array<{ type: string }>);
      const first = (deduped[0]?.type ?? "") as string;
      const second = (deduped[1]?.type ?? "") as string;
      if (NAV_TYPES.has(first) && SELF_NAV_TYPES.has(second)) {
        offenders.push(`${tpl.slug} [${first}, ${second}, …]`);
      }
    }
    expect(offenders, "templates that still ship a redundant leading nav").toEqual([]);
  });

  it("the strip actually fires for templates that lead with [nav, self-nav-hero]", () => {
    // Sanity that the fix has real coverage: some seeds DO carry the bad pair
    // before the strip, and the strip removes the leading nav for them.
    let stripped = 0;
    for (const tpl of GLOBAL_TEMPLATE_SEEDS) {
      const first = (tpl.blocks[0]?.type ?? "") as string;
      const second = (tpl.blocks[1]?.type ?? "") as string;
      const hadBadPair = NAV_TYPES.has(first) && SELF_NAV_TYPES.has(second);
      if (!hadBadPair) continue;
      const deduped = dedupe(tpl.blocks as Array<{ type: string }>);
      expect(deduped.length, `${tpl.slug} lost exactly the leading nav`).toBe(tpl.blocks.length - 1);
      expect(deduped[0].type, `${tpl.slug} now leads with the self-nav hero`).toBe(second);
      stripped++;
    }
    expect(stripped, "templates affected by the double-nav strip").toBeGreaterThan(0);
  });

  it("templates that use a non-self-nav hero (e.g. magazine-hero) keep their standalone nav", () => {
    for (const tpl of GLOBAL_TEMPLATE_SEEDS) {
      const first = (tpl.blocks[0]?.type ?? "") as string;
      const second = (tpl.blocks[1]?.type ?? "") as string;
      if (NAV_TYPES.has(first) && !SELF_NAV_TYPES.has(second)) {
        const deduped = dedupe(tpl.blocks as Array<{ type: string }>);
        expect(deduped.map((b) => b.type), `${tpl.slug} unchanged`).toEqual(
          tpl.blocks.map((b) => b.type),
        );
      }
    }
  });

  it("the seed-time strip removes the leading nav for [nav-header, hero] and is a no-op for non-self-nav heroes", () => {
    const selfNav = [{ type: "nav-header" }, { type: "hero" }, { type: "footer" }];
    stripRedundantLeadingNav(selfNav);
    expect(selfNav.map((b) => b.type)).toEqual(["hero", "footer"]);

    const magazine = [{ type: "nav-header" }, { type: "magazine-hero" }, { type: "footer" }];
    stripRedundantLeadingNav(magazine);
    expect(magazine.map((b) => b.type)).toEqual(["nav-header", "magazine-hero", "footer"]);
  });
});
