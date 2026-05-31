/**
 * Byte-identical regression test for the unified email render path.
 *
 * Phase 1 moved the dispatcher off a hardcoded `renderEmailHtml` frame onto the
 * shared `renderEmail({ shell, bodyHtml, wrapInShell, vars })` pipeline, with
 * the previous markup reproduced via `PLATFORM_DEFAULT_SHELL` +
 * `buildDefaultBodyHtml`. The lifecycle trial emails (trial_day_7/11/13) MUST
 * render byte-for-byte identical to what production sent before the refactor, or
 * the migration that seeded `body_html` has silently changed live emails.
 *
 * This test embeds a verbatim copy of the LEGACY `renderEmailHtml` (lifted from
 * the pre-refactor dispatcher at commit 74665d7be) as the golden generator, and
 * asserts the new pipeline produces the exact same bytes for every trial
 * template across a range of substitution inputs (including HTML-significant
 * characters in the CTA url to exercise escaping).
 */
import { describe, it, expect } from "vitest";
import {
  renderEmail,
  buildDefaultBodyHtml,
  DEFAULT_EMAIL_SHELL,
} from "./emailRender";
import { NOTIFICATION_TEMPLATES } from "./notificationTemplates";

// --- Legacy golden generator (verbatim copy, do not "clean up") -------------

function legacyEscapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Verbatim copy of the pre-refactor dispatcher `render` (plain substitution). */
function legacyRender(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(context, key) ? context[key] : "",
  );
}

/** Verbatim copy of the pre-refactor dispatcher `renderEmailHtml`. */
function legacyRenderEmailHtml(opts: {
  headline: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string | null;
}): string {
  const ctaBlock = opts.ctaUrl
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:8px">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${legacyEscapeHtml(opts.ctaUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      ${legacyEscapeHtml(opts.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${legacyEscapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f4f0;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%">
          <tr>
            <td style="background:#003A30;border-radius:12px 12px 0 0;padding:32px 40px 28px">
              <div style="margin-bottom:20px">
                <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px">
                  <span style="color:#C7E738">LP</span><span style="color:rgba(255,255,255,0.9)"> Studio</span>
                </span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;line-height:1.3">${legacyEscapeHtml(opts.headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 40px;border-radius:0 0 12px 12px">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">
                ${legacyEscapeHtml(opts.intro)}
              </p>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;text-align:center">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af">
                You're receiving this because you're an admin of an LP Studio workspace.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- Test cases -------------------------------------------------------------

const TRIAL_KEYS = ["trial_day_7", "trial_day_11", "trial_day_13"] as const;

/**
 * Substitution sets exercising the escaping paths the legacy frame applied:
 *   - a plain url,
 *   - a url with `&` and `<`/`"` so escapeHtml has work to do,
 *   - different daysRemaining values (trial_day_11/13 interpolate it).
 */
const CTX_VARIANTS: Array<Record<string, string>> = [
  { tenantName: "Acme", daysRemaining: "3", billingUrl: "https://app.lpstudio.ai/billing" },
  {
    tenantName: "O'Brien & Co",
    daysRemaining: "1",
    billingUrl: 'https://app.lpstudio.ai/billing?ref=a&b="c"<d>',
  },
  { tenantName: "Beta", daysRemaining: "7", workspaceUrl: "https://app.lpstudio.ai/ws" },
];

describe("renderEmail byte-identity vs legacy dispatcher frame", () => {
  for (const key of TRIAL_KEYS) {
    const tpl = NOTIFICATION_TEMPLATES[key];
    it(`renders ${key} byte-identical to the pre-refactor frame`, () => {
      expect(tpl).toBeTruthy();
      for (const ctx of CTX_VARIANTS) {
        // Mirror the dispatcher: headline = rendered inAppTitle; ctaUrl =
        // billingUrl ?? workspaceUrl; intro/ctaLabel rendered for the legacy
        // generator (the new body bakes the raw intro/label and interpolates).
        const headline = legacyRender(tpl.inAppTitle, ctx);
        const intro = legacyRender(tpl.emailIntro, ctx);
        const ctaLabel = legacyRender(tpl.emailCtaLabel, ctx);
        const ctaUrl = ctx["billingUrl"] ?? ctx["workspaceUrl"] ?? null;

        const golden = legacyRenderEmailHtml({ headline, intro, ctaLabel, ctaUrl });

        const actual = renderEmail({
          shell: DEFAULT_EMAIL_SHELL,
          bodyHtml: tpl.bodyHtml,
          wrapInShell: tpl.wrapInShell,
          vars: { ...ctx, headline, ctaUrl: ctaUrl ?? "" },
        });

        expect(actual).toBe(golden);
      }
    });
  }

  it("buildDefaultBodyHtml seeds each trial template's bodyHtml", () => {
    for (const key of TRIAL_KEYS) {
      const tpl = NOTIFICATION_TEMPLATES[key];
      expect(tpl.bodyHtml).toBe(buildDefaultBodyHtml(tpl.emailIntro, tpl.emailCtaLabel));
      expect(tpl.wrapInShell).toBe(true);
    }
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
});
