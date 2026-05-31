import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Per-tenant, per-alert-type recipient resolution for "broadcast" emails
 * (Task #614).
 *
 * A "broadcast" alert historically went to a FIXED workspace audience — every
 * member (collaboration) or every admin (account/billing) — rather than to one
 * specific person. `broadcast_alert_recipients` lets a workspace admin re-target
 * each alert type. The PRESENCE of a config row = the alert is CONFIGURED:
 *
 *   - configured  → resolve the selected members' CURRENT emails + extra emails.
 *   - unconfigured → keep today's legacy default audience (all members for
 *     collaboration, all admins for account/billing). This is what makes the
 *     rollout a no-op for every existing tenant.
 *
 * FAIL-OPEN contract: account/billing alert types are operationally critical
 * (billing, domain, trial, URL expiry). If a configured row resolves to ZERO
 * valid recipients, the resolver falls back to ALL ADMINS so the warning is
 * never silently dropped. Collaboration alerts have no fail-open: a tenant that
 * explicitly configures zero recipients gets zero (the comment/review never
 * needed to reach anyone in particular).
 *
 * Resilience: any DB error while reading config falls back to the legacy
 * default audience — a config hiccup must never break a send. The legacy
 * default queries below mirror the original fixed-audience queries at each send
 * site so unconfigured tenants behave byte-for-byte as before.
 */

export type BroadcastAlertCategory = "collaboration" | "account_billing";

export interface BroadcastAlertTypeDef {
  type: string;
  category: BroadcastAlertCategory;
  name: string;
  description: string;
}

export const BROADCAST_ALERT_TYPES: readonly BroadcastAlertTypeDef[] = [
  {
    type: "comment",
    category: "collaboration",
    name: "New comment",
    description: "Sent when someone leaves a comment on one of your pages.",
  },
  {
    type: "review_decision",
    category: "collaboration",
    name: "Review decision",
    description: "Sent when a reviewer approves a page or requests changes.",
  },
  {
    type: "trial_expiry",
    category: "account_billing",
    name: "Trial expiry reminders",
    description: "Heads-up emails as your free trial nears its end.",
  },
  {
    type: "slug_redirect_expiry",
    category: "account_billing",
    name: "Workspace URL expiry",
    description: "Warns before an old workspace URL stops redirecting to the current one.",
  },
  {
    type: "payment_failed",
    category: "account_billing",
    name: "Payment failed",
    description: "Dunning alerts when a subscription payment fails.",
  },
  {
    type: "custom_domain_status",
    category: "account_billing",
    name: "Custom domain status",
    description: "Notifies when a custom domain goes live or gets stuck during setup.",
  },
] as const;

const ALERT_BY_TYPE = new Map<string, BroadcastAlertTypeDef>(
  BROADCAST_ALERT_TYPES.map((a) => [a.type, a]),
);

export function getBroadcastAlertDef(type: string): BroadcastAlertTypeDef | null {
  return ALERT_BY_TYPE.get(type) ?? null;
}

export interface ResolvedRecipient {
  /** In-app inbox target. Null for extra emails with no workspace account. */
  appUserId: number | null;
  email: string;
  name: string | null;
}

function toNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? x : Number(x);
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return out;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Dedupe by case-insensitive email, keeping the first (member rows win over extras). */
function dedupeByEmail(rows: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const out: ResolvedRecipient[] = [];
  for (const r of rows) {
    const email = (r.email ?? "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, email });
  }
  return out;
}

/**
 * Legacy default for COLLABORATION alerts: every workspace member with an email
 * (mirrors the original `getTenantUserEmails` query in collaboration.ts).
 */
async function legacyAllMembers(tenantId: number): Promise<ResolvedRecipient[]> {
  const { rows } = await pool.query<{ app_user_id: number; email: string; name: string | null }>(
    `SELECT id AS app_user_id, email, name
       FROM app_users
      WHERE tenant_id = $1 AND email IS NOT NULL AND email <> ''`,
    [tenantId],
  );
  return rows.map((r) => ({ appUserId: r.app_user_id, email: r.email, name: r.name }));
}

/**
 * Legacy default for ACCOUNT/BILLING alerts: every accepted workspace admin
 * (mirrors the admin lookups in trialLifecycle / server / stripeWebhook /
 * customDomainPoller). Carries `app_user_id` so trial in-app inbox items work.
 */
async function legacyAdmins(tenantId: number): Promise<ResolvedRecipient[]> {
  const { rows } = await pool.query<{ app_user_id: number | null; email: string; name: string | null }>(
    `SELECT DISTINCT tm.user_id AS app_user_id,
            lower(COALESCE(au.email, tm.email)) AS email,
            au.name AS name
       FROM tenant_members tm
       JOIN tenant_roles tr ON tr.id = tm.role_id
       LEFT JOIN app_users au ON au.id = tm.user_id
      WHERE tm.tenant_id = $1
        AND tr.is_admin = true
        AND tm.accepted_at IS NOT NULL
        AND (au.email IS NOT NULL OR (tm.email IS NOT NULL AND tm.email <> ''))`,
    [tenantId],
  );
  return dedupeByEmail(
    rows.map((r) => ({ appUserId: r.app_user_id, email: r.email, name: r.name })),
  );
}

async function legacyDefault(
  def: BroadcastAlertTypeDef,
  tenantId: number,
): Promise<ResolvedRecipient[]> {
  return def.category === "collaboration"
    ? legacyAllMembers(tenantId)
    : legacyAdmins(tenantId);
}

/**
 * Resolve the recipient list for a tenant's broadcast alert. See file header for
 * the configured / unconfigured / fail-open contract. Throws only for an unknown
 * alert type (a programming error — keys are code-owned).
 */
export async function resolveBroadcastRecipients(
  tenantId: number,
  alertType: string,
): Promise<ResolvedRecipient[]> {
  const def = ALERT_BY_TYPE.get(alertType);
  if (!def) throw new Error(`Unknown broadcast alert type: ${alertType}`);

  let config: { member_user_ids: unknown; extra_emails: unknown } | null = null;
  try {
    const r = await pool.query<{ member_user_ids: unknown; extra_emails: unknown }>(
      `SELECT member_user_ids, extra_emails
         FROM broadcast_alert_recipients
        WHERE tenant_id = $1 AND alert_type = $2`,
      [tenantId, alertType],
    );
    config = r.rows[0] ?? null;
  } catch (err) {
    // A config-read failure must never break a send: fall back to the legacy
    // default audience (the same behavior as before this feature shipped).
    logger.error(
      { err, tenantId, alertType },
      "[broadcastRecipients] config read failed — using legacy default audience",
    );
    return legacyDefault(def, tenantId);
  }

  if (!config) return legacyDefault(def, tenantId);

  const memberIds = toNumberArray(config.member_user_ids);
  const extraEmails = toStringArray(config.extra_emails);

  const resolved: ResolvedRecipient[] = [];
  if (memberIds.length) {
    try {
      const r = await pool.query<{ app_user_id: number; email: string; name: string | null }>(
        `SELECT au.id AS app_user_id, au.email AS email, au.name AS name
           FROM tenant_members tm
           JOIN app_users au ON au.id = tm.user_id
          WHERE tm.tenant_id = $1
            AND au.id = ANY($2::int[])
            AND au.email IS NOT NULL AND au.email <> ''`,
        [tenantId, memberIds],
      );
      for (const row of r.rows) {
        resolved.push({ appUserId: row.app_user_id, email: row.email, name: row.name });
      }
    } catch (err) {
      logger.error(
        { err, tenantId, alertType },
        "[broadcastRecipients] member resolution failed — using legacy default audience",
      );
      return legacyDefault(def, tenantId);
    }
  }
  for (const e of extraEmails) {
    resolved.push({ appUserId: null, email: e, name: null });
  }

  const deduped = dedupeByEmail(resolved);

  // FAIL OPEN: a configured-but-empty account/billing alert must still reach
  // every admin rather than going to nobody.
  if (deduped.length === 0 && def.category === "account_billing") {
    return legacyAdmins(tenantId);
  }
  return deduped;
}
