// E2E coverage for the page-review workflow (task #108).
//
// Why this spec exists:
//   - We have three new perm-gated endpoints (submit-review / approve / reject)
//     plus a status filter (pending_review) and a Pending Review queue. The
//     gating is done at the api-server layer, so a focused test that hits the
//     API directly with hand-crafted lp_sid cookies catches contract drift
//     without paying the full UI-render cost.
//   - The Asana integration is exercised in fake mode (ASANA_FAKE_MODE=1 is
//     set by the api-server playwright webServer config when present). When
//     the env flag is not set on the running api-server, the spec gracefully
//     falls through and just asserts the warning shape.
//
// All four user identities (admin / Content Manager / editor / superadmin)
// are seeded via the new helper in setup/review-workflow-tenant.ts.

import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import {
  createReviewWorkflowTenant,
  cleanupReviewWorkflowTenant,
  purgeStaleReviewWorkflowTenants,
  type ReviewWorkflowTenant,
} from "./setup/review-workflow-tenant";

// Trailing slash is REQUIRED. Playwright's APIRequestContext resolves request
// paths against baseURL using WHATWG URL semantics: a leading-slash path
// replaces the entire base path, so `baseURL: ".../api"` + `post("/lp/pages")`
// resolves to `lp/pages` (the `/api` prefix is dropped) and the api-server
// returns its default 404 "Cannot POST /lp/pages".
const API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "4319"}/api/`;

// The api-server uses NEON_DATABASE_URL (with DATABASE_URL as fallback) and the
// monorepo's `drizzle.config.ts` has the same priority. Match that here so the
// helpers seed against the same database the api-server queries.
const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL is required for page-review-workflow.spec.ts");
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

// Per-suite — one tenant, four users, lots of pages.
let tenant: ReviewWorkflowTenant;
let secondTenant: ReviewWorkflowTenant;

test.beforeAll(async () => {
  await purgeStaleReviewWorkflowTenants(pool);
  tenant = await createReviewWorkflowTenant(pool);
  // Second tenant is used to verify the Dandy super-admin can publish into
  // a tenant they're NOT a member of (relies on app_users.role='superadmin').
  // Note: the superadmin's session payload still references their original
  // tenant; the userCanPublish() helper looks up app_users.role by email so
  // this works without a duplicate user row in the second tenant.
  secondTenant = await createReviewWorkflowTenant(pool, { uniqueSuffix: `cross-${Date.now().toString(36)}` });
});

test.afterAll(async () => {
  if (tenant) await cleanupReviewWorkflowTenant(pool, tenant);
  if (secondTenant) await cleanupReviewWorkflowTenant(pool, secondTenant);
  await pool.end();
});

/**
 * Returns a Playwright APIRequestContext pre-loaded with the lp_sid cookie
 * for the given user. The api-server requireAuth middleware reads the cookie
 * and rehydrates the session payload from app_sessions.
 */
async function clientFor(sid: string): Promise<APIRequestContext> {
  return await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Cookie: `lp_sid=${sid}` },
  });
}

async function createPage(sid: string, tenantId: number, title: string): Promise<{ id: number; slug: string }> {
  const ctx = await clientFor(sid);
  const slug = `page-${tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await ctx.post(`lp/pages`, {
    data: { title, slug, blocks: [], status: "draft" },
  });
  expect(res.status(), `create page (HTTP ${res.status()}: ${await res.text()})`).toBe(201);
  const page = await res.json() as { id: number; slug: string };
  await ctx.dispose();
  return { id: page.id, slug: page.slug };
}

