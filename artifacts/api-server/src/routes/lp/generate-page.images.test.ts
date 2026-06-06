import { describe, expect, it } from "vitest";
import {
  validateAndDedupeAIImages,
  fillEmptyImages,
  sanitizeAIImageUrls,
  aiFillEmptyImages,
  buildReferenceFillPool,
  type MediaImage,
} from "./generate-page";

// A small tenant library mixing on-topic (dental/denture), off-topic
// (restaurant) and purpose-classified images, plus an OG/social image.
const LIB: MediaImage[] = [
  { url: "/objects/denture-hero-1", title: "Smiling denture patient", tags: ["lp-hero", "dentures", "patient", "smile"] },
  { url: "/objects/denture-hero-2", title: "Clinic denture consult", tags: ["lp-hero", "dentures", "clinic"] },
  { url: "/objects/dental-feature-1", title: "Denture fitting", tags: ["lp-feature", "dentures", "fitting"] },
  { url: "/objects/dental-feature-2", title: "Dental scan", tags: ["lp-feature", "dental", "scanner"] },
  { url: "/objects/dental-detail-1", title: "Denture closeup", tags: ["product-detail", "dentures", "closeup"] },
  { url: "/objects/restaurant-hero", title: "Restaurant interior", tags: ["lp-hero", "restaurant", "dining", "food"] },
  { url: "/objects/og-share", title: "Share card", tags: ["og-image", "dentures"] },
];

const PAGE_CTX = "dental dentistry dentist clinic teeth affordable dentures landing page";

