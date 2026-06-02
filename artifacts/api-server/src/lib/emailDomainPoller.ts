// Task #783 — Custom email sending-domain verification poller.
//
// Enterprise tenants self-register their OWN email sending domain via the
// Settings wizard (routes/lp/email-domain.ts) and publish DNS records. DNS
// propagation can take minutes to hours, during which Resend reports the domain
// as `pending`. The wizard auto-polls every 15s WHILE OPEN, but admins close
// the tab — so today they only learn it verified if they happen to be looking.
//
// This is the out-of-band loop that watches every tenant with a registered
// custom email domain and fires a one-time "your sending domain is verified"
// heads-up to the tenant's admins the moment Resend flips it to `verified`,
// closing the loop without anyone watching the screen.
//
// ── Exactly-once delivery ────────────────────────────────────────────
// Mirrors customDomainPoller's three layers of de-duplication:
//
//   1. Per-process in-flight Promise — prevents one process's own
//      overlapping ticks (slow scan, fast interval).
//
//   2. Postgres advisory lock (pg_try_advisory_lock(783, 1)) — held for
//      the duration of a scan so two app instances never scan
//      concurrently. If another instance holds it, this tick is a no-op.
//
//   3. Atomic claim-before-send — the send-vs-stamp race is the dangerous
//      one. We stamp the notified marker in the SAME JSONB config slice
//      that holds the domain id, keyed BY that id, iff it is still
//      un-stamped for the CURRENT id. Only the worker whose UPDATE
//      returns a row has the right (and obligation) to send. If the send
//      then fails, we ROLLBACK the claim so the next scan retries.
//
// Re-arm: the marker is keyed by the Resend domain id. Removing the domain
// clears the marker (and the id) in email-domain.ts, and re-registering mints a
// fresh Resend id, so a later verification naturally fires again.
//
// State lives entirely in lp_brand_settings.config.salesConsole:
//   - sendingDomain                       — the domain name (informational)
//   - customEmailDomainId                 — the Resend domain id
//   - customEmailDomainVerifiedNotifiedId — the id we've already notified for
// No schema migration needed.

import { pool } from "@workspace/db";
import { logger } from "./logger";
import { getResendDomainById } from "./resendDomainStatus";
import { sendEmailDomainVerifiedEmail } from "./notifications";
import { resolveBroadcastRecipients, type ResolvedRecipient } from "./broadcastRecipients";
import { dispatchNotification } from "./notificationDispatcher";
import { WILDCARD_BASE_HOSTS } from "./tenantHosts";

export const EMAIL_DOMAIN_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Stable pair-key for pg_try_advisory_lock — the task number plus a sibling
// slot, matching the convention customDomainPoller established.
const ADVISORY_LOCK_CLASSID = 783;
const ADVISORY_LOCK_OBJID = 1;

// Settings deep-link surfaced in the email body.
const EMAIL_SETTINGS_URL = "https://app.lpstudio.ai/settings/email";

type PendingDomainRow = {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  tenant_domain: string | null;
  sending_domain: string | null;
  domain_id: string;
};

async function loadAdminRecipients(tenantId: number): Promise<ResolvedRecipient[]> {
  try {
    // Recipients are per-tenant configurable (Task #614). Unconfigured = legacy
    // default (all admins); a configured-but-empty config fails open to all
    // admins (handled inside resolveBroadcastRecipients). Reuses the same
    // domain-status audience as the microsite custom-domain poller. The full
    // recipient (with appUserId) is kept so the in-app inbox item (Task #792)
    // can be delivered alongside the email.
    return await resolveBroadcastRecipients(tenantId, "custom_domain_status");
  } catch (err) {
    logger.error({ err, tenantId }, "emailDomainPoller: admin lookup failed");
    return [];
  }
}

/**
 * Build the tenant's own "/settings/email" deep link for the in-app inbox
 * item's CTA — the custom-domain branch of Settings where the verified domain
 * shows. Prefers the tenant's attached custom domain, falling back to its
 * `<slug>.<wildcard-host>` workspace URL. Returns null when no host is known so
 * the inbox item simply renders without a CTA. Mirrors trialLifecycle's
 * workspace-URL derivation.
 */
