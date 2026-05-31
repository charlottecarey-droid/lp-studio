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

/**
 * Dynamic recipient GROUPS (Task #623). Unlike the explicit member ids / extra
 * emails, a group resolves to the CURRENT roster at SEND time, so adding or
 * removing a teammate later automatically changes who is alerted with no re-edit
 * of the config:
 *
 *   - all_admins  → every accepted workspace admin (mirrors `legacyAdmins`).
 *   - all_members → every workspace member with an email (mirrors
 *                   `legacyAllMembers`).
 *   - page_author → the creator/submitter of the SPECIFIC page that triggered a
 *                   page-scoped collaboration alert. Only meaningful for the
 *                   collaboration alert types; a no-op (resolves to nobody) for
 *                   account/billing types, which have no page context.
 */
export const BROADCAST_GROUP_TOKENS = [
  "all_admins",
  "all_members",
  "page_author",
] as const;
export type BroadcastGroupToken = (typeof BROADCAST_GROUP_TOKENS)[number];

const GROUP_TOKEN_SET = new Set<string>(BROADCAST_GROUP_TOKENS);

/**
 * Admin-defined CUSTOM recipient groups (Task #629) are referenced from a
 * saved `groups` array by the token `custom:<id>`, where <id> is a
 * `broadcast_recipient_groups.id`. Unlike the built-in tokens, custom groups
 * apply to EVERY alert type. These helpers are the single source of truth for
 * the token format so the resolver, the routes, and the UI agree.
 */
export const CUSTOM_GROUP_TOKEN_PREFIX = "custom:";

export function makeCustomGroupToken(id: number): string {
  return `${CUSTOM_GROUP_TOKEN_PREFIX}${id}`;
}

