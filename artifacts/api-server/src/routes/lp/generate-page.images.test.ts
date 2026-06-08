import { describe, expect, it } from "vitest";
import {
  validateAndDedupeAIImages,
  fillEmptyImages,
  sanitizeAIImageUrls,
  aiFillEmptyImages,
  buildReferenceFillPool,
  buildTrustedScrapedIds,
  collectImageSlots,
  isLogoImageUrl,
  buildBrandLogoUrlSet,
  buildBlockSelectionDirective,
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

// ── benefits-grid per-card photos are opt-in (useItemPhotos) ────────────────
// benefits-grid / features are ICON-ONLY by default. Their per-item `image`
// slots are only back-filled when the model opts the whole block in with
// `useItemPhotos === true`; otherwise an empty `image` stays empty so the card
// falls back to its Lucide icon. product-grid (a non-ITEM_PHOTO item block) is
// inherently photo-driven and always fills regardless of the flag.
describe("fillEmptyImages — benefits-grid per-card photos (useItemPhotos opt-in)", () => {
  const featLib: MediaImage[] = [
    { url: "/objects/feat-a", title: "A", tags: ["lp-feature", "dentures"] },
    { url: "/objects/feat-b", title: "B", tags: ["lp-feature", "dentures"] },
  ];

  it("does NOT fill benefits-grid item images when useItemPhotos is unset (icon-only default)", () => {
    let blocks: any[] = [
      { type: "benefits-grid", props: { items: [
        { icon: "Shield", title: "Custom fit", description: "Dentures", image: "" },
        { icon: "Clock", title: "Fast turnaround", description: "Dentures", image: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    for (const item of blocks[0].props.items as Array<{ image: string }>) {
      expect(item.image).toBe("");
    }
  });

  it("fills benefits-grid item images when useItemPhotos === true", () => {
    let blocks: any[] = [
      { type: "benefits-grid", props: { useItemPhotos: true, items: [
        { icon: "Shield", title: "Custom fit", description: "Dentures", image: "" },
        { icon: "Clock", title: "Fast turnaround", description: "Dentures", image: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    const imgs = (blocks[0].props.items as Array<{ image: string }>).map((i) => i.image);
    for (const img of imgs) expect(img).toBeTruthy();
    expect(new Set(imgs).size).toBe(imgs.length); // distinct
  });

  it("product-grid item images fill regardless of useItemPhotos (inherently photo-driven)", () => {
    const prodLib: MediaImage[] = [
      { url: "/objects/prod-a", title: "A", tags: ["product-detail", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "product-grid", props: { items: [
        { title: "Denture set", description: "Dentures", image: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, prodLib, PAGE_CTX) as any[];
    expect((blocks[0].props.items as Array<{ image: string }>)[0].image).toBe("/objects/prod-a");
  });
});

// ── sibling-tenant tie-breaker (foreignTenant penalty) ──────────────────────
// A reciprocal sibling's image is flagged foreignTenant at catalog-build time and
// gets a small −1 nudge so a tenant prefers its OWN assets when scores are
// otherwise tied. The penalty is deliberately tiny: a clearly more on-topic
// sibling image still wins on real relevance points.
describe("scoreImage foreignTenant penalty — sibling tie-break", () => {
  it("prefers the tenant's own image over an equally-scored sibling image", () => {
    // foreign image is listed FIRST; findBestImage keeps the first max-scorer, so
    // only the −1 penalty lets the tenant's own (second) image win the tie.
    const lib: MediaImage[] = [
      { url: "/objects/sibling-feat", title: "x", tags: ["lp-feature", "dentures"], foreignTenant: true },
      { url: "/objects/own-feat", title: "x", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures", body: "", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, lib, PAGE_CTX) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/own-feat");
  });

  it("a clearly more on-topic sibling image still beats the tenant's own (penalty is tiny)", () => {
    const lib: MediaImage[] = [
      { url: "/objects/sibling-feat", title: "x", tags: ["lp-feature", "dentures", "patient"], foreignTenant: true },
      { url: "/objects/own-feat", title: "x", tags: ["lp-feature"] },
    ];
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures patient", body: "", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, lib, PAGE_CTX) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/sibling-feat");
  });
});

// ── CLEAR_GAP threshold validation ─────────────────────────────────────────
// These cases pin the documented rationale for CLEAR_GAP (= PURPOSE_MATCH_BOOST
// = 8). A correct-purpose image whose purpose matches scores PURPOSE_MATCH_BOOST
// (+8); each on-topic single-word content tag adds +4 (a +3 text-match plus a +1
// word-level bonus). So:
//   - one topic tag behind the best free alternative → gap 4 (< 8): KEEP. One
//     extra tag of difference is treated as noise; we don't churn a good pick.
//   - two topic tags behind → gap 8 (≥ 8): CLEAR. The alternative is decisively
//     more on-topic — a full purpose-match's worth of relevance ahead — so the
//     model's bare pick is dropped for smart-fill to replace.
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
    // No content-tag or purpose overlap → every scraped image scores 0; ordering
    // decides. Off-topic scraped images no longer fill in the STRICT pass (they
    // need positive relevance there), so this tie-ordering property is exercised
    // via the relaxed last-resort pass, where score-0 scrapes are eligible.
    const catalog = [staleApple, freshClay];
    const pool = buildReferenceFillPool(catalog, [freshClay], ["https://clay.com/x"]);
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow", body: "", imageUrl: "" }] } },
    ];
    const filled = fillEmptyImages(blocks, pool, "saas pipeline", true) as any[];
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

  it("ranks generic starter seeds BELOW the current reference's scrapes (but genuine curated still wins first)", () => {
    const starter: MediaImage = { url: "/objects/starter-1", title: "Starter 14142350", tags: ["starter", "generic"] };
    // Catalog newest-first: starter and a prior clay scrape, plus a fresh clay row.
    const pool = buildReferenceFillPool(
      [starter, priorClay, curated],
      [freshClay],
      ["https://clay.com/x"],
    );
    expect(pool.map((p) => p.url)).toEqual([
      "/objects/brand-photo", // genuine curated still first
      "/objects/clay-fresh", // current-reference scrape
      "/objects/clay-prior", // earlier scrape of the same host
      "/objects/starter-1", // generic starter seed demoted below scrapes
    ]);
  });

  it("a tie between a starter seed and the current reference's scrape resolves to the scrape", () => {
    // Starter seeds are purpose-neutral → score 0, same as an untagged scrape;
    // ordering must let the requested site's image win the slot. The current
    // reference's scrape is trusted (buildTrustedScrapedIds), so it passes the
    // strict non-negative gate just like the curated/starter assets.
    const starter: MediaImage = { url: "/objects/starter-1", title: "Starter 14142350", tags: ["starter", "generic"] };
    const refUrls = ["https://clay.com/x"];
    const pool = buildReferenceFillPool([starter, freshClay], [freshClay], refUrls);
    const trusted = buildTrustedScrapedIds([starter, freshClay], [freshClay], refUrls);
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow", body: "", imageUrl: "" }] } },
    ];
    const filled = fillEmptyImages(blocks, pool, "saas pipeline", false, undefined, trusted) as any[];
    expect(filled[0].props.rows[0].imageUrl).toBe("/objects/clay-fresh");
  });
});

// ── Near-duplicate-URL dedup ────────────────────────────────────────────────
// The same visual asset routinely appears under cosmetically-different URLs
// (responsive resize variants, query-string cache busters, host casing, the
// /api/storage serve prefix). Dedup must recognise these as ONE image so a
// single photo can't fill multiple slots.
describe("validateAndDedupeAIImages — near-duplicate URL dedup", () => {
  it("clears a query-string resize variant of an already-placed image", () => {
    const blocks = [
      { type: "hero", props: { headline: "x", imageUrl: "https://cdn.example.com/scanner.jpg?w=400" } },
      { type: "zigzag-features", props: { rows: [{ headline: "y", imageUrl: "https://cdn.example.com/scanner.jpg?w=1200" }] } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("https://cdn.example.com/scanner.jpg?w=400");
    expect((blocks[1].props as any).rows[0].imageUrl).toBe("");
  });

  it("clears a filename resize-suffix variant (-800x600 vs -1600x1200)", () => {
    const blocks = [
      { type: "hero", props: { headline: "x", imageUrl: "https://cdn.example.com/hero-800x600.jpg" } },
      { type: "zigzag-features", props: { rows: [{ headline: "y", imageUrl: "https://cdn.example.com/hero-1600x1200.jpg" }] } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[1].props as any).rows[0].imageUrl).toBe("");
  });

  it("collapses protocol / www / host-casing differences", () => {
    const blocks = [
      { type: "hero", props: { headline: "x", imageUrl: "https://www.Example.com/a/img.png" } },
      { type: "zigzag-features", props: { rows: [{ headline: "y", imageUrl: "http://example.com/a/img.png" }] } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[1].props as any).rows[0].imageUrl).toBe("");
  });

  it("collapses the /api/storage serve-path prefix against a bare /objects path", () => {
    const blocks = [
      { type: "hero", props: { headline: "x", imageUrl: "/api/storage/objects/uploads/abc.jpg" } },
      { type: "zigzag-features", props: { rows: [{ headline: "y", imageUrl: "/objects/uploads/abc.jpg" }] } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[1].props as any).rows[0].imageUrl).toBe("");
  });

  it("does NOT merge genuinely different images from the same host", () => {
    const blocks = [
      { type: "hero", props: { headline: "x", imageUrl: "https://cdn.example.com/scanner.jpg" } },
      { type: "zigzag-features", props: { rows: [{ headline: "y", imageUrl: "https://cdn.example.com/team.jpg" }] } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("https://cdn.example.com/scanner.jpg");
    expect((blocks[1].props as any).rows[0].imageUrl).toBe("https://cdn.example.com/team.jpg");
  });

  it("fillEmptyImages will not re-place a library URL near-duplicate of a kept image", () => {
    // The kept slot holds the canonical URL; the pool also contains a resize
    // variant of the SAME photo. The empty sibling must get the distinct photo,
    // never the variant.
    const lib: MediaImage[] = [
      { url: "/objects/uploads/photo.jpg", title: "Photo", tags: ["lp-feature", "dentures"] },
      { url: "/objects/uploads/photo-800x600.jpg", title: "Photo variant", tags: ["lp-feature", "dentures"] },
      { url: "/objects/uploads/distinct.jpg", title: "Distinct", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [
        { headline: "Dentures fitting", imageUrl: "/objects/uploads/photo.jpg" },
        { headline: "Dentures care", imageUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, lib, PAGE_CTX) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/uploads/photo.jpg");
    expect(blocks[0].props.rows[1].imageUrl).toBe("/objects/uploads/distinct.jpg");
  });
});

// ── Single-image domination cap ─────────────────────────────────────────────
// When a reference scrape mirrors the SAME photo at several sizes, each lands as
// a distinct object-storage row (unique UUID URL, distinct refsrc tag). Their
// shared reference host + title stem must fold them to ONE identity so the photo
// fills at most one slot — the page prefers a distinct image, or an empty slot
// for AI/neutral fill, over repeating it.
describe("fillEmptyImages — single-image domination cap (scraped resize variants)", () => {
  const scannerA: MediaImage = { url: "/objects/scan-a", title: "scanner 800x600", tags: ["page-reference", "scraped", "refhost:dental.com", "refsrc:a"] };
  const scannerB: MediaImage = { url: "/objects/scan-b", title: "scanner 1200x900", tags: ["page-reference", "scraped", "refhost:dental.com", "refsrc:b"] };
  const scannerC: MediaImage = { url: "/objects/scan-c", title: "scanner 1600x1200", tags: ["page-reference", "scraped", "refhost:dental.com", "refsrc:c"] };
  const chair: MediaImage = { url: "/objects/chair", title: "chair 1024x768", tags: ["page-reference", "scraped", "refhost:dental.com", "refsrc:d"] };

  it("places one scanner variant and leaves the over-dominated siblings' slots empty", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [
        { headline: "Scan", imageUrl: "" },
        { headline: "Treat", imageUrl: "" },
        { headline: "Smile", imageUrl: "" },
      ] } },
    ];
    // Off-topic scrapes (score 0 vs "dental clinic") fill only in the relaxed
    // pass now; the identity-folding cap is pass-independent and asserted here.
    blocks = fillEmptyImages(blocks, [scannerA, scannerB, scannerC], "dental clinic", true) as any[];
    const urls = (blocks[0].props.rows as Array<{ imageUrl: string }>).map((r) => r.imageUrl);
    const filled = urls.filter(Boolean);
    expect(filled).toHaveLength(1); // one scanner, no repeats
    expect(["/objects/scan-a", "/objects/scan-b", "/objects/scan-c"]).toContain(filled[0]);
  });

  it("prefers a DISTINCT image over a second copy of the dominant photo", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [
        { headline: "Scan", imageUrl: "" },
        { headline: "Comfort", imageUrl: "" },
        { headline: "Extra", imageUrl: "" },
      ] } },
    ];
    // Off-topic scrapes fill only in the relaxed pass; folding is pass-independent.
    blocks = fillEmptyImages(blocks, [scannerA, scannerB, chair], "dental clinic", true) as any[];
    const urls = (blocks[0].props.rows as Array<{ imageUrl: string }>).map((r) => r.imageUrl);
    const filled = urls.filter(Boolean);
    // The two scanner variants collapse to one identity; the chair is distinct.
    expect(filled).toHaveLength(2);
    expect(filled).toContain("/objects/chair");
    expect(new Set(filled).size).toBe(2);
  });

  it("the relaxed (library-exhausting) pass still never repeats the dominant photo", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [
        { headline: "Scan", imageUrl: "" },
        { headline: "Treat", imageUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, [scannerA, scannerB], "dental clinic", true) as any[];
    const urls = (blocks[0].props.rows as Array<{ imageUrl: string }>).map((r) => r.imageUrl);
    expect(urls.filter(Boolean)).toHaveLength(1);
    expect(urls[1]).toBe("");
  });

  it("distinct scraped photos from the same host are NOT folded together", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [
        { headline: "Scan", imageUrl: "" },
        { headline: "Comfort", imageUrl: "" },
      ] } },
    ];
    // Off-topic scrapes fill only in the relaxed pass; distinctness is asserted there.
    blocks = fillEmptyImages(blocks, [scannerA, chair], "dental clinic", true) as any[];
    const urls = (blocks[0].props.rows as Array<{ imageUrl: string }>).map((r) => r.imageUrl);
    expect(urls.filter(Boolean)).toHaveLength(2);
    expect(new Set(urls).size).toBe(2);
  });
});

describe("findBestImage — scraped images need positive relevance in the strict pass", () => {
  // A scraped page-reference harvest whose title does NOT overlap the slot
  // context → scores 0 against "dental clinic dentures".
  const offTopicScrape: MediaImage = {
    url: "/objects/scrape-x",
    title: "hero banner 1600x900",
    tags: ["page-reference", "scraped", "refhost:acme.com"],
  };
  // A scraped harvest whose title overlaps the slot context → scores > 0.
  const onTopicScrape: MediaImage = {
    url: "/objects/scrape-dent",
    title: "dental implants close up",
    tags: ["page-reference", "scraped", "refhost:acme.com"],
  };
  // An untagged CURATED image (drawer upload): tags:[] → NOT scraped.
  const untaggedCurated: MediaImage = {
    url: "/objects/drawer-x",
    title: "office lobby",
    tags: [],
  };

  it("does NOT place an off-topic scraped image in the strict pass", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures fitting", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [offTopicScrape], "dental clinic dentures") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("");
  });

  it("DOES place that same off-topic scraped image in the relaxed last-resort pass", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures fitting", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [offTopicScrape], "dental clinic dentures", true) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/scrape-x");
  });

  it("does NOT place an off-topic scraped image even when context contains 'landing page' (page-reference meta-tag is non-semantic)", () => {
    // Regression: the "page-reference" provenance tag partial-matches the word
    // "page" — ubiquitous in "landing page" prompts — which used to lift an
    // off-topic scrape over the strict gate. Meta-tags must score 0.
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dentures fitting", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [offTopicScrape], "dental clinic dentures landing page") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("");
  });

  it("places a RELEVANT scraped image in the strict pass (positive relevance signal)", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dental implants", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [onTopicScrape], "dental implants clinic") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/scrape-dent");
  });

  it("still places an untagged CURATED image in the strict pass (scoping is scraped-only)", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Anything", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [untaggedCurated], "totally unrelated context") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/drawer-x");
  });
});

