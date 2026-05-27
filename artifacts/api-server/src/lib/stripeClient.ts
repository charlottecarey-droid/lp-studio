// Stripe SDK accessor + stripe-replit-sync wiring. Portable across hosts:
//   1. `STRIPE_SECRET_KEY` env var is checked FIRST. If present, the SDK is
//      constructed against it directly — no Replit connector required. This
//      is what self-hosted / non-Replit deploys (Render, Fly, EC2) use.
//   2. Otherwise we fall back to the Replit connectors broker, which fetches
//      a fresh key on every call so rotated credentials are picked up
//      automatically.
//
// The same env-first / connector-fallback ordering applies to
// `STRIPE_WEBHOOK_SECRET`.
//
// `STRIPE_ENABLED` gates *startup* (server.ts skips connector wiring and any
// best-effort webhook bootstrap when unset) but is NOT required to import
// this module — billing routes individually 503 when getStripe() throws.
//
// `getStripeSync()` returns a cached `StripeSync` instance from
// `stripe-replit-sync` — the Replit-managed sync engine that mirrors all
// Stripe data into a local Postgres `stripe.*` schema. The webhook handler
// delegates the heavy lifting to `stripeSync.processWebhook(buf, sig)` so
// the local schema stays current. Our routes layer queries the synced
// `stripe.subscriptions` / `stripe.prices` / `stripe.customers` tables for
// reads; we never INSERT into the `stripe.*` schema (the sync engine owns
// it).
import Stripe from "stripe";
import { StripeSync, runMigrations as runStripeSyncMigrations } from "stripe-replit-sync";
import { logger } from "./logger";

// Pin the API version so webhook payload shapes stay predictable across SDK
// upgrades. The string must match the literal type the installed SDK
// declares for `Stripe.StripeConfig["apiVersion"]` — see
// `node_modules/stripe/esm/apiVersion.d.ts` after every SDK bump and copy
// the value here.
const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

export class StripeNotConfiguredError extends Error {
  constructor(detail: string) {
    super(`Stripe is not configured: ${detail}`);
    this.name = "StripeNotConfiguredError";
  }
}

/**
 * Returns true when an explicit env-var configuration is present. Used by
 * the bootstrap to short-circuit the Replit connector path (e.g. on a
 * non-Replit host or in CI).
 */
