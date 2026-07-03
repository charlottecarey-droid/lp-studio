/**
 * Hermetic unit tests for the golden-brief eval scorers.
 *
 * Every scorer is a pure function over already-materialized generation output
 * — no DB, no network, no OpenAI. This suite is the fast local check
 * (`npx vitest run src/evals/`); the live runner is src/evals/run.ts.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  approvedStatPool,
  bannedPhraseScore,
  degradationScore,
  emptyImageSlotScore,
  fabricatedStatScore,
  isApprovedStat,
  lineupDiversityScore,
  lineupSignature,
  placeholderLeakScore,
  scoreGeneration,
  structuralScore,
  subjectLeakScore,
} from "./scorers";
import type { EvalBlock, GenerationResultLike } from "./types";

function block(type: string, props: Record<string, unknown>, id = `${type}-1`): EvalBlock {
  return { id, type, props };
}

/** A structurally-complete, squeaky-clean page used as the happy-path base. */
function cleanPage(): EvalBlock[] {
  return [
    block("hero", {
      headline: "Bookkeeping without the shoebox",
      subheadline: "A dedicated bookkeeper closes your books every month",
      imageUrl: "https://images.example.com/hero.jpg",
      ctaText: "Pick a plan",
      ctaUrl: "https://kite.example.com/plans",
    }),
    block("benefits-grid", {
      heading: "Why owners switch",
      items: [
        { title: "Monthly close", description: "Books done by the 5th, every month." },
        { title: "Flat pricing", description: "One invoice, no hourly meters." },
      ],
    }),
    block("bottom-cta", { headline: "Ready when you are", ctaText: "Pick a plan", ctaUrl: "#" }),
    block("footer", { companyName: "Kite Bookkeeping" }),
  ];
}

// ── fabricatedStatScore ──────────────────────────────────────────────────────

describe("fabricatedStatScore", () => {
  it("skips bare step ordinals on stat-shaped keys (steps[].number)", () => {
    const blocks = [
      { id: "b1", type: "how-it-works", props: { steps: [{ number: "01", title: "Apply" }, { number: "02", title: "Match" }] } },
    ];
    expect(fabricatedStatScore(blocks, []).violations).toHaveLength(0);
  });

  it("matches trivial reformattings of an approved number (12k == 12,000; 45-minute == 45 min)", () => {
    const pool = ["12,000 containers moved in 2025", "45-minute average gate turnaround"];
    const blocks = [
      { id: "b1", type: "trust-bar", props: { items: [{ value: "12k+", label: "containers" }, { value: "45 min", label: "gate turnaround" }] } },
    ];
    expect(fabricatedStatScore(blocks, pool).violations).toHaveLength(0);
  });

  it("does not penalize an unapproved stat the server flagged for review (flag-and-review contract)", () => {
    const blocks = [
      { id: "b1", type: "trust-bar", props: { items: [{ value: "87%", label: "satisfaction" }] } },
    ];
    // Unapproved AND unflagged -> violation.
    expect(fabricatedStatScore(blocks, []).violations).toHaveLength(1);
    // Unapproved but FLAGGED (strictMismatches echo) -> product working as designed.
    expect(fabricatedStatScore(blocks, [], ["87%"]).violations).toHaveLength(0);
  });

  it("returns 1 with no violations on a page without stat-like copy", () => {
    const r = fabricatedStatScore(cleanPage(), []);
    expect(r.score).toBe(1);
    expect(r.violations).toEqual([]);
  });

  it("flags a stat-like value that is not in the allowed pool", () => {
    const blocks = [
      block("stat-callout", { stats: [{ value: "97%", label: "success rate" }] }),
    ];
    const r = fabricatedStatScore(blocks, []);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].scorer).toBe("fabricatedStat");
    expect(r.violations[0].value).toBe("97%");
    expect(r.violations[0].path).toContain("props.stats[0].value");
    expect(r.score).toBe(0.75);
  });

  it("passes stats present in the allowed pool (case-insensitive substring, both ways)", () => {
    const blocks = [
      block("stat-callout", { stats: [{ value: "9,000+ aligner cases", label: "cases" }] }),
      block("hero", { headline: "Over 9,000+ Aligner Cases treated", imageUrl: "x" }, "hero-2"),
    ];
    const r = fabricatedStatScore(blocks, ["9,000+ aligner cases"]);
    expect(r.violations).toEqual([]);
    expect(r.score).toBe(1);
  });

  it("flags prose containing an unapproved stat-shaped phrase outside stat fields", () => {
    const blocks = [
      block("hero", { headline: "Trusted by 12,000 customers worldwide" }),
    ];
    const r = fabricatedStatScore(blocks, []);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].value).toContain("12,000 customers");
  });

  it("skips numeric idioms shared with production (time/ratio shorthand)", () => {
    const blocks = [
      block("features", { items: [{ value: "24/7", label: "support hours" }] }),
    ];
    const r = fabricatedStatScore(blocks, []);
    expect(r.violations).toEqual([]);
  });

  it("floors the score at 0 past four violations", () => {
    const stats = ["91%", "92%", "93%", "94%", "95%"].map((v) => ({ value: v, label: "made up" }));
    const r = fabricatedStatScore([block("stat-callout", { stats })], []);
    expect(r.violations).toHaveLength(5);
    expect(r.score).toBe(0);
  });
});

