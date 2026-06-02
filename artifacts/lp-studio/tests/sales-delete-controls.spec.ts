// End-to-end coverage for the sales/reviews delete controls (task #738).
//
// Confirms the per-row + bulk delete affordances added across the four sales
// surfaces actually work through the real React app + api-server:
//   1. Accounts  — per-row delete, and bulk delete (incl. the synced-row amber
//      warning copy in BOTH the selection toolbar and the confirm dialog).
//   2. Contacts  — per-row delete, and bulk delete (incl. the synced-row amber
//      warning copy in the confirm dialog).
//   3. Signals   — per-row delete from the activity timeline.
//   4. Reviews   — per-page "delete review links" from the reviews overview.
//
// It also exercises the DELETE /api/sales/signals/:id endpoint directly for the
// two non-happy paths the UI can't reach: tenant scoping (a signal owned by a
// different tenant is 404, never deleted) and a missing id (404).
//
// Why this also caught a real bug: the bulk-delete UI tests would have failed
// outright because DELETE /accounts/bulk and /contacts/bulk were registered
// AFTER /accounts/:id and /contacts/:id, so Express matched "bulk" as an :id
// param (Number("bulk") → NaN → 500). The route order was fixed alongside this
// spec; these tests guard against that regression.

import { test, expect, type BrowserContext, type Page } from "./setup/pw";
import pg from "pg";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for sales-delete-controls.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: RoyalTenant;
// Unique-ish marker so seeded names never collide with other tenants' data.
const TAG = `del${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.beforeAll(async ({ request }) => {
  // The royal-tenant fixture registers tenants against domain="localhost"; if
  // more than one survives a crashed run the api-server host cache resolves
  // nondeterministically. Purge stale royal tenants, then create ours.
  await purgeStaleRoyalTenants(pool);
  tenant = await createRoyalTenant(pool, { uniqueSuffix: TAG });

  // Drop the in-process tenant-by-host cache so our freshly inserted tenant is
  // resolved for host="localhost" without waiting out the TTL.
  await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
});

test.afterEach(async () => {
  // Keep each test's surface deterministic: clear everything we seed. Accounts
  // cascade to their contacts + signals; tenant-only signals and pages (with
  // their reviews) are cleared explicitly.
  if (!tenant) return;
  await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [tenant.tenantId]);
  await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [tenant.tenantId]);
  await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [tenant.tenantId]);
  await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenant.tenantId]);
});

test.afterAll(async () => {
  if (tenant) {
    await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [tenant.tenantId]);
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [tenant.tenantId]);
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [tenant.tenantId]);
    await cleanupRoyalTenant(pool, tenant);
  }
  await pool.end();
});

// ─── Seed helpers ─────────────────────────────────────────────────────────

async function seedAccount(name: string, salesforceId: string | null = null): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, salesforce_id) VALUES ($1, $2, $3) RETURNING id`,
    [tenant.tenantId, name, salesforceId],
  );
  return rows[0].id;
}

async function seedContact(
  accountId: number,
  firstName: string,
  lastName: string,
  salesforceId: string | null = null,
): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, salesforce_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenant.tenantId, accountId, firstName, lastName, salesforceId],
  );
  return rows[0].id;
}

async function seedSignal(opts: {
  tenantId?: number;
  accountId?: number | null;
  type?: string;
  source?: string | null;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sales_signals (tenant_id, account_id, type, source)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [opts.tenantId ?? tenant.tenantId, opts.accountId ?? null, opts.type ?? "page_view", opts.source ?? "Test Source"],
  );
  return rows[0].id;
}

async function seedPage(title: string): Promise<number> {
  const slug = `del-page-${tenant.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode)
     VALUES ($1, $2, $3, '[]'::jsonb, 'draft', 'marketing') RETURNING id`,
    [tenant.tenantId, title, slug],
  );
  return rows[0].id;
}

async function seedReview(pageId: number): Promise<number> {
  const token = `tok-${pageId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO lp_page_reviews (page_id, token, status) VALUES ($1, $2, 'pending') RETURNING id`,
    [pageId, token],
  );
  return rows[0].id;
}

// ─── Browser helpers ──────────────────────────────────────────────────────

