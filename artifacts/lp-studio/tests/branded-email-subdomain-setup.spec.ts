// Branded email subdomain Settings-UI contract (Tier 2, task #784).
//
// The self-serve route + the `resolveTenantSender` fail-closed routing are
// already pinned by an integration test
// (api-server/.../branded-email-subdomain.integration.test.ts, which mocks
// Resend + Cloudflare at the fetch layer). What had NO browser-level coverage
// is the most visible half of the feature: the BrandedSubdomainCard on
// Brand Settings → Sales Console that a tenant actually clicks through.
//
// This spec drives that card from the browser for two tenants:
//
//   • Eligible (Growth): the full lifecycle the card exposes —
//       not-provisioned → provision → pending → verified → remove.
//     We intercept the four /api/lp/branded-email-subdomain verbs at the
//     browser level and serve them from a tiny phase state machine, so the
//     test never touches real Resend / Cloudflare (no domain is ever
//     registered, no DNS record is ever written). This isolates exactly what
//     the task asks to cover — the card's rendering + state transitions —
//     from the external providers the integration test already owns.
//
//   • Ineligible (starter): the card is plan-gated. For a tier without the
//     `brandedEmailSubdomain` feature the card is NOT rendered (the lower-tier
//     free-text "Sending domain" field shows instead), and the server route is
//     the real boundary — it 402s. We assert both halves.

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

// Stub subdomain the intercepted route reports back. Distinct from the real
// derived value (mail.<slug>.lpstudio.ai) so an accidental un-stubbed call
// can't masquerade as a pass.
const STUB_SUBDOMAIN = "mail.royal-e2e.lpstudio.ai";

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture can " +
        "create a Royal-style tenant in the dev DB.",
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

/**
 * Stub /api/sales/brand-context so SalesConsoleSettings' SetupStatusCard
 * mounts without a live Resend read (RESEND_API_KEY may be present in the
 * e2e api-server's inherited env). Returns a neutral, unconfigured summary —
 * the branded-subdomain card we're testing reads its OWN endpoint, not this.
 */
async function stubBrandContext(ctx: BrowserContext): Promise<void> {
  await ctx.route("**/api/sales/brand-context*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ setup: {}, domainVerification: null }),
    });
  });
}

test.describe("Branded email subdomain — eligible (Growth) tenant", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    // Default plan is canonical "growth" → brandedEmailSubdomain feature ON.
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

  test("drives the card not-provisioned → provision → pending → verified → remove", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toBeTruthy();
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    await stubBrandContext(ctx);

    // Tiny phase state machine standing in for Resend + Cloudflare. Each verb
    // mutates `phase`; GET and POST /verify just report the current phase. The
    // test flips `phase` to "verified" right before clicking "Check
    // verification", mirroring DNS finishing in the background.
    type Phase = "unprovisioned" | "pending" | "verified";
    let phase: Phase = "unprovisioned";
    const stateFor = (p: Phase) => ({
      subdomain: STUB_SUBDOMAIN,
      domainId: p === "unprovisioned" ? null : "dom-e2e",
      status:
        p === "unprovisioned" ? "not_configured" : p === "pending" ? "pending" : "verified",
      active: p === "verified",
      provisioned: p !== "unprovisioned",
    });

    await ctx.route(
      (url) => url.pathname.includes("/api/lp/branded-email-subdomain"),
      async (route, request) => {
        const method = request.method();
        const isVerify = new URL(request.url()).pathname.endsWith("/verify");
        let status = 200;
        if (method === "POST" && !isVerify) {
          phase = "pending"; // provision
          status = 201;
        } else if (method === "DELETE") {
          phase = "unprovisioned"; // remove → revert to shared default
        }
        // GET (hydrate) and POST /verify both just report the current phase.
        await route.fulfill({
          status,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(stateFor(phase)),
        });
      },
    );

    const page = await ctx.newPage();
    try {
      await page.goto("/brand#sales-console", { waitUntil: "domcontentloaded" });

      const card = page.locator("#sales-console-branded-email-subdomain");
      await expect(card).toBeVisible({ timeout: 30_000 });

      // ── 1. Not provisioned: the "Set up" CTA + the derived subdomain. ──
      const provisionBtn = card.getByRole("button", { name: /Set up branded subdomain/ });
      await expect(provisionBtn).toBeVisible();
      await expect(card.getByText(STUB_SUBDOMAIN).first()).toBeVisible();
      // No verified/pending chrome yet.
      await expect(card.getByRole("button", { name: /Check verification/ })).toHaveCount(0);

      // ── 2. Provision → pending. The amber "we're verifying DNS" banner and
      //      the "Check verification" button appear; mail still routes through
      //      the shared default until verified (copy asserts that). ──
      await provisionBtn.click();
      await expect(card.getByText(/We're verifying the DNS automatically/)).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        card.getByText(/Email keeps sending from the shared default until this is verified/),
      ).toBeVisible();
      await expect(card.getByRole("button", { name: /Check verification/ })).toBeVisible();
      await expect(card.getByRole("button", { name: /^Remove$/ })).toBeVisible();

      // ── 3. DNS finishes → click "Check verification" → verified state. ──
      phase = "verified";
      await card.getByRole("button", { name: /Check verification/ }).click();
      await expect(card.getByText(/Your subdomain is verified/)).toBeVisible({ timeout: 15_000 });
      // Verified hides the "Check verification" button (nothing left to poll).
      await expect(card.getByRole("button", { name: /Check verification/ })).toHaveCount(0);

      // ── 4. Remove → back to the not-provisioned empty state. ──
      await card.getByRole("button", { name: /^Remove$/ }).click();
      await expect(card.getByRole("button", { name: /Set up branded subdomain/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(card.getByText(/Your subdomain is verified/)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});

test.describe("Branded email subdomain — ineligible (starter) tenant", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, { plan: "starter" });
  });

  test.afterAll(async () => {
    if (!pool) return;
    try {
      if (tenant) await cleanupRoyalTenant(pool, tenant);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  test("hides the card (gated) and the server route 402s", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    await stubBrandContext(ctx);

    const page = await ctx.newPage();
    try {
      await page.goto("/brand#sales-console", { waitUntil: "domcontentloaded" });

      // The Sales Console tab itself renders for every tier — prove we're on
      // it via the always-present Sender Identity card.
      await expect(page.locator("#sales-console-sender-identity")).toBeVisible({ timeout: 30_000 });

      // The Tier-2 self-serve subdomain card is plan-gated → not rendered.
      await expect(page.locator("#sales-console-branded-email-subdomain")).toHaveCount(0);

      // Lower tiers get the free-text "Sending domain" field instead (the
      // mutually-exclusive fallback to the gated card).
      await expect(page.getByText("Sending domain", { exact: true })).toBeVisible();

      // The server route is the real security boundary: 402 for a tier without
      // the feature. context.request bypasses the page route handlers and
      // carries the session cookie, so this hits the live api-server.
      const res = await ctx.request.get("/api/lp/branded-email-subdomain");
      expect(res.status()).toBe(402);
    } finally {
      await ctx.close();
    }
  });
});
