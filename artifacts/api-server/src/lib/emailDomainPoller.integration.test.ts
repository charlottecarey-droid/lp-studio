/**
 * Integration test for task #783's exactly-once email contract.
 *
 * Runs against the REAL Postgres pool (so `pg_try_advisory_lock` and the atomic
 * JSONB claim `UPDATE ... WHERE ...NotifiedId IS DISTINCT FROM id RETURNING id`
 * are exercised end-to-end), but mocks Resend's `getResendDomainById` and the
 * verified-email sender so the test never touches the network.
 *
 * Asserted contract:
 *   1. Verified email fires exactly once even when N pollers race.
 *   2. A subsequent scan after success does NOT re-fire.
 *   3. A `pending` domain does NOT fire.
 *   4. Re-registering a new domain id re-arms the notification.
 *   5. If every send fails, the claim is rolled back so the NEXT scan retries.
 *   6. claimEmailDomainNotification is atomic — only one of N racers wins.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { pool } from "@workspace/db";
import type { ResendDomainWriteResult } from "./resendDomainStatus";

// ── Mocks (hoisted by vitest, must be declared before SUT import) ───
const getByIdMock = vi.fn<(id: string) => Promise<ResendDomainWriteResult>>();

vi.mock("./resendDomainStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./resendDomainStatus")>();
  return {
    ...actual,
    getResendDomainById: (...args: Parameters<typeof getByIdMock>) => getByIdMock(...args),
  };
});

const sendVerifiedMock = vi.fn<() => Promise<boolean>>(async () => true);

vi.mock("./notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notifications")>();
  return {
    ...actual,
    sendEmailDomainVerifiedEmail: (...args: unknown[]) => sendVerifiedMock(...(args as [])),
  };
});

const { runEmailDomainPoll, claimEmailDomainNotification } = await import("./emailDomainPoller");

// ── Fixture helpers ──────────────────────────────────────────────────
let tenantId: number;
let roleId: number;
const FIXTURE_DOMAIN = "mail.test-emaildomain-poller.example.com";
const FIXTURE_DOMAIN_ID = "rd_emaildomain_poller_fixture";
const SLUG_TAG = `emaildomain-poller-${Date.now()}`;

function domainResult(status: "verified" | "pending", id = FIXTURE_DOMAIN_ID): ResendDomainWriteResult {
  return {
    available: true,
    domain: { id, name: FIXTURE_DOMAIN, status, records: [] },
  };
}

async function ensureFixture(): Promise<void> {
  // Clean up any orphans from prior failed runs (the poller selects every
  // tenant with a configured email domain id, so a stale orphan would inflate
  // the send count and break the race test).
  await pool.query(
    `DELETE FROM tenant_members WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'emaildomain-poller-%')`,
  ).catch(() => {});
  await pool.query(
    `DELETE FROM tenant_roles WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'emaildomain-poller-%')`,
  ).catch(() => {});
  await pool.query(
    `DELETE FROM lp_brand_settings WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'emaildomain-poller-%')`,
  ).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE slug LIKE 'emaildomain-poller-%'`).catch(() => {});

  const tenantRes = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('Email Domain Poller Tenant', $1, 'active') RETURNING id`,
    [SLUG_TAG],
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
     VALUES ($1, $2, 'emaildomain-poller-admin@example.com', now())`,
    [tenantId, roleId],
  );
}

async function teardownFixture(): Promise<void> {
  if (!tenantId) return;
  await pool.query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

/** Write the email-domain config slice, optionally pre-stamping the notified id. */
async function setDomainConfig(opts: {
  domainId: string | null;
  notifiedId?: string | null;
}): Promise<void> {
  const sc: Record<string, unknown> = {};
  if (opts.domainId) {
    sc.sendingDomain = FIXTURE_DOMAIN;
    sc.customEmailDomainId = opts.domainId;
  }
  if (opts.notifiedId) sc.customEmailDomainVerifiedNotifiedId = opts.notifiedId;
  const config = { salesConsole: sc };
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET config = $2, updated_at = now()`,
    [tenantId, config],
  ).catch(async () => {
    // lp_brand_settings may not have a unique constraint on tenant_id — fall
    // back to delete + insert.
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2)`, [tenantId, config]);
  });
}

