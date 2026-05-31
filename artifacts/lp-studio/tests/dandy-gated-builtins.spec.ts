// Dandy-gated built-in one-pager templates (template tooling de-branding +
// dormant beta gating).
//
// Two of the six built-in one-pager templates are Dandy-coded:
//   - "comparison"        — rep-facing label "Dandy Evolution" (Dandy) /
//                           "Before / After" (everyone else)
//   - "agreement-summary" — the Practice Agreement summary
//
// The Dandy gate is currently DORMANT: `DANDY_GATED_BUILTIN_IDS` (in
// lib/one-pager-types/src/constants.ts) is empty, so `isDandyGatedBuiltin(id)`
// returns false for every id. As a result both formerly-gated built-ins are
// available to ALL tenants — the picker UI (admin gallery + sales-rep
// generator), the Template Editor, and the server save/publish routes all show
// / accept them. What still differs by tenant is the *copy*: Dandy-only verbatim
// labels (e.g. "Dandy Evolution") are brand-scrubbed for non-Dandy tenants
// (→ "Before / After" in the generator, "<productName> Evolution" in the editor).
//
// This spec covers BOTH directions of that copy split:
//
//   1. NON-Dandy "Royal" tenant — both formerly-gated built-ins appear in the
//      gallery, generator, and editor with brand-scrubbed labels; the Dandy-only
//      verbatim "Dandy Evolution" label stays absent.
//   2. Dandy workspace — the built-ins appear with their Dandy copy, the
//      Agreement Summary editor populates its defaults, and "Download PDF" fires
//      a download.
//
// The server-side behaviour of the dormant gate (save/publish routes returning
// non-403 for the formerly-gated builtinIds) is locked by the in-process
// integration test (dandyGatedTemplates.integration.test.ts), so it is not
// re-asserted here.
//
// Dandy detection keys off the server-authoritative `brand.isDandy`, resolved
// from the immutable tenant SLUG (isProtectedEnterpriseSlug → "dandy"/"dandy-smb"),
// never the editable `brandName`. So the Dandy path can't be faked by renaming a
// Royal tenant's brand to "Dandy"; it must impersonate the *seeded* Dandy
// workspace via a short-lived admin session (createDandyOperatorSession) and
// delete any rows it writes (see cleanupDandyOnePagerRows) so real Dandy data is
// untouched.

import pg from "pg";
import { test, expect } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  createDandyOperatorSession,
  cleanupDandyOperatorSession,
  cleanupDandyOnePagerRows,
  type RoyalTenant,
  type DandyOperatorSession,
} from "./setup/royal-tenant";
import { newAuthedContext } from "./setup/csrf";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL / DATABASE_URL must be set");
  return url;
}

