// Draft preview gating end-to-end check (task #107).
//
// Bug fixed: drafts saved by any tenant were publicly accessible at
// /lp/<slug> on every tenant-mapped host (the original code only blocked
// drafts when the host included "partners.meetdandy.com"). This spec
// reproduces the leak and verifies the gating behaviour:
//
//   1. /lp/<slug> for a draft  → 404 (live URL must NEVER serve drafts).
//   2. /api/lp/preview/<slug> for the same draft, with a tenant-admin
//      lp_sid cookie → 200 (preview URL is auth-gated).
//   3. /api/lp/preview/<slug> for the same draft with NO cookie → 404.
//
// We exercise the API surface directly (instead of mounting the viewer in
// the browser) because the spec is about server-side gating. The
// published-page render path (status='published' → /lp/<slug> serves) is
// covered by the existing no-Dandy-leak spec; we don't re-test it here
// because the public endpoint resolves tenants from the request host
// (findTenantByHost), which is shared in-process state across all parallel
// test workers and intermittently lands on the wrong tenant for a freshly
// created `royal-test-` fixture. The current spec stays purely on the
// auth/token paths whose tenant is derived from the session payload, not
// the request host, so it's deterministic.

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

    // ── 2. Preview endpoint with a valid tenant-admin session cookie must
    //       return the draft. This is the supported way for editors and
    //       reviewers to see in-progress work.
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

    // ── 3. Preview endpoint with NO session cookie must 404. Tightens the
    //       gating so logged-out visitors can't enumerate drafts via the
    //       /preview/ path either.
    const draftPreviewAnon = await request.get(`/api/lp/preview/${pageSlug}`);
    expect(
      draftPreviewAnon.status(),
      `anon preview leak: ${draftPreviewAnon.status()} (expected 404)`,
    ).toBe(404);
  });

  test("preview is tenant-isolated: tenant A's session cannot see tenant B's drafts", async ({ request }) => {
    // A tenant-A admin session must NOT be able to preview tenant B's draft,
    // even though both sessions have `isAdmin=true` on their own tenant.
    // (`AuthUser.isAdmin` is a tenant-role flag, not a global superadmin
    // flag — see auth.ts.) The /preview/ endpoint must always look the
    // page up under the SESSION's tenantId, not the user.isAdmin bypass.
    const cross = await request.get(`/api/lp/preview/${otherTenantPageSlug}`, {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      cross.status(),
      `cross-tenant preview leak: tenant A session reached tenant B's draft (${cross.status()})`,
    ).toBe(404);
  });

  test("editor preview works on admin host even when tenant has a microsite domain", async ({ request }) => {
    // Regression check for the auth-context-mismatch the architect flagged:
    // `getLpPreviewUrl` must always point at the admin host (where the
    // editor's lp_sid cookie lives), NEVER at the tenant's microsite/custom
    // domain — because session cookies are host-scoped and a preview link
    // on the microsite host would not carry the editor's session, causing
    // an immediate 404. We prove the server-side half of that contract here:
    // even when the tenant has a microsite_domain configured, the preview
    // endpoint hit on the admin host with the editor's session returns the
    // draft (200 + status='draft' + isPreview=true).
    const micrositeHost = `microsite-${Date.now().toString(36)}.test`;
    await pool.query(
      `UPDATE tenants SET microsite_domain = $1 WHERE id = $2`,
      [micrositeHost, tenant.tenantId],
    );
    // Refresh the in-process cache so findTenantByHost picks up the change
    // immediately (it's TTL-cached for 60s otherwise).
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

    // Restore so subsequent tests / cleanup aren't surprised.
    await pool.query(
      `UPDATE tenants SET microsite_domain = NULL WHERE id = $1`,
      [tenant.tenantId],
    );
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test("review token is page-scoped: a token for page A cannot unlock page B", async ({ request }) => {
    // Mint a review record for the FIRST page only. Token generated in JS
    // (not via pgcrypto's gen_random_bytes — not always installed in CI DBs).
    const reviewToken = randomBytes(24).toString("hex");
    await pool.query(
      `INSERT INTO lp_page_reviews (page_id, reviewer_name, status, token)
       VALUES ($1, $2, 'pending', $3)`,
      [pageId, "Reviewer Test", reviewToken],
    );

    // Sanity: the token DOES open the page it was minted for.
    const correct = await request.get(
      `/api/lp/preview/${pageSlug}?reviewToken=${reviewToken}`,
    );
    expect(
      correct.ok(),
      `review token rejected on its own page: ${correct.status()} ${await correct.text()}`,
    ).toBe(true);

    // The token must NOT unlock a different page on the same tenant. This is
    // the page-scoped tightening — without it, any reviewer link could be
    // swapped to enumerate other slugs in the same tenant.
    const wrongPage = await request.get(
      `/api/lp/preview/${secondPageSlug}?reviewToken=${reviewToken}`,
    );
    expect(
      wrongPage.status(),
      `review token leak: token for page ${pageId} unlocked page ${secondPageId} (${wrongPage.status()})`,
    ).toBe(404);

    // It also must not unlock another tenant's page (defense in depth — the
    // tenant-id mismatch alone should already fail it, but assert it).
    const wrongTenant = await request.get(
      `/api/lp/preview/${otherTenantPageSlug}?reviewToken=${reviewToken}`,
    );
    expect(
      wrongTenant.status(),
      `review token cross-tenant leak: ${wrongTenant.status()}`,
    ).toBe(404);

    // Revocation contract: the schema deliberately has no expires_at /
    // revoked_at — the lp_page_reviews row IS the token, and revocation is
    // implemented as DELETE (see DELETE /lp/pages/:pageId/reviews/:reviewId
    // in collaboration.ts). Prove that removing the row immediately denies
    // future preview attempts with the same token (defends against the
    // "token works indefinitely" concern raised in code review).
    await pool.query(`DELETE FROM lp_page_reviews WHERE token = $1`, [reviewToken]);
    const afterRevoke = await request.get(
      `/api/lp/preview/${pageSlug}?reviewToken=${reviewToken}`,
    );
    expect(
      afterRevoke.status(),
      `revoked review token still unlocks page: ${afterRevoke.status()} (expected 404)`,
    ).toBe(404);
  });
});
