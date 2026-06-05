// Marketo two-way-sync settings UI contract (task #951).
//
// /sales/marketo is the tenant-facing surface for the dedicated Marketo
// integration: connect with REST credentials, then toggle sync settings and
// trigger imports. This spec mirrors the SFDC settings coverage — it drives the
// real page against the real api-server (running with MARKETO_FAKE_MODE=1, set
// in playwright.config webServer env, so every Marketo network call returns a
// canned response and no live Marketo tenant is needed).
//
// Covered, on a fresh Royal-style tenant:
//   1. Disconnected empty state: the connect form (all five credential inputs)
//      renders and the status badge reads "Disconnected".
//   2. "Test connection" validates the entered creds (fake mode → valid).
//   3. Connect flow: filling creds + clicking "Connect Marketo" flips the page
//      to the connected state — Connected badge, Munchkin ID echo, Sync
//      Settings + Sync Controls cards.
//   4. A sync trigger ("Full Sync") round-trips and surfaces Sync History.
//   5. Disconnect returns the page to the connect form.
//
// Uses domcontentloaded + element assertions (NOT networkidle): the SaaS shell
// holds a persistent SSE stream that never lets networkidle settle.

import pg from "pg";
import { test, expect, type BrowserContext } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { assertApiHealthy } from "./setup/api-health";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture " +
        "can create a Royal-style tenant in the dev DB.",
    );
  }
  return url;
}

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

const VALID_CREDS = {
  munchkinId: "123-ABC-456",
  restEndpoint: "https://123-ABC-456.mktorest.com/rest",
  identityEndpoint: "https://123-ABC-456.mktorest.com/identity",
  clientId: "00000000-0000-0000-0000-000000000000",
  clientSecret: "super-secret-value",
};

test.describe("Marketo settings UI (task #951)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    // Default fixture tier is "growth" — that includes the Sales Console plan
    // feature the /sales/marketo routes are gated behind (requirePlanFeature
    // "salesConsole"), so the page's API calls resolve instead of 403-ing.
    tenant = await createRoyalTenant(pool);
  });

  test.afterAll(async () => {
    if (!pool) return;
    try {
      if (tenant) await cleanupRoyalTenant(pool, tenant);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  test("disconnected tenant shows the connect form with all credential inputs", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    const page = await ctx.newPage();
    try {
      await page.goto("/sales/marketo", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Connection Status" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Disconnected", { exact: true })).toBeVisible();

      // The connect form (only shown when not connected) and all five inputs.
      await expect(page.getByRole("heading", { name: "Connect Marketo" })).toBeVisible();
      await expect(page.locator("#mkto-munchkin")).toBeVisible();
      await expect(page.locator("#mkto-rest")).toBeVisible();
      await expect(page.locator("#mkto-identity")).toBeVisible();
      await expect(page.locator("#mkto-client-id")).toBeVisible();
      await expect(page.locator("#mkto-client-secret")).toBeVisible();
      await expect(page.getByRole("button", { name: "Connect Marketo" })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("connect flow validates creds, connects, exposes sync controls, then disconnects", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    const page = await ctx.newPage();
    try {
      await page.goto("/sales/marketo", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#mkto-munchkin")).toBeVisible({ timeout: 30_000 });

      // ── Fill the credential form. ──
      await page.locator("#mkto-munchkin").fill(VALID_CREDS.munchkinId);
      await page.locator("#mkto-rest").fill(VALID_CREDS.restEndpoint);
      await page.locator("#mkto-identity").fill(VALID_CREDS.identityEndpoint);
      await page.locator("#mkto-client-id").fill(VALID_CREDS.clientId);
      await page.locator("#mkto-client-secret").fill(VALID_CREDS.clientSecret);

      // ── "Test connection" → fake mode reports the creds valid. ──
      const testPromise = page.waitForResponse(
        r => r.url().includes("/api/sales/marketo/test-connection") && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.getByRole("button", { name: "Test connection" }).click();
      await testPromise;
      await expect(page.getByText("Credentials are valid.")).toBeVisible({ timeout: 10_000 });

      // ── Connect. Wait for the POST then the connection refetch. ──
      const connectPromise = page.waitForResponse(
        r => /\/api\/sales\/marketo\/connect(\?|$)/.test(r.url()) && r.request().method() === "POST" && r.ok(),
        { timeout: 20_000 },
      );
      await page.getByRole("button", { name: "Connect Marketo" }).click();
      await connectPromise;

      // ── Connected state: badge, Munchkin echo, sync cards. ──
      await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(VALID_CREDS.munchkinId, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sync Settings" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sync Controls" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Full Sync" })).toBeVisible();
      // The connect form is gone once connected.
      await expect(page.getByRole("heading", { name: "Connect Marketo" })).toHaveCount(0);

      // ── Trigger an individual import; the sync log refetch should surface
      //    the Sync History card (the import writes a marketo_sync_log row). ──
      const importPromise = page.waitForResponse(
        r => r.url().includes("/api/sales/marketo/sync/leads") && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.getByRole("button", { name: "Import Leads" }).click();
      await importPromise;
      await expect(page.getByRole("heading", { name: "Sync History" })).toBeVisible({ timeout: 15_000 });

      // ── Disconnect via the confirmation dialog → back to the connect form. ──
      await page.getByRole("button", { name: "Disconnect" }).click();
      await expect(page.getByRole("heading", { name: "Disconnect Marketo?" })).toBeVisible();
      const disconnectPromise = page.waitForResponse(
        r => r.url().includes("/api/sales/marketo/disconnect") && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      // The dialog's confirm action is the second "Disconnect" button (the
      // destructive AlertDialogAction); scope to the dialog to avoid the
      // status-card trigger.
      await page.getByRole("alertdialog").getByRole("button", { name: "Disconnect" }).click();
      await disconnectPromise;

      await expect(page.getByText("Disconnected", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "Connect Marketo" })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
