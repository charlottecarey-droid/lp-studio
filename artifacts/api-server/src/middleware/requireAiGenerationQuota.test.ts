import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Plan } from "@workspace/plan-config";
import type { AuthUser } from "./requireAuth";

// Drive the per-tenant plan and the monthly AI-generation count via mocks.
// getPlanConfig is left REAL — with no DB it falls back to the canonical
// defaults (free cap = 30), which keeps these assertions deterministic.
const planByTenant = new Map<number, Plan>();
let aiCount = 0;

vi.mock("../lib/planFeatures", async () => {
  const actual = await vi.importActual<typeof import("../lib/planFeatures")>("../lib/planFeatures");
  return {
    ...actual,
    getTenantPlan: vi.fn(async (tenantId: number | null | undefined) =>
      tenantId == null ? "free" : (planByTenant.get(tenantId) ?? "free"),
    ),
  };
});

vi.mock("../lib/aiUsage", () => ({
  countTenantAiGenerationsThisMonth: vi.fn(async () => aiCount),
}));

import { requireAiGenerationQuota } from "./requireAiGenerationQuota";

const FREE_TENANT = 2001;
const GROWTH_TENANT = 2002;

function authUser(overrides: Partial<AuthUser>): string {
  const u: AuthUser = {
    userId: 1,
    email: "t@example.com",
    name: "T",
    avatarUrl: null,
    tenantId: FREE_TENANT,
    role: "admin",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...overrides,
  };
  return JSON.stringify(u);
}

function buildHarness(): Express {
  const app = express();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.header("x-test-auth-user");
    if (raw) req.authUser = JSON.parse(raw) as AuthUser;
    next();
  });
  app.post("/lp/generate-page", requireAiGenerationQuota(), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

interface RunningServer { server: Server; baseUrl: string; }
async function listen(app: Express): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}
async function close(s: RunningServer): Promise<void> {
  return new Promise((resolve, reject) => s.server.close((err) => (err ? reject(err) : resolve())));
}

let running: RunningServer;
beforeEach(async () => {
  planByTenant.clear();
  planByTenant.set(FREE_TENANT, "free");
  planByTenant.set(GROWTH_TENANT, "growth");
  aiCount = 0;
  running = await listen(buildHarness());
});
afterAll(async () => {
  if (running) await close(running);
});

async function post(headers: Record<string, string> = {}) {
  return fetch(`${running.baseUrl}/lp/generate-page`, { method: "POST", headers });
}

describe("requireAiGenerationQuota", () => {
  it("returns a structured 402 for a free tenant at the monthly cap (30)", async () => {
    aiCount = 30;
    const res = await post({ "x-test-auth-user": authUser({ tenantId: FREE_TENANT }) });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({
      error: "plan_upgrade_required",
      gate: "aiGenerationsPerMonth",
      currentUsage: 30,
      cap: 30,
      currentPlan: "free",
      minimumPlanWithFeature: "starter",
      upgradeUrl: "/settings/billing",
    });
  });

  it("allows a free tenant under the cap", async () => {
    aiCount = 29;
    const res = await post({ "x-test-auth-user": authUser({ tenantId: FREE_TENANT }) });
    expect(res.status).toBe(200);
  });

  it("never gates a growth tenant (unlimited cap)", async () => {
    aiCount = 999_999;
    const res = await post({ "x-test-auth-user": authUser({ tenantId: GROWTH_TENANT }) });
    expect(res.status).toBe(200);
  });

  it("bypasses the gate for a superadmin even on a free tenant at cap", async () => {
    aiCount = 30;
    const res = await post({
      "x-test-auth-user": authUser({ tenantId: FREE_TENANT, appUserRole: "superadmin" }),
    });
    expect(res.status).toBe(200);
  });
});
