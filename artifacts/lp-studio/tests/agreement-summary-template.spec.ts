// Agreement Summary built-in one-pager template — verifies the new template
// shows up in the templates gallery, its "Generate PDF" dialog renders the
// editable headline / subheadline / 8 sections / footer fields pre-populated
// from the Dandy Practice Agreement defaults, edits round-trip, and the
// resulting PDF download fires.

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
  if (!url) throw new Error("NEON_DATABASE_URL / DATABASE_URL must be set");
  return url;
}

// Open the kebab menu on the Agreement Summary card and click "Generate PDF".
async function openAgreementGenerateDialog(page: import("@playwright/test").Page) {
  // The TemplateCard wraps everything in a `rounded-xl border bg-card`
  // container. Pick the one whose footer paragraph reads "Agreement Summary".
  const titleP = page.locator("p", { hasText: /^Agreement Summary$/ }).first();
  await expect(titleP).toBeVisible({ timeout: 15000 });
  const card = titleP.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(card).toBeVisible();

  // Open the kebab — it's the last button on the card (visibility toggle + chevron).
  await card.locator("button").last().click();
  await page.getByRole("button", { name: /^Generate PDF$/i }).click();
  await expect(page.getByText("Generate Agreement Summary PDF")).toBeVisible({ timeout: 5000 });
}

test.describe("Agreement Summary one-pager template", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
  });

  test.afterAll(async () => {
    if (tenant) await cleanupRoyalTenant(pool, tenant);
    await pool.end();
  });

  test.beforeEach(async ({ context, baseURL }) => {
    // Anchor the cookie to whatever host Playwright's baseURL resolves to so
    // page navigations actually send it (Playwright is strict about
    // localhost vs 127.0.0.1 — they are different cookie domains).
    const url = new URL("/", baseURL ?? "http://127.0.0.1:4318");
    await context.addCookies([{
      name: "lp_sid",
      value: tenant.sessionSid,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    }]);
  });

  test("Agreement Summary card appears in the templates gallery", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    // Debug: screenshot + dump body innerText if the card never shows up.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "/tmp/templates-page.png", fullPage: true });
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (!bodyText.includes("Agreement Summary")) {
      // eslint-disable-next-line no-console
      console.log("[debug] URL:", page.url());
      // eslint-disable-next-line no-console
      console.log("[debug] body 1000 chars:", bodyText.slice(0, 1000));
    }
    await expect(page.getByText("Agreement Summary").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Summary of Dandy Agreement terms")).toBeVisible();
  });

  test("Generate PDF dialog opens with editable defaults and supports reset", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    await openAgreementGenerateDialog(page);

    // Scope to the dialog card via the h3 → its `rounded-2xl` ancestor (the
    // card container that holds the inputs as well as the heading).
    const heading = page.getByRole("heading", { name: "Generate Agreement Summary PDF" });
    await expect(heading).toBeVisible();
    const dialog = heading.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await expect(dialog).toBeVisible();

    // Headline default round-trips.
    const headlineInput = dialog.locator('input[type="text"]').first();
    await expect(headlineInput).toHaveValue("Summary of Dandy Agreement");

    // All 8 section labels visible as input values.
    for (const label of ["Equipment", "Minimum", "Activation Fee", "No Exit Fee", "Billing", "Training", "Warranty", "Exclusivity"]) {
      await expect(dialog.locator(`input[type="text"][value="${label}"]`)).toHaveCount(1);
    }

    // Footer default mentions the Dandy Practice Agreement.
    const footerArea = dialog.locator("textarea").last();
    await expect(footerArea).toHaveValue(/Dandy Practice Agreement/);

    // Edit the headline; reset restores defaults.
    await headlineInput.fill("Custom Agreement Headline");
    await expect(headlineInput).toHaveValue("Custom Agreement Headline");
    await dialog.getByRole("button", { name: /Reset/i }).click();
    await expect(headlineInput).toHaveValue("Summary of Dandy Agreement");
  });

  test("Download PDF triggers a file download", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    await openAgreementGenerateDialog(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
    await page.getByRole("button", { name: /^Download PDF$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/_OnePager\.pdf$/);
    // Save a copy outside test-results so it survives retries / cleanup —
    // useful for visual review while iterating on the template.
    await download.saveAs("/tmp/agreement-out.pdf");
  });
});
