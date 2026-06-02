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
  effectivePlan,
  computeTrialState,
  TRIAL_TIER,
  PROTECTED_ENTERPRISE_SLUGS,
  PLAN_FEATURES,
  PLANS,
  type Plan,
} from "./planFeatures";

const HOUR = 3_600_000;
const DAY = 86_400_000;

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
    expect(ent.brandedEmailSubdomain).toBe(true);
    expect(ent.customEmailDomain).toBe(true);
    expect(ent.limits.pages).toBeNull();
    expect(ent.limits.forms).toBeNull();
    expect(ent.limits.userSeats).toBeNull();
  });
});

describe("email sending tier flags per plan", () => {
  it("brandedEmailSubdomain (Tier 2) is on for growth/scale/enterprise, off for free/starter", () => {
    expect(PLAN_FEATURES.free.brandedEmailSubdomain).toBe(false);
    expect(PLAN_FEATURES.starter.brandedEmailSubdomain).toBe(false);
    expect(PLAN_FEATURES.growth.brandedEmailSubdomain).toBe(true);
    expect(PLAN_FEATURES.scale.brandedEmailSubdomain).toBe(true);
    expect(PLAN_FEATURES.enterprise.brandedEmailSubdomain).toBe(true);
  });

  it("customEmailDomain (Tier 3) is enterprise-only", () => {
    expect(PLAN_FEATURES.free.customEmailDomain).toBe(false);
    expect(PLAN_FEATURES.starter.customEmailDomain).toBe(false);
    expect(PLAN_FEATURES.growth.customEmailDomain).toBe(false);
    expect(PLAN_FEATURES.scale.customEmailDomain).toBe(false);
    expect(PLAN_FEATURES.enterprise.customEmailDomain).toBe(true);
  });

  it("every tier exposes both email flags as booleans (Tier 1 shared default is always available regardless)", () => {
    for (const p of PLANS) {
      expect(typeof PLAN_FEATURES[p].brandedEmailSubdomain).toBe("boolean");
      expect(typeof PLAN_FEATURES[p].customEmailDomain).toBe("boolean");
    }
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

describe("effectivePlan — trial window resolution", () => {
  it("raises stored plan to the trial tier while the window is open", () => {
    const future = new Date(Date.now() + 7 * DAY);
    expect(effectivePlan({ storedPlan: "free", trialExpiresAt: future })).toBe(TRIAL_TIER);
  });

  it("never downgrades a higher stored plan during a trial", () => {
    const future = new Date(Date.now() + 7 * DAY);
    expect(effectivePlan({ storedPlan: "scale", trialExpiresAt: future })).toBe("scale");
    expect(effectivePlan({ storedPlan: "enterprise", trialExpiresAt: future })).toBe("enterprise");
  });

  it("falls back to the stored plan after expiry", () => {
    const past = new Date(Date.now() - HOUR);
    expect(effectivePlan({ storedPlan: "free", trialExpiresAt: past })).toBe("free");
  });

  it("returns the stored plan when there is no trial window", () => {
    expect(effectivePlan({ storedPlan: "starter", trialExpiresAt: null })).toBe("starter");
  });
});

describe("computeTrialState", () => {
  it("reports active with whole days remaining (ceil, min 1)", () => {
    const s = computeTrialState({
      trialStartedAt: new Date(Date.now() - DAY),
      trialExpiresAt: new Date(Date.now() + 3 * DAY + HOUR),
    });
    expect(s.active).toBe(true);
    expect(s.expired).toBe(false);
    expect(s.daysRemaining).toBe(4);
  });

  it("reports expired with zero days remaining", () => {
    const s = computeTrialState({
      trialStartedAt: new Date(Date.now() - 20 * DAY),
      trialExpiresAt: new Date(Date.now() - DAY),
    });
    expect(s.active).toBe(false);
    expect(s.expired).toBe(true);
    expect(s.daysRemaining).toBe(0);
  });

  it("is inert when there is no trial window", () => {
    const s = computeTrialState({ trialStartedAt: null, trialExpiresAt: null });
    expect(s).toMatchObject({ active: false, expired: false, daysRemaining: 0, expiresAt: null });
  });
});

describe("getTenantPlan — trial-aware resolution", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("grants the trial tier while the window is open even on a Free floor", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        plan: "free",
        slug: "acme",
        trial_expires_at: new Date(Date.now() + 5 * DAY),
        has_trialed_before: false,
      }],
    });
    expect(await getTenantPlan(42)).toBe(TRIAL_TIER);
    // Active trial must NOT trigger the consume-write.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("drops to the stored plan after expiry AND lazily marks the trial consumed", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{
          plan: "free",
          slug: "acme",
          trial_expires_at: new Date(Date.now() - HOUR),
          has_trialed_before: false,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }); // the UPDATE
    expect(await getTenantPlan(42)).toBe("free");
    // SELECT + the lazy has_trialed_before UPDATE.
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toMatch(/UPDATE tenants SET has_trialed_before/);
  });

  it("does not re-write has_trialed_before once already consumed", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        plan: "free",
        slug: "acme",
        trial_expires_at: new Date(Date.now() - 30 * DAY),
        has_trialed_before: true,
      }],
    });
    expect(await getTenantPlan(42)).toBe("free");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("keeps Dandy on enterprise even with an active trial window", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        plan: "free",
        slug: "dandy",
        trial_expires_at: new Date(Date.now() + 5 * DAY),
        has_trialed_before: false,
      }],
    });
    expect(await getTenantPlan(1)).toBe("enterprise");
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