export function hasExplicitStripeEnv(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

interface ReplitStripeCreds {
  secretKey: string;
  webhookSecret?: string | null;
}

/**
 * Fetches Stripe credentials from the Replit connector broker. Mirrors the
 * pattern in `.local/skills/stripe/references/code-templates.md` — not
 * cached, because broker tokens rotate.
 */
async function fetchReplitStripeCreds(): Promise<ReplitStripeCreds> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new StripeNotConfiguredError(
      "REPLIT_CONNECTORS_HOSTNAME / REPL_IDENTITY missing and STRIPE_SECRET_KEY env var is unset. Either set STRIPE_SECRET_KEY (portable) or connect the Stripe integration in the Replit workspace.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!resp.ok) {
    throw new StripeNotConfiguredError(
      `Replit connectors broker returned ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as { items?: { settings?: Record<string, unknown> }[] };
  const settings = data.items?.[0]?.settings;
  if (!settings || typeof settings.secret_key !== "string") {
    throw new StripeNotConfiguredError(
      "Stripe connector is not connected (no secret_key returned). Connect it via the Integrations tab.",
    );
  }
  return {
    secretKey: settings.secret_key as string,
    webhookSecret: (settings.webhook_secret as string | undefined) ?? null,
  };
}

/**
 * Returns a fresh authenticated Stripe SDK. Async because the connector path
 * needs a broker round-trip — the env-var path resolves immediately.
 *
 * NOT cached: connector credentials rotate; env-var lookups are free.
 */
export async function getStripe(): Promise<Stripe> {
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) {
    return new Stripe(envKey, { apiVersion: STRIPE_API_VERSION });
  }
  const { secretKey } = await fetchReplitStripeCreds();
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

/**
 * Returns the `whsec_*` secret used by `stripe.webhooks.constructEvent`.
 * Env var wins; the Replit connector's stored webhook secret is the
 * fallback. A managed webhook created by `stripe-replit-sync` writes its
 * secret to the `STRIPE_WEBHOOK_SECRET` env var (in dev: via Replit
 * secrets) before the handler is invoked.
 */
export async function getWebhookSecret(): Promise<string> {
  const envSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (envSecret) return envSecret;
  const { webhookSecret } = await fetchReplitStripeCreds();
  if (!webhookSecret) {
    throw new StripeNotConfiguredError(
      "no STRIPE_WEBHOOK_SECRET env var and the Replit connector did not return a webhook_secret. Set the env var or configure the webhook in the Stripe integration.",
    );
  }
  return webhookSecret;
}

// ---------- stripe-replit-sync wiring ----------------------------------

/**
 * Build the Postgres pool config the sync engine uses. We deliberately use
 * a SEPARATE pool from `@workspace/db` so the sync engine's connection
 * lifecycle (and the long-running webhook subscriber it owns) can't starve
 * our request pool under load.
 */
function buildSyncPoolConfig(): { connectionString: string } {
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new StripeNotConfiguredError(
      "DATABASE_URL is required for stripe-replit-sync but was not set.",
    );
  }
  return { connectionString };
}

let cachedSync: Promise<StripeSync> | null = null;

/**
 * Returns the singleton `StripeSync` instance. Throws
 * `StripeNotConfiguredError` if either Stripe credentials or the webhook
 * secret are unavailable. Cached because the underlying object owns a
 * Postgres pool and a Stripe HTTP client — re-creating it per webhook
 * would leak connections.
 */
export function getStripeSync(): Promise<StripeSync> {
  if (cachedSync) return cachedSync;
  cachedSync = (async () => {
    const envKey = process.env.STRIPE_SECRET_KEY;
    const secretKey = envKey ?? (await fetchReplitStripeCreds()).secretKey;
    // Webhook secret is OPTIONAL at construction — initStripe() in
    // server.ts will call `findOrCreateManagedWebhook` and the secret
    // will be available before the first webhook lands. processWebhook
    // requires it; if it's missing we'll see an explicit error there.
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? undefined;
    return new StripeSync({
      stripeSecretKey: secretKey,
      stripeWebhookSecret,
      stripeApiVersion: STRIPE_API_VERSION,
      poolConfig: buildSyncPoolConfig(),
      logger: {
        info: (...args) => logger.info({ src: "stripe-sync" }, ...(args as [string])),
        warn: (...args) => logger.warn({ src: "stripe-sync" }, ...(args as [string])),
        error: (...args) => logger.error({ src: "stripe-sync" }, ...(args as [string])),
      },
    });
  })().catch((err) => {
    // Reset on failure so the next call gets a fresh attempt (e.g.
    // connector recovers, env var added).
    cachedSync = null;
    throw err;
  });
  return cachedSync;
}

/**
 * Runs `stripe-replit-sync`'s schema migrations. Idempotent and safe to
 * run on every boot. Creates the `stripe.*` schema and all Stripe entity
 * tables (products, prices, customers, subscriptions, …).
 */
export async function runStripeSyncSchemaMigrations(): Promise<void> {
  const { connectionString } = buildSyncPoolConfig();
  await runStripeSyncMigrations({ databaseUrl: connectionString });
}

// ---------- Price resolution ------------------------------------------

/**
 * Resolve a `lookup_key` to a Stripe price id, honoring the env-var
 * contract that hosting platforms / CI typically wire up:
 *
 *   STRIPE_PRICE_GROWTH_MONTHLY=price_1ABCxyz...
 *   STRIPE_PRICE_GROWTH_ANNUAL=price_1DEFxyz...
 *
 * If the matching env var is set we return it directly (cheap, no API
 * round-trip; tolerant of `lookup_key` not yet being attached to the
 * price in Stripe). Otherwise we fall back to `stripe.prices.list({
 * lookup_keys })` — what the seed-stripe-products script makes work out
 * of the box.
 */
export async function getPriceIdForLookupKey(
  stripe: Stripe,
  lookupKey: string,
): Promise<string> {
  const envVarName = `STRIPE_PRICE_${lookupKey.toUpperCase()}`;
  const fromEnv = process.env[envVarName];
  if (fromEnv && fromEnv.startsWith("price_")) return fromEnv;

  const list = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = list.data[0];
  if (!price) {
    throw new Error(
      `Stripe price for lookup_key="${lookupKey}" not found. Set ${envVarName} to a price id (recommended) or run \`pnpm --filter @workspace/scripts run seed-stripe-products\` to seed prices with this lookup_key.`,
    );
  }
  return price.id;
}

/**
 * The webhook event set the billing subsystem cares about. Kept here so the
 * webhook bootstrap (if/when wired) and the dispatcher in `stripeWebhook.ts`
 * read from the same list.
 */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;
