/**
 * Integration test for task #787's branded email-subdomain retirement sweep.
 *
 * Runs against the REAL Postgres pool (so the status-refresh jsonb_set and the
 * shared deprovision path's config-clear are exercised end-to-end), but mocks
 * Resend's `getResendDomainById` / `deleteResendDomain` and Cloudflare's
 * `deleteDnsRecord` so the test never touches the network.
 *
 * Asserted contract:
 *   1. A verified subdomain is NOT retired and its active flag is persisted.
 *   2. An unverified subdomain WITHIN the threshold is NOT retired.
 *   3. An unverified subdomain PAST the threshold IS retired (config cleared,
 *      Resend domain + Cloudflare records torn down).
 *   4. A missing provisionedAt is backfilled (and that subdomain survives the
 *      same scan — the clock only just started).
 *   5. A Resend outage never retires (fail-closed: unconfirmed status).
 *   6. shouldRetireBrandedSubdomain staleness math (pure unit).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { pool } from "@workspace/db";
import type { ResendDomainWriteResult } from "./resendDomainStatus";

// ── Mocks (hoisted by vitest, must be declared before SUT import) ───
const getByIdMock = vi.fn<(id: string) => Promise<ResendDomainWriteResult>>();
const deleteResendMock = vi.fn<(id: string) => Promise<ResendDomainWriteResult>>(async () => ({ available: true }));

vi.mock("./resendDomainStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./resendDomainStatus")>();
  return {
    ...actual,
    getResendDomainById: (...args: Parameters<typeof getByIdMock>) => getByIdMock(...args),
    deleteResendDomain: (...args: Parameters<typeof deleteResendMock>) => deleteResendMock(...args),
  };
});

const deleteDnsMock = vi.fn<(id: string) => Promise<void>>(async () => {});

vi.mock("./cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cloudflare")>();
  return {
    ...actual,
    deleteDnsRecord: (...args: Parameters<typeof deleteDnsMock>) => deleteDnsMock(...args),
  };
});

const { runBrandedEmailSubdomainPoll, shouldRetireBrandedSubdomain } = await import("./brandedEmailSubdomainPoller");

// ── Fixture helpers ──────────────────────────────────────────────────
let tenantId: number;
const FIXTURE_SUBDOMAIN = "mail.branded-poller.example.com";
const FIXTURE_DOMAIN_ID = "rd_branded_poller_fixture";
const SLUG_TAG = `branded-poller-${Date.now()}`;
const HOUR_MS = 60 * 60 * 1000;

function domainResult(status: "verified" | "pending", id = FIXTURE_DOMAIN_ID): ResendDomainWriteResult {
  return { available: true, domain: { id, name: FIXTURE_SUBDOMAIN, status, records: [] } };
}

async function ensureFixture(): Promise<void> {
  await pool.query(
    `DELETE FROM lp_brand_settings WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'branded-poller-%')`,
  ).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE slug LIKE 'branded-poller-%'`).catch(() => {});

  const tenantRes = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('Branded Poller Tenant', $1, 'active') RETURNING id`,
    [SLUG_TAG],
  );
  tenantId = tenantRes.rows[0].id;
}

async function teardownFixture(): Promise<void> {
  if (!tenantId) return;
  await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

/** Write the branded-subdomain config slice. */
async function setConfig(opts: {
  domainId: string | null;
  provisionedAt?: string | null;
  active?: boolean | null;
  dnsRecordIds?: string[];
}): Promise<void> {
  const sc: Record<string, unknown> = {};
  if (opts.domainId) {
    sc.brandedEmailSubdomain = FIXTURE_SUBDOMAIN;
    sc.brandedEmailSubdomainId = opts.domainId;
    sc.brandedEmailSubdomainDnsRecordIds = opts.dnsRecordIds ?? ["cf_rec_1", "cf_rec_2"];
  }
  if (opts.provisionedAt !== undefined && opts.provisionedAt !== null) {
    sc.brandedEmailSubdomainProvisionedAt = opts.provisionedAt;
  }
  if (opts.active !== undefined && opts.active !== null) {
    sc.brandedSubdomainActive = opts.active;
  }
  const config = { salesConsole: sc };
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET config = $2, updated_at = now()`,
    [tenantId, config],
  ).catch(async () => {
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2)`, [tenantId, config]);
  });
}

