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
  // The TemplateCard renders title + description, then a ChevronDown button
  // that opens a popover containing the "Generate PDF" menu item.
  const card = page
    .locator("div")
    .filter({ has: page.locator("p", { hasText: "Agreement Summary" }) })
    .filter({ has: page.locator("p", { hasText: "Summary of Dandy Agreement terms" }) })
    .first();
  await expect(card).toBeVisible({ timeout: 15000 });

  // The ChevronDown menu trigger is the only <button> in the card footer
  // beyond the visibility toggle. Use a robust locator: open the menu by
  // hovering then clicking the chevron icon button.
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

  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: "lp_sid",
      value: tenant.sessionSid,
      url: "http://localhost:5000",
    }]);
  });

  test("Agreement Summary card appears in the templates gallery", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    await expect(page.getByText("Agreement Summary").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Summary of Dandy Agreement terms")).toBeVisible();
  });

  test("Generate PDF dialog opens with editable defaults and supports reset", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    await openAgreementGenerateDialog(page);

    // Headline default round-trips.
    const dialog = page.locator("div", { hasText: "Generate Agreement Summary PDF" }).last();
    const headlineInput = dialog.locator("input[type=\"text\"]").first();
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
  });
});
