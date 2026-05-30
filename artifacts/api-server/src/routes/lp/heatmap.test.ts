import { describe, expect, it, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import type { Plan } from "@workspace/plan-config";
import { inject } from "../../test-utils/injectRequest";

// Heatmap ingestion is public (no authUser). We mock the two DB reads in
// heatmapUsage (tenant resolution + session count) and the tenant->plan
// lookup. @workspace/db is mocked so the under-cap path's insert is a no-op
// and getPlanConfig's own pool read fails -> canonical fallback (free cap =
// 1000 distinct sessions / month).
const planByTenant = new Map<number, Plan>();
let resolvedTenantId: number | null = 1;
let sessionCount = 0;
const sessionByTenant = new Map<number, number>();

// Captures the rows passed to db.insert(...).values(...) so tests can assert
// exactly which events were persisted (e.g. that a blocked tenant's events
// were dropped from a mixed-page batch).
let insertedRows: Array<{ pageId: number }> = [];

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
  resolveTenantIdForPage: vi.fn(async (pageId: number) =>
    pageToTenant.size > 0 ? (pageToTenant.get(pageId) ?? null) : resolvedTenantId,
  ),
  countTenantHeatmapSessionsThisMonth: vi.fn(async (tenantId: number) =>
    sessionByTenant.size > 0 ? (sessionByTenant.get(tenantId) ?? 0) : sessionCount,
  ),
}));

vi.mock("@workspace/db", () => ({
  pool: { query: vi.fn(async () => { throw new Error("no db in test"); }) },
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(async (rows: Array<{ pageId: number }>) => {
        insertedRows = rows;
      }),
    })),
  },
  lpHeatmapEventsTable: {},
}));

import heatmapRouter from "./heatmap";

const FREE_TENANT = 1;
const ENTERPRISE_TENANT = 2;

// Page -> tenant map for the mixed-batch test. When set, the resolve mock
// reads from here; otherwise it returns the single `resolvedTenantId`.
const pageToTenant = new Map<number, number | null>();

function buildHarness(): Express {
  const app = express();
  app.use(express.json());
  app.use(heatmapRouter);
  return app;
}

let app: Express;
beforeEach(() => {
  planByTenant.clear();
  planByTenant.set(FREE_TENANT, "free");
  planByTenant.set(ENTERPRISE_TENANT, "enterprise");
  resolvedTenantId = FREE_TENANT;
  sessionCount = 0;
  pageToTenant.clear();
  sessionByTenant.clear();
  insertedRows = [];
  app = buildHarness();
});

async function ingest(pageId = 5) {
  const r = await inject(app, {
    method: "POST",
    url: "/lp/heatmap",
    body: { events: [{ pageId, sessionId: "sess-1", eventType: "click", xPct: 10, yPct: 20 }] },
  });
  return { status: r.status, json: () => r.json };
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

  it("drops only the over-cap tenant's events in a mixed-page batch (no bypass)", async () => {
    // Page 5 -> tenant 1 (free, UNDER cap); page 9 -> tenant 3 (free, OVER cap).
    // A malicious batch mixing both must not smuggle tenant 3's events through
    // tenant 1's under-cap page.
    const OVER_TENANT = 3;
    planByTenant.set(OVER_TENANT, "free");
    pageToTenant.set(5, FREE_TENANT);
    pageToTenant.set(9, OVER_TENANT);
    sessionByTenant.set(FREE_TENANT, 10);
    sessionByTenant.set(OVER_TENANT, 1000);

    const res = await inject(app, {
      method: "POST",
      url: "/lp/heatmap",
      body: {
        events: [
          { pageId: 5, sessionId: "ok-1", eventType: "click" },
          { pageId: 9, sessionId: "blocked-1", eventType: "click" },
          { pageId: 9, sessionId: "blocked-2", eventType: "click" },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ success: true, count: 1 });
    // Only tenant 1's page-5 event was persisted; tenant 3's were dropped.
    expect(insertedRows.map((r) => r.pageId)).toEqual([5]);
  });

  it("returns 200 count 0 (not 402) for a mixed batch where every tenant is over cap", async () => {
    // Two distinct over-cap tenants — not the normal single-tenant collector
    // case, so we silently drop everything rather than emitting a 402.
    const OVER_A = 3;
    const OVER_B = 4;
    planByTenant.set(OVER_A, "free");
    planByTenant.set(OVER_B, "free");
    pageToTenant.set(7, OVER_A);
    pageToTenant.set(8, OVER_B);
    sessionByTenant.set(OVER_A, 1000);
    sessionByTenant.set(OVER_B, 1000);

    const res = await inject(app, {
      method: "POST",
      url: "/lp/heatmap",
      body: {
        events: [
          { pageId: 7, sessionId: "a-1", eventType: "click" },
          { pageId: 8, sessionId: "b-1", eventType: "click" },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ success: true, count: 0 });
    expect(insertedRows).toEqual([]);
  });
});
