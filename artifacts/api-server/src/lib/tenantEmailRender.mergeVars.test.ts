/**
 * Send-time merge-variable substitution test (Task #653).
 *
 * The WYSIWYG editor (EmailWYSIWYGEditor) serializes merge chips to raw
 * `{{variable}}` tokens, and a sibling test proves that round-trip in the
 * editor. THIS test proves the other half: that the *server send path* actually
 * replaces those tokens with the real recipient values at dispatch time, so a
 * delivered tenant email never ships literal `{{brandName}}` text.
 *
 * It exercises `renderTenantEmail` — the real substitution path used by every
 * tenant-scope email the WYSIWYG editor authors (lead notification, new comment,
 * review decision, form follow-up). The two DB-touching dependencies are mocked
 * so the test is pure (no DB, no network) while the actual interpolation logic
 * (`renderEmail` → `interpolateHtml` for the body, `interpolatePlainText` for
 * the subject) runs unmocked.
 */
import { describe, it, expect, vi } from "vitest";
import { TENANT_NOTIFICATION_VARIABLES } from "@workspace/notification-variables";
import { DEFAULT_EMAIL_SHELL } from "./emailRender";

// Captures the template/shell the mocked deps hand back to renderTenantEmail.
let mockBodyHtml = "";
let mockSubject = "";
let mockEnabled = true;
let mockWrapInShell = true;

vi.mock("./tenantNotificationTemplates", () => ({
  getTenantNotificationTemplate: vi.fn(async () => ({
    key: "lead_notification",
    name: "Lead notification",
    description: null,
    emailSubject: mockSubject,
    fromEmail: null,
    replyTo: null,
    preheaderText: null,
    bodyHtml: mockBodyHtml,
    bodyMode: "wysiwyg",
    wrapInShell: mockWrapInShell,
    previewData: {},
    enabled: mockEnabled,
  })),
}));

vi.mock("./tenantEmailShell", () => ({
  resolveTenantShell: vi.fn(async () => ({
    shell: DEFAULT_EMAIL_SHELL,
    source: "brand" as const,
    physicalAddress: "",
  })),
}));

const { renderTenantEmail } = await import("./tenantEmailRender");

/** A unique, escape-safe real value to substitute for each catalog token. */
const realValueFor = (token: string): string => `REAL_${token}_VALUE`;

describe("renderTenantEmail — send-time merge-variable substitution", () => {
  it("replaces every WYSIWYG merge token in the body with its real value", async () => {
    // Build a body that drops a chip for EVERY tenant merge variable the editor
    // offers, exactly as the WYSIWYG serializer would emit them.
    mockBodyHtml = TENANT_NOTIFICATION_VARIABLES.map(
      (v) => `<p>${v.label}: {{${v.token}}}</p>`,
    ).join("\n");
    mockSubject = "New lead for {{brandName}} on {{pageTitle}}";
    mockEnabled = true;
    mockWrapInShell = true;

    const vars: Record<string, string> = {};
    for (const v of TENANT_NOTIFICATION_VARIABLES) vars[v.token] = realValueFor(v.token);

    const result = await renderTenantEmail({ tenantId: 1, key: "lead_notification", vars });
    expect(result).not.toBeNull();
    const { html, subject } = result!;

    // Every catalog token resolved to the supplied real value in the body...
    for (const v of TENANT_NOTIFICATION_VARIABLES) {
      expect(html).toContain(realValueFor(v.token));
    }
    // ...and in the subject line (plain-text substitution path).
    expect(subject).toBe(`New lead for ${realValueFor("brandName")} on ${realValueFor("pageTitle")}`);

    // No literal token braces survive into the delivered HTML or subject.
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
    expect(subject).not.toContain("{{");
  });

  it("fails safely on an unknown/missing variable — no leaked {{...}} in the mail", async () => {
    // brandName is supplied; the other two tokens have no value at send time
    // (an author typo, or a variable removed from the catalog).
    mockBodyHtml =
      "<p>Hi {{brandName}}, your page {{notARealVariable}} is ready. {{anotherMissingToken}}</p>";
    mockSubject = "Update for {{brandName}} {{missingInSubject}}";
    mockEnabled = true;
    mockWrapInShell = true;

    const result = await renderTenantEmail({
      tenantId: 1,
      key: "lead_notification",
      vars: { brandName: "Acme Dental" },
    });
    expect(result).not.toBeNull();
    const { html, subject } = result!;

    // The known token is substituted with its real value.
    expect(html).toContain("Acme Dental");
    expect(subject).toContain("Acme Dental");

    // Unknown tokens collapse to empty string — never delivered as raw text.
    expect(html).not.toContain("notARealVariable");
    expect(html).not.toContain("anotherMissingToken");
    expect(subject).not.toContain("missingInSubject");

    // And crucially: no literal braces leak through anywhere.
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
    expect(subject).not.toContain("{{");
    expect(subject).not.toContain("}}");
  });

  it("substitutes tokens in a full-custom (wrapInShell=false) body too", async () => {
    mockBodyHtml =
      "<html><body><h1>{{brandName}}</h1><p>{{message}} — {{authorName}}</p></body></html>";
    mockSubject = "Comment from {{authorName}}";
    mockEnabled = true;
    mockWrapInShell = false;

    const result = await renderTenantEmail({
      tenantId: 1,
      key: "new_comment",
      vars: {
        brandName: "Acme Dental",
        message: "Looks great",
        authorName: "Taylor Reed",
      },
    });
    expect(result).not.toBeNull();
    const { html, subject } = result!;

    expect(html).toContain("Acme Dental");
    expect(html).toContain("Looks great");
    expect(html).toContain("Taylor Reed");
    expect(subject).toBe("Comment from Taylor Reed");
    expect(html).not.toContain("{{");
  });
});
