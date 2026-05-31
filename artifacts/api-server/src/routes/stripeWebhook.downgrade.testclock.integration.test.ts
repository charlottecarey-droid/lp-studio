/**
 * End-to-end verification that a Stripe subscription cancel downgrades a
 * trialing tenant all the way to the FREE floor — gates closed — against a
 * Stripe TEST CLOCK and the REAL signed webhook handler.
 *
 * This is the downgrade mirror of `billing.checkout.testclock.integration.test`
 * (which proves free → growth on upgrade). It proves the regression fix:
 *
 *   A tenant on an active paid subscription WITH a still-open 14-day Growth
 *   trial window, whose subscription is then cancelled, must resolve to `free`
 *   — the cancel webhook closes the trial window so `effectivePlan` can't lift
 *   the stored Free floor back to the Growth trial tier and leave the Sales
 *   Console reachable.
 *
 * What it proves, end to end against the REAL Stripe test-mode API + the REAL
 * Postgres pool:
 *   1. An active subscription is cancelled (status → `canceled`).
 *   2. The resulting `customer.subscription.updated` event, signed with a real
 *      `whsec_*` secret, flows through `stripeWebhookHandler` — signature
 *      verification included.
 *   3. `tenants.plan` flips to `free`, the open trial window is closed, and
 *      `has_trialed_before` is stamped.
 *   4. The live entitlement accessors (`getTenantPlan` + `getTenantPlanFeatures`)
 *      report free with salesConsole / customDomain / aiImageGen all false.
 *
 * ── HOW TO RUN ────────────────────────────────────────────────────────────
 * Requires Stripe TEST-MODE credentials; skipped (no-op) without them:
 *
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   STRIPE_WEBHOOK_SECRET=whsec_...   # optional; a local test secret is used otherwise \
 *     pnpm --filter @workspace/api-server exec vitest run \
 *       src/routes/stripeWebhook.downgrade.testclock.integration.test.ts
 *
 * The growth_monthly price must exist in the target Stripe account.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { pool } from "@workspace/db";
import { getStripe, getPriceIdForLookupKey } from "../lib/stripeClient";
import { getTenantPlan, getTenantPlanFeatures } from "../lib/planFeatures";
import { LOOKUP_KEYS } from "../lib/stripePlanMapping";

const HAS_STRIPE = !!process.env.STRIPE_SECRET_KEY;

// Sign + verify with the same secret. getWebhookSecret() (inside the handler)
// reads STRIPE_WEBHOOK_SECRET env-first, so seeding a local value here keeps
// the signature path fully exercised even when no real whsec_* is provided.
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET ??=
  "whsec_downgrade_testclock_local");

function mockReq(rawBody: Buffer, signature: string): Request {
  return {
    headers: { "stripe-signature": signature },
    body: rawBody,
  } as unknown as Request;
}

function mockRes(): { res: Response; statusCode: () => number; body: () => unknown } {
  let code = 0;
  let payload: unknown = undefined;
  const res = {
    status(c: number) { code = c; return this; },
    json(obj: unknown) { payload = obj; return this; },
  } as unknown as Response;
  return { res, statusCode: () => code, body: () => payload };
}

describe.skipIf(!HAS_STRIPE)(
  "Stripe cancel → free downgrade closes the trial window (test clock)",
  () => {
    let stripe: Stripe;
    let tenantId: number;
    let testClockId: string;
    let customerId: string;
    let subscriptionId: string;

    const FIXTURE_SLUG = `e2e-downgrade-${Date.now()}`;

    beforeAll(async () => {
      stripe = await getStripe();

      const clock = await stripe.testHelpers.testClocks.create({
        frozen_time: Math.floor(Date.now() / 1000),
        name: `downgrade-e2e-${Date.now()}`,
      });
      testClockId = clock.id;

      // Tenant fixture: paid (growth) WITH a still-open 14-day trial window —
      // the exact state where a naive downgrade would leak (effectivePlan would
      // lift the post-cancel free floor back to the Growth trial tier).
      const tenantRes = await pool.query<{ id: number }>(
        `INSERT INTO tenants
           (name, slug, status, plan, trial_started_at, trial_expires_at, has_trialed_before)
         VALUES ('E2E Downgrade Tenant', $1, 'active', 'growth',
                 now() - interval '2 days', now() + interval '12 days', false)
         RETURNING id`,
        [FIXTURE_SLUG],
      );
      tenantId = tenantRes.rows[0].id;

      const customer = await stripe.customers.create({
        email: "e2e-downgrade-admin@example.com",
        metadata: { tenantId: String(tenantId) },
        test_clock: testClockId,
      });
      customerId = customer.id;
      await pool.query(
        `UPDATE tenants SET stripe_customer_id = $1, updated_at = now() WHERE id = $2`,
        [customerId, tenantId],
      );

      const pm = await stripe.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
      });
      await stripe.paymentMethods.attach(pm.id, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pm.id },
      });

      const priceId = await getPriceIdForLookupKey(stripe, LOOKUP_KEYS.growthMonthly);
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        default_payment_method: pm.id,
        metadata: { tenantId: String(tenantId) },
        expand: ["items.data.price"],
      });
      subscriptionId = sub.id;
      await pool.query(
        `UPDATE tenants SET stripe_subscription_id = $1, stripe_subscription_status = $2, updated_at = now()
           WHERE id = $3`,
        [sub.id, sub.status, tenantId],
      );
    }, 60_000);

    afterAll(async () => {
      if (testClockId) {
        await stripe.testHelpers.testClocks.del(testClockId).catch(() => undefined);
      }
      if (tenantId) {
        await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => undefined);
      }
    }, 60_000);

    it("cancel → free, trial closed, gates shut", async () => {
      const { stripeWebhookHandler } = await import("./stripeWebhook");

      // Cancel the subscription immediately (status → canceled).
      const canceled = await stripe.subscriptions.cancel(subscriptionId, {
        expand: ["items.data.price", "default_payment_method"],
      });
      expect(canceled.status).toBe("canceled");

      const payload = JSON.stringify({
        id: `evt_downgrade_${Date.now()}`,
        object: "event",
        type: "customer.subscription.updated",
        data: { object: canceled },
      });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });

      const req = mockReq(Buffer.from(payload, "utf8"), signature);
      const captured = mockRes();
      await stripeWebhookHandler(req, captured.res);

      expect(captured.statusCode()).toBe(200);
      expect(captured.body()).toEqual({ received: true });

      const row = await pool.query<{
        plan: string;
        has_trialed_before: boolean;
        trial_expires_at: Date | null;
      }>(
        `SELECT plan, has_trialed_before, trial_expires_at FROM tenants WHERE id = $1`,
        [tenantId],
      );
      const tenant = row.rows[0];
      expect(tenant.plan).toBe("free");
      // The previously-open trial window is closed and consumed.
      expect(tenant.has_trialed_before).toBe(true);
      expect(tenant.trial_expires_at).not.toBeNull();
      expect(new Date(tenant.trial_expires_at as Date).getTime()).toBeLessThanOrEqual(Date.now() + 1000);

      // Live entitlement accessors resolve to free — no stale lift to growth.
      expect(await getTenantPlan(tenantId)).toBe("free");
      const { plan, features } = await getTenantPlanFeatures(tenantId);
      expect(plan).toBe("free");
      expect(features.salesConsole).toBe(false);
      expect(features.customDomain).toBe(false);
      expect(features.aiImageGen).toBe(false);
    }, 60_000);
  },
);
