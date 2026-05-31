// Self-serve billing routes. The router applies `requireAuth` to every
// handler before dispatching, so `req.authUser` is always populated.
//
// Endpoints:
//   GET  /api/billing/summary           — current plan + Stripe snapshot
//                                         columns from `tenants`. NEVER
//                                         calls the Stripe API: the
//                                         webhook is the single writer
//                                         of those columns.
//   POST /api/billing/checkout-session  — { priceLookupKey } → { url }
//                                         redirect target for Stripe
//                                         Checkout. Creates+persists a
//                                         Stripe customer on first
//                                         attempt, refuses if the tenant
//                                         is already on the requested
//                                         tier.
//   POST /api/billing/portal-session    — → { url } for the Stripe Billing
//                                         Portal (cancel / change card /
//                                         invoices).
//
// All three 503 cleanly when Stripe is unconfigured so a stripeless dev
// boot still serves the rest of the API.
import { Router, type IRouter, type Request, type Response } from "express";
import type Stripe from "stripe";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { getPriceIdForLookupKey, getStripe, StripeNotConfiguredError } from "../lib/stripeClient";
import { normalizePlan, getTenantPlan, computeTrialState, isDandyTenant, CLOSE_TRIAL_ON_FREE_SQL, type Plan } from "../lib/planFeatures";
import { getPlanFeatures } from "../lib/planConfig";
import {
  ALL_LOOKUP_KEYS,
  cadenceForLookupKey,
  isKnownLookupKey,
  planForLookupKey,
  type StripeLookupKey,
} from "../lib/stripePlanMapping";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Hydrate `req.authUser` for every billing route. The router is mounted
// in routes/index.ts without a path prefix, so without this guard each
// handler's `if (!user?.tenantId)` check would 401 every valid session
// (cookies are present, but nothing parses them into req.authUser).
router.use("/billing", requireAuth);

interface TenantBillingRow {
  id: number;
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | number | null;
  stripe_cancel_at_period_end: boolean | null;
  stripe_price_lookup_key: string | null;
  stripe_cadence: string | null;
  stripe_unit_amount: string | number | null;
  stripe_currency: string | null;
  stripe_payment_brand: string | null;
  stripe_payment_last4: string | null;
  trial_started_at: string | Date | null;
  trial_expires_at: string | Date | null;
  has_trialed_before: boolean | null;
}

const TENANT_COLUMNS = `
  id, plan,
  stripe_customer_id, stripe_subscription_id,
  stripe_subscription_status, stripe_current_period_end,
  stripe_cancel_at_period_end, stripe_price_lookup_key,
  stripe_cadence, stripe_unit_amount, stripe_currency,
  stripe_payment_brand, stripe_payment_last4,
  trial_started_at, trial_expires_at, has_trialed_before
`;