/** Parse a `custom:<id>` token to its numeric group id, or null if not one. */
export function parseCustomGroupToken(token: string): number | null {
  if (!token.startsWith(CUSTOM_GROUP_TOKEN_PREFIX)) return null;
  const raw = token.slice(CUSTOM_GROUP_TOKEN_PREFIX.length);
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Which group tokens apply to a given alert type. Every alert supports
 * all_admins / all_members; page_author is additionally offered ONLY for
 * page-scoped collaboration alerts (New comment, Review decision). Custom
 * groups (Task #629) apply to every alert type and are NOT included here —
 * they're resolved separately and surfaced from the tenant's group catalog.
 */
export function getApplicableGroupTokens(
  def: BroadcastAlertTypeDef,
): BroadcastGroupToken[] {
  const tokens: BroadcastGroupToken[] = ["all_admins", "all_members"];
  if (def.category === "collaboration") tokens.push("page_author");
  return tokens;
}

/** Identity of the page that triggered a page-scoped alert (Task #623). */
export interface PageAuthorContext {
  /** app_users.id of the page's submitter (review) — preferred. */
  userId?: number | null;
  /** Page creator email (e.g. lp_pages.created_by) — fallback. */
  email?: string | null;
}

export interface ResolveBroadcastOptions {
  /** Page author identity so the `page_author` group can resolve. */
  pageAuthor?: PageAuthorContext;
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
 * Resolve the `page_author` group to the single person who created/submitted the
 * page that triggered this alert. Prefers the submitter's app_users.id (review
 * decisions), falling back to the page's `created_by` email (comments). Returns
 * [] when there is no page context or the author can't be matched. Tenant-scoped
 * so a stale id can never leak a recipient from another workspace.
 *
 * The email fallback is doubly guarded for tenant isolation: an address is only
 * echoed as a bare recipient when it is NOT a known workspace account in any
 * OTHER tenant. An email that belongs to a DIFFERENT workspace's account
 * resolves to nobody — we must never deliver one workspace's alert to another
 * workspace's user. Genuinely external addresses (no account anywhere) are still
 * echoed so an external page creator can be alerted.
 */
async function resolvePageAuthor(
  tenantId: number,
  pageAuthor: PageAuthorContext | undefined,
): Promise<ResolvedRecipient[]> {
  if (!pageAuthor) return [];

  if (pageAuthor.userId && Number.isInteger(pageAuthor.userId) && pageAuthor.userId > 0) {
    const { rows } = await pool.query<{ id: number; email: string; name: string | null }>(
      `SELECT id, email, name
         FROM app_users
        WHERE id = $1 AND tenant_id = $2
          AND email IS NOT NULL AND email <> ''`,
      [pageAuthor.userId, tenantId],
    );
    if (rows[0]) {
      return [{ appUserId: rows[0].id, email: rows[0].email, name: rows[0].name }];
    }
  }

  const email = (pageAuthor.email ?? "").trim();
  if (email) {
    // Match the email to a workspace account where possible so the in-app inbox
    // item is delivered too; otherwise send to the bare address.
    const { rows } = await pool.query<{ id: number; email: string; name: string | null }>(
      `SELECT id, email, name
         FROM app_users
        WHERE lower(email) = lower($1) AND tenant_id = $2
          AND email IS NOT NULL AND email <> ''`,
      [email, tenantId],
    );
    if (rows[0]) {
      return [{ appUserId: rows[0].id, email: rows[0].email, name: rows[0].name }];
    }
    // The email is not an account in THIS tenant. Before echoing it as a bare
    // recipient, make sure it isn't a known account in another workspace — a
    // cross-tenant page author (e.g. a stale page reference) must resolve to
    // nobody, never deliver this workspace's alert to another workspace's user.
    const other = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM app_users
          WHERE lower(email) = lower($1) AND tenant_id <> $2
            AND email IS NOT NULL AND email <> ''
       ) AS exists`,
      [email, tenantId],
    );
    if (other.rows[0]?.exists) return [];
    return [{ appUserId: null, email, name: null }];
  }
  return [];
}

/**
 * Resolve a single admin-defined CUSTOM group (Task #629) to its CURRENT
 * recipients: the group's member ids mapped to their current emails (tenant
 * scoped so a stale id can't leak across workspaces) plus the group's extra
 * emails. A token whose group no longer exists resolves to nobody, so deleting
 * a group is always safe even if a stale reference lingers somewhere.
 */
async function resolveCustomGroup(
  tenantId: number,
  groupId: number,
): Promise<ResolvedRecipient[]> {
  const grp = await pool.query<{ member_user_ids: unknown; extra_emails: unknown }>(
    `SELECT member_user_ids, extra_emails
       FROM broadcast_recipient_groups
      WHERE tenant_id = $1 AND id = $2`,
    [tenantId, groupId],
  );
  const row = grp.rows[0];
  if (!row) return []; // group deleted → no-op (token is stale)

  const out: ResolvedRecipient[] = [];
  const memberIds = toNumberArray(row.member_user_ids);
  if (memberIds.length) {
    const r = await pool.query<{ app_user_id: number; email: string; name: string | null }>(
      `SELECT au.id AS app_user_id, au.email AS email, au.name AS name
         FROM tenant_members tm
         JOIN app_users au ON au.id = tm.user_id
        WHERE tm.tenant_id = $1
          AND au.id = ANY($2::int[])
          AND au.email IS NOT NULL AND au.email <> ''`,
      [tenantId, memberIds],
    );
    for (const m of r.rows) {
      out.push({ appUserId: m.app_user_id, email: m.email, name: m.name });
    }
  }
  for (const e of toStringArray(row.extra_emails)) {
    out.push({ appUserId: null, email: e, name: null });
  }
  return out;
}

/**
 * Expand the saved group tokens into concrete recipients using the CURRENT
 * roster. Built-in tokens not applicable to this alert type (e.g. `page_author`
 * on an account/billing alert) are silently ignored; custom groups
 * (`custom:<id>`, Task #629) apply to every alert type.
 */
async function resolveGroups(
  def: BroadcastAlertTypeDef,
  tenantId: number,
  groups: string[],
  pageAuthor: PageAuthorContext | undefined,
): Promise<ResolvedRecipient[]> {
  const applicable = new Set<string>(getApplicableGroupTokens(def));
  const out: ResolvedRecipient[] = [];
  for (const token of new Set(groups)) {
    const customId = parseCustomGroupToken(token);
    if (customId !== null) {
      out.push(...(await resolveCustomGroup(tenantId, customId)));
      continue;
    }
    if (!applicable.has(token)) continue; // unknown / not-applicable → no-op
    if (token === "all_admins") {
      out.push(...(await legacyAdmins(tenantId)));
    } else if (token === "all_members") {
      out.push(...(await legacyAllMembers(tenantId)));
    } else if (token === "page_author") {
      out.push(...(await resolvePageAuthor(tenantId, pageAuthor)));
    }
  }
  return out;
}

/**
 * Resolve the recipient list for a tenant's broadcast alert. See file header for
 * the configured / unconfigured / fail-open contract. Throws only for an unknown
 * alert type (a programming error — keys are code-owned).
 */
export async function resolveBroadcastRecipients(
  tenantId: number,
  alertType: string,
  opts?: ResolveBroadcastOptions,
): Promise<ResolvedRecipient[]> {
  const def = ALERT_BY_TYPE.get(alertType);
  if (!def) throw new Error(`Unknown broadcast alert type: ${alertType}`);

  let config:
    | { member_user_ids: unknown; extra_emails: unknown; groups: unknown }
    | null = null;
  try {
    const r = await pool.query<{ member_user_ids: unknown; extra_emails: unknown; groups: unknown }>(
      `SELECT member_user_ids, extra_emails, groups
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
  // Keep built-in tokens and custom-group tokens (custom:<id>, Task #629);
  // drop anything else (legacy / unknown).
  const groups = toStringArray(config.groups).filter(
    (g) => GROUP_TOKEN_SET.has(g) || parseCustomGroupToken(g) !== null,
  );

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

  // Expand dynamic groups against the CURRENT roster and union them in.
  if (groups.length) {
    try {
      resolved.push(...(await resolveGroups(def, tenantId, groups, opts?.pageAuthor)));
    } catch (err) {
      logger.error(
        { err, tenantId, alertType },
        "[broadcastRecipients] group resolution failed — using legacy default audience",
      );
      return legacyDefault(def, tenantId);
    }
  }

  const deduped = dedupeByEmail(resolved);

  // FAIL OPEN: a configured-but-empty account/billing alert must still reach
  // every admin rather than going to nobody.
  if (deduped.length === 0 && def.category === "account_billing") {
    return legacyAdmins(tenantId);
  }
  return deduped;
}
