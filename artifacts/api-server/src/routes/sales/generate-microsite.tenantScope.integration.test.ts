/**
 * Tenant isolation for the sales microsite generator's media fetch.
 *
 * The sales generator now fetches its image library through the marketing
 * generator's shared `fetchMediaCatalog(tenantId)` (parity), which scopes the
 * query to a single tenant and fails closed on a null tenantId. This guards the
 * exact leak the helper's comment documents: one tenant's uploads must never
 * surface on another tenant's generated microsite.
 *
 * Exercised against the REAL Postgres pool (seeding two tenants' lp_media rows),
 * no OpenAI and no HTTP — just the data-access boundary.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { fetchMediaCatalog } from "../lp/generate-page";

const SLUG_A = `it-ms-scope-a-${Date.now()}`;
const SLUG_B = `it-ms-scope-b-${Date.now()}`;

let tenantA: number;
let tenantB: number;

async function cleanup(): Promise<void> {
  for (const id of [tenantA, tenantB]) {
    if (id) {
      await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
    }
  }
}

beforeAll(async () => {
  const a = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT MS Scope A', $1, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [SLUG_A],
  );
  tenantA = a.rows[0].id;
  const b = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT MS Scope B', $1, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [SLUG_B],
  );
  tenantB = b.rows[0].id;

  // Tenant A: one untagged image. Tenant B: a distinct image that must never
  // appear in A's catalog.
  await pool.query(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, tags)
     VALUES ($1, 'A office', '/objects/scope-a-1', 'image', '[]'::jsonb)`,
    [tenantA],
  );
  await pool.query(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, tags)
     VALUES ($1, 'B office', '/objects/scope-b-1', 'image', '[]'::jsonb)`,
    [tenantB],
  );
});

afterAll(async () => {
  await cleanup();
});

describe("fetchMediaCatalog — tenant isolation (sales generator parity)", () => {
  it("returns only the requesting tenant's images, never another tenant's", async () => {
    const { allImages } = await fetchMediaCatalog(tenantA);
    const urls = allImages.map(i => i.url);
    expect(urls).toContain("/objects/scope-a-1");
    expect(urls).not.toContain("/objects/scope-b-1");
  });

  it("fails closed on a null tenantId (no global media pool leak)", async () => {
    const { images, allImages, catalogText } = await fetchMediaCatalog(null);
    expect(images).toEqual([]);
    expect(allImages).toEqual([]);
    expect(catalogText).toBe("");
  });
});