// ── Task #1218: THIS run's scrapes are trusted in the strict pass ────────────
// A scrape harvested from the reference URL the user pointed us at THIS run
// (freshScrapedMedia) or already in the catalog under a current-reference host
// should fill empty slots on the same non-negative gate as curated images —
// even when its title doesn't lexically overlap the slot context. Stale scrapes
// from unrelated prior generations keep the strict `> 0` gate.
describe("buildTrustedScrapedIds — current-run scrape trust", () => {
  const freshClay: MediaImage = { url: "/objects/clay-fresh", title: "abstract gradient", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:ccc"] };
  const priorClay: MediaImage = { url: "/objects/clay-prior", title: "team offsite", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:bbb"] };
  const staleApple: MediaImage = { url: "/objects/apple-1", title: "product shot", tags: ["page-reference", "scraped", "refhost:apple.com", "refsrc:aaa"] };
  const curated: MediaImage = { url: "/objects/brand-photo", title: "office lobby", tags: ["brand-import", "photography"] };

  // The set is keyed by imageIdentity (scrapes fold to `s:<host>:<title-stem>`),
  // so we assert membership by SIZE — the fillEmptyImages tests below exercise
  // the exact keys end-to-end. Inputs are chosen so size pins WHICH rows count:
  // fresh clay (1) + catalog clay same-host (1) = 2; apple (other host) and the
  // curated row must NOT be counted, or the size would be 3+.
  it("trusts freshly-harvested scrapes and catalog scrapes from the current reference host", () => {
    const trusted = buildTrustedScrapedIds([priorClay, staleApple, curated], [freshClay], ["https://www.clay.com/x"]);
    expect(trusted.size).toBe(2); // clay-fresh + clay-prior; NOT apple, NOT curated
  });

  it("trusts ONLY fresh scrapes when there is no reference URL", () => {
    const trusted = buildTrustedScrapedIds([priorClay, staleApple], [freshClay], []);
    expect(trusted.size).toBe(1); // only the freshly-harvested clay row
  });

  it("fillEmptyImages PLACES a trusted off-topic scrape in the strict pass", () => {
    // freshClay's title ("abstract gradient") does NOT overlap "saas pipeline" →
    // scores 0. Untrusted it would be held back, but as a current-run scrape it
    // fills the slot on the curated (>= 0) gate.
    const trusted = buildTrustedScrapedIds([curated], [freshClay], ["https://clay.com/x"]);
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [freshClay], "saas pipeline", false, undefined, trusted) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/clay-fresh");
  });

  it("WITHOUT the trusted set, that same off-topic scrape is held back in the strict pass", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [freshClay], "saas pipeline", false) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("");
  });

  it("does NOT trust a stale other-host scrape even with a reference URL set", () => {
    const trusted = buildTrustedScrapedIds([staleApple], [], ["https://clay.com/x"]);
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [staleApple], "saas pipeline", false, undefined, trusted) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("");
  });
});

