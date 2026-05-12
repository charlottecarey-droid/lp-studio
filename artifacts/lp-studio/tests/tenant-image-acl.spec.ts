// Task #226 — Tenant-scoped ACL for AI-generated block images.
//
// The AI image-generation flow uploads PNGs to object storage and serves them
// via `/api/storage/objects/uploads/<uuid>`. Before this task that route was
// open to anyone who knew the (unguessable) UUID, so a leaked URL could be
// fetched by any other logged-in tenant. This spec proves that:
//
//   - tenant A uploads a tenant-tagged object (mirroring the AI image flow)
//   - tenant A can fetch it back through the serve route (200)
//   - tenant B with a valid session cannot fetch it (403)
//   - an unauthenticated request CAN fetch it (200) — AI images are
//     embedded in published microsites that are themselves public, so
//     anonymous viewers must be able to load the asset for the page to
//     render. The threat model is a logged-in user from a *different*
//     tenant, not a public visitor of the microsite.
//
// The upload itself is exercised through a dev-only `/api/_test/*` endpoint
// (`/api/_test/upload-tenant-object`) so we don't have to call OpenAI from
// the test suite. The endpoint goes through the same
// `ObjectStorageService.uploadObjectEntity({ tenantId })` path the live
// `custom-blocks-generate` route uses.

import pg from "pg";
import { test, expect } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture can " +
        "create Royal-style tenants in the dev DB.",
    );
  }
  return url;
}

test.describe("AI-generated block image ACL", () => {
  let pool: pg.Pool;
  let tenantA: RoyalTenant;
  let tenantB: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    // Two distinct generic-industry tenants. Both register
    // `tenants.domain="localhost"`, but the requireAuth host check resolves
    // by host first match — what matters here is that the session cookies
    // resolve to two different `tenantId`s. Both are tenant-admin sessions
    // (RoyalTenant fixture sets `isAdmin: true`) so the host-tenant
    // mismatch check is bypassed for them, leaving the new ACL gate as the
    // only line of defence.
    tenantA = await createRoyalTenant(pool, { uniqueSuffix: `acl-a-${Date.now().toString(36)}` });
    tenantB = await createRoyalTenant(pool, { uniqueSuffix: `acl-b-${Date.now().toString(36)}` });

    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenantA && pool) await cleanupRoyalTenant(pool, tenantA);
    if (tenantB && pool) await cleanupRoyalTenant(pool, tenantB);
    if (pool) await pool.end();
  });

  test("tenant A's tagged image is unreadable by tenant B", async ({ request }) => {
    // 1) Tenant A uploads a tenant-tagged image via the dev-only fixture
    //    endpoint, which goes through the same uploadObjectEntity({ tenantId })
    //    path the AI image-generation route uses.
    const uploadRes = await request.post("/api/_test/upload-tenant-object", {
      headers: { "Content-Type": "application/json" },
      data: { tenantId: tenantA.tenantId },
    });
    expect(
      uploadRes.ok(),
      `upload fixture failed: ${uploadRes.status()} ${await uploadRes.text()}`,
    ).toBe(true);
    const { url } = (await uploadRes.json()) as { url: string };
    expect(url, "fixture must return the served URL").toMatch(
      /^\/api\/storage\/objects\/uploads\/[0-9a-f-]{36}$/,
    );

    // 2) Tenant A can read its own image (200).
    const ownerRead = await request.get(url, {
      headers: { Cookie: `lp_sid=${tenantA.sessionSid}` },
    });
    expect(
      ownerRead.status(),
      `owner tenant should read its own image; got ${ownerRead.status()} ${await ownerRead.text()}`,
    ).toBe(200);
    const ownerBytes = await ownerRead.body();
    expect(ownerBytes.byteLength, "owner read should return the PNG bytes").toBeGreaterThan(0);

    // 3) Tenant B (logged in, valid session, different tenant) is denied (403).
    const siblingRead = await request.get(url, {
      headers: { Cookie: `lp_sid=${tenantB.sessionSid}` },
    });
    expect(
      siblingRead.status(),
      `sibling tenant must NOT read tenant A's image; got ${siblingRead.status()}`,
    ).toBe(403);
    const siblingBody = await siblingRead.text();
    // Sanity: the body is the JSON error, not the PNG bytes.
    expect(siblingBody.length, "403 should return a small JSON error body, not the image").toBeLessThan(500);
    expect(siblingBody).not.toContain("PNG");

    // 4) An unauthenticated request succeeds (200) — published microsites
    //    are public, so the AI-generated <img> referenced by the page must
    //    load for an anonymous browser. The cross-tenant leak vector is a
    //    *logged-in* user from a different tenant, which is still blocked
    //    by step 3 above.
    const anonRead = await request.get(url);
    expect(
      anonRead.status(),
      `anonymous read of ACL'd image must succeed for public microsite consumption; got ${anonRead.status()}`,
    ).toBe(200);
    const anonBytes = await anonRead.body();
    expect(anonBytes.byteLength, "anonymous read should return the PNG bytes").toBeGreaterThan(0);
  });
});
