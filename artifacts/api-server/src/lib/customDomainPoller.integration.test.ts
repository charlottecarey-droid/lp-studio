/**
 * Integration test for task #415's exactly-once email contract.
 *
 * Runs against the REAL Postgres pool (so `pg_try_advisory_lock` and
 * the atomic `UPDATE ... WHERE notified_*_at IS NULL RETURNING id`
 * are exercised end-to-end), but mocks Cloudflare's `getCustomHostname`
 * and both Resend sender functions so the test never touches the
 * network.
 *
 * Asserted contract:
 *   1. Active email fires exactly once even when N pollers race.
 *   2. Stuck email fires exactly once for a domain pending ≥24h.
 *   3. A subsequent scan after success does NOT re-fire.
 *   4. Detach + re-attach re-arms both emails (the reset SQL lives in
 *      admin.ts but its effect — NULLed dedupe columns — is what the
 *      poller observes; we simulate it here).
 *   5. If every send fails, the claim is rolled back so the NEXT scan
 *      retries.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { pool } from "@workspace/db";
import type { CustomHostname } from "./cloudflare";

// ── Mocks (hoisted by vitest, must be declared before SUT import) ───
const getCustomHostnameMock = vi.fn<(id: string) => Promise<CustomHostname>>();
const getZoneNameMock = vi.fn<() => Promise<string>>(async () => "lpstudio.ai");

vi.mock("./cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cloudflare")>();
  return {
    ...actual,
    getCustomHostname: (...args: Parameters<typeof getCustomHostnameMock>) => getCustomHostnameMock(...args),
    getZoneName: (...args: Parameters<typeof getZoneNameMock>) => getZoneNameMock(...args),
  };
});

const sendActiveMock = vi.fn<() => Promise<boolean>>(async () => true);
const sendStuckMock = vi.fn<() => Promise<boolean>>(async () => true);

vi.mock("./notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notifications")>();
  return {
    ...actual,
    sendCustomDomainActiveEmail: (...args: unknown[]) => sendActiveMock(...(args as [])),
    sendCustomDomainStuckEmail: (...args: unknown[]) => sendStuckMock(...(args as [])),
  };
});

const { runCustomDomainPoll, claimNotificationSlot } = await import("./customDomainPoller");

// ── Fixture helpers ──────────────────────────────────────────────────
let tenantId: number;
let roleId: number;
const FIXTURE_HOSTNAME = "test-poller.example.com";
const FIXTURE_CH_ID = "ch_poller_test_fixture";

async function ensureFixture(): Promise<void> {
  // Clean up any orphans from prior failed runs that left rows behind.
  // The poller selects every tenant with our fixture cloudflare_hostname_id,
  // so a stale orphan would inflate the email count and break the race test.
  await pool.query(
    `DELETE FROM tenant_members WHERE tenant_id IN (SELECT id FROM tenants WHERE cloudflare_hostname_id = $1)`,
    [FIXTURE_CH_ID],
  ).catch(() => {});
  await pool.query(
    `DELETE FROM tenant_roles WHERE tenant_id IN (SELECT id FROM tenants WHERE cloudflare_hostname_id = $1)`,
    [FIXTURE_CH_ID],
  ).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE cloudflare_hostname_id = $1`, [FIXTURE_CH_ID]).catch(() => {});

  const slug = `poller-test-${Date.now()}`;
  const tenantRes = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, microsite_domain, cloudflare_hostname_id)
     VALUES ('Poller Test Tenant', $1, 'active', $2, $3)
     RETURNING id`,
    [slug, FIXTURE_HOSTNAME, FIXTURE_CH_ID],
  );
  tenantId = tenantRes.rows[0].id;

  const roleRes = await pool.query<{ id: number }>(
    `INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
     VALUES ($1, 'Admin', '{}'::jsonb, true, true) RETURNING id`,
    [tenantId],
  );
  roleId = roleRes.rows[0].id;

  await pool.query(
    `INSERT INTO tenant_members (tenant_id, role_id, email, accepted_at)
     VALUES ($1, $2, 'poller-test-admin@example.com', now())`,
    [tenantId, roleId],
  );
}

async function teardownFixture(): Promise<void> {
  if (!tenantId) return;
  await pool.query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

async function resetTenantState(opts: {
  attachedAt: Date | null;
  notifiedActiveAt?: Date | null;
  notifiedStuckAt?: Date | null;
}): Promise<void> {
  await pool.query(
    `UPDATE tenants
        SET microsite_domain = $1,
            cloudflare_hostname_id = $2,
            custom_domain_attached_at = $3,
            custom_domain_last_seen_status = NULL,
            custom_domain_notified_active_at = $4,
            custom_domain_notified_stuck_at = $5,
            updated_at = now()
      WHERE id = $6`,
    [
      FIXTURE_HOSTNAME,
      FIXTURE_CH_ID,
      opts.attachedAt,
      opts.notifiedActiveAt ?? null,
      opts.notifiedStuckAt ?? null,
      tenantId,
    ],
  );
}

function activeHostname(): CustomHostname {
  return { id: FIXTURE_CH_ID, hostname: FIXTURE_HOSTNAME, status: "active", ssl: { status: "active" } } as CustomHostname;
}
function pendingHostname(): CustomHostname {
  return { id: FIXTURE_CH_ID, hostname: FIXTURE_HOSTNAME, status: "pending", ssl: { status: "pending_validation" } } as CustomHostname;
}

// ── Setup ───────────────────────────────────────────────────────────
beforeAll(async () => {
  await ensureFixture();
});
afterAll(async () => {
  await teardownFixture();
});
beforeEach(() => {
  sendActiveMock.mockReset().mockResolvedValue(true);
  sendStuckMock.mockReset().mockResolvedValue(true);
  getCustomHostnameMock.mockReset();
  getZoneNameMock.mockReset().mockResolvedValue("lpstudio.ai");
});

// ── Tests ───────────────────────────────────────────────────────────
// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("customDomainPoller — exactly-once delivery (task #415)", () => {
  it("active email fires exactly once even when N pollers race", async () => {
    await resetTenantState({ attachedAt: new Date() });
    getCustomHostnameMock.mockResolvedValue(activeHostname());

    // Fire 5 concurrent polls. The advisory lock should serialize them
    // (so only one actually scans), and even if it didn't, the atomic
    // claim would dedupe to exactly one send.
    await Promise.all([
      runCustomDomainPoll(),
      runCustomDomainPoll(),
      runCustomDomainPoll(),
      runCustomDomainPoll(),
      runCustomDomainPoll(),
    ]);

    expect(sendActiveMock).toHaveBeenCalledTimes(1);
    expect(sendStuckMock).not.toHaveBeenCalled();

    // notified_active_at must be stamped.
    const after = await pool.query<{ notified: Date | null }>(
      `SELECT custom_domain_notified_active_at AS notified FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(after.rows[0].notified).not.toBeNull();
  });

  it("a subsequent scan after success does not re-fire", async () => {
    await resetTenantState({ attachedAt: new Date() });
    getCustomHostnameMock.mockResolvedValue(activeHostname());
    await runCustomDomainPoll();
    expect(sendActiveMock).toHaveBeenCalledTimes(1);

    sendActiveMock.mockClear();
    await runCustomDomainPoll();
    expect(sendActiveMock).not.toHaveBeenCalled();
  });

  it("stuck email fires exactly once for a domain pending ≥24h", async () => {
    const attachedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await resetTenantState({ attachedAt });
    getCustomHostnameMock.mockResolvedValue(pendingHostname());

    await Promise.all([runCustomDomainPoll(), runCustomDomainPoll(), runCustomDomainPoll()]);

    expect(sendStuckMock).toHaveBeenCalledTimes(1);
    expect(sendActiveMock).not.toHaveBeenCalled();

    const after = await pool.query<{ notified: Date | null }>(
      `SELECT custom_domain_notified_stuck_at AS notified FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(after.rows[0].notified).not.toBeNull();
  });

  it("stuck email does NOT fire while inside the threshold window", async () => {
    await resetTenantState({ attachedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) });
    getCustomHostnameMock.mockResolvedValue(pendingHostname());
    await runCustomDomainPoll();
    expect(sendStuckMock).not.toHaveBeenCalled();
  });

  it("detach + re-attach re-arms both emails", async () => {
    // Phase 1: active email already sent in a prior cycle.
    await resetTenantState({
      attachedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      notifiedActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      notifiedStuckAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
    });
    getCustomHostnameMock.mockResolvedValue(activeHostname());
    await runCustomDomainPoll();
    expect(sendActiveMock).not.toHaveBeenCalled(); // already notified → no re-send

    // Phase 2: simulate detach + re-attach (the reset SQL admin.ts runs).
    await resetTenantState({ attachedAt: new Date() }); // NULL notified_* columns
    await runCustomDomainPoll();
    expect(sendActiveMock).toHaveBeenCalledTimes(1); // re-armed
  });

  it("if every send fails, the claim is rolled back so the next scan retries", async () => {
    await resetTenantState({ attachedAt: new Date() });
    getCustomHostnameMock.mockResolvedValue(activeHostname());
    sendActiveMock.mockResolvedValue(false); // simulate Resend rejection

    await runCustomDomainPoll();
    expect(sendActiveMock).toHaveBeenCalledTimes(1);

    // notified_active_at must be NULL again (claim released).
    const after = await pool.query<{ notified: Date | null }>(
      `SELECT custom_domain_notified_active_at AS notified FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(after.rows[0].notified).toBeNull();

    // Next scan with a successful send actually delivers.
    sendActiveMock.mockResolvedValue(true);
    await runCustomDomainPoll();
    expect(sendActiveMock).toHaveBeenCalledTimes(2);
    const after2 = await pool.query<{ notified: Date | null }>(
      `SELECT custom_domain_notified_active_at AS notified FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(after2.rows[0].notified).not.toBeNull();
  });

  it("claimNotificationSlot is atomic — only one of N concurrent callers wins", async () => {
    await resetTenantState({ attachedAt: new Date() });

    const results = await Promise.all([
      claimNotificationSlot(tenantId, "active"),
      claimNotificationSlot(tenantId, "active"),
      claimNotificationSlot(tenantId, "active"),
      claimNotificationSlot(tenantId, "active"),
      claimNotificationSlot(tenantId, "active"),
    ]);
    const winners = results.filter(Boolean).length;
    expect(winners).toBe(1);
  });
});
