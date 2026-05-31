import { pool } from "@workspace/db";
import { logger } from "./logger";
import { WILDCARD_BASE_HOSTS } from "./tenantHosts";
import { dispatchNotification, isStructuralDbError } from "./notificationDispatcher";
import { enqueueWorkflowTrigger } from "./workflowEngine";

// Trial lifecycle nudges. The 14-day Growth trial gets escalating reminders at
// day 7 (halfway), day 11 (3 days left), and day 13 (last day). Each milestone
// fires inside a 1-day window keyed off trial_expires_at; the dispatcher's
// dedupe keeps it to one delivery per admin per milestone even if a daily run
// is missed (and a later milestone still covers them). Daily cadence so a trial
// that crosses a window boundary at any time of day is caught.
export const TRIAL_NOTIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Defer the first trial sweep off the cold-start path (DB fan-out + Resend),
// same rationale as the asset sweeps.
export const TRIAL_NOTIFY_BOOT_DELAY_MS = 90 * 1000;
export const TRIAL_MILESTONES: { key: string; remainingDays: number }[] = [
  { key: "trial_day_7", remainingDays: 7 },
  { key: "trial_day_11", remainingDays: 3 },
  { key: "trial_day_13", remainingDays: 1 },
];

type TrialTenantRow = {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  trial_expires_at: Date;
};
type TrialAdminRow = { app_user_id: number | null; email: string | null; name: string | null };

// In-process guard against overlapping sweeps (boot + interval, or a slow run
// still going when the next tick fires). The dispatcher is idempotent anyway,
// but this avoids redundant DB/Resend work.
let trialNotifyInflight: Promise<void> | null = null;

// Trial lifecycle nudges (going-forward-only). For each milestone we select
// active, still-on-free tenants whose trial expires inside that milestone's
// 1-day window, look up their admins (with app_user_id for the in-app inbox),
// and hand them to the dispatcher. Tenants who upgraded (plan != 'free') or
// never had a trial (trial_expires_at IS NULL — i.e. all pre-trial-system
// accounts) are never matched, so existing accounts stay untouched.
export async function notifyTrialLifecycle(): Promise<void> {
  if (trialNotifyInflight) return trialNotifyInflight;
  trialNotifyInflight = (async () => {
    const baseHost = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;

    for (const milestone of TRIAL_MILESTONES) {
      let tenants: TrialTenantRow[];
      try {
        // Window for milestone with R days remaining: expires in (R-1, R] days.
        const result = await pool.query<TrialTenantRow>(
          `SELECT id, name, slug, domain, trial_expires_at
             FROM tenants
            WHERE status = 'active'
              AND plan = 'free'
              AND trial_expires_at IS NOT NULL
              AND trial_expires_at >  now() + (($1 - 1) || ' days')::interval
              AND trial_expires_at <= now() + ($1 || ' days')::interval`,
          [String(milestone.remainingDays)],
        );
        tenants = result.rows;
      } catch (err) {
        logger.error({ err, milestone: milestone.key }, "notifyTrialLifecycle: tenant query failed (non-fatal)");
        continue;
      }
      if (!tenants.length) continue;

      for (const t of tenants) {
        let admins: TrialAdminRow[];
        try {
          const adminResult = await pool.query<TrialAdminRow>(
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
            [t.id],
          );
          admins = adminResult.rows;
        } catch (err) {
          logger.error({ err, tenantId: t.id, milestone: milestone.key }, "notifyTrialLifecycle: admin lookup failed");
          continue;
        }
        if (!admins.length) continue;

        const workspaceUrl = t.domain
          ? `https://${t.domain.toLowerCase()}`
          : baseHost
            ? `https://${t.slug.toLowerCase()}.${baseHost}`
            : null;
        const billingUrl = workspaceUrl ? `${workspaceUrl}/settings/billing` : null;

        const recipients = admins.map(a => ({ appUserId: a.app_user_id, email: a.email, name: a.name }));
        const context = {
          tenantName: t.name,
          daysRemaining: milestone.remainingDays,
          workspaceUrl,
          billingUrl,
        };
        const dedupeBase = `${milestone.key}:tenant:${t.id}`;
        try {
          // Routed through the workflow engine (Task #589): each milestone is a
          // one-step workflow, so operators can extend it (e.g. add a branch or
          // a follow-up step). `fallback` is the original direct dispatch — run
          // verbatim when the workflow is disabled/missing, so the nudge is
          // byte-identical either way. The engine re-throws structural DB errors
          // (see enqueueWorkflowTrigger), preserving the loud-abort contract.
          await enqueueWorkflowTrigger({
            eventKey: milestone.key,
            tenantId: t.id,
            recipients,
            context,
            dedupeBase,
            fallback: () =>
              dispatchNotification({
                templateKey: milestone.key,
                tenantId: t.id,
                recipients,
                context,
                dedupeBase,
              }),
          });
          logger.info(
            { tenantId: t.id, milestone: milestone.key },
            "trial lifecycle nudge enqueued",
          );
        } catch (err) {
          // A missing notifications table/column would affect every tenant in
          // the sweep — rethrow so the run aborts loudly (the dev sweep
          // endpoint returns 500, the boot path logs a hard failure) instead of
          // logging the same structural error once per tenant and returning OK.
          if (isStructuralDbError(err)) throw err;
          logger.error({ err, tenantId: t.id, milestone: milestone.key }, "notifyTrialLifecycle: dispatch failed");
        }
      }
    }
  })().finally(() => { trialNotifyInflight = null; });
  return trialNotifyInflight;
}