describe("isApprovedStat", () => {
  it("treats empty and non-numeric values as approved", () => {
    expect(isApprovedStat("", new Set())).toBe(true);
    expect(isApprovedStat("fast and friendly", new Set())).toBe(true);
  });

  it("substring-matches the pool in either direction", () => {
    const pool = new Set(["94% clinician retention"]);
    expect(isApprovedStat("94%", pool)).toBe(true);
    expect(isApprovedStat("Retention of 94% clinician retention rate", pool)).toBe(true);
    expect(isApprovedStat("81%", pool)).toBe(false);
  });
});

describe("approvedStatPool", () => {
  it("approves stat tokens typed in the user's prompt", () => {
    const pool = approvedStatPool({}, "Use our real numbers: 93% on-time pickup and 12,000 containers moved.");
    expect(isApprovedStat("93%", pool)).toBe(true);
    expect(isApprovedStat("12,000 containers", pool)).toBe(true);
    expect(isApprovedStat("77%", pool)).toBe(false);
  });

  it("collects approved product claims, segment stats and scraped stats; skips unapproved", () => {
    const pool = approvedStatPool(
      {
        productLines: [
          { claims: [{ text: "91% reported calmer skin in 2 weeks", approvedForAi: true }, { text: "99% invented", approvedForAi: false }, "3 essential ceramides"] },
        ],
        segments: [{ stats: [{ value: "120+ supported practices" }, { value: "13% secret", approvedForAi: false }] }],
        scrapedStats: [{ value: "4 Colorado clinics", approvedForAi: true }, { value: "98% satisfaction", approvedForAi: false }],
      },
      "",
      ["45-minute turnaround"],
    );
    expect(pool.has("91% reported calmer skin in 2 weeks")).toBe(true);
    expect(pool.has("3 essential ceramides")).toBe(true);
    expect(pool.has("120+ supported practices")).toBe(true);
    expect(pool.has("4 colorado clinics")).toBe(true);
    expect(pool.has("45-minute turnaround")).toBe(true);
    expect(pool.has("99% invented")).toBe(false);
    expect(pool.has("13% secret")).toBe(false);
    expect(pool.has("98% satisfaction")).toBe(false);
  });
});

// ── placeholderLeakScore ─────────────────────────────────────────────────────

describe("placeholderLeakScore", () => {
  it("returns 1 on clean copy", () => {
    expect(placeholderLeakScore(cleanPage()).score).toBe(1);
  });

  it.each([
    "Add a quote in brand settings",
    "Replace with your own headline",
    "lorem ipsum dolor sit amet",
    "Customer Name",
    "[Insert company name]",
    "{{firstName}}, welcome back",
    "This is placeholder text",
  ])("flags %j", (text) => {
    const r = placeholderLeakScore([block("testimonial", { quote: text })]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].scorer).toBe("placeholderLeak");
  });

  it("flags placeholders nested inside item arrays with a precise path", () => {
    const r = placeholderLeakScore([
      block("testimonial-grid", {
        testimonials: [
          { quote: "Real happy customer words", author: "Dana R." },
          { quote: "Add a quote in brand settings", author: "X" },
        ],
      }),
    ]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].path).toContain("testimonials[1].quote");
  });

  it("does not flag ordinary copy mentioning settings or names", () => {
    const r = placeholderLeakScore([
      block("features", { heading: "Change your notification settings anytime" }),
    ]);
    expect(r.violations).toEqual([]);
  });
});

