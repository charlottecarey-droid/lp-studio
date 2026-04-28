// Draft preview gating (task #107). Drafts must 404 on the public live URL
// on every tenant-mapped host, only render via /api/lp/preview/<slug> with
// a valid lp_sid session or a page-scoped review token, and re-appear on
// the live URL once published.

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

test.describe("Draft preview gating (task #107)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let otherTenant: RoyalTenant;
  let pageId: number;
  let pageSlug: string;
  let secondPageId: number;
  let secondPageSlug: string;
  let otherTenantPageSlug: string;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
    // A second, isolated tenant — used to prove the preview endpoint never
    // lets one tenant's session see another tenant's drafts. Give it a
    // unique non-localhost domain so it does NOT compete with the primary
    // tenant for findTenantByHost('localhost') resolution (which would make
    // the public /lp/page/:slug live-URL lookup non-deterministic and
    // intermittently 404 our just-published page).
    otherTenant = await createRoyalTenant(pool, {
      domain: `other-tenant-${Date.now().toString(36)}.test`,
    });

    // Refresh the API server's in-process tenant-host cache so the freshly
    // inserted tenants (with domain='localhost') are visible to
    // findTenantByHost without waiting out the 60s TTL — otherwise the
    // public /api/lp/page/:slug live-URL lookup may resolve a stale tenant
    // (or none) and 404 our just-published page.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    pageSlug = `draft-gating-${Date.now().toString(36)}`;
    secondPageSlug = `draft-gating-second-${Date.now().toString(36)}`;
    otherTenantPageSlug = `other-tenant-${Date.now().toString(36)}`;

    // Create the primary draft page on `tenant`.
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        Cookie: `lp_sid=${tenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: {
        title: "Draft Gating Test",
        slug: pageSlug,
        blocks: [
          { id: "b1", type: "block-headline", props: { text: "Draft body" } },
        ],
        status: "draft",
      },
    });
    expect(
      createRes.ok(),
      `page create failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);
    pageId = ((await createRes.json()) as { id: number; slug: string }).id;

    // Second draft page on the same tenant — used to verify a review token
    // is page-scoped and can't unlock a different page.
    const secondCreate = await request.post("/api/lp/pages", {
      headers: {
        Cookie: `lp_sid=${tenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: {
        title: "Second Draft",
        slug: secondPageSlug,
        blocks: [],
        status: "draft",
      },
    });
    expect(secondCreate.ok(), `second page create failed: ${secondCreate.status()}`).toBe(true);
    secondPageId = ((await secondCreate.json()) as { id: number }).id;

    // Draft on the OTHER tenant — used to verify cross-tenant isolation.
    const otherCreate = await request.post("/api/lp/pages", {
      headers: {
        Cookie: `lp_sid=${otherTenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: {
        title: "Other Tenant Draft",
        slug: otherTenantPageSlug,
        blocks: [],
        status: "draft",
      },
    });
    expect(otherCreate.ok(), `other-tenant page create failed: ${otherCreate.status()}`).toBe(true);
  });

  test.afterAll(async () => {
    if (tenant && pool) await cleanupRoyalTenant(pool, tenant);
    if (otherTenant && pool) await cleanupRoyalTenant(pool, otherTenant);
    if (pool) await pool.end();
  });

  test("draft is gated: live URL 404s, preview URL is auth-gated, anon preview 404s", async ({ request }) => {
    // ── 1. Live URL must 404 for the draft. This is the regression check —
    //       previously this returned 200 on every tenant host that wasn't
    //       partners.meetdandy.com.
    const draftLiveRes = await request.get(`/api/lp/page/${pageSlug}`);
    expect(
      draftLiveRes.status(),
      `draft leak: /api/lp/page/${pageSlug} returned ${draftLiveRes.status()} (expected 404)`,
    ).toBe(404);

    // ── 2. Preview endpoint with a tenant-admin session must return the draft.
    const draftPreviewAuthed = await request.get(`/api/lp/preview/${pageSlug}`, {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      draftPreviewAuthed.ok(),
      `preview auth check failed: ${draftPreviewAuthed.status()} ${await draftPreviewAuthed.text()}`,
    ).toBe(true);
    const previewBody = (await draftPreviewAuthed.json()) as {
      pageType: string;
      slug: string;
      status: string;
      isPreview: boolean;
    };
    expect(previewBody.pageType).toBe("builder");
    expect(previewBody.slug).toBe(pageSlug);
    expect(previewBody.status).toBe("draft");
    expect(previewBody.isPreview).toBe(true);

    // ── 3. Preview endpoint with NO cookie must 404 (no enumeration).
    const draftPreviewAnon = await request.get(`/api/lp/preview/${pageSlug}`);
    expect(
      draftPreviewAnon.status(),
      `anon preview leak: ${draftPreviewAnon.status()} (expected 404)`,
    ).toBe(404);
  });

  test("preview is tenant-isolated: tenant A's session cannot see tenant B's drafts", async ({ request }) => {
    // AuthUser.isAdmin is a tenant-role flag (NOT global superadmin), so
    // tenant A's admin session must never reach tenant B's pages.
    const cross = await request.get(`/api/lp/preview/${otherTenantPageSlug}`, {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      cross.status(),
      `cross-tenant preview leak: tenant A session reached tenant B's draft (${cross.status()})`,
    ).toBe(404);
  });

  test("editor preview works on admin host even when tenant has a microsite domain", async ({ request }) => {
    // Session cookies are host-scoped, so getLpPreviewUrl must always use
    // the admin host (not the microsite host) — verify the server side here.
    const micrositeHost = `microsite-${Date.now().toString(36)}.test`;
    await pool.query(
      `UPDATE tenants SET microsite_domain = $1 WHERE id = $2`,
      [micrositeHost, tenant.tenantId],
    );
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    const editorPreview = await request.get(`/api/lp/preview/${secondPageSlug}`, {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      editorPreview.ok(),
      `editor preview broke after microsite domain set: ${editorPreview.status()} ${await editorPreview.text()}`,
    ).toBe(true);
    const body = (await editorPreview.json()) as {
      slug: string;
      status: string;
      isPreview: boolean;
    };
    expect(body.slug).toBe(secondPageSlug);
    expect(body.status).toBe("draft");
    expect(body.isPreview).toBe(true);

    await pool.query(
      `UPDATE tenants SET microsite_domain = NULL WHERE id = $1`,
      [tenant.tenantId],
    );
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test("review token is page-scoped + revocable via DELETE", async ({ request }) => {
    // Token in JS (pgcrypto not always installed in CI DBs).
    const reviewToken = randomBytes(24).toString("hex");
    await pool.query(
      `INSERT INTO lp_page_reviews (page_id, reviewer_name, status, token)
       VALUES ($1, $2, 'pending', $3)`,
      [pageId, "Reviewer Test", reviewToken],
    );

    // Token opens its own page.
    const correct = await request.get(
      `/api/lp/preview/${pageSlug}?reviewToken=${reviewToken}`,
    );
    expect(correct.ok(), `token rejected on its own page: ${correct.status()}`).toBe(true);

    // Token cannot unlock a different page (page-scoped via review.pageId).
    const wrongPage = await request.get(
      `/api/lp/preview/${secondPageSlug}?reviewToken=${reviewToken}`,
    );
    expect(
      wrongPage.status(),
      `token for page ${pageId} unlocked page ${secondPageId}`,
    ).toBe(404);

    // Cross-tenant defense in depth.
    const wrongTenant = await request.get(
      `/api/lp/preview/${otherTenantPageSlug}?reviewToken=${reviewToken}`,
    );
    expect(wrongTenant.status(), `cross-tenant leak: ${wrongTenant.status()}`).toBe(404);

    // Revocation = DELETE on the row (no expires_at column in schema).
    await pool.query(`DELETE FROM lp_page_reviews WHERE token = $1`, [reviewToken]);
    const afterRevoke = await request.get(
      `/api/lp/preview/${pageSlug}?reviewToken=${reviewToken}`,
    );
    expect(
      afterRevoke.status(),
      `revoked token still unlocks page: ${afterRevoke.status()}`,
    ).toBe(404);
  });

  test("SPA route /preview/:slug renders the draft preview viewer", async ({ page, context }) => {
    // Mint a review token so the browser request is authorised without
    // having to set the lp_sid cookie on the host the test browser uses
    // (cookies are host-scoped and mucking with that adds flake risk).
    const reviewToken = randomBytes(24).toString("hex");
    await pool.query(
      `INSERT INTO lp_page_reviews (page_id, reviewer_name, status, token)
       VALUES ($1, $2, 'pending', $3)`,
      [pageId, "SPA Test", reviewToken],
    );

    await page.goto(`/preview/${pageSlug}?reviewToken=${reviewToken}`, {
      waitUntil: "domcontentloaded",
    });
    // Viewer renders [data-lp-page] around block content (same hook used by
    // no-dandy-leak-tenant). Wait for it to confirm the SPA route mounted
    // and the /api/lp/preview/:slug call resolved.
    await page.waitForSelector("[data-lp-page]", { timeout: 30_000 });

    // The preview-mode banner must be visible — proves isPreviewRoute was
    // detected (and so tracking/impressions are disabled).
    await expect(page.getByText(/draft preview/i).first()).toBeVisible({ timeout: 10_000 });

    await context.clearCookies();
    await pool.query(`DELETE FROM lp_page_reviews WHERE token = $1`, [reviewToken]);
  });

  test("published page returns 200 on the public live URL", async ({ request }) => {
    // Make tenant resolution deterministic by giving the tenant a UNIQUE
    // domain (no shared 'localhost' competition with other test workers)
    // and forcing the API to resolve via that domain through X-Forwarded-Host.
    const uniqueHost = `pub-test-${Date.now().toString(36)}.test`;
    await pool.query(
      `UPDATE tenants SET domain = $1 WHERE id = $2`,
      [uniqueHost, tenant.tenantId],
    );
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Publish the page.
    const publishRes = await request.put(`/api/lp/pages/${pageId}`, {
      headers: {
        Cookie: `lp_sid=${tenant.sessionSid}`,
        "Content-Type": "application/json",
      },
      data: { status: "published" },
    });
    expect(publishRes.ok(), `publish failed: ${publishRes.status()}`).toBe(true);

    // Hit the public live URL with the tenant's unique host header.
    const liveRes = await request.get(`/api/lp/page/${pageSlug}`, {
      headers: { "X-Forwarded-Host": uniqueHost },
    });
    expect(
      liveRes.ok(),
      `published live read failed: ${liveRes.status()} ${await liveRes.text()}`,
    ).toBe(true);
    const body = (await liveRes.json()) as { slug?: string; status?: string };
    expect(body.slug).toBe(pageSlug);
    expect(body.status).toBe("published");

    // Restore the original domain so cleanup doesn't surprise other tests.
    await pool.query(
      `UPDATE tenants SET domain = $1 WHERE id = $2`,
      [tenant.domain, tenant.tenantId],
    );
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });
});
