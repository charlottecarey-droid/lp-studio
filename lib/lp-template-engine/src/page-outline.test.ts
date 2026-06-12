// Unit tests for the shared page-outline model + resolver (task #6). This is THE
// documented "recipe" resolution both microsite + landing-page generators import,
// so the matrix here pins the cross-process contract: category steps draw a
// brand-matched block from the approved pool, block steps are forced, order is
// respected, unconfigured outlines return nothing (free AI choice), and a
// category with no approved block falls back gracefully. Pure functions, no DB.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePageOutline,
  outlineHasSteps,
  pageOutlineFromBlockList,
  effectiveOutline,
  resolvePageOutline,
  type PageOutline,
} from "./page-outline.ts";

describe("normalizePageOutline", () => {
  it("returns null for junk / empty", () => {
    assert.equal(normalizePageOutline(null), null);
    assert.equal(normalizePageOutline(undefined), null);
    assert.equal(normalizePageOutline(42), null);
    assert.equal(normalizePageOutline({}), null);
    assert.equal(normalizePageOutline({ steps: [] }), null);
    assert.equal(normalizePageOutline({ steps: "nope" }), null);
  });

  it("keeps valid category + block steps, trims, defaults required=true", () => {
    const o = normalizePageOutline({
      steps: [
        { kind: "category", role: "  hero  " },
        { kind: "block", type: "  testimonial  ", schemaHint: "  { q }  " },
        { kind: "category", role: "cta", required: false },
      ],
    });
    assert.deepEqual(o, {
      steps: [
        { kind: "category", role: "hero", required: true },
        { kind: "block", type: "testimonial", required: true, schemaHint: "{ q }" },
        { kind: "category", role: "cta", required: false },
      ],
    });
  });

  it("drops invalid steps (bad role, blank type, unknown kind)", () => {
    const o = normalizePageOutline({
      steps: [
        { kind: "category", role: "not-a-role" },
        { kind: "block", type: "   " },
        { kind: "mystery", role: "hero" },
        { kind: "category", role: "social-proof" },
      ],
    });
    assert.deepEqual(o, { steps: [{ kind: "category", role: "social-proof", required: true }] });
  });
});

describe("outlineHasSteps", () => {
  it("reflects presence of steps", () => {
    assert.equal(outlineHasSteps(null), false);
    assert.equal(outlineHasSteps({ steps: [] }), false);
    assert.equal(outlineHasSteps({ steps: [{ kind: "block", type: "hero" }] }), true);
  });
});

describe("pageOutlineFromBlockList (legacy adapter)", () => {
  it("maps a block list to forced block steps, dropping blanks", () => {
    const o = pageOutlineFromBlockList([
      { type: "hero", schemaHint: "{ h }" },
      { type: "  " },
      { type: "footer" },
    ]);
    assert.deepEqual(o, {
      steps: [
        { kind: "block", type: "hero", required: true, schemaHint: "{ h }" },
        { kind: "block", type: "footer", required: true },
      ],
    });
  });

  it("returns null for empty / non-array", () => {
    assert.equal(pageOutlineFromBlockList([]), null);
    assert.equal(pageOutlineFromBlockList(null), null);
    assert.equal(pageOutlineFromBlockList([{ type: "" }]), null);
  });
});

describe("effectiveOutline", () => {
  it("prefers a real outline over the legacy list", () => {
    const outline: PageOutline = { steps: [{ kind: "block", type: "hero" }] };
    const eff = effectiveOutline({ outline, legacyBlockList: [{ type: "footer" }] });
    assert.deepEqual(eff, { steps: [{ kind: "block", type: "hero", required: true }] });
  });

  it("falls back to the legacy list when no outline", () => {
    const eff = effectiveOutline({ outline: null, legacyBlockList: [{ type: "footer" }] });
    assert.deepEqual(eff, { steps: [{ kind: "block", type: "footer", required: true }] });
  });

  it("returns null when neither is present", () => {
    assert.equal(effectiveOutline({}), null);
  });
});

