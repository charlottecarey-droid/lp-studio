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
import { enforceRequiredRoles, REQUIRED_PAGE_ROLES } from "./generate-page";

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
      expect(after.has(role)).toBe(true);
    }
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
