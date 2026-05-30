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
// NOTE: a Dandy tenant requires the reserved "dandy"/"dandy-smb" slug, which
// collides with seeded data, so the test infra can only create non-Dandy
// tenants. The positive path (these built-ins remaining fully functional for
// Dandy) is therefore exercised manually / in the real Dandy workspace, not
// here.

import pg from "pg";
import { test, expect } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
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
