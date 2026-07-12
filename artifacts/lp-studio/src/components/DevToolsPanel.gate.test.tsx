import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Visibility gate for the Dev Tools panel (tenant switcher / role preview).
 * It must render ONLY for PLATFORM superadmins (app_users.role), never for
 * ordinary tenant admins — `user.isAdmin` is the TENANT admin flag, and
 * gating on it (the July 2026 bug) showed the switcher to every customer
 * admin. The backend endpoints were always requireSuperadmin; this pins the
 * UI side. SSR render keeps effects (tenant-list fetch) from running.
 */

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import { DevToolsPanel } from "./DevToolsPanel";

const baseAuth = {
  hasPerm: () => true,
  impersonatedRole: null,
  permOverride: null,
  setRolePreview: () => {},
  clearRolePreview: () => {},
  switchTenant: async () => {},
};

function renderPanel(user: Record<string, unknown> | null): string {
  mockUseAuth.mockReturnValue({ ...baseAuth, user });
  return renderToStaticMarkup(createElement(DevToolsPanel));
}

describe("DevToolsPanel visibility gate", () => {
  it("renders nothing for a TENANT admin without the platform superadmin role", () => {
    expect(renderPanel({ email: "admin@customer.com", isAdmin: true, appUserRole: null })).toBe("");
    expect(renderPanel({ email: "admin@customer.com", isAdmin: true })).toBe("");
    expect(renderPanel({ email: "admin@customer.com", isAdmin: true, appUserRole: "admin" })).toBe("");
  });

  it("renders nothing when logged out", () => {
    expect(renderPanel(null)).toBe("");
  });

  it("renders for a platform superadmin", () => {
    const html = renderPanel({ email: "ops@lpstudio.ai", isAdmin: true, appUserRole: "superadmin" });
    expect(html).toContain("Dev Tools");
  });
});
