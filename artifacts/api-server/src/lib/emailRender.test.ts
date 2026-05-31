/**
 * Regression tests for the unified email render pipeline after adopting the
 * on-brand master shell + self-contained magazine welcome.
 *
 * The pre-refactor "byte-identical to the legacy frame" guarantee is
 * intentionally retired: the platform shell was deliberately replaced with the
 * branded master shell, so standard lifecycle emails now render in the new
 * chrome. These tests instead pin the behavior we rely on:
 *   - the shell substitutes every slot/var (no leftover `{{tokens}}`),
 *   - CTA urls stay HTML-escaped,
 *   - structured templates seed their body from `buildDefaultBodyHtml`,
 *   - the welcome template is full-custom HTML (no shell chrome),
 *   - `expandEmailVars` derives the footer / compliance tokens.
 */
import { describe, it, expect } from "vitest";
import {
  renderEmail,
  buildDefaultBodyHtml,
  expandEmailVars,
  DEFAULT_EMAIL_SHELL,
} from "./emailRender";
import { NOTIFICATION_TEMPLATES } from "./notificationTemplates";
import { MAGAZINE_WELCOME_HTML, WORKSPACE_INVITE_MAGAZINE_HTML } from "./emailHtmlAssets";

const TRIAL_KEYS = ["trial_day_7", "trial_day_11", "trial_day_13"] as const;

/** Realistic, fully-expanded var set for a shell-wrapped render. */
const baseVars = (over: Record<string, string>): Record<string, string> =>
  expandEmailVars({
    tenantName: "Acme",
    recipientName: "Jordan",
    recipientEmail: "jordan@acme.com",
    workspaceUrl: "https://acme.lpstudio.ai",
    daysRemaining: "3",
    ...over,
  });

describe("renderEmail — branded master shell", () => {
  it("buildDefaultBodyHtml seeds each structured template's bodyHtml", () => {
    for (const key of TRIAL_KEYS) {
      const tpl = NOTIFICATION_TEMPLATES[key];
      expect(tpl.bodyHtml).toBe(buildDefaultBodyHtml(tpl.emailIntro, tpl.emailCtaLabel));
      expect(tpl.wrapInShell).toBe(true);
      expect(tpl.bodyMode).toBe("wysiwyg");
    }
  });

  it("wraps a structured template in the shell with every token resolved", () => {
    const tpl = NOTIFICATION_TEMPLATES["trial_day_11"];
    const headline = "Your Acme Growth trial ends in 3 days";
    const html = renderEmail({
      shell: DEFAULT_EMAIL_SHELL,
      bodyHtml: tpl.bodyHtml,
      wrapInShell: true,
      vars: baseVars({
        headline,
        subject: headline,
        preheaderText: "3 days left",
        billingUrl: "https://acme.lpstudio.ai/billing",
        ctaUrl: "https://acme.lpstudio.ai/billing",
      }),
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain(headline); // headline baked into the body card
    expect(html).toContain("Unsubscribe"); // footer compliance present
    expect(html).toContain(String(new Date().getUTCFullYear())); // currentYear
    // Every {{token}} the shell, body, and footer reference must be resolved.
    expect(html).not.toContain("{{");
  });

  it("HTML-escapes a CTA url with significant characters", () => {
    const tpl = NOTIFICATION_TEMPLATES["trial_day_7"];
    const dirty = 'https://acme.lpstudio.ai/b?x=a&y="z"<q>';
    const html = renderEmail({
      shell: DEFAULT_EMAIL_SHELL,
      bodyHtml: tpl.bodyHtml,
      wrapInShell: true,
      vars: baseVars({ headline: "Hi", subject: "Hi", ctaUrl: dirty }),
    });
    expect(html).toContain("x=a&amp;y=&quot;z&quot;&lt;q&gt;");
    expect(html).not.toContain('y="z"<q>');
  });

  it("welcome is full-custom magazine HTML (no shell chrome)", () => {
    const tpl = NOTIFICATION_TEMPLATES["welcome"];
    expect(tpl.wrapInShell).toBe(false);
    expect(tpl.bodyMode).toBe("html");
    expect(tpl.bodyHtml).toBe(MAGAZINE_WELCOME_HTML);

    const html = renderEmail({
      shell: DEFAULT_EMAIL_SHELL,
      bodyHtml: tpl.bodyHtml,
      wrapInShell: false,
      vars: baseVars({ headline: "ignored", ctaUrl: "https://acme.lpstudio.ai" }),
    });
    expect(html).toContain("Acme"); // {{tenantName}}
    expect(html).toContain("Jordan"); // {{recipientName}}
    expect(html).toContain("jordan@acme.com"); // {{recipientEmail}}
    // All authored tokens resolved (the magazine uses only the canonical set).
    expect(html).not.toContain("{{");
  });

  it("workspace_invite is full-custom magazine HTML resolving all invite tokens", () => {
    const tpl = NOTIFICATION_TEMPLATES["workspace_invite"];
    expect(tpl.wrapInShell).toBe(false);
    expect(tpl.bodyMode).toBe("html");
    expect(tpl.bodyHtml).toBe(WORKSPACE_INVITE_MAGAZINE_HTML);

    const html = renderEmail({
      shell: DEFAULT_EMAIL_SHELL,
      bodyHtml: tpl.bodyHtml,
      wrapInShell: false,
      vars: expandEmailVars({ ...tpl.previewData } as Record<string, string>),
    });
    expect(html).toContain("Taylor"); // {{inviterName}}
    expect(html).toContain("Acme"); // {{tenantName}}
    expect(html).toContain("Editor"); // {{roleName}}
    expect(html).toContain("acme.lpstudio.ai"); // {{workspaceHost}}
    expect(html).toContain("invite/sample"); // {{acceptUrl}}
    expect(html).toContain("jordan@acme.com"); // {{recipientEmail}}
    // The footer's {{physicalAddress}} / {{currentYear}} are expandEmailVars-derived.
    expect(html).not.toContain("{{");
  });

  it("wrapInShell=false returns the interpolated body verbatim (no chrome)", () => {
    const html = renderEmail({
      shell: DEFAULT_EMAIL_SHELL,
      bodyHtml: "<p>Hello {{tenantName}}</p>",
      wrapInShell: false,
      vars: { tenantName: "Acme", headline: "ignored" },
    });
    expect(html).toBe("<p>Hello Acme</p>");
    expect(html).not.toContain("<!DOCTYPE html>");
  });

  it("expandEmailVars derives footer / compliance tokens", () => {
    const v = expandEmailVars({ workspaceUrl: "https://acme.lpstudio.ai" });
    expect(v["unsubscribeUrl"]).toBe("https://acme.lpstudio.ai/settings/notifications");
    expect(v["currentYear"]).toBe(String(new Date().getUTCFullYear()));
    expect(v).toHaveProperty("physicalAddress");
    expect(v["preheaderText"]).toBe("");
  });

  it("expandEmailVars never overwrites explicit values", () => {
    const v = expandEmailVars({
      workspaceUrl: "https://acme.lpstudio.ai",
      unsubscribeUrl: "https://acme.lpstudio.ai/custom-unsub",
      physicalAddress: "1 Main St, SF, CA",
      subject: "Explicit subject",
      headline: "A headline",
    });
    expect(v["unsubscribeUrl"]).toBe("https://acme.lpstudio.ai/custom-unsub");
    expect(v["physicalAddress"]).toBe("1 Main St, SF, CA");
    expect(v["subject"]).toBe("Explicit subject");
  });
});
