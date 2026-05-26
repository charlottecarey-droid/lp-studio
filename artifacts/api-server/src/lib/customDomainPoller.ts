// Task #415 — Custom domain TLS status poller.
//
// Server-side periodic scan that watches every tenant with an attached
// custom microsite domain and fires two operational emails:
//
//   1. Active   — first time the Cloudflare Custom Hostname transitions
//                 to status="active" + ssl.status="active".
//   2. Stuck    — domain has been attached for >= STUCK_THRESHOLD_HOURS
//                 and is still pending, so likely DNS misconfigured.
//
// The DomainPage UI also polls every 15s while open, but admins close
// the tab and DNS can take hours. This is the out-of-band loop that
// catches both the happy path ("it's live!") and the sad path
// ("you forgot the CNAME") without anyone watching the screen.
//
// Idempotency: BOTH emails use an UPDATE … WHERE notified_*_at IS NULL
// guard so a single transition produces exactly one email even under
// concurrent pollers / overlapping ticks. Attach resets the timestamps
// (admin.ts) so detach + re-attach re-arms both emails.

import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  CloudflareError,
  getCustomHostname,
  getZoneName,
  type CustomHostname,
} from "./cloudflare";
import {
  sendCustomDomainActiveEmail,
  sendCustomDomainStuckEmail,
} from "./notifications";

export const CUSTOM_DOMAIN_POLL_INTERVAL_MS = 2 * 60 * 1000;          // 2 minutes
export const CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS = 24;

type TenantRow = {
  id: number;
  name: string;
  microsite_domain: string;
  cloudflare_hostname_id: string;
  custom_domain_attached_at: Date | null;
  custom_domain_notified_active_at: Date | null;
  custom_domain_notified_stuck_at: Date | null;
};

type AdminRow = { email: string };

/**
 * Derive a coarse status bucket from a CF Custom Hostname payload.
 * "active" is the strict TLS-active state; "blocked" covers
 * test_blocked / pending_blocked / blocked. Anything else is treated as
 * "pending" (i.e. still working its way through validation).
 */
export function classifyCustomHostname(ch: CustomHostname): "active" | "pending" | "blocked" {
  if ((ch.status === "active" || ch.status === "active_redeploying") && ch.ssl?.status === "active") {
    return "active";
  }
  if (ch.status === "blocked" || ch.status === "pending_blocked" || ch.status === "test_blocked") {
    return "blocked";
  }
  return "pending";
}

/**
 * Should we fire the stuck-DNS email for this tenant right now?
 * Returns true only if:
 *   - we know when the domain was attached
 *   - it's been pending for at least the stuck threshold
 *   - we haven't already sent the stuck email
 *
 * The poller still re-checks via UPDATE … WHERE notified_stuck_at IS NULL
 * before stamping; this is the cheap in-process pre-filter.
 */
export function shouldFireStuckEmail(args: {
  status: "active" | "pending" | "blocked";
  attachedAt: Date | null;
  notifiedStuckAt: Date | null;
  now: Date;
  thresholdHours?: number;
}): boolean {
  if (args.status !== "pending") return false;
  if (args.notifiedStuckAt !== null) return false;
  if (!args.attachedAt) return false;
  const ageMs = args.now.getTime() - args.attachedAt.getTime();
  const thresholdMs = (args.thresholdHours ?? CUSTOM_DOMAIN_STUCK_THRESHOLD_HOURS) * 60 * 60 * 1000;
  return ageMs >= thresholdMs;
}

/**
 * Should we fire the active email? True iff the CF status snapshot is
 * "active" and we haven't already sent the active email this attachment
 * cycle.
 */
export function shouldFireActiveEmail(args: {
  status: "active" | "pending" | "blocked";
  notifiedActiveAt: Date | null;
}): boolean {
  return args.status === "active" && args.notifiedActiveAt === null;
}