async function readSc(): Promise<Record<string, unknown>> {
  const r = await pool.query<{ sc: Record<string, unknown> | null }>(
    `SELECT config->'salesConsole' AS sc FROM lp_brand_settings WHERE tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0]?.sc ?? {};
}

// ── Setup ───────────────────────────────────────────────────────────
beforeAll(async () => {
  await ensureFixture();
});
afterAll(async () => {
  await teardownFixture();
});
beforeEach(async () => {
  getByIdMock.mockReset();
  deleteResendMock.mockReset().mockResolvedValue({ available: true });
  deleteDnsMock.mockReset().mockResolvedValue(undefined);
  // Release any advisory lock leaked through the Neon pooler by a prior poll
  // (session lock can orphan when unlock lands on a different pooled backend).
  await pool.query(
    `SELECT pg_terminate_backend(pid) FROM pg_locks
      WHERE locktype = 'advisory' AND classid = 787 AND objid = 1
        AND pid <> pg_backend_pid()`,
  ).catch(() => {});
});

// ── Tests ───────────────────────────────────────────────────────────
// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("brandedEmailSubdomainPoller — retirement sweep (task #787)", () => {
  it("a verified subdomain is not retired and its active flag is persisted", async () => {
    await setConfig({ domainId: FIXTURE_DOMAIN_ID, provisionedAt: new Date(Date.now() - 100 * HOUR_MS).toISOString(), active: false });
    getByIdMock.mockResolvedValue(domainResult("verified"));

    await runBrandedEmailSubdomainPoll();

    const sc = await readSc();
    expect(sc.brandedEmailSubdomainId).toBe(FIXTURE_DOMAIN_ID); // still provisioned
    expect(sc.brandedSubdomainActive).toBe(true);
    expect(deleteResendMock).not.toHaveBeenCalled();
  });

  it("an unverified subdomain within the threshold is not retired", async () => {
    await setConfig({ domainId: FIXTURE_DOMAIN_ID, provisionedAt: new Date(Date.now() - 1 * HOUR_MS).toISOString(), active: false });
    getByIdMock.mockResolvedValue(domainResult("pending"));

    await runBrandedEmailSubdomainPoll();

    const sc = await readSc();
    expect(sc.brandedEmailSubdomainId).toBe(FIXTURE_DOMAIN_ID);
    expect(deleteResendMock).not.toHaveBeenCalled();
  });

  it("an unverified subdomain past the threshold is retired (config cleared + resources torn down)", async () => {
    await setConfig({
      domainId: FIXTURE_DOMAIN_ID,
      provisionedAt: new Date(Date.now() - 100 * HOUR_MS).toISOString(),
      active: false,
      dnsRecordIds: ["cf_rec_a", "cf_rec_b"],
    });
    getByIdMock.mockResolvedValue(domainResult("pending"));

    await runBrandedEmailSubdomainPoll();

    const sc = await readSc();
    expect(sc.brandedEmailSubdomainId).toBeUndefined();
    expect(sc.brandedEmailSubdomain).toBeUndefined();
    expect(sc.brandedEmailSubdomainDnsRecordIds).toBeUndefined();
    expect(sc.brandedSubdomainActive).toBeUndefined();
    expect(deleteResendMock).toHaveBeenCalledWith(FIXTURE_DOMAIN_ID);
    expect(deleteDnsMock).toHaveBeenCalledTimes(2);
  });

  it("a missing provisionedAt is backfilled and the subdomain survives the same scan", async () => {
    await setConfig({ domainId: FIXTURE_DOMAIN_ID, active: false }); // no provisionedAt
    getByIdMock.mockResolvedValue(domainResult("pending"));

    await runBrandedEmailSubdomainPoll();

    const sc = await readSc();
    expect(sc.brandedEmailSubdomainId).toBe(FIXTURE_DOMAIN_ID); // not retired
    expect(typeof sc.brandedEmailSubdomainProvisionedAt).toBe("string");
    expect(deleteResendMock).not.toHaveBeenCalled();
  });

  it("a Resend outage never retires (fail-closed on unconfirmed status)", async () => {
    await setConfig({ domainId: FIXTURE_DOMAIN_ID, provisionedAt: new Date(Date.now() - 100 * HOUR_MS).toISOString(), active: false });
    getByIdMock.mockResolvedValue({ available: false, error: "resend down" });

    await runBrandedEmailSubdomainPoll();

    const sc = await readSc();
    expect(sc.brandedEmailSubdomainId).toBe(FIXTURE_DOMAIN_ID);
    expect(deleteResendMock).not.toHaveBeenCalled();
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("shouldRetireBrandedSubdomain — staleness math", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  it("retires unverified past threshold", () => {
    expect(shouldRetireBrandedSubdomain({
      verified: false,
      provisionedAt: new Date(now.getTime() - 100 * HOUR_MS),
      now,
    })).toBe(true);
  });
  it("does not retire verified, ever", () => {
    expect(shouldRetireBrandedSubdomain({
      verified: true,
      provisionedAt: new Date(now.getTime() - 100 * HOUR_MS),
      now,
    })).toBe(false);
  });
  it("does not retire within threshold", () => {
    expect(shouldRetireBrandedSubdomain({
      verified: false,
      provisionedAt: new Date(now.getTime() - 1 * HOUR_MS),
      now,
    })).toBe(false);
  });
  it("does not retire with no provisionedAt", () => {
    expect(shouldRetireBrandedSubdomain({ verified: false, provisionedAt: null, now })).toBe(false);
  });
});
