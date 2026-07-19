/**
 * Task #1448 — route-level tests for the /sales/sfdc/microsite-button
 * endpoints. Hermetic (no DB writes, no Salesforce): auth middleware and the
 * SFDC service are mocked; the assertions cover the fail-closed contract —
 * every endpoint 404s without an active connection, input validation rejects
 * bad bodies, and the plan gate blocks enabling without the Sales Console.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import { inject } from "../../test-utils/injectRequest";

const TENANT_ID = 4242;

vi.mock("../../middleware/requireAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware/requireAuth")>();
  return {
    ...actual,
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    getTenantId: () => TENANT_ID,
  };
});

const getActiveConnection = vi.fn();
vi.mock("../../lib/sfdc-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/sfdc-service")>();
  return {
    ...actual,
    sfdcService: new Proxy(actual.sfdcService, {
      get(target, prop, receiver) {
        if (prop === "getActiveConnection") return getActiveConnection;
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

const getTenantPlanFeatures = vi.fn();
vi.mock("../../lib/planFeatures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/planFeatures")>();
  return { ...actual, getTenantPlanFeatures };
});

// Imported AFTER the mocks so the router picks them up.
const { default: sfdcRouter } = await import("./sfdc");

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = express();
  app.use(express.json());
  app.use("/api/sales", sfdcRouter);
});

describe("microsite-button routes — no active connection", () => {
  it.each([
    ["GET", "/api/sales/sfdc/microsite-button", undefined],
    ["PUT", "/api/sales/sfdc/microsite-button", { enabled: true }],
    ["POST", "/api/sales/sfdc/microsite-button/provision", undefined],
    ["POST", "/api/sales/sfdc/microsite-button/sync-choices", undefined],
    ["POST", "/api/sales/sfdc/microsite-button/poll-now", undefined],
  ])("%s %s → 404 when the tenant has no connection", async (method, url, body) => {
    getActiveConnection.mockResolvedValue(null);
    const res = await inject(app, { method, url, body });
    expect(res.status).toBe(404);
    expect((res.json as { error?: string })?.error).toMatch(/no active sfdc connection/i);
  });
});

describe("PUT /sfdc/microsite-button validation + plan gate", () => {
  it("rejects a non-boolean enabled with 400 (before touching Salesforce)", async () => {
    const res = await inject(app, {
      method: "PUT",
      url: "/api/sales/sfdc/microsite-button",
      body: { enabled: "yes" },
    });
    expect(res.status).toBe(400);
    expect(getActiveConnection).not.toHaveBeenCalled();
  });

  it("blocks enabling with 403 when the plan lacks the Sales Console", async () => {
    getActiveConnection.mockResolvedValue({ id: 1, instanceUrl: "https://x.my.salesforce.com" });
    getTenantPlanFeatures.mockResolvedValue({ plan: "starter", features: { salesConsole: false } });
    const res = await inject(app, {
      method: "PUT",
      url: "/api/sales/sfdc/microsite-button",
      body: { enabled: true },
    });
    expect(res.status).toBe(403);
    expect(getTenantPlanFeatures).toHaveBeenCalledWith(TENANT_ID);
  });

  it("blocks poll-now with 403 when the plan lacks the Sales Console", async () => {
    getActiveConnection.mockResolvedValue({ id: 1, instanceUrl: "https://x.my.salesforce.com" });
    getTenantPlanFeatures.mockResolvedValue({ plan: "starter", features: { salesConsole: false } });
    const res = await inject(app, {
      method: "POST",
      url: "/api/sales/sfdc/microsite-button/poll-now",
    });
    expect(res.status).toBe(403);
    expect(getTenantPlanFeatures).toHaveBeenCalledWith(TENANT_ID);
  });

  it("does not consult the plan when disabling", async () => {
    getActiveConnection.mockResolvedValue({ id: 1, instanceUrl: "https://x.my.salesforce.com" });
    // Disabling writes state; the write path hits the DB, so stub it via the
    // module boundary instead: here we only assert the gate ordering.
    getTenantPlanFeatures.mockResolvedValue({ plan: "starter", features: { salesConsole: false } });
    const res = await inject(app, {
      method: "PUT",
      url: "/api/sales/sfdc/microsite-button",
      body: { enabled: false },
    });
    // May 500 in this hermetic harness (no DB row to update) but must NOT be
    // the 403 plan rejection.
    expect(res.status).not.toBe(403);
    expect(getTenantPlanFeatures).not.toHaveBeenCalled();
  });
});