async function loadTenant(tenantId: number): Promise<TenantBillingRow | null> {
  const r = await pool.query<TenantBillingRow>(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return r.rows[0] ?? null;
}

function isTenantAdmin(req: Request): boolean {
  const u = req.authUser;
  if (!u) return false;
  return !!(u.isAdmin || u.permissions?.["settings"] || u.appUserRole === "superadmin");
}

function returnUrl(req: Request, path: string): string {
  const proto = req.protocol;
  const host = req.get("host");
  return `${proto}://${host}${path}`;
}

// Delegates to `stripeClient.getPriceIdForLookupKey`, which honors the
// `STRIPE_PRICE_GROWTH_MONTHLY` / `STRIPE_PRICE_GROWTH_ANNUAL` env-var
// contract before falling back to a live `prices.list({ lookup_keys })`.
async function resolvePriceId(stripe: Stripe, lookupKey: string): Promise<string> {
  return getPriceIdForLookupKey(stripe, lookupKey);
}

function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/billing/summary — DB-only. The webhook keeps the snapshot
// columns fresh; we never hit the Stripe API here so the page loads
// fast and stays available during Stripe API incidents.
router.get("/billing/summary", async (req: Request, res: Response): Promise<void> => {
  const user = req.authUser;
  if (!user?.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const tenant = await loadTenant(user.tenantId);
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  // Route through getTenantPlan so protected enterprise tenants (Dandy) keep
  // their tier, and read features from the live (SuperAdmin-editable) accessor
  // instead of the static map so the billing page can't drift.
  const plan: Plan = await getTenantPlan(user.tenantId);
  const features = await getPlanFeatures(plan);

  // We consider Stripe "configured for this deployment" when we can mint
  // a client without an error — but we still serve summary even when not
  // configured (so the page renders the current plan-only view).
  let stripeConfigured = false;
  try { await getStripe(); stripeConfigured = true; }
  catch (err) {
    if (!(err instanceof StripeNotConfiguredError)) {
      // Surface unexpected errors instead of pretending Stripe is missing.
      logger.error({ err }, "[billing] getStripe() failed for non-config reason");
    }
  }

  const subscription =
    tenant.stripe_subscription_id == null
      ? null
      : {
          status: tenant.stripe_subscription_status,
          cancelAtPeriodEnd: tenant.stripe_cancel_at_period_end ?? false,
          currentPeriodEnd: toNumberOrNull(tenant.stripe_current_period_end),
          cadence: (tenant.stripe_cadence as "monthly" | "annual" | null) ?? null,
          lookupKey: tenant.stripe_price_lookup_key,
          unitAmount: toNumberOrNull(tenant.stripe_unit_amount),
          currency: tenant.stripe_currency,
        };

  // DB-driven trial state (NOT Stripe's `trialing` status — our trials are
  // card-free and tracked on the tenant row). `plan` above already reflects
  // the trial tier while active because getTenantPlan() routes through
  // effectivePlan(); this block just exposes the window for the UI.
  const trial = computeTrialState({
    trialStartedAt: tenant.trial_started_at,
    trialExpiresAt: tenant.trial_expires_at,
  });

  res.json({
    plan,
    features,
    trial: {
      active: trial.active,
      expired: trial.expired,
      daysRemaining: trial.daysRemaining,
      startedAt: trial.startedAt ? trial.startedAt.toISOString() : null,
      expiresAt: trial.expiresAt ? trial.expiresAt.toISOString() : null,
      hasTrialedBefore: tenant.has_trialed_before ?? false,
    },
    stripe: {
      configured: stripeConfigured,
      customerId: tenant.stripe_customer_id,
      subscriptionId: tenant.stripe_subscription_id,
      subscription,
      paymentMethod:
        tenant.stripe_payment_brand || tenant.stripe_payment_last4
          ? { brand: tenant.stripe_payment_brand, last4: tenant.stripe_payment_last4 }
          : null,
    },
  });
});

// POST /api/billing/checkout-session
//
// Body: { priceLookupKey: "growth_monthly" | "growth_annual" }
//
// Preconditions:
//   • Caller is a workspace admin (settings perm or isAdmin or superadmin).
//   • Tenant is NOT already on the tier the requested price maps to with
//     an active/trialing subscription — refusing here avoids paying twice
//     for the same tier when the user double-clicks the upgrade button.
//
// Side effects:
//   • On first upgrade attempt for a tenant with no `stripe_customer_id`,
//     we create the Stripe customer eagerly (with the workspace-admin
//     email and `metadata.tenantId`) and persist the id before the
//     Checkout session is opened. This guarantees we always have a
//     stable customer to point the Billing Portal at, even if the user
//     abandons Checkout halfway.
router.post("/billing/checkout-session", async (req: Request, res: Response): Promise<void> => {
  const user = req.authUser;
  if (!user?.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!isTenantAdmin(req)) { res.status(403).json({ error: "Workspace admin required" }); return; }

  const priceLookupKey = String(req.body?.priceLookupKey ?? "");
  if (!isKnownLookupKey(priceLookupKey)) {
    res.status(400).json({
      error: `priceLookupKey must be one of: ${ALL_LOOKUP_KEYS.join(", ")}`,
    });
    return;
  }

  const tenant = await loadTenant(user.tenantId);
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  const requestedPlan = planForLookupKey(priceLookupKey);
  const requestedCadence = cadenceForLookupKey(priceLookupKey);
  const currentPlan = normalizePlan(tenant.plan);
  const activeStatuses = new Set(["active", "trialing", "past_due"]);
  // Refuse Checkout whenever the requested TIER already matches the
  // tenant's current canonical tier AND a live Stripe subscription
  // exists. Same-tier Checkout would create a second parallel
  // subscription in Stripe (the user would be charged twice), which is
  // exactly the duplicate-billing risk this guard exists to prevent.
  //
  // The guard intentionally ignores cadence: switching monthly↔annual
  // is a billing-portal action (it modifies the existing subscription
  // item; Stripe handles proration), NOT a new Checkout flow. We point
  // the operator at /settings/billing → "Manage billing" instead.
  //
  // Applies to EVERY self-serve tier (starter included). `priceLookupKey`
  // is always a paid lookup key here — `free` has no key and can never be
  // requestedPlan.
  //
  // CRITICAL: Checkout (`mode:"subscription"`) ALWAYS creates a NEW
  // subscription. So once a tenant has ANY live subscription, every change —
  // tier up/down OR cadence — must go through the Stripe billing portal
  // (which MODIFIES the existing subscription, with proration). Routing a
  // tier change back through Checkout would leave the old subscription
  // running and double-bill the tenant. Checkout is therefore reserved for
  // tenants with no active subscription.
  const hasActiveSub =
    tenant.stripe_subscription_id != null &&
    activeStatuses.has(tenant.stripe_subscription_status ?? "");
  if (hasActiveSub) {
    const isTierChange = requestedPlan !== currentPlan;
    const isCadenceChange = tenant.stripe_cadence !== requestedCadence;
    res.status(409).json({
      error: isTierChange
        ? `Tenant is already on ${currentPlan} with a live subscription. To switch to ${requestedPlan}, open Manage billing (Stripe portal) — a new checkout would create a second subscription and double-bill.`
        : isCadenceChange
          ? `Tenant is already on ${currentPlan}. To switch ${tenant.stripe_cadence ?? "current"} → ${requestedCadence} billing, open Manage billing (Stripe portal) instead of starting a new checkout.`
          : `Tenant is already on ${currentPlan} (${requestedCadence}). Use Manage billing to change payment details.`,
      code: isTierChange
        ? "use_portal_for_tier_change"
        : isCadenceChange
          ? "use_portal_for_cadence_change"
          : "already_on_tier",
    });
    return;
  }

  let stripe: Stripe;
  try { stripe = await getStripe(); }
  catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      res.status(503).json({ error: "Billing is not configured on this deployment" });
      return;
    }
    throw err;
  }

  try {
    // Resolve a STABLE workspace-admin email for the Stripe customer
    // record. We deliberately do NOT just use `user.email` (the acting
    // user) because a superadmin (Dandy operator) running checkout on
    // behalf of a tenant would otherwise attach the operator's email
    // to the tenant's Stripe customer — billing receipts and dunning
    // emails would then go to the wrong inbox.
    //
    // Resolution order:
    //   1. Earliest-accepted tenant admin (stable billing contact;
    //      `accepted_at ASC` so the founding admin wins).
    //   2. Acting user's email — only if they're a tenant admin
    //      themselves (i.e., not a superadmin acting on behalf).
    //      This is the common path: a normal tenant admin runs
    //      checkout for their own workspace.
    const adminEmailRow = await pool.query<{ email: string }>(
      `SELECT lower(tm.email) AS email
         FROM tenant_members tm
         JOIN tenant_roles tr ON tr.id = tm.role_id
        WHERE tm.tenant_id = $1
          AND tr.is_admin = true
          AND tm.accepted_at IS NOT NULL
          AND tm.email IS NOT NULL AND tm.email <> ''
        ORDER BY tm.accepted_at ASC
        LIMIT 1`,
      [tenant.id],
    );
    const adminEmail =
      adminEmailRow.rows[0]?.email ??
      (user.appUserRole !== "superadmin" ? user.email : null);
    if (!adminEmail) {
      // No accepted tenant admin AND the actor is a superadmin —
      // refuse to silently attach the operator email. The tenant must
      // accept at least one admin invite first.
      res.status(409).json({
        error: "This tenant has no accepted workspace admin yet; cannot create a Stripe customer. Have an admin accept their invite first.",
        code: "no_workspace_admin",
      });
      return;
    }

    // Create the Stripe customer eagerly on first attempt so we always
    // have a stable id to use for the billing portal, even if Checkout
    // is abandoned. Idempotency key = tenant id, so retries don't create
    // duplicates.
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: adminEmail,
          metadata: { tenantId: String(tenant.id) },
        },
        { idempotencyKey: `tenant-${tenant.id}-customer-create` },
      );
      customerId = customer.id;
      await pool.query(
        `UPDATE tenants
            SET stripe_customer_id = COALESCE(stripe_customer_id, $1),
                updated_at = now()
          WHERE id = $2`,
        [customerId, tenant.id],
      );
    }

    const priceId = await resolvePriceId(stripe, priceLookupKey as StripeLookupKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      client_reference_id: String(tenant.id),
      metadata: { tenantId: String(tenant.id) },
      subscription_data: {
        metadata: { tenantId: String(tenant.id) },
      },
      allow_promotion_codes: true,
      success_url: returnUrl(req, "/settings/billing?status=success&session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: returnUrl(req, "/settings/billing?status=cancelled"),
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error(
      { err, tenantId: tenant.id, priceLookupKey },
      "[billing] checkout-session failed",
    );
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Failed to create checkout session: ${message}` });
  }
});

// POST /api/billing/downgrade-to-free
//
// Self-serve "end my trial early / drop to Free" action. Bounded on purpose:
// the ONLY plan it ever writes is the canonical `free` floor, and it refuses
// any state where a direct write would be wrong.
//
// Preconditions:
//   • Caller is a workspace admin.
//   • Tenant is NOT a protected enterprise (Dandy) workspace — those always
//     resolve to enterprise and must never be downgraded.
//   • Tenant has NO live Stripe subscription. Cancelling a paid subscription
//     must run through the Stripe Billing Portal so billing actually stops;
//     flipping `plan='free'` here would revoke entitlements while Stripe kept
//     charging. We 409 with `use_portal_to_cancel` and point at the portal.
//
// Effect (idempotent): floors `plan` at `free`, ends an in-progress trial
// window immediately (so `effectivePlan` stops lifting the tenant to Growth),
// and stamps `has_trialed_before` so the consumed trial can't be restarted.
// Safe to call when the tenant is already Free with no trial — it's a no-op.
router.post("/billing/downgrade-to-free", async (req: Request, res: Response): Promise<void> => {
  const user = req.authUser;
  if (!user?.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!isTenantAdmin(req)) { res.status(403).json({ error: "Workspace admin required" }); return; }

  const tenant = await loadTenant(user.tenantId);
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

  // Protected enterprise (Dandy) — sales-assisted, never downgraded.
  if (await isDandyTenant(tenant.id)) {
    res.status(403).json({
      error: "This workspace is on an enterprise plan and can't be downgraded here. Contact your account manager.",
      code: "protected_enterprise",
    });
    return;
  }

  // A live subscription must be cancelled through the Stripe portal so billing
  // stops — a direct plan write would strip features but keep charging.
  const activeStatuses = new Set(["active", "trialing", "past_due"]);
  const hasActiveSub =
    tenant.stripe_subscription_id != null &&
    activeStatuses.has(tenant.stripe_subscription_status ?? "");
  if (hasActiveSub) {
    res.status(409).json({
      error: "This workspace has a live subscription. Cancel it from Manage billing (Stripe portal) to drop to Free — that also stops billing.",
      code: "use_portal_to_cancel",
    });
    return;
  }

  // SET expressions evaluate against the pre-update row, so we can branch on
  // the existing trial columns: close an still-open window to `now()`, leave a
  // past/absent one untouched, and only stamp `has_trialed_before` when a trial
  // actually existed (don't burn a never-used trial for a plain Free tenant).
  await pool.query(
    `UPDATE tenants
        SET plan = 'free',
            ${CLOSE_TRIAL_ON_FREE_SQL.trim()},
            updated_at = now()
      WHERE id = $1`,
    [tenant.id],
  );

  logger.info({ tenantId: tenant.id }, "[billing] tenant downgraded to free (end-trial)");
  res.json({ plan: "free" as Plan, ok: true });
});

// POST /api/billing/portal-session — opens the Stripe-hosted billing
// portal. 409 when the tenant has never been linked to a Stripe customer.
router.post("/billing/portal-session", async (req: Request, res: Response): Promise<void> => {
  const user = req.authUser;
  if (!user?.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!isTenantAdmin(req)) { res.status(403).json({ error: "Workspace admin required" }); return; }
  const tenant = await loadTenant(user.tenantId);
  if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
  if (!tenant.stripe_customer_id) {
    res.status(409).json({ error: "This workspace has no Stripe customer yet. Upgrade first." });
    return;
  }
  let stripe: Stripe;
  try { stripe = await getStripe(); }
  catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      res.status(503).json({ error: "Billing is not configured on this deployment" });
      return;
    }
    throw err;
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: returnUrl(req, "/settings/billing"),
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err, tenantId: tenant.id }, "[billing] portal-session failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Failed to open billing portal: ${message}` });
  }
});

export default router;