function buildSettingsEmailUrl(row: PendingDomainRow): string | null {
  const baseHost = WILDCARD_BASE_HOSTS.find((h) => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
  const base = row.tenant_domain
    ? `https://${row.tenant_domain.toLowerCase()}`
    : baseHost
      ? `https://${row.tenant_slug.toLowerCase()}.${baseHost}`
      : null;
  return base ? `${base}/settings/email` : null;
}

/**
 * Atomic claim: stamp `customEmailDomainVerifiedNotifiedId = domainId` iff the
 * row still has THIS domain id configured and hasn't already been notified for
 * it. The returned boolean is the source of truth — only the caller that gets
 * `true` may send. Concurrent workers get `false` and bail.
 *
 * Exported for the integration test that asserts the race-resolution behavior.
 */
export async function claimEmailDomainNotification(tenantId: number, domainId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE lp_brand_settings
        SET config = jsonb_set(
              config,
              '{salesConsole,customEmailDomainVerifiedNotifiedId}',
              to_jsonb($2::text),
              true
            ),
            updated_at = now()
      WHERE tenant_id = $1
        AND config->'salesConsole'->>'customEmailDomainId' = $2
        AND (config->'salesConsole'->>'customEmailDomainVerifiedNotifiedId') IS DISTINCT FROM $2
      RETURNING tenant_id`,
    [tenantId, domainId],
  );
  // `lp_brand_settings` has a unique constraint on tenant_id, so this UPDATE
  // touches at most one row. `rowCount > 0` means THIS worker won the claim;
  // any concurrent racer sees 0 (the `IS DISTINCT FROM` guard no longer holds).
  return (result.rowCount ?? 0) > 0;
}

/**
 * Roll back a claim — clears the notified marker so the next scan retries.
 * Only used when every send fails after a successful claim. Errors here are
 * logged and swallowed: an orphaned claim costs one verification email's worth
 * of retries, strictly better than tearing the loop down. Scoped to the same
 * domain id so we never wipe a marker a re-registration has since replaced.
 */
async function releaseClaim(tenantId: number, domainId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE lp_brand_settings
          SET config = config #- '{salesConsole,customEmailDomainVerifiedNotifiedId}',
              updated_at = now()
        WHERE tenant_id = $1
          AND config->'salesConsole'->>'customEmailDomainId' = $2
          AND config->'salesConsole'->>'customEmailDomainVerifiedNotifiedId' = $2`,
      [tenantId, domainId],
    );
  } catch (err) {
    logger.error({ err, tenantId, domainId }, "emailDomainPoller: claim rollback failed");
  }
}

// In-process guard so two overlapping scans within ONE process don't
// double-fire. The DB advisory lock + atomic claim handle the cross-process
// case; this just avoids burning Resend requests when setInterval ticks faster
// than a scan finishes.
let inflight: Promise<void> | null = null;

/**
 * One scan pass under the cross-instance advisory lock. Visits every tenant
 * with a registered custom email domain that hasn't yet been notified for the
 * current id, checks its live Resend status, and (under an atomic claim) sends
 * the verified email on the pending→verified transition. Per-tenant failures
 * (Resend outage, send failure) are logged and skipped — they never abort the
 * loop or block other tenants.
 */
