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

  test("Template Editor exposes an Agreement Summary tab with editable headline / subheadline / sections", async ({ page }) => {
    await page.goto("/sales/one-pager/editor");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "/tmp/agreement-editor-tab-debug.png", fullPage: true });
    // eslint-disable-next-line no-console
    console.log("[debug] URL:", page.url());
    const bodyText = await page.locator("body").innerText().catch(() => "");
    // eslint-disable-next-line no-console
    console.log("[debug] body 800:", bodyText.slice(0, 800));

    // The template selector renders one button per template; the Agreement
    // Summary tab is what we're verifying exists.
    const tab = page.getByRole("button", { name: /^Agreement Summary$/i });
    await expect(tab).toBeVisible({ timeout: 15000 });
    await tab.click();

    // Headline + subheadline fields should be populated from defaults.
    // Controlled React textareas don't expose `value` via innerText, so locate
    // them by their placeholder (which uniquely identifies each field) and
    // assert on the live `value` property via toHaveValue().
    const headlineField = page.locator('textarea[placeholder="Summary of Dandy Agreement"]');
    await expect(headlineField).toBeVisible();
    await expect(headlineField).toHaveValue("Summary of Dandy Agreement");
    const subheadlineField = page.locator('textarea[placeholder*="month-to-month" i]');
    await expect(subheadlineField).toBeVisible();
    await expect(subheadlineField).toHaveValue(/month-to-month/i);

    // Section labels (8 default rows) should be present as text input values.
    for (const label of ["Equipment", "Minimum", "Activation Fee", "No Exit Fee", "Billing", "Training", "Warranty", "Exclusivity"]) {
      await expect(page.locator(`input[type="text"][value="${label}"]`)).toHaveCount(1);
    }

    // Edit the headline and confirm it round-trips into the field.
    await headlineField.fill("Custom Editor Headline");
    await expect(headlineField).toHaveValue("Custom Editor Headline");

    // Reset Defaults restores the original headline.
    await page.getByRole("button", { name: /Reset Defaults/i }).click();
    await expect(headlineField).toHaveValue("Summary of Dandy Agreement");

    // Capture a screenshot for visual review.
    await page.screenshot({ path: "/tmp/agreement-editor-tab.png", fullPage: true });
  });

  test("Hiding the built-in via the templates gallery hides it from editor + generator", async ({ page }) => {
    // The toggle is a button with a title attribute that reads either
    // "Hide from sales reps" (when currently visible) or "Show to sales reps"
    // (when currently hidden). We always restore visibility in `finally` so a
    // mid-test failure can't leak a "hidden" state into later tests.
    try {
      // 1. Toggle visibility OFF via the visibility switch on the card.
      await page.goto("/sales/one-pager-templates");
      const titleP = page.locator("p", { hasText: /^Agreement Summary$/ }).first();
      await expect(titleP).toBeVisible({ timeout: 15000 });
      const card = titleP.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
      // Wait for the visibility-write PUT before navigating away so the API
      // has committed the change.
      const hideResp = page.waitForResponse(
        r => r.url().includes("/sales/layout-defaults/template_visibility") && r.request().method() === "PUT",
        { timeout: 5000 },
      );
      await card.locator('button[title="Hide from sales reps"]').click();
      await hideResp;

      // 2. The Agreement Summary tab should no longer appear in the editor.
      await page.goto("/sales/one-pager/editor");
      await expect(page.getByRole("heading", { name: "Template Editor" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: /^Agreement Summary$/i })).toHaveCount(0);

      // 3. The Agreement Summary template button should also be gone from the
      //    sales rep generator page. Wait for the visibility-loaded fade-in
      //    (`opacity-0` → `opacity-100` transition controlled by
      //    `visibilityLoaded` state) so the button list is stable.
      await page.goto("/sales/one-pager");
      await expect(page.locator(".opacity-100").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toHaveCount(0);
    } finally {
      // Always restore visibility so other tests are isolated, even when an
      // assertion above fails. If the gallery never reached a hidden state
      // (e.g. the first PUT failed) the toggle will already read
      // "Hide from sales reps" and there is nothing to restore — guard with
      // a count check so cleanup never throws.
      await page.goto("/sales/one-pager-templates");
      const titleP2 = page.locator("p", { hasText: /^Agreement Summary$/ }).first();
      await expect(titleP2).toBeVisible({ timeout: 15000 });
      const card2 = titleP2.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
      const showBtn = card2.locator('button[title="Show to sales reps"]');
      if (await showBtn.count()) {
        const showResp = page.waitForResponse(
          r => r.url().includes("/sales/layout-defaults/template_visibility") && r.request().method() === "PUT",
          { timeout: 5000 },
        );
        await showBtn.click();
        await showResp;
      }
    }
  });

  test("Editor exposes font-size sliders and footer contact fields", async ({ page }) => {
    await page.goto("/sales/one-pager/editor");
    await expect(page.getByRole("heading", { name: "Template Editor" })).toBeVisible({ timeout: 15000 });
    // Switch to the Agreement Summary tab.
    await page.getByRole("button", { name: /^Agreement Summary$/i }).click();

    // Header section exposes Headline + Subheadline font-size sliders.
    await expect(page.getByText("Headline Font Size", { exact: true })).toBeVisible();
    await expect(page.getByText("Subheadline Font Size", { exact: true })).toBeVisible();

    // Sections section exposes Label + Body font-size sliders.
    await expect(page.getByText("Section Label Font Size", { exact: true })).toBeVisible();
    await expect(page.getByText("Section Body Font Size", { exact: true })).toBeVisible();

    // Footer section is collapsed by default — expand it before asserting.
    await page.getByRole("button", { name: /^Footer$/ }).click();
    await expect(page.getByText("Footer Font Size", { exact: true })).toBeVisible();
    await expect(page.getByText(/Contact Info \(phone \/ email\)/i)).toBeVisible();

    // The contact list starts empty; "Add contact" inserts a row with all three
    // inputs (label / phone / email).
    const addBtn = page.getByRole("button", { name: /^\+ Add contact$/ });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const labelInput = page.getByPlaceholder(/^Label \(e\.g\. Sales\)$/).first();
    const phoneInput = page.getByPlaceholder(/^Phone \(e\.g\./).first();
    const emailInput = page.getByPlaceholder(/^Email \(e\.g\./).first();
    await expect(labelInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(emailInput).toBeVisible();

    // Round-trip a value to confirm the inputs are wired to state.
    await phoneInput.fill("+1 555 123 4567");
    await emailInput.fill("sales@meetdandy.com");
    await expect(phoneInput).toHaveValue("+1 555 123 4567");
    await expect(emailInput).toHaveValue("sales@meetdandy.com");
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
