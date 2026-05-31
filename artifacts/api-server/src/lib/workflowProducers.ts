import { logger } from "./logger";
import { enroll, listEnabledWorkflowsByTriggerType, type Workflow } from "./workflowStore";
import {
  AUDIENCE_CAP,
  countAudience,
  listAudienceRecipients,
  type AudienceRecipient,
} from "./workflowAudience";
import { dueOccurrenceId } from "./workflowSchedule";
import { parseAudienceConfig, parseScheduledConfig, type AudienceRole } from "./workflowTypes";

export { AUDIENCE_CAP };

/**
 * Enrollment producers for scheduled + audience triggers (Task #626).
 *
 * The event-trigger path (enqueueWorkflowTrigger) is push: a callsite fires and
 * enrolls inline. Scheduled/audience triggers have no callsite — these producers
 * are PULL, run once per sweep tick (~60s) just before the engine step:
 *
 *   scheduled — when the current period's occurrence is due (dueOccurrenceId),
 *     enroll the trigger's audience with dedupe `${occurrenceId}:u${appUserId}`
 *     so each recipient lands exactly once per occurrence.
 *   audience  — enroll every currently-matching recipient with dedupe
 *     `match:u${appUserId}` so each recipient is enrolled at most once EVER for
 *     that workflow (a one-time "you now match this audience" enrollment).
 *
 * Both rely on enroll()'s UNIQUE(workflow_id, dedupe_key) idempotency, so a tick
 * that re-runs the same occurrence/match is a cheap no-op. Enrollments are only
 * created here; the engine sweep (which runs immediately after in the same tick)
 * drives their steps. A per-workflow cap bounds the rows minted per tick: a
 * configuration whose live audience exceeds AUDIENCE_CAP is REFUSED outright
 * (the error is logged, nothing is enrolled) rather than partially blasting the
 * first N recipients.
 */

/** Audience-filter summary string for the observability log line. */
function audienceSummary(role: AudienceRole): string {
  return `role=${role}`;
}

function buildContext(r: AudienceRecipient): Record<string, string> {
  const ctx: Record<string, string> = {};
  if (r.name) ctx.recipientName = r.name;
  return ctx;
}

async function enrollAudience(
  workflow: Workflow,
  recipients: AudienceRecipient[],
  dedupeKeyFor: (r: AudienceRecipient) => string,
): Promise<number> {
  const firstDelay = workflow.definition.steps[0]?.delayMs ?? 0;
  let created = 0;
  for (const r of recipients) {
    try {
      const id = await enroll({
        workflowId: workflow.id,
        tenantId: r.tenantId,
        appUserId: r.appUserId,
        recipientEmail: r.email,
        recipientName: r.name,
        context: buildContext(r),
        dedupeKey: dedupeKeyFor(r),
        firstStepDelayMs: firstDelay,
      });
      // null = already enrolled for this occurrence/match (idempotent no-op).
      if (id != null) created += 1;
    } catch (err) {
      logger.error(
        { err, workflowId: workflow.id, appUserId: r.appUserId },
        "[workflowProducers] enroll failed (recipient skipped; tick continues)",
      );
    }
  }
  return created;
}

export async function produceScheduledEnrollments(
  now: Date = new Date(),
): Promise<{ enrolled: number }> {
  const rows = await listEnabledWorkflowsByTriggerType("scheduled");
  let enrolled = 0;
  for (const { workflow, triggerConfig } of rows) {
    const config = parseScheduledConfig(triggerConfig);
    if (!config) continue; // malformed schedule → fail closed, nothing enrolled
    if (workflow.definition.steps.length === 0) continue;
    const occurrenceId = dueOccurrenceId(config, now);
    if (!occurrenceId) continue; // not due in the current period
    const recipientCount = await countAudience(config.role);
    if (recipientCount > AUDIENCE_CAP) {
      // Over the safety cap → REFUSE the whole occurrence (no partial blast).
      logger.error(
        {
          workflowId: workflow.id,
          triggerType: "scheduled",
          audience: audienceSummary(config.role),
          recipientCount,
          cap: AUDIENCE_CAP,
          occurrenceId,
        },
        "[workflowProducers] audience exceeds cap — refusing to enroll (no send)",
      );
      continue;
    }
    const recipients = await listAudienceRecipients(config.role, AUDIENCE_CAP);
    const created = await enrollAudience(workflow, recipients, (r) => `${occurrenceId}:u${r.appUserId}`);
    enrolled += created;
    logger.info(
      {
        workflowId: workflow.id,
        triggerType: "scheduled",
        audience: audienceSummary(config.role),
        recipientCount,
        enrolled: created,
        occurrenceId,
      },
      "[workflowProducers] scheduled occurrence fired",
    );
  }
  return { enrolled };
}

export async function produceAudienceEnrollments(): Promise<{ enrolled: number }> {
  const rows = await listEnabledWorkflowsByTriggerType("audience");
  let enrolled = 0;
  for (const { workflow, triggerConfig } of rows) {
    const config = parseAudienceConfig(triggerConfig);
    if (!config) continue; // no/invalid role → fail closed
    if (workflow.definition.steps.length === 0) continue;
    const recipientCount = await countAudience(config.role);
    if (recipientCount > AUDIENCE_CAP) {
      // Over the safety cap → REFUSE the whole audience (no partial blast).
      logger.error(
        {
          workflowId: workflow.id,
          triggerType: "audience",
          audience: audienceSummary(config.role),
          recipientCount,
          cap: AUDIENCE_CAP,
          occurrenceId: "match",
        },
        "[workflowProducers] audience exceeds cap — refusing to enroll (no send)",
      );
      continue;
    }
    const recipients = await listAudienceRecipients(config.role, AUDIENCE_CAP);
    const created = await enrollAudience(workflow, recipients, (r) => `match:u${r.appUserId}`);
    enrolled += created;
    logger.info(
      {
        workflowId: workflow.id,
        triggerType: "audience",
        audience: audienceSummary(config.role),
        recipientCount,
        enrolled: created,
        occurrenceId: "match",
      },
      "[workflowProducers] audience matched enrolled",
    );
  }
  return { enrolled };
}