describe("resolvePageOutline", () => {
  // Deterministic role + canonicalize stubs so the test is independent of the
  // real block-tags table.
  const rolesByType: Record<string, string[]> = {
    "fancy-hero": ["hero"],
    "plain-hero": ["hero"],
    "logo-wall": ["social-proof"],
    "testimonial": ["social-proof"],
    "stat-bar": ["stats"],
    "bottom-cta": ["cta"],
    "footer": ["footer"],
  };
  const rolesOf = (t: string) => rolesByType[t] ?? [];

  it("returns [] for an empty/absent outline", () => {
    assert.deepEqual(resolvePageOutline(null, { pool: ["fancy-hero"], rolesOf }), []);
    assert.deepEqual(resolvePageOutline({ steps: [] }, { pool: ["fancy-hero"], rolesOf }), []);
  });

  it("forces block steps and respects order", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "fancy-hero" },
        { kind: "block", type: "testimonial", schemaHint: "{ q }" },
        { kind: "block", type: "footer" },
      ],
    };
    const res = resolvePageOutline(outline, { pool: [], rolesOf });
    assert.deepEqual(res, [
      { type: "fancy-hero", fromCategory: false },
      { type: "testimonial", fromCategory: false, schemaHint: "{ q }" },
      { type: "footer", fromCategory: false },
    ]);
  });

  it("draws a category step from the pool, matched by role", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "category", role: "hero" },
        { kind: "category", role: "social-proof" },
      ],
    };
    const res = resolvePageOutline(outline, {
      pool: ["plain-hero", "logo-wall", "stat-bar"],
      rolesOf,
    });
    assert.deepEqual(res, [
      { type: "plain-hero", role: "hero", fromCategory: true },
      { type: "logo-wall", role: "social-proof", fromCategory: true },
    ]);
  });

  it("mixes block + category steps and keeps order", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "fancy-hero" },
        { kind: "category", role: "social-proof" },
        { kind: "block", type: "footer" },
      ],
    };
    const res = resolvePageOutline(outline, { pool: ["testimonial"], rolesOf });
    assert.deepEqual(res.map((r) => r.type), ["fancy-hero", "testimonial", "footer"]);
  });

  it("prefers an unused candidate, then honors rank", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "plain-hero" },
        { kind: "category", role: "hero" }, // plain-hero used → should pick fancy-hero
      ],
    };
    const res = resolvePageOutline(outline, { pool: ["plain-hero", "fancy-hero"], rolesOf });
    assert.deepEqual(res.map((r) => r.type), ["plain-hero", "fancy-hero"]);

    const ranked = resolvePageOutline(
      { steps: [{ kind: "category", role: "hero" }] },
      { pool: ["plain-hero", "fancy-hero"], rolesOf, rank: (t) => (t === "fancy-hero" ? 0 : 1) },
    );
    assert.deepEqual(ranked.map((r) => r.type), ["fancy-hero"]);
  });

  it("skips an unmatched category gracefully (no pool block, no default)", () => {
    const outline: PageOutline = {
      steps: [
        { kind: "block", type: "fancy-hero" },
        { kind: "category", role: "pricing" }, // nothing in pool has this role
        { kind: "block", type: "footer" },
      ],
    };
    const res = resolvePageOutline(outline, { pool: ["testimonial"], rolesOf });
    assert.deepEqual(res.map((r) => r.type), ["fancy-hero", "footer"]);
  });

  it("fills a REQUIRED unmatched category from roleDefaults, but skips optional", () => {
    const required = resolvePageOutline(
      { steps: [{ kind: "category", role: "cta", required: true }] },
      { pool: [], rolesOf, roleDefaults: { cta: "bottom-cta" } },
    );
    assert.deepEqual(required, [{ type: "bottom-cta", role: "cta", fromCategory: true }]);

    const optional = resolvePageOutline(
      { steps: [{ kind: "category", role: "cta", required: false }] },
      { pool: [], rolesOf, roleDefaults: { cta: "bottom-cta" } },
    );
    assert.deepEqual(optional, []);
  });

  it("canonicalizes types via the supplied canonicalize fn", () => {
    const res = resolvePageOutline(
      { steps: [{ kind: "block", type: "Hero" }] },
      { pool: [], rolesOf, canonicalize: (t) => t.trim().toLowerCase() },
    );
    assert.deepEqual(res, [{ type: "hero", fromCategory: false }]);
  });
});
