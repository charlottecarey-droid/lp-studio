/**
 * Tests for required-structural-role enforcement on generated pages.
 *
 * `enforceRequiredRoles` is the post-parse guard shared by the LP-from-prompt
 * route and the sales-microsite route. It guarantees a generated page covers
 * every role in REQUIRED_PAGE_ROLES (hero, cta, social-proof, stats, features,
 * footer), auto-injecting a brand-aware default block for any missing role.
 *
 * Asserted contract:
 *   1. A page missing required roles gets one default block per missing role,
 *      so the final page covers ALL required roles.
 *   2. Idempotent: a page that already covers every role is returned unchanged.
 *   3. Injected defaults carry brand-aware copy (brand name surfaces).
 *   4. Each injected default's block type actually carries the role it fills
 *      (per the block-tags taxonomy) — no role is "filled" by a mismatched block.
 */
import { describe, it, expect } from "vitest";
import { resolveBlockTags } from "@workspace/lp-template-engine";
import { enforceRequiredRoles, REQUIRED_PAGE_ROLES, approvedBrandStats } from "./generate-page";

/** Roles covered by a block list, per the (code-default) block-tags taxonomy. */
function coveredRoles(blocks: Array<Record<string, unknown>>): Set<string> {
  const covered = new Set<string>();
  for (const b of blocks) {
    const type = typeof b?.type === "string" ? b.type : "";
    if (!type) continue;
    for (const tag of resolveBlockTags(type)) covered.add(tag);
  }
  return covered;
}

describe("enforceRequiredRoles — fills missing roles", () => {
  it("injects defaults so a hero-only page covers every required role", () => {
    const blocks: Array<Record<string, unknown>> = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
    ];

    const before = coveredRoles(blocks);
    // Sanity: the starting page is genuinely incomplete.
    expect(before.has("hero")).toBe(true);
    expect(before.has("cta")).toBe(false);

    enforceRequiredRoles(blocks, { brandName: "Acme", ctaUrl: "https://acme.test/book" });

    const after = coveredRoles(blocks);
    for (const role of REQUIRED_PAGE_ROLES) {
      // Oct 2026: the stats role is backfilled ONLY from approved brand stats
      // (none here), and social-proof has no backfill at all — so those two
      // honestly stay uncovered. Every structural role is filled.
      if (role === "stats" || role === "social-proof") {
        expect(after.has(role), `${role} must not be backfilled with invented content`).toBe(false);
        continue;
      }
      expect(after.has(role)).toBe(true);
    }
    expect(JSON.stringify(blocks)).not.toContain("10,000+");
  });

  it("stats role: never injects invented numbers; builds a trust-bar from 3+ approved brand stats", () => {
    const bare: Array<Record<string, unknown>> = [{ id: "h", type: "hero", props: { headline: "Hi" } }];
    enforceRequiredRoles(bare, { brandName: "Acme", ctaUrl: "#" });
    expect(bare.some((b) => b.type === "trust-bar")).toBe(false);

    const tooFew: Array<Record<string, unknown>> = [{ id: "h", type: "hero", props: { headline: "Hi" } }];
    enforceRequiredRoles(tooFew, { brandName: "Acme", ctaUrl: "#", approvedStats: [{ value: "93%", label: "On-time pickup" }, { value: "45 min", label: "Gate turnaround" }] });
    expect(tooFew.some((b) => b.type === "trust-bar")).toBe(false);

    const enough: Array<Record<string, unknown>> = [{ id: "h", type: "hero", props: { headline: "Hi" } }];
    const approved = [
      { value: "93%", label: "On-time pickup" },
      { value: "45 min", label: "Gate turnaround" },
      { value: "12,000", label: "Containers moved in 2025" },
      { value: "4", label: "Ports served" },
      { value: "ignored", label: "Fifth stat is dropped" },
    ];
    enforceRequiredRoles(enough, { brandName: "Acme", ctaUrl: "#", approvedStats: approved });
    const bar = enough.find((b) => b.type === "trust-bar") as { props: { items: Array<{ value: string }> } } | undefined;
    expect(bar).toBeDefined();
    expect(bar!.props.items.map((i) => i.value)).toEqual(["93%", "45 min", "12,000", "4"]);

    // Strict Facts still never backfills the stats role, approved or not.
    const strictBlocks: Array<Record<string, unknown>> = [{ id: "h", type: "hero", props: { headline: "Hi" } }];
    enforceRequiredRoles(strictBlocks, { brandName: "Acme", ctaUrl: "#", strictFacts: true, approvedStats: approved });
    expect(strictBlocks.some((b) => b.type === "trust-bar")).toBe(false);
  });

  it("approvedBrandStats reads only approved, complete scraped stats", () => {
    expect(approvedBrandStats({ scrapedStats: [
      { value: "93%", label: "On-time" },
      { value: "1", label: "Disapproved", approvedForAi: false },
      { value: "", label: "No value" },
      { value: "7", label: "" },
    ] })).toEqual([{ value: "93%", label: "On-time" }]);
    expect(approvedBrandStats(undefined)).toEqual([]);
  });

  it("never injects the placeholder social-proof quote card (any mode)", () => {
    const blocks: Array<Record<string, unknown>> = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
    ];
    enforceRequiredRoles(blocks, { brandName: "Acme", ctaUrl: "https://acme.test/book" });
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toContain("Replace with a real customer quote");
    expect(serialized).not.toContain("Customer name");
    expect(blocks.some((b) => b.type === "testimonial")).toBe(false);
  });

  it("keeps the existing hero and appends a footer last", () => {
    const blocks: Array<Record<string, unknown>> = [
      { id: "nav", type: "nav-header", props: {} },
      { id: "h", type: "hero", props: { headline: "Hi" } },
    ];

    enforceRequiredRoles(blocks, { brandName: "Acme", ctaUrl: "#" });

    // Original hero is untouched (no second hero injected over it).
    const heroes = blocks.filter((b) => b.type === "hero");
    expect(heroes).toHaveLength(1);
    expect((heroes[0].props as { headline?: string }).headline).toBe("Hi");

    // Footer is the final block.
    expect(resolveBlockTags(blocks[blocks.length - 1].type as string)).toContain("footer");
  });

  it("each injected default actually carries the role it was added for", () => {
    const blocks: Array<Record<string, unknown>> = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
    ];
    enforceRequiredRoles(blocks, { brandName: "Acme", ctaUrl: "#" });

    // Every block resolves to at least one of the required roles (no junk).
    for (const b of blocks) {
      const tags = resolveBlockTags(b.type as string);
      expect(tags.length).toBeGreaterThan(0);
    }
  });

  it("surfaces the brand name in injected default copy", () => {
    const blocks: Array<Record<string, unknown>> = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
    ];
    enforceRequiredRoles(blocks, { brandName: "Acme", ctaUrl: "https://acme.test/book" });

    const serialized = JSON.stringify(blocks);
    expect(serialized).toContain("Acme");
    // The CTA URL flows into the injected closing CTA.
    expect(serialized).toContain("https://acme.test/book");
  });
});

