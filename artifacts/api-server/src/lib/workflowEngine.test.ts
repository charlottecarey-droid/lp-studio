/**
 * Engine tests for the email workflow composer (Task #589).
 *
 * Runs against the REAL Postgres pool (the store layer is thin SQL over
 * email_workflow_* tables), but MOCKS dispatchNotification so no real email /
 * in-app send happens. We assert the engine's routing — enroll, idempotent
 * re-trigger, linear multi-step advance, branch on not_read / read, and the
 * hard fallback when no workflow matches — by inspecting the mock's calls and
 * the enrollment rows it writes.
 *
 * `isStructuralDbError` is kept REAL (only dispatchNotification is replaced) so
 * the structural-error rethrow path stays honest.
 *
 * Recipients are EMAIL-only (app_user_id NULL) so we don't need to seed real
 * app_users rows — both enrollments and notification_sends FK app_user_id, and
 * the engine's recipient key for an email is `e:<lowercased email>`.
 *
 * Gated on DB availability so it skips cleanly where no database is configured.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { pool } from "@workspace/db";

const { dispatchMock } = vi.hoisted(() => ({
  // Typed arg so `.mock.calls[n][0]` is a real (single-element) tuple rather
  // than an empty one — keeps the call-inspecting assertions type-safe.
  dispatchMock: vi.fn(async (_input: { templateKey: string } & Record<string, unknown>) => ({
    inAppCreated: 0,
    emailsSent: 1,
    emailsFailed: 0,
    skipped: 0,
  })),
}));

vi.mock("./notificationDispatcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notificationDispatcher")>();
  return { ...actual, dispatchNotification: dispatchMock };
});

import { enqueueWorkflowTrigger, runWorkflowSweep, __test } from "./workflowEngine";
import {
  createWorkflow,
  upsertTrigger,
  claimEnrollment,
  deleteWorkflow,
  deleteTrigger,
  type Workflow,
} from "./workflowStore";
import type { WorkflowStep } from "./workflowTypes";

function step(partial: Partial<WorkflowStep> & { id: string }): WorkflowStep {
  return {
    templateKey: "welcome",
    channels: ["email"],
    delayMs: 0,
    condition: null,
    branch: null,
    next: null,
    ...partial,
  };
}

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

let hasDb = false;
const SUFFIX = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const createdWorkflowIds: number[] = [];
const createdTriggerKeys: string[] = [];
const createdDedupeKeys: string[] = [];

function emailKey(email: string): string {
  return `e:${email.trim().toLowerCase()}`;
}

/** Make a unique trigger + workflow bound to a unique event key. */
async function makeWorkflow(
  label: string,
  steps: WorkflowStep[],
): Promise<{ workflow: Workflow; eventKey: string }> {
  const eventKey = `wf_test_evt_${label}_${SUFFIX}`;
  const triggerKey = `wf_test_trg_${label}_${SUFFIX}`;
  await upsertTrigger({
    key: triggerKey,
    name: `test ${label}`,
    triggerType: "event",
    eventKey,
    enabled: true,
  });
  createdTriggerKeys.push(triggerKey);
  const workflow = await createWorkflow({
    key: `wf_test_wf_${label}_${SUFFIX}`,
    name: `test ${label}`,
    triggerKey,
    enabled: true,
    definition: { steps },
  });
  createdWorkflowIds.push(workflow.id);
  return { workflow, eventKey };
}

beforeAll(async () => {
  hasDb = await dbReachable();
});

beforeEach(() => {
  dispatchMock.mockClear();
});

afterAll(async () => {
  if (!hasDb) return;
  for (const dk of createdDedupeKeys) {
    await pool.query(`DELETE FROM email_workflow_enrollments WHERE dedupe_key = $1`, [dk]);
    await pool.query(`DELETE FROM notification_sends WHERE dedupe_key LIKE $1`, [`${dk}%`]);
  }
  for (const id of createdWorkflowIds) await deleteWorkflow(id);
  for (const key of createdTriggerKeys) await deleteTrigger(key);
});

