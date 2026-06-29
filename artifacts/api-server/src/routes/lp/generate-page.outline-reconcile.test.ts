/**
 * Authored-outline reconcile (June 2026) — the landing-page generator now treats
 * a tenant's authored page outline as AUTHORITATIVE (parity with the microsite
 * generator). These pure-helper tests pin reconcileLandingPageBlocksToOutline:
 *
 *  - omitted outline slots (e.g. a copy-only value-pillars / feature section
 *    the model skipped) are SYNTHESIZED, in order, from the tenant's saved
 *    default props (deep-cloned, never the shared map reference);
 *  - a matching AI-generated block is REUSED in place (its copy/props/id kept),
 *    with its type canonicalized;
 *  - blocks the model invented that are NOT in the outline are DROPPED;
 *  - the final order follows the OUTLINE, not the model's emission order.
 *
 * No DB / no network. The route gates this helper on `outlineActive` (a non-
 * empty resolved outline), so the "no authored outline → pass through unchanged"
 * behaviour lives at the call site; here an empty outline correctly yields [].
 */
import { describe, it, expect } from "vitest";
import { reconcileLandingPageBlocksToOutline } from "./generate-page";
import { canonicalizeBlockType } from "../../lib/ai-prompts/block-aliases";

type Block = Record<string, unknown>;

function defaultsMap(entries: Record<string, Record<string, unknown>>): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const [k, v] of Object.entries(entries)) m.set(canonicalizeBlockType(k), v);
  return m;
}

describe("reconcileLandingPageBlocksToOutline", () => {
  it("synthesizes omitted slots from tenant defaults and reuses matching AI blocks, in outline order", () => {
    const aiHero: Block = { id: "ai-hero", type: "hero", props: { headline: "Welcome" } };
    const aiCta: Block = { id: "ai-cta", type: "cta-banner", props: { label: "Start" } };
    // Model invented a block the author never put in the outline → must be dropped.
    const aiStray: Block = { id: "ai-stray", type: "testimonial", props: { quote: "nope" } };

    const defaults = defaultsMap({
      "value-pillars-grid": { heading: "Why us", theme: { bg: "navy" } },
      "feature-spotlight": { title: "Flagship feature" },
    });

    const resolved = [
      { type: "hero" },
      { type: "value-pillars-grid" },
      { type: "feature-spotlight" },
      { type: "cta-banner" },
    ];

    const out = reconcileLandingPageBlocksToOutline(
      [aiHero, aiStray, aiCta],
      resolved,
      defaults,
    ) as Block[];

    // Exactly the outline shape, in outline order — stray dropped.
    expect(out).toHaveLength(4);
    expect(out.map((b) => b.type)).toEqual([
      canonicalizeBlockType("hero"),
      canonicalizeBlockType("value-pillars-grid"),
      canonicalizeBlockType("feature-spotlight"),
      canonicalizeBlockType("cta-banner"),
    ]);
    expect(out).not.toContain(aiStray);

    // Reused AI blocks keep their identity (copy/props/id preserved).
    expect(out[0]).toBe(aiHero);
    expect((out[0].props as Block).headline).toBe("Welcome");
    expect(out[3]).toBe(aiCta);

    // Synthesized slots carry a deep CLONE of the tenant defaults (mutating the
    // result must not bleed back into the shared defaults map).
    const pillars = out[1];
    expect(pillars.props).toEqual({ heading: "Why us", theme: { bg: "navy" } });
    expect(pillars.props).not.toBe(defaults.get(canonicalizeBlockType("value-pillars-grid")));
    (((pillars.props as Block).theme as Block).bg as unknown) = "MUTATED";
    expect(defaults.get(canonicalizeBlockType("value-pillars-grid"))).toEqual({
      heading: "Why us",
      theme: { bg: "navy" },
    });

    // Synthesized slots get a stable, index-scoped id.
    expect(pillars.id).toBe(`block-${canonicalizeBlockType("value-pillars-grid")}-outline-1`);
    expect(out[2].id).toBe(`block-${canonicalizeBlockType("feature-spotlight")}-outline-2`);
  });

  it("synthesizes empty props when a slot has no saved tenant default", () => {
    const out = reconcileLandingPageBlocksToOutline(
      [],
      [{ type: "feature-spotlight" }],
      new Map(),
    ) as Block[];
    expect(out).toHaveLength(1);
    expect(out[0].props).toEqual({});
    expect(out[0].type).toBe(canonicalizeBlockType("feature-spotlight"));
  });

  it("consumes one AI block per slot for repeated types, then synthesizes the rest", () => {
    const first: Block = { id: "f1", type: "feature-spotlight", props: { title: "One" } };
    const second: Block = { id: "f2", type: "feature-spotlight", props: { title: "Two" } };
    const defaults = defaultsMap({ "feature-spotlight": { title: "Default" } });

    const out = reconcileLandingPageBlocksToOutline(
      [first, second],
      [{ type: "feature-spotlight" }, { type: "feature-spotlight" }, { type: "feature-spotlight" }],
      defaults,
    ) as Block[];

    expect(out).toHaveLength(3);
    // Distinct AI blocks reused in order, no duplication.
    expect(out[0]).toBe(first);
    expect(out[1]).toBe(second);
    // Third slot has no AI block left → synthesized from tenant defaults.
    expect(out[2]).not.toBe(first);
    expect(out[2]).not.toBe(second);
    expect(out[2].props).toEqual({ title: "Default" });
  });

  it("returns an empty array for an empty outline (caller gates on outlineActive)", () => {
    const out = reconcileLandingPageBlocksToOutline(
      [{ id: "ai-hero", type: "hero", props: {} }],
      [],
      new Map(),
    );
    expect(out).toEqual([]);
  });

  it("ignores AI blocks with no usable type when bucketing for reuse", () => {
    const typeless: Block = { id: "x", props: { foo: "bar" } };
    const defaults = defaultsMap({ hero: { headline: "Default hero" } });
    const out = reconcileLandingPageBlocksToOutline(
      [typeless],
      [{ type: "hero" }],
      defaults,
    ) as Block[];
    expect(out).toHaveLength(1);
    // The typeless block can't satisfy the hero slot → slot is synthesized.
    expect(out[0]).not.toBe(typeless);
    expect(out[0].props).toEqual({ headline: "Default hero" });
  });
});
