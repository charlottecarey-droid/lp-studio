/**
 * Integration test for tenant signup (POST /api/auth/signup).
 *
 * Runs the REAL auth router against the REAL Postgres pool. Requests are
 * injected into the express app IN-PROCESS (no TCP socket): the vitest worker
 * pool in this environment never fires `app.listen`'s callback, so a real
 * port + fetch would hang forever. The injection still exercises the full
 * middleware chain (cookie-parser, body parsing) and the route handler.
 *
 * Asserted contract (task: harden tenants.plan + signup contract):
 *   A successful self-serve signup stores the new tenant with the canonical
 *   `plan='free'` FLOOR (never the legacy 'trial' alias, which would normalize
 *   to Growth indefinitely) and a populated 14-day trial WINDOW
 *   (trial_started_at / trial_expires_at both non-null, expires after start).
 *   The trial tier is granted at read time via effectivePlan() over this
 *   window — the stored plan is only the post-expiry floor.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { inject } from "../test-utils/injectRequest";
import { invalidateTenantHostCache } from "../lib/tenantHosts";
import authRouter, { SESSION_COOKIE } from "./auth";

const RAND = randomBytes(4).toString("hex"); // 8 hex chars, unique per run
const SLUG = `swsignup${RAND}`;
const EMAIL = `sw-signup-${RAND}@example.test`;
const SID = `sw-sid-${RAND}`;

let app: Express;
let userId: number;
let createdTenantId: number | null = null;

beforeAll(async () => {
  // Seed a logged-in user with NO tenant yet (the precondition for signup).
  const userRes = await pool.query<{ id: number }>(
    `INSERT INTO app_users (email, name, role, status) VALUES ($1, 'SW Signup', 'admin', 'active') RETURNING id`,
    [EMAIL],
  );
  userId = userRes.rows[0].id;

  // Seed the server-side session the signup route reads via the lp_sid cookie.
  const sess = JSON.stringify({ userId, email: EMAIL });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '7 days')`,
    [SID, sess],
  );

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

afterAll(async () => {
  if (createdTenantId != null) {
    await pool.query(`DELETE FROM tenant_members WHERE tenant_id = $1`, [createdTenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenant_roles WHERE tenant_id = $1`, [createdTenantId]).catch(() => {});
  }
  await pool.query(`UPDATE app_users SET tenant_id = NULL WHERE id = $1`, [userId]).catch(() => {});
  if (createdTenantId != null) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [createdTenantId]).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  await pool.query(`DELETE FROM app_users WHERE id = $1`, [userId]).catch(() => {});
  invalidateTenantHostCache();
});

describe("POST /api/auth/signup", () => {
  it("stores plan='free' with a populated 14-day trial window", async () => {
    const res = await inject(app, {
      method: "POST",
      url: "/api/auth/signup",
      headers: { cookie: `${SESSION_COOKIE}=${SID}` },
      body: { name: `SW Signup ${RAND}`, slug: SLUG },
    });

    expect(res.status).toBe(200);
    const body = res.json as { ok?: boolean; tenant?: { id: number; slug: string } };
    expect(body.ok).toBe(true);
    expect(body.tenant?.slug).toBe(SLUG);
    createdTenantId = body.tenant?.id ?? null;
    expect(createdTenantId).not.toBeNull();

    const row = await pool.query<{
      plan: string;
      trial_started_at: Date | null;
      trial_expires_at: Date | null;
    }>(
      `SELECT plan, trial_started_at, trial_expires_at FROM tenants WHERE id = $1`,
      [createdTenantId],
    );
    expect(row.rows).toHaveLength(1);
    const tenant = row.rows[0];

    // Canonical FREE floor — never the legacy 'trial' alias.
    expect(tenant.plan).toBe("free");

    // Populated trial WINDOW: both timestamps set, expiry after start.
    expect(tenant.trial_started_at).not.toBeNull();
    expect(tenant.trial_expires_at).not.toBeNull();
    const started = new Date(tenant.trial_started_at as Date).getTime();
    const expires = new Date(tenant.trial_expires_at as Date).getTime();
    expect(expires).toBeGreaterThan(started);
  });
});
