import { describe, expect, it } from "vitest";
import {
  validateAndDedupeAIImages,
  fillEmptyImages,
  sanitizeAIImageUrls,
  aiFillEmptyImages,
  buildReferenceFillPool,
  collectImageSlots,
  restoreTemplateImages,
  isLogoImageUrl,
  buildBrandLogoUrlSet,
  buildBlockSelectionDirective,
  isDandyPaletteLiteral,
  deBrandFooterColors,
  applyBrandProductContentImages,
  isExcludedFromGenerationPool,
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

  it("fillEmptyImages never back-fills a case-study-logo-results-row logoUrl (customer logos, not stock photos)", () => {
    // These are customer/company *logo* slots. Auto-filling a library
    // headshot/lifestyle photo drops a tiny mismatched image into the logo box
    // ("tiny images where icons should be"). Empty logoUrl → company-name
    // fallback, mirroring the trust-bar numeric-only exclusion.
    const featLib: MediaImage[] = [
      { url: "/objects/feat-a", title: "A", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "case-study-logo-results-row", props: { results: [
        { company: "Acme Dental", outcome: "2x revenue", logoUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    expect((blocks[0].props.results as Array<{ logoUrl: string }>)[0].logoUrl).toBe("");
  });

  it("aiFillEmptyImages collects no slot for a case-study-logo-results-row logoUrl", async () => {
    const blocks: any[] = [
      { type: "case-study-logo-results-row", props: { results: [
        { company: "Acme Dental", outcome: "2x revenue", logoUrl: "" },
        { company: "Bright Smiles", outcome: "+40% bookings", logoUrl: "" },
      ] } },
    ];
    const brand = { brandName: "Acme", primaryColor: "#000", accentColor: "#111", productLines: [] } as any;
    const out = (await aiFillEmptyImages(blocks, 1, brand, "test brief")) as any[];
    for (const r of out[0].props.results as Array<{ logoUrl: string }>) expect(r.logoUrl).toBe("");
  });

  it("fillEmptyImages never back-fills a case-study-card-grid card imageUrl (customer logos, not stock photos)", () => {
    // Same class as case-study-logo-results-row: each card's imageUrl is a
    // customer/company *logo* slot rendered in a tiny icon / small logo box.
    // Auto-filling a library photo drops a tiny mismatched image into the box
    // ("tiny images where icons should be"). Empty imageUrl → company-name fallback.
    const featLib: MediaImage[] = [
      { url: "/objects/feat-a", title: "A", tags: ["lp-feature", "dentures"] },
    ];
    let blocks: any[] = [
      { type: "case-study-card-grid", props: { cards: [
        { company: "Acme Dental", result: "2x revenue", metricValue: "2x", metricLabel: "growth", imageUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, featLib, PAGE_CTX) as any[];
    expect((blocks[0].props.cards as Array<{ imageUrl: string }>)[0].imageUrl).toBe("");
  });

  it("aiFillEmptyImages collects no slot for a case-study-card-grid card imageUrl", async () => {
    const blocks: any[] = [
      { type: "case-study-card-grid", props: { cards: [
        { company: "Acme Dental", result: "2x revenue", metricValue: "2x", metricLabel: "growth", imageUrl: "" },
        { company: "Bright Smiles", result: "+40% bookings", metricValue: "+40%", metricLabel: "bookings", imageUrl: "" },
      ] } },
    ];
    const brand = { brandName: "Acme", primaryColor: "#000", accentColor: "#111", productLines: [] } as any;
    const out = (await aiFillEmptyImages(blocks, 1, brand, "test brief")) as any[];
    for (const c of out[0].props.cards as Array<{ imageUrl: string }>) expect(c.imageUrl).toBe("");
  });
});

describe("dandy premium blocks — items[]/tabs[] imageUrl wiring", () => {
  it("sanitizeAIImageUrls strips a non-library items[].imageUrl but keeps a library one", () => {
    let blocks: any[] = [
      { type: "dandy-columns-v2", props: { items: [
        { title: "Plan A", imageUrl: "https://images.unsplash.com/photo-123" },
        { title: "Plan B", imageUrl: "/objects/dental-feature-1" },
      ] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    expect(blocks[0].props.items[0].imageUrl).toBe("");
    expect(blocks[0].props.items[1].imageUrl).toBe("/objects/dental-feature-1");
  });

  it("sanitizeAIImageUrls strips a non-library tabs[].imageUrl", () => {
    let blocks: any[] = [
      { type: "dandy-vertical-tabs", props: { tabs: [
        { title: "Scan", imageUrl: "https://evil.example.com/x.png" },
      ] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    expect(blocks[0].props.tabs[0].imageUrl).toBe("");
  });

  it("fillEmptyImages fills dandy-columns-v2 items[].imageUrl whether the key is empty or omitted", () => {
    let blocks: any[] = [
      { type: "dandy-columns-v2", props: { items: [
        { title: "Custom denture fit", description: "fitting", imageUrl: "" },
        { title: "Dental scan", description: "scanner" }, // key omitted
      ] } },
    ];
    blocks = fillEmptyImages(blocks, LIB, PAGE_CTX) as any[];
    const items = blocks[0].props.items as Array<{ imageUrl?: string }>;
    expect(items[0].imageUrl).toBeTruthy();
    expect(items[1].imageUrl).toBeTruthy();
  });

  it("fillEmptyImages fills dandy-vertical-tabs tabs[].imageUrl", () => {
    let blocks: any[] = [
      { type: "dandy-vertical-tabs", props: { tabs: [
        { title: "Denture fitting", description: "fit" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, LIB, PAGE_CTX) as any[];
    expect(blocks[0].props.tabs[0].imageUrl).toBeTruthy();
  });

  it("fillEmptyImages does NOT fill dandy-columns-v3 items[].imageUrl (numbered steps stay text-only)", () => {
    let blocks: any[] = [
      { type: "dandy-columns-v3", props: { showNumbers: true, items: [
        { title: "Step one", description: "do this", imageUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, LIB, PAGE_CTX) as any[];
    expect(blocks[0].props.items[0].imageUrl).toBe("");
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

  it("dso-products-grid products[].imageUrl fill: matches the AI imageKey subject (no imageUrl key emitted)", () => {
    const lib: MediaImage[] = [
      { url: "/objects/aligner-shot", title: "Clear aligner tray", tags: ["product-detail", "aligners"] },
      { url: "/objects/denture-shot", title: "Denture closeup", tags: ["product-detail", "dentures"] },
    ];
    // The AI schema emits products as {name, detail, price, icon, imageKey} —
    // crucially with NO imageUrl key — so the fill must still populate by topic.
    let blocks: any[] = [
      { type: "dso-products-grid", props: { headline: "Our services", products: [
        { name: "Clear Aligners", detail: "Straighten teeth", price: "$$", icon: "sparkles", imageKey: "aligners" },
        { name: "Dentures", detail: "Full + partial", price: "$$", icon: "smile", imageKey: "dentures" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, lib, PAGE_CTX) as any[];
    const products = blocks[0].props.products as Array<{ imageUrl?: string }>;
    expect(products[0].imageUrl).toBe("/objects/aligner-shot");
    expect(products[1].imageUrl).toBe("/objects/denture-shot");
  });

  it("dso-products-grid leaves imageUrl empty when no library image matches (keeps icon fallback)", () => {
    let blocks: any[] = [
      { type: "dso-products-grid", props: { headline: "Our services", products: [
        { name: "Implants", detail: "", price: "$$", icon: "target", imageKey: "implants" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, [], PAGE_CTX) as any[];
    const products = blocks[0].props.products as Array<{ imageUrl?: string }>;
    expect(products[0].imageUrl).toBeFalsy();
  });

  // ── product-detail slots ignore the page-vocabulary bias (Task #469 regression) ──
  // The May-2026 page-bias change appended the page's generic industry words
  // (e.g. "dental dentistry dentist clinic teeth") to EVERY slot's scoring
  // context. For a product card that has a SPECIFIC subject, that let any
  // on-vertical product shot — a crown rich in generic dental tags — outscore
  // the real subject match (a denture) and land in the wrong card. These two
  // images both have the +8 product-detail purpose boost; the crown also matches
  // three page-vocabulary tags (dental/teeth/dentistry) so WITH the page bias it
  // would beat the denture. The fix scores product-detail slots on the subject
  // alone, so the denture must win.
  const subjectVsPageLib: MediaImage[] = [
    { url: "/objects/crown-shot", title: "Zirconia crown", tags: ["product-detail", "crown", "dental", "teeth", "dentistry"] },
    { url: "/objects/denture-shot", title: "Milled denture", tags: ["product-detail", "dentures"] },
  ];
  // Page context carries exactly the generic dental keywords the crown matches.
  const dentalPageCtx = "dental dentistry dentist clinic teeth dentures";

  it("dso-products-grid products[] match the imageKey subject, not the page's generic vocabulary", () => {
    let blocks: any[] = [
      { type: "dso-products-grid", props: { headline: "Our services", products: [
        { name: "Digital Dentures", detail: "Milled precision", price: "$$", icon: "smile", imageKey: "digital-dentures" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, subjectVsPageLib, dentalPageCtx) as any[];
    const products = blocks[0].props.products as Array<{ imageUrl?: string }>;
    expect(products[0].imageUrl).toBe("/objects/denture-shot");
    expect(products[0].imageUrl).not.toBe("/objects/crown-shot");
  });

  it("product-grid item slots match the item subject, not the page's generic vocabulary", () => {
    let blocks: any[] = [
      { type: "product-grid", props: { items: [
        { title: "Digital dentures", description: "Milled precision", image: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, subjectVsPageLib, dentalPageCtx) as any[];
    expect((blocks[0].props.items as Array<{ image: string }>)[0].image).toBe("/objects/denture-shot");
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

  it("a tie between a starter seed and the current reference's scrape resolves to the scrape (relaxed pass)", () => {
    // Starter seeds are purpose-neutral → score 0, same as an off-topic scrape;
    // pool ordering must let the requested site's image win the slot. An
    // off-topic scrape no longer clears the strict content-relevance gate
    // (Task #1287), so this is exercised in the RELAXED last-resort pass where
    // the non-negative floor admits both and ordering (current-ref scrape ahead
    // of starter seeds) decides the winner.
    const starter: MediaImage = { url: "/objects/starter-1", title: "Starter 14142350", tags: ["starter", "generic"] };
    const refUrls = ["https://clay.com/x"];
    const pool = buildReferenceFillPool([starter, freshClay], [freshClay], refUrls);
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow", body: "", imageUrl: "" }] } },
    ];
    const filled = fillEmptyImages(blocks, pool, "saas pipeline", true, undefined) as any[];
    expect(filled[0].props.rows[0].imageUrl).toBe("/objects/clay-fresh");
  });

  // ── Starter seeds are the absolute last resort (image-fill regression) ──────
  // Starters carry no purpose/topical tag → they score 0, identical to an
  // off-topic current-reference scrape. The strict scraped-relevance gate
  // (contentScore > 0) holds the tenant's own scraped images back to the relaxed
  // pass; before the fix a score-0 starter filled the slot first (strict hero
  // branch / relaxed pre-AI pass), so tenants saw "random starter images instead
  // of their own / scraped images". These lock in: starters never fill in the
  // strict pass, never beat a genuine asset, but still fill as a true last resort.
  const starter: MediaImage = { url: "/objects/starter-1", title: "Starter 14142350", tags: ["starter", "generic"] };

  it("STRICT pass: a starter never fills a hero slot; relaxed pass holds the relevance floor (empty beats wrong)", () => {
    const blocks: any[] = [{ type: "hero", props: { headline: "Anything", imageUrl: "" } }];
    // Strict pass (relaxed=false): starter is the only candidate → slot stays empty.
    const strict = fillEmptyImages(structuredClone(blocks), [starter], "saas pipeline", false) as any[];
    expect(strict[0].props.imageUrl).toBe("");
    // Relaxed last-resort pass: a HERO slot now demands a purpose match or
    // equivalent topical signal (score >= PURPOSE_MATCH_BOOST). A score-0
    // generic starter no longer fills it — the hero stays empty for its
    // fallback state instead of shipping a wrong image.
    const relaxed = fillEmptyImages(structuredClone(blocks), [starter], "saas pipeline", true) as any[];
    expect(relaxed[0].props.imageUrl).toBe("");
    // Minor (lp-feature) slots keep the old last-resort behavior: the starter
    // still fills there.
    const featureBlocks: any[] = [{ type: "feature", props: { headline: "Anything", imageUrl: "" } }];
    const relaxedFeature = fillEmptyImages(featureBlocks, [starter], "saas pipeline", true) as any[];
    expect(relaxedFeature[0].props.imageUrl).toBe("/objects/starter-1");
  });

  it("RELAXED pass: a score-0 scraped reference image beats a score-0 starter regardless of pool order", () => {
    // Put the starter FIRST in the pool to prove the win isn't just ordering: the
    // two-tier selection prefers any non-starter (the tenant's scrape) over a starter.
    // Uses a non-hero (lp-feature) slot: a purposeless scrape can fill a feature
    // slot but is barred from a hero slot by the source-page hero rule (below).
    const pool = [starter, freshClay];
    const blocks: any[] = [{ type: "feature", props: { headline: "Workflow", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, pool, "saas pipeline", true) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/clay-fresh");
  });

  it("HERO slot: a scraped image may fill it ONLY if it was the source-page hero (lp-hero)", () => {
    // The user's rule: a scraped image can be a hero image only if it WAS the hero
    // on the scraped page (mirror tags only that one image "lp-hero"; every other
    // scrape is downgraded to lp-feature). A non-lp-hero scrape must never win a
    // hero slot — even with a strong topical score / as the sole candidate — so a
    // mid-page team headshot can no longer surface as a microsite hero.
    const scrapedNonHero: MediaImage = { url: "/objects/headshot", title: "saas pipeline team", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:hh", "lp-feature"] };
    const scrapedHero: MediaImage = { url: "/objects/page-hero", title: "saas pipeline", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:ph", "lp-hero"] };

    // Non-hero scrape only → hero slot stays empty in BOTH passes (no soft win).
    const strict = fillEmptyImages([{ type: "hero", props: { headline: "x", imageUrl: "" } }], [scrapedNonHero], "saas pipeline", false) as any[];
    expect(strict[0].props.imageUrl).toBe("");
    const relaxed = fillEmptyImages([{ type: "hero", props: { headline: "x", imageUrl: "" } }], [scrapedNonHero], "saas pipeline", true) as any[];
    expect(relaxed[0].props.imageUrl).toBe("");

    // The source-page hero (lp-hero) is allowed to fill the hero slot (shown in
    // the relaxed pass; the strict pass additionally requires a currentReference
    // flag, an unrelated gate covered elsewhere).
    const allowed = fillEmptyImages([{ type: "hero", props: { headline: "x", imageUrl: "" } }], [scrapedHero], "saas pipeline", true) as any[];
    expect(allowed[0].props.imageUrl).toBe("/objects/page-hero");
  });

  it("VALIDATION path: clears an AI-assigned non-hero scrape from a hero slot, keeps a source-page hero scrape", () => {
    // The same source-page hero rule must hold when the MODEL (not the fill pass)
    // assigns the image: validateAndDedupeAIImages re-scores model picks, and a
    // topically-strong non-hero scrape would otherwise survive the soft CLEAR_GAP
    // check. A non-lp-hero scrape in a hero slot must be cleared unconditionally;
    // a source-page hero (lp-hero) scrape must be kept.
    const scrapedNonHero: MediaImage = { url: "/objects/headshot", title: "saas pipeline team", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:hh", "lp-feature"] };
    const scrapedHero: MediaImage = { url: "/objects/page-hero", title: "saas pipeline", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:ph", "lp-hero"] };

    const blocksA: any[] = [{ type: "hero", props: { headline: "x", imageUrl: "/objects/headshot" } }];
    const cleared = validateAndDedupeAIImages(blocksA, [scrapedNonHero], "saas pipeline") as any[];
    expect(cleared[0].props.imageUrl).toBe("");

    const blocksB: any[] = [{ type: "hero", props: { headline: "x", imageUrl: "/objects/page-hero" } }];
    const kept = validateAndDedupeAIImages(blocksB, [scrapedHero], "saas pipeline") as any[];
    expect(kept[0].props.imageUrl).toBe("/objects/page-hero");
  });

  it("RELAXED pass: a curated brand asset beats a starter even when the starter sorts first", () => {
    // A feature slot (hero/product-detail relaxed fills now require a purpose
    // match — covered by the relevance-floor suite below); the tier ordering
    // (curated > starter) is what this case locks in.
    const pool = [starter, curated];
    const blocks: any[] = [{ type: "feature", props: { headline: "Workflow", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, pool, "saas pipeline", true) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/brand-photo");
  });
});

// ── "Empty beats wrong" relevance floor (relaxed last-resort pass) ──────────
// HERO and PRODUCT-DETAIL slots are the page's most prominent / most
// subject-specific imagery. In the RELAXED pass they must not be filled by a
// candidate scoring below PURPOSE_MATCH_BOOST (8): the candidate must match
// the slot purpose outright, or carry equivalent topical content-tag signal.
// No candidate clears the floor → the slot stays EMPTY (blocks have fallback
// states that read better than a wrong photo). lp-feature and other minor
// slots keep the prior relaxed behavior (non-negative floor).
describe("fillEmptyImages — relaxed-pass relevance floor (hero / product-detail)", () => {
  // Zero-score candidates: no purpose tag, no topical overlap with the context.
  const zeroScoreCurated: MediaImage = { url: "/objects/lobby", title: "office lobby", tags: [] };
  const zeroScoreStarter: MediaImage = { url: "/objects/starter-9", title: "Starter 9981", tags: ["starter", "generic"] };
  // Purpose-matched candidates: the purpose boost alone (8) clears the floor.
  const heroPurpose: MediaImage = { url: "/objects/hero-purpose", title: "abstract banner", tags: ["lp-hero"] };
  const detailPurpose: MediaImage = { url: "/objects/detail-purpose", title: "abstract closeup", tags: ["product-detail"] };
  // Unclassified but topically STRONG (content-tag signal >= 8): two tags that
  // appear verbatim in the context plus their word-level matches.
  const topicallyStrong: MediaImage = { url: "/objects/topical", title: "dentures photo", tags: ["dentures", "dental clinic"] };

  it("(a) hero slot + only zero-score candidates → stays EMPTY in the relaxed pass", () => {
    const blocks: any[] = [{ type: "hero", props: { headline: "Anything", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, [zeroScoreCurated, zeroScoreStarter], "saas pipeline", true) as any[];
    expect(filled[0].props.imageUrl).toBe("");
  });

  it("(b) hero slot + a purpose-matched candidate → fills in the relaxed pass", () => {
    const blocks: any[] = [{ type: "hero", props: { headline: "Anything", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, [zeroScoreCurated, heroPurpose], "saas pipeline", true) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/hero-purpose");
  });

  it("(b2) hero slot + an unclassified candidate with EQUIVALENT topical signal → fills", () => {
    const blocks: any[] = [{ type: "hero", props: { headline: "Affordable dentures", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, [topicallyStrong], "affordable dentures dental clinic", true) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/topical");
  });

  it("(a2) product-detail slot + only zero-score candidates → stays EMPTY in the relaxed pass", () => {
    const blocks: any[] = [
      { type: "dso-products-grid", props: { products: [{ name: "Crowns", detail: "", imageKey: "posterior-crowns" }] } },
    ];
    const filled = fillEmptyImages(blocks, [zeroScoreCurated, zeroScoreStarter], "dental clinic", true) as any[];
    expect(filled[0].props.products[0].imageUrl ?? "").toBe("");
  });

  it("(b3) product-detail slot + a product-detail-purpose candidate → fills in the relaxed pass", () => {
    const blocks: any[] = [
      { type: "dso-products-grid", props: { products: [{ name: "Crowns", detail: "", imageKey: "posterior-crowns" }] } },
    ];
    const filled = fillEmptyImages(blocks, [zeroScoreCurated, detailPurpose], "dental clinic", true) as any[];
    expect(filled[0].props.products[0].imageUrl).toBe("/objects/detail-purpose");
  });

  it("(c) feature slot + a zero-score candidate → still fills in the relaxed pass (unchanged minor-slot behavior)", () => {
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow", body: "", imageUrl: "" }] } },
    ];
    const filled = fillEmptyImages(blocks, [zeroScoreCurated], "saas pipeline", true) as any[];
    expect(filled[0].props.rows[0].imageUrl).toBe("/objects/lobby");
  });

  it("(d) logo-URL protections survive the floor: a brand-logo hero slot is never cleared, swapped, or counted as used", () => {
    // The brand mark occupies the hero imageUrl. With logoUrls threaded, the
    // slot is excluded from used-URL tracking and the fill pass never touches
    // a non-empty slot — the logo survives the relaxed pass verbatim. (Logo
    // CANDIDATES never reach the scorer at all: "logo"-tagged rows are
    // excluded upstream via EXCLUDE_TAGS in fetchMediaCatalog, and the
    // brand-import DOM harvest drops logo/chrome assets before mirroring.)
    const logoUrl = "/api/storage/objects/uploads/acme-logo.svg";
    const blocks: any[] = [
      { type: "hero", props: { headline: "Anything", imageUrl: logoUrl } },
      { type: "feature", props: { headline: "Workflow", imageUrl: "" } },
    ];
    const filled = fillEmptyImages(blocks, [zeroScoreCurated], "saas pipeline", true, new Set([logoUrl])) as any[];
    expect(filled[0].props.imageUrl).toBe(logoUrl);
    // The logo was not tracked as a "used" library image, and the empty
    // feature (minor) slot still fills normally in the relaxed pass.
    expect(filled[1].props.imageUrl).toBe("/objects/lobby");
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

describe("findBestImage — only current-reference scrapes compete in the strict pass", () => {
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

  it("places a CURRENT-REFERENCE scrape in the strict pass (the user pointed us at that URL)", () => {
    // A scrape harvested from a reference URL in THIS prompt is flagged
    // `currentReference` by buildReferenceFillPool, so it competes in the strict
    // pass alongside curated assets and may win a content slot.
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dental implants", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [{ ...onTopicScrape, currentReference: true }], "dental implants clinic") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/scrape-dent");
  });

  it("defers an UNFLAGGED (stale) scrape in the strict pass even when it is on-topic", () => {
    // Without the currentReference flag a scrape is treated as a stale harvest from
    // an unrelated prior generation → last-resort pass only, so the tenant's own
    // library + the current prompt's reference are always tried first.
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Dental implants", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [onTopicScrape], "dental implants clinic") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("");
  });

  it("still places an untagged CURATED image in the strict pass (scoping is scraped-only)", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Anything", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [untaggedCurated], "totally unrelated context") as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/drawer-x");
  });
});

// ── current-reference scrapes are eligible in the strict pass ────────────────
// A scrape is auto-tagged for PURPOSE (lp-hero / lp-feature). Whether it competes
// in the strict pass is gated on the `currentReference` flag (set by
// buildReferenceFillPool for scrapes harvested from a reference URL in THIS
// prompt), NOT on topical overlap: when the user points us at a URL — or a new
// tenant whose only library IS their own website — we use that site's imagery
// even if it is topically generic. Stale scrapes from unrelated prior runs stay
// last-resort.
describe("current-reference scrape eligibility (strict pass)", () => {
  const freshClay: MediaImage = { url: "/objects/clay-fresh", title: "abstract gradient", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:ccc", "lp-feature"] };

  it("holds back an UNFLAGGED (stale) scrape in the strict pass", () => {
    // freshClay carries no currentReference flag → treated as a stale harvest from
    // an unrelated prior generation → deferred to the relaxed last-resort pass even
    // though its purpose boost makes its total score positive.
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [freshClay], "saas pipeline", false) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("");
  });

  it("places an ON-TOPIC current-reference scrape in the strict pass", () => {
    const onTopic: MediaImage = { url: "/objects/clay-topic", title: "workflow automation pipeline", tags: ["page-reference", "scraped", "refhost:clay.com", "refsrc:ddd", "lp-feature", "workflow"], currentReference: true };
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [onTopic], "saas pipeline workflow", false) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/clay-topic");
  });

  it("places an OFF-TOPIC current-reference scrape in the strict pass ('make my page look like this URL')", () => {
    // freshClay is topically generic for "saas pipeline", but the user pointed us
    // at its source URL this run → flagged currentReference → eligible in strict.
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [{ ...freshClay, currentReference: true }], "saas pipeline", false) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/clay-fresh");
  });

  it("places that same off-topic scrape in the relaxed last-resort pass", () => {
    let blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "Workflow automation", imageUrl: "" }] } },
    ];
    blocks = fillEmptyImages(blocks, [freshClay], "saas pipeline", true) as any[];
    expect(blocks[0].props.rows[0].imageUrl).toBe("/objects/clay-fresh");
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

describe("collectImageSlots — framework-block image slots", () => {
  it("collects challenger-insight reframeImageUrl as a feature slot", () => {
    const block = {
      type: "challenger-insight",
      props: { heroImageUrl: "/objects/ch-hero", reframeImageUrl: "/objects/ch-reframe", betterWayImageUrl: "/objects/ch-better" },
    };
    const slots = collectImageSlots(block as any);
    const byField = Object.fromEntries(slots.map((s) => [s.field, s.purpose]));
    expect(byField.heroImageUrl).toBe("lp-hero");
    expect(byField.reframeImageUrl).toBe("lp-feature");
    expect(byField.betterWayImageUrl).toBe("lp-feature");
  });

  it("collects exec-decision-brief masthead + process image slots as feature slots", () => {
    const block = {
      type: "exec-decision-brief",
      props: { mastheadImageUrl: "/objects/edb-masthead", processImageUrl: "/objects/edb-process" },
    };
    const byField = Object.fromEntries(collectImageSlots(block as any).map((s) => [s.field, s.purpose]));
    expect(byField.mastheadImageUrl).toBe("lp-feature");
    expect(byField.processImageUrl).toBe("lp-feature");
  });

  it("collects storybrand-journey problem/guide/success as feature slots, hero as hero", () => {
    const block = {
      type: "storybrand-journey",
      props: {
        heroImageUrl: "/objects/sb-hero",
        problemImageUrl: "/objects/sb-problem",
        guideImageUrl: "/objects/sb-guide",
        successImageUrl: "/objects/sb-success",
      },
    };
    const byField = Object.fromEntries(collectImageSlots(block as any).map((s) => [s.field, s.purpose]));
    expect(byField.heroImageUrl).toBe("lp-hero");
    expect(byField.problemImageUrl).toBe("lp-feature");
    expect(byField.guideImageUrl).toBe("lp-feature");
    expect(byField.successImageUrl).toBe("lp-feature");
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

  it("dso-insights-dashboard `dashboardImage` is a restore-only slot (excluded from fill/dedupe, enumerated only with includeEmpty)", () => {
    const block = {
      type: "dso-insights-dashboard",
      props: { headline: "Insights", dashboardImage: "/objects/author-dashboard" },
    };
    // Fill/dedupe/replace callsites (includeEmpty=false) must NEVER see it, so the
    // image pipeline can't drop an icon / off-subject photo into the dashboard.
    const fillSlots = collectImageSlots(block as any).map((s) => s.get());
    expect(fillSlots).not.toContain("/objects/author-dashboard");
    // The template-restore path (includeEmpty=true) MUST enumerate it so a
    // template author's deliberately-set dashboard image survives generation.
    const restoreSlots = collectImageSlots(block as any, undefined, true).map((s) => s.get());
    expect(restoreSlots).toContain("/objects/author-dashboard");
  });

  it("restoreTemplateImages preserves a template author's dashboardImage when the model blanks it (replaceImagery=false)", () => {
    const origBlock = {
      type: "dso-insights-dashboard",
      props: { headline: "Insights", dashboardImage: "/objects/author-dashboard" },
    };
    // The model is prompted to leave dashboardImage blank on regeneration.
    const mergedBlock = {
      type: "dso-insights-dashboard",
      props: { headline: "Insights", dashboardImage: "" },
    };
    const applied = restoreTemplateImages(origBlock as any, mergedBlock as any);
    expect(applied).toBe(true);
    expect(mergedBlock.props.dashboardImage).toBe("/objects/author-dashboard");
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

// The AI is handed real IMAGE LIBRARY URLs (rule 10b) and tends to copy them
// into per-item `image` fields of icon-only blocks (benefits-grid / features),
// even though the prompt says those cards are icon-only by default. The renderer
// turns ANY truthy item.image into a tiny photo card and demotes the lucide icon
// to a small badge — i.e. "the icons are tiny random images". sanitizeAIImageUrls
// must strip those AI-supplied photos unless the block opted into useItemPhotos.
describe("icon-only item photos (benefits-grid / features)", () => {
  it("strips AI-supplied per-item photos from a benefits-grid when useItemPhotos is not set", () => {
    const blocks = [
      {
        type: "benefits-grid",
        props: {
          headline: "Why choose us",
          items: [
            { icon: "Shield", title: "Secure", description: "x", image: "/objects/dental-feature-1" },
            { icon: "Zap", title: "Fast", description: "y", image: "/objects/dental-feature-2" },
            { icon: "Star", title: "Loved", description: "z", image: "/objects/denture-hero-1" },
          ],
        },
      },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    for (const item of (out[0].props as any).items) {
      expect(item.image).toBe("");
      expect(typeof item.icon).toBe("string");
    }
  });

  it("strips per-item photos when useItemPhotos is explicitly false", () => {
    const blocks = [
      {
        type: "features",
        props: {
          useItemPhotos: false,
          items: [{ icon: "Zap", title: "A", description: "d", image: "/objects/dental-feature-1" }],
        },
      },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).items[0].image).toBe("");
  });

  it("KEEPS valid per-item photos when the block opted in via useItemPhotos: true", () => {
    const blocks = [
      {
        type: "benefits-grid",
        props: {
          useItemPhotos: true,
          items: [
            { icon: "Shield", title: "Secure", description: "x", image: "/objects/dental-feature-1" },
            { icon: "Zap", title: "Fast", description: "y", image: "/objects/dental-feature-2" },
          ],
        },
      },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).items[0].image).toBe("/objects/dental-feature-1");
    expect((out[0].props as any).items[1].image).toBe("/objects/dental-feature-2");
  });

  it("still clears hallucinated per-item photos when useItemPhotos: true", () => {
    const blocks = [
      {
        type: "benefits-grid",
        props: {
          useItemPhotos: true,
          items: [{ icon: "Zap", title: "A", description: "d", image: "https://image-library.com/fake.jpg" }],
        },
      },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).items[0].image).toBe("");
  });

  it("blanks a URL-valued benefits-grid item icon (renders Lucide, not a tiny img)", () => {
    const blocks = [
      {
        type: "benefits-grid",
        props: {
          items: [
            { icon: "/objects/dental-feature-1", title: "A", description: "d" },
            { icon: "Shield", title: "B", description: "d" },
          ],
        },
      },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    const items = (out[0].props as any).items;
    expect(items[0].icon).toBe("");
    expect(items[1].icon).toBe("Shield");
  });

  it("blanks URL-valued icons across non-(benefits/features) icon blocks", () => {
    const blocks = [
      { type: "dso-partnership-perks", props: { perks: [{ icon: "https://x.com/objects/y.png", title: "P" }] } },
      { type: "how-it-works-alternating", props: { steps: [{ icon: "/api/storage/objects/z", title: "S" }] } },
      { type: "dso-promises", props: { promises: [{ icon: "data:image/png;base64,AAA", title: "Q" }] } },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).perks[0].icon).toBe("");
    expect((out[1].props as any).steps[0].icon).toBe("");
    expect((out[2].props as any).promises[0].icon).toBe("");
  });

  it("blanks URL-valued non-literal icon keys (spotlightIcon, iconName)", () => {
    const blocks = [
      { type: "features-spotlight-cards", props: { spotlightIcon: "/objects/spot.png", features: [{ icon: "https://x.com/objects/f.png", title: "F" }] } },
      { type: "dso-case-flow", props: { stages: [{ iconName: "data:image/svg+xml,AAA", label: "S" }] } },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).spotlightIcon).toBe("");
    expect((out[0].props as any).features[0].icon).toBe("");
    expect((out[1].props as any).stages[0].iconName).toBe("");
  });

  it("preserves Lucide/curated values on non-literal icon keys", () => {
    const blocks = [
      { type: "features-spotlight-cards", props: { spotlightIcon: "Layers" } },
      { type: "dso-case-flow", props: { stages: [{ iconName: "alert-triangle", label: "S" }] } },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).spotlightIcon).toBe("Layers");
    expect((out[1].props as any).stages[0].iconName).toBe("alert-triangle");
  });

  it("preserves curated icon keys and Lucide names (only URLs are stripped)", () => {
    const blocks = [
      { type: "dso-problem", props: { panels: [{ icon: "alert-triangle", title: "T" }] } },
      { type: "benefits-grid", props: { items: [{ icon: "Zap", title: "Z", description: "d" }] } },
      { type: "storefront", props: { valueProps: [{ icon: "leaf", title: "L" }] } },
    ];
    const out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    expect((out[0].props as any).panels[0].icon).toBe("alert-triangle");
    expect((out[1].props as any).items[0].icon).toBe("Zap");
    expect((out[2].props as any).valueProps[0].icon).toBe("leaf");
  });

  it("does not fill icon-only benefits-grid items downstream (full pipeline)", () => {
    const blocks = [
      {
        type: "benefits-grid",
        props: {
          headline: "Capabilities",
          items: [
            { icon: "Shield", title: "Secure", description: "x", image: "/objects/dental-feature-1" },
            { icon: "Zap", title: "Fast", description: "y", image: "" },
          ],
        },
      },
    ];
    let out = sanitizeAIImageUrls(blocks, LIB) as typeof blocks;
    out = validateAndDedupeAIImages(out, LIB, PAGE_CTX) as typeof blocks;
    out = fillEmptyImages(out, LIB, PAGE_CTX) as typeof blocks;
    for (const item of (out[0].props as any).items) {
      expect(item.image).toBe("");
    }
  });
});

describe("curated purpose-matched images fill content/strip slots", () => {
  // Restored (pre-late-May) behavior: a tenant's OWN curated library image that
  // is purpose-classified for feature slots fills the slot even when its content
  // tags don't textually overlap the page context. The user prefers their own
  // product/feature photos in the grid/strip over an empty slot or a generic
  // fill. (e.g. a feature-tagged product shot on a dentures page.)
  const SCANNER_ONLY: MediaImage[] = [
    { url: "/objects/scanner-device", title: "Intraoral scanner hardware", tags: ["lp-feature", "scanner", "device"] },
  ];
  const ON_TOPIC_FEATURE: MediaImage[] = [
    { url: "/objects/denture-strip-1", title: "Denture smile", tags: ["lp-feature", "dentures", "smile"] },
  ];

  const stripBlock = () => [
    {
      type: "photo-strip",
      props: {
        headline: "Real stories from real practices",
        images: [{ alt: "", src: "" }, { alt: "", src: "" }],
      },
    },
  ];

  it("strict pass fills a photo-strip slot with the tenant's own purpose-matched curated image", () => {
    const blocks = fillEmptyImages(stripBlock(), SCANNER_ONLY, PAGE_CTX, false) as any[];
    expect(blocks[0].props.images[0].src).toBe("/objects/scanner-device");
  });

  it("relaxed (last-resort) pass also fills the strip from the curated library", () => {
    const blocks = fillEmptyImages(stripBlock(), SCANNER_ONLY, PAGE_CTX, true) as any[];
    expect(blocks[0].props.images[0].src).toBe("/objects/scanner-device");
  });

  it("strict pass DOES fill a photo-strip slot with an on-topic curated image", () => {
    const blocks = fillEmptyImages(stripBlock(), ON_TOPIC_FEATURE, PAGE_CTX, false) as any[];
    expect(blocks[0].props.images[0].src).toBe("/objects/denture-strip-1");
  });

  it("ACCEPTED RESIDUAL: an UNTAGGED off-topic curated upload still fills in the strict pass (preserves the deliberate tenant-asset preference)", () => {
    // The fix only holds back curated images the auto-tagger DESCRIBED (a
    // topical tag present). An untagged upload has no subject signal, so we keep
    // the prior "prefer the tenant's own assets" decision and let it fill. If a
    // future report involves genuinely untagged off-topic assets, this is the
    // line that would need to change (and it's covered, not accidental).
    const untaggedOffTopic: MediaImage[] = [
      { url: "/objects/raw-upload", title: "office lobby", tags: [] },
    ];
    const blocks = fillEmptyImages(stripBlock(), untaggedOffTopic, PAGE_CTX, false) as any[];
    expect(blocks[0].props.images[0].src).toBe("/objects/raw-upload");
  });

  it("does NOT tighten hero slots: a purpose-matched curated hero still fills even without topical overlap", () => {
    // Guard against over-reach — hero/product-detail keep the tenant-asset
    // preference. A generic brand hero (lp-hero, no dentures keyword) must still
    // fill a hero slot in the strict pass.
    const heroLib: MediaImage[] = [
      { url: "/objects/brand-hero", title: "Bright modern office", tags: ["lp-hero", "office"] },
    ];
    const blocks = fillEmptyImages(
      [{ type: "hero", props: { headline: "Affordable dentures", imageUrl: "" } }],
      heroLib,
      PAGE_CTX,
      false,
    ) as any[];
    expect(blocks[0].props.imageUrl).toBe("/objects/brand-hero");
  });
});

describe("video thumbnails / videos are never auto-added or swapped", () => {
  // A video block's posterUrl (thumbnail) and videoUrl are author-controlled.
  // The image pipeline must leave them exactly as authored — most importantly
  // when a page is created from a template — so a library headshot is never
  // substituted as a video still.

  it("fillEmptyImages does NOT fill an empty posterUrl on media video blocks", () => {
    let blocks: any[] = [
      { type: "media-feature-reel", props: { heading: "Demo", videoUrl: "", posterUrl: "" } },
      { type: "media-looping-showcase", props: { heading: "Brand film", videoUrl: "", posterUrl: "" } },
      { type: "media-video-split", props: { heading: "Walkthrough", videoUrl: "", posterUrl: "" } },
    ];
    blocks = fillEmptyImages(blocks, LIB, PAGE_CTX) as any[];
    expect(blocks[0].props.posterUrl).toBe("");
    expect(blocks[1].props.posterUrl).toBe("");
    expect(blocks[2].props.posterUrl).toBe("");
  });

  it("fillEmptyImages does NOT fill empty per-card posterUrl in media-thumbnail-grid", () => {
    let blocks: any[] = [
      { type: "media-thumbnail-grid", props: { heading: "Library", videos: [
        { id: "a", title: "Intro", videoUrl: "", posterUrl: "" },
        { id: "b", title: "Setup", videoUrl: "", posterUrl: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, LIB, PAGE_CTX) as any[];
    const vids = blocks[0].props.videos as Array<{ posterUrl: string; videoUrl: string }>;
    expect(vids.every(v => v.posterUrl === "")).toBe(true);
    expect(vids.every(v => v.videoUrl === "")).toBe(true);
  });

  it("sanitizeAIImageUrls preserves an authored poster verbatim (even a non-library URL)", () => {
    // A template's poster may be an external/non-library URL; it must survive
    // the sanitize pass untouched rather than being cleared for a refill.
    const externalPoster = "https://cdn.example.com/template-video-poster.jpg";
    let blocks: any[] = [
      { type: "media-feature-reel", props: { heading: "Demo", videoUrl: "https://cdn.example.com/clip.mp4", posterUrl: externalPoster } },
      { type: "media-thumbnail-grid", props: { videos: [
        { id: "a", title: "Intro", videoUrl: "https://cdn.example.com/intro.mp4", posterUrl: externalPoster },
      ] } },
    ];
    blocks = sanitizeAIImageUrls(blocks, LIB) as any[];
    expect(blocks[0].props.posterUrl).toBe(externalPoster);
    expect(blocks[0].props.videoUrl).toBe("https://cdn.example.com/clip.mp4");
    expect(blocks[1].props.videos[0].posterUrl).toBe(externalPoster);
  });

  it("collectImageSlots does NOT expose posterUrl as a fillable/dedupe image slot", () => {
    const block = { type: "media-thumbnail-grid", props: {
      heading: "Library",
      posterUrl: "/objects/denture-hero-1",
      videos: [{ id: "a", title: "Intro", videoUrl: "", posterUrl: "/objects/denture-hero-1" }],
    } };
    const slots = collectImageSlots(block as any, undefined, true);
    const values = (slots as any[]).map(s => s.get());
    expect(values).not.toContain("/objects/denture-hero-1");
  });
});

describe("deBrandFooterColors (Dandy palette leak guard)", () => {
  it("detects Dandy forest/lime literals regardless of case or whitespace", () => {
    expect(isDandyPaletteLiteral("#003A30")).toBe(true);
    expect(isDandyPaletteLiteral("#003a30")).toBe(true);
    expect(isDandyPaletteLiteral("  #C7E738 ")).toBe(true);
    expect(isDandyPaletteLiteral("#0f172a")).toBe(false);
    expect(isDandyPaletteLiteral("")).toBe(false);
    expect(isDandyPaletteLiteral(undefined)).toBe(false);
  });

  it("strips a leaked Dandy green/lime from a footer so it falls back to the brand var", () => {
    const footer = { type: "footer", props: { backgroundColor: "#003A30", accentColor: "#C7E738", copyrightText: "© 2026" } };
    deBrandFooterColors(footer as any);
    expect(footer.props.backgroundColor).toBe("");
    expect(footer.props.accentColor).toBe("");
    expect(footer.props.copyrightText).toBe("© 2026");
  });

  it("keeps a non-Dandy footer's own brand colors untouched", () => {
    const footer = { type: "footer", props: { backgroundColor: "#1d4ed8", accentColor: "#f59e0b" } };
    deBrandFooterColors(footer as any);
    expect(footer.props.backgroundColor).toBe("#1d4ed8");
    expect(footer.props.accentColor).toBe("#f59e0b");
  });

  it("is a no-op for non-footer blocks even if they carry a Dandy literal", () => {
    const hero = { type: "hero", props: { backgroundColor: "#003A30" } };
    deBrandFooterColors(hero as any);
    expect(hero.props.backgroundColor).toBe("#003A30");
  });
});

describe("applyBrandProductContentImages — brand content-image placement", () => {
  const CROWN = {
    name: "Posterior Crown & Bridge",
    images: ["/objects/crown-1", "/objects/crown-2", "/objects/crown-3"],
  };

  it("fills array-item photo slots (switchback items[].imageUrl) about the product, rotating images", () => {
    // Copy says only "Crowns", never the full clinical name — loose match must
    // still resolve it to "Posterior Crown & Bridge".
    const block = {
      type: "dandy-switchback",
      props: {
        headline: "Durable Crowns",
        items: [
          { title: "Strength", imageUrl: "/objects/random-a" },
          { title: "Precise fit", imageUrl: "/objects/random-b" },
        ],
      },
    };
    applyBrandProductContentImages([block as any], [CROWN]);
    expect(block.props.items[0].imageUrl).toBe("/objects/crown-1");
    expect(block.props.items[1].imageUrl).toBe("/objects/crown-2");
  });

  it("rotates across multiple matched sections via a per-product cursor", () => {
    const a = { type: "dandy-switchback", props: { headline: "Crown craftsmanship", imageUrl: "/objects/x" } };
    const b = { type: "dandy-switchback", props: { headline: "Crown durability", imageUrl: "/objects/y" } };
    applyBrandProductContentImages([a as any, b as any], [CROWN]);
    expect(a.props.imageUrl).toBe("/objects/crown-1");
    expect(b.props.imageUrl).toBe("/objects/crown-2");
  });

  it("never touches product-grid / product-showcase / dandy-product-hero (card & hero images are owned by their own passes)", () => {
    const grid = { type: "product-grid", props: { headline: "Our crowns", items: [{ title: "Crown", image: "/objects/card-1" }] } };
    const showcase = { type: "product-showcase", props: { headline: "Crown lineup", cards: [{ name: "Crown", image: "/objects/card-2" }] } };
    const phero = { type: "dandy-product-hero", props: { headline: "Posterior Crown & Bridge", imageUrl: "/objects/hero-1" } };
    applyBrandProductContentImages([grid as any, showcase as any, phero as any], [CROWN]);
    expect(grid.props.items[0].image).toBe("/objects/card-1");
    expect(showcase.props.cards[0].image).toBe("/objects/card-2");
    expect(phero.props.imageUrl).toBe("/objects/hero-1");
  });

  it("never touches hero-tagged blocks (the page hero is owned by the hero pass)", () => {
    const hero = { type: "hero", props: { headline: "Crowns that last", imageUrl: "/objects/page-hero" } };
    applyBrandProductContentImages([hero as any], [CROWN]);
    expect(hero.props.imageUrl).toBe("/objects/page-hero");
  });

  it("leaves blocks that don't name the product untouched", () => {
    const block = { type: "dandy-switchback", props: { headline: "About our team", imageUrl: "/objects/team" } };
    applyBrandProductContentImages([block as any], [CROWN]);
    expect(block.props.imageUrl).toBe("/objects/team");
  });

  it("does NOT fire on a passing product mention in sub-copy (only the heading decides)", () => {
    // A how-it-works section whose HEADLINE is about the workflow, with the
    // product named only in a step subheadline. The product override must stay
    // out so the tag scorer can place a section-relevant photo (a "Scan" step
    // gets a scanner, not the crown mentioned elsewhere).
    const block = {
      type: "dandy-switchback",
      props: {
        headline: "Your workflow, enhanced",
        subheadline: "Get a crown ready in 5 days",
        items: [{ title: "Scan", imageUrl: "/objects/scanner" }],
      },
    };
    applyBrandProductContentImages([block as any], [CROWN]);
    expect(block.props.items[0].imageUrl).toBe("/objects/scanner");
  });

  it("does not fill empty slots (only swaps already-populated images)", () => {
    const block = { type: "dandy-switchback", props: { headline: "Crown quality", items: [{ title: "Fit", imageUrl: "" }] } };
    applyBrandProductContentImages([block as any], [CROWN]);
    expect(block.props.items[0].imageUrl).toBe("");
  });

  it("picks the most specifically-named product when several lines share a token", () => {
    const ANTERIOR = { name: "Anterior Crown", images: ["/objects/ant-1"] };
    const a = { type: "dandy-switchback", props: { headline: "Posterior Crown & Bridge strength", imageUrl: "/objects/x" } };
    const b = { type: "dandy-switchback", props: { headline: "Anterior Crown esthetics", imageUrl: "/objects/y" } };
    applyBrandProductContentImages([a as any, b as any], [CROWN, ANTERIOR]);
    expect(a.props.imageUrl).toBe("/objects/crown-1"); // 3 matched tokens beats 1
    expect(b.props.imageUrl).toBe("/objects/ant-1"); // 2 matched tokens beats 1
  });

  it("excludes logo slots when a logo URL set is supplied", () => {
    const block = { type: "dandy-switchback", props: { headline: "Crown showcase", items: [{ title: "Logo", imageUrl: "/objects/brand-logo" }, { title: "Photo", imageUrl: "/objects/photo" }] } };
    applyBrandProductContentImages([block as any], [CROWN], new Set(["/objects/brand-logo"]));
    expect(block.props.items[0].imageUrl).toBe("/objects/brand-logo");
    expect(block.props.items[1].imageUrl).toBe("/objects/crown-1");
  });
});

// ── og/promo exclusion policy (Old Navy fix) ────────────────────────────────
// The blanket og-image exclusion used to hide a tenant's ENTIRE imported
// library when the vision classifier og-tagged their text-bearing homepage
// banners. Policy now: hard role reservations (logo/favicon/team-photo/
// homepage-screenshot) always exclude; promo/og tags exclude ONLY true social
// cards — the tenant's own brand-imported content imagery and imagery from a
// host referenced in THIS prompt keep competing.
describe("isExcludedFromGenerationPool — smart og/promo exclusion", () => {
  const brandPromoTall: MediaImage = {
    url: "/objects/on-banner-1",
    title: "Summer sale banner",
    tags: ["og-image", "brand-import", "old-navy", "summer", "fashion"],
    width: 1600,
    height: 2000,
  };
  const brandSocialCard: MediaImage = {
    url: "/objects/on-og-card",
    title: "Old Navy share card",
    tags: ["og-image", "brand-import", "old-navy"],
    width: 1200,
    height: 630,
  };
  const brandPromoNoDims: MediaImage = {
    url: "/objects/on-banner-legacy",
    title: "Legacy banner",
    tags: ["og-image", "brand-import", "old-navy"],
    width: null,
    height: null,
  };
  const foreignOg: MediaImage = {
    url: "/objects/random-og",
    title: "Random og",
    tags: ["og-image"],
    width: 1600,
    height: 2000,
  };
  const refHostOg: MediaImage = {
    url: "/objects/scraped-og",
    title: "scraped promo",
    tags: ["og-image", "scraped", "page-reference", "refhost:oldnavy.com"],
    width: 1200,
    height: 630,
  };

  it("keeps a brand-imported promo banner with content geometry (NOT a social card)", () => {
    expect(isExcludedFromGenerationPool(brandPromoTall)).toBe(false);
  });

  it("still excludes a brand-imported TRUE social card (1200x630)", () => {
    expect(isExcludedFromGenerationPool(brandSocialCard)).toBe(true);
  });

  it("keeps a brand-imported og-tagged row with UNKNOWN dimensions (brand-import never mirrors og:image meta)", () => {
    expect(isExcludedFromGenerationPool(brandPromoNoDims)).toBe(false);
  });

  it("still excludes a non-brand-import og row with no current-reference bypass", () => {
    expect(isExcludedFromGenerationPool(foreignOg)).toBe(true);
  });

  it("current-reference bypass: an og-tagged row from a host referenced THIS run competes — even a social card", () => {
    expect(isExcludedFromGenerationPool(refHostOg, new Set(["oldnavy.com"]))).toBe(false);
    expect(isExcludedFromGenerationPool(refHostOg, new Set(["clay.com"]))).toBe(true);
  });

  it("hard role reservations (logo/favicon/team-photo/homepage-screenshot) never get a bypass", () => {
    for (const hard of ["logo", "favicon", "team-photo", "homepage-screenshot"]) {
      const img: MediaImage = {
        url: `/objects/${hard}`,
        title: hard,
        tags: [hard, "brand-import", "refhost:oldnavy.com"],
        width: 1600,
        height: 2000,
      };
      expect(isExcludedFromGenerationPool(img, new Set(["oldnavy.com"]))).toBe(true);
    }
  });

  it("sanitize keeps a brand-imported promo banner the model picked, but clears a true social card", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Summer sale", imageUrl: "/objects/on-banner-1" } },
      { type: "feature", props: { headline: "Share", imageUrl: "/objects/on-og-card" } },
    ];
    blocks = sanitizeAIImageUrls(blocks, [brandPromoTall, brandSocialCard]) as any[];
    expect(blocks[0].props.imageUrl).toBe("/objects/on-banner-1");
    expect(blocks[1].props.imageUrl).toBe("");
  });
});

// ── Starter topicality floor + cross-vertical penalty (scrubs-on-fashion) ───
// A starter seed's purpose tag says nothing about its SUBJECT (starters are
// purpose-tagged en masse at seed time), so purpose-match alone must not put a
// medical-scrubs starter into the hero of a FASHION page when the tenant has a
// real library. Tiny/new tenants keep the starter fallback. Separately, the
// cross-vertical penalty drops clearly wrong-vertical candidates below the
// non-negative floor in every pass.
describe("starter topicality floor + cross-vertical penalty", () => {
  const scrubsStarter: MediaImage = {
    url: "/objects/starter-scrubs",
    title: "Starter 555",
    tags: ["starter", "industry", "medical", "scrubs", "clinic", "lp-hero"],
  };
  // Ten untagged curated drawer uploads — a "real" library with no usable hero.
  const bigLibrary: MediaImage[] = Array.from({ length: 10 }, (_, i) => ({
    url: `/objects/upload-${i}`,
    title: `upload ${i}`,
    tags: [],
  }));
  const FASHION_CTX = "summer sale fashion apparel new arrivals";
  const HEALTH_CTX = "healthcare clinic staffing landing page";

  it("a scrubs-tagged starter NEVER fills a fashion page's hero when the tenant has a real library", () => {
    const blocks: any[] = [{ type: "hero", props: { headline: "Summer styles for the family", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, [scrubsStarter, ...bigLibrary], FASHION_CTX, true) as any[];
    expect(filled[0].props.imageUrl).toBe("");
  });

  it("the same starter STILL fills a healthcare-context hero (topical overlap clears the floor)", () => {
    const blocks: any[] = [{ type: "hero", props: { headline: "Modern clinic staffing", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, [scrubsStarter, ...bigLibrary], HEALTH_CTX, true) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/starter-scrubs");
  });

  it("small-library tenants keep the starter fallback (purpose-only floor escape)", () => {
    // Library below the STARTER_FLOOR_MIN_LIBRARY threshold and a context with
    // NO conflicting vertical vocabulary → the old purpose-match behavior holds.
    const blocks: any[] = [{ type: "hero", props: { headline: "Grand opening", imageUrl: "" } }];
    const filled = fillEmptyImages(blocks, [scrubsStarter], "grand opening landing page", true) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/starter-scrubs");
  });

  it("cross-vertical penalty lets validation clear a model-assigned scrubs hero in favor of an on-vertical alternative", () => {
    const scrubsCurated: MediaImage = {
      url: "/objects/scrubs-photo",
      title: "Nurse in scrubs",
      tags: ["lp-hero", "medical", "scrubs", "clinic"],
    };
    const fashionHero: MediaImage = {
      url: "/objects/fashion-hero",
      title: "x",
      tags: ["lp-hero", "fashion"],
    };
    // Without the −8 conflict penalty both score the +8 purpose boost and the
    // fashion alternative's edge (one tag hit = +4) stays below CLEAR_GAP (8) —
    // the wrong pick survived. The penalty drops the scrubs pick to 0, widening
    // the gap to 12 >= CLEAR_GAP, so validation clears it for refill.
    const blocks: any[] = [
      { type: "hero", props: { headline: "Summer fashion sale", imageUrl: "/objects/scrubs-photo" } },
    ];
    validateAndDedupeAIImages(blocks, [scrubsCurated, fashionHero], FASHION_CTX);
    expect(blocks[0].props.imageUrl).toBe("");
  });

  it("penalty does NOT fire without clear conflict (generic context, or matching vertical)", () => {
    const scrubsCurated: MediaImage = {
      url: "/objects/scrubs-photo",
      title: "Nurse in scrubs",
      tags: ["lp-hero", "medical", "scrubs", "clinic"],
    };
    // Same-vertical context → keeps the pick.
    const keep: any[] = [
      { type: "hero", props: { headline: "Clinic staffing made easy", imageUrl: "/objects/scrubs-photo" } },
    ];
    validateAndDedupeAIImages(keep, [scrubsCurated], "healthcare clinic staffing");
    expect(keep[0].props.imageUrl).toBe("/objects/scrubs-photo");
    // Generic context with NO recognized vertical vocabulary → no penalty; the
    // purpose-matched pick survives (conservative: only clear conflicts fire).
    const generic: any[] = [
      { type: "hero", props: { headline: "Welcome to our team", imageUrl: "/objects/scrubs-photo" } },
    ];
    validateAndDedupeAIImages(generic, [scrubsCurated], "grand opening landing page");
    expect(generic[0].props.imageUrl).toBe("/objects/scrubs-photo");
  });

  it("an off-vertical image never wins a relaxed feature slot over an on-vertical one", () => {
    const scrubsFeature: MediaImage = {
      url: "/objects/scrubs-feature",
      title: "Scrubs",
      tags: ["lp-feature", "medical", "scrubs"],
    };
    const fashionFeature: MediaImage = {
      url: "/objects/fashion-feature",
      title: "Denim",
      tags: ["lp-feature", "fashion", "denim"],
    };
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline: "New denim arrivals", imageUrl: "" }] } },
    ];
    const filled = fillEmptyImages(blocks, [scrubsFeature, fashionFeature], FASHION_CTX, true) as any[];
    expect(filled[0].props.rows[0].imageUrl).toBe("/objects/fashion-feature");
  });
});

// ── lp-hero is DECISIVE for hero slots (Dandy dentures failure) ─────────────
// A product's heroImage is tagged lp-hero in Brand Settings and is the ONLY
// image meant to drive a page hero. A product-detail grid-card carrying many of
// the page's subject tags used to out-score that lp-hero photo (its tag matches
// overcoming the −10 hero purpose-mismatch penalty), shipping a grainy
// product-detail card as the hero. Purpose must win outright: when an lp-hero
// candidate exists, a product-detail image can NEVER occupy the hero slot —
// neither via the empty-slot fill nor via the model's own pick.
describe("hero slots — lp-hero purpose is decisive over product-detail tag matches", () => {
  // The designated hero photo: lp-hero, but only ONE subject tag.
  const lpHero: MediaImage = {
    url: "/objects/denture-hero",
    title: "Confident denture patient",
    tags: ["lp-hero", "dentures"],
  };
  // A grid-card product shot drowning in subject tags — WITHOUT the fix its tag
  // matches (+section/page) overcome the −10 hero mismatch and it out-scores the
  // hero photo for a hero slot.
  const detailManyTags: MediaImage = {
    url: "/objects/denture-card",
    title: "Two appointment dentures closeup",
    tags: ["product-detail", "dentures", "denture", "two appointment", "affordable", "smile", "teeth", "dental"],
  };
  const DENTURE_CTX = "two appointment dentures affordable dental dentist clinic teeth smile";

  it("(a) an lp-hero image beats a product-detail image with MORE tag matches for a hero slot (fill)", () => {
    // detailManyTags sorts FIRST so the win can't be mere ordering.
    const blocks: any[] = [
      { type: "hero", props: { headline: "Two appointment dentures, restore your smile", imageUrl: "" } },
    ];
    const filled = fillEmptyImages(blocks, [detailManyTags, lpHero], DENTURE_CTX) as any[];
    expect(filled[0].props.imageUrl).toBe("/objects/denture-hero");
  });

  it("(b) a product-detail image NEVER fills a hero slot while an lp-hero candidate exists", () => {
    // Even with the lp-hero image already consumed by an earlier hero, a second
    // hero slot must stay empty rather than grab the product-detail card — there
    // is no remaining lp-hero candidate, but the card must not be promoted into a
    // hero (the hero gate refuses product-detail there). Use a single hero with
    // only the product-detail card in the pool BUT an lp-hero present: the card
    // is skipped, the hero takes the lp-hero photo.
    const blocks: any[] = [
      { type: "hero", props: { headline: "Affordable dentures", imageUrl: "" } },
    ];
    const filled = fillEmptyImages(blocks, [detailManyTags, lpHero], DENTURE_CTX) as any[];
    expect(filled[0].props.imageUrl).not.toBe("/objects/denture-card");
    expect(filled[0].props.imageUrl).toBe("/objects/denture-hero");
  });

  it("(b2) a product-detail-only pool leaves a hero slot empty (never a card in the hero)", () => {
    // No lp-hero candidate at all: the hero gate still keeps the heavily-tagged
    // product-detail card OUT of the hero slot — empty beats a grainy card hero.
    const blocks: any[] = [
      { type: "hero", props: { headline: "Affordable dentures", imageUrl: "" } },
    ];
    const strict = fillEmptyImages(structuredClone(blocks), [detailManyTags], DENTURE_CTX, false) as any[];
    expect(strict[0].props.imageUrl).toBe("");
    const relaxed = fillEmptyImages(structuredClone(blocks), [detailManyTags], DENTURE_CTX, true) as any[];
    expect(relaxed[0].props.imageUrl).toBe("");
  });

  it("(b3) VALIDATION: a model-assigned product-detail card is cleared from a hero slot when an lp-hero exists", () => {
    const blocks: any[] = [
      { type: "hero", props: { headline: "Two appointment dentures", imageUrl: "/objects/denture-card" } },
    ];
    validateAndDedupeAIImages(blocks, [detailManyTags, lpHero], DENTURE_CTX);
    expect((blocks[0].props as any).imageUrl).toBe("");
  });

  it("(b4) end-to-end: validate clears the card, fill re-places the lp-hero photo", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Two appointment dentures", imageUrl: "/objects/denture-card" } },
    ];
    blocks = validateAndDedupeAIImages(blocks, [detailManyTags, lpHero], DENTURE_CTX) as any[];
    blocks = fillEmptyImages(blocks, [detailManyTags, lpHero], DENTURE_CTX) as any[];
    expect(blocks[0].props.imageUrl).toBe("/objects/denture-hero");
  });
});

// ── Multiple feature/showcase slots fill from a tagged pool ──────────────────
// A product/visual page emits several image-bearing blocks; each must draw a
// DISTINCT real library photo, not collapse to a single image.
describe("multi-slot pages fill multiple distinct library images", () => {
  const featPool: MediaImage[] = [
    { url: "/objects/dent-hero", title: "Smiling patient", tags: ["lp-hero", "dentures"] },
    { url: "/objects/feat-1", title: "Denture fitting", tags: ["lp-feature", "dentures", "fitting"] },
    { url: "/objects/feat-2", title: "Dental consult", tags: ["lp-feature", "dentures", "consult"] },
    { url: "/objects/feat-3", title: "Lab milling", tags: ["lp-feature", "dentures", "lab"] },
    { url: "/objects/detail-1", title: "Denture closeup", tags: ["product-detail", "dentures"] },
  ];
  const CTX = "affordable dentures dental clinic smile";

  it("(c) a page with a hero + multiple feature/showcase slots fills several DISTINCT images", () => {
    let blocks: any[] = [
      { type: "hero", props: { headline: "Affordable dentures", imageUrl: "" } },
      { type: "zigzag-features", props: { rows: [
        { headline: "Custom denture fitting", body: "", imageUrl: "" },
        { headline: "Denture consult", body: "", imageUrl: "" },
        { headline: "In-house denture lab", body: "", imageUrl: "" },
      ] } },
      { type: "product-grid", props: { items: [
        { title: "Denture set", description: "Dentures", image: "" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, featPool, CTX) as any[];
    const hero = blocks[0].props.imageUrl as string;
    const rowUrls = (blocks[1].props.rows as Array<{ imageUrl: string }>).map((r) => r.imageUrl);
    const prod = (blocks[2].props.items as Array<{ image: string }>)[0].image;
    const all = [hero, ...rowUrls, prod];
    // Every slot filled with a real library image.
    for (const u of all) expect(u).toBeTruthy();
    // Hero is the lp-hero photo, product card is the product-detail photo.
    expect(hero).toBe("/objects/dent-hero");
    expect(prod).toBe("/objects/detail-1");
    // All filled images are DISTINCT — not a single image repeated across the page.
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(5);
  });
});

// ── product-detail / lp-feature / lp-hero rows survive the promo/og predicate ──
// The vision classifier over-applies "og-image" to any photo with baked-in text.
// A row that ALSO carries an explicit landing-page PURPOSE tag is a deliberately
// classified block asset and must NEVER be excluded as promo/og — otherwise a
// tenant's entire purpose-tagged product library vanishes from the pool (the
// Dandy dentures starvation: 70+ tagged denture photos dropped, page left with
// one image). HARD role reservations (logo/etc.) still win.
describe("isExcludedFromGenerationPool — purpose-tag bypass of promo/og", () => {
  it("(d) a product-detail row carrying a stale og-image tag is NOT excluded", () => {
    const img: MediaImage = {
      url: "/objects/denture-card-og",
      title: "Two appointment dentures",
      tags: ["product-detail", "dentures", "og-image"],
      width: 1200,
      height: 630, // even with true social-card geometry, purpose wins
    };
    expect(isExcludedFromGenerationPool(img)).toBe(false);
  });

  it("(d2) lp-feature and lp-hero rows with an og/promo tag are NOT excluded", () => {
    const feature: MediaImage = {
      url: "/objects/feat-og",
      title: "Denture fitting",
      tags: ["lp-feature", "dentures", "social"],
    };
    const hero: MediaImage = {
      url: "/objects/hero-og",
      title: "Patient smile",
      tags: ["lp-hero", "dentures", "og"],
    };
    expect(isExcludedFromGenerationPool(feature)).toBe(false);
    expect(isExcludedFromGenerationPool(hero)).toBe(false);
  });

  it("(d3) a HARD role reservation (logo) still excludes even with a purpose tag", () => {
    const img: MediaImage = {
      url: "/objects/logo-tagged",
      title: "Brand mark",
      tags: ["lp-feature", "logo", "og-image"],
    };
    expect(isExcludedFromGenerationPool(img)).toBe(true);
  });

  it("(d4) an og row with NO purpose tag is still excluded (predicate unchanged for true social cards)", () => {
    const img: MediaImage = {
      url: "/objects/plain-og",
      title: "Share card",
      tags: ["og-image", "dentures"],
      width: 1200,
      height: 630,
    };
    expect(isExcludedFromGenerationPool(img)).toBe(true);
  });
});

// ── Topical relevance beats purpose-only off-topic (sleep-appliance regression) ──
// June 2026: on a "sleep appliances" page the generator placed random SCANNER
// photos (tagged lp-feature, zero topical overlap) over the tenant's sleep-
// appliance imagery. Two compounding bugs: (1) a hyphenated/plural content tag
// ("sleep-appliance" vs context "sleep appliances") earned ZERO topical credit
// because tag-matching was a raw substring test; (2) a soft purpose mismatch
// (a product-detail sleep photo on an lp-feature slot, −4) sank the on-topic
// image below the acceptance floor, so a zero-topical purpose-matched scanner
// (+8) won. Fix: normalize tags + context (hyphen/underscore→space, plural fold)
// AND let a verbatim section topical hit bypass the negative floor on non-hero
// slots ("on-topic beats off-topic when on-topic exists").
describe("fillEmptyImages — topical relevance vs purpose-only (sleep-appliance regression)", () => {
  const SLEEP_PAGE = "dental dentistry dentist clinic teeth sleep appliances landing page";

  function fillFeatureRow(lib: MediaImage[], headline: string): string {
    const blocks: any[] = [
      { type: "zigzag-features", props: { rows: [{ headline, body: "", imageUrl: "" }] } },
    ];
    const out = fillEmptyImages(blocks, lib, SLEEP_PAGE) as any[];
    return out[0].props.rows[0].imageUrl;
  }

  it("(a) a sleep-appliance image (product-detail) beats a purpose-only scanner (lp-feature) on a feature slot", () => {
    // The reported regression: scanner has the matching slot purpose (+8) and
    // zero topical overlap; the sleep photo is on-topic but its purpose mismatches
    // the feature slot. The on-topic image must win.
    const lib: MediaImage[] = [
      { url: "/objects/scanner", title: "Intraoral scanner", tags: ["lp-feature", "scanner"] },
      { url: "/objects/sleep", title: "Sleep appliance", tags: ["product-detail", "sleep-appliance"] },
    ];
    expect(fillFeatureRow(lib, "Sleep appliances")).toBe("/objects/sleep");
  });

  it("(a2) on-topic same-purpose sleep image also beats a purpose-only scanner", () => {
    const lib: MediaImage[] = [
      { url: "/objects/scanner", title: "Intraoral scanner", tags: ["lp-feature", "scanner"] },
      { url: "/objects/sleep", title: "Sleep appliance", tags: ["lp-feature", "sleep appliance"] },
    ];
    expect(fillFeatureRow(lib, "Sleep appliances")).toBe("/objects/sleep");
  });

  it("(b) hyphen / space / underscore / singular-plural tag variants all earn topical score and win the slot", () => {
    for (const tag of ["sleep appliance", "sleep-appliance", "sleep_appliance", "sleep appliances"]) {
      const lib: MediaImage[] = [
        { url: "/objects/scanner", title: "Intraoral scanner", tags: ["lp-feature", "scanner"] },
        { url: "/objects/sleep", title: "x", tags: ["lp-feature", tag] },
      ];
      expect(fillFeatureRow(lib, "Sleep appliances")).toBe("/objects/sleep");
    }
  });

  it("(b2) plural context matches a singular tag and vice-versa (aligner/aligners)", () => {
    const lib: MediaImage[] = [
      { url: "/objects/scanner", title: "Intraoral scanner", tags: ["lp-feature", "scanner"] },
      { url: "/objects/aligner", title: "x", tags: ["lp-feature", "aligners"] },
    ];
    // singular context, plural tag
    expect(fillFeatureRow(lib, "Clear aligner")).toBe("/objects/aligner");
  });

  it("(c) when NO candidate is on-topic, the purpose/relaxed fallback still fills (no starvation)", () => {
    // No image carries any sleep/appliance topical signal — the purpose-matched
    // scanner is the only sensible fill and must still be placed (not left empty).
    const lib: MediaImage[] = [
      { url: "/objects/scanner", title: "Intraoral scanner", tags: ["lp-feature", "scanner"] },
      { url: "/objects/clinic", title: "Clinic lobby", tags: ["lp-feature", "clinic"] },
    ];
    const picked = fillFeatureRow(lib, "Sleep appliances");
    expect(picked).toBeTruthy();
    expect(["/objects/scanner", "/objects/clinic"]).toContain(picked);
  });

  it("(c2) wholly off-topic, purpose-mismatched candidate is still rejected (empty beats wrong preserved)", () => {
    // A restaurant-tagged product-detail image on a feature slot: no topical hit
    // AND a purpose mismatch → negative score, no topical bypass → must NOT fill.
    const lib: MediaImage[] = [
      { url: "/objects/restaurant", title: "Dining room", tags: ["product-detail", "restaurant", "dining"] },
    ];
    // (the restaurant vocab is a different vertical from the dental page, so this
    // also exercises the cross-vertical penalty staying intact)
    expect(fillFeatureRow(lib, "Sleep appliances")).toBe("");
  });

  it("(d) product-detail sleep image fills a dso-products-grid sleep card by imageKey", () => {
    const lib: MediaImage[] = [
      { url: "/objects/scanner", title: "Intraoral scanner", tags: ["product-detail", "scanner"] },
      { url: "/objects/sleep", title: "Sleep appliance", tags: ["product-detail", "sleep-appliance"] },
    ];
    let blocks: any[] = [
      { type: "dso-products-grid", props: { headline: "Our services", products: [
        { name: "Sleep Appliances", detail: "Custom oral devices", price: "$$", icon: "moon", imageKey: "sleep" },
      ] } },
    ];
    blocks = fillEmptyImages(blocks, lib, SLEEP_PAGE) as any[];
    expect(blocks[0].props.products[0].imageUrl).toBe("/objects/sleep");
  });
});
