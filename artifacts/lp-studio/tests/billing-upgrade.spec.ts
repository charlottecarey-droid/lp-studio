// Stripe self-serve upgrade flow — end-to-end (task #429).
//
// The hosted Stripe Checkout page and the signed webhook can't be driven
// headlessly in this environment (the Stripe key pool is PROD, and the
// webhook requires a real signature). So this spec verifies the *user-visible
// outcomes* of the upgrade flow hermetically, exercising the real Billing
// summary endpoint and the real Billing page UI against tenant rows in the
// exact shape the webhook writes:
//
//   1. A starter tenant sees the Starter plan + upgrade controls.
//   2. After the webhook snapshots a Growth subscription onto the tenant
//      (plan + stripe_* columns), the Billing page shows Growth, an "active"
//      status, the price, the renewal date, and the card on file.
//   3. When the subscription goes past_due (a failed renewal), the Billing
//      page shows the payment-failed banner (task #430).
//   4. The real checkout-session endpoint refuses a duplicate checkout for a
//      tenant that already has a live subscription (409) — the guard that
//      stops double-billing — without ever touching the Stripe API.
//
// The webhook → DB mapping itself is covered by the server-side handler; this
// spec pins the read side that the user actually experiences.

import pg from "pg";
import { test, expect, type BrowserContext } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the billing fixture can " +
        "create a fresh tenant in the dev DB.",
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

/** Mirrors what stripeWebhook's applyPlanFromSubscription writes on upgrade. */
async function applyGrowthSnapshot(
  pool: pg.Pool,
  tenantId: number,
  status: "active" | "past_due" = "active",
): Promise<void> {
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // +30 days, epoch seconds
  await pool.query(
    `UPDATE tenants
        SET plan                        = 'growth',
            stripe_customer_id          = $2,
            stripe_subscription_id      = $3,
            stripe_subscription_status  = $4,
            stripe_current_period_end   = $5,
            stripe_cancel_at_period_end = false,
            stripe_price_lookup_key     = 'growth_monthly',
            stripe_cadence              = 'monthly',
            stripe_unit_amount          = 24900,
            stripe_currency             = 'usd',
            stripe_payment_brand        = 'visa',
            stripe_payment_last4        = '4242',
            updated_at                  = now()
      WHERE id = $1`,
    [tenantId, `cus_test_${tenantId}`, `sub_test_${tenantId}`, status, periodEnd],
  );
}

/** Reset back to a clean starter tenant with no Stripe subscription. */
async function resetToStarter(pool: pg.Pool, tenantId: number): Promise<void> {
  await pool.query(
    `UPDATE tenants
        SET plan                        = 'starter',
            stripe_customer_id          = NULL,
            stripe_subscription_id      = NULL,
            stripe_subscription_status  = NULL,
            stripe_current_period_end   = NULL,
            stripe_cancel_at_period_end = NULL,
            stripe_price_lookup_key     = NULL,
            stripe_cadence              = NULL,
            stripe_unit_amount          = NULL,
            stripe_currency             = NULL,
            stripe_payment_brand        = NULL,
            stripe_payment_last4        = NULL,
            updated_at                  = now()
      WHERE id = $1`,
    [tenantId],
  );
}

test.describe("Stripe upgrade flow (billing)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool, { plan: "starter" });
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) await cleanupRoyalTenant(pool, tenant);
    if (pool) await pool.end();
  });

  test("starter tenant sees the Starter plan and upgrade controls", async ({
    page,
    context,
    baseURL,
  }) => {
    await resetToStarter(pool, tenant.tenantId);
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    await page.goto("/settings/billing", { waitUntil: "networkidle" });

    // Current plan card shows Starter, with no live subscription badge.
    await expect(page.getByRole("heading", { name: "Starter", exact: true })).toBeVisible();
    await expect(page.getByTestId("subscription-status-badge")).toHaveCount(0);
    await expect(page.getByTestId("payment-failed-banner")).toHaveCount(0);

    // Upgrade controls for the higher self-serve tiers are present.
    await expect(page.getByTestId("checkout-growth-monthly")).toBeVisible();
    await expect(page.getByTestId("checkout-growth-annual")).toBeVisible();
  });

  test("Billing reflects an upgraded Growth subscription after the webhook snapshot", async ({
    page,
    context,
    baseURL,
  }) => {
    await applyGrowthSnapshot(pool, tenant.tenantId, "active");
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    await page.goto("/settings/billing", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Growth", exact: true })).toBeVisible();
    await expect(page.getByTestId("subscription-status-badge")).toHaveText("active");
    await expect(page.getByTestId("payment-method-display")).toContainText("Visa •••• 4242");
    // A renewal date is rendered (not the "—" placeholder).
    await expect(page.getByText("Renews on")).toBeVisible();
    // No failure banner while the subscription is healthy.
    await expect(page.getByTestId("payment-failed-banner")).toHaveCount(0);
  });

  test("past_due subscription surfaces the payment-failed banner", async ({
    page,
    context,
    baseURL,
  }) => {
    await applyGrowthSnapshot(pool, tenant.tenantId, "past_due");
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    await page.goto("/settings/billing", { waitUntil: "networkidle" });

    await expect(page.getByTestId("payment-failed-banner")).toBeVisible();
    await expect(page.getByTestId("subscription-status-badge")).toHaveText("past_due");
    await expect(page.getByTestId("payment-failed-banner")).toContainText(/payment failed/i);
  });

  test("checkout-session refuses a duplicate subscription with 409", async ({ request }) => {
    // Tenant already has a live (active) Growth subscription.
    await applyGrowthSnapshot(pool, tenant.tenantId, "active");

    const headers = await csrfHeaders(request, tenant.sessionSid);
    const res = await request.post("/api/billing/checkout-session", {
      headers: { ...headers, "Content-Type": "application/json" },
      data: { priceLookupKey: "growth_monthly" },
    });

    // 409 (already on tier) — NOT a 503/500. The guard runs before any
    // Stripe API call, so this holds even when Stripe is unconfigured in dev.
    expect(res.status()).toBe(409);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("already_on_tier");
  });
});
