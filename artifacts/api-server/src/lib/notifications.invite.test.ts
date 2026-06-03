/**
 * Regression test for the self-serve `brand_invite_emails` opt-in.
 *
 * Seat-activation ("you've been added… click to accept") invite emails are
 * platform-branded (LP Studio) by DEFAULT — an anti-phishing default for an
 * account-access email. A workspace admin may opt IN (per-tenant, default OFF)
 * to render the invite into their OWN branded shell instead.
 *
 * This locks the two branches of `sendInviteEmail`:
 *   1. flag ON  → the email is rendered into the tenant shell, no `{{token}}`
 *      survives the render, and the inbox subject drops the platform name.
 *   2. flag OFF → the tenant shell is never consulted; the unchanged
 *      platform path is used (subject still names LP Studio).
 *
 * Everything is mocked so the test is pure (no DB, no network):
 *   - tenantEmailShell → controls the flag + supplies a marked tenant shell.
 *   - notificationTemplates → null, so the OFF path uses the hardcoded fallback
 *     instead of touching the registry/DB.
 *   - global fetch → captures the Resend POST body instead of sending.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const getTenantInviteBrandingEnabled = vi.fn(async () => false);
const TENANT_SHELL_MARKER = "data-tenant-branded-invite-shell";

const goodShell = () => ({
  shell: {
    shellHtml: `<html><body ${TENANT_SHELL_MARKER} style="background:{{headerBg}}">{{logoHtml}}<main>{{body}}</main><footer>{{footerHtml}}</footer></body></html>`,
    logoHtml: "<img alt=\"Acme\" src=\"https://cdn.example/acme.png\" />",
    headerBg: "#123456",
    footerHtml: "<p>Acme Inc — {{physicalAddress}}</p>",
  },
  source: "tenant" as const,
  physicalAddress: "1 Acme Way, Springfield",
});

const resolveTenantShell = vi.fn(async () => goodShell());

vi.mock("./tenantEmailShell", async (importActual) => {
  const actual = await importActual<typeof import("./tenantEmailShell")>();
  return {
    ...actual,
    getTenantInviteBrandingEnabled,
    resolveTenantShell,
  };
});

vi.mock("./notificationTemplates", async (importActual) => {
  const actual = await importActual<typeof import("./notificationTemplates")>();
  return {
    ...actual,
    // Force the OFF path to use the hardcoded fallback (no DB / registry hit).
    getNotificationTemplate: vi.fn(async () => null),
  };
});

const { sendInviteEmail } = await import("./notifications");

let captured: { html: string; subject: string } = { html: "", subject: "" };
let originalFetch: typeof globalThis.fetch;
let originalKey: string | undefined;

beforeAll(() => {
  originalKey = process.env["RESEND_API_KEY"];
  process.env["RESEND_API_KEY"] = "re_test_dummy_key_not_real";

  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      html?: string;
      subject?: string;
    };
    captured = { html: body.html ?? "", subject: body.subject ?? "" };
    return { ok: true, status: 200, statusText: "OK" } as Response;
  }) as unknown as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = originalKey;
});

beforeEach(() => {
  captured = { html: "", subject: "" };
});

const baseInvite = {
  inviteeEmail: "newseat@acme.example",
  inviterName: "Dana Owner",
  tenantName: "Acme Co",
  roleName: "Editor",
  isNewUser: false,
  signInUrl: "https://acme.lpstudio.ai/login",
  tenantId: 4242,
};

describe("sendInviteEmail — branded opt-in (brand_invite_emails)", () => {
  it("renders into the TENANT shell when the flag is ON, with no stray tokens", async () => {
    getTenantInviteBrandingEnabled.mockResolvedValueOnce(true);

    await sendInviteEmail({ ...baseInvite });

    // Branded path taken: the tenant shell wrapper is present.
    expect(captured.html).toContain(TENANT_SHELL_MARKER);
    // The shell + footer slots resolved — no `{{token}}` survives the render
    // (guards the empty-`{{}}`/unresolved-slot class of bugs).
    expect(captured.html).not.toContain("{{");
    expect(captured.html).not.toContain("}}");
    // Body content baked: headline, role, workspace, CTA url, footer address.
    expect(captured.html).toContain("You now have access to Acme Co");
    expect(captured.html).toContain("Editor");
    expect(captured.html).toContain("https://acme.lpstudio.ai/login");
    expect(captured.html).toContain("1 Acme Way, Springfield");
    // Brand-appropriate inbox line: the platform name is dropped.
    expect(captured.subject).toBe("You now have access to Acme Co");
    expect(captured.subject).not.toContain("LP Studio");
  });

  it("uses the unchanged platform path when the flag is OFF", async () => {
    getTenantInviteBrandingEnabled.mockResolvedValueOnce(false);

    await sendInviteEmail({ ...baseInvite });

    // Tenant shell never used.
    expect(captured.html).not.toContain(TENANT_SHELL_MARKER);
    expect(captured.html).not.toBe("");
    // Still a valid invite, and the platform-branded subject is preserved.
    expect(captured.subject).toBe("You now have access to Acme Co on LP Studio");
  });

  it("falls back to the platform path when the tenant shell renders blank", async () => {
    // Flag ON, but the saved shell_html is empty (operators can clear it). The
    // branded render produces no visible content → must NOT be sent; delivery
    // drops through to the unchanged platform path (hard fallback).
    getTenantInviteBrandingEnabled.mockResolvedValueOnce(true);
    resolveTenantShell.mockResolvedValueOnce({
      shell: { shellHtml: "", logoHtml: "", headerBg: "#000000", footerHtml: "" },
      source: "tenant" as const,
      physicalAddress: "",
    });

    await sendInviteEmail({ ...baseInvite });

    expect(captured.html).not.toContain(TENANT_SHELL_MARKER);
    expect(captured.html).not.toBe("");
    // Platform-branded subject preserved — the broken brand path never won.
    expect(captured.subject).toBe("You now have access to Acme Co on LP Studio");
  });

  it("ignores the flag entirely when no tenantId is supplied", async () => {
    // tenantId omitted → the branded branch is skipped without even consulting
    // the flag (legacy callers stay byte-identical to the platform path).
    getTenantInviteBrandingEnabled.mockClear();

    const { tenantId: _omit, ...noTenant } = baseInvite;
    void _omit;
    await sendInviteEmail({ ...noTenant });

    expect(getTenantInviteBrandingEnabled).not.toHaveBeenCalled();
    expect(captured.html).not.toContain(TENANT_SHELL_MARKER);
    expect(captured.subject).toBe("You now have access to Acme Co on LP Studio");
  });
});
