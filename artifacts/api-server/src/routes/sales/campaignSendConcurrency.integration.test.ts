/**
 * Integration test for campaign send idempotency + concurrency (Prompt 1, Fix 1).
 *
 * There is no unique (campaign, contact) constraint, so two simultaneous send
 * requests would both pass the per-contact idempotency filter and double-send.
 * The fix serializes sends with a short claim transaction: a transaction-scoped
 * advisory lock, a re-read of status under the lock, a 409 when a FRESH
 * `status='sending'` marker is in flight, and a reclaim when the marker is STALE
 * (crash recovery). Per-contact rows are inserted durably in the loop so a
 * re-send skips already-sent recipients.
 *
 * Asserted:
 *  1. Idempotency — a second send of a fully-sent campaign returns 400
 *     ("all already sent"), and no duplicate Resend dispatch occurs.
 *  2. Concurrency — a campaign already marked `sending` with a FRESH marker
 *     rejects a new send with 409.
 *  3. Crash recovery — a STALE `sending` marker is reclaimed and the send runs.
 *
 * Drives the real route in-process via inject() against the real Postgres pool;
 * seeds + tears down its own rows and stubs Resend dispatch.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

const originalFetch = global.fetch;
const originalResendKey = process.env.RESEND_API_KEY;

let resendCount = 0;

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);

  process.env.RESEND_API_KEY = "re_test_campaign_concurrency";

  global.fetch = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    if (typeof url === "string" && url.includes("api.resend.com/emails")) {
      resendCount += 1;
      return new Response(JSON.stringify({ id: `resend_${randomUUID()}` }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return (originalFetch as any)(input, init);
  }) as any;
});

afterAll(async () => {
  global.fetch = originalFetch;
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;

  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_email_sends WHERE contact_id IN (SELECT id FROM sales_contacts WHERE tenant_id = $1)`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_email_campaigns WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_email_templates WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999761000 + Math.floor(Math.random() * 100000),
    email: "campaign-concurrency-it@example.com",
    name: "IT Campaign Concurrency Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-campconc-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-campconc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Campaign Concurrency Tenant', $1, 'active', 'growth') RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

async function seedAccount(tenantId: number): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, 'IT Concurrency Account', 'active') RETURNING id`,
    [tenantId],
  );
  return r.rows[0].id;
}

async function seedContact(tenantId: number, accountId: number, email: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     VALUES ($1, $2, 'IT', 'Recipient', $3, 'active') RETURNING id`,
    [tenantId, accountId, email],
  );
  return r.rows[0].id;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

async function seedCampaign(sid: string, contactIds: number[]): Promise<number> {
  const tplRes = await authed(sid, "POST", "/sales/templates", {
    name: "[IT] concurrency",
    subject: "Hello {{firstName}}",
    bodyText: "Hi {{firstName}}, this is a test.",
    bodyHtml: "",
    format: "plain",
    category: "general",
  });
  expect(tplRes.status).toBe(201);
  const tpl = tplRes.json as { id: number };

  const campRes = await authed(sid, "POST", "/sales/campaigns", {
    name: "IT concurrency campaign",
    templateId: tpl.id,
    status: "draft",
    metadata: { contactIds },
  });
  expect(campRes.status).toBe(201);
  return (campRes.json as { id: number }).id;
}

describe("Campaign send idempotency + concurrency (Fix 1)", () => {
  it("does not re-send to contacts already sent to (idempotency, second send 400)", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountId = await seedAccount(tenantId);
    const a = await seedContact(tenantId, accountId, `idem-a-${Date.now()}@it.example`);
    const b = await seedContact(tenantId, accountId, `idem-b-${Date.now()}@it.example`);
    const campId = await seedCampaign(sid, [a, b]);

    resendCount = 0;
    const first = await authed(sid, "POST", `/sales/campaigns/${campId}/send`, {});
    expect(first.status).toBe(200);
    expect((first.json as { sent: number; failed: number }).sent).toBe(2);
    expect(resendCount).toBe(2);

    // Second send: every contact already has a 'sent' row → 400, no new dispatch.
    const second = await authed(sid, "POST", `/sales/campaigns/${campId}/send`, {});
    expect(second.status).toBe(400);
    expect(String((second.json as { error: string }).error)).toContain("already been sent");
    expect(resendCount).toBe(2);

    const sends = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sales_email_sends WHERE campaign_id = $1 AND status = 'sent'`,
      [campId],
    );
    expect(Number(sends.rows[0].n)).toBe(2);
  });

  it("rejects a concurrent send with 409 when a FRESH sending marker is in flight", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountId = await seedAccount(tenantId);
    const a = await seedContact(tenantId, accountId, `conc-a-${Date.now()}@it.example`);
    const campId = await seedCampaign(sid, [a]);

    // Simulate another send in flight: status='sending' with a fresh marker.
    await pool.query(
      `UPDATE sales_email_campaigns
         SET status = 'sending',
             metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{sendingStartedAt}', to_jsonb($2::text))
       WHERE id = $1`,
      [campId, new Date().toISOString()],
    );

    resendCount = 0;
    const res = await authed(sid, "POST", `/sales/campaigns/${campId}/send`, {});
    expect(res.status).toBe(409);
    expect(resendCount).toBe(0);
  });

  it("two simultaneous sends never double-dispatch (true concurrency)", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountId = await seedAccount(tenantId);
    const a = await seedContact(tenantId, accountId, `par-a-${Date.now()}@it.example`);
    const b = await seedContact(tenantId, accountId, `par-b-${Date.now()}@it.example`);
    const campId = await seedCampaign(sid, [a, b]);

    resendCount = 0;
    // Fire both requests concurrently — they race for the claim lock.
    const [r1, r2] = await Promise.all([
      authed(sid, "POST", `/sales/campaigns/${campId}/send`, {}),
      authed(sid, "POST", `/sales/campaigns/${campId}/send`, {}),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // Exactly one wins the claim (200); the loser is rejected (409) or — if the
    // winner fully finished first — sees everything already sent (400). Either
    // way the loser must NOT dispatch anything.
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);

    // The decisive invariant: each contact is emailed exactly once, no matter
    // how the two requests interleaved.
    expect(resendCount).toBe(2);
    const sends = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sales_email_sends WHERE campaign_id = $1 AND status = 'sent'`,
      [campId],
    );
    expect(Number(sends.rows[0].n)).toBe(2);
  });

  it("reclaims a STALE sending marker (crash recovery) and completes the send", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountId = await seedAccount(tenantId);
    const a = await seedContact(tenantId, accountId, `stale-a-${Date.now()}@it.example`);
    const campId = await seedCampaign(sid, [a]);

    // A crashed send left a STALE marker (well past the 15-min staleness window).
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await pool.query(
      `UPDATE sales_email_campaigns
         SET status = 'sending',
             metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{sendingStartedAt}', to_jsonb($2::text))
       WHERE id = $1`,
      [campId, stale],
    );

    resendCount = 0;
    const res = await authed(sid, "POST", `/sales/campaigns/${campId}/send`, {});
    expect(res.status).toBe(200);
    expect((res.json as { sent: number }).sent).toBe(1);
    expect(resendCount).toBe(1);

    const status = await pool.query<{ status: string }>(
      `SELECT status FROM sales_email_campaigns WHERE id = $1`,
      [campId],
    );
    expect(status.rows[0].status).toBe("sent");
  });
});