describe("enqueueWorkflowTrigger", () => {
  it("runs the caller's fallback when no workflow matches the event", async () => {
    if (!hasDb) return;
    const fallback = vi.fn(async () => {});
    await enqueueWorkflowTrigger({
      eventKey: `wf_test_no_match_${SUFFIX}`,
      tenantId: null,
      recipients: [{ appUserId: null, email: "wf-nomatch@example.com" }],
      context: {},
      dedupeBase: `nomatch:${SUFFIX}`,
      fallback,
    });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("runs the fallback when a matching workflow has zero steps (broken, can't send)", async () => {
    if (!hasDb) return;
    const { eventKey } = await makeWorkflow("empty", []);
    const fallback = vi.fn(async () => {});
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email: "wf-empty@example.com" }],
      context: {},
      dedupeBase: `empty:${SUFFIX}`,
      fallback,
    });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("runs the fallback when a matching workflow's only send step references an unknown template", async () => {
    if (!hasDb) return;
    const { eventKey } = await makeWorkflow("unknowntpl", [
      step({ id: "s1", templateKey: `__nonexistent_tpl_${SUFFIX}__` }),
    ]);
    const fallback = vi.fn(async () => {});
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email: "wf-unknowntpl@example.com" }],
      context: {},
      dedupeBase: `unknowntpl:${SUFFIX}`,
      fallback,
    });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("runs the fallback when a matching workflow is only branch-control nodes (no send step)", async () => {
    if (!hasDb) return;
    const { eventKey } = await makeWorkflow("branchonly", [
      step({
        id: "s1",
        templateKey: "",
        condition: { type: "not_read", stepId: "s1" },
        branch: { onTrue: null, onFalse: null },
      }),
    ]);
    const fallback = vi.fn(async () => {});
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email: "wf-branchonly@example.com" }],
      context: {},
      dedupeBase: `branchonly:${SUFFIX}`,
      fallback,
    });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("with a mixed match set (one executable + one broken), does NOT fall back and only the executable workflow sends", async () => {
    if (!hasDb) return;
    // Two workflows share one trigger/event: one executable, one broken (empty).
    const eventKey = `wf_test_evt_mixed_${SUFFIX}`;
    const triggerKey = `wf_test_trg_mixed_${SUFFIX}`;
    await upsertTrigger({
      key: triggerKey,
      name: "test mixed",
      triggerType: "event",
      eventKey,
      enabled: true,
    });
    createdTriggerKeys.push(triggerKey);
    const broken = await createWorkflow({
      key: `wf_test_wf_mixedbroken_${SUFFIX}`,
      name: "mixed broken",
      triggerKey,
      enabled: true,
      definition: { steps: [] },
    });
    createdWorkflowIds.push(broken.id);
    const good = await createWorkflow({
      key: `wf_test_wf_mixedgood_${SUFFIX}`,
      name: "mixed good",
      triggerKey,
      enabled: true,
      definition: { steps: [step({ id: "s1" })] },
    });
    createdWorkflowIds.push(good.id);
    const email = "wf-mixed@example.com";
    const dedupeBase = `mixed:${SUFFIX}`;
    createdDedupeKeys.push(`${dedupeBase}:${emailKey(email)}`);
    const fallback = vi.fn(async () => {});
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback,
    });
    expect(fallback).not.toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls[0]![0]).toMatchObject({ templateKey: "welcome" });
  });

  it("does NOT run the fallback when a workflow matches (engine owns the send)", async () => {
    if (!hasDb) return;
    const { eventKey } = await makeWorkflow("owns", [step({ id: "s1" })]);
    const email = "wf-owns@example.com";
    const dedupeBase = `owns:${SUFFIX}`;
    createdDedupeKeys.push(`${dedupeBase}:${emailKey(email)}`);
    const fallback = vi.fn(async () => {});
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback,
    });
    expect(fallback).not.toHaveBeenCalled();
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls[0]![0]).toMatchObject({ templateKey: "welcome" });
  });

  it("is idempotent: a duplicate trigger fire does not enroll or send twice", async () => {
    if (!hasDb) return;
    const { eventKey } = await makeWorkflow("idem", [step({ id: "s1" })]);
    const email = "wf-idem@example.com";
    const dedupeBase = `idem:${SUFFIX}`;
    const dedupeKey = `${dedupeBase}:${emailKey(email)}`;
    createdDedupeKeys.push(dedupeKey);
    const args = {
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback: async () => {},
    };
    await enqueueWorkflowTrigger(args);
    await enqueueWorkflowTrigger(args);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const rows = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_workflow_enrollments WHERE dedupe_key = $1`,
      [dedupeKey],
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it("advances a linear multi-step workflow, sending each step's template", async () => {
    if (!hasDb) return;
    const { eventKey, workflow } = await makeWorkflow("linear", [
      step({ id: "s1" }),
      step({ id: "s2", templateKey: "trial_day_7" }),
    ]);
    const email = "wf-linear@example.com";
    const dedupeBase = `linear:${SUFFIX}`;
    const dedupeKey = `${dedupeBase}:${emailKey(email)}`;
    createdDedupeKeys.push(dedupeKey);
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback: async () => {},
    });
    // s1 sent inline; enrollment now points at s2.
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const mid = await pool.query<{ current_step_id: string }>(
      `SELECT current_step_id FROM email_workflow_enrollments WHERE dedupe_key = $1`,
      [dedupeKey],
    );
    expect(mid.rows[0].current_step_id).toBe("s2");

    // Drive s2 directly (claim + process) so we don't disturb unrelated rows.
    await drive(dedupeKey, workflow);
    expect(dispatchMock).toHaveBeenCalledTimes(2);
    expect(dispatchMock.mock.calls[1]![0]).toMatchObject({ templateKey: "trial_day_7" });

    const done = await pool.query<{ status: string }>(
      `SELECT status FROM email_workflow_enrollments WHERE dedupe_key = $1`,
      [dedupeKey],
    );
    expect(done.rows[0].status).toBe("completed");
  });

  it("branches to onTrue when the referenced step is NOT read", async () => {
    if (!hasDb) return;
    const { eventKey, workflow } = await makeWorkflow("notread", [
      step({ id: "s1", channels: ["in_app"] }),
      step({
        id: "s2",
        templateKey: "",
        condition: { type: "not_read", stepId: "s1" },
        branch: { onTrue: "s3", onFalse: null },
      }),
      step({ id: "s3", templateKey: "trial_day_11" }),
    ]);
    const email = "wf-notread@example.com";
    const dedupeBase = `notread:${SUFFIX}`;
    const dedupeKey = `${dedupeBase}:${emailKey(email)}`;
    createdDedupeKeys.push(dedupeKey);
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback: async () => {},
    });
    // s1 sent inline; no notification_sends row seeded → isSendRead=false.
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    await drive(dedupeKey, workflow); // s2 branch → onTrue
    await drive(dedupeKey, workflow); // s3 send
    const templates = dispatchMock.mock.calls.map((c) => (c[0] as { templateKey: string }).templateKey);
    expect(templates).toContain("trial_day_11");
  });

  it("does NOT send the not_read fallback when the referenced step IS read", async () => {
    if (!hasDb) return;
    // Real-world shape: s1 = in-app, s2 = "if NOT read, send email s3 (onTrue),
    // else end (onFalse)". With s1 seeded as READ, not_read is false → onFalse →
    // end, so the email fallback never fires.
    const { eventKey, workflow } = await makeWorkflow("read", [
      step({ id: "s1", channels: ["in_app"] }),
      step({
        id: "s2",
        templateKey: "",
        condition: { type: "not_read", stepId: "s1" },
        branch: { onTrue: "s3", onFalse: null },
      }),
      step({ id: "s3", templateKey: "trial_day_13" }),
    ]);
    const email = "wf-read@example.com";
    const dedupeBase = `read:${SUFFIX}`;
    const dedupeKey = `${dedupeBase}:${emailKey(email)}`;
    createdDedupeKeys.push(dedupeKey);
    // Seed a READ in_app send for s1. Engine checks `${dedupeKey}:s:s1:${rk}`.
    const s1SendKey = `${dedupeKey}:s:s1:${emailKey(email)}`;
    await pool.query(
      `INSERT INTO notification_sends
         (tenant_id, app_user_id, recipient_email, template_key, channel, status, dedupe_key, sent_at, read_at)
       VALUES (NULL, NULL, $2, 'welcome', 'in_app', 'sent', $1, now(), now())
       ON CONFLICT (dedupe_key, channel) DO NOTHING`,
      [s1SendKey, email],
    );
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback: async () => {},
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1); // s1 only
    await drive(dedupeKey, workflow); // s2 branch → onFalse=null → end
    const templates = dispatchMock.mock.calls.map((c) => (c[0] as { templateKey: string }).templateKey);
    expect(templates).not.toContain("trial_day_13");
    const done = await pool.query<{ status: string }>(
      `SELECT status FROM email_workflow_enrollments WHERE dedupe_key = $1`,
      [dedupeKey],
    );
    expect(done.rows[0].status).toBe("completed");
  });
});

describe("runWorkflowSweep", () => {
  it("does not process a delayed first step inline; returns a well-formed result", async () => {
    if (!hasDb) return;
    // Far-future delay so a concurrently-running app instance's 60s sweep never
    // matches this row (status active but next_run_at not yet due). We then
    // claim + process it ourselves, deterministically, via the same
    // processClaimedEnrollment the sweep uses.
    const { eventKey, workflow } = await makeWorkflow("sweep", [
      step({ id: "s1", delayMs: 60_000 }),
    ]);
    const email = "wf-sweep@example.com";
    const dedupeBase = `sweep:${SUFFIX}`;
    const dedupeKey = `${dedupeBase}:${emailKey(email)}`;
    createdDedupeKeys.push(dedupeKey);
    await enqueueWorkflowTrigger({
      eventKey,
      tenantId: null,
      recipients: [{ appUserId: null, email }],
      context: {},
      dedupeBase,
      fallback: async () => {},
    });
    // Delayed first step → nothing sent inline.
    expect(dispatchMock).not.toHaveBeenCalled();

    // Smoke: the sweep's advisory-locked lease txn runs and returns counts.
    const res = await runWorkflowSweep();
    expect(typeof res.claimed).toBe("number");
    expect(typeof res.processed).toBe("number");
    // The global sweep may have touched unrelated due rows — ignore those so the
    // assertion below reflects only OUR enrollment.
    dispatchMock.mockClear();

    // Now drive the (otherwise far-future) enrollment to completion ourselves.
    await drive(dedupeKey, workflow);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls[0]![0]).toMatchObject({ templateKey: "welcome" });
    const done = await pool.query<{ status: string }>(
      `SELECT status FROM email_workflow_enrollments WHERE dedupe_key = $1`,
      [dedupeKey],
    );
    expect(done.rows[0].status).toBe("completed");
  });
});

async function enrollmentId(dedupeKey: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `SELECT id FROM email_workflow_enrollments WHERE dedupe_key = $1`,
    [dedupeKey],
  );
  return r.rows[0].id;
}

/** Make the enrollment due, claim it, and process exactly one step. */
async function drive(dedupeKey: string, workflow: Workflow): Promise<void> {
  await pool.query(
    `UPDATE email_workflow_enrollments SET next_run_at = now() - interval '1 second' WHERE dedupe_key = $1`,
    [dedupeKey],
  );
  const id = await enrollmentId(dedupeKey);
  const claimed = await claimEnrollment(id, __test.LEASE_MS);
  if (claimed) await __test.processClaimedEnrollment(claimed, workflow);
}
