// Main server entry. dotenv + `initSentry()` are loaded by `src/instrument.ts`
// via Node's `--import` flag (see package.json `start`) BEFORE this module is
// evaluated, so by the time express is imported below, Sentry has already
// hooked the module loader for express/http auto-instrumentation.
//
// Task #353 — schema setup no longer runs on boot. The full DDL + seed
// batch lives in `src/migrate.ts` and is invoked once per release via
// the artifact production build hook (`.replit-artifact/artifact.toml`
// chains `pnpm migrate` after build) and as part of the
// api-server dev script (development). Boot here is intentionally tiny:
// open the port, mark ready, schedule the periodic jobs.
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { invalidateTenantHostCache, WILDCARD_BASE_HOSTS } from "./lib/tenantHosts";
import { sendSlugRedirectExpiryWarning } from "./lib/notifications";
import { startSentryHeartbeat } from "./lib/sentryHeartbeat";
import { startCustomDomainPoller } from "./lib/customDomainPoller";
import { runAssetHealthCheck } from "./lib/assetHealthCheck";
import { runAssetsGc } from "./lib/assetsGc";
import { Sentry } from "./lib/sentry";
import { setReady } from "./lib/readiness";
import { getStripeSync, hasExplicitStripeEnv, runStripeSyncSchemaMigrations, WEBHOOK_EVENTS } from "./lib/stripeClient";

/**
 * Task #425 — Stripe gating diagnostic. Stripe credentials are resolved
 * lazily at the request level (see `lib/stripeClient.ts`), so there's no
 * synchronous init to run here. We just log the resolved configuration
 * source on boot so an operator can tell, at a glance, whether this
 * instance will accept Checkout / Portal / webhook calls.
 *
 * `STRIPE_ENABLED` is the kill-switch: when unset we skip even the
 * informational log so a stripeless dev boot stays quiet, and the
 * runtime routes (which 503 cleanly when no key is available) continue
 * to serve the rest of the API.
 */
function logStripeStartupStatus(): void {
  if (!process.env.STRIPE_ENABLED) {
    logger.info("[stripe] disabled (STRIPE_ENABLED unset) — billing routes will respond 503");
    return;
  }
  if (hasExplicitStripeEnv()) {
    logger.info("[stripe] enabled via STRIPE_SECRET_KEY env var (portable mode)");
  } else {
    logger.info("[stripe] enabled via Replit connector broker (workspace integration)");
  }
}

/**
 * Task #425 — initialize the stripe-replit-sync engine: run its DDL
 * migrations to create/upgrade the local `stripe.*` schema, ensure a
 * managed webhook endpoint exists in Stripe (so subscription events
 * actually arrive without manual dashboard setup), then kick off a
 * best-effort backfill so a fresh deploy doesn't start with an empty
 * mirror.
 *
 * Non-blocking and entirely best-effort: any failure here logs at error
 * level but does NOT crash the server or prevent ready. Billing routes
 * gracefully 503 if Stripe is unreachable; the rest of the API keeps
 * serving. We re-attempt on the next restart.
 *
 * Gated behind `STRIPE_ENABLED` so stripeless dev/test boots stay quiet
 * AND don't accidentally create a managed webhook against a live
 * account from a developer machine.
 */
async function initStripe(): Promise<void> {
  if (!process.env.STRIPE_ENABLED) return;
  try {
    await runStripeSyncSchemaMigrations();
    logger.info("[stripe] sync schema migrations applied");
  } catch (err) {
    logger.error({ err }, "[stripe] sync schema migrations failed (continuing without local mirror)");
    return;
  }
  try {
    const sync = await getStripeSync();
    // Wire (or reuse) a managed webhook so subscription events arrive
    // even on a fresh deploy. The webhook URL must be a publicly
    // reachable HTTPS endpoint; in production we infer it from
    // PUBLIC_API_BASE_URL or REPLIT_DEV_DOMAIN. If we can't build a
    // valid URL we skip — the operator can run the seed script
    // manually.
    const base =
      process.env.PUBLIC_API_BASE_URL ??
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
    if (base) {
      const url = `${base.replace(/\/$/, "")}/api/stripe/webhook`;
      try {
        const wh = await sync.findOrCreateManagedWebhook(url, {
          enabled_events: [...WEBHOOK_EVENTS] as unknown as Parameters<typeof sync.findOrCreateManagedWebhook>[1] extends infer P ? P extends { enabled_events?: infer E } ? E : never : never,
        });
        logger.info({ webhookId: wh.id, url }, "[stripe] managed webhook ensured");
      } catch (err) {
        logger.error({ err, url }, "[stripe] findOrCreateManagedWebhook failed (continuing)");
      }
    } else {
      logger.warn("[stripe] no PUBLIC_API_BASE_URL / REPLIT_DEV_DOMAIN — skipping managed webhook bootstrap");
    }
    // Fire-and-forget backfill so the local mirror catches up on
    // history. This can take a while on accounts with lots of data;
    // we deliberately don't await so server boot isn't blocked.
    void sync
      .syncBackfill()
      .then((counts) => logger.info({ counts }, "[stripe] initial syncBackfill complete"))
      .catch((err) => logger.error({ err }, "[stripe] syncBackfill failed (non-fatal)"));
  } catch (err) {
    logger.error({ err }, "[stripe] initStripe wiring failed (continuing without sync engine)");
  }
}