// ── Task #1134: logos survive "Replace imagery" ─────────────────────────────
// Logo images sitting in scanned image slots (hero imageUrl, backgroundImage,
// images[].src, cases[].image, etc.) must NEVER be cleared, library-swapped, or
// AI-regenerated when "Replace imagery" is on. Protection lives in the shared
// pipeline (collectImageSlots excludes logo slots; sanitize preserves them) so
// both the marketing and microsite generators inherit it.
describe("isLogoImageUrl — logo detection", () => {
  it("matches the bundled Dandy brand marks by pathname", () => {
    expect(isLogoImageUrl("/dandy-logo.svg")).toBe(true);
    expect(isLogoImageUrl("/dandy-logo-white.svg")).toBe(true);
    expect(isLogoImageUrl("https://lp.meetdandy.com/dandy-logo-white.svg")).toBe(true);
  });

  it("matches a filename whose token clearly names a logo", () => {
    expect(isLogoImageUrl("/api/storage/objects/uploads/acme-logo.svg")).toBe(true);
    expect(isLogoImageUrl("/assets/logo-white.png")).toBe(true);
    expect(isLogoImageUrl("/assets/logo2.svg")).toBe(true);
    expect(isLogoImageUrl("/assets/partner-logos.png")).toBe(true);
    expect(isLogoImageUrl("https://cdn.example.com/brand/logo.png?v=2")).toBe(true);
  });

  it("does NOT misclassify content photos that merely contain the substring", () => {
    expect(isLogoImageUrl("/objects/catalogos.jpg")).toBe(false);
    expect(isLogoImageUrl("/objects/denture-hero-1")).toBe(false);
    expect(isLogoImageUrl("/api/storage/objects/uploads/clinic-photo.jpg")).toBe(false);
    expect(isLogoImageUrl("")).toBe(false);
    expect(isLogoImageUrl(undefined)).toBe(false);
  });

  it("matches the tenant's brand logo URL even without a logo-like filename", () => {
    const logoUrls = buildBrandLogoUrlSet({
      logoUrl: "/api/storage/objects/uploads/abcdef-123",
      logoUrlDark: "https://lp.acme.com/api/storage/objects/uploads/dark-987",
    });
    expect(isLogoImageUrl("/api/storage/objects/uploads/abcdef-123", logoUrls)).toBe(true);
    // A root-relative reference to the dark logo also matches via pathname.
    expect(isLogoImageUrl("/api/storage/objects/uploads/dark-987", logoUrls)).toBe(true);
    // An unrelated storage object is still treated as a content photo.
    expect(isLogoImageUrl("/api/storage/objects/uploads/zzz-000", logoUrls)).toBe(false);
  });
});

