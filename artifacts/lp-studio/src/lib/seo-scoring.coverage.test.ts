import { describe, it, expect } from "vitest";
import { isBlockRoleTag } from "@workspace/lp-template-engine";
import { BLOCK_REGISTRY, CHROME_BLOCK_TYPES } from "./block-types";
import { SCORED_BLOCK_TYPES, SCORING_RELEVANT_ROLES } from "./seo-scoring";

/**
 * Keeps the SEO/GEO scorer in sync with the block registry.
 *
 * The scorer recognizes blocks via hardcoded type-string Sets (HERO_TYPES,
 * SOCIAL_PROOF_TYPES, AUTHORITY_TYPES, STRUCTURED_TYPES, …) in `seo-scoring.ts`.
 * Every new block type whose semantic role tag says it carries SEO/GEO value
 * (hero / social-proof / stats / form / cta / faq / comparison / features) must
 * be categorized into at least one of those Sets — otherwise the scorer
 * silently ignores it and well-built pages grade lower than they should.
 *
 * This test fails when a registry block carries a scoring-relevant role but is
 * absent from every scorer vocabulary, forcing whoever adds the block to
 * categorize it (or add a documented exception below).
 */

// Blocks intentionally excluded from the coverage requirement.
//
// - Layout-tagged blocks (containers + Grid Pieces) are nested children placed
//   INSIDE container slots; the scorer flat-scans top-level page blocks, so a
//   nested grid piece never reaches it. They earn credit via their parent.
// - Chrome blocks (nav/header/footer/popup/sticky-bar) are page-level utility
//   singletons, not content sections, and are not scored on their own.
//
// Any additional, deliberate omission must be listed here WITH a reason so the
// exclusion is an explicit decision, never an accidental gap.
const COVERAGE_EXCEPTIONS = new Set<string>([
  // (none beyond the layout/chrome rules below)
]);

function isScoringRelevant(tags: readonly string[]): boolean {
  return tags.some((t) => isBlockRoleTag(t) && SCORING_RELEVANT_ROLES.has(t));
}

describe("seo-scoring ⇄ block-registry coverage", () => {
  it("every scoring-relevant block type is recognized by the scorer", () => {
    const uncategorized: string[] = [];

    for (const def of BLOCK_REGISTRY) {
      const tags = def.tags ?? [];
      if (!isScoringRelevant(tags)) continue;
      // Nested layout primitives + page chrome are scored via their parent /
      // not scored as content sections.
      if (tags.includes("layout")) continue;
      if (CHROME_BLOCK_TYPES.has(def.type)) continue;
      if (COVERAGE_EXCEPTIONS.has(def.type)) continue;

      if (!SCORED_BLOCK_TYPES.has(def.type)) {
        uncategorized.push(`${def.type} (tags: ${tags.join(", ")})`);
      }
    }

    expect(
      uncategorized,
      `These block types carry a scoring-relevant role tag but are missing from ` +
        `every scorer vocabulary in seo-scoring.ts. Add each to the appropriate ` +
        `Set (HERO/CTA/LEAD_CAPTURE/SOCIAL_PROOF/AUTHORITY/STRUCTURED/COMPARISON/` +
        `FAQ_TYPES) — or, if deliberately unscored, to COVERAGE_EXCEPTIONS with a ` +
        `reason:\n  ${uncategorized.join("\n  ")}`,
    ).toEqual([]);
  });

  it("scorer vocabularies only reference real registry block types", () => {
    const registryTypes = new Set(BLOCK_REGISTRY.map((d) => d.type as string));
    const unknown = [...SCORED_BLOCK_TYPES].filter((t) => !registryTypes.has(t));
    expect(
      unknown,
      `These types appear in a scorer vocabulary but no longer exist in the block ` +
        `registry (renamed or removed?). Remove them from seo-scoring.ts:\n  ${unknown.join("\n  ")}`,
    ).toEqual([]);
  });
});
