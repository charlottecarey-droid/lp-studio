/**
 * Single source of truth for rendering platform emails.
 *
 * Every platform email — lifecycle nudges (dispatcher), the workspace invite,
 * and the superadmin live-preview / test-send — runs through `renderEmail` so
 * what an operator edits and previews is exactly what recipients receive.
 *
 * Model:
 *   - A SHELL is the branded wrapper (head, outer frame, dark header with logo
 *     + headline, white body card, footer). It exposes raw slots `{{logoHtml}}`,
 *     `{{body}}`, `{{footerHtml}}` and escaped vars `{{headline}}`,
 *     `{{headerBg}}`.
 *   - A BODY is the free-form inner HTML of the white card. It may contain any
 *     `{{variable}}` tokens; values are HTML-escaped on substitution.
 *   - `wrapInShell = false` makes the body the ENTIRE email (a complete custom
 *     `<html>` document, no shell chrome).
 *
 * Byte-compat: the code defaults below reproduce the previous hardcoded
 * dispatcher frame exactly, so unedited lifecycle emails render identically
 * (guarded by emailRender.test.ts).
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replace `{{key}}` tokens, HTML-escaping each substituted value. Unknown
 * tokens become "" (same as the legacy dispatcher `render`). The template text
 * itself is left verbatim — authors write trusted raw HTML; only the injected
 * values are escaped.
 */
export function interpolateHtml(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? escapeHtml(vars[key]) : "",
  );
}

/** Inject a raw (already-trusted, NOT escaped) value into a `{{slot}}` token. */
function injectRawSlot(doc: string, slot: string, value: string): string {
  return doc.split(new RegExp(`\\{\\{\\s*${slot}\\s*\\}\\}`)).join(value);
}

export interface EmailShell {
  shellHtml: string;
  logoHtml: string;
  headerBg: string;
  footerHtml: string;
}

export interface RenderEmailInput {
  shell: EmailShell;
  bodyHtml: string;
  wrapInShell: boolean;
  /** Substitution map (escaped on insert). Must include `headline` for the shell. */
  vars: Record<string, string>;
}

/**
 * Render a complete email document.
 *
 * Pipeline (order matters for safety):
 *   1. Interpolate the body with `vars` (escaped) → resolved body HTML.
 *   2. If not wrapping, return the resolved body verbatim (full custom HTML).
 *   3. Inject the raw slots (logo, footer, body) into the shell.
 *   4. Interpolate remaining shell vars (`headline`, `headerBg`) escaped.
 */
export function renderEmail(input: RenderEmailInput): string {
  const body = interpolateHtml(input.bodyHtml, input.vars);
  if (!input.wrapInShell) return body;

  let doc = input.shell.shellHtml;
  doc = injectRawSlot(doc, "logoHtml", input.shell.logoHtml);
  doc = injectRawSlot(doc, "footerHtml", input.shell.footerHtml);
  doc = injectRawSlot(doc, "body", body);
  return interpolateHtml(doc, { ...input.vars, headerBg: input.shell.headerBg });
}

// ---------------------------------------------------------------------------
// Code defaults — reproduce the previous hardcoded dispatcher frame exactly.
// ---------------------------------------------------------------------------

export const DEFAULT_HEADER_BG = "#003A30";

export const DEFAULT_LOGO_HTML = `<span style="font-size:22px;font-weight:700;letter-spacing:-0.5px">
                  <span style="color:#C7E738">LP</span><span style="color:rgba(255,255,255,0.9)"> Studio</span>
                </span>`;

export const DEFAULT_FOOTER_HTML = `<p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af">
                You're receiving this because you're an admin of an LP Studio workspace.
              </p>`;

export const PLATFORM_DEFAULT_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{headline}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f4f0;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%">
          <tr>
            <td style="background:{{headerBg}};border-radius:12px 12px 0 0;padding:32px 40px 28px">
              <div style="margin-bottom:20px">
                {{logoHtml}}
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;line-height:1.3">{{headline}}</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 40px;border-radius:0 0 12px 12px">
              {{body}}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;text-align:center">
              {{footerHtml}}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** The code-default shell (used when no DB override exists). */
export const DEFAULT_EMAIL_SHELL: EmailShell = {
  shellHtml: PLATFORM_DEFAULT_SHELL,
  logoHtml: DEFAULT_LOGO_HTML,
  headerBg: DEFAULT_HEADER_BG,
  footerHtml: DEFAULT_FOOTER_HTML,
};

/**
 * Build the default free-form body for a structured (subject + intro + CTA)
 * template. The intro and CTA label are inlined (HTML-escaped, exactly like the
 * legacy frame escaped them) so the whole body is editable, while `{{ctaUrl}}`
 * and any tokens inside the intro (e.g. `{{daysRemaining}}`) stay variable.
 *
 * Rendering this with the platform default shell reproduces the previous
 * dispatcher output byte-for-byte (see emailRender.test.ts).
 */
export function buildDefaultBodyHtml(intro: string, ctaLabel: string): string {
  return `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">
                ${escapeHtml(intro)}
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:8px">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="{{ctaUrl}}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>`;
}