async function setSessionCookie(context: BrowserContext, sid: string, baseURL: string): Promise<void> {
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

async function openApp(browser: import("./setup/pw").Browser, baseURL: string, path: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await setSessionCookie(context, tenant.sessionSid, baseURL);
  const page = await context.newPage();
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return { context, page };
}

/** The confirm AlertDialog's primary "Delete" action button. */
function confirmDeleteButton(page: Page) {
  return page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true });
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe("Sales delete controls — end-to-end", () => {
  test("Accounts: per-row delete removes the row and shows a success toast", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const name = `Acct Solo ${TAG}`;
    await seedAccount(name);

    const { context, page } = await openApp(browser, baseURL!, "/sales/accounts");
    const row = page.getByText(name, { exact: true });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await page.getByTitle("Delete account").first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete account?")).toBeVisible();
    await confirmDeleteButton(page).click();

    // exact:true so the success toast is matched, not the new in-app
    // notification aria-live region that also mirrors "Deleted <name>…Undo".
    await expect(page.getByText(`Deleted ${name}`, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    await expect(page.getByText("No accounts yet")).toBeVisible();

    await context.close();
  });

  test("Accounts: bulk delete shows synced-row amber warning and removes the rows", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const synced = `Acct Synced ${TAG}`;
    const csv = `Acct Csv ${TAG}`;
    await seedAccount(synced, `001SF${TAG}`); // salesforce_id present → "synced"
    await seedAccount(csv, null);

    const { context, page } = await openApp(browser, baseURL!, "/sales/accounts");
    await expect(page.getByText(synced, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(csv, { exact: true })).toBeVisible();

    // Select both rows. After each click the row's checkbox flips to "Deselect",
    // so re-query "Select for deletion" each time.
    await page.getByTitle("Select for deletion").first().click();
    await expect(page.getByText("1 account selected")).toBeVisible();
    await page.getByTitle("Select for deletion").first().click();
    await expect(page.getByText("2 accounts selected")).toBeVisible();

    // The selection toolbar warns when any selected account is Salesforce-synced.
    await expect(
      page.getByText("Some selected accounts are synced from Salesforce and may reappear on the next sync."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete 2" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete 2 accounts?")).toBeVisible();
    // The confirm dialog repeats the synced-row warning.
    await expect(
      dialog.getByText("Some selected accounts are synced from Salesforce and may reappear on the next sync."),
    ).toBeVisible();
    await confirmDeleteButton(page).click();

    // exact:true so the success toast is matched, not the new in-app
    // notification aria-live region that also mirrors "Deleted 2 accountsUndo".
    await expect(page.getByText("Deleted 2 accounts", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(synced, { exact: true })).toHaveCount(0);
    await expect(page.getByText(csv, { exact: true })).toHaveCount(0);

    await context.close();
  });

  test("Contacts: per-row delete removes the row and shows a success toast", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const accId = await seedAccount(`Acct ForContact ${TAG}`);
    const first = `Cara${TAG}`;
    const last = `Solo${TAG}`;
    await seedContact(accId, first, last);

    const { context, page } = await openApp(browser, baseURL!, "/sales/contacts");
    const fullName = `${first} ${last}`;
    await expect(page.getByText(fullName, { exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByTitle("Delete contact").first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete contact?")).toBeVisible();
    await confirmDeleteButton(page).click();

    // exact:true so the success toast is matched, not the new in-app
    // notification aria-live region that also mirrors "Deleted <name>…Undo".
    await expect(page.getByText(`Deleted ${fullName}`, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(fullName, { exact: true })).toHaveCount(0);

    await context.close();
  });

  test("Contacts: bulk delete shows synced-row amber warning and removes the rows", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const accId = await seedAccount(`Acct ForBulkContacts ${TAG}`);
    const syncedName = `Sync${TAG}`;
    const csvName = `Csv${TAG}`;
    await seedContact(accId, syncedName, "Synced", `003SF${TAG}`); // salesforce_id → "synced"
    await seedContact(accId, csvName, "Plain", null);

    const { context, page } = await openApp(browser, baseURL!, "/sales/contacts");
    await expect(page.getByText(`${syncedName} Synced`, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(`${csvName} Plain`, { exact: true })).toBeVisible();

    await page.getByTitle("Select for deletion").first().click();
    await expect(page.getByText("1 contact selected")).toBeVisible();
    await page.getByTitle("Select for deletion").first().click();
    await expect(page.getByText("2 contacts selected")).toBeVisible();

    await page.getByRole("button", { name: "Delete 2" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete 2 contacts?")).toBeVisible();
    await expect(
      dialog.getByText("Some selected contacts are synced from Salesforce and may reappear on the next sync."),
    ).toBeVisible();
    await confirmDeleteButton(page).click();

    // exact:true so the success toast is matched, not the new in-app
    // notification aria-live region that also mirrors "Deleted 2 contactsUndo".
    await expect(page.getByText("Deleted 2 contacts", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`${syncedName} Synced`, { exact: true })).toHaveCount(0);
    await expect(page.getByText(`${csvName} Plain`, { exact: true })).toHaveCount(0);

    await context.close();
  });

  test("Signals: per-row delete removes the signal and shows a success toast", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const accId = await seedAccount(`Acct ForSignal ${TAG}`);
    const source = `SignalSrc ${TAG}`;
    await seedSignal({ accountId: accId, type: "page_view", source });

    const { context, page } = await openApp(browser, baseURL!, "/sales/signals");
    await expect(page.getByText(source, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    await page.getByTitle("Delete signal").first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete signal?")).toBeVisible();
    await confirmDeleteButton(page).click();

    await expect(page.getByText("Signal deleted")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(source, { exact: true })).toHaveCount(0);

    await context.close();
  });

  test("Reviews: delete review links removes them and shows a success toast", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const pageTitle = `Review Page ${TAG}`;
    const pageId = await seedPage(pageTitle);
    await seedReview(pageId);
    await seedReview(pageId);

    const { context, page } = await openApp(browser, baseURL!, "/reviews");
    await expect(page.getByText(pageTitle, { exact: true })).toBeVisible({ timeout: 30_000 });

    // The "Delete review links" affordance only renders when the page has reviews.
    await page.getByTitle("Delete review links").first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete 2 review links?")).toBeVisible();
    await confirmDeleteButton(page).click();

    // Toast text is now "Deleted N review links" (undoable-delete style);
    // exact:true avoids matching the notification aria-live mirror.
    await expect(page.getByText("Deleted 2 review links", { exact: true })).toBeVisible({ timeout: 15_000 });
    // Page row remains (only its review links were removed) but the delete
    // affordance is gone now that the page has zero reviews.
    await expect(page.getByText(pageTitle, { exact: true })).toBeVisible();
    await expect(page.getByTitle("Delete review links")).toHaveCount(0);

    await context.close();
  });

  test("DELETE /api/sales/signals/:id is tenant-scoped (404) and 404s for a missing id", async ({ request }) => {
    // sales_signals.tenant_id is a real FK to tenants, so the "other tenant"
    // must actually exist. Spin up a throwaway tenant, seed a signal under it,
    // and confirm our session can't reach it. (API tenant resolution is
    // session-based, so a second localhost tenant doesn't disturb our session.)
    const other = await createRoyalTenant(pool, { uniqueSuffix: `${TAG}b` });
    try {
      const foreignSignalId = await seedSignal({ tenantId: other.tenantId, type: "page_view" });
      const headers = await csrfHeaders(request, tenant.sessionSid);

      const crossTenant = await request.delete(`/api/sales/signals/${foreignSignalId}`, { headers });
      expect(crossTenant.status()).toBe(404);

      // The foreign signal must still exist — tenant scoping fails closed.
      const stillThere = await pool.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM sales_signals WHERE id = $1`,
        [foreignSignalId],
      );
      expect(stillThere.rows[0].c).toBe(1);

      // A missing id is a 404, not a 500.
      const missing = await request.delete(`/api/sales/signals/2000000123`, { headers });
      expect(missing.status()).toBe(404);

      // Sanity: deleting our OWN signal succeeds.
      const ownSignalId = await seedSignal({ type: "page_view" });
      const own = await request.delete(`/api/sales/signals/${ownSignalId}`, { headers });
      expect(own.status()).toBe(200);
    } finally {
      await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [other.tenantId]);
      await cleanupRoyalTenant(pool, other);
    }
  });
});
