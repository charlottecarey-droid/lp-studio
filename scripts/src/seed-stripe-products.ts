// Seed Stripe with the LP Studio packaging catalog. Idempotent — re-running
// it does NOT create duplicates: each price is keyed by `lookup_key` and
// each product is keyed by `metadata.lpstudio_plan`.
//
// SINGLE SOURCE OF TRUTH: the catalog is DERIVED from `@workspace/plan-config`
// (PLAN_CONFIG). Display names + prices come from there so Stripe can never
// drift from the marketing page / in-app gates. The lookup_keys are produced
// via `lookupKeyFor`, which the webhook uses in reverse to map a subscription
// back to a tier — so a rename touches exactly one mapping file.
//
// Run:
//   pnpm --filter @workspace/scripts exec tsx src/seed-stripe-products.ts
//
// Stripe test vs live mode is decided by the secret key (sk_test_* or
// sk_live_*). The Replit connector returns the appropriate one based on
// the workspace's integration settings; the STRIPE_SECRET_KEY env var
// override lets you run this against any account on demand.
import type Stripe from "stripe";
import { PLAN_CONFIG, PLANS, type PlanConfigEntry } from "@workspace/plan-config";
import { getStripe } from "./stripeClient";

const PLAN_METADATA_KEY = "lpstudio_plan";

// The Stripe-purchasable tiers and billing cadences. Kept as local literals
// (rather than importing from the api-server package, which would cross the
// scripts rootDir boundary) — the `<tier>_<cadence>` lookup-key convention is
// asserted to match `lookupKeyFor` by a test in
// `artifacts/api-server/src/lib/stripePlanMapping.test.ts`, so the two cannot
// drift silently.
type SelfServePaidPlan = "starter" | "growth" | "scale";
type Cadence = "monthly" | "annual";

// Mirror of `lookupKeyFor(plan, cadence)` in stripePlanMapping.ts.
function lookupKeyFor(plan: SelfServePaidPlan, cadence: Cadence): string {
  return `${plan}_${cadence}`;
}

interface ProductSeed {
  planSlug: string;        // value written to metadata.lpstudio_plan
  name: string;
  description: string;
  prices: PriceSeed[];
}

interface PriceSeed {
  lookupKey: string;
  unitAmount: number;      // cents
  interval: "month" | "year";
  nickname: string;
}

// The Stripe-purchasable tiers, in display order. `free` (no Stripe) and
// `enterprise` (sales-assisted) are intentionally excluded.
const SELF_SERVE_PAID: readonly SelfServePaidPlan[] = ["starter", "growth", "scale"];

const PLAN_DESCRIPTIONS: Record<SelfServePaidPlan, string> = {
  starter:
    "Paid floor. Removes the “Powered by” badge, adds custom domains and higher page/form caps.",
  growth:
    "Adds the Sales Console and generous caps on top of Starter — for teams running active campaigns.",
  scale:
    "Everything in Growth plus AI image generation and higher seat caps — for scaling go-to-market teams.",
};

// Convert a per-month USD figure into the Stripe `unit_amount` (cents) for a
// given cadence. Annual is billed yearly at the per-month annual rate × 12.
function unitAmountFor(entry: PlanConfigEntry, cadence: Cadence): number {
  if (cadence === "monthly") {
    if (entry.priceMonthly == null) throw new Error(`${entry.tier} has no priceMonthly`);
    return Math.round(entry.priceMonthly * 100);
  }
  if (entry.priceAnnual == null) throw new Error(`${entry.tier} has no priceAnnual`);
  return Math.round(entry.priceAnnual * 12 * 100);
}

// Build the catalog from canonical config. Each self-serve tier gets a
// product with a monthly + annual price.
function buildCatalog(): ProductSeed[] {
  return SELF_SERVE_PAID.map((tier) => {
    const entry = PLAN_CONFIG[tier];
    const prices: PriceSeed[] = (["monthly", "annual"] as const).map((cadence) => ({
      lookupKey: lookupKeyFor(tier, cadence),
      unitAmount: unitAmountFor(entry, cadence),
      interval: cadence === "monthly" ? "month" : "year",
      nickname: `${entry.displayName} · ${cadence === "monthly" ? "Monthly" : "Annual"}`,
    }));
    return {
      planSlug: tier,
      name: `LP Studio ${entry.displayName}`,
      description: PLAN_DESCRIPTIONS[tier],
      prices,
    };
  });
}

const CATALOG: ProductSeed[] = buildCatalog();

async function findExistingProduct(stripe: Stripe, planSlug: string): Promise<Stripe.Product | null> {
  // products.search supports metadata filters; covers the case where the
  // product exists under a different name (e.g. someone renamed it in the
  // Stripe dashboard).
  const r = await stripe.products.search({
    query: `metadata['${PLAN_METADATA_KEY}']:'${planSlug}' AND active:'true'`,
    limit: 1,
  });
  return r.data[0] ?? null;
}