// ── emptyImageSlotScore ──────────────────────────────────────────────────────

describe("emptyImageSlotScore", () => {
  it("flags an empty image prop on a hero (image-led role)", () => {
    const r = emptyImageSlotScore([block("hero", { headline: "Hi", imageUrl: "" })]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].path).toBe("blocks[0].props.imageUrl");
    expect(r.violations[0].detail).toContain("hero");
  });

  it("re-anchors paths at the block's real index", () => {
    const r = emptyImageSlotScore([
      block("footer", { companyName: "Acme" }),
      block("hero", { headline: "Hi", imageUrl: "" }),
    ]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].path).toBe("blocks[1].props.imageUrl");
  });

  it("ignores empty image props on non-image-led blocks (icon-fallback cards)", () => {
    const r = emptyImageSlotScore([
      block("value-pillars-icon-trio", { items: [{ icon: "Zap", image: "", title: "Fast" }] }),
    ]);
    expect(r.violations).toEqual([]);
  });

  it("honors caller-supplied extra image-led types", () => {
    const r = emptyImageSlotScore(
      [block("value-pillars-headline-badge", { items: [{ image: "", title: "Fast" }] })],
      new Set(["value-pillars-headline-badge"]),
    );
    expect(r.violations).toHaveLength(1);
  });

  it("passes filled image slots", () => {
    const r = emptyImageSlotScore([block("hero", { imageUrl: "https://img.example.com/a.jpg" })]);
    expect(r.score).toBe(1);
  });
});

// ── bannedPhraseScore ────────────────────────────────────────────────────────

describe("bannedPhraseScore", () => {
  it("returns 1 on clean copy", () => {
    expect(bannedPhraseScore(cleanPage()).score).toBe(1);
  });

  it("flags a global cliché", () => {
    const r = bannedPhraseScore([block("hero", { headline: "The industry-leading platform" })]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].value).toBe("industry-leading");
    expect(r.violations[0].detail).toContain("global");
  });

  it("flags the brand's own avoid-phrases and attributes them to the brand", () => {
    const r = bannedPhraseScore(
      [block("hero", { headline: "Your smile journey starts here" })],
      ["smile journey"],
    );
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].value).toBe("smile journey");
    expect(r.violations[0].detail).toContain("brand");
  });
});

// ── structuralScore ──────────────────────────────────────────────────────────

