// UI-level coverage for the page-review workflow (task #111).
//
// The sibling page-review-workflow.spec.ts is API-only; it would not have
// caught the BuilderEditor hydration bug fixed during code review (where
// the in-component status state was reset to "draft" after a reload because
// the fetch handler didn't recognise the new "pending_review" status string).
//
// What this spec exercises end-to-end through the actual React app:
//   1. An editor (no pages.publish / pages.review) opens BuilderEditor and
//      clicks "Submit for Review". The status badge flips to "Pending
//      Review" and only the in-review submit affordance is shown — no
//      Publish, no Approve/Reject.
//   2. After a hard reload, the badge MUST still read "Pending Review" and
//      the role-aware buttons MUST still be in the editor-only configuration.
//      This is the regression that the API-only spec misses.
//   3. A Content Manager (pages.publish + pages.review) opens the same page
//      in a fresh browser context. They see the badge as "Pending Review",
//      the Approve/Reject buttons, the Publish button, and the disabled
//      "In Review" submit affordance.
//
// The fixture re-uses createReviewWorkflowTenant so the auth shape and
// permission map exactly match the API spec — there is one source of truth
// for what an "editor" or "Content Manager" persona means in tests.

import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import {
  createReviewWorkflowTenant,
  cleanupReviewWorkflowTenant,
  purgeStaleReviewWorkflowTenants,
  type ReviewWorkflowTenant,
} from "./setup/review-workflow-tenant";
import { purgeStaleRoyalTenants } from "./setup/royal-tenant";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for page-review-workflow-ui.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: ReviewWorkflowTenant;

test.beforeAll(async ({ request }) => {
  // Purge stale tenants from any prior crashed runs of either review-workflow
  // *or* the sibling royal-tenant fixtures. Both helpers create tenants with
  // domain="localhost"; if more than one survives, the api-server's tenant-by-
  // host cache picks one nondeterministically and the post-Vite-proxy host
  // check (Vite uses changeOrigin:true so api-server sees host=localhost)
  // would 403 our session against the wrong tenant.
  await purgeStaleReviewWorkflowTenants(pool);
  await purgeStaleRoyalTenants(pool);
  tenant = await createReviewWorkflowTenant(pool);

  // Drop the in-process tenant-by-host cache so the freshly inserted tenant
  // is the one resolved for host="localhost" without waiting out the 60s TTL.
  // Mirrors the pattern used by draft-preview-gating.spec.ts.
  await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
});

test.afterAll(async () => {
  if (tenant) await cleanupReviewWorkflowTenant(pool, tenant);
  await pool.end();
});

/**
 * Attach the api-server's lp_sid session cookie to a browser context so the
 * subsequent /api/auth/me call inside AuthProvider rehydrates the right user.
 * Mirrors the helper used by the no-Dandy-leak UI spec for parity.
 */
async function setSessionCookie(
  context: BrowserContext,
  sid: string,
  baseURL: string,
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "lp_sid",
      value: sid,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  ]);
}

/**
 * Wait until BuilderEditor has finished its initial load. The status badge
 * is rendered by BuilderTopBar on the same render that consumes the fetched
 * page, so its presence is a reliable signal that hydration is done.
 */