describe("collectImageSlots — excludes logo slots", () => {
  it("never returns a slot whose value is a logo (filename heuristic)", () => {
    const block = {
      type: "hero",
      props: {
        headline: "Welcome",
        imageUrl: "/assets/acme-logo.svg",
        backgroundImage: "/objects/denture-hero-1",
      },
    };
    const slots = collectImageSlots(block as any);
    const values = slots.map((s) => s.get());
    expect(values).toContain("/objects/denture-hero-1");
    expect(values).not.toContain("/assets/acme-logo.svg");
  });

  it("excludes a brand-logo storage URL passed via logoUrls", () => {
    const logoUrls = buildBrandLogoUrlSet({ logoUrl: "/api/storage/objects/uploads/brand-logo-uuid" });
    const block = {
      type: "zigzag-features",
      props: {
        rows: [
          { headline: "Logo row", imageUrl: "/api/storage/objects/uploads/brand-logo-uuid" },
          { headline: "Photo row", imageUrl: "/objects/dental-feature-1" },
        ],
      },
    };
    const values = collectImageSlots(block as any, logoUrls).map((s) => s.get());
    expect(values).toEqual(["/objects/dental-feature-1"]);
  });
});

describe("Replace-imagery pipeline preserves logos", () => {
  it("the clear loop leaves a logo slot intact while emptying photo slots", () => {
    const logoUrls = buildBrandLogoUrlSet({ logoUrl: "/api/storage/objects/uploads/brand-logo-uuid" });
    const blocks: any[] = [
      { type: "hero", props: { headline: "H", imageUrl: "/objects/denture-hero-1" } },
      { type: "logo-strip", props: { images: [{ src: "/api/storage/objects/uploads/brand-logo-uuid", alt: "logo" }] } },
      { type: "card-grid", props: { cards: [{ title: "C", imageUrl: "/dandy-logo-white.svg" }] } },
    ];
    // Mirror the generator's clear loop (collectImageSlots(block, logoUrls)).
    for (const block of blocks) {
      for (const slot of collectImageSlots(block, logoUrls)) slot.set("");
    }
    expect(blocks[0].props.imageUrl).toBe(""); // photo cleared
    expect(blocks[1].props.images[0].src).toBe("/api/storage/objects/uploads/brand-logo-uuid"); // brand logo kept
    expect(blocks[2].props.cards[0].imageUrl).toBe("/dandy-logo-white.svg"); // bundled mark kept
  });

  it("sanitize never clears a bundled logo even though it is not an allowed storage URL", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/dandy-logo-white.svg" } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    expect(blocks[0].props.imageUrl).toBe("/dandy-logo-white.svg");
  });

  it("validate never clears a brand-logo pick sitting in a hero slot", () => {
    const logoUrls = buildBrandLogoUrlSet({ logoUrl: "/api/storage/objects/uploads/brand-logo-uuid" });
    const blocks: any[] = [
      { type: "hero", props: { headline: "Affordable dentures", imageUrl: "/api/storage/objects/uploads/brand-logo-uuid" } },
    ];
    validateAndDedupeAIImages(blocks, LIB, PAGE_CTX, logoUrls);
    expect(blocks[0].props.imageUrl).toBe("/api/storage/objects/uploads/brand-logo-uuid");
  });

  it("fill never replaces a logo slot with a library image", () => {
    const featLib: MediaImage[] = [
      { url: "/objects/feat-a", title: "A", tags: ["lp-hero", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "hero", props: { headline: "Dentures", imageUrl: "/assets/acme-logo.svg" } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    expect(blocks[0].props.imageUrl).toBe("/assets/acme-logo.svg");
  });
});

describe("buildBlockSelectionDirective — brand-fit selection for every role", () => {
  // A representative advertised-block menu in the same `- "type":` form the real
  // system prompt uses: heroes, proof, stats, PAS/content, CTAs, plus layout
  // primitives that must be ignored.
  const PROMPT = [
    '- "hero": Main hero section.',
    '- "full-bleed-hero": Immersive hero.',
    '- "magazine-hero": Editorial split hero.',
    '- "trust-bar": Numeric proof bar.',
    '- "logo-wall": A wall of customer logos.',
    '- "testimonial": A customer quote.',
    '- "stat-callout": A standout stat.',
    '- "pas-section": Problem-agitate-solve.',
    '- "pas-stat-agitate": PAS backed by a stat.',
    '- "pas-before-after": PAS before/after.',
    '- "how-it-works": Steps.',
    '- "full-bleed-final-cta": Big closing CTA.',
    '- "stat-backed-final-cta": CTA with a stat.',
    '- "section": A generic container.',
    '- "columns": A column layout.',
  ].join("\n\n");

  it("groups every role and instructs deliberate brand/reference matching", () => {
    const out = buildBlockSelectionDirective(PROMPT, new Map());
    expect(out).toContain("BLOCK SELECTION");
    // Steers toward deliberate brand/reference matching, not randomness.
    expect(out).toContain("BRAND CONTEXT");
    expect(out).toContain("reference URL");
    expect(out).toContain("never pick at random");

    const line = (label: string): string =>
      out.split("\n").find((l) => l.startsWith(`- ${label}`)) ?? "";

    // HERO — all three heroes.
    expect(line("HERO")).toContain('"hero"');
    expect(line("HERO")).toContain('"full-bleed-hero"');
    expect(line("HERO")).toContain('"magazine-hero"');

    // SOCIAL PROOF — trust-bar fills this role, alongside logos and quotes.
    expect(line("SOCIAL PROOF")).toContain('"trust-bar"');
    expect(line("SOCIAL PROOF")).toContain('"logo-wall"');
    expect(line("SOCIAL PROOF")).toContain('"testimonial"');
    // Dual-role blocks surface under EVERY role they fill: trust-bar + stat-callout
    // are both stats too, so STATS lists them when it has >1 option.
    expect(line("STATS")).toContain('"trust-bar"');
    expect(line("STATS")).toContain('"stat-callout"');

    // CONTENT — the PAS variants the AI over-defaults on are all offered here.
    expect(line("CONTENT / NARRATIVE")).toContain('"pas-section"');
    expect(line("CONTENT / NARRATIVE")).toContain('"pas-stat-agitate"');
    expect(line("CONTENT / NARRATIVE")).toContain('"pas-before-after"');
    expect(line("CONTENT / NARRATIVE")).toContain('"how-it-works"');

    // CALL TO ACTION — both closing CTAs.
    expect(line("CALL TO ACTION")).toContain('"full-bleed-final-cta"');
    expect(line("CALL TO ACTION")).toContain('"stat-backed-final-cta"');

    // Pure layout primitives are scaffolding and must never be offered.
    expect(out).not.toContain("- LAYOUT");
    expect(out).not.toContain('"columns"');

    // Roles are listed in a natural landing-page flow with HERO first.
    const roleLines = out
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).split(" (")[0]);
    expect(roleLines[0]).toBe("HERO");
    const idx = (label: string) => roleLines.indexOf(label);
    expect(idx("HERO")).toBeLessThan(idx("SOCIAL PROOF"));
    expect(idx("SOCIAL PROOF")).toBeLessThan(idx("CONTENT / NARRATIVE"));
    expect(idx("CONTENT / NARRATIVE")).toBeLessThan(idx("CALL TO ACTION"));
  });

  it("orders roles by the superadmin sort_order, overriding the default flow", () => {
    const roleOrder = (out: string) =>
      out
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .map((l) => l.slice(2).split(" (")[0]);

    // Default (no sort_order) leads with HERO.
    expect(roleOrder(buildBlockSelectionDirective(PROMPT, new Map()))[0]).toBe("HERO");

    // Superadmin pushes every HERO block to the bottom via sort_order; the role
    // follows the lowest sort_order of its blocks, so HERO moves to the end.
    const sort = new Map<string, number>([
      ["hero", 100],
      ["full-bleed-hero", 100],
      ["magazine-hero", 100],
    ]);
    const ordered = roleOrder(buildBlockSelectionDirective(PROMPT, new Map(), sort));
    expect(ordered[0]).not.toBe("HERO");
    expect(ordered[ordered.length - 1]).toBe("HERO");
  });

  it("omits a role's line when only one block of that role is advertised", () => {
    const menu = [
      '- "hero": Main hero.',
      '- "trust-bar": Proof bar.',
      '- "testimonial": A quote.',
    ].join("\n\n");
    const out = buildBlockSelectionDirective(menu, new Map());
    // Social proof has two options → a line; hero has one → no HERO line.
    expect(out).not.toContain("- HERO:");
    expect(out).toContain("- SOCIAL PROOF");
  });

  it("returns empty when no role has more than one option", () => {
    const single = ['- "hero": Main hero.', '- "trust-bar": Proof bar.'].join("\n\n");
    expect(buildBlockSelectionDirective(single, new Map())).toBe("");
  });
});
