/**
 * Integration test for admin-defined CUSTOM recipient groups (Task #629).
 *
 * Runs against the REAL Postgres pool so the resolver's tenant-scoped member
 * lookup, the `custom:<id>` token handling, and the delete-strips-token jsonb
 * SQL are exercised end-to-end. No network is touched.
 *
 * Asserted contract:
 *   1. A `custom:<id>` token on ANY alert type resolves to the group's CURRENT
 *      members (by id → current email) UNION its extra emails.
 *   2. A token whose group has been deleted resolves to nobody (stale token is a
 *      safe no-op), and account/billing alerts then fail-open to all admins.
 *   3. Custom membership tracks the live roster: adding a member to the group
 *      changes who resolves with no edit to the alert config.
 *   4. The delete SQL (`groups - 'custom:<id>'`) strips the token from every
 *      referencing alert config so no dangling reference is left behind.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { pool } from "@workspace/db";
import {
  resolveBroadcastRecipients,
  makeCustomGroupToken,
} from "./broadcastRecipients";

const FIXTURE_SLUG_PREFIX = "custgrp-test-";

let tenantId: number;
let adminRoleId: number;
let memberRoleId: number;
let adminUserId: number;
let memberUserId: number;
let extraMemberUserId: number;

async function cleanupBySlug(): Promise<void> {
  // tenants ON DELETE CASCADE cleans broadcast_recipient_groups /
  // broadcast_alert_recipients / tenant_members / tenant_roles; app_users are
  // tenant-scoped and removed explicitly.
  await pool
    .query(
      `DELETE FROM app_users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE $1)`,
      [`${FIXTURE_SLUG_PREFIX}%`],
    )
    .catch(() => {});
  await pool
    .query(`DELETE FROM tenants WHERE slug LIKE $1`, [`${FIXTURE_SLUG_PREFIX}%`])
    .catch(() => {});
}

async function ensureFixture(): Promise<void> {
  await cleanupBySlug();

  const slug = `${FIXTURE_SLUG_PREFIX}${Date.now()}`;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('Custom Group Test', $1, 'active') RETURNING id`,
    [slug],
  );
  tenantId = t.rows[0].id;

  const adminRole = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Admin', '{}'::jsonb, true, true) RETURNING id`,
    [tenantId],
  );
  adminRoleId = adminRole.rows[0].id;

  const memberRole = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Member', '{}'::jsonb, false, false) RETURNING id`,
    [tenantId],
  );
  memberRoleId = memberRole.rows[0].id;

  // Three app_users: one admin, one member, one extra (added later).
  const mkUser = async (email: string, name: string): Promise<number> => {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO app_users (tenant_id, email, name, role, status)
       VALUES ($1, $2, $3, 'member', 'active') RETURNING id`,
      [tenantId, email, name],
    );
    return r.rows[0].id;
  };
  adminUserId = await mkUser("custgrp-admin@example.com", "Admin User");
  memberUserId = await mkUser("custgrp-member@example.com", "Member User");
  extraMemberUserId = await mkUser("custgrp-extra@example.com", "Extra User");

  const mkMembership = async (userId: number, roleId: number): Promise<void> => {
    await pool.query(
      `INSERT INTO tenant_members (tenant_id, role_id, user_id, email, accepted_at)
       VALUES ($1, $2, $3, (SELECT email FROM app_users WHERE id = $3), now())`,
      [tenantId, roleId, userId],
    );
  };
  await mkMembership(adminUserId, adminRoleId);
  await mkMembership(memberUserId, memberRoleId);
  await mkMembership(extraMemberUserId, memberRoleId);
}

async function createGroup(
  label: string,
  memberIds: number[],
  extraEmails: string[],
): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO broadcast_recipient_groups
       (tenant_id, label, member_user_ids, extra_emails, created_by, updated_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $5) RETURNING id`,
    [tenantId, label, JSON.stringify(memberIds), JSON.stringify(extraEmails), adminUserId],
  );
  return r.rows[0].id;
}

async function setAlertGroups(alertType: string, groups: string[]): Promise<void> {
  await pool.query(
    `INSERT INTO broadcast_alert_recipients
       (tenant_id, alert_type, member_user_ids, extra_emails, groups, updated_at)
     VALUES ($1, $2, '[]'::jsonb, '[]'::jsonb, $3::jsonb, now())
     ON CONFLICT (tenant_id, alert_type)
     DO UPDATE SET groups = EXCLUDED.groups, updated_at = now()`,
    [tenantId, alertType, JSON.stringify(groups)],
  );
}

beforeAll(async () => {
  await ensureFixture();
});
afterAll(async () => {
  await cleanupBySlug();
});
beforeEach(async () => {
  await pool.query(`DELETE FROM broadcast_alert_recipients WHERE tenant_id = $1`, [tenantId]);
  await pool.query(`DELETE FROM broadcast_recipient_groups WHERE tenant_id = $1`, [tenantId]);
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("custom recipient groups (Task #629)", () => {
  it("resolves a custom group to its members' current emails + extra emails on any alert", async () => {
    const groupId = await createGroup("Ops", [memberUserId], ["outsider@example.com"]);
    // Custom groups apply to every alert type — use an account/billing one.
    await setAlertGroups("payment_failed", [makeCustomGroupToken(groupId)]);

    const recips = await resolveBroadcastRecipients(tenantId, "payment_failed");
    const emails = recips.map((r) => r.email.toLowerCase()).sort();
    expect(emails).toEqual(["custgrp-member@example.com", "outsider@example.com"]);
  });

  it("resolves to the LIVE roster — adding a member to the group changes the result with no alert edit", async () => {
    const groupId = await createGroup("Ops", [memberUserId], []);
    await setAlertGroups("comment", [makeCustomGroupToken(groupId)]);

    let recips = await resolveBroadcastRecipients(tenantId, "comment");
    expect(recips.map((r) => r.email.toLowerCase()).sort()).toEqual([
      "custgrp-member@example.com",
    ]);

    // Add a second member to the GROUP (not the alert) → resolves at send time.
    await pool.query(
      `UPDATE broadcast_recipient_groups SET member_user_ids = $2::jsonb WHERE tenant_id = $1 AND id = $3`,
      [tenantId, JSON.stringify([memberUserId, extraMemberUserId]), groupId],
    );
    recips = await resolveBroadcastRecipients(tenantId, "comment");
    expect(recips.map((r) => r.email.toLowerCase()).sort()).toEqual([
      "custgrp-extra@example.com",
      "custgrp-member@example.com",
    ]);
  });

  it("treats a deleted group's token as a safe no-op (account/billing fails open to admins)", async () => {
    const groupId = await createGroup("Temp", [memberUserId], []);
    await setAlertGroups("payment_failed", [makeCustomGroupToken(groupId)]);
    // Simulate the group being deleted but a stale token left on the alert.
    await pool.query(`DELETE FROM broadcast_recipient_groups WHERE id = $1`, [groupId]);

    const recips = await resolveBroadcastRecipients(tenantId, "payment_failed");
    // Stale custom token resolves to nobody → fail-open to all admins.
    expect(recips.map((r) => r.email.toLowerCase())).toEqual(["custgrp-admin@example.com"]);
  });

  it("delete SQL strips the custom token from every referencing alert config", async () => {
    const groupId = await createGroup("Ops", [memberUserId], []);
    const token = makeCustomGroupToken(groupId);
    await setAlertGroups("comment", [token, "all_members"]);
    await setAlertGroups("payment_failed", [token, "all_admins"]);

    // Mirror the DELETE route's transactional strip.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM broadcast_recipient_groups WHERE tenant_id = $1 AND id = $2`,
        [tenantId, groupId],
      );
      await client.query(
        `UPDATE broadcast_alert_recipients
            SET groups = COALESCE(groups, '[]'::jsonb) - $2, updated_at = now()
          WHERE tenant_id = $1 AND groups ? $2`,
        [tenantId, token],
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    const rows = await pool.query<{ alert_type: string; groups: string[] }>(
      `SELECT alert_type, groups FROM broadcast_alert_recipients WHERE tenant_id = $1 ORDER BY alert_type`,
      [tenantId],
    );
    const byType = Object.fromEntries(rows.rows.map((r) => [r.alert_type, r.groups]));
    expect(byType["comment"]).toEqual(["all_members"]);
    expect(byType["payment_failed"]).toEqual(["all_admins"]);
  });
});
