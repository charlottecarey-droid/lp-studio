/**
 * Phase 5 — end-to-end self-serve Checkout verification against a Stripe
 * TEST CLOCK.
 *
 * This is the automated form of `docs/packaging/stripe-test-plan.md` → T2
 * ("self-serve upgrade happy path") and closes the Phase 5 "Done" bar:
 *
 *     a tenant can self-upgrade through Checkout and the gates open immediately.
 *
 * What it proves, end to end against the REAL Stripe test-mode API + the REAL
 * Postgres pool:
 *   1. A tenant with no active subscription (free floor) gets a growth_monthly
 *      subscription — exactly what completing Stripe Checkout produces.
 *   2. The resulting `customer.subscription.created` event, signed with a real
 *      `whsec_*` secret, flows through the production webhook handler
 *      (`stripeWebhookHandler`) — signature verification included.
 *   3. `tenants.plan` flips to `growth` and the snapshot columns are populated.
 *   4. The live entitlement accessors (`getTenantPlan` + `getPlanFeatures`)
 *      now report growth — i.e. the gates that 402'd on free (salesConsole,
 *      customDomain, unlimited pages) open immediately.
 *
 * A real hosted Checkout page cannot be completed headlessly, so — per
 * Stripe's own test-clock guidance — we create the subscription directly on a
 * customer attached to a test clock (using the `tok_visa` test card). The
 * subscription Stripe produces is identical to the one a completed Checkout
 * session yields, and it is that subscription event the webhook acts on.
 *
 * ── HOW TO RUN ────────────────────────────────────────────────────────────
 * Requires Stripe TEST-MODE credentials. Skipped (no-op) without them, so it
 * is inert in stripeless dev and in CI that has no Stripe secrets:
 *
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   STRIPE_WEBHOOK_SECRET=whsec_...   # optional; a local test secret is used otherwise \
 *     pnpm --filter @workspace/api-server exec vitest run \
 *       src/routes/billing.checkout.testclock.integration.test.ts
 *
 * The growth_monthly price must exist in the target Stripe account (seed it
 * with `pnpm --filter @workspace/scripts run seed-stripe-products`, or set
 * STRIPE_PRICE_GROWTH_MONTHLY=price_...).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { pool } from "@workspace/db";
import { getStripe, getPriceIdForLookupKey } from "../lib/stripeClient";
import { getTenantPlan } from "../lib/planFeatures";
import { getPlanFeatures } from "../lib/planConfig";
import { LOOKUP_KEYS } from "../lib/stripePlanMapping";

const HAS_STRIPE = !!process.env.STRIPE_SECRET_KEY;

// Sign + verify with the same secret. getWebhookSecret() (inside the handler)
// reads STRIPE_WEBHOOK_SECRET env-first, so seeding a local value here keeps
// the signature path fully exercised even when no real whsec_* is provided.
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET ??=
  "whsec_testclock_e2e_local");

// Build a minimal Express req carrying a RAW Buffer body (the webhook handler
// asserts Buffer.isBuffer so signature verification gets the unparsed bytes).
function mockReq(rawBody: Buffer, signature: string): Request {
  return {
    headers: { "stripe-signature": signature },
    body: rawBody,
  } as unknown as Request;
}

interface CapturedRes {
  res: Response;
  statusCode: () => number;
  body: () => unknown;
}

function mockRes(): CapturedRes {
  let code = 0;
  let payload: unknown = undefined;
  const res = {
    status(c: number) {
      code = c;
      return this;
    },
    json(obj: unknown) {
      payload = obj;
      return this;
    },
  } as unknown as Response;
  return { res, statusCode: () => code, body: () => payload };
}

describe.skipIf(!HAS_STRIPE)(
  "Phase 5 self-serve Checkout E2E (Stripe test clock)",
  () => {
    let stripe: Stripe;
    let tenantId: number;
    let roleId: number;
    let testClockId: string;
    let customerId: string;
    let subscriptionId: string;

    const FIXTURE_SLUG = `e2e-checkout-${Date.now()}`;

    beforeAll(async () => {
      stripe = await getStripe();

      // 1. Freeze a test clock so the subscription lifecycle is deterministic.
      const clock = await stripe.testHelpers.testClocks.create({
        frozen_time: Math.floor(Date.now() / 1000),
        name: `phase5-e2e-${Date.now()}`,
      });
      testClockId = clock.id;

      // 2. Tenant fixture on the FREE floor (no active subscription) — the
      //    only state from which Checkout is allowed.
      const tenantRes = await pool.query<{ id: number }>(
        `INSERT INTO tenants (name, slug, status, plan)
         VALUES ('E2E Checkout Tenant', $1, 'active', 'free')
         RETURNING id`,
        [FIXTURE_SLUG],
      );
      tenantId = tenantRes.rows[0].id;

      const roleRes = await pool.query<{ id: number }>(
        `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
         VALUES ($1, 'Admin', '{}'::jsonb, true, true) RETURNING id`,
        [tenantId],
      );
      roleId = roleRes.rows[0].id;
      await pool.query(
        `INSERT INTO tenant_members (tenant_id, role_id, email, accepted_at)
         VALUES ($1, $2, 'e2e-checkout-admin@example.com', now())`,
        [tenantId, roleId],
      );

      // 3. Customer on the test clock, tagged with tenantId exactly like the
      //    checkout-session route does, then linked on the tenant row.
      const customer = await stripe.customers.create({
        email: "e2e-checkout-admin@example.com",
        metadata: { tenantId: String(tenantId) },
        test_clock: testClockId,
      });
      customerId = customer.id;
      await pool.query(
        `UPDATE tenants SET stripe_customer_id = $1, updated_at = now() WHERE id = $2`,
        [customerId, tenantId],
      );

      // 4. Attach a test card and make it the default so the subscription
      //    Stripe creates settles to `active` (mirrors a completed Checkout).
      const pm = await stripe.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
      });
      await stripe.paymentMethods.attach(pm.id, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pm.id },
      });

      // 5. Create the growth_monthly subscription — identical to what a
      //    completed Checkout session produces.
      const priceId = await getPriceIdForLookupKey(
        stripe,
        LOOKUP_KEYS.growthMonthly,
      );
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        default_payment_method: pm.id,
        metadata: { tenantId: String(tenantId) },
        expand: ["items.data.price"],
      });
      subscriptionId = sub.id;
    }, 60_000);

    afterAll(async () => {
      // Stripe: deleting the test clock cascades to its customers +
      // subscriptions, so that is the only cleanup the Stripe side needs.
      if (testClockId) {
        await stripe.testHelpers.testClocks
          .del(testClockId)
          .catch(() => undefined);
      }
      // DB fixtures.
      if (tenantId) {
        await pool
          .query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [tenantId])
          .catch(() => undefined);
        await pool
          .query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [tenantId])
          .catch(() => undefined);
        await pool
          .query(`DELETE FROM tenants WHERE id = $1`, [tenantId])
          .catch(() => undefined);
      }
    }, 60_000);

    it("drives free → growth through the signed webhook and opens the gates", async () => {
      // Lazy import so the handler module (which pulls stripe-replit-sync)
      // only loads when this suite actually runs with credentials.
      const { stripeWebhookHandler } = await import("./stripeWebhook");

      // Re-fetch the subscription with the same expansion the live webhook
      // uses, then wrap it in a signed customer.subscription.created event —
      // the exact shape Stripe POSTs after Checkout completes.
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price", "default_payment_method"],
      });
      expect(sub.status).toBe("active");

      const payload = JSON.stringify({
        id: `evt_e2e_${Date.now()}`,
        object: "event",
        created: Math.floor(Date.now() / 1000),
        type: "customer.subscription.created",
        data: { object: sub },
      });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });

      const req = mockReq(Buffer.from(payload, "utf8"), signature);
      const captured = mockRes();
      await stripeWebhookHandler(req, captured.res);

      // Handler acknowledged the event.
      expect(captured.statusCode()).toBe(200);
      expect(captured.body()).toEqual({ received: true });

      // tenants.plan + snapshot columns reflect the growth subscription.
      const row = await pool.query<{
        plan: string;
        stripe_subscription_id: string | null;
        stripe_subscription_status: string | null;
        stripe_price_lookup_key: string | null;
        stripe_cadence: string | null;
      }>(
        `SELECT plan, stripe_subscription_id, stripe_subscription_status,
                stripe_price_lookup_key, stripe_cadence
           FROM tenants WHERE id = $1`,
        [tenantId],
      );
      const tenant = row.rows[0];
      expect(tenant.plan).toBe("growth");
      expect(tenant.stripe_subscription_id).toBe(subscriptionId);
      expect(tenant.stripe_subscription_status).toBe("active");
      expect(tenant.stripe_price_lookup_key).toBe(LOOKUP_KEYS.growthMonthly);
      expect(tenant.stripe_cadence).toBe("monthly");

      // Live entitlement accessors now report growth — the gates that 402'd
      // on the free floor are open.
      expect(await getTenantPlan(tenantId)).toBe("growth");
      const features = await getPlanFeatures("growth");
      const freeFeatures = await getPlanFeatures("free");
      expect(freeFeatures.salesConsole).toBe(false); // was gated on free
      expect(features.salesConsole).toBe(true); // opens on growth
      expect(features.customDomain).toBe(true);
      expect(features.limits.pages).toBeNull(); // unlimited on growth
    }, 60_000);
  },
);