test.describe("Dandy-gated built-in one-pager templates (non-Dandy tenant)", () => {
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

  test("templates gallery hides the gated built-ins but keeps the neutral ones", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    await page.getByRole("heading", { name: "Built-in Templates" }).waitFor({ timeout: 15000 });

    // The four neutral built-ins remain visible.
    await expect(page.getByText("ROI One-Pager").first()).toBeVisible();
    await expect(page.getByText("90-Day Pilot").first()).toBeVisible();
    await expect(page.getByText("Partner Practices").first()).toBeVisible();

    // The Dandy-gate is now dormant (DANDY_GATED_BUILTIN_IDS is empty), so the
    // two formerly-gated built-ins are available to non-Dandy tenants too, with
    // brand-scrubbed copy. "Agreement Summary" is the agreement card's title;
    // "Before/after comparison" is the comparison card's brand-free description
    // (its label is scrubbed from "Dandy Evolution" to "Before / After").
    await expect(page.getByText("Agreement Summary", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Before/after comparison").first()).toBeVisible();
  });

  test("sales-rep generator shows the formerly-gated built-ins (gate dormant) alongside the neutral ones", async ({ page }) => {
    await page.goto("/sales/one-pager");
    // Wait for the visibility-loaded fade-in (`opacity-0` → `opacity-100`) so
    // the built-in button list is stable before asserting.
    await expect(page.locator(".opacity-100").first()).toBeVisible({ timeout: 10000 });

    // A neutral built-in button is present.
    await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();

    // The gate is dormant, so the formerly-gated buttons now appear for a
    // non-Dandy tenant. The comparison button carries the brand-scrubbed
    // "Before / After" label (NOT the Dandy-only "Dandy Evolution"), and the
    // Agreement Summary button is present.
    await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Before \/ After$/ })).toBeVisible();
    // The Dandy-only verbatim label stays absent for a non-Dandy tenant.
    await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toHaveCount(0);
  });

  test("Template Editor shows the formerly-gated tabs (gate dormant) alongside the neutral ones", async ({ page }) => {
    await page.goto("/sales/one-pager/editor");
    await page.getByRole("heading", { name: "Template Editor" }).waitFor({ timeout: 15000 });

    // A neutral tab is present (the editor falls back to the first visible tab,
    // which is the pilot template, once the non-Dandy brand resolves).
    await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Partner Practices$/ })).toBeVisible();

    // The gate is dormant, so the formerly-gated tabs now render for a non-Dandy
    // tenant: the comparison tab plus the Agreement Summary tab. The editor scrubs
    // the comparison tab's "Dandy Evolution" label via scrubBrand → "<productName>
    // Evolution". The neutral Royal fixture ships no brandName, so productName
    // falls back to "Our Lab" → the tab reads "Our Lab Evolution" (NOT the
    // Dandy-only "Dandy Evolution").
    await expect(page.getByRole("button", { name: /^Our Lab Evolution$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toHaveCount(0);
  });

  // NOTE: the server-side behaviour of the now-dormant gate (the save/publish
  // routes returning non-403 for the formerly-gated builtinIds) is locked by the
  // in-process integration test (dandyGatedTemplates.integration.test.ts), so it
  // is not re-asserted here — this e2e spec focuses on the picker/editor UI.
});

