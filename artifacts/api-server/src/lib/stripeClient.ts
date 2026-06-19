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
import pg from "pg";
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
 * The publicly-reachable HTTPS URL the managed webhook is registered against.
 * Inferred from PUBLIC_API_BASE_URL or REPLIT_DEV_DOMAIN. Returns null when
 * neither is set (no public host to register). Shared by the boot-time
 * `findOrCreateManagedWebhook` call in server.ts and the dev test-mode secret
 * fallback below so the two can never disagree on which webhook row is "ours".
 */
export function getManagedWebhookUrl(): string | null {
  const base =
    process.env.PUBLIC_API_BASE_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/stripe/webhook`;
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

  // Dev/staging TEST-mode fallback. When a Stripe TEST key stands in for the
  // live key (see loadEnv.ts), STRIPE_WEBHOOK_SECRET is intentionally blank,
  // so verify against the secret of the managed webhook this instance created
  // at boot. Scoped to THIS instance's webhook URL so the live and test
  // managed-webhook rows (which share one DB) can never cross over. In
  // production STRIPE_WEBHOOK_SECRET is always set, so this branch never runs.
  const managedUrl = getManagedWebhookUrl();
  if (managedUrl) {
    try {
      const { connectionString } = buildSyncPoolConfig();
      const pool = new pg.Pool({ connectionString });
      try {
        const r = await pool.query<{ secret: string }>(
          `SELECT secret FROM "stripe"."_managed_webhooks" WHERE url = $1 LIMIT 1`,
          [managedUrl],
        );
        const secret = r.rows[0]?.secret;
        if (secret) return secret;
      } finally {
        await pool.end();
      }
    } catch (err) {
      logger.warn({ err }, "[stripe] managed-webhook secret DB fallback failed");
    }
  }

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
 * Final shape of `stripe.accounts` as shipped by the installed
 * `stripe-replit-sync` version. This is the *net* result of the package's
 * own migrations applied in order:
 *   - 0046_sync_status_per_account — CREATE TABLE accounts (raw_data JSONB +
 *     generated columns + first/last_synced_at/updated_at).
 *   - 0047_api_key_hashes          — ADD COLUMN api_key_hashes TEXT[] + GIN.
 *   - 0048_rename_reserved_columns — rename raw_data→_raw_data,
 *     last_synced_at→_last_synced_at, updated_at→_updated_at, and redefine
 *     set_updated_at() to write _updated_at. (first_synced_at is NOT renamed.)
 *   - 0050_rename_id_to_match_stripe_api — drop _id, add `id` as a STORED
 *     generated column from _raw_data->>'id' and make it the PRIMARY KEY.
 *
 * Kept verbatim-equivalent to those files so the generated columns,
 * constraints and trigger match exactly what the sync engine expects.
 * Fully idempotent (CREATE OR REPLACE / IF NOT EXISTS / DROP … IF EXISTS) so
 * it is safe on every boot and on a partially-created table. Foreign keys
 * back to `accounts` are intentionally omitted — they are integrity-only and
 * not required by upsertAccount / getAccountId / findOrCreateManagedWebhook,
 * and re-adding them would risk failing on an already-wired schema.
 */
const STRIPE_ACCOUNTS_SELF_HEAL_SQL = `
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
AS $$
begin
  new._updated_at = now();
  return NEW;
end;
$$;

CREATE TABLE IF NOT EXISTS "stripe"."accounts" (
  _raw_data JSONB NOT NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  _last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  _updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  business_name TEXT GENERATED ALWAYS AS ((_raw_data->'business_profile'->>'name')::text) STORED,
  email TEXT GENERATED ALWAYS AS ((_raw_data->>'email')::text) STORED,
  type TEXT GENERATED ALWAYS AS ((_raw_data->>'type')::text) STORED,
  charges_enabled BOOLEAN GENERATED ALWAYS AS ((_raw_data->>'charges_enabled')::boolean) STORED,
  payouts_enabled BOOLEAN GENERATED ALWAYS AS ((_raw_data->>'payouts_enabled')::boolean) STORED,
  details_submitted BOOLEAN GENERATED ALWAYS AS ((_raw_data->>'details_submitted')::boolean) STORED,
  country TEXT GENERATED ALWAYS AS ((_raw_data->>'country')::text) STORED,
  default_currency TEXT GENERATED ALWAYS AS ((_raw_data->>'default_currency')::text) STORED,
  created INTEGER GENERATED ALWAYS AS ((_raw_data->>'created')::integer) STORED,
  api_key_hashes TEXT[] DEFAULT '{}',
  id TEXT GENERATED ALWAYS AS ((_raw_data->>'id')::text) STORED PRIMARY KEY
);

CREATE INDEX IF NOT EXISTS idx_accounts_business_name
  ON "stripe"."accounts" (business_name);
CREATE INDEX IF NOT EXISTS idx_accounts_api_key_hashes
  ON "stripe"."accounts" USING GIN (api_key_hashes);

DROP TRIGGER IF EXISTS handle_updated_at ON "stripe"."accounts";
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON "stripe"."accounts"
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();
`;

/**
 * Durable self-heal for `stripe.accounts`. The `stripe-replit-sync` migration
 * runner dedups by its own high-water mark in `stripe._migrations`: on a DB
 * whose tracker records `0046`+ as applied while the table is actually absent
 * (schema drift), re-running the package migrations will NOT recreate it. That
 * leaves `findOrCreateManagedWebhook` and account sync (`upsertAccount` /
 * `getAccountId`) failing with `relation "stripe.accounts" does not exist`
 * (Postgres 42P01) even though boot logs "sync schema migrations applied".
 *
 * Same self-heal contract as the notifications (0041) / workflow_send_failures
 * (0051) steps in `migrate.ts`: idempotent, independent of the package's dedup,
 * and fails LOUDLY if the table still isn't present afterward. The cheap
 * existence probe means healthy DBs only pay for one or two SELECTs; only a
 * drifted DB runs the DDL.
 *
 * Crucially, the heal is GATED on the package tracker. Unlike the drizzle
 * self-heals, `stripe-replit-sync` ALSO tries to create `accounts` (in its
 * `0046` migration, whose `CREATE TRIGGER handle_updated_at` is NOT idempotent).
 * If we pre-created the final-shape table on a DB whose tracker has not yet
 * reached the last accounts migration (`0050_rename_id_to_match_stripe_api`),
 * the package's next run of `0046`/`0047`/… would collide with our objects and
 * wedge the migration runner forever. So we only recreate `accounts` when the
 * tracker shows `0050` applied (i.e. the package believes the final-shape table
 * exists but it has actually drifted away — the bug this fixes). On any
 * earlier/fresh tracker state we defer creation to the package's own
 * migrations and never touch the schema.
 */
const ACCOUNTS_FINAL_MIGRATION = "rename_id_to_match_stripe_api"; // 0050

async function ensureStripeAccountsTable(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  try {
    const before = await pool.query<{ present: boolean }>(
      `SELECT to_regclass('stripe.accounts') IS NOT NULL AS present`,
    );
    if (before.rows[0]?.present) {
      // Healthy: the package (or a prior heal) already built the table.
      return;
    }

    // `accounts` is absent. Only treat this as drift — and recreate the table —
    // when the package tracker records the final accounts migration as applied.
    // The tracker table itself may not exist yet on a brand-new DB, so probe it
    // first (referencing a missing relation directly would fail at plan time).
    const trackerPresent = await pool.query<{ present: boolean }>(
      `SELECT to_regclass('stripe._migrations') IS NOT NULL AS present`,
    );
    let finalMigrationApplied = false;
    if (trackerPresent.rows[0]?.present) {
      const applied = await pool.query<{ applied: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM stripe._migrations WHERE name = $1) AS applied`,
        [ACCOUNTS_FINAL_MIGRATION],
      );
      finalMigrationApplied = applied.rows[0]?.applied ?? false;
    }

    if (!finalMigrationApplied) {
      // Fresh or mid-migration DB: the package will create `accounts` itself on
      // this (or a subsequent) run. Pre-creating it here would collide with the
      // package's non-idempotent DDL, so leave the schema untouched.
      logger.info(
        { src: "stripe-sync" },
        "[stripe] stripe.accounts absent and package tracker below 0050 — deferring creation to package migrations",
      );
      return;
    }

    logger.warn(
      { src: "stripe-sync" },
      "[stripe] stripe.accounts missing despite applied migrations — self-healing schema drift",
    );
    // Single string argument → node-postgres uses the SIMPLE query protocol,
    // which allows the file's multiple statements in one round-trip.
    await pool.query(STRIPE_ACCOUNTS_SELF_HEAL_SQL);

    const after = await pool.query<{ present: boolean }>(
      `SELECT to_regclass('stripe.accounts') IS NOT NULL AS present`,
    );
    if (!after.rows[0]?.present) {
      throw new Error(
        "stripe.accounts self-heal did not produce the table — aborting stripe init",
      );
    }
  } finally {
    await pool.end();
  }
}

/**
 * Runs `stripe-replit-sync`'s schema migrations. Idempotent and safe to
 * run on every boot. Creates the `stripe.*` schema and all Stripe entity
 * tables (products, prices, customers, subscriptions, …), then self-heals
 * `stripe.accounts` if it drifted out of existence (see
 * `ensureStripeAccountsTable`).
 */
export async function runStripeSyncSchemaMigrations(): Promise<void> {
  const { connectionString } = buildSyncPoolConfig();
  await runStripeSyncMigrations({ databaseUrl: connectionString });
  await ensureStripeAccountsTable(connectionString);
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