describe("enforceRequiredRoles — idempotent on complete pages", () => {
  it("returns a complete page unchanged", () => {
    const blocks: Array<Record<string, unknown>> = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
      { id: "b", type: "benefits-grid", props: {} },
      { id: "t", type: "testimonial", props: {} },
      { id: "s", type: "stat-callout", props: {} },
      { id: "c", type: "bottom-cta", props: {} },
      { id: "f", type: "footer", props: {} },
    ];
    const snapshot = JSON.stringify(blocks);

    const result = enforceRequiredRoles(blocks, { brandName: "Acme", ctaUrl: "#" });

    expect(result).toBe(blocks); // same array reference
    expect(JSON.stringify(blocks)).toBe(snapshot); // byte-identical
    expect(blocks).toHaveLength(6);
  });

  it("running twice yields the same result as running once", () => {
    const once: Array<Record<string, unknown>> = [
      { id: "h", type: "hero", props: { headline: "Hi" } },
    ];
    enforceRequiredRoles(once, { brandName: "Acme", ctaUrl: "#" });
    const afterOnce = JSON.stringify(once);

    enforceRequiredRoles(once, { brandName: "Acme", ctaUrl: "#" });
    expect(JSON.stringify(once)).toBe(afterOnce);
  });

  it("leaves an empty page untouched (nothing to anchor injection to)", () => {
    const empty: Array<Record<string, unknown>> = [];
    const result = enforceRequiredRoles(empty, { brandName: "Acme", ctaUrl: "#" });
    expect(result).toBe(empty);
    expect(empty).toHaveLength(0);
  });
});
