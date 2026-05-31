/**
 * Integration test for the recipient-failure safety-net (Task #625).
 *
 * Runs against the REAL Postgres pool and the REAL dispatcher/engine wiring; the
 * ONLY thing stubbed is the outbound HTTP (globalThis.fetch) and RESEND_API_KEY,
 * so no real email leaves the box. We assert the end-to-end contract:
 *
 *   1. A workflow-driven email send that fails transiently BEFORE delivery is
 *      recorded in workflow_send_failures (and its dedupe claim is released).
 *   2. Retrying a failure whose recipient already has a delivered send resolves
 *      as a deduped no-op — no second copy is sent.
 *   3. Retrying a failure that now delivers marks the row resolved.
 *
 * A real email_workflows row is seeded for the workflow_id FK; everything it
 * creates (CASCADE) plus the seeded notification_sends rows are torn down in
 * afterAll. Recipients are email-only (app_user_id NULL) so no app_users rows
 * are needed. Gated on DB availability so it skips cleanly with no database.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { dispatchNotification } from "./notificationDispatcher";
import { retryWorkflowSendFailure } from "./workflowEngine";
import {
  recordWorkflowSendFailure,
  listWorkflowSendFailures,
  getWorkflowSendFailure,
} from "./workflowSendFailures";

const TEMPLATE_KEY = "welcome"; // ships enabled with an email channel
const STEP_ID = "s1";

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

function emailDedupeKey(dedupeBase: string, email: string): string {
  return `${dedupeBase}:e:${email.trim().toLowerCase()}`;
}

let hasDb = false;
let workflowId = 0;
const SUFFIX = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const seededSendDedupeKeys: string[] = [];

beforeAll(async () => {
  hasDb = await dbReachable();
  if (!hasDb) return;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO email_workflows (key, name, description, trigger_key, scope, enabled, definition)
     VALUES ($1, 'send-failure IT', '', $2, 'platform', true, '{"steps":[]}'::jsonb)
     RETURNING id`,
    [`wf_sf_it_${SUFFIX}`, `wf_sf_trg_${SUFFIX}`],
  );
  workflowId = r.rows[0].id;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (!hasDb) return;
  // workflow_send_failures rows CASCADE off the workflow row.
  if (workflowId) {
    await pool.query(`DELETE FROM email_workflows WHERE id = $1`, [workflowId]);
  }
  for (const k of seededSendDedupeKeys) {
    await pool.query(`DELETE FROM notification_sends WHERE dedupe_key = $1`, [k]);
  }
});

describe("workflow send-failure safety-net (Task #625)", () => {
  it("records a transient email send failure (and releases the claim) when driven by a workflow", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const email = `sf-rec-${randomUUID()}@example.com`;
    const dedupeBase = `sf_record_${SUFFIX}:w${workflowId}:s:${STEP_ID}`;
    const dedupeKey = emailDedupeKey(dedupeBase, email);
    seededSendDedupeKeys.push(dedupeKey);

    // A non-retryable 4xx makes sendEmail throw on the first attempt (no retry
    // backoff waits), so the failure path runs fast and deterministically.
    vi.stubEnv("RESEND_API_KEY", "re_test_fake");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("nope", { status: 400 }));

    const result = await dispatchNotification({
      templateKey: TEMPLATE_KEY,
      tenantId: null,
      recipients: [{ appUserId: null, email, name: "Test Recipient" }],
      context: { workspaceUrl: "https://example.com" },
      dedupeBase,
      channels: ["email"],
      failureLedger: { workflowId, stepId: STEP_ID, enrollmentId: null },
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.emailsSent).toBe(0);
    expect(result.emailsFailed).toBe(1);

    // The ledger row exists, unresolved, on the email channel.
    const rows = await pool.query<{
      channel: string;
      resolved_at: string | null;
      attempt_count: number;
      template_key: string;
    }>(
      `SELECT channel, resolved_at, attempt_count, template_key
         FROM workflow_send_failures WHERE dedupe_key = $1`,
      [dedupeKey],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].channel).toBe("email");
    expect(rows.rows[0].resolved_at).toBeNull();
    expect(rows.rows[0].attempt_count).toBe(1);
    expect(rows.rows[0].template_key).toBe(TEMPLATE_KEY);

    // The dedupe claim was released so a future sweep/retry isn't blocked.
    const claim = await pool.query(
      `SELECT 1 FROM notification_sends WHERE dedupe_key = $1 AND channel = 'email'`,
      [dedupeKey],
    );
    expect(claim.rows).toHaveLength(0);

    // And it surfaces in the superadmin unresolved list.
    const unresolved = await listWorkflowSendFailures({ resolved: false });
    expect(unresolved.some((f) => f.dedupe_key === dedupeKey)).toBe(true);
  });

  it("retry resolves as a deduped no-op when the recipient already has a delivery", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const email = `sf-dedupe-${randomUUID()}@example.com`;
    const dedupeBase = `sf_dedupe_${SUFFIX}:w${workflowId}:s:${STEP_ID}`;
    const dedupeKey = emailDedupeKey(dedupeBase, email);
    seededSendDedupeKeys.push(dedupeKey);

    // Simulate the recipient ALREADY having received this exact send.
    await pool.query(
      `INSERT INTO notification_sends
         (tenant_id, app_user_id, recipient_email, template_key, channel, status,
          subject, body, dedupe_key, sent_at)
       VALUES (NULL, NULL, $1, $2, 'email', 'sent', 'Welcome', 'Body', $3, now())`,
      [email, TEMPLATE_KEY, dedupeKey],
    );

    // And a recorded failure pointing at the same dedupe slot.
    await recordWorkflowSendFailure({
      workflowId,
      enrollmentId: null,
      stepId: STEP_ID,
      tenantId: null,
      appUserId: null,
      recipientEmail: email,
      recipientName: "Dedupe Recipient",
      channel: "email",
      templateKey: TEMPLATE_KEY,
      dedupeBase,
      dedupeKey,
      context: { workspaceUrl: "https://example.com" },
      error: "transient blip",
    });
    const failure = (await listWorkflowSendFailures({ resolved: false })).find(
      (f) => f.dedupe_key === dedupeKey,
    );
    expect(failure).toBeDefined();

    // If retry tried to actually send, this fetch would make it fail — proving
    // the dedupe short-circuit fired before any send.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("nope", { status: 400 }));

    const outcome = await retryWorkflowSendFailure(failure!.id);
    expect(outcome).toEqual({ ok: true, outcome: "deduped" });
    expect(fetchSpy).not.toHaveBeenCalled();

    const after = await getWorkflowSendFailure(failure!.id);
    expect(after?.resolved_at).not.toBeNull();
  });

  it("retry does NOT falsely resolve when a STALE 'pending' claim blocks the slot — it repairs and re-sends", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const email = `sf-stale-${randomUUID()}@example.com`;
    const dedupeBase = `sf_stale_${SUFFIX}:w${workflowId}:s:${STEP_ID}`;
    const dedupeKey = emailDedupeKey(dedupeBase, email);
    seededSendDedupeKeys.push(dedupeKey);

    // Simulate the failure-mode the safety-net must survive: a prior attempt
    // claimed the slot (status='pending'), the send failed, AND the claim-release
    // DELETE also failed — so an undelivered 'pending' row lingers on the slot.
    await pool.query(
      `INSERT INTO notification_sends
         (tenant_id, app_user_id, recipient_email, template_key, channel, status,
          subject, body, dedupe_key)
       VALUES (NULL, NULL, $1, $2, 'email', 'pending', 'Welcome', 'Body', $3)`,
      [email, TEMPLATE_KEY, dedupeKey],
    );

    await recordWorkflowSendFailure({
      workflowId,
      enrollmentId: null,
      stepId: STEP_ID,
      tenantId: null,
      appUserId: null,
      recipientEmail: email,
      recipientName: "Stale Recipient",
      channel: "email",
      templateKey: TEMPLATE_KEY,
      dedupeBase,
      dedupeKey,
      context: { workspaceUrl: "https://example.com" },
      error: "transient blip",
    });
    const failure = (await listWorkflowSendFailures({ resolved: false })).find(
      (f) => f.dedupe_key === dedupeKey,
    );
    expect(failure).toBeDefined();

    // The repaired retry must actually attempt (and here succeed at) the send —
    // proving it did NOT short-circuit on the stale 'pending' conflict.
    vi.stubEnv("RESEND_API_KEY", "re_test_fake");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "sent" }), { status: 200 }));

    const outcome = await retryWorkflowSendFailure(failure!.id);
    expect(fetchSpy).toHaveBeenCalled();
    expect(outcome).toEqual({ ok: true, outcome: "sent" });

    const after = await getWorkflowSendFailure(failure!.id);
    expect(after?.resolved_at).not.toBeNull();

    // Exactly one row on the slot, now genuinely delivered (the stale pending
    // was released and replaced by a sent row, not duplicated).
    const rows = await pool.query<{ status: string }>(
      `SELECT status FROM notification_sends WHERE dedupe_key = $1 AND channel = 'email'`,
      [dedupeKey],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe("sent");
  });

  it("two concurrent retries of the same failure send exactly once (serialized, no double-send)", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const email = `sf-conc-${randomUUID()}@example.com`;
    const dedupeBase = `sf_conc_${SUFFIX}:w${workflowId}:s:${STEP_ID}`;
    const dedupeKey = emailDedupeKey(dedupeBase, email);
    seededSendDedupeKeys.push(dedupeKey);

    // Stale 'pending' claim on the slot — the exact state where an unserialized
    // pair of retries could each repair-and-resend and deliver twice.
    await pool.query(
      `INSERT INTO notification_sends
         (tenant_id, app_user_id, recipient_email, template_key, channel, status,
          subject, body, dedupe_key)
       VALUES (NULL, NULL, $1, $2, 'email', 'pending', 'Welcome', 'Body', $3)`,
      [email, TEMPLATE_KEY, dedupeKey],
    );
    await recordWorkflowSendFailure({
      workflowId,
      enrollmentId: null,
      stepId: STEP_ID,
      tenantId: null,
      appUserId: null,
      recipientEmail: email,
      recipientName: "Concurrent Recipient",
      channel: "email",
      templateKey: TEMPLATE_KEY,
      dedupeBase,
      dedupeKey,
      context: { workspaceUrl: "https://example.com" },
      error: "transient blip",
    });
    const failure = (await listWorkflowSendFailures({ resolved: false })).find(
      (f) => f.dedupe_key === dedupeKey,
    );
    expect(failure).toBeDefined();

    // Count every outbound send attempt. A slow (50ms) success widens the race
    // window so an unserialized implementation would reliably send twice.
    vi.stubEnv("RESEND_API_KEY", "re_test_fake");
    let sendCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      sendCount += 1;
      await new Promise((r) => setTimeout(r, 50));
      return new Response(JSON.stringify({ id: "sent" }), { status: 200 });
    });

    const [a, b] = await Promise.all([
      retryWorkflowSendFailure(failure!.id),
      retryWorkflowSendFailure(failure!.id),
    ]);

    expect(fetchSpy).toHaveBeenCalled();
    // The advisory lock serializes the pair: the first delivers, the second sees
    // the now-resolved row (or the freshly 'sent' slot) and does NOT send again.
    expect(sendCount).toBe(1);
    expect([a.outcome, b.outcome].sort()).toEqual(["deduped", "sent"]);

    const after = await getWorkflowSendFailure(failure!.id);
    expect(after?.resolved_at).not.toBeNull();

    // Exactly one delivered row on the slot — no duplicate.
    const rows = await pool.query<{ status: string }>(
      `SELECT status FROM notification_sends WHERE dedupe_key = $1 AND channel = 'email'`,
      [dedupeKey],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe("sent");
  });

  it("retry that delivers marks the failure resolved", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }
    const email = `sf-retry-${randomUUID()}@example.com`;
    const dedupeBase = `sf_retry_${SUFFIX}:w${workflowId}:s:${STEP_ID}`;
    const dedupeKey = emailDedupeKey(dedupeBase, email);
    seededSendDedupeKeys.push(dedupeKey);

    await recordWorkflowSendFailure({
      workflowId,
      enrollmentId: null,
      stepId: STEP_ID,
      tenantId: null,
      appUserId: null,
      recipientEmail: email,
      recipientName: "Retry Recipient",
      channel: "email",
      templateKey: TEMPLATE_KEY,
      dedupeBase,
      dedupeKey,
      context: { workspaceUrl: "https://example.com" },
      error: "transient blip",
    });
    const failure = (await listWorkflowSendFailures({ resolved: false })).find(
      (f) => f.dedupe_key === dedupeKey,
    );
    expect(failure).toBeDefined();

    vi.stubEnv("RESEND_API_KEY", "re_test_fake");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "sent" }), { status: 200 }));

    const outcome = await retryWorkflowSendFailure(failure!.id);
    expect(fetchSpy).toHaveBeenCalled();
    expect(outcome).toEqual({ ok: true, outcome: "sent" });

    const after = await getWorkflowSendFailure(failure!.id);
    expect(after?.resolved_at).not.toBeNull();

    // A delivered send row now exists for the dedupe slot.
    const sent = await pool.query<{ status: string }>(
      `SELECT status FROM notification_sends WHERE dedupe_key = $1 AND channel = 'email'`,
      [dedupeKey],
    );
    expect(sent.rows).toHaveLength(1);
    expect(sent.rows[0].status).toBe("sent");
  });
});