test.describe("Page review workflow", () => {
  test("editor without publish perm submits, reviewer approves, status=published, Asana task created+completed", async () => {
    // Reset the in-memory Asana call queue so this test sees only its own
    // mock calls (other tests in the file also trigger create/complete).
    const setupCtx = await clientFor(tenant.admin.sessionSid);
    await setupCtx.post("_test/asana-calls/clear");
    await setupCtx.dispose();

    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Approve me");

    // 1. Editor submits for review.
    const editorCtx = await clientFor(tenant.editor.sessionSid);
    const submitRes = await editorCtx.post(`lp/pages/${page.id}/submit-review`);
    expect(submitRes.status()).toBe(200);
    const submitBody = await submitRes.json() as { page: { status: string; asanaTaskId: string | null }; asanaTaskId: string | null; asanaWarning: string | null };
    expect(submitBody.page.status).toBe("pending_review");
    // Asana fake-mode is active in the test web server, so the integration
    // (seeded by the tenant helper) must produce a deterministic task id and
    // never a warning.
    expect(submitBody.asanaTaskId).toBeTruthy();
    expect(submitBody.asanaWarning).toBeFalsy();
    expect(submitBody.page.asanaTaskId).toBe(submitBody.asanaTaskId);
    await editorCtx.dispose();

    // Verify the create call was actually recorded in the fake-mode queue.
    const inspectCtx = await clientFor(tenant.admin.sessionSid);
    const callsRes = await inspectCtx.get("_test/asana-calls");
    expect(callsRes.status()).toBe(200);
    const { calls } = await callsRes.json() as {
      calls: Array<{ kind: string; tenantId: number; pageId: number; taskId: string; payload: Record<string, unknown> }>;
    };
    const createCall = calls.find(c => c.kind === "create" && c.pageId === page.id);
    expect(createCall, "expected an Asana create call for the submitted page").toBeTruthy();
    expect(createCall!.tenantId).toBe(tenant.tenantId);
    expect((createCall!.payload as { name: string }).name).toContain("Approve me");
    await inspectCtx.dispose();

    // 2. Reviewer (Content Manager) sees it in the queue.
    const cmCtx = await clientFor(tenant.contentManager.sessionSid);
    const queueRes = await cmCtx.get(`lp/pages/pending-review`);
    expect(queueRes.status()).toBe(200);
    const queue = await queueRes.json() as Array<{ id: number; title: string; submittedBy: string | null }>;
    const queueRow = queue.find(r => r.id === page.id);
    expect(queueRow).toBeTruthy();
    // The requester field should resolve to the editor's email via the join
    // on submitted_by_user_id, not the latest updated_by.
    expect(queueRow!.submittedBy).toBe(tenant.editor.email);

    // 3. Reviewer approves.
    const approveRes = await cmCtx.post(`lp/pages/${page.id}/approve`);
    expect(approveRes.status()).toBe(200);
    const approveBody = await approveRes.json() as { page: { status: string } };
    expect(approveBody.page.status).toBe("published");
    await cmCtx.dispose();

    // Verify the comment+complete call was recorded against the same task id.
    const inspectCtx2 = await clientFor(tenant.admin.sessionSid);
    const callsRes2 = await inspectCtx2.get("_test/asana-calls");
    const { calls: calls2 } = await callsRes2.json() as {
      calls: Array<{ kind: string; pageId: number; taskId: string }>;
    };
    const completeCall = calls2.find(c => c.kind === "comment_complete" && c.pageId === page.id);
    expect(completeCall, "expected an Asana comment+complete call after approve").toBeTruthy();
    expect(completeCall!.taskId).toBe(submitBody.asanaTaskId);
    await inspectCtx2.dispose();

    // 4. Verify persistence: pending list no longer contains the page.
    const cmCtx2 = await clientFor(tenant.contentManager.sessionSid);
    const queue2 = await (await cmCtx2.get(`lp/pages/pending-review`)).json() as Array<{ id: number }>;
    expect(queue2.find(r => r.id === page.id)).toBeFalsy();
    await cmCtx2.dispose();
  });

  test("reviewer rejects with a note, status returns to draft and note persists", async () => {
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Reject me");

    const editorCtx = await clientFor(tenant.editor.sessionSid);
    await editorCtx.post(`lp/pages/${page.id}/submit-review`);
    await editorCtx.dispose();

    const cmCtx = await clientFor(tenant.contentManager.sessionSid);
    // Empty note is rejected.
    const noNoteRes = await cmCtx.post(`lp/pages/${page.id}/reject`, { data: { note: "  " } });
    expect(noNoteRes.status()).toBe(400);

    const rejectRes = await cmCtx.post(`lp/pages/${page.id}/reject`, {
      data: { note: "Headline copy is off-brand, please revise." },
    });
    expect(rejectRes.status()).toBe(200);
    const rejectBody = await rejectRes.json() as { page: { status: string; lastReviewNote: string | null } };
    expect(rejectBody.page.status).toBe("draft");
    expect(rejectBody.page.lastReviewNote).toContain("off-brand");
    await cmCtx.dispose();

    // The page row should record the rejection note in the database for audit.
    const { rows } = await pool.query<{ status: string; last_review_note: string | null }>(
      `SELECT status, last_review_note FROM lp_pages WHERE id = $1`,
      [page.id],
    );
    expect(rows[0].status).toBe("draft");
    expect(rows[0].last_review_note).toContain("off-brand");
  });

  test("editor without pages.publish cannot publish via PUT /lp/pages/:id (403)", async () => {
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Cannot publish");
    const editorCtx = await clientFor(tenant.editor.sessionSid);
    const res = await editorCtx.put(`lp/pages/${page.id}`, {
      data: { status: "published" },
    });
    // Server rejects status changes when the user lacks pages.publish.
    expect(res.status()).toBe(403);
    await editorCtx.dispose();

    // Sanity: the same editor CAN still update non-status fields.
    const editorCtx2 = await clientFor(tenant.editor.sessionSid);
    const titleRes = await editorCtx2.put(`lp/pages/${page.id}`, {
      data: { title: "Renamed by editor" },
    });
    expect(titleRes.status()).toBe(200);
    await editorCtx2.dispose();
  });

  test("Content Manager (pages.publish perm) can publish directly via PUT", async () => {
    const page = await createPage(tenant.contentManager.sessionSid, tenant.tenantId, "CM publishes");
    const cmCtx = await clientFor(tenant.contentManager.sessionSid);
    const res = await cmCtx.put(`lp/pages/${page.id}`, {
      data: { status: "published" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("published");
    await cmCtx.dispose();
  });

  test("Dandy super-admin can publish in their OWN tenant despite weak tenant_role", async () => {
    // Superadmin's session is attached to `tenant` with the Editor role
    // (which lacks pages.publish), so this exercises the userCanPublish
    // app_users.role='superadmin' branch.
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Super publishes");
    const superCtx = await clientFor(tenant.superadmin.sessionSid);
    const res = await superCtx.put(`lp/pages/${page.id}`, {
      data: { status: "published" },
    });
    expect(res.status(), `super publish (HTTP ${res.status()}: ${await res.text()})`).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("published");
    await superCtx.dispose();
  });

  test("Dandy super-admin can publish in ANOTHER tenant via X-Tenant-Id override", async () => {
    // Create a page in `secondTenant` using that tenant's editor.
    const page = await createPage(secondTenant.editor.sessionSid, secondTenant.tenantId, "Cross-tenant super publish");

    // Then have the superadmin (whose session is attached to `tenant`) act on
    // that page by setting X-Tenant-Id. A non-superadmin user cannot do this.
    const superCtx = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Cookie: `lp_sid=${tenant.superadmin.sessionSid}`,
        "X-Tenant-Id": String(secondTenant.tenantId),
      },
    });
    const res = await superCtx.put(`lp/pages/${page.id}`, {
      data: { status: "published" },
    });
    expect(res.status(), `cross-tenant super publish (HTTP ${res.status()}: ${await res.text()})`).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("published");
    await superCtx.dispose();

    // Negative control: a regular editor with the same X-Tenant-Id header
    // gets rejected (the override only honours superadmins).
    const editorCtx = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Cookie: `lp_sid=${tenant.editor.sessionSid}`,
        "X-Tenant-Id": String(secondTenant.tenantId),
      },
    });
    const cheatPage = await createPage(secondTenant.editor.sessionSid, secondTenant.tenantId, "Editor cheat target");
    const cheatRes = await editorCtx.put(`lp/pages/${cheatPage.id}`, {
      data: { status: "published" },
    });
    // 404 (page not in editor's session tenant) is the expected outcome — not 200.
    expect(cheatRes.status()).not.toBe(200);
    await editorCtx.dispose();
  });

  test("editor without pages.review cannot list pending review (403)", async () => {
    const editorCtx = await clientFor(tenant.editor.sessionSid);
    const res = await editorCtx.get(`lp/pages/pending-review`);
    expect(res.status()).toBe(403);
    await editorCtx.dispose();
  });

  test("pending-review queue is tenant-scoped (no cross-tenant leak)", async () => {
    // Submit a page in `secondTenant`.
    const otherPage = await createPage(secondTenant.editor.sessionSid, secondTenant.tenantId, "Cross-tenant page");
    const otherEditor = await clientFor(secondTenant.editor.sessionSid);
    await otherEditor.post(`lp/pages/${otherPage.id}/submit-review`);
    await otherEditor.dispose();

    // The reviewer from the FIRST tenant must not see it.
    const cmCtx = await clientFor(tenant.contentManager.sessionSid);
    const queue = await (await cmCtx.get(`lp/pages/pending-review`)).json() as Array<{ id: number; title: string }>;
    expect(queue.find(r => r.id === otherPage.id)).toBeFalsy();
    expect(queue.every(r => r.title !== "Cross-tenant page")).toBeTruthy();
    await cmCtx.dispose();
  });

  test("submit-review on an already-published page returns 409", async () => {
    const page = await createPage(tenant.contentManager.sessionSid, tenant.tenantId, "Already live");
    // CM publishes directly first.
    const cmCtx = await clientFor(tenant.contentManager.sessionSid);
    await cmCtx.put(`lp/pages/${page.id}`, { data: { status: "published" } });
    await cmCtx.dispose();

    const editorCtx = await clientFor(tenant.editor.sessionSid);
    const res = await editorCtx.post(`lp/pages/${page.id}/submit-review`);
    expect(res.status()).toBe(409);
    await editorCtx.dispose();
  });

  test("approve on a non-pending page returns 409", async () => {
    const page = await createPage(tenant.editor.sessionSid, tenant.tenantId, "Not yet pending");
    const cmCtx = await clientFor(tenant.contentManager.sessionSid);
    const res = await cmCtx.post(`lp/pages/${page.id}/approve`);
    expect(res.status()).toBe(409);
    await cmCtx.dispose();
  });
});