async function waitForEditorReady(page: Page): Promise<void> {
  try {
    await page.waitForSelector('[data-testid="page-status-badge"]', { timeout: 60_000 });
  } catch (err) {
    // Helpful diagnostic on flake: a bare "selector not visible" tells us
    // nothing about whether auth, the lazy chunk, or the page fetch failed.
    const url = page.url();
    let title = "";
    let bodyText = "";
    try {
      title = await page.title();
      bodyText = (await page.locator("body").innerText({ timeout: 2_000 })).slice(0, 1200);
    } catch {
      /* fall through */
    }
    throw new Error(
      `Timed out waiting for builder status badge.\n` +
        `URL: ${url}\n` +
        `Title: ${JSON.stringify(title)}\n` +
        `Body snapshot:\n${bodyText}\n` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Create an editor-owned page directly via the API. Going through the UI to
 * create the page would add many unrelated assertions and test surface; the
 * UI flow we care about starts with an existing draft. Uses the playwright
 * `request` fixture (same baseURL as the browser) so the host-resolution
 * path matches what the in-page fetches will hit.
 */
async function createDraftPageAsEditor(request: APIRequestContext, title: string): Promise<number> {
  const slug = `ui-review-${tenant.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await request.post("/api/lp/pages", {
    headers: {
      "Content-Type": "application/json",
      Cookie: `lp_sid=${tenant.editor.sessionSid}`,
    },
    data: { title, slug, blocks: [], status: "draft" },
  });
  if (res.status() !== 201) {
    throw new Error(`createDraftPageAsEditor: HTTP ${res.status()} ${await res.text()}`);
  }
  const page = (await res.json()) as { id: number };
  return page.id;
}

test.describe("Page review workflow — BuilderEditor UI", () => {
  test("editor submits, badge & role-aware buttons survive a hard reload; CM sees reviewer affordances", async ({ browser, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    const pageId = await createDraftPageAsEditor(request, "Review UI Smoke");

    // ── Phase 1: Editor opens the page, submits for review ────────────────
    const editorContext = await browser.newContext();
    await setSessionCookie(editorContext, tenant.editor.sessionSid, baseURL!);
    const editorPage = await editorContext.newPage();

    // The submit handler calls window.confirm(). Auto-accept every dialog so
    // the click resolves; failing to register this listener leaves the UI
    // hanging on the modal and the test times out with an unhelpful error.
    editorPage.on("dialog", (dialog) => {
      dialog.accept().catch(() => undefined);
    });

    await editorPage.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
    await waitForEditorReady(editorPage);

    // Sanity: the editor (no pages.publish, no pages.review) should NOT see
    // the Publish or Approve/Reject buttons even on a fresh draft.
    await expect(editorPage.locator('[data-testid="page-status-badge"]')).toHaveText("Draft");
    await expect(editorPage.locator('[data-testid="publish-button"]')).toHaveCount(0);
    await expect(editorPage.locator('[data-testid="approve-review-button"]')).toHaveCount(0);
    await expect(editorPage.locator('[data-testid="reject-review-button"]')).toHaveCount(0);

    const submitButton = editorPage.locator('[data-testid="submit-review-button"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/Submit for Review/i);
    await expect(submitButton).toBeEnabled();

    await submitButton.click();

    // After the API round-trip the badge flips to "Pending Review" and the
    // submit button becomes the disabled "In Review" affordance.
    await expect(editorPage.locator('[data-testid="page-status-badge"]')).toHaveText(
      /Pending Review/i,
      { timeout: 15_000 },
    );
    await expect(submitButton).toContainText(/In Review/i);
    await expect(submitButton).toBeDisabled();

    // ── Phase 2: Hard reload — the bug we want to catch ───────────────────
    // Before the BuilderEditor hydration fix, fetchPage would resolve with
    // status="pending_review" but the local state setter only mapped
    // "published" → "published" (everything else fell through to "draft").
    // After reload the badge would render "Draft" and the Publish button
    // would (incorrectly, for an editor with no perms) try to render.
    await editorPage.reload({ waitUntil: "domcontentloaded" });
    await waitForEditorReady(editorPage);

    await expect(editorPage.locator('[data-testid="page-status-badge"]')).toHaveText(
      /Pending Review/i,
      { timeout: 15_000 },
    );
    await expect(editorPage.locator('[data-testid="submit-review-button"]')).toContainText(
      /In Review/i,
    );
    await expect(editorPage.locator('[data-testid="submit-review-button"]')).toBeDisabled();

    // Editor still must NOT see reviewer or publisher affordances after reload.
    await expect(editorPage.locator('[data-testid="publish-button"]')).toHaveCount(0);
    await expect(editorPage.locator('[data-testid="approve-review-button"]')).toHaveCount(0);
    await expect(editorPage.locator('[data-testid="reject-review-button"]')).toHaveCount(0);

    await editorContext.close();

    // ── Phase 3: Content Manager opens the same page ──────────────────────
    const cmContext = await browser.newContext();
    await setSessionCookie(cmContext, tenant.contentManager.sessionSid, baseURL!);
    const cmPage = await cmContext.newPage();
    cmPage.on("dialog", (dialog) => {
      dialog.accept().catch(() => undefined);
    });

    await cmPage.goto(`/builder/${pageId}`, { waitUntil: "domcontentloaded" });
    await waitForEditorReady(cmPage);

    // Same page, so the badge MUST hydrate to Pending Review here too.
    await expect(cmPage.locator('[data-testid="page-status-badge"]')).toHaveText(
      /Pending Review/i,
      { timeout: 15_000 },
    );

    // Reviewer-only affordances appear.
    await expect(cmPage.locator('[data-testid="approve-review-button"]')).toBeVisible();
    await expect(cmPage.locator('[data-testid="approve-review-button"]')).toContainText(
      /Approve/i,
    );
    await expect(cmPage.locator('[data-testid="reject-review-button"]')).toBeVisible();
    await expect(cmPage.locator('[data-testid="reject-review-button"]')).toContainText(
      /Reject/i,
    );

    // CM has pages.publish, so the publish button is rendered.
    await expect(cmPage.locator('[data-testid="publish-button"]')).toBeVisible();

    // The submit-review affordance is still rendered for non-published pages,
    // but is in its "In Review" disabled state — the CM cannot re-submit.
    const cmSubmitButton = cmPage.locator('[data-testid="submit-review-button"]');
    await expect(cmSubmitButton).toContainText(/In Review/i);
    await expect(cmSubmitButton).toBeDisabled();

    await cmContext.close();
  });
});