describe("validateAndDedupeAIImages", () => {
  it("clears a duplicate image assigned to two slots (keeps the first)", () => {
    const blocks = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/objects/denture-hero-1" } },
      { type: "zigzag-features", props: { rows: [{ headline: "Fit", imageUrl: "/objects/denture-hero-1" }] } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("/objects/denture-hero-1");
    expect((blocks[1].props as any).rows[0].imageUrl).toBe("");
  });

  it("clears an off-topic hero pick when a clearly better on-topic hero exists", () => {
    const blocks = [
      { type: "hero", props: { headline: "Affordable dentures", imageUrl: "/objects/restaurant-hero" } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("");
  });

  it("clears a wrong-purpose pick (product-detail in a hero slot)", () => {
    const blocks = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/objects/dental-detail-1" } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("");
  });

  it("keeps a reasonable on-topic, correct-purpose pick", () => {
    const blocks = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/objects/denture-hero-1" } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("/objects/denture-hero-1");
  });

  it("leaves non-library URLs (storage defaults) untouched in the validation pass", () => {
    const blocks = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/objects/not-in-library-default" } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("/objects/not-in-library-default");
  });

  it("end-to-end: off-topic hero + duplicate get replaced by distinct on-topic images, empty slots fill", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Affordable dentures", imageUrl: "/objects/restaurant-hero" } },
      { type: "zigzag-features", props: { rows: [
        { headline: "Custom fit", imageUrl: "/objects/dental-feature-1" },
        { headline: "Fast turnaround", imageUrl: "/objects/dental-feature-1" }, // duplicate
        { headline: "Digital scan", imageUrl: "" }, // empty → must fill
      ] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    blocks = validateAndDedupeAIImages(blocks, LIB, PAGE_CTX) as any[];
    blocks = fillEmptyImages(blocks, LIB, PAGE_CTX) as any[];

    const hero = blocks[0].props.imageUrl as string;
    const rows = blocks[1].props.rows as Array<{ imageUrl: string }>;

    // Hero replaced with an on-topic hero image (not the restaurant photo).
    expect(hero).not.toBe("/objects/restaurant-hero");
    expect(hero.startsWith("/objects/denture-hero")).toBe(true);

    // All three row images present, on-topic, and distinct (no repeats).
    const urls = [hero, ...rows.map(r => r.imageUrl)];
    for (const u of urls) expect(u).toBeTruthy();
    expect(new Set(urls).size).toBe(urls.length);
    for (const r of rows) expect(r.imageUrl).not.toBe("/objects/restaurant-hero");
  });

  it("fill does not reuse a URL kept in a previously-untracked shape (cards)", () => {
    // Two equally on-topic feature images; without harvesting cards[].imageUrl,
    // the empty row would re-pick feat-a (already used by the card).
    const featLib: MediaImage[] = [
      { url: "/objects/feat-a", title: "A", tags: ["lp-feature", "dentures"] },
      { url: "/objects/feat-b", title: "B", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "sticky-stack", props: { cards: [{ title: "Crowns", imageUrl: "/objects/feat-a" }] } },
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures fitting", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    expect(blocks[0].props.cards[0].imageUrl).toBe("/objects/feat-a");
    expect(blocks[1].props.rows[0].imageUrl).toBe("/objects/feat-b");
  });

  it("fill harvests kept URLs across all previously-untracked shapes", () => {
    const lib: MediaImage[] = [
      { url: "/objects/k-card", title: "card", tags: ["lp-feature", "dentures"] },
      { url: "/objects/k-panel", title: "panel", tags: ["lp-feature", "dentures"] },
      { url: "/objects/k-before", title: "before", tags: ["lp-feature", "dentures"] },
      { url: "/objects/k-after", title: "after", tags: ["lp-feature", "dentures"] },
      { url: "/objects/k-slide", title: "slide", tags: ["lp-feature", "dentures"] },
      { url: "/objects/k-tile", title: "tile", tags: ["lp-feature", "dentures"] },
      { url: "/objects/k-hero", title: "hero", tags: ["lp-hero", "dentures"] },
      { url: "/objects/free-feature", title: "free", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "dso-heartland-hero", props: { layout: "split", heroImageUrl: "/objects/k-hero" } },
      { type: "sticky-stack", props: { cards: [{ title: "c", imageUrl: "/objects/k-card" }] } },
      { type: "horizontal-showcase", props: { panels: [{ title: "p", imageUrl: "/objects/k-panel" }] } },
      { type: "before-after-gallery", props: { pairs: [{ caption: "x", beforeSrc: "/objects/k-before", afterSrc: "/objects/k-after" }] } },
      { type: "editorial-carousel", props: { slides: [{ caption: "s", src: "/objects/k-slide" }] } },
      { type: "bento-showcase", props: { tiles: [{ kind: "image", primary: "/objects/k-tile" }] } },
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, lib, PAGE_CTX) as any[];
    // The empty row must get the one free feature image, not any kept URL.
    expect(blocks[6].props.rows[0].imageUrl).toBe("/objects/free-feature");
  });

  it("validate+fill: cleared duplicate is refilled with a distinct image", () => {
    const featLib: MediaImage[] = [
      { url: "/objects/feat-a", title: "A", tags: ["lp-feature", "dentures"] },
      { url: "/objects/feat-b", title: "B", tags: ["lp-feature", "dentures"] },
      { url: "/objects/feat-c", title: "C", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "sticky-stack", props: { cards: [
        { title: "1", imageUrl: "/objects/feat-a" },
        { title: "2", imageUrl: "/objects/feat-a" }, // duplicate
        { title: "3", imageUrl: "" }, // empty
      ] } },
    ];
    blocks = validateAndDedupeAIImages(blocks, featLib, PAGE_CTX) as any[];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    const urls = blocks[0].props.cards.map((c: any) => c.imageUrl);
    expect(urls[0]).toBe("/objects/feat-a");
    for (const u of urls) expect(u).toBeTruthy();
    expect(new Set(urls).size).toBe(3); // all distinct
  });

  it("clears an OG/social image via sanitize before validation runs", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/objects/og-share" } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    expect(blocks[0].props.imageUrl).toBe("");
  });

  it("strips any per-item image from a trust-bar (numeric stat bars never pair a label with a photo)", () => {
    let blocks: any[] = [
      { type: "trust-bar", props: { items: [
        { value: "98%", label: "Customer satisfaction rating", image: "/objects/dental-feature-1" },
        { value: "$0", label: "Upfront cost", image: "/objects/restaurant-hero" },
        { value: "10,000+", label: "Teams using us", image: "" },
      ] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    for (const item of blocks[0].props.items as Array<{ image: string }>) {
      expect(item.image).toBe("");
    }
  });

  it("'stats' (legacy trust-bar alias) is also stripped of item images", () => {
    let blocks: any[] = [
      { type: "stats", props: { items: [
        { value: "5x", label: "Faster onboarding", image: "/objects/dental-feature-2" },
      ] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    expect((blocks[0].props.items as Array<{ image: string }>)[0].image).toBe("");
  });

  it("fillEmptyImages never back-fills a trust-bar item image left empty", () => {
    const featLib: MediaImage[] = [
      { url: "/objects/feat-a", title: "A", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "trust-bar", props: { items: [
        { value: "98%", label: "Patient satisfaction", image: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    expect((blocks[0].props.items as Array<{ image: string }>)[0].image).toBe("");
  });

  it("aiFillEmptyImages collects no slot for a trust-bar/stats item image (numeric-only, no AI gen)", async () => {
    // A stat-bar-only page has no fillable image slots, so aiFillEmptyImages
    // returns immediately without ever calling image generation. This pins
    // that empty trust-bar/stats item images are NOT treated as AI-fillable.
    const blocks: any[] = [
      { type: "trust-bar", props: { items: [
        { value: "98%", label: "Customer satisfaction rating", image: "" },
        { value: "$0", label: "Upfront cost", image: "" },
      ] } },
      { type: "stats", props: { items: [
        { value: "5x", label: "Faster onboarding", image: "" },
      ] } },
    ];
    const brand = { brandName: "Acme", primaryColor: "#000", accentColor: "#111", productLines: [] } as any;
    const out = (await aiFillEmptyImages(blocks, 1, brand, "test brief")) as any[];
    for (const item of out[0].props.items as Array<{ image: string }>) expect(item.image).toBe("");
    expect((out[1].props.items as Array<{ image: string }>)[0].image).toBe("");
  });
});

// ── CLEAR_GAP threshold validation ─────────────────────────────────────────
// These cases pin the documented rationale for CLEAR_GAP (= 2 × TAG_MATCH_SCORE
// = 6). A correct-purpose image whose purpose matches scores PURPOSE_MATCH_BOOST
// (+8); each on-topic single-word content tag adds +4 (a +3 text-match plus a +1
// word-level bonus). So:
//   - one topic tag behind the best free alternative → gap 4 (< 6): KEEP. One
//     extra tag of difference is treated as noise; we don't churn a good pick.
//   - two topic tags behind → gap 8 (≥ 6): CLEAR. The alternative is decisively
//     more on-topic, so the model's bare pick is dropped for smart-fill to
//     replace. CLEAR_GAP=6 sits squarely between these two cases.
// Headline + page context share the same two tokens so the gap is predictable.
describe("validateAndDedupeAIImages — CLEAR_GAP threshold", () => {
  const CTX = "alpha bravo";

  // assigned: purpose (+8) + "alpha" (+4)          = 12
  // best alt: purpose (+8) + "alpha" (+4) + "bravo" (+4) = 16  → gap 4 < 6
  it("keeps a pick only one topic-tag behind the best free alternative (gap 4 < 6)", () => {
    const lib: MediaImage[] = [
      { url: "/objects/assigned", title: "x", tags: ["lp-hero", "alpha"] },
      { url: "/objects/better", title: "x", tags: ["lp-hero", "alpha", "bravo"] },
    ];
    const blocks = [
      { type: "hero", props: { headline: "alpha bravo", imageUrl: "/objects/assigned" } },
    ];
    validateAndDedupeAIImages(blocks, lib, CTX);
    expect((blocks[0].props as any).imageUrl).toBe("/objects/assigned");
  });

  // assigned: purpose (+8) + 0 on-topic tags            = 8  ("zzz" never matches)
  // best alt: purpose (+8) + "alpha" (+4) + "bravo" (+4) = 16  → gap 8 ≥ 6
  it("clears a bare correct-purpose pick when the alternative is two topic-tags clearer (gap 8 ≥ 6)", () => {
    const lib: MediaImage[] = [
      { url: "/objects/assigned", title: "x", tags: ["lp-hero", "zzz"] },
      { url: "/objects/better", title: "x", tags: ["lp-hero", "alpha", "bravo"] },
    ];
    const blocks = [
      { type: "hero", props: { headline: "alpha bravo", imageUrl: "/objects/assigned" } },
    ];
    validateAndDedupeAIImages(blocks, lib, CTX);
    expect((blocks[0].props as any).imageUrl).toBe("");
  });
});

// ── Generic industry (no injected vertical keywords) ────────────────────────
// A generic tenant's only topic signal is its own prompt. Validation must still
// clear an off-topic pick and keep an on-topic one using prompt words alone.
describe("validateAndDedupeAIImages — generic industry (prompt-only context)", () => {
  const GENERIC_LIB: MediaImage[] = [
    { url: "/objects/coffee-hero", title: "Espresso bar", tags: ["lp-hero", "coffee", "espresso", "cafe"] },
    { url: "/objects/coffee-hero-2", title: "Roastery", tags: ["lp-hero", "coffee", "roastery"] },
    { url: "/objects/gym-hero", title: "Weight room", tags: ["lp-hero", "gym", "fitness"] },
  ];
  // No industry keywords prepended — this is exactly what pageImageContext is
  // for a generic tenant (getIndustryImageKeywords("generic") === []).
  const GENERIC_CTX = "specialty coffee roastery espresso landing page";

  it("clears an off-topic hero using prompt words alone", () => {
    const blocks = [
      { type: "hero", props: { headline: "Specialty coffee", imageUrl: "/objects/gym-hero" } },
    ];
    validateAndDedupeAIImages(blocks, GENERIC_LIB, GENERIC_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("");
  });

  it("keeps an on-topic hero using prompt words alone", () => {
    const blocks = [
      { type: "hero", props: { headline: "Specialty coffee", imageUrl: "/objects/coffee-hero" } },
    ];
    validateAndDedupeAIImages(blocks, GENERIC_LIB, GENERIC_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("/objects/coffee-hero");
  });
});

describe("buildReferenceFillPool — reference-image fidelity", () => {
  const curated: MediaImage = { url: "/objects/brand-photo", title: "Brand photo", tags: ["brand-import", "photography"] };
  // A stale scrape from a PRIOR generation (apple.com) and a CURRENT-reference
  // scrape already in the catalog (clay.com), plus a freshly-harvested clay row.
  const staleApple: MediaImage = { url: "/objects/apple-1", title: "apple image 1", tags: ["page-reference", "scraped", "refhost:apple.com", "refsrc:aaa"] };
  const priorClay: MediaImage = { url: "/objects/clay-prior", title: "clay image 1", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:bbb"] };
  const freshClay: MediaImage = { url: "/objects/clay-fresh", title: "clay fresh", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:ccc"] };

  it("orders curated → current-reference scraped → other-host scraped", () => {
    // Catalog is newest-first: stale apple appears BEFORE the prior clay scrape.
    const catalog = [staleApple, priorClay, curated];
    const pool = buildReferenceFillPool(catalog, [freshClay], ["https://www.clay.com/use-cases/plg-assist"]);
    expect(pool.map((p) => p.url)).toEqual([
      "/objects/brand-photo", // curated first
      "/objects/clay-fresh", // freshly-harvested current reference
      "/objects/clay-prior", // earlier scrape of the SAME host
      "/objects/apple-1", // stale other-host scrape last
    ]);
  });

  it("a tie between stale apple and fresh clay resolves to clay (findBestImage keeps first max-scorer)", () => {
    // No content-tag or purpose overlap → every scraped image scores 0; ordering decides.
    const catalog = [staleApple, freshClay];
    const pool = buildReferenceFillPool(catalog, [freshClay], ["https://clay.com/x"]);
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow", body: "", imageUrl: "" }] } },
    ];
    const filled = fillEmptyImages(blocks, pool, "saas pipeline") as any[];
    expect(filled[0].props.rows[0].imageUrl).toBe("/objects/clay-fresh");
  });

  it("dedupes a freshly-harvested row that is also present in the catalog", () => {
    // mirrorReferenceImages returns existing rows for already-mirrored refsrc, so
    // the fresh row can also appear in the catalog — it must not be duplicated.
    const pool = buildReferenceFillPool([freshClay, curated], [freshClay], ["https://clay.com/x"]);
    expect(pool.filter((p) => p.url === "/objects/clay-fresh")).toHaveLength(1);
    expect(pool.map((p) => p.url)).toEqual(["/objects/brand-photo", "/objects/clay-fresh"]);
  });

  it("with no reference URL, all scrapes fall to the other-host tail (no regression)", () => {
    const pool = buildReferenceFillPool([staleApple, curated], [], []);
    expect(pool.map((p) => p.url)).toEqual(["/objects/brand-photo", "/objects/apple-1"]);
  });

  it("matches a legacy refhost:www.<host> tag against a bare reference host", () => {
    const wwwClay: MediaImage = { url: "/objects/clay-www", title: "clay www", tags: ["scraped", "refhost:www.clay.com"] };
    const pool = buildReferenceFillPool([staleApple, wwwClay], [], ["https://clay.com/x"]);
    // www.clay.com tag must be treated as the current reference, ahead of apple.
    expect(pool.map((p) => p.url)).toEqual(["/objects/clay-www", "/objects/apple-1"]);
  });

  it("ignores malformed reference URLs without throwing", () => {
    const pool = buildReferenceFillPool([priorClay, curated], [], ["not a url", ""]);
    // No valid current-ref host derived → clay scrape falls to the tail.
    expect(pool.map((p) => p.url)).toEqual(["/objects/brand-photo", "/objects/clay-prior"]);
  });

  it("treats a scrape with no refhost tag as other-host", () => {
    const noHost: MediaImage = { url: "/objects/orphan", title: "orphan scrape", tags: ["scraped"] };
    const pool = buildReferenceFillPool([noHost, freshClay], [freshClay], ["https://clay.com/x"]);
    expect(pool.map((p) => p.url)).toEqual(["/objects/clay-fresh", "/objects/orphan"]);
  });
});
