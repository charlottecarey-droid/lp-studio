import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB pool so we can drive `getTenantPlan`'s SELECT result and
// assert the slug-override / fallback logic without a real database.
const queryMock = vi.fn();
vi.mock("@workspace/db", () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

import {
  normalizePlan,
  isProtectedEnterpriseSlug,
  getTenantPlan,
  PROTECTED_ENTERPRISE_SLUGS,
  PLAN_FEATURES,
  PLANS,
  type Plan,
} from "./planFeatures";

describe("normalizePlan — 5-tier reconciliation", () => {
  it("maps each canonical tier to itself", () => {
    for (const p of ["free", "starter", "growth", "scale", "enterprise"] as Plan[]) {
      expect(normalizePlan(p)).toBe(p);
    }
  });

  it("maps legacy strings to the agreed canonical tier", () => {
    expect(normalizePlan("trial")).toBe("growth");
    expect(normalizePlan("business")).toBe("growth");
    expect(normalizePlan("pro")).toBe("enterprise");
  });

  it("is case-insensitive", () => {
    expect(normalizePlan("Enterprise")).toBe("enterprise");
    expect(normalizePlan("FREE")).toBe("free");
  });

  it("defaults unknown / null / empty to free (least access)", () => {
    expect(normalizePlan(undefined)).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan("")).toBe("free");
    expect(normalizePlan("nonsense")).toBe("free");
  });

  it("treats the string `starter` as the PAID tier (legacy free-floor rows are migrated to `free`)", () => {
    // Post-migration invariant: starter resolves to the paid tier, NOT free.
    expect(normalizePlan("starter")).toBe("starter");
    expect(PLAN_FEATURES.starter.limits.pages).toBe(10);
    expect(PLAN_FEATURES.free.limits.pages).toBe(1);
  });
});

describe("Dandy safeguard — protected enterprise slugs", () => {
  it("recognizes both Dandy workspaces by slug, case-insensitively", () => {
    expect(isProtectedEnterpriseSlug("dandy")).toBe(true);
    expect(isProtectedEnterpriseSlug("dandy-smb")).toBe(true);
    expect(isProtectedEnterpriseSlug("DANDY")).toBe(true);
    expect(isProtectedEnterpriseSlug("Dandy-SMB")).toBe(true);
  });

  it("does not protect other slugs", () => {
    expect(isProtectedEnterpriseSlug("acme")).toBe(false);
    expect(isProtectedEnterpriseSlug("dandy-other")).toBe(false);
    expect(isProtectedEnterpriseSlug(null)).toBe(false);
    expect(isProtectedEnterpriseSlug(undefined)).toBe(false);
    expect(isProtectedEnterpriseSlug("")).toBe(false);
  });

  it("the protected list contains exactly the two Dandy workspaces", () => {
    expect([...PROTECTED_ENTERPRISE_SLUGS].sort()).toEqual(["dandy", "dandy-smb"]);
  });

  it("enterprise tier unlocks every premium capability (what Dandy must always get)", () => {
    const ent = PLAN_FEATURES.enterprise;
    expect(ent.salesConsole).toBe(true);
    expect(ent.aiImageGen).toBe(true);
    expect(ent.customDomain).toBe(true);
    expect(ent.limits.pages).toBeNull();
    expect(ent.limits.forms).toBeNull();
    expect(ent.limits.userSeats).toBeNull();
  });
});

describe("getTenantPlan — DB lookup + Dandy override", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns free for a null/missing tenantId without hitting the DB", async () => {
    expect(await getTenantPlan(null)).toBe("free");
    expect(await getTenantPlan(undefined)).toBe("free");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("normalizes the stored plan for an ordinary tenant", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ plan: "growth", slug: "acme" }] });
    expect(await getTenantPlan(42)).toBe("growth");
  });

  it("forces enterprise for the `dandy` workspace regardless of stored plan", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ plan: "free", slug: "dandy" }] });
    expect(await getTenantPlan(1)).toBe("enterprise");
  });

  it("forces enterprise for the `dandy-smb` workspace even when stored as starter", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ plan: "starter", slug: "dandy-smb" }] });
    expect(await getTenantPlan(5)).toBe("enterprise");
  });

  it("falls back to free when the tenant row is missing", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    expect(await getTenantPlan(999)).toBe("free");
  });
});

describe("PLAN_FEATURES / PLANS shape", () => {
  it("PLANS lists all five tiers low → high", () => {
    expect(PLANS).toEqual(["free", "starter", "growth", "scale", "enterprise"]);
  });

  it("every tier in PLANS has a PLAN_FEATURES entry", () => {
    for (const p of PLANS) {
      expect(PLAN_FEATURES[p]).toBeDefined();
    }
  });
});