describe("structuralScore", () => {
  it("treats a single self-contained full-page block as covering every required role", () => {
    const blocks = [{ id: "b1", type: "event-noir", props: { headline: "x" } }];
    const r = structuralScore(blocks, ["hero", "cta", "footer"]);
    expect(r.violations).toHaveLength(0);
    expect(r.score).toBe(1);
  });

  it("event-page covers hero+cta itself but still needs the injected footer", () => {
    const noFooter = structuralScore([{ id: "b1", type: "event-page", props: { title: "x" } }], ["hero", "cta", "footer"]);
    expect(noFooter.violations.some((v) => v.value === "footer")).toBe(true);
    const withFooter = structuralScore(
      [
        { id: "b1", type: "event-page", props: { title: "x" } },
        { id: "b2", type: "footer", props: {} },
      ],
      ["hero", "cta", "footer"],
    );
    expect(withFooter.score).toBe(1);
  });

  it("scores 1 on a complete page with unique ids and clean props", () => {
    const r = structuralScore(cleanPage());
    expect(r.score).toBe(1);
    expect(r.violations).toEqual([]);
  });

  it("scores 0 with a clear violation when there are no blocks", () => {
    expect(structuralScore([]).score).toBe(0);
    expect(structuralScore(undefined).score).toBe(0);
  });

  it("flags a missing required role", () => {
    const blocks = cleanPage().filter((b) => b.type !== "footer");
    const r = structuralScore(blocks);
    expect(r.violations.some((v) => v.detail?.includes('required role "footer"'))).toBe(true);
  });

  it("supports custom required roles (pricing/faq/comparison)", () => {
    const r = structuralScore(cleanPage(), ["hero", "pricing"]);
    expect(r.violations.some((v) => v.detail?.includes('required role "pricing"'))).toBe(true);
    expect(r.violations.some((v) => v.detail?.includes('required role "hero"'))).toBe(false);
  });

  it("flags duplicate and missing block ids", () => {
    const blocks = [
      block("hero", { headline: "A" }, "dup"),
      block("bottom-cta", { headline: "B" }, "dup"),
      { type: "footer", props: { companyName: "Acme" } },
    ];
    const r = structuralScore(blocks as EvalBlock[]);
    expect(r.violations.some((v) => v.detail?.includes("duplicate block id"))).toBe(true);
    expect(r.violations.some((v) => v.detail === "missing block id")).toBe(true);
  });

  it("flags null prop values deep inside arrays and objects", () => {
    const blocks = [
      block("hero", { headline: "Hi", nested: { sub: null } }),
      block("bottom-cta", { items: [{ title: "ok" }, null] }, "cta-1"),
      block("footer", { companyName: "Acme" }, "f-1"),
    ];
    const r = structuralScore(blocks);
    const nullHits = r.violations.filter((v) => v.detail === "null prop value");
    expect(nullHits).toHaveLength(2);
    expect(nullHits.map((v) => v.path)).toContain("blocks[0].props.nested.sub");
    expect(nullHits.map((v) => v.path)).toContain("blocks[1].props.items[1]");
  });

  it("ignores undefined prop values — res.json drops them before any client sees them", () => {
    const blocks = [
      block("hero", { headline: "Hi", accentColor: undefined, tiles: [{ kind: "image", primary: undefined }] }),
      ...cleanPage(),
    ];
    const r = structuralScore(blocks);
    expect(r.violations.filter((v) => (v.detail ?? "").includes("null"))).toHaveLength(0);
  });

  it("flags blocks whose props is not an object", () => {
    const r = structuralScore([{ id: "x", type: "hero", props: "oops" } as EvalBlock, ...cleanPage()]);
    expect(r.violations.some((v) => v.detail === "props is not an object")).toBe(true);
  });
});

// ── subjectLeakScore ─────────────────────────────────────────────────────────

describe("subjectLeakScore", () => {
  it("returns 1 when no markers are configured", () => {
    expect(subjectLeakScore(cleanPage(), []).score).toBe(1);
  });

  it("flags a marker in block copy, case-insensitively, on word boundaries", () => {
    const blocks = [block("hero", { headline: "Why dentists choose dandy labs" })];
    const r = subjectLeakScore(blocks, ["Dandy"]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].value).toBe("Dandy");
  });

  it("does not flag partial-word matches", () => {
    const blocks = [block("hero", { headline: "Dandelions bloom in spring" })];
    expect(subjectLeakScore(blocks, ["Dandy"]).violations).toEqual([]);
  });

  it("scans the page title too", () => {
    const r = subjectLeakScore([], ["Heartland"], "The Heartland playbook");
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].path).toBe("title");
  });
});

// ── degradationScore ─────────────────────────────────────────────────────────

describe("degradationScore", () => {
  it("returns 1 with no degradations or only info-severity entries", () => {
    expect(degradationScore(undefined).score).toBe(1);
    expect(
      degradationScore([{ code: "default_role_injected", severity: "info", detail: "x" }]).score,
    ).toBe(1);
  });

  it("penalizes warn-severity degradations", () => {
    const r = degradationScore([
      { code: "ai_image_generation_failed", severity: "warn", detail: "2 slots empty" },
    ]);
    expect(r.score).toBe(0.75);
    expect(r.violations[0].value).toBe("ai_image_generation_failed");
  });

  it("does not penalize allow-listed warn codes", () => {
    const r = degradationScore(
      [{ code: "reference_scrape_failed", severity: "warn", detail: "host unreachable" }],
      ["reference_scrape_failed"],
    );
    expect(r.score).toBe(1);
  });
});

