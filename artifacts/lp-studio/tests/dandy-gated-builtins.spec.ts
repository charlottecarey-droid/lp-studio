// Dandy-gated built-in one-pager templates (template tooling de-branding +
// beta gating).
//
// Two of the six built-in one-pager templates are Dandy-coded and are gated to
// Dandy / dandy-smb workspaces only:
//   - "comparison"        — rep-facing label "Dandy Evolution" / "Before / After"
//   - "agreement-summary" — the Dandy Practice Agreement summary
//
// This spec runs as a NON-Dandy "Royal" tenant and verifies the two gated
// built-ins are hidden from the picker UI (the admin templates gallery and the
// sales-rep generator) AND rejected (403) by the server publish/save routes,
// while the four neutral built-ins (ROI, 90-Day Pilot, Partner Practices,
// Partner 2) remain available.
//
// This spec covers BOTH gating directions:
//
//   1. NON-Dandy "Royal" tenant — the gated built-ins are hidden from the
//      picker UI and rejected (403) by the publish/save routes (negative path).
//   2. Dandy workspace — the gated built-ins appear in both pickers, the
//      Agreement Summary editor populates its defaults, "Download PDF" fires a
//      download, and the publish/save routes accept the gated ids (positive
//      path).
//
// The two gates use DIFFERENT signals, which is what makes positive-path
// coverage possible without minting a new reserved-slug tenant:
//   - The picker UI keys off `brand.brandName === "dandy"`, so a Royal-style
//     fixture created with `brandName: "Dandy"` is treated as Dandy by the
//     client (no reserved slug needed).
//   - The server publish/save routes key off the tenant SLUG
//     (isProtectedEnterpriseSlug → "dandy"/"dandy-smb"), so that leg
//     impersonates the *seeded* Dandy workspace via a short-lived admin
//     session and deletes any rows it writes (see createDandyOperatorSession /
//     cleanupDandyOnePagerRows) so real Dandy data is left untouched.

import pg from "pg";
import { test, expect } from "@playwright/test";
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

    // The two gated built-ins are absent. "Agreement Summary" is the agreement
    // card's title; "Before/after comparison" is the comparison card's
    // (brand-free) description — a stable handle even though its label is
    // brand-scrubbed away from "Dandy Evolution".
    await expect(page.getByText("Agreement Summary", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Before/after comparison")).toHaveCount(0);
  });

  test("sales-rep generator hides the gated built-ins but keeps the neutral ones", async ({ page }) => {
    await page.goto("/sales/one-pager");
    // Wait for the visibility-loaded fade-in (`opacity-0` → `opacity-100`) so
    // the built-in button list is stable before asserting.
    await expect(page.locator(".opacity-100").first()).toBeVisible({ timeout: 10000 });

    // A neutral built-in button is present.
    await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();

    // The gated built-in buttons are absent. The comparison button label is
    // "Dandy Evolution" for Dandy and "Before / After" for everyone else —
    // assert both spellings are gone.
    await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Before \/ After$/ })).toHaveCount(0);
  });

  test("Template Editor hides the gated built-in tabs but keeps the neutral ones", async ({ page }) => {
    await page.goto("/sales/one-pager/editor");
    await page.getByRole("heading", { name: "Template Editor" }).waitFor({ timeout: 15000 });

    // A neutral tab is present (the editor falls back to the first visible tab,
    // which is the pilot template, once the non-Dandy brand resolves).
    await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Partner Practices$/ })).toBeVisible();

    // The two gated tabs are absent. The comparison tab is hidden entirely for
    // non-Dandy tenants, so NEITHER its Dandy label ("Dandy Evolution") NOR its
    // brand-scrubbed label ("Before / After") should render — assert both, plus
    // the Agreement Summary tab, are gone.
    await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Before \/ After$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toHaveCount(0);
  });

  test("server save/publish routes reject the gated built-ins (403) for a non-Dandy tenant", async ({ baseURL }) => {
    const api = await newAuthedContext({
      baseURL: baseURL ?? "http://127.0.0.1:4318",
      sid: tenant.sessionSid,
    });
    try {
      // Custom-template save route gates an explicit gated builtinId.
      for (const builtinId of ["comparison", "agreement-summary"]) {
        const res = await api.post("/api/sales/one-pager-templates", {
          data: { name: `Gated ${builtinId}`, orientation: "portrait", fields: [], builtinId },
        });
        expect(res.status(), `POST one-pager-templates builtinId=${builtinId} must be gated`).toBe(403);
      }

      // Control: a non-gated builtinId is NOT rejected by the gate (it passes
      // the gate and is handled normally — proving the 403s above are the
      // Dandy gate, not a blanket permission denial for this tenant).
      const ungated = await api.post("/api/sales/one-pager-templates", {
        data: { name: "Neutral ROI", orientation: "portrait", fields: [], builtinId: "roi" },
      });
      expect(ungated.status(), "POST one-pager-templates builtinId=roi must NOT be gated").not.toBe(403);

      // The web-one-pager publish route gates a gated `template` id too. The
      // handler requires dsoName + tenantId before reaching the gate.
      const web = await api.post("/api/sales/web-one-pager", {
        data: { dsoName: "Royal Test", tenantId: tenant.tenantId, template: "comparison" },
      });
      expect(web.status(), "POST web-one-pager template=comparison must be gated").toBe(403);
    } finally {
      await api.dispose();
    }
  });
});

test.describe("Dandy-gated built-in one-pager templates (Dandy workspace)", () => {
  let pool: pg.Pool;
  // A Royal-style fixture flagged Dandy via brandName (drives the client-side
  // picker gate). Its slug is still a non-reserved royal-test-* slug — that's
  // fine because the picker gate is brandName-based, not slug-based.
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, { brandName: "Dandy" });
  });

  test.afterAll(async () => {
    if (tenant) await cleanupRoyalTenant(pool, tenant);
    await pool.end();
  });

  test.beforeEach(async ({ context, baseURL }) => {
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

  test("Template Editor shows the gated built-in tabs for a seeded Dandy workspace", async ({ page, context, baseURL }) => {
    // The editor's tab gate keys off the server-authoritative slug-based
    // `brand.isDandy` (NOT brandName), so the royal-brandName fixture used by
    // this describe won't unlock the gated tabs. Impersonate the seeded Dandy
    // workspace via a short-lived admin session and override the cookie set in
    // beforeEach. Read-only — no rows written, so only the session is cleaned up.
    const operator: DandyOperatorSession = await createDandyOperatorSession(pool);
    try {
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

      await page.goto("/sales/one-pager/editor");
      await page.getByRole("heading", { name: "Template Editor" }).waitFor({ timeout: 15000 });

      // Neutral tab still present.
      await expect(page.getByRole("button", { name: /^90-Day Pilot$/ })).toBeVisible();

      // The two gated tabs now appear. For Dandy the comparison tab keeps its
      // verbatim "Dandy Evolution" label (scrubBrand no-ops).
      await expect(page.getByRole("button", { name: /^Dandy Evolution$/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Agreement Summary$/ })).toBeVisible();
    } finally {
      await cleanupDandyOperatorSession(pool, operator);
    }
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
    // Impersonate the seeded Dandy workspace (slug-based gate). Track every row
    // written through the gated routes and delete them in finally so the real
    // Dandy workspace is left exactly as we found it.
    const operator: DandyOperatorSession = await createDandyOperatorSession(pool);
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
      await cleanupDandyOperatorSession(pool, operator);
    }
  });
});