async function readNotifiedId(): Promise<string | null> {
  const r = await pool.query<{ notified: string | null }>(
    `SELECT config->'salesConsole'->>'customEmailDomainVerifiedNotifiedId' AS notified
       FROM lp_brand_settings WHERE tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0]?.notified ?? null;
}

// ── Setup ───────────────────────────────────────────────────────────
beforeAll(async () => {
  await ensureFixture();
});
afterAll(async () => {
  await teardownFixture();
});
beforeEach(() => {
  sendVerifiedMock.mockReset().mockResolvedValue(true);
  getByIdMock.mockReset();
});

// ── Tests ───────────────────────────────────────────────────────────
describe("emailDomainPoller — exactly-once delivery (task #783)", () => {
  it("verified email fires exactly once even when N pollers race", async () => {
    await setDomainConfig({ domainId: FIXTURE_DOMAIN_ID });
    getByIdMock.mockResolvedValue(domainResult("verified"));

    await Promise.all([
      runEmailDomainPoll(),
      runEmailDomainPoll(),
      runEmailDomainPoll(),
      runEmailDomainPoll(),
      runEmailDomainPoll(),
    ]);

    expect(sendVerifiedMock).toHaveBeenCalledTimes(1);
    expect(await readNotifiedId()).toBe(FIXTURE_DOMAIN_ID);
  });

  it("a subsequent scan after success does not re-fire", async () => {
    await setDomainConfig({ domainId: FIXTURE_DOMAIN_ID });
    getByIdMock.mockResolvedValue(domainResult("verified"));
    await runEmailDomainPoll();
    expect(sendVerifiedMock).toHaveBeenCalledTimes(1);

    sendVerifiedMock.mockClear();
    await runEmailDomainPoll();
    expect(sendVerifiedMock).not.toHaveBeenCalled();
  });

  it("a pending domain does not fire", async () => {
    await setDomainConfig({ domainId: FIXTURE_DOMAIN_ID });
    getByIdMock.mockResolvedValue(domainResult("pending"));
    await runEmailDomainPoll();
    expect(sendVerifiedMock).not.toHaveBeenCalled();
    expect(await readNotifiedId()).toBeNull();
  });

  it("re-registering a new domain id re-arms the notification", async () => {
    // Phase 1: already notified for the old id.
    await setDomainConfig({ domainId: FIXTURE_DOMAIN_ID, notifiedId: FIXTURE_DOMAIN_ID });
    getByIdMock.mockResolvedValue(domainResult("verified"));
    await runEmailDomainPoll();
    expect(sendVerifiedMock).not.toHaveBeenCalled(); // already notified → no re-send

    // Phase 2: a different domain id is now configured (re-registration).
    const NEW_ID = "rd_emaildomain_poller_fixture_v2";
    await setDomainConfig({ domainId: NEW_ID });
    getByIdMock.mockResolvedValue(domainResult("verified", NEW_ID));
    await runEmailDomainPoll();
    expect(sendVerifiedMock).toHaveBeenCalledTimes(1); // re-armed
    expect(await readNotifiedId()).toBe(NEW_ID);
  });

  it("if every send fails, the claim is rolled back so the next scan retries", async () => {
    await setDomainConfig({ domainId: FIXTURE_DOMAIN_ID });
    getByIdMock.mockResolvedValue(domainResult("verified"));
    sendVerifiedMock.mockResolvedValue(false); // simulate Resend rejection

    await runEmailDomainPoll();
    expect(sendVerifiedMock).toHaveBeenCalledTimes(1);
    expect(await readNotifiedId()).toBeNull(); // claim released

    sendVerifiedMock.mockResolvedValue(true);
    await runEmailDomainPoll();
    expect(sendVerifiedMock).toHaveBeenCalledTimes(2);
    expect(await readNotifiedId()).toBe(FIXTURE_DOMAIN_ID);
  });

  it("claimEmailDomainNotification is atomic — only one of N concurrent callers wins", async () => {
    await setDomainConfig({ domainId: FIXTURE_DOMAIN_ID });

    const results = await Promise.all([
      claimEmailDomainNotification(tenantId, FIXTURE_DOMAIN_ID),
      claimEmailDomainNotification(tenantId, FIXTURE_DOMAIN_ID),
      claimEmailDomainNotification(tenantId, FIXTURE_DOMAIN_ID),
      claimEmailDomainNotification(tenantId, FIXTURE_DOMAIN_ID),
      claimEmailDomainNotification(tenantId, FIXTURE_DOMAIN_ID),
    ]);
    expect(results.filter(Boolean).length).toBe(1);
  });
});