// ── lineupSignature / lineupDiversityScore (microsite diversity probe) ──────

describe("lineupSignature", () => {
  it("joins ordered body block types, excluding nav/footer chrome", () => {
    const blocks = [
      block("nav-header", {}),
      block("hero", { headline: "Hi" }),
      block("benefits-grid", {}),
      block("bottom-cta", {}),
      block("footer", { companyName: "Acme" }),
    ];
    expect(lineupSignature(blocks)).toBe("hero > benefits-grid > bottom-cta");
  });

  it("excludes microsite DSO chrome (dso-practice-nav is a header block)", () => {
    const blocks = [
      block("dso-practice-nav", {}),
      block("dso-practice-hero", {}),
      block("dso-stat-row", {}),
      block("dso-final-cta", {}),
    ];
    expect(lineupSignature(blocks)).toBe("dso-practice-hero > dso-stat-row > dso-final-cta");
  });

  it("is order-sensitive (a reordered lineup is a different skeleton)", () => {
    const a = [block("hero", {}), block("comparison", {}), block("bottom-cta", {})];
    const b = [block("hero", {}), block("bottom-cta", {}), block("comparison", {})];
    expect(lineupSignature(a)).not.toBe(lineupSignature(b));
  });

  it("returns \"\" for undefined/empty input and skips untyped blocks", () => {
    expect(lineupSignature(undefined)).toBe("");
    expect(lineupSignature([])).toBe("");
    expect(lineupSignature([{ props: {} } as never, block("hero", {})])).toBe("hero");
  });
});

describe("lineupDiversityScore", () => {
  const lineup = (...types: string[]) => types.map((t, i) => block(t, {}, `${t}-${i}`));

  it("scores 1 with no violations when every page has a distinct skeleton", () => {
    const r = lineupDiversityScore([
      { label: "Acme North", blocks: lineup("hero", "benefits-grid", "bottom-cta") },
      { label: "Acme South", blocks: lineup("hero", "comparison", "bottom-cta") },
      { label: "Acme East", blocks: lineup("hero", "how-it-works", "testimonial", "bottom-cta") },
    ]);
    expect(r.score).toBe(1);
    expect(r.violations).toEqual([]);
  });

  it("scores a constant 1 for zero or one page (nothing to compare)", () => {
    expect(lineupDiversityScore([]).score).toBe(1);
    expect(lineupDiversityScore([{ label: "Solo", blocks: lineup("hero") }]).score).toBe(1);
  });

  it("scores distinct/N and lists each duplicated signature with its accounts", () => {
    const shared = ["hero", "benefits-grid", "bottom-cta"];
    const r = lineupDiversityScore([
      { label: "Acme North", blocks: lineup(...shared) },
      { label: "Acme South", blocks: lineup(...shared) },
      { label: "Acme East", blocks: lineup("hero", "comparison", "bottom-cta") },
      { label: "Acme West", blocks: lineup("hero", "testimonial", "bottom-cta") },
    ]);
    expect(r.score).toBe(0.75); // 3 distinct / 4 pages
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].scorer).toBe("lineupDiversity");
    expect(r.violations[0].path).toContain("Acme North");
    expect(r.violations[0].path).toContain("Acme South");
    expect(r.violations[0].value).toBe("hero > benefits-grid > bottom-cta");
  });

  it("treats chrome-only differences as duplicates (the same-skeleton bug class)", () => {
    const r = lineupDiversityScore([
      { label: "A", blocks: [block("nav-header", {}), ...lineup("hero", "benefits-grid", "bottom-cta")] },
      { label: "B", blocks: [...lineup("hero", "benefits-grid", "bottom-cta"), block("footer", {})] },
    ]);
    expect(r.score).toBe(0.5);
    expect(r.violations).toHaveLength(1);
  });

  it("floors at 1/N when every page shares one skeleton", () => {
    const shared = ["hero", "trust-bar", "bottom-cta"];
    const pages = ["A", "B", "C", "D"].map((label) => ({ label, blocks: lineup(...shared) }));
    const r = lineupDiversityScore(pages);
    expect(r.score).toBe(0.25);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].detail).toContain("4 of 4");
  });
});

