/**
 * Centralized platform/system email sender envelope.
 *
 * Every platform/system email (invites, magic links / auth, payment-failure
 * and lifecycle notifications, slug-redirect notices, admin test sends, lead
 * notifications, personalized-link visit alerts, collaboration emails, …) is
 * sent from a single verified platform address with a monitored reply-to so
 * recipients can reply and reach a real inbox.
 *
 * The defaults are overridable via env so ops can repoint the sender without a
 * code change:
 *   - RESEND_FROM_EMAIL → the from-header (display-name form), default below.
 *   - RESEND_REPLY_TO    → the reply-to address; set to empty string to disable.
 *
 * IMPORTANT: This is the PLATFORM sender only. Tenant / sales-console email
 * sends from per-tenant sending domains (see buildNotificationsFrom /
 * buildFromHeader in salesBrandContext.ts) and must NOT use these helpers.
 */

/** The verified platform from-address used when RESEND_FROM_EMAIL is unset. */
export const PLATFORM_FROM_FALLBACK = "LP Studio <team@mail.lpstudio.ai>";

/** The monitored platform reply-to used when RESEND_REPLY_TO is unset. */
export const PLATFORM_REPLY_TO_FALLBACK = "team@lpstudio.ai";

/**
 * The platform from-header. Honors RESEND_FROM_EMAIL when set (non-blank),
 * otherwise the verified `team@mail.lpstudio.ai` default.
 */
export function platformFromAddress(): string {
  const v = process.env["RESEND_FROM_EMAIL"];
  return v && v.trim() ? v.trim() : PLATFORM_FROM_FALLBACK;
}

/**
 * The platform reply-to. Honors RESEND_REPLY_TO when set: a non-blank value
 * is used verbatim; an explicit empty string disables the reply-to entirely
 * (returns undefined). When the var is unset, the `team@lpstudio.ai` default
 * applies. Returning undefined lets callers drop the key (JSON.stringify omits
 * undefined) so no reply-to header is emitted.
 */
export function platformReplyTo(): string | undefined {
  const v = process.env["RESEND_REPLY_TO"];
  if (v !== undefined) {
    const t = v.trim();
    return t ? t : undefined;
  }
  return PLATFORM_REPLY_TO_FALLBACK;
}
