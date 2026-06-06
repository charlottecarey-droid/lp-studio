/**
 * Tenant scope for the sales/marketing generator's media fetch.
 *
 * Both generators fetch their image library through `fetchMediaCatalog(tenantId)`.
 * It resolves the SAME read ACL as the media drawer (lib/libraryScope.ts):
 *   - the tenant's OWN rows,
 *   - a RECIPROCAL sibling's rows (the shared "drawer"), and
 *   - any explicitly shared row (is_shared = true).
 * It fails closed on a null tenantId. This guards two things at once:
 *   1. one tenant's uploads must never surface on an UNRELATED tenant's page, and
 *   2. a tenant that DOES share a drawer with its sibling must actually be able
 *      to use the sibling's images (the bug: the drawer showed them but the
 *      generator's pool collapsed to a single tenant and repeated one image).
 *
 * Exercised against the REAL Postgres pool (seeding tenants' lp_media rows),
 * no OpenAI and no HTTP — just the data-access boundary.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { fetchMediaCatalog } from "../lp/generate-page";

const SLUG_A = `it-ms-scope-a-${Date.now()}`;
const SLUG_B = `it-ms-scope-b-${Date.now()}`;
const SLUG_SIB1 = `it-ms-sib1-${Date.now()}`;
const SLUG_SIB2 = `it-ms-sib2-${Date.now()}`;
const SLUG_ONE1 = `it-ms-one1-${Date.now()}`;
const SLUG_ONE2 = `it-ms-one2-${Date.now()}`;

let tenantA: number;
let tenantB: number;
let sib1: number;
let sib2: number;
let one1: number;
let one2: number;
let sharedRowId: number;

async function insertTenant(slug: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $1, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [slug],
  );
  return r.rows[0].id;
}

async function insertImage(tenantId: number | null, title: string, url: string, isShared = false): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, tags, is_shared)
     VALUES ($1, $2, $3, 'image', '[]'::jsonb, $4) RETURNING id`,
    [tenantId, title, url, isShared],
  );
  return r.rows[0].id;
}

async function cleanup(): Promise<void> {
  if (sharedRowId) {
    await pool.query(`DELETE FROM lp_media WHERE id = $1`, [sharedRowId]).catch(() => {});
  }
  for (const id of [tenantA, tenantB, sib1, sib2, one1, one2]) {
    if (id) {
      await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
      // Clear sibling pointers before deleting so no FK/self-ref lingers.
      await pool.query(`UPDATE tenants SET shares_library_with_tenant_id = NULL WHERE id = $1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
    }
  }
}

beforeAll(async () => {
  tenantA = await insertTenant(SLUG_A);
  tenantB = await insertTenant(SLUG_B);
  sib1 = await insertTenant(SLUG_SIB1);
  sib2 = await insertTenant(SLUG_SIB2);
  one1 = await insertTenant(SLUG_ONE1);
  one2 = await insertTenant(SLUG_ONE2);

  // Unrelated tenants A and B — no sharing.
  await insertImage(tenantA, "A office", "/objects/scope-a-1");
  await insertImage(tenantB, "B office", "/objects/scope-b-1");

  // Reciprocal siblings sib1 <-> sib2 (both point at each other) — shared drawer.
  await pool.query(`UPDATE tenants SET shares_library_with_tenant_id = $1 WHERE id = $2`, [sib2, sib1]);
  await pool.query(`UPDATE tenants SET shares_library_with_tenant_id = $1 WHERE id = $2`, [sib1, sib2]);
  await insertImage(sib1, "Sib1 photo", "/objects/sib1-1");
  await insertImage(sib2, "Sib2 photo", "/objects/sib2-1");

  // One-sided link: one1 -> one2, but one2 does NOT point back. No sharing.
  await pool.query(`UPDATE tenants SET shares_library_with_tenant_id = $1 WHERE id = $2`, [one2, one1]);
  await insertImage(one2, "One2 photo", "/objects/one2-1");

  // A globally shared starter-library row (tenant_id NULL, is_shared true).
  sharedRowId = await insertImage(null, "Shared starter", "/objects/shared-starter-1", true);
});

afterAll(async () => {
  await cleanup();
});

describe("fetchMediaCatalog — read scope (drawer parity)", () => {
  it("returns the requesting tenant's own images but not an unrelated tenant's", async () => {
    const { allImages } = await fetchMediaCatalog(tenantA);
    const urls = allImages.map(i => i.url);
    expect(urls).toContain("/objects/scope-a-1");
    expect(urls).not.toContain("/objects/scope-b-1");
  });

  it("INCLUDES a reciprocal sibling's images (shared drawer)", async () => {
    const { allImages } = await fetchMediaCatalog(sib1);
    const urls = allImages.map(i => i.url);
    expect(urls).toContain("/objects/sib1-1");
    expect(urls).toContain("/objects/sib2-1");
  });

  it("does NOT include a one-sided (non-reciprocal) link's images", async () => {
    const { allImages } = await fetchMediaCatalog(one1);
    const urls = allImages.map(i => i.url);
    expect(urls).not.toContain("/objects/one2-1");
  });

  it("includes explicitly shared (is_shared) rows", async () => {
    const { allImages } = await fetchMediaCatalog(tenantA);
    const urls = allImages.map(i => i.url);
    expect(urls).toContain("/objects/shared-starter-1");
  });

  it("fails closed on a null tenantId (no global media pool leak)", async () => {
    const { images, allImages, catalogText } = await fetchMediaCatalog(null);
    expect(images).toEqual([]);
    expect(allImages).toEqual([]);
    expect(catalogText).toBe("");
  });
});
