// End-to-end coverage for the no-email "Generate links only" campaign flow
// (task #814).
//
// Drives the real Quick Campaign wizard inside the React app + api-server as a
// Royal-style tenant and verifies the full links-only path that the in-process
// integration test (api-server linkExport.integration.test.ts) can only assert
// at the route layer:
//
//   1. Step 1: pick "Generate links only", name the campaign, choose a
//      PUBLISHED landing page (the wizard hides drafts, and links mode makes
//      the page required — Next stays disabled until one is chosen).
//   2. Step 2: select the seeded active+emailed contacts.
//   3. Step 3 is skipped (links mode jumps straight to the export panel).
//   4. Step "Links & Export": one personalized /p/<token> link row per contact
//      renders with a working Copy button (clipboard receives the exact link).
//   5. The export destinations are rendered from the server registry — CSV
//      (always configured), Google Sheet + Marketo (present, unconfigured) —
//      not hardcoded buttons. Clicking the CSV "Download" triggers a real file
//      download.
//   6. The email delivery path is unchanged: switching to "Send email" shows
//      the 4-step flow (incl. the Email content step links mode omits) and
//      advances all the way to "Preview & Send" with a live preview + Send now.

import { test, expect, type Browser, type BrowserContext, type Page } from "./setup/pw";
import pg from "pg";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for link-export-campaign.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: RoyalTenant;
// Unique-ish marker so seeded names never collide with other tenants' data.
const TAG = `lx${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// Campaign drafts/previews mint sales_* rows whose FKs reference the tenant;
// they must be cleared before the tenant row can be deleted.
async function clearSalesRows(tenantId: number): Promise<void> {
  await pool.query(`DELETE FROM sales_email_campaigns WHERE tenant_id = $1`, [tenantId]);
  await pool.query(`DELETE FROM sales_email_templates WHERE tenant_id = $1`, [tenantId]);
  await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [tenantId]);
  await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [tenantId]);
  await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [tenantId]);
}

test.beforeAll(async ({ request }) => {
  // The royal-tenant fixture registers tenants against domain="localhost"; if
  // more than one survives a crashed run the api-server host cache resolves
  // nondeterministically. purgeStaleRoyalTenants doesn't know about the sales_*
  // FKs a campaign run leaves behind, so clear those first for every leftover
  // royal tenant — otherwise the orphan's sales_email_templates FK blocks the
  // purge and poisons every later run.
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM tenants WHERE slug LIKE 'royal-test-%'`,
  );
  for (const r of rows) await clearSalesRows(r.id);
  await purgeStaleRoyalTenants(pool);
  tenant = await createRoyalTenant(pool, { uniqueSuffix: TAG });

  // Drop the in-process tenant-by-host cache so our freshly inserted tenant is
  // resolved for host="localhost" without waiting out the TTL.
  await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
});

test.afterEach(async () => {
  // Keep each test's surface deterministic: clear everything we seed plus any
  // campaign rows the email-path draft/preview minted (their FKs would block
  // the tenant teardown in afterAll).
  if (!tenant) return;
  await clearSalesRows(tenant.tenantId);
  await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenant.tenantId]);
  await pool.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [tenant.tenantId]);
});

test.afterAll(async () => {
  if (tenant) {
    await clearSalesRows(tenant.tenantId);
    await cleanupRoyalTenant(pool, tenant);
  }
  await pool.end();
});

// ─── Seed helpers ─────────────────────────────────────────────────────────

async function seedAccount(name: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenant.tenantId, name],
  );
  return rows[0].id;
}

async function seedContact(
  accountId: number,
  firstName: string,
  lastName: string,
  email: string,
): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
    [tenant.tenantId, accountId, firstName, lastName, email],
  );
  return rows[0].id;
}

async function seedPublishedPage(title: string): Promise<number> {
  const slug = `lx-page-${tenant.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode)
     VALUES ($1, $2, $3, '[]'::jsonb, 'published', 'sales') RETURNING id`,
    [tenant.tenantId, title, slug],
  );
  return rows[0].id;
}

