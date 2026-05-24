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
import { Sentry } from "./lib/sentry";
import { setReady } from "./lib/readiness";

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

  // Task #190 — emit a periodic Sentry "heartbeat" event in production so
  // the project always has a known signal. The matching Sentry alert
  // (see lib/SENTRY_PROD_ALERT_VERIFICATION.md) fires when these
  // heartbeats stop arriving, catching DSN/network/quota outages that
  // would otherwise be invisible. No-op in non-production.
  startSentryHeartbeat();
});

// Keep a reference so SIGTERM handlers (if added later) can close cleanly.
export { httpServer };
