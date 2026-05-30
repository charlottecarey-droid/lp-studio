/**
 * Integration test for the canonical-plan gate on admin tenant creation.
 *
 * `normalizePlan("trial")` maps to "growth", so a tenant CREATED with a stored
 * plan of "trial" (a legacy alias, not a canonical plan) would silently receive
 * Growth entitlements indefinitely with no trial window — trials are date-driven
 * via the trial_*_at columns, never the stored plan. The superadmin create route
 * (POST /api/admin/tenants) must therefore reject any non-canonical plan input,
 * mirroring the validation the PATCH route already enforces.
 *
 * Exercised in-process (no TCP socket) via inject(), against the REAL Postgres
 * pool so requireSuperadmin runs its real session lookup. The request 400s on
 * the plan gate BEFORE any tenant row is inserted, so there is nothing to clean
 * up beyond the seeded superadmin session.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, type AuthUser } from "../middleware/requireAuth";
import { inject } from "../test-utils/injectRequest";
import adminRouter from "./admin";

const SID = `it-admincreate-${randomUUID()}`;
let app: Express;

function superadminSess(): string {
  const user: AuthUser = {
    userId: 999200001,
    email: "superadmin-it@example.com",
    name: "IT Superadmin",
    avatarUrl: null,
    tenantId: null,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: "superadmin",
  };
  return JSON.stringify(user);
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [SID, superadminSess()],
  );
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
});

afterAll(async () => {
  await cleanup();
});

function createTenant(body: unknown) {
  return inject(app, {
    method: "POST",
    url: "/tenants",
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body,
  });
}

describe("POST /tenants — canonical plan gate", () => {
  it("rejects the legacy 'trial' alias with 400", async () => {
    const res = await createTenant({
      name: "IT Plan Gate Tenant",
      slug: `it-plangate-${Date.now()}`,
      adminEmail: "owner-it@example.com",
      plan: "trial",
    });
    expect(res.status).toBe(400);
    expect(String((res.json as { error?: string })?.error)).toMatch(/plan must be one of/);
  });

  it("rejects an arbitrary non-canonical plan with 400", async () => {
    const res = await createTenant({
      name: "IT Plan Gate Tenant",
      slug: `it-plangate-${Date.now()}`,
      adminEmail: "owner-it@example.com",
      plan: "platinum",
    });
    expect(res.status).toBe(400);
    expect(String((res.json as { error?: string })?.error)).toMatch(/plan must be one of/);
  });

  it("clears the plan gate for a canonical plan (stops at the later slug gate)", async () => {
    // A canonical plan must PASS the plan gate. Slug validation runs immediately
    // after the plan gate and before any tenant row is inserted, so an
    // intentionally invalid slug lets us prove the canonical plan got past the
    // plan check (the error is the slug error, not "plan must be one of") WITHOUT
    // creating a real tenant that would need cleanup.
    const res = await createTenant({
      name: "IT Plan Gate Tenant",
      slug: "a", // too short → validateSlug 400, the gate immediately after the plan gate
      adminEmail: "owner-it@example.com",
      plan: "growth",
    });
    expect(res.status).toBe(400);
    const err = String((res.json as { error?: string })?.error ?? "");
    expect(err).not.toMatch(/plan must be one of/);
    expect(err).toMatch(/slug/i);
  });
});
