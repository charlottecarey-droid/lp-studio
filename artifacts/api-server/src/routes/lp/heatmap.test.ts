import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import express, { type Express } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Plan } from "@workspace/plan-config";

// Heatmap ingestion is public (no authUser). We mock the two DB reads in
// heatmapUsage (tenant resolution + session count) and the tenant->plan
// lookup. @workspace/db is mocked so the under-cap path's insert is a no-op
// and getPlanConfig's own pool read fails -> canonical fallback (free cap =
// 1000 distinct sessions / month).
const planByTenant = new Map<number, Plan>();
let resolvedTenantId: number | null = 1;
let sessionCount = 0;

vi.mock("../../lib/planFeatures", async () => {
  const actual = await vi.importActual<typeof import("../../lib/planFeatures")>("../../lib/planFeatures");
  return {
    ...actual,
    getTenantPlan: vi.fn(async (tenantId: number | null | undefined) =>
      tenantId == null ? "free" : (planByTenant.get(tenantId) ?? "free"),
    ),
  };
});

vi.mock("../../lib/heatmapUsage", () => ({
  resolveTenantIdForPage: vi.fn(async () => resolvedTenantId),
  countTenantHeatmapSessionsThisMonth: vi.fn(async () => sessionCount),
}));

vi.mock("@workspace/db", () => ({
  pool: { query: vi.fn(async () => { throw new Error("no db in test"); }) },
  db: { insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })) },
  lpHeatmapEventsTable: {},
}));

import heatmapRouter from "./heatmap";

const FREE_TENANT = 1;
const ENTERPRISE_TENANT = 2;

function buildHarness(): Express {
  const app = express();
  app.use(express.json());
  app.use(heatmapRouter);
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
  planByTenant.set(ENTERPRISE_TENANT, "enterprise");
  resolvedTenantId = FREE_TENANT;
  sessionCount = 0;
  running = await listen(buildHarness());
});
afterAll(async () => {
  if (running) await close(running);
});

async function ingest(pageId = 5) {
  return fetch(`${running.baseUrl}/lp/heatmap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [{ pageId, sessionId: "sess-1", eventType: "click", xPct: 10, yPct: 20 }] }),
  });
}

describe("POST /lp/heatmap — session-quota gate", () => {
  it("returns a structured 402 once a free tenant hits the monthly session cap (1000)", async () => {
    sessionCount = 1000;
    const res = await ingest();
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({
      error: "plan_upgrade_required",
      gate: "heatmapSessionsPerMonth",
      currentUsage: 1000,
      cap: 1000,
      currentPlan: "free",
      minimumPlanWithFeature: "starter",
      upgradeUrl: "/settings/billing",
    });
  });

  it("ingests normally when the free tenant is under the cap", async () => {
    sessionCount = 999;
    const res = await ingest();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it("never gates an enterprise tenant (unlimited sessions)", async () => {
    sessionCount = 9_999_999;
    resolvedTenantId = ENTERPRISE_TENANT;
    const res = await ingest();
    expect(res.status).toBe(200);
  });

  it("fails open (ingests) when the page's tenant can't be resolved", async () => {
    resolvedTenantId = null;
    sessionCount = 1000;
    const res = await ingest();
    expect(res.status).toBe(200);
  });
});
