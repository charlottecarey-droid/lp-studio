/**
 * Code-default BODIES for tenant-scope notification emails (Task #588 — Phase 2).
 *
 * Each body is the inner HTML of the per-tenant brand-derived shell's content
 * card (the master shell supplies the header/logo + footer). Bodies use
 * `{{token}}` for escaped scalar values and a handful of RAW slots (`fieldsTable`,
 * `variantNote`, `ctaBlock`, `commentBlock`, `content`) injected via
 * `renderEmail`'s `rawSlots` for dynamic markup the author can't express as a
 * single escaped value. The slot builders below HTML-escape every dynamic part
 * themselves, so the raw injection is safe.
 *
 * Styled to match the platform body aesthetic (DM Sans headings / Inter copy on
 * the cream `#F6F2E9` shell), so a tenant email reads as a first-class branded
 * message rather than the old bespoke green chrome.
 */

import { escapeHtml } from "./emailRender";

const H1 =
  "margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.03em;color:#1A1815;";
const SUBLINE =
  "margin:14px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#5C5853;";
const BODY_TEXT =
  "margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#2A2722;";

/** Lead notification — field table of the submitted lead. */
export const TENANT_LEAD_NOTIFICATION_BODY_HTML = `<h1 style="${H1}">New lead submission</h1>
              <p style="${SUBLINE}">{{pageTitle}} &middot; {{submittedAt}}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;border-collapse:collapse;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;">
                <tbody>{{fieldsTable}}</tbody>
              </table>
              {{variantNote}}`;

/** New comment on a page. */
export const TENANT_COMMENT_BODY_HTML = `<h1 style="${H1}font-size:26px;">New comment</h1>
              <p style="${SUBLINE}">{{pageTitle}}</p>
              <p style="margin:28px 0 6px 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1A1815;">{{authorName}}</p>
              <p style="${BODY_TEXT}">{{message}}</p>
              {{ctaBlock}}`;

/** Review decision (approved / changes requested). */
export const TENANT_REVIEW_DECISION_BODY_HTML = `<h1 style="${H1}font-size:26px;">Review decision</h1>
              <p style="${SUBLINE}">{{pageTitle}}</p>
              <p style="margin:28px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#2A2722;"><strong style="color:#1A1815;">{{reviewerName}}</strong> reviewed your page.</p>
              <p style="margin:12px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:{{statusColor}};">{{statusLabel}}</p>
              {{commentBlock}}`;

/**
 * Form follow-up to the submitter. The actual content comes from the tenant's
 * own sales email template (already merge-substituted) and is injected via the
 * `content` raw slot, so the tenant's authored copy is preserved verbatim and
 * simply wrapped in their branded shell.
 */
export const TENANT_FORM_FOLLOWUP_BODY_HTML = `{{content}}`;

/** Build the lead field rows (raw HTML; keys + values individually escaped). */
export function buildLeadFieldsTable(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([k]) => !k.startsWith("_"))
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 14px;border-bottom:1px solid rgba(26,24,21,0.10);font-weight:600;white-space:nowrap;color:#1A1815;vertical-align:top;">${escapeHtml(
          k,
        )}</td><td style="padding:10px 14px;border-bottom:1px solid rgba(26,24,21,0.10);color:#2A2722;">${escapeHtml(
          String(v ?? ""),
        )}</td></tr>`,
    )
    .join("");
}

/** Optional "Variant: …" note for the lead body (raw slot). */
export function buildLeadVariantNote(variantName?: string | null): string {
  if (!variantName) return "";
  return `<p style="margin:18px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#8B857C;">Variant: ${escapeHtml(
    variantName,
  )}</p>`;
}

/** Optional "View page →" CTA for the comment body (raw slot). */
export function buildCommentCtaBlock(pageUrl?: string | null): string {
  if (!pageUrl) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
                <tr>
                  <td style="background:#1A1815;border-radius:6px;">
                    <a href="${escapeHtml(
                      pageUrl,
                    )}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.005em;color:#F6F2E9;text-decoration:none;border-radius:6px;">View page &rarr;</a>
                  </td>
                </tr>
              </table>`;
}

/** Optional reviewer-comment callout for the review body (raw slot). */
export function buildReviewCommentBlock(
  decisionComment: string | null | undefined,
  statusColor: string,
): string {
  if (!decisionComment) return "";
  return `<div style="margin-top:20px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#475569;background:#EDE9F5;border-left:3px solid ${escapeHtml(
    statusColor,
  )};padding:14px 18px;border-radius:4px;">${escapeHtml(decisionComment)}</div>`;
}
