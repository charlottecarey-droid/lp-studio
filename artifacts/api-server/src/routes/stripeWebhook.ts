// Stripe webhook receiver — mounted directly on `app` BEFORE express.json()
// in app.ts so `req.body` arrives as a raw Buffer for signature verification.
// Plain Express handler (no Router) so we don't depend on the global LP/sales
// auth guard registered in routes/index.ts.
//
// What lives here:
//   • Signature verification via `stripe.webhooks.constructEvent`.
//   • Dispatch on the small set of events the billing UX depends on.
//   • Mapping Stripe subscription → canonical plan tier via
//     `stripePlanMapping.planForLookupKey(price.lookup_key)`. We never
//     hardcode price ids — only stable lookup keys seeded by the
//     `seed-stripe-products` script.
//   • Snapshotting subscription state into tenants.stripe_* columns so
//     GET /api/billing/summary can render WITHOUT a Stripe API call on
//     every pageload.
//   • Audit log in the same shape SuperAdmin → plan-edit emits, with an
//     extra `source: "stripe_webhook"` discriminator + the event id so
//     timelines reconciled from console logs aren't ambiguous.
//
// What does NOT live here:
//   • Entitlement decisions. PLAN_FEATURES in lib/planFeatures.ts is the
//     sole source of truth for what each tier unlocks. The webhook only
//     decides *which* tier the tenant is on.
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { getStripe, getStripeSync, getWebhookSecret, StripeNotConfiguredError } from "../lib/stripeClient";
import { normalizePlan, type Plan } from "../lib/planFeatures";
import { planForLookupKey, cadenceForLookupKey, isSelfServePaidPlan } from "../lib/stripePlanMapping";
import { logger } from "../lib/logger";
import type Stripe from "stripe";

interface TenantStripeRow {
  id: number;
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

async function findTenantByCustomer(customerId: string): Promise<TenantStripeRow | null> {
  const r = await pool.query<TenantStripeRow>(
    `SELECT id, plan, stripe_customer_id, stripe_subscription_id
       FROM tenants
      WHERE stripe_customer_id = $1
      LIMIT 1`,
    [customerId],
  );
  return r.rows[0] ?? null;
}

async function findTenantBySubscription(subscriptionId: string): Promise<TenantStripeRow | null> {
  const r = await pool.query<TenantStripeRow>(
    `SELECT id, plan, stripe_customer_id, stripe_subscription_id
       FROM tenants
      WHERE stripe_subscription_id = $1
      LIMIT 1`,
    [subscriptionId],
  );
  return r.rows[0] ?? null;
}

export function resolvePlanFromSubscription(sub: Stripe.Subscription): Plan | null {
  // Treat a non-active subscription as a downgrade to the FREE floor. Stripe
  // sends a separate `customer.subscription.deleted` event for full
  // cancellation; we belt-and-brace here so a status flip (`unpaid`,
  // `canceled`) inside `customer.subscription.updated` also lands the
  // tenant back on free immediately. NOTE: this must be `free`, not
  // `starter` — `starter` is now a PAID self-serve tier, so a cancelled
  // tenant must never be parked there for free.
  const downgradeStatuses: Stripe.Subscription.Status[] = ["canceled", "unpaid", "incomplete_expired"];
  if (downgradeStatuses.includes(sub.status)) return "free";

  const item = sub.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key ?? null;
  const byLookupKey = planForLookupKey(lookupKey);
  if (byLookupKey) return byLookupKey;

  // Fallback: a subscription grandfathered onto an archived price (whose
  // lookup_key was cleared during a re-key) still carries the canonical tier
  // in price.metadata.lpstudio_plan (stamped by the seed script). Only trust
  // it if it is a recognised self-serve paid tier — a typo/unknown marker
  // must NOT be coerced (normalizePlan would map it to `free` and silently
  // downgrade a paying tenant). Unknown → null so the caller leaves the plan
  // untouched.
  const metaTier = item?.price?.metadata?.lpstudio_plan ?? null;
  if (isSelfServePaidPlan(metaTier)) return metaTier;
  return null;
}

interface PaymentMethodSnapshot {
  brand: string | null;
  last4: string | null;
}

/**
 * Resolve the card brand + last4 we want to surface on the Billing page.
 * Prefers the subscription's default_payment_method, then the customer's
 * invoice_settings.default_payment_method, then the latest_invoice's
 * payment intent. Returns nulls (NOT undefined) so SQL params behave.
 *
 * Failures are swallowed: payment method display is a nice-to-have, not
 * worth a 500 in the webhook.
 */
async function resolvePaymentMethodSnapshot(
  stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<PaymentMethodSnapshot> {
  const empty: PaymentMethodSnapshot = { brand: null, last4: null };
  try {
    const candidate =
      typeof sub.default_payment_method === "string"
        ? sub.default_payment_method
        : sub.default_payment_method?.id ?? null;
    if (candidate) {
      const pm = await stripe.paymentMethods.retrieve(candidate);
      return { brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null };
    }
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (customerId) {
      const cust = await stripe.customers.retrieve(customerId);
      if (cust && !cust.deleted) {
        const pmId =
          typeof cust.invoice_settings?.default_payment_method === "string"
            ? cust.invoice_settings.default_payment_method
            : cust.invoice_settings?.default_payment_method?.id ?? null;
        if (pmId) {
          const pm = await stripe.paymentMethods.retrieve(pmId);
          return { brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null };
        }
      }
    }
  } catch (err) {
    logger.warn({ err, subId: sub.id }, "[stripe][webhook] resolvePaymentMethodSnapshot failed");
  }
  return empty;
}

async function applyPlanFromSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) {
    logger.warn({ eventId, subId: sub.id }, "[stripe][webhook] subscription has no customer id; skipping");
    return;
  }
  const tenant =
    (await findTenantByCustomer(customerId)) ??
    (await findTenantBySubscription(sub.id));
  if (!tenant) {
    logger.warn({ eventId, subId: sub.id, customerId }, "[stripe][webhook] no tenant matches customer; skipping");
    return;
  }

