// Workspace URL (slug) rename end-to-end (task #137).
//
// The slug-rename feature touches several systems: validation, uniqueness vs
// live tenants AND vs unexpired tenant_slug_redirects rows, host cache
// invalidation in tenantHosts, and the frontend redirect signal surfaced by
// /api/auth/domain-context. This spec locks down that contract end-to-end so
// future refactors can't quietly break old bookmarks.
//
// What it verifies after a rename:
//   1. The new wildcard host (<newslug>.lpstudio.ai) resolves to the same
//      tenant with NO `redirectToHost` (it's the canonical URL now).
//   2. The old wildcard host (<oldslug>.lpstudio.ai) still resolves to the
//      same tenant, but with `redirectToHost = <newslug>.lpstudio.ai` so the
//      frontend can bounce existing bookmarks to the new canonical URL.
//   3. A second tenant cannot claim the just-vacated old slug while the
//      redirect window is still open (PATCH /api/admin/tenant-slug → 409,
//      and GET /api/admin/tenant-slug/availability returns available=false).
//   4. Renaming back to the original slug also frees up the redirect row
//      (sanity-check that the in-flight redirect doesn't shadow the
//      tenant's live slug if they undo the rename).

import { randomBytes } from "node:crypto";
import pg from "pg";
import { test, expect } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const { Pool } = pg;

// Default WILDCARD_TENANT_BASE_HOSTS in tenantHosts.ts. The api-server in
// playwright.config.ts doesn't override the env var, so this matches what
// the running test server sees.
const WILDCARD_BASE = "lpstudio.ai";

interface DomainContext {
  mode: "tenant-locked" | "microsite-only" | "open" | "not-found";
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  micrositeDomain: string | null;
  redirectToHost: string | null;
}

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture " +
        "can create a Royal-style tenant in the dev DB.",
    );
  }
  return url;
}

