/**
 * Tests for the tenant notification email shell — specifically that a tenant's
 * own logo renders in the header across the URL shapes brand assets are stored
 * in (Task #612).
 *
 * The gap these pin: an uploaded brand logo is stored as a ROOT-RELATIVE serve
 * path (`/api/storage/...`), but the logo only used to render when `logoUrl` was
 * a fully-qualified `http(s)://` URL, so relative paths silently dropped to a
 * bare brand-name text header. Email clients also require absolute `<img>` srcs,
 * so a relative path must be normalized to an absolute URL first.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildBrandDerivedShell } from "./tenantEmailShell";
import {
  TENANT_TEMPLATE_KEYS,
  TENANT_NOTIFICATION_TEMPLATES,
} from "./tenantNotificationTemplates";

// Pin the asset host so relative paths normalize deterministically regardless of
// the dev/CI environment's REPLIT_DEV_DOMAIN.
const PINNED_HOST = "app.lpstudio.ai";
let prevPublicHost: string | undefined;
beforeAll(() => {
  prevPublicHost = process.env.LP_STUDIO_PUBLIC_HOST;
  process.env.LP_STUDIO_PUBLIC_HOST = PINNED_HOST;
});
afterAll(() => {
  if (prevPublicHost === undefined) delete process.env.LP_STUDIO_PUBLIC_HOST;
  else process.env.LP_STUDIO_PUBLIC_HOST = prevPublicHost;
});

describe("buildBrandDerivedShell — tenant logo header", () => {
  it("renders an <img> for an absolute https logo URL", () => {
    const shell = buildBrandDerivedShell({
      brandName: "Acme Dental",
      logoUrl: "https://cdn.acme.com/logo.png",
    });
    expect(shell.logoHtml).toContain("<img");
    expect(shell.logoHtml).toContain('src="https://cdn.acme.com/logo.png"');
    expect(shell.logoHtml).toContain('alt="Acme Dental"');
    expect(shell.logoHtml).not.toContain("<span");
  });

  it("normalizes a root-relative serve path to an absolute <img> src", () => {
    const shell = buildBrandDerivedShell({
      brandName: "Acme Dental",
      logoUrl: "/api/storage/objects/uploads/abc123.png",
    });
    expect(shell.logoHtml).toContain("<img");
    expect(shell.logoHtml).toContain(
      `src="https://${PINNED_HOST}/api/storage/objects/uploads/abc123.png"`,
    );
    expect(shell.logoHtml).not.toContain("<span");
  });

  it("normalizes a bare relative path to an absolute <img> src", () => {
    const shell = buildBrandDerivedShell({
      brandName: "Acme Dental",
      logoUrl: "uploads/logo.svg",
    });
    expect(shell.logoHtml).toContain("<img");
    expect(shell.logoHtml).toContain(
      `src="https://${PINNED_HOST}/uploads/logo.svg"`,
    );
  });

  it("normalizes a protocol-relative URL to https", () => {
    const shell = buildBrandDerivedShell({
      brandName: "Acme Dental",
      logoUrl: "//cdn.acme.com/logo.png",
    });
    expect(shell.logoHtml).toContain("<img");
    expect(shell.logoHtml).toContain('src="https://cdn.acme.com/logo.png"');
  });

  it("falls back to the brand name as text when the logo is missing", () => {
    const shell = buildBrandDerivedShell({ brandName: "Acme Dental" });
    expect(shell.logoHtml).not.toContain("<img");
    expect(shell.logoHtml).toContain("<span");
    expect(shell.logoHtml).toContain("Acme Dental");
  });

  it("falls back to text for an empty / whitespace-only logo URL", () => {
    const shell = buildBrandDerivedShell({
      brandName: "Acme Dental",
      logoUrl: "   ",
    });
    expect(shell.logoHtml).not.toContain("<img");
    expect(shell.logoHtml).toContain("Acme Dental");
  });

  it("falls back to a neutral label when there is no brand name or logo", () => {
    const shell = buildBrandDerivedShell({});
    expect(shell.logoHtml).not.toContain("<img");
    expect(shell.logoHtml).toContain("Notifications");
  });

  it("HTML-escapes the logo src and alt text", () => {
    const shell = buildBrandDerivedShell({
      brandName: 'Acme "&" Co',
      logoUrl: "https://cdn.acme.com/logo.png?a=1&b=2",
    });
    expect(shell.logoHtml).toContain("a=1&amp;b=2");
    expect(shell.logoHtml).toContain("Acme &quot;&amp;&quot; Co");
    expect(shell.logoHtml).not.toContain("?a=1&b=2");
  });
});

describe("tenant notification templates route through the brand-derived shell", () => {
  it("covers the four tenant notification keys", () => {
    expect([...TENANT_TEMPLATE_KEYS].sort()).toEqual(
      ["comment", "form_followup", "lead_notification", "review_decision"].sort(),
    );
  });

  it("wraps every tenant notification template in the shell (so the logo header applies)", () => {
    for (const key of TENANT_TEMPLATE_KEYS) {
      const tpl = TENANT_NOTIFICATION_TEMPLATES[key];
      expect(tpl, `missing code default for ${key}`).toBeTruthy();
      expect(tpl.wrapInShell, `${key} must wrap in the shell`).toBe(true);
    }
  });
});
