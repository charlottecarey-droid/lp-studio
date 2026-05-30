import { describe, expect, it, vi, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { inject } from "../test-utils/injectRequest";

// Mock the DB-backed plan lookup BEFORE importing the middleware so the
// middleware picks up the stubbed implementation. The test drives the
// per-tenant plan via this mock.
const planByTenant = new Map<number, "starter" | "growth" | "enterprise">();
vi.mock("../lib/planFeatures", async () => {
  const actual = await vi.importActual<typeof import("../lib/planFeatures")>(
    "../lib/planFeatures",
  );
  return {
    ...actual,
    getTenantPlan: vi.fn(async (tenantId: number | null | undefined) => {
      if (tenantId == null) return "starter";
      return planByTenant.get(tenantId) ?? "starter";
    }),
  };
});

import { requirePlanFeature } from "./requirePlanFeature";
import { LP_PUBLIC } from "../routes/index";
import type { AuthUser } from "./requireAuth";

// Tiny test harness that mirrors the production mount in routes/index.ts:
// the LP_PUBLIC allowlist gates `requireAuth`, then `/sales/*` is wrapped
// in `requirePlanFeature("salesConsole")`, then dummy handlers return 200.
//
// `requireAuth` is stubbed: a test header `x-test-auth-user` carries a
// JSON-encoded AuthUser. With no header, `req.authUser` stays unset so
// we exercise the exact "no authUser → next()" exemption that keeps the
// public /sales/* paths working for anonymous visitors.
function buildHarness(): { app: Express } {
  const app = express();

  const stubRequireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const raw = req.header("x-test-auth-user");
    if (!raw) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      req.authUser = JSON.parse(raw) as AuthUser;
    } catch {
      res.status(400).json({ error: "Bad x-test-auth-user header" });
      return;
    }
    next();
  };

  // Replica of the gate in routes/index.ts:48-59.
  app.use((req, _res, next) => {
    const path = req.path;
    const isProtected = path.startsWith("/lp/") || path.startsWith("/sales/");
    const isPublic = LP_PUBLIC.some(
      (e) => (e.method === "*" || e.method === req.method) && e.pattern.test(path),
    );
    if (!isProtected || isPublic) return next();
    return stubRequireAuth(req, _res, next);
  });

  app.use("/sales", requirePlanFeature("salesConsole"), (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return { app };
}

const STARTER_TENANT = 1001;
const GROWTH_TENANT = 1002;
const ENTERPRISE_TENANT = 1003;

function authUser(overrides: Partial<AuthUser>): string {
  const u: AuthUser = {
    userId: 1,
    email: "test@example.com",
    name: "Test User",
    avatarUrl: null,
    tenantId: STARTER_TENANT,
    role: "admin",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...overrides,
  };
  return JSON.stringify(u);
}

let app: Express;

beforeEach(() => {
  planByTenant.clear();
  planByTenant.set(STARTER_TENANT, "starter");
  planByTenant.set(GROWTH_TENANT, "growth");
  planByTenant.set(ENTERPRISE_TENANT, "enterprise");
  app = buildHarness().app;
});

async function get(path: string, headers: Record<string, string> = {}) {
  const r = await inject(app, { method: "GET", url: path, headers });
  return { status: r.status, json: () => r.json };
}

describe("requirePlanFeature — /sales gate", () => {
  it("returns 402 plan_upgrade_required for a starter tenant", async () => {
    const res = await get("/sales/dashboard", { "x-test-auth-user": authUser({ tenantId: STARTER_TENANT }) });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body).toMatchObject({
      error: "plan_upgrade_required",
      gate: "salesConsole",
      currentUsage: null,
      cap: null,
      currentPlan: "starter",
      minimumPlanWithFeature: "growth",
      upgradeUrl: "/settings/billing",
    });
  });

  it("returns 200 for a growth tenant", async () => {
    const res = await get("/sales/dashboard", { "x-test-auth-user": authUser({ tenantId: GROWTH_TENANT }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 200 for an enterprise tenant", async () => {
    const res = await get("/sales/dashboard", { "x-test-auth-user": authUser({ tenantId: ENTERPRISE_TENANT }) });
    expect(res.status).toBe(200);
  });

  it("returns 200 for a superadmin even when the active tenant is on starter", async () => {
    const res = await get("/sales/dashboard", {
      "x-test-auth-user": authUser({ tenantId: STARTER_TENANT, appUserRole: "superadmin" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 401 for a non-public /sales path with no auth cookie (gate falls through to requireAuth)", async () => {
    const res = await get("/sales/dashboard");
    expect(res.status).toBe(401);
  });
});

describe("requirePlanFeature — public /sales paths", () => {
  // Every public /sales surface that ships email-link traffic from
  // anonymous visitors. These MUST keep working regardless of tenant
  // plan — they are exempted from requireAuth via LP_PUBLIC, and
  // requirePlanFeature short-circuits with next() when req.authUser is
  // unset.
  const cases: { method: string; path: string; label: string }[] = [
    { method: "GET",  path: "/sales/resolve/abc123",  label: "/sales/resolve/:token (email link → microsite)" },
    { method: "GET",  path: "/sales/track/open?c=1",  label: "/sales/track/* (pixel / click tracking)" },
    { method: "GET",  path: "/sales/unsubscribe?c=1", label: "/sales/unsubscribe (one-click)" },
    { method: "POST", path: "/sales/webhooks/resend", label: "/sales/webhooks/resend (Resend delivery events)" },
  ];

  for (const c of cases) {
    it(`lets ${c.method} ${c.label} through with no auth cookie`, async () => {
      const res = await inject(app, { method: c.method, url: c.path });
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ ok: true });
    });
  }

  it("LP_PUBLIC retains an entry for every public /sales surface", () => {
    // Belt-and-braces: if someone removes one of these patterns from
    // LP_PUBLIC without thinking, this test fails before the integration
    // checks above do, with a clearer message.
    for (const sample of [
      "/sales/resolve/abc",
      "/sales/track/open",
      "/sales/unsubscribe",
      "/sales/webhooks/resend",
    ]) {
      const hit = LP_PUBLIC.some((e) => e.pattern.test(sample));
      expect(hit, `expected LP_PUBLIC to match ${sample}`).toBe(true);
    }
  });
});
