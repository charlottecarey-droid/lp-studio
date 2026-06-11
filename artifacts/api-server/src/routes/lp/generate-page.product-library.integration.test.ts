/**
 * Regression guard — `product-grid` and `product-showcase` blocks on a generated
 * page must be populated from the tenant's Content Library product rows
 * (`lp_library_items` types `product_grid` / `product_showcase`), so the real
 * product lines and their curated images render instead of random media-pool
 * imagery.
 *
 * The library `content` field names map 1:1 onto the renderer props:
 *   • product_grid     content {title, description, image}        → items[]{image,title,description}
 *   • product_showcase content {name, description, badge, image}  → cards[]{name,description,badge,image}
 *
 * This suite seeds a real tenant + library rows and calls the enforce helper
 * directly against the real Postgres pool (no AI, no HTTP).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import {
  enforceProductLibraryBlocks,
  fetchProductLibraryItems,
} from "./generate-page";

const createdTenantIds: number[] = [];

async function seedTenant(): Promise<number> {
  const slug = `it-prodlib-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Product-Library Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);
  return tenantId;
}

async function addLibraryItem(
  tenantId: number,
  type: "product_grid" | "product_showcase",
  name: string,
  content: Record<string, unknown>,
  approvedForAi: boolean,
  sortOrder: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO lp_library_items (tenant_id, type, name, content, is_default, approved_for_ai, sort_order)
     VALUES ($1, $2, $3, $4::jsonb, false, $5, $6)`,
    [tenantId, type, name, JSON.stringify(content), approvedForAi, sortOrder],
  );
}

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("enforceProductLibraryBlocks", () => {
  let tenantId: number;

  beforeAll(async () => {
    tenantId = await seedTenant();
    // product_grid
    await addLibraryItem(tenantId, "product_grid", "Crowns", {
      title: "Crowns", description: "Same-day ceramic crowns", image: "https://lib/crowns.jpg",
    }, true, 0);
    await addLibraryItem(tenantId, "product_grid", "Aligners", {
      title: "Aligners", description: "Clear aligner therapy", image: "https://lib/aligners.jpg",
    }, true, 1);
    await addLibraryItem(tenantId, "product_grid", "Hidden", {
      title: "Hidden", description: "Should be excluded", image: "https://lib/hidden.jpg",
    }, false, 2);
    // product_showcase
    await addLibraryItem(tenantId, "product_showcase", "Implants", {
      name: "Implants", description: "Full-arch implants", badge: "Popular", image: "https://lib/implants.jpg",
    }, true, 0);
  });

  it("fetchProductLibraryItems returns approved + legacy-NULL rows in saved order, excluding approved_for_ai=false", async () => {
    const grid = await fetchProductLibraryItems(tenantId, "product_grid");
    expect(grid.map((p) => p.title)).toEqual(["Crowns", "Aligners"]);
    expect(grid[0].image).toBe("https://lib/crowns.jpg");
  });

  it("populates a product-grid block's items[] from product_grid library rows (image overrides random fill)", async () => {
    const blocks = [
      {
        id: "pg-1",
        type: "product-grid",
        props: {
          headline: "Our products",
          columns: 3,
          // Pre-existing AI items with random/stock images — must be replaced.
          items: [
            { image: "https://random/stock-1.jpg", title: "AI Made This Up", description: "wrong" },
          ],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId);
    const items = (blocks[0].props as { items: Array<Record<string, string>> }).items;
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      image: "https://lib/crowns.jpg",
      title: "Crowns",
      description: "Same-day ceramic crowns",
    });
    expect(items[1].title).toBe("Aligners");
    // The hidden (unapproved) product never leaks onto the page.
    expect(items.some((i) => i.title === "Hidden")).toBe(false);
  });

  it("populates a product-showcase block's cards[] from product_showcase library rows", async () => {
    const blocks = [
      {
        id: "ps-1",
        type: "product-showcase",
        props: {
          headline: "Showcase",
          columns: 3,
          cards: [{ name: "Wrong", description: "wrong", badge: "", image: "https://random/x.jpg" }],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId);
    const cards = (blocks[0].props as { cards: Array<Record<string, string>> }).cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      name: "Implants",
      description: "Full-arch implants",
      badge: "Popular",
      image: "https://lib/implants.jpg",
    });
  });

  it("leaves a product block untouched when the tenant has no library rows for that type", async () => {
    const emptyTenant = await seedTenant();
    const blocks = [
      {
        id: "pg-empty",
        type: "product-grid",
        props: {
          headline: "Our products",
          columns: 3,
          items: [{ image: "https://template/keep.jpg", title: "Template Product", description: "keep me" }],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, emptyTenant);
    const items = (blocks[0].props as { items: Array<Record<string, string>> }).items;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Template Product");
  });

  it("no-ops when there are no product blocks on the page", async () => {
    const blocks = [{ id: "h", type: "hero", props: { headline: "Hi" } }];
    await expect(enforceProductLibraryBlocks(blocks, tenantId)).resolves.toBeUndefined();
    expect((blocks[0].props as { headline: string }).headline).toBe("Hi");
  });

  it("matches a dandy-product-hero image by headline (swaps only on confident match)", async () => {
    const blocks = [
      {
        id: "hero-match",
        type: "dandy-product-hero",
        props: { headline: "Same-day Crowns for your practice", imageUrl: "https://random/hero.jpg" },
      },
      {
        id: "hero-nomatch",
        type: "dandy-product-hero",
        props: { headline: "A reliable lab partner", imageUrl: "https://random/keep.jpg" },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId);
    // "Crowns" library row supplies the guaranteed image; alt back-filled.
    expect((blocks[0].props as { imageUrl: string }).imageUrl).toBe("https://lib/crowns.jpg");
    expect((blocks[0].props as { imageAlt?: string }).imageAlt).toBeTruthy();
    // No library product appears in the copy → original image is preserved.
    expect((blocks[1].props as { imageUrl: string }).imageUrl).toBe("https://random/keep.jpg");
  });

  it("matches dso-products-grid product images by name; unmatched products keep their fallback", async () => {
    const blocks = [
      {
        id: "dso-grid",
        type: "dso-products-grid",
        props: {
          products: [
            { name: "Crowns", detail: "x", price: "$99", icon: "crown" },
            { name: "Implants", detail: "y", price: "$199", icon: "target" },
            { name: "Night Guards", detail: "z", price: "$59", icon: "moon" },
          ],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId);
    const products = (blocks[0].props as { products: Array<Record<string, unknown>> }).products;
    // Crowns (product_grid) + Implants (product_showcase) both resolve from the pool.
    expect(products[0].imageUrl).toBe("https://lib/crowns.jpg");
    expect(products[1].imageUrl).toBe("https://lib/implants.jpg");
    // No "Night Guards" library row → no imageUrl set (renderer falls back to icon).
    expect(products[2].imageUrl).toBeUndefined();
    // AI copy is preserved on matched products.
    expect(products[0].name).toBe("Crowns");
    expect(products[0].price).toBe("$99");
  });

  it("never picks a generic library name for a more specific product (token-coverage guard)", async () => {
    const t = await seedTenant();
    await addLibraryItem(t, "product_showcase", "Crowns & Bridges", {
      name: "Crowns & Bridges", description: "d", badge: "", image: "https://lib/generic-crowns.jpg",
    }, true, 0);
    await addLibraryItem(t, "product_grid", "Posterior Crowns", {
      title: "Posterior Crowns", description: "d", image: "https://lib/posterior.jpg",
    }, true, 0);
    const blocks = [
      {
        id: "dso-specific",
        type: "dso-products-grid",
        props: { products: [{ name: "Posterior Crowns", detail: "x", price: "$99" }] },
      },
    ];
    await enforceProductLibraryBlocks(blocks, t);
    const products = (blocks[0].props as { products: Array<Record<string, unknown>> }).products;
    // "Crowns & Bridges" requires the token "bridges" (absent) → never matches;
    // the specific "Posterior Crowns" row wins.
    expect(products[0].imageUrl).toBe("https://lib/posterior.jpg");
  });

  // ── Task #3 — Brand Settings product images as the source of truth ────────
  const brandLine = (
    name: string,
    extra: { cardImage?: string; heroImage?: string; contentImages?: string[] },
  ) => ({
    name,
    description: "",
    valueProps: [] as string[],
    claims: [] as never[],
    keywords: [] as string[],
    ...extra,
  });

  it("brand card images win over the Content Library and KEEP the AI items (no wipe-replace)", async () => {
    // The tenant has library rows (Crowns/Aligners) but the brand also defines a
    // card image for Crowns — the brand image must take precedence and the AI's
    // own items must be preserved (not replaced by the full library list).
    const blocks = [
      {
        id: "pg-brand",
        type: "product-grid",
        props: {
          headline: "Our products",
          columns: 3,
          items: [
            { image: "https://random/stock.jpg", title: "Same-day Crowns", description: "AI copy" },
            { image: "https://random/other.jpg", title: "Veneers", description: "no brand image" },
          ],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Crowns", { cardImage: "https://brand/crowns-card.jpg" }),
    ]);
    const items = (blocks[0].props as { items: Array<Record<string, string>> }).items;
    // AI items are kept (length unchanged, no library wipe-replace).
    expect(items).toHaveLength(2);
    // Brand card image overrides the AI/stock image on the matched product.
    expect(items[0].image).toBe("https://brand/crowns-card.jpg");
    expect(items[0].title).toBe("Same-day Crowns");
    // "Veneers" matches neither a brand image nor a library row → existing kept.
    expect(items[1].image).toBe("https://random/other.jpg");
  });

  it("product-grid per-item precedence: brand cardImage > library image > existing", async () => {
    // Mixed config: the brand supplies a card image for Crowns only. Aligners has
    // no brand image but HAS a library row → it must fall back to the library
    // image (not keep the random AI photo). Veneers has neither → keep existing.
    const blocks = [
      {
        id: "pg-mixed",
        type: "product-grid",
        props: {
          headline: "Our products",
          columns: 3,
          items: [
            { image: "https://random/1.jpg", title: "Same-day Crowns", description: "AI" },
            { image: "https://random/2.jpg", title: "Clear Aligners", description: "AI" },
            { image: "https://random/3.jpg", title: "Veneers", description: "AI" },
          ],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Crowns", { cardImage: "https://brand/crowns-card.jpg" }),
    ]);
    const items = (blocks[0].props as { items: Array<Record<string, string>> }).items;
    expect(items).toHaveLength(3);
    expect(items[0].image).toBe("https://brand/crowns-card.jpg"); // brand wins
    expect(items[1].image).toBe("https://lib/aligners.jpg"); // library fallback
    expect(items[2].image).toBe("https://random/3.jpg"); // existing kept
  });

  it("product-showcase per-item precedence: brand cardImage > library image > existing", async () => {
    // The brand supplies a card image for Implants only. Crowns falls back to its
    // library row; Veneers (no brand, no library) keeps its existing image.
    const blocks = [
      {
        id: "ps-mixed",
        type: "product-showcase",
        props: {
          headline: "Showcase",
          columns: 3,
          cards: [
            { name: "Implants", description: "AI", badge: "", image: "https://random/a.jpg" },
            { name: "Crowns", description: "AI", badge: "", image: "https://random/b.jpg" },
            { name: "Veneers", description: "AI", badge: "", image: "https://random/c.jpg" },
          ],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Implants", { cardImage: "https://brand/implants-card.jpg" }),
    ]);
    const cards = (blocks[0].props as { cards: Array<Record<string, string>> }).cards;
    expect(cards).toHaveLength(3);
    expect(cards[0].image).toBe("https://brand/implants-card.jpg"); // brand wins
    expect(cards[1].image).toBe("https://lib/crowns.jpg"); // library fallback
    expect(cards[2].image).toBe("https://random/c.jpg"); // existing kept
  });

  it("brand card images override product-showcase cards while preserving AI copy", async () => {
    const blocks = [
      {
        id: "ps-brand",
        type: "product-showcase",
        props: {
          headline: "Showcase",
          columns: 3,
          cards: [{ name: "Implants", description: "AI copy", badge: "New", image: "https://random/x.jpg" }],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Implants", { cardImage: "https://brand/implants-card.jpg" }),
    ]);
    const cards = (blocks[0].props as { cards: Array<Record<string, string>> }).cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].image).toBe("https://brand/implants-card.jpg");
    expect(cards[0].name).toBe("Implants");
    expect(cards[0].description).toBe("AI copy");
    expect(cards[0].badge).toBe("New");
  });

  it("brand hero image beats the Content Library on a dandy-product-hero match", async () => {
    const blocks = [
      {
        id: "hero-brand",
        type: "dandy-product-hero",
        props: { headline: "Same-day Crowns for your practice", imageUrl: "https://random/hero.jpg" },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Crowns", { heroImage: "https://brand/crowns-hero.jpg" }),
    ]);
    // Brand hero pool is first → wins the tie over the "Crowns" library row.
    expect((blocks[0].props as { imageUrl: string }).imageUrl).toBe("https://brand/crowns-hero.jpg");
  });

  it("dandy-product-hero falls back to cardImage when no heroImage is set", async () => {
    const blocks = [
      {
        id: "hero-cardfallback",
        type: "dandy-product-hero",
        props: { headline: "Clear Aligners for adults", imageUrl: "https://random/hero.jpg" },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Aligners", { cardImage: "https://brand/aligners-card.jpg" }),
    ]);
    expect((blocks[0].props as { imageUrl: string }).imageUrl).toBe("https://brand/aligners-card.jpg");
  });

  it("dso-products-grid prefers the brand card image over the library image", async () => {
    const blocks = [
      {
        id: "dso-brand",
        type: "dso-products-grid",
        props: {
          products: [
            { name: "Crowns", detail: "x", price: "$99" },
            { name: "Aligners", detail: "y", price: "$199" },
          ],
        },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Crowns", { cardImage: "https://brand/crowns-card.jpg" }),
    ]);
    const products = (blocks[0].props as { products: Array<Record<string, unknown>> }).products;
    // Crowns resolves from the brand pool (first → wins tie vs library row).
    expect(products[0].imageUrl).toBe("https://brand/crowns-card.jpg");
    // Aligners has no brand image → falls back to the library row.
    expect(products[1].imageUrl).toBe("https://lib/aligners.jpg");
  });

  it("rotates brand content images across content sections about the same product (no repeats)", async () => {
    const blocks = [
      {
        id: "c1",
        type: "feature-section",
        props: { headline: "How Crowns transform your day", imageUrl: "https://random/a.jpg" },
      },
      {
        id: "c2",
        type: "split-content",
        props: { title: "Crowns, delivered same day", imageUrl: "https://random/b.jpg" },
      },
      {
        id: "c3",
        type: "image-text",
        props: { heading: "Why labs choose Crowns", imageUrl: "https://random/c.jpg" },
      },
      // Unrelated content section → untouched.
      {
        id: "c4",
        type: "feature-section",
        props: { headline: "About our team", imageUrl: "https://random/keep.jpg" },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Crowns", { contentImages: ["https://brand/c-1.jpg", "https://brand/c-2.jpg"] }),
    ]);
    const img = (i: number) => (blocks[i].props as { imageUrl: string }).imageUrl;
    // Three Crowns sections rotate through the two content images (1,2,1).
    expect(img(0)).toBe("https://brand/c-1.jpg");
    expect(img(1)).toBe("https://brand/c-2.jpg");
    expect(img(2)).toBe("https://brand/c-1.jpg");
    // The non-Crowns section is left alone.
    expect(img(3)).toBe("https://random/keep.jpg");
  });

  it("content-image rotation never touches chrome or product blocks", async () => {
    const blocks = [
      { id: "nav", type: "navbar", props: { headline: "Crowns", imageUrl: "https://random/nav.jpg" } },
      { id: "ftr", type: "footer", props: { title: "Crowns", image: "https://random/ftr.jpg" } },
      {
        id: "pg",
        type: "product-grid",
        props: { headline: "Crowns", items: [{ title: "Crowns", image: "https://random/pg.jpg", description: "" }] },
      },
    ];
    await enforceProductLibraryBlocks(blocks, tenantId, [
      brandLine("Crowns", { cardImage: "https://brand/crowns-card.jpg", contentImages: ["https://brand/c-1.jpg"] }),
    ]);
    // Chrome blocks keep their images (skipped by the content-image pass).
    expect((blocks[0].props as { imageUrl: string }).imageUrl).toBe("https://random/nav.jpg");
    expect((blocks[1].props as { image: string }).image).toBe("https://random/ftr.jpg");
    // The product-grid item is handled by the card pass (brand card), not the
    // content rotation, so it gets the card image — never a content image.
    const items = (blocks[2].props as { items: Array<Record<string, string>> }).items;
    expect(items[0].image).toBe("https://brand/crowns-card.jpg");
  });

  it("with no brand product lines, behavior is identical to the legacy library path (no regression)", async () => {
    const blocks = [
      {
        id: "pg-legacy",
        type: "product-grid",
        props: {
          headline: "Our products",
          columns: 3,
          items: [{ image: "https://random/stock.jpg", title: "AI", description: "x" }],
        },
      },
    ];
    // Passing an empty brand array must keep the legacy wipe-and-replace.
    await enforceProductLibraryBlocks(blocks, tenantId, []);
    const items = (blocks[0].props as { items: Array<Record<string, string>> }).items;
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Crowns");
    expect(items[0].image).toBe("https://lib/crowns.jpg");
  });
});