export async function runEmailDomainPoll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const client = await pool.connect();
    try {
      const lockResult = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1, $2) AS locked`,
        [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID],
      );
      if (!lockResult.rows[0]?.locked) {
        logger.debug("emailDomainPoller: another instance holds the lock — skipping");
        return;
      }
      try {
        await runEmailDomainPollLocked();
      } finally {
        await client.query(`SELECT pg_advisory_unlock($1, $2)`, [ADVISORY_LOCK_CLASSID, ADVISORY_LOCK_OBJID])
          .catch((err) => logger.warn({ err }, "emailDomainPoller: advisory unlock failed (will auto-release on disconnect)"));
      }
    } finally {
      client.release();
    }
  })().finally(() => { inflight = null; });
  return inflight;
}

async function runEmailDomainPollLocked(): Promise<void> {
  let rows: PendingDomainRow[];
  try {
    // Only un-notified registrations are scanned, so we never re-hit Resend for
    // domains already confirmed — the marker keyed by id is the filter.
    const result = await pool.query<PendingDomainRow>(
      `SELECT lbs.tenant_id AS tenant_id,
              t.name AS tenant_name,
              t.slug AS tenant_slug,
              t.domain AS tenant_domain,
              lbs.config->'salesConsole'->>'sendingDomain' AS sending_domain,
              lbs.config->'salesConsole'->>'customEmailDomainId' AS domain_id
         FROM lp_brand_settings lbs
         JOIN tenants t ON t.id = lbs.tenant_id
        WHERE lbs.config->'salesConsole'->>'customEmailDomainId' IS NOT NULL
          AND (lbs.config->'salesConsole'->>'customEmailDomainVerifiedNotifiedId')
              IS DISTINCT FROM (lbs.config->'salesConsole'->>'customEmailDomainId')
          AND t.status = 'active'`,
    );
    rows = result.rows;
  } catch (err) {
    logger.error({ err }, "emailDomainPoller: tenant query failed (non-fatal)");
    return;
  }
  if (rows.length === 0) return;

  for (const row of rows) {
    await processTenant(row);
  }
}

async function processTenant(row: PendingDomainRow): Promise<void> {
  if (!row.domain_id) return;

  let verified = false;
  try {
    const result = await getResendDomainById(row.domain_id);
    if (!result.available || !result.domain) {
      // Resend down / domain gone — leave the marker untouched and retry next
      // scan. Never falsely claim a verification we couldn't confirm.
      return;
    }
    verified = result.domain.status === "verified";
  } catch (err) {
    logger.error({ err, tenantId: row.tenant_id, domainId: row.domain_id }, "emailDomainPoller: getResendDomainById failed");
    return;
  }
  if (!verified) return;

  await tryFireVerified(row);
}

async function tryFireVerified(row: PendingDomainRow): Promise<void> {
  // Claim BEFORE doing any work so concurrent workers cannot both send.
  let claimed: boolean;
  try {
    claimed = await claimEmailDomainNotification(row.tenant_id, row.domain_id);
  } catch (err) {
    logger.error({ err, tenantId: row.tenant_id }, "emailDomainPoller: verified claim failed");
    return;
  }
  if (!claimed) return; // someone else got there first, or already notified

  const recipients = await loadAdminRecipients(row.tenant_id);
  if (recipients.length === 0) {
    // Keep the claim — nobody to notify, no point re-checking next scan.
    logger.info({ tenantId: row.tenant_id, domainId: row.domain_id }, "email domain verified: no admins to notify");
    return;
  }

  const domain = (row.sending_domain ?? "").trim() || row.domain_id;

  // In-app inbox item (Task #792) so admins who don't check email (or whose
  // email send fails) still get the signal. It's deduped INSIDE the dispatcher
  // by a domain-id-keyed dedupe_key, so even if the email-driven claim is later
  // released and this whole branch retried, the inbox item is posted only once.
  await dispatchVerifiedInApp(row, recipients, domain);

  const admins = recipients.map((r) => r.email).filter(Boolean);
  let sent = 0;
  try {
    const results = await Promise.all(admins.map((email) =>
      sendEmailDomainVerifiedEmail({
        recipientEmail: email,
        tenantName: row.tenant_name,
        domain,
        settingsUrl: EMAIL_SETTINGS_URL,
      }),
    ));
    sent = results.filter(Boolean).length;
  } catch (err) {
    // Promise.all itself rejecting is unexpected (the sender catches
    // internally) but be defensive.
    logger.error({ err, tenantId: row.tenant_id }, "emailDomainPoller: verified send threw");
  }

  if (sent === 0) {
    // Every email failed — release the claim so we retry next scan. The in-app
    // item already posted above survives the retry (dispatcher dedupe), so the
    // admin keeps the in-product signal even while email keeps retrying.
    await releaseClaim(row.tenant_id, row.domain_id);
    logger.warn(
      { tenantId: row.tenant_id, domain, attempted: admins.length },
      "email domain verified: every send failed — claim released, will retry next scan",
    );
    return;
  }

  logger.info(
    { tenantId: row.tenant_id, domain, sent, attempted: admins.length },
    "email domain verified email sent",
  );
}

/**
 * Post the "your sending domain is verified" in-app inbox item to every admin
 * with a workspace account (recipients without an appUserId are skipped inside
 * the dispatcher). Best-effort: a failure here is logged and swallowed so it
 * never blocks the verification email that follows.
 */
async function dispatchVerifiedInApp(
  row: PendingDomainRow,
  recipients: ResolvedRecipient[],
  domain: string,
): Promise<void> {
  try {
    await dispatchNotification({
      templateKey: "email_domain_verified",
      tenantId: row.tenant_id,
      recipients,
      // dispatchInApp uses `workspaceUrl` as the inbox item's CTA target; point
      // it at the tenant's own /settings/email page where the domain shows.
      context: {
        tenantName: row.tenant_name,
        domain,
        workspaceUrl: buildSettingsEmailUrl(row),
      },
      // Domain-id-keyed so re-registering a domain (fresh Resend id) re-fires,
      // and a claim release+retry never posts a second inbox item.
      dedupeBase: `email_domain_verified:tenant:${row.tenant_id}:${row.domain_id}`,
      channels: ["in_app"],
    });
  } catch (err) {
    logger.error(
      { err, tenantId: row.tenant_id, domainId: row.domain_id },
      "emailDomainPoller: in-app verified dispatch failed (non-fatal)",
    );
  }
}

/**
 * Boot-time scheduler. Production only — dev/staging would just spam Resend with
 * no real value. Returns the interval handle (already `.unref()`-ed) for tests.
 */
export function startEmailDomainPoller(): NodeJS.Timeout | null {
  if (process.env.NODE_ENV !== "production") return null;
  void runEmailDomainPoll();
  const handle = setInterval(() => {
    void runEmailDomainPoll();
  }, EMAIL_DOMAIN_POLL_INTERVAL_MS);
  handle.unref();
  return handle;
}