// ── scoreGeneration (aggregate) ──────────────────────────────────────────────

describe("scoreGeneration", () => {
  const cleanResult: GenerationResultLike = {
    title: "Kite Bookkeeping",
    slug: "kite-bookkeeping",
    blocks: cleanPage(),
    degradations: [],
    usedReference: false,
  };

  it("passes a clean result with default thresholds", () => {
    const report = scoreGeneration({ briefId: "unit-clean", result: cleanResult });
    expect(report.passed).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.scores.structural).toBe(1);
    expect(report.scores.placeholderLeak).toBe(1);
    expect(Object.keys(report.scores).sort()).toEqual(Object.keys(DEFAULT_THRESHOLDS).sort());
  });

  it("fails when a scorer lands under its threshold and lists why", () => {
    const dirty: GenerationResultLike = {
      ...cleanResult,
      blocks: [
        ...cleanPage(),
        block("testimonial", { quote: "Add a quote in brand settings", author: "X" }, "t-1"),
      ],
    };
    const report = scoreGeneration({ briefId: "unit-dirty", result: dirty });
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.startsWith("placeholderLeak"))).toBe(true);
    expect(report.violations.some((v) => v.scorer === "placeholderLeak")).toBe(true);
  });

  it("enforces block-count and usedReference expectations", () => {
    const report = scoreGeneration({
      briefId: "unit-exp",
      result: { ...cleanResult, usedReference: true },
      expectations: { minBlocks: 10, expectUsedReference: false },
    });
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.includes("at least 10"))).toBe(true);
    expect(report.failures.some((f) => f.includes("usedReference"))).toBe(true);
  });

  it("requires expected degradation codes to be present", () => {
    const report = scoreGeneration({
      briefId: "unit-deg",
      result: cleanResult,
      expectations: { expectDegradationCodes: ["reference_scrape_failed"] },
    });
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.includes("reference_scrape_failed"))).toBe(true);
  });

  it("defaults lineupDiversity to a clean 1 when no diversity input is given", () => {
    const report = scoreGeneration({ briefId: "unit-no-probe", result: cleanResult });
    expect(report.scores.lineupDiversity).toBe(1);
    expect(report.passed).toBe(true);
  });

  it("threads a precomputed lineupDiversity result and fails under its threshold", () => {
    const diversity = lineupDiversityScore([
      { label: "A", blocks: cleanPage() },
      { label: "B", blocks: cleanPage() },
      { label: "C", blocks: cleanPage() },
      { label: "D", blocks: cleanPage() },
    ]);
    const report = scoreGeneration({
      briefId: "unit-probe",
      result: cleanResult,
      lineupDiversity: diversity,
    });
    expect(report.scores.lineupDiversity).toBe(0.25);
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.startsWith("lineupDiversity"))).toBe(true);
    expect(report.violations.some((v) => v.scorer === "lineupDiversity")).toBe(true);
  });

  it("fails when a forbidden block type appears (governance noai probe)", () => {
    const report = scoreGeneration({
      briefId: "unit-forbidden",
      result: cleanResult,
      expectations: { forbiddenBlockTypes: ["benefits-grid"] },
    });
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.includes('forbidden block type "benefits-grid"'))).toBe(true);
  });

  it("threads allowedStats + brandAvoidPhrases through to the scorers", () => {
    const result: GenerationResultLike = {
      ...cleanResult,
      blocks: [
        ...cleanPage(),
        block("stat-callout", { stats: [{ value: "93% on-time", label: "pickup" }] }, "s-1"),
        block("content", { body: "A smile journey for every patient" }, "c-1"),
      ],
    };
    const report = scoreGeneration({
      briefId: "unit-thread",
      result,
      allowedStats: ["93% on-time"],
      brandAvoidPhrases: ["smile journey"],
      expectations: { thresholds: { fabricatedStat: 1, bannedPhrase: 1 } },
    });
    expect(report.scores.fabricatedStat).toBe(1);
    expect(report.scores.bannedPhrase).toBe(0.75);
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.startsWith("bannedPhrase"))).toBe(true);
  });
});
