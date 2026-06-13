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
import { assertEncryptionKeyValid } from "./lib/encryption";
import { pool } from "@workspace/db";
import { invalidateTenantHostCache, WILDCARD_BASE_HOSTS } from "./lib/tenantHosts";
import { sendSlugRedirectExpiryWarning } from "./lib/notifications";
import { resolveBroadcastRecipients } from "./lib/broadcastRecipients";
import {
  notifyTrialLifecycle,
  TRIAL_NOTIFY_BOOT_DELAY_MS,
  TRIAL_NOTIFY_INTERVAL_MS,
} from "./lib/trialLifecycle";
import { startSentryHeartbeat } from "./lib/sentryHeartbeat";
import { initNotificationStreamBroker } from "./lib/notificationStream";
import { startCustomDomainPoller } from "./lib/customDomainPoller";
import { startEmailDomainPoller } from "./lib/emailDomainPoller";
import { startBrandedSubdomainReconcilePoller } from "./lib/brandedSubdomainReconcilePoller";
import { startBrandedEmailSubdomainPoller } from "./lib/brandedEmailSubdomainPoller";
import { startMarketoSyncPoller } from "./lib/marketoSyncPoller";
import { startHubspotSyncPoller } from "./lib/hubspotSyncPoller";
import { startBlogPublishPoller } from "./lib/blogPublishPoller";
import { startBlogProgramPoller } from "./lib/blogProgramPoller";
import { scheduleWorkflowSweep } from "./lib/workflowEngine";
import { turnstileConfigured } from "./lib/turnstile";
import { runAssetHealthCheck } from "./lib/assetHealthCheck";
import { runAssetsGc } from "./lib/assetsGc";
import { runSnapshotReconcile } from "./lib/snapshotReconcile";
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
// Task #708 — post-deploy snapshot reconcile. Re-bakes published-page R2
// snapshots whose stamped render-version is behind CURRENT_RENDER_VERSION,
// so a rendering fix self-heals across already-published pages. The boot
// run IS the deploy signal (a deploy that bumped the version makes the
// fleet stale); the daily interval is a backstop. Deferred well off the
// cold-start path and staggered after the GC sweep so its detection HEADs
// + serial Playwright re-bakes never compete with the startup probe.
const LP_SNAPSHOT_RECONCILE_BOOT_DELAY_MS = 180 * 1000;
const LP_SNAPSHOT_RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;
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
      // Task #614 — recipients are per-tenant configurable. Unconfigured =
      // legacy default (all admins); a configured-but-empty config fails open to
      // all admins (handled inside resolveBroadcastRecipients).
      let admins: AdminRecipientRow[];
      try {
        admins = await resolveBroadcastRecipients(row.tenant_id, "slug_redirect_expiry");
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
          tenantId: row.tenant_id,
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

// Production config guards. These check that important secrets are present.
// Historically each was a HARD CRASH (`throw`) at boot — which meant a single
// missing/empty secret made the whole deployment fail its healthcheck and
// refuse to publish, with the real reason buried in runtime logs. That turns a
// recoverable misconfiguration into an opaque, total outage (and a deploy that
// can't go live at all). Instead we now WARN LOUDLY (log + Sentry) and keep
// booting: each missing secret degrades only its own feature (Turnstile → bot
// protection off; UNSUB_SECRET → unsubscribe links degraded; etc.), all of
// which the downstream code already handles gracefully. Set
// `STRICT_PROD_GUARDS=1` to restore the old fail-fast behaviour once prod
// config is fully sorted.
const STRICT_PROD_GUARDS = process.env.STRICT_PROD_GUARDS === "1";
function prodConfigGuard(failed: boolean, message: string): void {
  if (process.env.NODE_ENV !== "production" || !failed) return;
  if (STRICT_PROD_GUARDS) {
    throw new Error(message);
  }
  logger.error({ guard: "prod-config", strict: false }, `[boot-guard] ${message}`);
  try {
    const Sentry = require("@sentry/node") as typeof import("@sentry/node");
    Sentry.captureMessage(`[boot-guard] ${message}`, "warning");
  } catch {
    /* Sentry not available — the logger.error above is the signal */
  }
}

// Task #624 — bot protection (Turnstile) gates the public auth endpoints
// (register / login / password reset). With no secret, verifyTurnstile()
// reports `configured: false` and waves every request through — bot protection
// is simply off until the secret is set. Warn (don't crash) so a missing key
// can't block the deploy. No-op outside production — dev/test run keyless.
prodConfigGuard(
  !turnstileConfigured(),
  "TURNSTILE_SECRET_KEY is not set on the production deployment. Bot " +
    "protection on the public auth endpoints (register / login / password " +
    "reset) is DISABLED until the secret is set. Set it and redeploy to enable.",
);

// Task #681 — fail-fast in production when GitHub OAuth is enabled but the
// callback URI isn't pinned. A GitHub OAuth app allows only ONE registered
// callback host, yet LP Studio serves auth across many hosts (app.lpstudio.ai
// + tenant domains). Without GITHUB_OAUTH_REDIRECT_URI, getGithubRedirectUri()
// derives the callback from the per-request host, so any flow started on a
// tenant domain sends GitHub a redirect_uri that doesn't match the registered
// one and the handoff fails. Refuse to boot so the misconfiguration is caught
// at deploy time. Only enforced when the provider is configured — deploys
// without GitHub login set up are unaffected; no-op outside production.
prodConfigGuard(
  !!process.env.GITHUB_OAUTH_CLIENT_ID &&
    !!process.env.GITHUB_OAUTH_CLIENT_SECRET &&
    !process.env.GITHUB_OAUTH_REDIRECT_URI,
  "GITHUB_OAUTH_REDIRECT_URI is not set on the production deployment while " +
    "GitHub OAuth is configured. Pin it to the registered prod callback " +
    "(https://app.lpstudio.ai/api/auth/github/callback) so the cross-domain " +
    "handoff uses a fixed URI; otherwise tenant-host logins send GitHub a " +
    "redirect_uri that won't match the OAuth app. Set the var and redeploy.",
);

// Task #684 — fail-fast in production when Google OAuth is enabled but the
// callback URI isn't pinned. A Google OAuth client only accepts redirect_uris
// from a fixed allowlist, yet LP Studio serves auth across many hosts
// (app.lpstudio.ai + tenant domains). Without GOOGLE_REDIRECT_URI,
// getRedirectUri() derives the callback from the per-request host, so any flow
// started on a tenant domain sends Google a redirect_uri that isn't registered
// and the handoff fails. Refuse to boot so the misconfiguration is caught at
// deploy time. Only enforced when the provider is configured — deploys without
// Google login set up are unaffected; no-op outside production.
prodConfigGuard(
  !!process.env.GOOGLE_CLIENT_ID &&
    !!process.env.GOOGLE_CLIENT_SECRET &&
    !process.env.GOOGLE_REDIRECT_URI,
  "GOOGLE_REDIRECT_URI is not set on the production deployment while " +
    "Google OAuth is configured. Pin it to the registered prod callback " +
    "(https://app.lpstudio.ai/api/auth/google/callback) so the cross-domain " +
    "handoff uses a fixed URI; otherwise tenant-host logins send Google a " +
    "redirect_uri that won't match the OAuth client. Set the var and redeploy.",
);

// Fail-fast in production when the unsubscribe-token signing secret isn't set.
// UNSUB_SECRET signs the one-click unsubscribe links in every outbound sales
// email. Without it the code would otherwise fall back to a per-process random
// (links break on restart) or — historically — a hardcoded constant that let
// anyone forge an unsubscribe for any contact. Refuse to boot so the missing
// secret is caught at deploy time. No-op outside production.
prodConfigGuard(
  !process.env.UNSUB_SECRET,
  "UNSUB_SECRET is not set on the production deployment. It signs the " +
    "one-click unsubscribe links in outbound sales emails; without a stable " +
    "secret those links are forgeable / break across restarts. Set the secret " +
    "and redeploy.",
);

// Fail-fast in production when the Resend webhook signing secret isn't set.
// RESEND_WEBHOOK_SECRET verifies the HMAC signature on inbound Resend delivery
// / bounce / complaint webhooks, which mutate send + signal state. Without it
// the verifier fails closed (rejects every webhook), so delivery status would
// silently stop updating on a live deploy. Refuse to boot so the missing secret
// is caught at deploy time. No-op outside production.
prodConfigGuard(
  !process.env.RESEND_WEBHOOK_SECRET,
  "RESEND_WEBHOOK_SECRET is not set on the production deployment. It verifies " +
    "the signature on inbound Resend webhooks (delivery / bounce / complaint); " +
    "without it every webhook is rejected and send status stops updating. Set " +
    "the secret and redeploy.",
);

// Task #860 — fail-fast in production when the credential-encryption key isn't
// set. CREDENTIAL_ENCRYPTION_KEY (32 bytes, base64) is the master key that
// encrypts integration secrets (Marketo/Salesforce clientSecret, Google Sheets
// privateKey, Asana PAT) at rest in lp_integrations.config. Without it the
// encryption helper would fall back to a deterministic dev key, so secrets
// would be "encrypted" with a publicly-known key — i.e. not protected at all.
// Refuse to boot so the missing secret is caught at deploy time. No-op outside
// production (dev/test run on the loud dev fallback on purpose).
if (process.env.NODE_ENV === "production") {
  prodConfigGuard(
    !process.env.CREDENTIAL_ENCRYPTION_KEY,
    "CREDENTIAL_ENCRYPTION_KEY is not set on the production deployment. It " +
      "encrypts stored integration credentials at rest; without it secrets fall " +
      "back to a deterministic dev key and are effectively unprotected. Generate " +
      "with `openssl rand -base64 32`, set the secret (and back it up out-of-band), " +
      "and redeploy. (Only matters if you store integration credentials — " +
      "Marketo/Salesforce/Sheets/Asana.)",
  );
  // Eagerly decode + length-check the key when one IS set, so a malformed value
  // (wrong length, bad base64) is surfaced at boot instead of on the first
  // credential write. A malformed key is a clear typo worth catching loudly;
  // under STRICT_PROD_GUARDS it still throws, otherwise it warns and continues.
  if (process.env.CREDENTIAL_ENCRYPTION_KEY) {
    try {
      assertEncryptionKeyValid();
    } catch (err) {
      prodConfigGuard(true, `CREDENTIAL_ENCRYPTION_KEY is malformed: ${String(err)}`);
    }
  }
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

  // Cross-instance in-app notification pushes (Postgres LISTEN/NOTIFY). Opens a
  // dedicated non-pooled listener so a notification created on any replica
  // reaches a user's open tabs on every replica. Non-blocking and best-effort;
  // the client poll backstop covers any window the broker is down.
  initNotificationStreamBroker();

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

  // Trial lifecycle nudges (day 7 / 11 / 13). First run deferred off the
  // cold-start path; then daily. Idempotent via the dispatcher's dedupe.
  setTimeout(() => {
    void notifyTrialLifecycle().catch((err) =>
      logger.error({ err }, "notifyTrialLifecycle failed (boot run)"),
    );
    setInterval(() => {
      void notifyTrialLifecycle().catch((err) =>
        logger.error({ err }, "notifyTrialLifecycle failed (interval run)"),
      );
    }, TRIAL_NOTIFY_INTERVAL_MS).unref();
  }, TRIAL_NOTIFY_BOOT_DELAY_MS).unref();

  // Email workflow composer (Task #589) — advances delayed / branching steps of
  // active enrollments. Self-defers off the cold-start path and runs on an
  // interval; the sweep holds an xact-scoped advisory lock so multiple instances
  // don't double-process. Idempotent via the per-step dispatch dedupe.
  scheduleWorkflowSweep();

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

  // Task #708 — post-deploy snapshot reconcile. Re-bakes any published
  // page whose R2 snapshot's stamped render-version is behind
  // CURRENT_RENDER_VERSION (or unstamped, i.e. baked before this
  // mechanism), so a rendering fix self-heals across the fleet without a
  // manual backfill. Detection is cheap HEADs; re-baking is serial
  // Playwright work guarded by a cross-instance advisory lock (see the
  // reconcile module). First run deferred off the cold-start path and
  // staggered after the GC sweep; daily interval is a backstop.
  setTimeout(() => {
    void runSnapshotReconcile();
  }, LP_SNAPSHOT_RECONCILE_BOOT_DELAY_MS).unref();
  setInterval(() => {
    void runSnapshotReconcile();
  }, LP_SNAPSHOT_RECONCILE_INTERVAL_MS).unref();

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

  // Task #783 — periodic custom EMAIL sending-domain verification poller.
  // Watches every tenant with a self-registered sending domain and emails
  // tenant admins once Resend flips the domain to `verified`, so they learn
  // mail now sends from their own domain even with the wizard closed.
  // Production-only (see poller).
  startEmailDomainPoller();

  // Task #794 — periodic branded email-subdomain DNS drift reconcile. Tier 2
  // publishes a tenant's Resend records into our own Cloudflare zone; if they
  // are ever edited/deleted out-of-band, sending silently breaks. This sweep
  // re-publishes any missing/changed records, self-healing deliverability.
  // Production-only (dev shares the prod CF zone — see poller).
  startBrandedSubdomainReconcilePoller();

  // Task #787 — periodic branded email-subdomain retirement sweep. Refreshes
  // every provisioned Tier 2 subdomain's verification status out-of-band (so it
  // stays fresh with the wizard closed) and auto-retires any that never verify
  // past the staleness threshold, reusing the wizard's deprovision path so no
  // Resend/Cloudflare resources leak. Production-only (see poller).
  startBrandedEmailSubdomainPoller();

  // Task #950 — periodic scheduled Marketo lead sync. For every tenant whose
  // Marketo connection is connected + sync-enabled, runs the bulk lead import
  // on a fixed cadence (resuming from the cursor saved on the connection), so
  // new/updated Marketo leads flow into the Sales Console without a manual
  // "Sync". Per-tenant advisory-locked so instances don't double-import; each
  // tenant fails closed + observable via marketo_sync_log. Runs in production
  // OR when MARKETO_FAKE_MODE is set (see poller).
  startMarketoSyncPoller();
  startHubspotSyncPoller();

  // Blog Phase 2 — scheduled-publish sweep. Flips status='scheduled' blog_posts
  // to 'published' once scheduled_at <= now (atomic conditional UPDATE,
  // advisory-locked, fail-open + crash-safe). Production-only unless
  // BLOG_PUBLISH_POLLER_ENABLED is set (see poller).
  startBlogPublishPoller();

  // Blog Phase 4 — autonomous content-program tick. In AUTONOMOUS mode keeps
  // the publishing backlog healthy (tops up recommendations, generates drafts
  // from PRE-APPROVED topics, quality-gates + schedules them spaced per
  // cadence); in REVIEW mode (default) it only tops up topic recommendations.
  // Never auto-publishes directly (the publish poller does that, gated by
  // autopublish_enabled). Advisory-locked, fail-open + crash-safe. Production-
  // only unless BLOG_PROGRAM_POLLER_ENABLED is set (see poller).
  startBlogProgramPoller();
});

// Keep a reference so SIGTERM handlers (if added later) can close cleanly.
export { httpServer };
