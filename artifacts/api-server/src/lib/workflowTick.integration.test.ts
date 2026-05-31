/**
 * End-to-end tick test for the scheduled + audience send path (Task #663).
 *
 * This is the highest-risk surface: it runs unattended on the server boot timer
 * (scheduleWorkflowSweep → runWorkflowTick every ~60s). The existing coverage is
 * split — workflowProducers.integration.test.ts proves the producers INSERT the
 * right enrollment rows, and workflowEngine.test.ts proves the engine routes a
 * step's send — but nothing exercises ONE real tick driving a scheduled trigger
 * and an audience trigger all the way from "enroll the audience" to "dispatch
 * each recipient", which is exactly what fires on the server.
 *
 * We run the REAL runWorkflowTick against the REAL Postgres pool (real producers,
 * real enroll, real sweep) and MOCK ONLY dispatchNotification so no email leaves
 * the box. We assert:
 *
 *   1. One tick enrolls each seeded recipient into BOTH the scheduled and the
 *      audience workflow (correct per-recipient enrollment + dedupe shape) and
 *      the sweep dispatches each recipient's send for each workflow.
 *   2. Re-running the tick is idempotent: no duplicate enrollments are minted and
 *      no recipient is dispatched a second time (the prior tick completed them).
 *
 * Isolation: the role buckets are GLOBAL (every active admin matches the
 * `admin` audience), so we never assert global counts — only that OUR
 * uniquely-suffixed seeded users are present, enrolled, and dispatched, and that
 * each dispatch is attributed to the right workflow via its step dedupeBase
 * (`…:w<workflowId>:s:<stepId>:…`). We deliberately target the `admin` bucket
 * (not `superadmin`) so we never mutate the superadmin population that the
 * sibling producer test (workflowProducers.integration.test.ts) asserts a
 * full-set equality on — both files run in parallel against the same DB.
 * Everything created CASCADEs off the seeded workflow / tenant rows in afterAll
 * (workflow_id ON DELETE CASCADE), and dispatch is mocked so no
 * notification_sends rows are written. Gated on DB availability so it skips
 * cleanly where no database is configured.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { pool } from "@workspace/db";

const { dispatchMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(
    async (_input: { templateKey: string; dedupeBase: string } & Record<string, unknown>) => ({
      inAppCreated: 0,
      emailsSent: 1,
      emailsFailed: 0,
      skipped: 0,
      deduped: 0,
    }),
  ),
}));

vi.mock("./notificationDispatcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notificationDispatcher")>();
  return { ...actual, dispatchNotification: dispatchMock };
});

import { runWorkflowTick, __test } from "./workflowEngine";
import { claimEnrollment } from "./workflowStore";

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

const SUFFIX = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
let hasDb = false;

let tenantId = 0;
const seededUserIds: number[] = [];

let audienceWorkflowId = 0;
let scheduledWorkflowId = 0;
const audienceTriggerKey = `wf663_aud_trg_${SUFFIX}`;
const scheduledTriggerKey = `wf663_sch_trg_${SUFFIX}`;

// Daily 00:00 schedule so the occurrence is always due for our fixed `now`.
const NOW = new Date("2026-05-31T12:00:00Z");
const OCC = "2026-05-31";

// One send step with a FAR-FUTURE delay. The producers still enroll each
// recipient on the tick, but the enrollment's next_run_at lands ~24h out, so no
// concurrent test sweep — and crucially no live deployment sweep against this
// same DB — can ever claim these rows and send a REAL email to a real bucket
// member. We then drive ONLY our seeded (fake-email) enrollments through the
// engine's own per-step executor to assert dispatch deterministically.
const STEP = `{"steps":[{"id":"s1","templateKey":"welcome","channels":["email"],"delayMs":86400000,"condition":null,"branch":null,"next":null}]}`;

// An "admin" recipient = a non-superadmin app_user who is a member of some
// tenant via a role with is_admin = true (see workflowAudience.rolePredicate).
async function insertAdmin(label: string, adminRoleId: number): Promise<number> {
  const u = await pool.query<{ id: number }>(
    `INSERT INTO app_users (email, name, role, status)
     VALUES ($1, $2, 'rep', 'active') RETURNING id`,
    [`wf663-${label}-${SUFFIX}@example.com`, `WF663 ${label}`],
  );
  const userId = u.rows[0].id;
  await pool.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`,
    [tenantId, userId, adminRoleId],
  );
  return userId;
}

beforeAll(async () => {
  hasDb = await dbReachable();
  if (!hasDb) return;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
    [`WF663 ${SUFFIX}`, `wf663-${SUFFIX}`],
  );
  tenantId = t.rows[0].id;

  const ar = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, is_admin) VALUES ($1, 'Admin', true) RETURNING id`,
    [tenantId],
  );
  const adminRoleId = ar.rows[0].id;

  // A small seeded audience in the `admin` bucket.
  for (const label of ["a", "b", "c"]) {
    seededUserIds.push(await insertAdmin(label, adminRoleId));
  }

  // Audience trigger + workflow (role = admin).
  await pool.query(
    `INSERT INTO email_workflow_triggers (key, name, trigger_type, config, enabled)
     VALUES ($1, 'WF663 audience', 'audience', '{"role":"admin"}'::jsonb, true)`,
    [audienceTriggerKey],
  );
  const aw = await pool.query<{ id: number }>(
    `INSERT INTO email_workflows (key, name, trigger_key, scope, enabled, definition)
     VALUES ($1, 'WF663 audience wf', $2, 'platform', true, $3::jsonb) RETURNING id`,
    [`wf663_aud_wf_${SUFFIX}`, audienceTriggerKey, STEP],
  );
  audienceWorkflowId = aw.rows[0].id;

  // Scheduled trigger + workflow (role = admin, daily 00:00 → due for NOW).
  await pool.query(
    `INSERT INTO email_workflow_triggers (key, name, trigger_type, config, enabled)
     VALUES ($1, 'WF663 scheduled', 'scheduled', '{"role":"admin","frequency":"daily","time":"00:00"}'::jsonb, true)`,
    [scheduledTriggerKey],
  );
  const sw = await pool.query<{ id: number }>(
    `INSERT INTO email_workflows (key, name, trigger_key, scope, enabled, definition)
     VALUES ($1, 'WF663 scheduled wf', $2, 'platform', true, $3::jsonb) RETURNING id`,
    [`wf663_sch_wf_${SUFFIX}`, scheduledTriggerKey, STEP],
  );
  scheduledWorkflowId = sw.rows[0].id;
});

afterAll(async () => {
  if (!hasDb) return;
  // Deleting the workflows CASCADEs their enrollments (workflow_id ON DELETE
  // CASCADE), including rows minted for any non-seeded users in the bucket.
  for (const id of [audienceWorkflowId, scheduledWorkflowId]) {
    if (id) await pool.query(`DELETE FROM email_workflows WHERE id = $1`, [id]);
  }
  await pool.query(`DELETE FROM email_workflow_triggers WHERE key IN ($1, $2)`, [
    audienceTriggerKey,
    scheduledTriggerKey,
  ]);
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  for (const id of seededUserIds) {
    await pool.query(`DELETE FROM app_users WHERE id = $1`, [id]);
  }
});

interface EnrollRow {
  app_user_id: number | null;
  dedupe_key: string;
  status: string;
}

async function enrollmentsFor(workflowId: number): Promise<EnrollRow[]> {
  const r = await pool.query<EnrollRow>(
    `SELECT app_user_id, dedupe_key, status
       FROM email_workflow_enrollments WHERE workflow_id = $1`,
    [workflowId],
  );
  return r.rows;
}

/** Total enrollment rows in this workflow belonging to OUR seeded users. */
async function seededEnrollmentTotal(workflowId: number): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM email_workflow_enrollments
      WHERE workflow_id = $1 AND app_user_id = ANY($2::int[])`,
    [workflowId, seededUserIds],
  );
  return r.rows[0]?.n ?? 0;
}

/** Status of a seeded user's enrollment in a workflow (null = no row). */
async function seededStatus(workflowId: number, appUserId: number): Promise<string | null> {
  const r = await pool.query<{ status: string }>(
    `SELECT status FROM email_workflow_enrollments
      WHERE workflow_id = $1 AND app_user_id = $2`,
    [workflowId, appUserId],
  );
  return r.rows[0]?.status ?? null;
}

/**
 * Drive ONE seeded enrollment through the engine exactly as the sweep would:
 * make it due, claim it (atomic lease), then run the same per-step executor the
 * sweep calls (`__test.processClaimedEnrollment`). We deliberately do NOT run
 * the global `runWorkflowSweep` here — it would claim other tests' / the live
 * deployment's due rows and dispatch them through THIS file's mock (and could
 * send real bucket members on a shared DB). Scoping to (workflow_id, app_user_id)
 * is required because dedupe_key is only unique per workflow. Returns true if a
 * step was processed (false if the row was not active / already completed).
 */
async function drive(workflowId: number, appUserId: number): Promise<boolean> {
  const idRes = await pool.query<{ id: number }>(
    `UPDATE email_workflow_enrollments
        SET next_run_at = now() - interval '1 second'
      WHERE workflow_id = $1 AND app_user_id = $2 AND status = 'active'
      RETURNING id`,
    [workflowId, appUserId],
  );
  const id = idRes.rows[0]?.id;
  if (id == null) return false;
  const claimed = await claimEnrollment(id, __test.LEASE_MS);
  if (!claimed) return false;
  await __test.processClaimedEnrollment(claimed);
  return true;
}

/** appUserIds dispatched for the given workflow, read off the mock's calls. */
function dispatchedUserIdsFor(workflowId: number): Set<number> {
  const ids = new Set<number>();
  for (const call of dispatchMock.mock.calls) {
    const input = call[0] as unknown as {
      dedupeBase: string;
      recipients: { appUserId: number | null }[];
    };
    if (!input.dedupeBase.includes(`:w${workflowId}:`)) continue;
    for (const r of input.recipients) {
      if (r.appUserId != null) ids.add(r.appUserId);
    }
  }
  return ids;
}

describe("scheduled + audience tick end-to-end (Task #663)", () => {
  it("enrolls and dispatches each seeded recipient for both triggers on one tick", async () => {
    if (!hasDb) return expect(true).toBe(true);
    dispatchMock.mockClear();

    // One real tick = real producers (scheduled + audience) + real sweep.
    await runWorkflowTick(NOW);

    // Audience workflow: each seeded user enrolled once with the match dedupe.
    const audRows = await enrollmentsFor(audienceWorkflowId);
    const audKeys = new Set(audRows.map((r) => r.dedupe_key));
    for (const uid of seededUserIds) {
      expect(audKeys.has(`match:u${uid}`)).toBe(true);
    }

    // Scheduled workflow: each seeded user enrolled once for the due occurrence.
    const schRows = await enrollmentsFor(scheduledWorkflowId);
    const schKeys = new Set(schRows.map((r) => r.dedupe_key));
    for (const uid of seededUserIds) {
      expect(schKeys.has(`${OCC}:u${uid}`)).toBe(true);
    }

    // Drive each seeded recipient's enrollment through the engine (the same
    // per-step executor the sweep uses) and assert each one dispatched for BOTH
    // workflows, attributed via the step dedupeBase (`…:w<workflowId>:…`).
    for (const uid of seededUserIds) {
      expect(await drive(audienceWorkflowId, uid)).toBe(true);
      expect(await drive(scheduledWorkflowId, uid)).toBe(true);
    }
    const audDispatched = dispatchedUserIdsFor(audienceWorkflowId);
    const schDispatched = dispatchedUserIdsFor(scheduledWorkflowId);
    for (const uid of seededUserIds) {
      expect(audDispatched.has(uid)).toBe(true);
      expect(schDispatched.has(uid)).toBe(true);
    }

    // A single send step → each seeded enrollment is now completed (non-active).
    for (const uid of seededUserIds) {
      expect(await seededStatus(audienceWorkflowId, uid)).toBe("completed");
      expect(await seededStatus(scheduledWorkflowId, uid)).toBe("completed");
    }
  });

  it("is idempotent on re-tick: no duplicate enrollments and no second dispatch", async () => {
    if (!hasDb) return expect(true).toBe(true);
    // Idempotency is a PER-RECIPIENT guarantee, so we scope the assertion to our
    // seeded users. We can't compare the whole workflow's enrollment set: the
    // role buckets are global and sibling integration tests run in parallel
    // against the same DB, so the non-seeded population can shift between ticks.
    // Each seeded user must have exactly one enrollment per workflow both before
    // and after — re-ticking mints no duplicate.
    const n = seededUserIds.length;
    expect(await seededEnrollmentTotal(audienceWorkflowId)).toBe(n);
    expect(await seededEnrollmentTotal(scheduledWorkflowId)).toBe(n);

    dispatchMock.mockClear();
    await runWorkflowTick(NOW);

    // Still exactly one enrollment per seeded user per workflow (no dupes minted
    // for the same occurrence/match).
    expect(await seededEnrollmentTotal(audienceWorkflowId)).toBe(n);
    expect(await seededEnrollmentTotal(scheduledWorkflowId)).toBe(n);

    // No seeded recipient is dispatched again — their enrollments completed on
    // the first test's drive, so re-driving is a no-op (nothing left to claim).
    // (We scope to our seeded users + workflows; the tick's internal global
    // sweep may legitimately touch unrelated due rows via this file's mock.)
    for (const uid of seededUserIds) {
      expect(await drive(audienceWorkflowId, uid)).toBe(false);
      expect(await drive(scheduledWorkflowId, uid)).toBe(false);
    }
    const audDispatched = dispatchedUserIdsFor(audienceWorkflowId);
    const schDispatched = dispatchedUserIdsFor(scheduledWorkflowId);
    for (const uid of seededUserIds) {
      expect(audDispatched.has(uid)).toBe(false);
      expect(schDispatched.has(uid)).toBe(false);
    }
  });
});