/**
 * Startup check for the LP-Studio prerender pipeline (task #364 follow-up).
 *
 * `triggerPublishedRender` shells out to Playwright against a base URL
 * resolved from `LP_STUDIO_RENDER_BASE_URL` (see `lib/prerenderLpPage.ts`
 * `resolveLpStudioBaseUrl`). If that env var is unset in production the
 * resolver falls through to `REPLIT_DEV_DOMAIN` (per-workspace, wrong DB
 * context) or `127.0.0.1:3000` (nothing listening) — Playwright either
 * fails or renders an empty page, R2 never gets written, and visitors
 * stay on the SSR fallback indefinitely with no surfaced error.
 *
 * In May 2026 this exact misconfiguration shipped silently and was only
 * caught when an operator noticed lpstudio.ai pages weren't appearing in
 * R2. This loud-on-boot check ensures the next regression is caught at
 * deploy time, not weeks later.
 *
 * Not fail-fast: the api-server still serves everything else (publish
 * itself succeeds, SSR fallback works, only the static-HTML cache is
 * stale) so a missing render base URL is degrade-not-crash. A loud
 * Sentry error + console.error gives ops the signal without taking the
 * whole service down.
 */
function checkPrerenderConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.LP_STUDIO_RENDER_BASE_URL) return;
  const msg =
    "LP_STUDIO_RENDER_BASE_URL is not set on the production deployment. " +
    "Auto-prerender on publish will fail silently (Playwright will load the " +
    "wrong SPA host and produce empty HTML). Set it to a canonical SPA host " +
    "such as https://render.lpstudio.ai and restart. See replit.md " +
    "(LP-Studio prerender ops).";
  console.error(`[startup] ${msg}`);
  Sentry.captureMessage("prerender_config_missing_render_base_url", {
    level: "error",
    tags: {
      subsystem: "lp-prerender",
      outcome: "startup_config_missing",
    },
    extra: {
      missing_env: "LP_STUDIO_RENDER_BASE_URL",
      note: msg,
    },
  });
}

const SLUG_REDIRECT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly
// Task #374 — LP asset health canary. Samples recent published pages and
// alerts when their referenced /assets/* are missing from R2. 15min cadence
// surfaces a regression of the build hook within one cycle.
const LP_ASSET_HEALTH_INTERVAL_MS = 15 * 60 * 1000;
// Task #374 — daily R2 asset GC. Dry-run by default (LP_ASSETS_GC_DRY_RUN).
const LP_ASSETS_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Defer the FIRST asset health-check + GC sweep off the cold-start path.
// Both walk R2 (list/GET/HEAD across the whole bucket); running them
// immediately inside the app.listen callback put a burst of R2 I/O in the
// exact window the Cloud Run startup probe (/healthz) needs, which on a
// cold start saturated the S3 socket pool and starved the event loop long
// enough to fail the deploy promote step. A short delay lets the instance
// pass the probe first; the periodic intervals below are unchanged. The
// health-check and GC first runs are staggered so they don't fire as one
// synchronized R2 burst right after readiness.
const LP_ASSET_HEALTH_BOOT_DELAY_MS = 60 * 1000;
const LP_ASSETS_GC_BOOT_DELAY_MS = 120 * 1000;
// Task #152 — warn admins ~7 days before an old workspace URL stops working.
// Run on a daily cadence so a row created at any time of day still gets at
// least one scan inside the warning window before it expires.
const SLUG_REDIRECT_NOTIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SLUG_REDIRECT_NOTIFY_LEAD_DAYS = 7;

async function cleanupExpiredSlugRedirects(): Promise<void> {
  try {
    const result = await pool.query(
      `DELETE FROM tenant_slug_redirects WHERE expires_at < now()`
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ deleted: result.rowCount }, "expired tenant_slug_redirects cleaned up");
      invalidateTenantHostCache();
    }
  } catch (err) {
    logger.error({ err }, "tenant_slug_redirects cleanup failed (non-fatal)");
  }
}