test.describe("Workspace slug rename (task #137)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let otherTenant: RoyalTenant;
  // Slug history captured so afterAll can clean up the tenant_slug_redirects
  // rows by old_slug if anything went sideways before the natural cascade
  // delete fires.
  let originalSlug: string;
  let renamedSlug: string;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    // Drop any orphan Royal-test rows from a previous crashed run so we don't
    // collide on tenants.domain="localhost" or on a stale redirect.
    await purgeStaleRoyalTenants(pool);

    tenant = await createRoyalTenant(pool);
    originalSlug = tenant.slug;

    // A second, isolated tenant on a different domain so its host resolution
    // can't collide with the primary tenant. Used to prove the old slug
    // can't be claimed while the redirect window is still open.
    otherTenant = await createRoyalTenant(pool, {
      domain: `slug-rename-other-${Date.now().toString(36)}.test`,
    });

    // Make the freshly-inserted tenants visible to findTenantByHost without
    // waiting out the 60s TTL. The PATCH endpoint also calls
    // invalidateTenantHostCache() internally on every successful rename, so
    // subsequent reads inside the test see the new state.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (!pool) return;
    try {
      // tenant_slug_redirects rows cascade on tenants.id, but defensively
      // drop them by old_slug too so a partial test run doesn't leave a
      // squatting redirect that breaks later runs.
      const slugs = [originalSlug, renamedSlug].filter(Boolean);
      if (slugs.length) {
        await pool.query(
          `DELETE FROM tenant_slug_redirects WHERE old_slug = ANY($1::text[])`,
          [slugs],
        );
      }
      if (otherTenant) await cleanupRoyalTenant(pool, otherTenant);
      if (tenant) await cleanupRoyalTenant(pool, tenant);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  test("rename swaps the canonical host, redirects the old one, and locks reuse", async ({ request }) => {
    // Use a unique target slug so the in-process domain-context cache (5min
    // TTL keyed by host) can't serve a stale entry from an earlier run.
    const target = `renamed-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;
    renamedSlug = target;

    // ── 1. Sanity-check the starting state via /tenant-slug ──────────────
    const beforeRes = await request.get("/api/admin/tenant-slug", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      beforeRes.ok(),
      `GET /api/admin/tenant-slug failed: ${beforeRes.status()} ${await beforeRes.text()}`,
    ).toBe(true);
    const before = (await beforeRes.json()) as { slug: string; baseHost: string | null };
    expect(before.slug.toLowerCase()).toBe(originalSlug.toLowerCase());
    // The base host the API picks for canonical URLs should match the
    // wildcard base we use when calling /api/auth/domain-context below.
    expect(before.baseHost).toBe(WILDCARD_BASE);

    // ── 2. Availability check on the new slug (should be free) ───────────
    const availRes = await request.get(
      `/api/admin/tenant-slug/availability?slug=${encodeURIComponent(target)}`,
      { headers: { Cookie: `lp_sid=${tenant.sessionSid}` } },
    );
    expect(availRes.ok(), `availability check failed: ${availRes.status()}`).toBe(true);
    const avail = (await availRes.json()) as { ok: boolean; available: boolean; normalized: string | null };
    expect(avail).toMatchObject({ ok: true, available: true, normalized: target });

    // ── 3. Perform the rename ────────────────────────────────────────────
    const renameRes = await request.patch("/api/admin/tenant-slug", {
      headers: {
        Cookie: `lp_sid=${tenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { slug: target },
    });
    expect(
      renameRes.ok(),
      `rename failed: ${renameRes.status()} ${await renameRes.text()}`,
    ).toBe(true);
    const renamed = (await renameRes.json()) as {
      ok: boolean;
      slug: string;
      oldSlug: string;
      canonicalHost: string | null;
      redirectExpiresAt: string;
      redirectTtlDays: number;
    };
    expect(renamed.ok).toBe(true);
    expect(renamed.slug).toBe(target);
    expect(renamed.oldSlug).toBe(originalSlug.toLowerCase());
    expect(renamed.canonicalHost).toBe(`${target}.${WILDCARD_BASE}`);
    expect(renamed.redirectTtlDays).toBeGreaterThan(0);
    expect(Date.parse(renamed.redirectExpiresAt)).toBeGreaterThan(Date.now());

    // The PATCH calls invalidateTenantHostCache() but the domain-context
    // route also has its own per-host cache; using fresh hosts (target +
    // originalSlug, both unique to this run) avoids any stale entry.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // ── 4. New login URL works (canonical, no redirect) ──────────────────
    const newHost = `${target}.${WILDCARD_BASE}`;
    const newCtxRes = await request.get(`/api/auth/domain-context?host=${encodeURIComponent(newHost)}`);
    expect(newCtxRes.ok(), `domain-context for new host failed: ${newCtxRes.status()}`).toBe(true);
    const newCtx = (await newCtxRes.json()) as DomainContext;
    expect(newCtx.tenantId, "new host must resolve to the renamed tenant").toBe(tenant.tenantId);
    expect(newCtx.tenantSlug?.toLowerCase()).toBe(target);
    expect(newCtx.mode).toBe("tenant-locked");
    expect(
      newCtx.redirectToHost,
      "new canonical host must NOT signal a redirect",
    ).toBeNull();

    // ── 5. Old wildcard host redirects to the new canonical host ─────────
    const oldHost = `${originalSlug.toLowerCase()}.${WILDCARD_BASE}`;
    const oldCtxRes = await request.get(`/api/auth/domain-context?host=${encodeURIComponent(oldHost)}`);
    expect(oldCtxRes.ok(), `domain-context for old host failed: ${oldCtxRes.status()}`).toBe(true);
    const oldCtx = (await oldCtxRes.json()) as DomainContext;
    expect(
      oldCtx.tenantId,
      "old host must still resolve to the renamed tenant via redirect",
    ).toBe(tenant.tenantId);
    expect(
      oldCtx.tenantSlug?.toLowerCase(),
      "tenantSlug surfaced for the old host must be the NEW canonical slug",
    ).toBe(target);
    expect(
      oldCtx.redirectToHost,
      "old host must signal a redirect to the new canonical host",
    ).toBe(newHost);

    // ── 6. Another tenant cannot claim the old slug while the window is
    //      open — both via the availability probe AND via PATCH itself. ──
    const otherAvailRes = await request.get(
      `/api/admin/tenant-slug/availability?slug=${encodeURIComponent(originalSlug)}`,
      { headers: { Cookie: `lp_sid=${otherTenant.sessionSid}` } },
    );
    expect(otherAvailRes.ok(), `other-tenant availability failed: ${otherAvailRes.status()}`).toBe(true);
    const otherAvail = (await otherAvailRes.json()) as { available: boolean; error?: string };
    expect(
      otherAvail.available,
      `old slug must be reported unavailable to other tenants while redirect is active (got ${JSON.stringify(otherAvail)})`,
    ).toBe(false);

    const hijackRes = await request.patch("/api/admin/tenant-slug", {
      headers: {
        Cookie: `lp_sid=${otherTenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { slug: originalSlug },
    });
    expect(
      hijackRes.status(),
      `another tenant claiming the redirected slug must 409, got ${hijackRes.status()} ${await hijackRes.text()}`,
    ).toBe(409);

    // The other tenant's slug must be untouched after the failed PATCH.
    const otherCheckRes = await request.get("/api/admin/tenant-slug", {
      headers: { Cookie: `lp_sid=${otherTenant.sessionSid}` },
    });
    expect(otherCheckRes.ok()).toBe(true);
    const otherCheck = (await otherCheckRes.json()) as { slug: string };
    expect(otherCheck.slug.toLowerCase()).toBe(otherTenant.slug.toLowerCase());

    // ── 7. The original tenant CAN rename back to its old slug. The PATCH
    //      handler clears any tenant_slug_redirects row for the target slug
    //      first so the redirect can't shadow the live slug. ──────────────
    const undoRes = await request.patch("/api/admin/tenant-slug", {
      headers: {
        Cookie: `lp_sid=${tenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { slug: originalSlug },
    });
    expect(
      undoRes.ok(),
      `rename-back failed: ${undoRes.status()} ${await undoRes.text()}`,
    ).toBe(true);
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // After the undo, /tenant-slug must report the original slug as the
    // tenant's canonical slug again. We can't re-probe `oldHost` through
    // /api/auth/domain-context here because that route maintains its own
    // 5-minute in-memory cache keyed by host (see DOMAIN_CTX_TTL_MS in
    // routes/auth.ts) and the cached entry from step 5 above would be
    // served instead. The /tenant-slug admin endpoint reads straight from
    // the DB so it reflects the rename-back immediately.
    const restoredAdminRes = await request.get("/api/admin/tenant-slug", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(restoredAdminRes.ok()).toBe(true);
    const restoredAdmin = (await restoredAdminRes.json()) as {
      slug: string;
      canonicalHost: string | null;
    };
    expect(restoredAdmin.slug.toLowerCase()).toBe(originalSlug.toLowerCase());
    // The Royal-tenant fixture sets tenants.domain="localhost", so the
    // GET /tenant-slug endpoint surfaces that as canonicalHost rather
    // than building a wildcard subdomain. Just confirm it's set.
    expect(restoredAdmin.canonicalHost, "canonicalHost must be populated after rename-back").toBeTruthy();

    // The DELETE-then-rename branch in PATCH /tenant-slug must have
    // cleared the redirect row for `originalSlug` so it doesn't shadow
    // the live slug. Verify directly against the DB.
    const redirectRow = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM tenant_slug_redirects WHERE old_slug = $1`,
      [originalSlug.toLowerCase()],
    );
    expect(
      Number(redirectRow.rows[0].count),
      "rename-back must drop the prior redirect row for the original slug",
    ).toBe(0);

    // The just-vacated `target` slug now sits in tenant_slug_redirects for
    // *this* tenant, so it's still reserved against other tenants — but
    // available to the same tenant (the PATCH handler's DELETE-then-rename
    // path already proved that). Verify the cross-tenant reservation:
    const otherAvailTarget = await request.get(
      `/api/admin/tenant-slug/availability?slug=${encodeURIComponent(target)}`,
      { headers: { Cookie: `lp_sid=${otherTenant.sessionSid}` } },
    );
    expect(otherAvailTarget.ok()).toBe(true);
    const otherAvailTargetBody = (await otherAvailTarget.json()) as { available: boolean };
    expect(
      otherAvailTargetBody.available,
      "the just-vacated renamed slug must remain reserved against other tenants for the redirect window",
    ).toBe(false);
  });
});
