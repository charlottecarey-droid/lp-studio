/**
 * Integration test for the self-serve "downgrade to Free / end trial" endpoint
 * (POST /api/billing/downgrade-to-free).
 *
 * The endpoint is bounded: it only ever writes the canonical `free` floor, ends
 * an in-progress trial window, and stamps `has_trialed_before` so the consumed
 * trial can't restart. It refuses any state where a direct plan write would be
 * wrong — a live Stripe subscription (must cancel via the portal) and the
 * protected Dandy enterprise workspaces.
 *
 * Exercised in-process (no TCP socket) via inject(), against the REAL Postgres
 * pool so requireAuth runs its real session lookup. Each case seeds + tears
 * down its own tenant + admin session row.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";
import { getTenantPlan, getTenantPlanFeatures } from "../lib/planFeatures";
import billingRouter from "./billing";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999500000 + Math.floor(Math.random() * 100000),
    email: "billing-downgrade-it@example.com",
    name: "IT Billing Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-downgrade-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(opts: {
  slug?: string;
  plan?: string;
  trialOffsetMs?: number | null; // trial_expires_at = now() + offset; null = no trial
  subId?: string | null;
  subStatus?: string | null;
}): Promise<{ tenantId: number; sid: string }> {
  const slug = opts.slug ?? `it-downgrade-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const trialExpr =
    opts.trialOffsetMs == null
      ? "NULL"
      : `now() + interval '${Math.round(opts.trialOffsetMs / 1000)} seconds'`;
  const trialStart = opts.trialOffsetMs == null ? "NULL" : "now() - interval '7 days'";
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants
       (name, slug, status, plan, trial_started_at, trial_expires_at, has_trialed_before,
        stripe_subscription_id, stripe_subscription_status)
     VALUES ('IT Downgrade Tenant', $1, 'active', $2, ${trialStart}, ${trialExpr}, false, $3, $4)
     RETURNING id`,
    [slug, opts.plan ?? "free", opts.subId ?? null, opts.subStatus ?? null],
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

function downgrade(sid: string) {
  return inject(app, {
    method: "POST",
    url: "/billing/downgrade-to-free",
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
  });
}

async function readTenant(tenantId: number) {
  const r = await pool.query<{
    plan: string;
    has_trialed_before: boolean;
    trial_expires_at: Date | null;
  }>(
    `SELECT plan, has_trialed_before, trial_expires_at FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return r.rows[0];
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(billingRouter);
});

afterAll(async () => {
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("POST /billing/downgrade-to-free", () => {
  it("401s without a session", async () => {
    const res = await inject(app, { method: "POST", url: "/billing/downgrade-to-free" });
    expect(res.status).toBe(401);
  });

  it("ends an active trial early: floors plan, closes the window, marks consumed", async () => {
    // Active trial (expires in the future) over the free floor — the effective
    // plan is currently Growth.
    const { tenantId, sid } = await seedTenant({ trialOffsetMs: 7 * 86_400_000 });

    const res = await downgrade(sid);
    expect(res.status).toBe(200);
    expect((res.json as { plan?: string }).plan).toBe("free");

    const row = await readTenant(tenantId);
    expect(row.plan).toBe("free");
    expect(row.has_trialed_before).toBe(true);
    // Window was open → closed to <= now.
    expect(row.trial_expires_at).not.toBeNull();
    expect(new Date(row.trial_expires_at as Date).getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    // The live entitlement accessors must now resolve to FREE — closing the
    // trial window is what stops `effectivePlan` from lifting the tenant back
    // to the Growth trial tier. Without it the tenant would keep reaching the
    // Sales Console despite the downgrade.
    expect(await getTenantPlan(tenantId)).toBe("free");
    const { plan, features } = await getTenantPlanFeatures(tenantId);
    expect(plan).toBe("free");
    expect(features.salesConsole).toBe(false);
    expect(features.customDomain).toBe(false);
    expect(features.aiImageGen).toBe(false);
  });

  it("is idempotent / a no-op for a plain Free tenant with no trial", async () => {
    const { tenantId, sid } = await seedTenant({ plan: "free", trialOffsetMs: null });

    const res = await downgrade(sid);
    expect(res.status).toBe(200);

    const row = await readTenant(tenantId);
    expect(row.plan).toBe("free");
    // No trial ever existed → don't burn the never-used trial.
    expect(row.has_trialed_before).toBe(false);
    expect(row.trial_expires_at).toBeNull();
  });

  it("drops a stored paid plan with no live subscription to Free", async () => {
    const { tenantId, sid } = await seedTenant({
      plan: "growth",
      trialOffsetMs: null,
      subId: "sub_canceled_it",
      subStatus: "canceled",
    });

    const res = await downgrade(sid);
    expect(res.status).toBe(200);

    const row = await readTenant(tenantId);
    expect(row.plan).toBe("free");
  });

  it("refuses (409) when a live subscription exists — must cancel via portal", async () => {
    const { tenantId, sid } = await seedTenant({
      plan: "growth",
      trialOffsetMs: null,
      subId: "sub_active_it",
      subStatus: "active",
    });

    const res = await downgrade(sid);
    expect(res.status).toBe(409);
    expect((res.json as { code?: string }).code).toBe("use_portal_to_cancel");

    // Plan untouched — the direct write was correctly refused.
    const row = await readTenant(tenantId);
    expect(row.plan).toBe("growth");
  });

  it("refuses (403) for the protected Dandy enterprise workspace", async () => {
    // Reuse the real protected tenant if it's already seeded (its slug is
    // unique), otherwise create one. Either way the endpoint refuses BEFORE any
    // write, so pointing a session at it is non-destructive.
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM tenants WHERE slug IN ('dandy', 'dandy-smb') ORDER BY id LIMIT 1`,
    );
    let sid: string;
    if (existing.rows.length) {
      const s = adminSession(existing.rows[0].id);
      await pool.query(
        `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
        [s.sid, s.sess],
      );
      createdSids.push(s.sid);
      sid = s.sid;
    } else {
      sid = (await seedTenant({ slug: "dandy", plan: "free", trialOffsetMs: null })).sid;
    }

    const res = await downgrade(sid);
    expect(res.status).toBe(403);
    expect((res.json as { code?: string }).code).toBe("protected_enterprise");
  });
});