test.describe("Dandy-gated built-in one-pager templates (Dandy workspace)", () => {
  let pool: pg.Pool;
  // Both the picker UI and the server routes gate on the server-authoritative
  // `brand.isDandy` (resolved from the immutable slug), so the positive path
  // must impersonate the *seeded* Dandy workspace ("dandy-smb"/"dandy") via a
  // short-lived admin session — renaming a Royal tenant's brand to "Dandy" no
  // longer unlocks the gated built-ins.
  let operator: DandyOperatorSession;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    operator = await createDandyOperatorSession(pool);
  });

  test.afterAll(async () => {
    if (operator) await cleanupDandyOperatorSession(pool, operator);
    await pool.end();
  });

  test.beforeEach(async ({ context, baseURL }) => {
    const url = new URL("/", baseURL ?? "http://127.0.0.1:4318");
    await context.addCookies([{
      name: "lp_sid",
      value: operator.sid,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    }]);
  });

  test("templates gallery shows the gated built-ins for a Dandy workspace", async ({ page }) => {
    await page.goto("/sales/one-pager-templates");
    await page.getByRole("heading", { name: "Built-in Templates" }).waitFor({ timeout: 15000 });

    // Neutral built-ins are still present.
    await expect(page.getByText("ROI One-Pager").first()).toBeVisible();
    await expect(page.getByText("90-Day Pilot").first()).toBeVisible();

    // The two gated built-ins are now visible. "Dandy Evolution" is the
    // comparison card's label (kept verbatim for Dandy — scrubBrand no-ops);
    // "Agreement Summary" is the agreement card's title.
    await expect(page.getByText("Dandy Evolution").first()).toBeVisible();
    await expect(page.getByText("Agreement Summary", { exact: true }).first()).toBeVisible();
  });

  test("sales-rep generator shows the gated built-ins for a Dandy workspace", async ({ page }) => {
    await page.goto("/sales/one-pager");
    await expect(page.locator(".opacity-100").first()).toBeVisible({ timeout: 10000 });

    // A neutral built-in button is present.
    await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();

    // The two gated built-in buttons appear. For Dandy the comparison button is
    // labelled "Dandy Evolution" (not "Before / After").
    await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toBeVisible();
  });

  test("Template Editor shows the gated built-in tabs for a seeded Dandy workspace", async ({ page }) => {
    // The editor's tab gate keys off the server-authoritative slug-based
    // `brand.isDandy` (NOT brandName) — same as the pickers — so the shared
    // seeded-Dandy operator session (set in beforeEach) unlocks the gated tabs.
    await page.goto("/sales/one-pager/editor");
    await page.getByRole("heading", { name: "Template Editor" }).waitFor({ timeout: 15000 });

    // Neutral tab still present.
    await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();

    // The two gated tabs now appear. For Dandy the comparison tab keeps its
    // verbatim "Dandy Evolution" label (scrubBrand no-ops).
    await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toBeVisible();
  });

  test("Agreement Summary editor populates defaults and Download PDF fires a download", async ({ page }) => {
    // The Download PDF handler best-effort POSTs a pdf-submission row after the
    // download. Stub it so the test never writes a DB row it would have to
    // clean up — we're only asserting the client-side PDF download here.
    await page.route("**/api/sales/pdf-submissions", route =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/sales/one-pager");
    await expect(page.locator(".opacity-100").first()).toBeVisible({ timeout: 10000 });

    // Open the Agreement Summary template.
    await page.getByRole("button", { name: /^Agreement Summary$/ }).click();

    // The editor panel renders and populates its defaults. The Reset button is
    // disabled until the saved-layout load resolves (agreementLoaded), so
    // waiting for it to enable proves the defaults are seeded.
    await expect(page.getByRole("heading", { name: "Edit Agreement Details" })).toBeVisible();
    // The Headline <label> isn't associated with its <input> (no htmlFor), so
    // target the input by adjacent-sibling selector instead of accessible name.
    const headline = page.locator('label:text-is("Headline") + input');
    await expect(headline).toHaveValue("Summary of Dandy Agreement");
    // The Reset button (title="Reset to default text") is disabled until the
    // saved-layout load resolves; its enabling proves defaults are seeded.
    await expect(page.locator('button[title="Reset to default text"]')).toBeEnabled({ timeout: 10000 });

    // Agreement Summary needs no DSO name — Download PDF is enabled immediately.
    const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
    await page.getByRole("button", { name: /Download PDF/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Summary_of_Dandy_Agreement.pdf");
  });

  test("server save/publish routes accept the gated built-ins for a Dandy tenant", async ({ baseURL }) => {
    // Reuse the shared seeded-Dandy operator session (slug-based gate). Track
    // every row written through the gated routes and delete them in finally so
    // the real Dandy workspace is left exactly as we found it.
    const createdTemplateIds: number[] = [];
    const createdPageIds: number[] = [];
    const api = await newAuthedContext({
      baseURL: baseURL ?? "http://127.0.0.1:4318",
      sid: operator.sid,
    });
    try {
      // The custom-template save route accepts an explicit gated builtinId for
      // a Dandy tenant (no 403; created → 201).
      for (const builtinId of ["comparison", "agreement-summary"]) {
        const res = await api.post("/api/sales/one-pager-templates", {
          data: { name: `__e2e_dandy_gate_probe__ ${builtinId}`, orientation: "portrait", fields: [], builtinId },
        });
        expect(res.status(), `POST one-pager-templates builtinId=${builtinId} must be accepted for Dandy`).toBe(201);
        const body = await res.json();
        if (typeof body?.id === "number") createdTemplateIds.push(body.id);
      }

      // The web-one-pager publish route accepts a gated `template` id for a
      // Dandy tenant (no 403; published → 200 with a pageId).
      const web = await api.post("/api/sales/web-one-pager", {
        data: { dsoName: "__e2e_dandy_gate_probe__", tenantId: operator.tenantId, template: "comparison" },
      });
      expect(web.status(), "POST web-one-pager template=comparison must be accepted for Dandy").toBe(200);
      const webBody = await web.json();
      if (typeof webBody?.pageId === "number") createdPageIds.push(webBody.pageId);
    } finally {
      await api.dispose();
      await cleanupDandyOnePagerRows(pool, operator.tenantId, {
        templateIds: createdTemplateIds,
        pageIds: createdPageIds,
      });
    }
  });
});