  const nextPlan = resolvePlanFromSubscription(sub);
  if (nextPlan === null) {
    const lookupKey = sub.items?.data?.[0]?.price?.lookup_key ?? null;
    logger.warn({ eventId, subId: sub.id, tenantId: tenant.id, lookupKey, status: sub.status },
      "[stripe][webhook] unknown lookup_key; not changing plan");
    return;
  }

  const item = sub.items?.data?.[0];
  const price = item?.price;
  const lookupKey = price?.lookup_key ?? null;
  const cadence = cadenceForLookupKey(lookupKey);
  const periodEnd = item?.current_period_end ?? null;
  const pm = await resolvePaymentMethodSnapshot(stripe, sub);

  const priorPlan = tenant.plan;
  const priorSubId = tenant.stripe_subscription_id;

  await pool.query(
    `UPDATE tenants
        SET plan                          = $1,
            stripe_customer_id            = COALESCE(stripe_customer_id, $2),
            stripe_subscription_id        = $3,
            stripe_subscription_status    = $4,
            stripe_current_period_end     = $5,
            stripe_cancel_at_period_end   = $6,
            stripe_price_lookup_key       = $7,
            stripe_cadence                = $8,
            stripe_unit_amount            = $9,
            stripe_currency               = $10,
            stripe_payment_brand          = $11,
            stripe_payment_last4          = $12,
            updated_at                    = now()
      WHERE id = $13`,
    [
      nextPlan,
      customerId,
      sub.id,
      sub.status,
      periodEnd,
      sub.cancel_at_period_end,
      lookupKey,
      cadence,
      price?.unit_amount ?? null,
      price?.currency ?? null,
      pm.brand,
      pm.last4,
      tenant.id,
    ],
  );

  if (normalizePlan(priorPlan) !== nextPlan || priorSubId !== sub.id) {
    console.info(
      "[admin][audit] tenant.plan.changed",
      JSON.stringify({
        tenantId: tenant.id,
        fromRaw: priorPlan,
        fromCanonical: normalizePlan(priorPlan),
        to: nextPlan,
        source: "stripe_webhook",
        stripeEventId: eventId,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionStatus: sub.status,
        at: new Date().toISOString(),
      }),
    );
  }
}

