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
});
