import { describe, expect, it } from "vitest";
import { resolveEffectiveMicrositeDomain } from "./AuthContext";

/**
 * "View page" / copy-link must follow the SESSION tenant while a superadmin
 * is switched into another instance from a tenant host — the host-derived
 * domain context would otherwise send every link to the old instance.
 */
describe("resolveEffectiveMicrositeDomain", () => {
  const user = { tenantId: 68450, micrositeDomain: "dandysleep.lpstudio.ai" };

  it("on the open admin host (no host tenant) uses the session's domain", () => {
    expect(resolveEffectiveMicrositeDomain({ tenantId: null, micrositeDomain: null }, user)).toBe("dandysleep.lpstudio.ai");
    expect(resolveEffectiveMicrositeDomain(null, user)).toBe("dandysleep.lpstudio.ai");
  });

  it("on the tenant's own host the host's domain wins (dev / Replit preview can still say it)", () => {
    expect(resolveEffectiveMicrositeDomain({ tenantId: 68450, micrositeDomain: "dandysleep.com" }, user)).toBe("dandysleep.com");
    expect(resolveEffectiveMicrositeDomain({ tenantId: 68450, micrositeDomain: null }, user)).toBe("dandysleep.lpstudio.ai");
  });

  it("switched into another tenant from a tenant host: the session's domain wins, even when null", () => {
    const hostCtx = { tenantId: 1, micrositeDomain: "lp.meetdandy.com" };
    expect(resolveEffectiveMicrositeDomain(hostCtx, user)).toBe("dandysleep.lpstudio.ai");
    // Switched tenant without a microsite domain → null, so links fall back to its tenantHost.
    expect(resolveEffectiveMicrositeDomain(hostCtx, { tenantId: 99, micrositeDomain: null })).toBeNull();
  });

  it("no session (public visitor) keeps the host's domain", () => {
    expect(resolveEffectiveMicrositeDomain({ tenantId: 1, micrositeDomain: "lp.meetdandy.com" }, null)).toBe("lp.meetdandy.com");
  });
});