/**
 * `invoice.payment_failed` dunning handler.
 *
 * Stripe retries failed subscription invoices automatically (the retry
 * cadence is configured in the Stripe dashboard's Smart Retries / dunning
 * settings — typically 4 attempts over ~3 weeks). Each retry fires another
 * `invoice.payment_failed`; only the FINAL attempt has `next_payment_attempt
 * === null`. Until then we just log and let Stripe keep trying.
 *
 * When Stripe gives up (final attempt exhausted), we downgrade the tenant
 * to `starter` immediately. We don't wait for `customer.subscription.updated`
 * → `unpaid` because Stripe's grace-period handling can leave the
 * subscription in `past_due` for an additional billing cycle before
 * flipping; meanwhile the tenant retains paid features they're no longer
 * paying for. Downgrading on final failed attempt closes that window.
 *
 * Idempotent: re-running on the same event (or a redelivery) re-issues the
 * same UPDATE — no harm if the tenant is already on starter.
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  stripe: Stripe,
): Promise<void> {
  const inv = event.data.object as Stripe.Invoice;
  const finalAttempt = inv.next_payment_attempt === null;
  const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
  logger.warn(
    {
      eventId: event.id,
      invoiceId: inv.id,
      customerId,
      attempt: inv.attempt_count,
      nextAttempt: inv.next_payment_attempt,
      finalAttempt,
    },
    "[stripe][webhook] invoice.payment_failed",
  );

  if (!finalAttempt || !customerId) return;
  const tenant = await findTenantByCustomer(customerId);
  if (!tenant) {
    logger.warn({ eventId: event.id, customerId }, "[stripe][webhook] payment_failed final attempt: no tenant for customer");
    return;
  }
  // Re-fetch the subscription so applyPlanFromSubscription sees the latest
  // status (Stripe usually flips it to `unpaid` or `canceled` simultaneous
  // with the final failed attempt). resolvePlanFromSubscription downgrades
  // any non-active status to the FREE floor.
  const subIdRaw = (inv as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription
    ?? tenant.stripe_subscription_id;
  const subId = typeof subIdRaw === "string" ? subIdRaw : subIdRaw?.id ?? null;
  if (!subId) {
    // No subscription on the invoice — direct DB downgrade as a fallback.
    // Must land on `free`, NOT `starter` — `starter` is now a paid tier, so
    // a tenant whose payment finally failed must not be parked there gratis.
    await pool.query(
      `UPDATE tenants
          SET plan                       = 'free',
              stripe_subscription_status = 'unpaid',
              updated_at                 = now()
        WHERE id = $1`,
      [tenant.id],
    );
    console.info(
      "[admin][audit] tenant.plan.changed",
      JSON.stringify({
        tenantId: tenant.id,
        fromRaw: tenant.plan,
        fromCanonical: normalizePlan(tenant.plan),
        to: "free",
        source: "stripe_webhook",
        sourceSubtype: "dunning_final_attempt",
        stripeEventId: event.id,
        stripeInvoiceId: inv.id,
        at: new Date().toISOString(),
      }),
    );
    return;
  }
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data.price", "default_payment_method"],
  });
  await applyPlanFromSubscription(stripe, sub, event.id);
}

async function handleCheckoutCompleted(
  event: Stripe.Event,
  stripe: Stripe,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "subscription") return;
  const tenantIdRaw = session.metadata?.tenantId ?? session.client_reference_id ?? null;
  const tenantId = tenantIdRaw ? Number(tenantIdRaw) : null;
  if (!tenantId || Number.isNaN(tenantId)) {
    logger.warn({ eventId: event.id, sessionId: session.id }, "[stripe][webhook] checkout.session.completed missing tenantId metadata");
    return;
  }
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!customerId || !subId) {
    logger.warn({ eventId: event.id, sessionId: session.id }, "[stripe][webhook] checkout session lacks customer or subscription id");
    return;
  }
  await pool.query(
    `UPDATE tenants
        SET stripe_customer_id = $1,
            stripe_subscription_id = $2,
            updated_at = now()
      WHERE id = $3`,
    [customerId, subId, tenantId],
  );
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data.price", "default_payment_method"],
  });
  await applyPlanFromSubscription(stripe, sub, event.id);
}

/**
 * Express handler for `POST /api/stripe/webhook`. Mounted on `app` directly
 * (not via the global router) so it sits before express.json().
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }
  if (!Buffer.isBuffer(req.body)) {
    console.error(
      "[stripe][webhook] req.body is not a Buffer — this means express.json() parsed the body before the webhook handler ran. " +
        "FIX: keep the /api/stripe/webhook route registered BEFORE app.use(express.json()) in app.ts.",
    );
    res.status(500).json({ error: "Webhook misconfigured" });
    return;
  }

  let stripe: Stripe;
  let webhookSecret: string;
  try {
    stripe = await getStripe();
    webhookSecret = await getWebhookSecret();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      logger.warn({ err }, "[stripe][webhook] received an event but Stripe is not configured");
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }
    throw err;
  }

  const sig = Array.isArray(signature) ? signature[0] : signature;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "[stripe][webhook] signature verification failed");
    res.status(400).json({ error: `Invalid signature: ${msg}` });
    return;
  }

  // Mirror the event into the local `stripe.*` schema via the
  // stripe-replit-sync engine BEFORE our own dispatch runs. This keeps
  // `stripe.subscriptions`, `stripe.invoices`, `stripe.customers`, etc.
  // canonical for the API server's read-side queries and admin tooling.
  // Sync failures are logged but do NOT block the application-side plan
  // update — the SaaS shell must keep responding to tier changes even if
  // the mirror is temporarily wedged (we'll catch up on the next event
  // or a manual `syncBackfill`).
  try {
    const sync = await getStripeSync();
    await sync.processWebhook(req.body, sig);
  } catch (err) {
    logger.error(
      { err, eventId: event.id, type: event.type },
      "[stripe][webhook] stripe-replit-sync.processWebhook failed (continuing with plan dispatch)",
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event, stripe);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await applyPlanFromSubscription(stripe, sub, event.id);
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoicePaymentFailed(event, stripe);
        break;
      }
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err, eventId: event.id, type: event.type }, "[stripe][webhook] handler failed");
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
