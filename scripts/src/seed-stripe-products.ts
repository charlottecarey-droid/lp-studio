// Seed Stripe with the LP Studio packaging catalog. Idempotent — re-running
// it does NOT create duplicates: each price is keyed by `lookup_key` and
// each product is keyed by `metadata.lpstudio_plan`. The lookup_keys here
// MUST stay in sync with `artifacts/api-server/src/lib/stripePlanMapping.ts`
// — that file maps them back to canonical plan tiers at webhook time.
//
// Run:
//   pnpm --filter @workspace/scripts exec tsx src/seed-stripe-products.ts
//
// Stripe test vs live mode is decided by the secret key (sk_test_* or
// sk_live_*). The Replit connector returns the appropriate one based on
// the workspace's integration settings; the STRIPE_SECRET_KEY env var
// override lets you run this against any account on demand.
import type Stripe from "stripe";
import { getStripe } from "./stripeClient";

const PLAN_METADATA_KEY = "lpstudio_plan";

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

// Single source of truth for catalog contents. Bump prices / add cadences
// here, then re-run the script.
const CATALOG: ProductSeed[] = [
  {
    planSlug: "growth",
    name: "LP Studio Growth",
    description: "Self-serve workspace plan. Unlocks the Sales Console, custom domains, and unlimited landing pages.",
    prices: [
      { lookupKey: "growth_monthly", unitAmount: 19900, interval: "month", nickname: "Growth · Monthly" },
      { lookupKey: "growth_annual",  unitAmount: 199000, interval: "year",  nickname: "Growth · Annual"  },
    ],
  },
];

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
  const existing = await findExistingPrice(stripe, seed.lookupKey);
  if (existing) {
    // Stripe prices are immutable except for nickname/metadata/active.
    // If the seeded amount or interval differs we cannot edit in place;
    // refuse loudly so the operator decides whether to deactivate the old
    // one and re-run, vs. accept the existing price unchanged.
    const sameAmount = existing.unit_amount === seed.unitAmount;
    const sameInterval = existing.recurring?.interval === seed.interval;
    if (!sameAmount || !sameInterval) {
      console.warn(
        `! Price ${seed.lookupKey} exists with mismatched amount/interval ` +
          `(have $${(existing.unit_amount ?? 0) / 100}/${existing.recurring?.interval}, ` +
          `want $${seed.unitAmount / 100}/${seed.interval}). Deactivate the existing price in Stripe and re-run.`,
      );
      return existing;
    }
    console.log(`✓ Price exists: ${seed.lookupKey} (${existing.id})`);
    return stripe.prices.update(existing.id, { nickname: seed.nickname });
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: seed.unitAmount,
    currency: "usd",
    recurring: { interval: seed.interval },
    lookup_key: seed.lookupKey,
    nickname: seed.nickname,
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
  for (const seed of CATALOG) {
    const product = await upsertProduct(stripe, seed);
    for (const priceSeed of seed.prices) {
      await upsertPrice(stripe, product, priceSeed);
    }
  }
  console.log("Done. Lookup keys ready: " + CATALOG.flatMap(p => p.prices.map(pr => pr.lookupKey)).join(", "));
}

main().catch((err) => {
  console.error("seed-stripe-products failed:", err);
  process.exit(1);
});
