/**
 * Regression coverage for the Stripe-driven downgrade-to-Free paths.
 *
 * The bug this guards against: a tenant that is dropped to the `free` floor by
 * Stripe (subscription cancel / unpaid, or a dunning final-attempt exhaustion)
 * while a 14-day Growth TRIAL window is still open would keep resolving to
 * Growth — `effectivePlan()` lifts the stored Free floor back to the trial
 * tier — so the Sales Console and every other gated feature stayed reachable
 * despite the downgrade.
 *
 * The fix: every `plan = 'free'` write closes any still-open trial window
 * (the shared `CLOSE_TRIAL_ON_FREE_SQL` fragment). This file proves:
 *   1. the leak precondition is real (open trial lifts free → growth), and
 *   2. applying the SAME fragment the webhook splices into its downgrade SQL
 *      resolves the tenant back to `free` with all gated flags false, and
 *   3. trial EXPIRY alone (no write) auto-resolves to `free`.
 *
 * Deterministic: no Stripe credentials required (the faithful end-to-end test
 * that drives the signed webhook lives in the Stripe-gated suite below). Runs
 * in-process against the REAL Postgres pool, seeding + tearing down its own
 * tenant rows.
 */
import { describe, it, expect, afterAll } from "vitest";
import { pool } from "@workspace/db";
import {
  getTenantPlan,
  getTenantPlanFeatures,
  CLOSE_TRIAL_ON_FREE_SQL,
} from "../lib/planFeatures";

const createdTenantIds: number[] = [];

async function seedTenant(opts: {
  plan?: string;
  // trial_expires_at = now() + offset; positive = open window, negative =
  // expired, null = no trial.
  trialOffsetMs?: number | null;
}): Promise<number> {
  const slug = `it-wh-downgrade-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const trialExpr =
    opts.trialOffsetMs == null
      ? "NULL"
      : `now() + interval '${Math.round(opts.trialOffsetMs / 1000)} seconds'`;
  const trialStart = opts.trialOffsetMs == null ? "NULL" : "now() - interval '7 days'";
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants
       (name, slug, status, plan, trial_started_at, trial_expires_at, has_trialed_before)
     VALUES ('IT WH Downgrade Tenant', $1, 'active', $2, ${trialStart}, ${trialExpr}, false)
     RETURNING id`,
    [slug, opts.plan ?? "free"],
  );
  const id = r.rows[0].id;
  createdTenantIds.push(id);
  return id;
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

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Stripe downgrade-to-free closes the trial window (CLOSE_TRIAL_ON_FREE_SQL)", () => {
  it("leak precondition: an open trial lifts a stored free floor to growth", async () => {
    const tenantId = await seedTenant({ plan: "free", trialOffsetMs: 7 * 86_400_000 });
    // Before any downgrade write the open window lifts the effective plan, so
    // the Sales Console gate would (wrongly, if we stopped here) be open.
    expect(await getTenantPlan(tenantId)).toBe("growth");
    const { features } = await getTenantPlanFeatures(tenantId);
    expect(features.salesConsole).toBe(true);
  });

  it("downgrade SQL with an open trial → resolves to free, all gated flags false", async () => {
    const tenantId = await seedTenant({ plan: "free", trialOffsetMs: 7 * 86_400_000 });

    // Exercise the EXACT fragment the cancel/unpaid + dunning webhook paths
    // splice into their `plan = 'free'` UPDATE.
    await pool.query(
      `UPDATE tenants
          SET plan = 'free',
              ${CLOSE_TRIAL_ON_FREE_SQL.trim()},
              updated_at = now()
        WHERE id = $1`,
      [tenantId],
    );

    const row = await readTenant(tenantId);
    expect(row.plan).toBe("free");
    // Open window closed to <= now; consumed trial stamped.
    expect(row.trial_expires_at).not.toBeNull();
    expect(new Date(row.trial_expires_at as Date).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(row.has_trialed_before).toBe(true);

    // The live accessors must now report free — no stale lift to growth.
    expect(await getTenantPlan(tenantId)).toBe("free");
    const { plan, features } = await getTenantPlanFeatures(tenantId);
    expect(plan).toBe("free");
    expect(features.salesConsole).toBe(false);
    expect(features.customDomain).toBe(false);
    expect(features.aiImageGen).toBe(false);
  });

  it("trial EXPIRY alone (no write) auto-resolves a stored free floor to free", async () => {
    const tenantId = await seedTenant({ plan: "free", trialOffsetMs: -86_400_000 });
    // Past window → effectivePlan keeps the stored floor. No downgrade write
    // needed; the clock already dropped them.
    expect(await getTenantPlan(tenantId)).toBe("free");
    const { features } = await getTenantPlanFeatures(tenantId);
    expect(features.salesConsole).toBe(false);
  });

  it("downgrade SQL leaves a plain free tenant (no trial) untouched — never burns an unused trial", async () => {
    const tenantId = await seedTenant({ plan: "free", trialOffsetMs: null });

    await pool.query(
      `UPDATE tenants
          SET plan = 'free',
              ${CLOSE_TRIAL_ON_FREE_SQL.trim()},
              updated_at = now()
        WHERE id = $1`,
      [tenantId],
    );

    const row = await readTenant(tenantId);
    expect(row.plan).toBe("free");
    expect(row.trial_expires_at).toBeNull();
    expect(row.has_trialed_before).toBe(false);
  });
});