async function findExistingPrice(stripe: Stripe, lookupKey: string): Promise<Stripe.Price | null> {
  const r = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return r.data[0] ?? null;
}

async function upsertProduct(stripe: Stripe, seed: ProductSeed): Promise<Stripe.Product> {
  const existing = await findExistingProduct(stripe, seed.planSlug);
  if (existing) {
    console.log(`✓ Product exists: ${existing.name} (${existing.id})`);
    // Touch description / name so the dashboard reflects current copy.
    return stripe.products.update(existing.id, {
      name: seed.name,
      description: seed.description,
    });
  }
  const created = await stripe.products.create({
    name: seed.name,
    description: seed.description,
    metadata: { [PLAN_METADATA_KEY]: seed.planSlug },
  });
  console.log(`+ Created product: ${created.name} (${created.id})`);
  return created;
}

async function upsertPrice(stripe: Stripe, product: Stripe.Product, seed: PriceSeed): Promise<Stripe.Price> {
  const tier = product.metadata?.[PLAN_METADATA_KEY] ?? "";
  const existing = await findExistingPrice(stripe, seed.lookupKey);
  if (existing) {
    const sameAmount = existing.unit_amount === seed.unitAmount;
    const sameInterval = existing.recurring?.interval === seed.interval;
    if (sameAmount && sameInterval) {
      console.log(`✓ Price exists: ${seed.lookupKey} (${existing.id})`);
      // Backfill the tier marker on already-correct prices too, so the
      // webhook's metadata fallback can resolve grandfathered subscriptions
      // even after a future re-key clears the lookup_key.
      return stripe.prices.update(existing.id, {
        nickname: seed.nickname,
        metadata: { [PLAN_METADATA_KEY]: tier },
      });
    }
    // Stripe prices are immutable on amount/interval. To change them we
    // ARCHIVE the old price (deactivate it AND free its lookup_key so the
    // new price can claim it) then create the replacement. Existing
    // subscriptions stay on the old price until they renew/are migrated;
    // new checkouts resolve the lookup_key to the new price.
    console.warn(
      `! Price ${seed.lookupKey} changed ` +
        `(have $${(existing.unit_amount ?? 0) / 100}/${existing.recurring?.interval}, ` +
        `want $${seed.unitAmount / 100}/${seed.interval}). Archiving old price ${existing.id}…`,
    );
    await stripe.prices.update(existing.id, {
      active: false,
      // Move the lookup_key OFF the old price so the create below can take
      // it. (transfer_lookup_key on create also handles this, but doing it
      // explicitly keeps the archived price clearly disassociated.)
      lookup_key: "",
      nickname: `${seed.nickname} (archived)`,
      // Stamp the canonical tier so the webhook can still resolve any
      // subscriptions grandfathered onto this now-keyless price.
      metadata: { [PLAN_METADATA_KEY]: tier },
    });
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: seed.unitAmount,
    currency: "usd",
    recurring: { interval: seed.interval },
    lookup_key: seed.lookupKey,
    nickname: seed.nickname,
    // Tier marker = webhook fallback when a future re-key clears lookup_key.
    metadata: { [PLAN_METADATA_KEY]: tier },
    // Allow lookup_key reuse across creates if a previous run left a
    // dangling inactive price — Stripe otherwise errors with
    // "lookup_key already in use".
    transfer_lookup_key: true,
  });
  console.log(`+ Created price: ${seed.nickname} → ${seed.lookupKey} (${created.id})`);
  return created;
}

async function main(): Promise<void> {
  const stripe = await getStripe();
  console.log(`Seeding LP Studio packaging to Stripe (${process.env.STRIPE_SECRET_KEY ? "env-var" : "connector"} mode)…`);
  console.log(`Tiers (from @workspace/plan-config): ${CATALOG.map((c) => c.planSlug).join(", ")}`);
  for (const seed of CATALOG) {
    const product = await upsertProduct(stripe, seed);
    for (const priceSeed of seed.prices) {
      await upsertPrice(stripe, product, priceSeed);
    }
  }
  console.log("Done. Lookup keys ready: " + CATALOG.flatMap(p => p.prices.map(pr => pr.lookupKey)).join(", "));
  // Reference PLANS so a future tier addition that forgets the catalog is
  // visible in `git blame` here. (No-op log of the full ladder.)
  console.log("Full tier ladder: " + PLANS.join(" → "));
}

main().catch((err) => {
  console.error("seed-stripe-products failed:", err);
  process.exit(1);
});