// Seed an enabled Marketo integration so the "Push to Marketo static list"
// destination resolves as CONNECTED (isConfigured() only checks these three
// config fields exist). The api-server webServer config sets MARKETO_FAKE_MODE=1,
// so the real REST sync is bypassed — these credentials are dummies that never
// leave the process. Cleared in afterEach via the lp_integrations teardown.
async function seedMarketoIntegration(): Promise<void> {
  await pool.query(
    `INSERT INTO lp_integrations (tenant_id, provider, config, enabled, updated_at)
     VALUES ($1, 'marketo', $2::jsonb, true, now())
     ON CONFLICT (tenant_id, provider) DO UPDATE SET config = EXCLUDED.config, enabled = true`,
    [
      tenant.tenantId,
      JSON.stringify({ munchkinId: "123-ABC-456", clientId: "fake-client", clientSecret: "fake-secret" }),
    ],
  );
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

async function openApp(
  browser: Browser,
  baseURL: string,
  path: string,
  opts: { clipboard?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  // The copy-to-clipboard assertion needs read+write clipboard permission;
  // Chromium denies clipboard access in a fresh context otherwise.
  const context = await browser.newContext(
    opts.clipboard ? { permissions: ["clipboard-read", "clipboard-write"] } : undefined,
  );
  await setSessionCookie(context, tenant.sessionSid, baseURL);
  const page = await context.newPage();
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return { context, page };
}

/** Open the Quick Campaign wizard from the Personalized Pages screen. */
async function openWizard(page: Page) {
  await page.getByRole("button", { name: "New Campaign", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "New Campaign" })).toBeVisible({ timeout: 15_000 });
  return dialog;
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe("Quick Campaign — generate links only", () => {
  test("builds personalized links, copies them, renders registry destinations, and downloads CSV", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const accId = await seedAccount(`Acme ${TAG}`);
    const c1First = `Ada${TAG}`;
    const c2First = `Alan${TAG}`;
    await seedContact(accId, c1First, "Lovelace", `ada-${TAG}@acme.test`);
    await seedContact(accId, c2First, "Turing", `alan-${TAG}@acme.test`);
    const pageTitle = `Promo Page ${TAG}`;
    await seedPublishedPage(pageTitle);

    const { context, page } = await openApp(browser, baseURL!, "/sales/campaign-pages", { clipboard: true });
    const dialog = await openWizard(page);

    // ── Step 1: links mode + name + published page ──
    await dialog.getByRole("button", { name: /Generate links only/ }).click();
    await dialog.getByPlaceholder("e.g. Q2 DSO outreach").fill(`Links Run ${TAG}`);

    // Next is gated until a published page is chosen in links mode.
    const next = dialog.getByRole("button", { name: "Next" });
    await expect(next).toBeDisabled();

    // The page picker only offers PUBLISHED pages — select ours by title. The
    // landing-page <select> is the only one whose option text includes the page
    // title (the sibling account filter lists account names), so hasText
    // disambiguates it from the account-filter select.
    const pageSelect = dialog.locator("select").filter({ hasText: pageTitle });
    await expect(pageSelect).toHaveCount(1, { timeout: 30_000 });
    await pageSelect.selectOption({ label: pageTitle });
    await expect(next).toBeEnabled();
    await next.click();

    // ── Step 2: recipients ──
    await expect(dialog.getByText(`${c1First} Lovelace`, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText(`${c2First} Turing`, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Select all visible" }).click();
    await expect(dialog.getByText("2", { exact: true }).first()).toBeVisible();
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Step "Links & Export": one /p/<token> row per contact ──
    await expect(dialog.getByText(/2\s+personalized links for/)).toBeVisible({ timeout: 30_000 });
    const linkRowText = dialog.locator("span.font-mono");
    await expect(linkRowText.first()).toContainText("/p/");
    await expect(linkRowText).toHaveCount(2);
    const firstLink = (await linkRowText.first().textContent())?.trim() ?? "";
    expect(firstLink).toMatch(/\/p\/[A-Za-z0-9_-]+$/);

    // Copy the first link → clipboard receives the exact URL and the button
    // flips to "Copied".
    const copyButtons = dialog.getByRole("button", { name: "Copy" });
    await copyButtons.first().click();
    await expect(dialog.getByRole("button", { name: "Copied" }).first()).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(firstLink);

    // ── Destinations come from the server registry, not hardcoded buttons ──
    await expect(dialog.getByText("Download CSV", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Send to Google Sheet", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Push to Marketo static list", { exact: true })).toBeVisible();
    // Unconfigured destinations are surfaced but disabled, with a "set it up" hint.
    await expect(dialog.getByText(/Not connected — set it up in/).first()).toBeVisible();

    // ── CSV download (the only file-type, always-configured destination) ──
    const downloadBtn = dialog.getByRole("button", { name: "Download", exact: true });
    await expect(downloadBtn).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);

    await context.close();
  });

  test("email delivery path is unchanged: full 4-step flow reaches Preview & Send", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const accId = await seedAccount(`Mail Co ${TAG}`);
    const first = `Grace${TAG}`;
    await seedContact(accId, first, "Hopper", `grace-${TAG}@mail.test`);
    const pageTitle = `Mail Page ${TAG}`;
    await seedPublishedPage(pageTitle);

    const { context, page } = await openApp(browser, baseURL!, "/sales/campaign-pages");
    const dialog = await openWizard(page);

    // ── Step 1: default "Send email" mode shows the 4-step stepper, incl. the
    //    Email content step that links mode omits. Page is OPTIONAL here. ──
    await expect(dialog.getByText("Email", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Preview & Send", { exact: true })).toBeVisible();
    await dialog.getByPlaceholder("e.g. Q2 DSO outreach").fill(`Email Run ${TAG}`);
    // No page selected — email mode still advances (link is optional).
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Step 2: recipients ──
    await expect(dialog.getByText(`${first} Hopper`, { exact: true })).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole("button", { name: "Select all visible" }).click();
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Step 3: Email content (the step links mode skips entirely) ──
    await expect(dialog.getByRole("button", { name: "Styled email" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Plain text" })).toBeVisible();
    await dialog.getByRole("button", { name: "Plain text" }).click();
    await dialog.getByPlaceholder(/Quick idea for/).fill(`Hi from ${TAG}`);
    await dialog.locator("textarea").first().fill("Hello {{first_name}}, take a look.");
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Step 4: Preview & Send renders a live preview + the send action ──
    await expect(dialog.getByText("Previewing as")).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText("Send now (1)")).toBeVisible();

    await context.close();
  });

  test("a CONNECTED Marketo destination enables Send → pushes links → success toast", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    // Mark Marketo as connected for this workspace; the real REST sync is stubbed
    // server-side via MARKETO_FAKE_MODE=1 (set in playwright.config.ts).
    await seedMarketoIntegration();

    const accId = await seedAccount(`Mkto Co ${TAG}`);
    const c1First = `Ada${TAG}`;
    const c2First = `Alan${TAG}`;
    await seedContact(accId, c1First, "Lovelace", `ada-mkto-${TAG}@acme.test`);
    await seedContact(accId, c2First, "Turing", `alan-mkto-${TAG}@acme.test`);
    const pageTitle = `Mkto Page ${TAG}`;
    await seedPublishedPage(pageTitle);

    const { context, page } = await openApp(browser, baseURL!, "/sales/campaign-pages");
    const dialog = await openWizard(page);

    // ── Step 1: links mode + name + published page ──
    await dialog.getByRole("button", { name: /Generate links only/ }).click();
    await dialog.getByPlaceholder("e.g. Q2 DSO outreach").fill(`Mkto Run ${TAG}`);
    const pageSelect = dialog.locator("select").filter({ hasText: pageTitle });
    await expect(pageSelect).toHaveCount(1, { timeout: 30_000 });
    await pageSelect.selectOption({ label: pageTitle });
    const next = dialog.getByRole("button", { name: "Next" });
    await expect(next).toBeEnabled();
    await next.click();

    // ── Step 2: recipients ──
    await expect(dialog.getByText(`${c1First} Lovelace`, { exact: true })).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole("button", { name: "Select all visible" }).click();
    await dialog.getByRole("button", { name: "Next" }).click();

    // ── Step "Links & Export": wait for both links to build ──
    await expect(dialog.getByText(/2\s+personalized links for/)).toBeVisible({ timeout: 30_000 });

    // The Marketo destination card is CONNECTED — no "Not connected" warning,
    // and it exposes its two required option inputs.
    const marketoCard = dialog
      .locator("div.rounded-lg")
      .filter({ hasText: "Push to Marketo static list" });
    await expect(marketoCard).toHaveCount(1);
    await expect(marketoCard.getByText(/Not connected — set it up in/)).toHaveCount(0);

    // Fill the required options (list id + REST field name) the wizard collects.
    await marketoCard.getByPlaceholder("e.g. 1042").fill("1042");
    await marketoCard.getByPlaceholder("e.g. lpMicrositeUrl").fill("lpMicrositeUrl");

    // Send is enabled for a connected destination once links are built.
    const sendBtn = marketoCard.getByRole("button", { name: "Send" });
    await expect(sendBtn).toBeEnabled();

    // Click Send → POST /api/sales/link-export/marketo returns 200 and the
    // success toast surfaces the synthetic sync result.
    const [resp] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes("/api/sales/link-export/marketo") && r.request().method() === "POST",
      ),
      sendBtn.click(),
    ]);
    expect(resp.status()).toBe(200);

    // The toast renders at the page root (outside the dialog). Its description
    // is the server's success message echoing the contact count + list id.
    await expect(
      page.getByText(/Synced 2 contacts to Marketo and added 2 to list 1042/),
    ).toBeVisible({ timeout: 15_000 });

    await context.close();
  });
});
