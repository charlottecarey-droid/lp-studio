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

import {
  MASTER_SHELL_HTML,
  MASTER_SHELL_LOGO_HTML,
  MASTER_SHELL_FOOTER_HTML,
  MASTER_SHELL_HEADER_BG,
} from "./emailHtmlAssets";

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
  /**
   * Raw (already-trusted, NOT escaped) HTML injected into body `{{slot}}` tokens
   * AFTER the escaped `vars` interpolation. Used by tenant emails for dynamic
   * markup the author can't express as a single escaped value (e.g. a lead
   * field table, a conditional CTA block). Each value MUST already have its own
   * dynamic parts HTML-escaped by the caller. Platform callers omit this, so
   * their output is byte-identical to before.
   */
  rawSlots?: Record<string, string>;
}

/**
 * Render a complete email document.
 *
 * Pipeline (order matters for safety):
 *   1. Replace raw-slot tokens in the body with opaque sentinels. This must
 *      happen BEFORE the vars interpolation: `interpolateHtml` blanks every
 *      token it doesn't know, so an unprotected `{{fieldsTable}}` would be
 *      wiped to "" and the raw slot would never land (the "empty tenant
 *      email body" regression).
 *   2. Interpolate the body with `vars` (escaped).
 *   3. Swap the sentinels for the raw slot HTML. Substituting after the
 *      interpolation keeps both original safety properties: the raw HTML is
 *      never re-interpolated/escaped, and a `{{slot}}` token arriving inside
 *      an escaped var VALUE stays literal text instead of pulling in raw HTML.
 *   4. If not wrapping, return the resolved body verbatim (full custom HTML).
 *   5. Inject the raw slots (logo, footer, body) into the shell.
 *   6. Interpolate remaining shell vars (`headline`, `headerBg`) escaped.
 */
export function renderEmail(input: RenderEmailInput): string {
  const slots = Object.entries(input.rawSlots ?? {});
  // NUL-delimited sentinels can't be produced by escapeHtml'd var values or
  // survive any sane template author's copy, so they never collide with text.
  const sentinelFor = (i: number) => `\u0000LP_RAW_SLOT_${i}\u0000`;
  let body = input.bodyHtml;
  for (let i = 0; i < slots.length; i++) {
    body = injectRawSlot(body, slots[i][0], sentinelFor(i));
  }
  body = interpolateHtml(body, input.vars);
  for (let i = 0; i < slots.length; i++) {
    body = body.split(sentinelFor(i)).join(slots[i][1]);
  }
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

export const DEFAULT_HEADER_BG = MASTER_SHELL_HEADER_BG;

export const DEFAULT_LOGO_HTML = MASTER_SHELL_LOGO_HTML;

export const DEFAULT_FOOTER_HTML = MASTER_SHELL_FOOTER_HTML;

export const PLATFORM_DEFAULT_SHELL = MASTER_SHELL_HTML;

/** The code-default shell (used when no DB override exists). */
export const DEFAULT_EMAIL_SHELL: EmailShell = {
  shellHtml: PLATFORM_DEFAULT_SHELL,
  logoHtml: DEFAULT_LOGO_HTML,
  headerBg: DEFAULT_HEADER_BG,
  footerHtml: DEFAULT_FOOTER_HTML,
};

/**
 * Build the default free-form body for a structured (subject + intro + CTA)
 * template, styled for the branded master shell's cream body card.
 *
 * The master shell renders NO headline of its own (its header is just the
 * wordmark + accent strip), so the body bakes the `{{headline}}` token itself.
 * The intro and CTA label are inlined (HTML-escaped) so the whole body is
 * editable, while `{{headline}}`, `{{ctaUrl}}` and any tokens inside the intro
 * (e.g. `{{daysRemaining}}`) stay variable.
 */
export function buildDefaultBodyHtml(intro: string, ctaLabel: string): string {
  return `<h1 style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:30px;line-height:1.12;font-weight:800;letter-spacing:-0.03em;color:#1A1815;">{{headline}}</h1>
              <p style="margin:20px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#2A2722;">
                ${escapeHtml(intro)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
                <tr>
                  <td style="background:#1A1815;border-radius:6px;">
                    <a href="{{ctaUrl}}" target="_blank"
                       style="display:inline-block;padding:14px 26px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.005em;color:#F6F2E9;text-decoration:none;border-radius:6px;">
                      ${escapeHtml(ctaLabel)} →
                    </a>
                  </td>
                </tr>
              </table>`;
}

/**
 * Default CAN-SPAM postal address baked into the master-shell footer. Empty by
 * default — operators MUST set their real mailing address (either by editing the
 * footer HTML in the shell editor or by overriding `physicalAddress` in a
 * template's preview data). An empty value renders the footer with no address
 * line rather than a fabricated one.
 */
export const DEFAULT_PHYSICAL_ADDRESS = "";

/**
 * Fill in the derived / compliance email tokens that the branded shell + footer
 * reference but that callers rarely supply explicitly:
 *   - `currentYear`     — UTC year, for the footer copyright.
 *   - `physicalAddress` — CAN-SPAM postal address (default: none).
 *   - `unsubscribeUrl`  — workspace notification settings, if not provided.
 *   - `subject`         — falls back to `headline` (the shell `<title>`).
 *   - `preheaderText`   — inbox preview text; defaults to empty.
 *
 * Explicitly-provided values always win. Called on EVERY render path (dispatcher
 * + superadmin preview/test-send) so what an operator previews matches what
 * recipients receive.
 */
export function expandEmailVars(vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...vars };
  const workspaceUrl = out["workspaceUrl"] ?? "";
  if (!out["currentYear"]) out["currentYear"] = String(new Date().getUTCFullYear());
  if (out["physicalAddress"] === undefined) out["physicalAddress"] = DEFAULT_PHYSICAL_ADDRESS;
  if (!out["unsubscribeUrl"]) {
    out["unsubscribeUrl"] = workspaceUrl ? `${workspaceUrl}/settings/notifications` : "";
  }
  if (!out["subject"] && out["headline"]) out["subject"] = out["headline"];
  if (out["preheaderText"] === undefined) out["preheaderText"] = "";
  return out;
}