type ExpiringRedirectRow = {
  old_slug: string;
  tenant_id: number;
  expires_at: Date;
  tenant_name: string;
  tenant_slug: string;
  tenant_domain: string | null;
};

type AdminRecipientRow = { email: string };

// In-process guard so two overlapping scans (e.g. boot + interval firing
// close together, or a slow scan still running when the next tick fires)
// don't both pick up the same row before notified_at gets stamped.
let slugRedirectNotifyInflight: Promise<void> | null = null;

// Task #152 — find slug redirects that expire inside the warning window and
// haven't been notified yet, email each tenant's admins, then stamp
// notified_at so re-runs are no-ops. Important: notified_at is only set
// AFTER at least one email is successfully accepted by the email provider,
// so a transient send failure doesn't permanently silence the warning.
async function notifyExpiringSlugRedirects(): Promise<void> {
  if (slugRedirectNotifyInflight) return slugRedirectNotifyInflight;
  slugRedirectNotifyInflight = (async () => {
    const baseHost = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
    if (!baseHost) {
      logger.warn("notifyExpiringSlugRedirects: no WILDCARD_BASE_HOSTS configured — skipping");
      return;
    }
    let rows: ExpiringRedirectRow[];
    try {
      const result = await pool.query<ExpiringRedirectRow>(
        `SELECT r.old_slug, r.tenant_id, r.expires_at,
                t.name AS tenant_name, t.slug AS tenant_slug, t.domain AS tenant_domain
           FROM tenant_slug_redirects r
           JOIN tenants t ON t.id = r.tenant_id
          WHERE r.notified_at IS NULL
            AND r.expires_at > now()
            AND r.expires_at <= now() + ($1 || ' days')::interval
            AND t.status = 'active'`,
        [String(SLUG_REDIRECT_NOTIFY_LEAD_DAYS)],
      );
      rows = result.rows;
    } catch (err) {
      logger.error({ err }, "notifyExpiringSlugRedirects: query failed (non-fatal)");
      return;
    }
    if (!rows.length) return;

    for (const row of rows) {
      let admins: AdminRecipientRow[];
      try {
        const adminResult = await pool.query<AdminRecipientRow>(
          `SELECT DISTINCT lower(tm.email) AS email
             FROM tenant_members tm
             JOIN tenant_roles tr ON tr.id = tm.role_id
            WHERE tm.tenant_id = $1
              AND tr.is_admin = true
              AND tm.accepted_at IS NOT NULL
              AND tm.email IS NOT NULL AND tm.email <> ''`,
          [row.tenant_id],
        );
        admins = adminResult.rows;
      } catch (err) {
        logger.error({ err, oldSlug: row.old_slug, tenantId: row.tenant_id }, "notifyExpiringSlugRedirects: admin lookup failed");
        continue;
      }
      if (admins.length === 0) {
        // No admins to notify — stamp the row so we don't keep re-querying it
        // every day until it expires. This is also idempotent under concurrent
        // scans because of the WHERE notified_at IS NULL guard.
        await pool.query(
          `UPDATE tenant_slug_redirects SET notified_at = now()
            WHERE old_slug = $1 AND tenant_id = $2 AND notified_at IS NULL`,
          [row.old_slug, row.tenant_id],
        ).catch((err) => logger.error({ err }, "notifyExpiringSlugRedirects: stamp (no-admins) failed"));
        logger.info({ oldSlug: row.old_slug, tenantId: row.tenant_id }, "slug redirect expiry: no admins to notify");
        continue;
      }

      const oldUrl = `https://${row.old_slug}.${baseHost}`;
      const currentUrl = row.tenant_domain
        ? `https://${row.tenant_domain.toLowerCase()}`
        : `https://${row.tenant_slug.toLowerCase()}.${baseHost}`;
      const msUntil = row.expires_at.getTime() - Date.now();
      const daysUntilExpiry = Math.max(1, Math.ceil(msUntil / (24 * 60 * 60 * 1000)));

      // Send in parallel; collect successes so we only stamp notified_at when
      // at least one admin actually got the email. A transient provider
      // failure across all recipients leaves notified_at NULL so tomorrow's
      // scan retries.
      const results = await Promise.all(admins.map(a =>
        sendSlugRedirectExpiryWarning({
          recipientEmail: a.email,
          tenantName: row.tenant_name,
          oldUrl,
          currentUrl,
          expiresAt: row.expires_at,
          daysUntilExpiry,
        }),
      ));
      const sentCount = results.filter(Boolean).length;
      if (sentCount === 0) {
        logger.warn(
          { oldSlug: row.old_slug, tenantId: row.tenant_id, attempted: admins.length },
          "slug redirect expiry: every send failed — will retry on next scan",
        );
        continue;
      }
      try {
        await pool.query(
          `UPDATE tenant_slug_redirects SET notified_at = now()
            WHERE old_slug = $1 AND tenant_id = $2 AND notified_at IS NULL`,
          [row.old_slug, row.tenant_id],
        );
        logger.info(
          { oldSlug: row.old_slug, tenantId: row.tenant_id, sent: sentCount, attempted: admins.length, expiresAt: row.expires_at.toISOString() },
          "slug redirect expiry warning sent",
        );
      } catch (err) {
        logger.error({ err, oldSlug: row.old_slug, tenantId: row.tenant_id }, "notifyExpiringSlugRedirects: stamp failed (email already sent)");
      }
    }
  })().finally(() => { slugRedirectNotifyInflight = null; });
  return slugRedirectNotifyInflight;
}

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Bind the port and immediately mark ready — schema setup ran in the
// dedicated `pnpm migrate` step before this process started (see
// `src/migrate.ts` and the production build hook in
// `.replit-artifact/artifact.toml`).
// The readiness gate in app.ts is kept so a misconfigured deploy that
// somehow boots the server without setReady() being called still
// surfaces a clean 503 instead of returning 500s from half-loaded
// routes.
const httpServer = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  setReady();
  logger.info({ port }, "Server listening — API ready");

  // Verify the LP-Studio prerender pipeline has its required prod env
  // configured. No-op outside production.
  checkPrerenderConfig();

  // Task #425 — log Stripe billing configuration source. No-op when
  // STRIPE_ENABLED is unset so stripeless dev boots stay quiet.
  logStripeStartupStatus();

  // Task #425 — bootstrap stripe-replit-sync (DDL, managed webhook,
  // backfill). Best-effort and gated by STRIPE_ENABLED.
  void initStripe();

  // Periodic cleanup of expired workspace URL redirects (task #136).
  // Runs once at boot and then on a fixed interval. Failures are logged
  // but never crash the server.
  void cleanupExpiredSlugRedirects();
  setInterval(() => {
    void cleanupExpiredSlugRedirects();
  }, SLUG_REDIRECT_CLEANUP_INTERVAL_MS).unref();

  // Task #152 — daily scan for slug redirects about to expire so admins
  // get a heads-up email before their old URL stops working.
  void notifyExpiringSlugRedirects();
  setInterval(() => {
    void notifyExpiringSlugRedirects();
  }, SLUG_REDIRECT_NOTIFY_INTERVAL_MS).unref();

  // Task #374 — periodic LP asset health check. Samples recent published
  // pages from R2 and alerts (Sentry + log) when a referenced /assets/*
  // is missing — the canary that catches a regression of the lp-studio
  // build hook before it bites a visitor.
  // First run is deferred off the cold-start path (see
  // LP_ASSET_HEALTH_BOOT_DELAY_MS) so the R2 fan-out doesn't compete with
  // the startup probe; the steady-state cadence is unchanged.
  setTimeout(() => {
    void runAssetHealthCheck();
  }, LP_ASSET_HEALTH_BOOT_DELAY_MS).unref();
  setInterval(() => {
    void runAssetHealthCheck();
  }, LP_ASSET_HEALTH_INTERVAL_MS).unref();

  // Task #374 — daily R2 asset GC. Dry-run by default
  // (LP_ASSETS_GC_DRY_RUN unset or set to anything except "0"). First run
  // is likewise deferred off the cold-start path, staggered after the
  // health check so the two sweeps don't burst R2 simultaneously.
  setTimeout(() => {
    void runAssetsGc();
  }, LP_ASSETS_GC_BOOT_DELAY_MS).unref();
  setInterval(() => {
    void runAssetsGc();
  }, LP_ASSETS_GC_INTERVAL_MS).unref();

  // Task #190 — emit a periodic Sentry "heartbeat" event in production so
  // the project always has a known signal. The matching Sentry alert
  // (see lib/SENTRY_PROD_ALERT_VERIFICATION.md) fires when these
  // heartbeats stop arriving, catching DSN/network/quota outages that
  // would otherwise be invisible. No-op in non-production.
  startSentryHeartbeat();

  // Task #415 — periodic custom-domain status poller. Watches every
  // tenant with an attached custom microsite domain and emails tenant
  // admins when (a) TLS goes active or (b) the domain has been pending
  // for 24h+ (likely DNS misconfig). Production-only (see poller).
  startCustomDomainPoller();
});

// Keep a reference so SIGTERM handlers (if added later) can close cleanly.
export { httpServer };