async function loadAdminEmails(tenantId: number): Promise<string[]> {
  try {
    const result = await pool.query<AdminRow>(
      `SELECT DISTINCT lower(tm.email) AS email
         FROM tenant_members tm
         JOIN tenant_roles tr ON tr.id = tm.role_id
        WHERE tm.tenant_id = $1
          AND tr.is_admin = true
          AND tm.accepted_at IS NOT NULL
          AND tm.email IS NOT NULL AND tm.email <> ''`,
      [tenantId],
    );
    return result.rows.map((r) => r.email);
  } catch (err) {
    logger.error({ err, tenantId }, "customDomainPoller: admin lookup failed");
    return [];
  }
}

// In-process guard so two overlapping scans (e.g. boot + interval, or a
// slow scan still running when the next tick fires) don't double-fire.
// Idempotency at the DB layer makes this belt-and-suspenders, but it
// also avoids hammering Cloudflare with redundant requests.
let inflight: Promise<void> | null = null;

/**
 * One scan pass. Visits every tenant with a non-null
 * cloudflare_hostname_id, fetches its CF status, persists
 * last_seen_status, and fires emails on transitions. Failures on a
 * single tenant (CF outage, send failure) are logged and skipped — they
 * never abort the loop or block the next tenant.
 */
export async function runCustomDomainPoll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    let rows: TenantRow[];
    try {
      const result = await pool.query<TenantRow>(
        `SELECT id, name, microsite_domain, cloudflare_hostname_id,
                custom_domain_attached_at,
                custom_domain_notified_active_at,
                custom_domain_notified_stuck_at
           FROM tenants
          WHERE cloudflare_hostname_id IS NOT NULL
            AND microsite_domain IS NOT NULL
            AND status = 'active'`,
      );
      rows = result.rows;
    } catch (err) {
      logger.error({ err }, "customDomainPoller: tenant query failed (non-fatal)");
      return;
    }
    if (rows.length === 0) return;

    // Resolve the zone CNAME once per scan — same across all tenants,
    // and the CF lib already caches it process-wide.
    let cnameTarget = "";
    try {
      cnameTarget = await getZoneName();
    } catch (err) {
      logger.warn({ err }, "customDomainPoller: getZoneName failed, stuck emails will omit CNAME hint");
    }

    const now = new Date();

    for (const row of rows) {
      let ch: CustomHostname;
      try {
        ch = await getCustomHostname(row.cloudflare_hostname_id);
      } catch (err) {
        // Don't poison last_seen_status on transient CF errors. If the
        // hostname id is permanently gone (404), surface in logs but
        // leave the DB row alone — admin DELETE will clear it.
        const is404 = err instanceof CloudflareError && err.status === 404;
        logger.error(
          { err, tenantId: row.id, hostname: row.microsite_domain, cf404: is404 },
          "customDomainPoller: getCustomHostname failed",
        );
        continue;
      }
      const status = classifyCustomHostname(ch);

      // Persist last_seen_status best-effort (purely informational).
      try {
        await pool.query(
          `UPDATE tenants SET custom_domain_last_seen_status = $1, updated_at = now()
            WHERE id = $2
              AND cloudflare_hostname_id = $3
              AND custom_domain_last_seen_status IS DISTINCT FROM $1`,
          [status, row.id, row.cloudflare_hostname_id],
        );
      } catch (err) {
        logger.warn({ err, tenantId: row.id }, "customDomainPoller: last_seen_status update failed");
      }

      // ── Active transition ──────────────────────────────────────────
      if (shouldFireActiveEmail({ status, notifiedActiveAt: row.custom_domain_notified_active_at })) {
        const admins = await loadAdminEmails(row.id);
        if (admins.length === 0) {
          // Stamp so we don't keep re-checking — there's nobody to email.
          await pool.query(
            `UPDATE tenants SET custom_domain_notified_active_at = now()
              WHERE id = $1 AND custom_domain_notified_active_at IS NULL`,
            [row.id],
          ).catch((err) => logger.warn({ err, tenantId: row.id }, "customDomainPoller: active stamp (no-admins) failed"));
          logger.info({ tenantId: row.id, hostname: row.microsite_domain }, "custom domain active: no admins to notify");
        } else {
          const publishedUrl = `https://${row.microsite_domain.toLowerCase()}`;
          const results = await Promise.all(admins.map((email) =>
            sendCustomDomainActiveEmail({
              recipientEmail: email,
              tenantName: row.name,
              hostname: row.microsite_domain,
              publishedUrl,
            }),
          ));
          const sent = results.filter(Boolean).length;
          if (sent === 0) {
            logger.warn(
              { tenantId: row.id, hostname: row.microsite_domain, attempted: admins.length },
              "custom domain active: every send failed — will retry next scan",
            );
          } else {
            try {
              await pool.query(
                `UPDATE tenants SET custom_domain_notified_active_at = now()
                  WHERE id = $1 AND custom_domain_notified_active_at IS NULL`,
                [row.id],
              );
              logger.info(
                { tenantId: row.id, hostname: row.microsite_domain, sent, attempted: admins.length },
                "custom domain active email sent",
              );
            } catch (err) {
              logger.error({ err, tenantId: row.id }, "customDomainPoller: active stamp failed (email already sent)");
            }
          }
        }
        // Don't also evaluate stuck for the same row this pass — moot.
        continue;
      }

      // ── Stuck transition ──────────────────────────────────────────
      if (shouldFireStuckEmail({
        status,
        attachedAt: row.custom_domain_attached_at,
        notifiedStuckAt: row.custom_domain_notified_stuck_at,
        now,
      })) {
        const admins = await loadAdminEmails(row.id);
        if (admins.length === 0) {
          await pool.query(
            `UPDATE tenants SET custom_domain_notified_stuck_at = now()
              WHERE id = $1 AND custom_domain_notified_stuck_at IS NULL`,
            [row.id],
          ).catch((err) => logger.warn({ err, tenantId: row.id }, "customDomainPoller: stuck stamp (no-admins) failed"));
          logger.info({ tenantId: row.id, hostname: row.microsite_domain }, "custom domain stuck: no admins to notify");
          continue;
        }
        const ageMs = now.getTime() - (row.custom_domain_attached_at as Date).getTime();
        const hoursPending = Math.max(1, Math.round(ageMs / (60 * 60 * 1000)));
        const settingsUrl = "https://app.lpstudio.ai/settings/domain";
        const results = await Promise.all(admins.map((email) =>
          sendCustomDomainStuckEmail({
            recipientEmail: email,
            tenantName: row.name,
            hostname: row.microsite_domain,
            cnameTarget: cnameTarget || "lpstudio.ai",
            settingsUrl,
            hoursPending,
          }),
        ));
        const sent = results.filter(Boolean).length;
        if (sent === 0) {
          logger.warn(
            { tenantId: row.id, hostname: row.microsite_domain, attempted: admins.length },
            "custom domain stuck: every send failed — will retry next scan",
          );
          continue;
        }
        try {
          await pool.query(
            `UPDATE tenants SET custom_domain_notified_stuck_at = now()
              WHERE id = $1 AND custom_domain_notified_stuck_at IS NULL`,
            [row.id],
          );
          logger.info(
            { tenantId: row.id, hostname: row.microsite_domain, sent, attempted: admins.length, hoursPending },
            "custom domain stuck email sent",
          );
        } catch (err) {
          logger.error({ err, tenantId: row.id }, "customDomainPoller: stuck stamp failed (email already sent)");
        }
      }
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

/**
 * Boot-time scheduler. Production only — dev/staging would just spam
 * Cloudflare and Resend with no real value. Returns the interval handle
 * (already `.unref()`-ed) for tests.
 */
export function startCustomDomainPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production") return null;
  void runCustomDomainPoll();
  const handle = setInterval(() => {
    void runCustomDomainPoll();
  }, CUSTOM_DOMAIN_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
