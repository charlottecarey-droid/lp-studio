import { logger } from "./logger";
import { renderEmail, expandEmailVars } from "./emailRender";
import { getNotificationTemplate } from "./notificationTemplates";
import { renderTenantEmail } from "./tenantEmailRender";
import { resolveEmailShellForEmail } from "./tenantEmailShell";
import { buildLeadFieldsTable, buildLeadVariantNote } from "./tenantEmailAssets";
import { platformFromAddress, platformReplyTo } from "./platformSender";

/**
 * Plain-text token substitution for email SUBJECTS (no HTML escaping). Mirrors
 * the dispatcher's substitution but is local so subjects don't depend on the
 * HTML-escaping interpolator.
 */
function interpolatePlainText(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "",
  );
}

/**
 * Render a SYSTEM email (transactional/auth) from its `notification_templates`
 * registry entry, merged with SuperAdmin overrides. Returns `{ subject, html }`
 * on success, or `null` when the operator can't be trusted to have produced a
 * sendable email — in which case the caller MUST fall back to its hardcoded
 * HTML so sign-in / billing alerts can never break. `null` is returned when the
 * template is missing, disabled, has a blank body/subject, or rendering throws.
 *
 * The action URL is passed in `vars.ctaUrl` and is HTML-escaped on substitution,
 * so the magic-link / reset / verify URL is preserved verbatim inside the href.
 */
async function renderSystemEmail(
  key: string,
  vars: Record<string, string>,
  tenantId?: number | null,
): Promise<{ subject: string; html: string } | null> {
  try {
    const tpl = await getNotificationTemplate(key);
    if (!tpl || !tpl.enabled) return null;
    const body = (tpl.bodyHtml ?? "").trim();
    if (!body) return null;
    // Brandable account emails (payment_failed, slug_redirect_expiry) co-brand
    // with the tenant's own logo when a tenantId is supplied; auth/trust emails
    // (magic link, reset, verify, invite) pass no tenantId and stay LP Studio.
    const { shell, physicalAddress } = await resolveEmailShellForEmail({
      key,
      tenantId,
      wrapInShell: tpl.wrapInShell,
    });
    // Inject the tenant's saved postal address into the `{{physicalAddress}}`
    // footer token unless explicitly provided; expandEmailVars defaults missing
    // values to "" so an unset address omits the line cleanly.
    const expanded = expandEmailVars(
      vars.physicalAddress === undefined && physicalAddress
        ? { ...vars, physicalAddress }
        : vars,
    );
    const html = renderEmail({
      shell,
      bodyHtml: tpl.bodyHtml,
      wrapInShell: tpl.wrapInShell,
      vars: expanded,
    });
    if (!html || !html.trim()) return null;
    const subject = interpolatePlainText(tpl.emailSubject ?? "", expanded).trim();
    if (!subject) return null;
    return { subject, html };
  } catch (err) {
    logger.error({ err, key }, "system email template render failed — using code fallback");
    return null;
  }
}

/** Best-effort origin of an action URL, for deriving footer/workspace links. */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Best-effort host (no scheme) of an action URL, for display in email copy. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export interface InvitePayload {
  inviteeEmail: string;
  inviterName: string;
  tenantName: string;
  roleName: string;
  isNewUser: boolean;
  signInUrl: string;
  fromEmail?: string;
}

export async function sendInviteEmail(invite: InvitePayload): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping invite email");
    return;
  }

  const { inviteeEmail, inviterName, tenantName, roleName, isNewUser, signInUrl } = invite;

  const actionLabel = isNewUser ? "Create your account" : "Sign in to accept";
  const headline = isNewUser
    ? `You've been invited to join ${tenantName}`
    : `You now have access to ${tenantName}`;
  const bodyText = isNewUser
    ? `${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(tenantName)}</strong> on LP Studio as a <strong>${escapeHtml(roleName)}</strong>. Create your account to get started.`
    : `${escapeHtml(inviterName)} has added you to <strong>${escapeHtml(tenantName)}</strong> on LP Studio as a <strong>${escapeHtml(roleName)}</strong>. Sign in to access your workspace.`;

  // Hard fallback: a fully self-contained branded HTML document that does NOT
  // depend on the editable shell, so a broken/blank shell override can never
  // break invite delivery. The role + workspace are already named inline in
  // bodyText, so the standalone fallback omits the separate role badge.
  const fallbackHtml = buildAuthActionEmailHtml({
    headline,
    bodyHtml: bodyText,
    ctaLabel: actionLabel,
    ctaUrl: signInUrl,
    footerNote: `Sign in using the Google account associated with ${inviteeEmail}. If you weren't expecting this invitation, you can safely ignore this email.`,
  });

  const fallbackSubject = isNewUser
    ? `You've been invited to join ${tenantName} on LP Studio`
    : `You now have access to ${tenantName} on LP Studio`;

  // Prefer the editable registry template; the variable sentence and CTA label
  // ride along as tokens so one template covers both new-account and added-user
  // cases. Falls back to the hardcoded invite above on any failure.
  const tpl = await renderSystemEmail("workspace_invite", {
    headline,
    inviteBody: bodyText,
    tenantName,
    roleName,
    inviterName,
    ctaUrl: signInUrl,
    acceptUrl: signInUrl,
    ctaLabel: actionLabel,
    recipientEmail: inviteeEmail,
    recipientName: inviterName,
    workspaceUrl: originOf(signInUrl),
    workspaceHost: hostOf(signInUrl),
  });
  const subject = tpl?.subject ?? fallbackSubject;
  const html = tpl?.html ?? fallbackHtml;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: invite.fromEmail ?? platformFromAddress(),
        reply_to: platformReplyTo(),
        to: [inviteeEmail],
        subject,
        html,
      }),
    });
    logger.info({ inviteeEmail, tenantName }, "Invite email sent");
  } catch (err) {
    logger.error({ err, inviteeEmail }, "Failed to send invite email");
  }
}

/**
 * Single source of truth for the LP Studio–branded transactional email shell:
 * the dark-green header with the LP wordmark, the white content card, and the
 * grey footer note. `contentHtml` is injected verbatim into the white content
 * cell, so callers own their body markup (paragraphs, CTAs, alert panels, …).
 * `headline` is treated as trusted/pre-escaped HTML (callers escape any
 * interpolated user data); `footerNote` is plain text and is escaped here.
 */
function buildLpEmailShell(opts: {
  headline: string;
  contentHtml: string;
  footerNote: string;
  maxWidth?: number;
}): string {
  const { headline, contentHtml, footerNote, maxWidth = 560 } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f4f0;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:${maxWidth}px;width:100%">
          <tr>
            <td style="background:#003A30;border-radius:12px 12px 0 0;padding:32px 40px 28px">
              <div style="margin-bottom:20px">
                <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px">
                  <span style="color:#C7E738">LP</span><span style="color:rgba(255,255,255,0.9)"> Studio</span>
                </span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;line-height:1.3">${headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 40px">
${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8faf8;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">${escapeHtml(footerNote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Auth-action email (magic link / password reset / email verification): a
 * single body paragraph, a lime CTA button, an optional expiry note, and the
 * "paste this link" fallback line — rendered inside the shared LP shell.
 */
function buildAuthActionEmailHtml(opts: {
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
  expiryNote?: string;
}): string {
  const { headline, bodyHtml, ctaLabel, ctaUrl, footerNote, expiryNote } = opts;
  const contentHtml = `              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">
                ${bodyHtml}
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(ctaUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      ${escapeHtml(ctaLabel)} →
                    </a>
                  </td>
                </tr>
              </table>
              ${expiryNote ? `<p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6">${escapeHtml(expiryNote)}</p>` : ""}
              <p style="margin:16px 0 0;font-size:12px;color:#b6bcc4;line-height:1.6;word-break:break-all">
                Or paste this link into your browser: ${escapeHtml(ctaUrl)}
              </p>`;
  return buildLpEmailShell({ headline, contentHtml, footerNote, maxWidth: 520 });
}

async function sendAuthActionEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  logContext: Record<string, unknown>;
  logMessage: string;
}): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn(`RESEND_API_KEY not set — skipping ${opts.logMessage}`);
    return false;
  }
  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.fromEmail ?? platformFromAddress(),
        reply_to: platformReplyTo(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    logger.info(opts.logContext, `${opts.logMessage} sent`);
    return true;
  } catch (err) {
    logger.error({ err, ...opts.logContext }, `Failed to send ${opts.logMessage}`);
    return false;
  }
}

/**
 * Passwordless sign-in ("magic link"). Returns true if Resend accepted the
 * message. The link verifies the address on redemption, so it doubles as
 * email verification.
 */
export async function sendMagicLinkEmail(payload: {
  recipientEmail: string;
  magicLinkUrl: string;
  expiryLabel: string;
}): Promise<boolean> {
  const { recipientEmail, magicLinkUrl, expiryLabel } = payload;
  const fallbackHtml = buildAuthActionEmailHtml({
    headline: "Your sign-in link",
    bodyHtml: "Click the button below to sign in to LP Studio. No password needed.",
    ctaLabel: "Sign in to LP Studio",
    ctaUrl: magicLinkUrl,
    expiryNote: `This link expires in ${expiryLabel} and can only be used once. If you didn't request it, you can safely ignore this email.`,
    footerNote: "You're receiving this because someone requested a sign-in link for this email address on LP Studio.",
  });
  const tpl = await renderSystemEmail("magic_link", {
    headline: "Your sign-in link",
    ctaUrl: magicLinkUrl,
    expiryLabel,
    recipientEmail,
    workspaceUrl: originOf(magicLinkUrl),
  });
  return sendAuthActionEmail({
    to: recipientEmail,
    subject: tpl?.subject ?? "Your LP Studio sign-in link",
    html: tpl?.html ?? fallbackHtml,
    logContext: { recipientEmail },
    logMessage: "magic-link email",
  });
}

/**
 * Forgot-password reset link. Returns true if Resend accepted the message.
 */
export async function sendPasswordResetEmail(payload: {
  recipientEmail: string;
  resetUrl: string;
  expiryLabel: string;
}): Promise<boolean> {
  const { recipientEmail, resetUrl, expiryLabel } = payload;
  const fallbackHtml = buildAuthActionEmailHtml({
    headline: "Reset your password",
    bodyHtml: "We received a request to reset the password for your LP Studio account. Click below to choose a new one.",
    ctaLabel: "Reset password",
    ctaUrl: resetUrl,
    expiryNote: `This link expires in ${expiryLabel} and can only be used once. If you didn't request a reset, you can safely ignore this email — your password won't change.`,
    footerNote: "You're receiving this because a password reset was requested for this email address on LP Studio.",
  });
  const tpl = await renderSystemEmail("password_reset", {
    headline: "Reset your password",
    ctaUrl: resetUrl,
    expiryLabel,
    recipientEmail,
    workspaceUrl: originOf(resetUrl),
  });
  return sendAuthActionEmail({
    to: recipientEmail,
    subject: tpl?.subject ?? "Reset your LP Studio password",
    html: tpl?.html ?? fallbackHtml,
    logContext: { recipientEmail },
    logMessage: "password-reset email",
  });
}

/**
 * Email-address verification link sent after email+password registration.
 * Returns true if Resend accepted the message.
 */
export async function sendEmailVerificationEmail(payload: {
  recipientEmail: string;
  verifyUrl: string;
  expiryLabel: string;
}): Promise<boolean> {
  const { recipientEmail, verifyUrl, expiryLabel } = payload;
  const fallbackHtml = buildAuthActionEmailHtml({
    headline: "Confirm your email",
    bodyHtml: "Welcome to LP Studio! Please confirm this is your email address to finish setting up your account.",
    ctaLabel: "Confirm email",
    ctaUrl: verifyUrl,
    expiryNote: `This link expires in ${expiryLabel}. If you didn't create an LP Studio account, you can safely ignore this email.`,
    footerNote: "You're receiving this because an LP Studio account was created with this email address.",
  });
  const tpl = await renderSystemEmail("email_verification", {
    headline: "Confirm your email",
    ctaUrl: verifyUrl,
    expiryLabel,
    recipientEmail,
    workspaceUrl: originOf(verifyUrl),
  });
  return sendAuthActionEmail({
    to: recipientEmail,
    subject: tpl?.subject ?? "Confirm your email for LP Studio",
    html: tpl?.html ?? fallbackHtml,
    logContext: { recipientEmail },
    logMessage: "email-verification email",
  });
}

export interface SlugRedirectExpiryPayload {
  recipientEmail: string;
  /** Tenant whose brand-derived shell co-brands the email (Task #615). */
  tenantId?: number;
  tenantName: string;
  oldUrl: string;
  currentUrl: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  fromEmail?: string;
}

/**
 * Returns true if the email was accepted by Resend, false otherwise (including
 * "no API key configured"). Callers use this to decide whether to mark the
 * underlying record as notified — failing sends should be retried on the next
 * scan rather than silently skipped.
 */
export async function sendSlugRedirectExpiryWarning(payload: SlugRedirectExpiryPayload): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping slug redirect expiry warning");
    return false;
  }

  const { recipientEmail, tenantName, oldUrl, currentUrl, expiresAt, daysUntilExpiry } = payload;
  // Deliberately do NOT honor a per-tenant from-domain here — many tenant
  // domains aren't verified with Resend, which would cause hard rejections
  // and an admin who never gets warned. The platform sender is verified.
  const fromAddress = platformFromAddress();
  const expiryFormatted = expiresAt.toUTCString().replace(/ GMT$/, " UTC");
  const headline = `An old ${escapeHtml(tenantName)} URL is about to stop working`;
  const dayLabel = daysUntilExpiry === 1 ? "1 day" : `${daysUntilExpiry} days`;

  const contentHtml = `              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
                After your workspace was renamed, links to the old URL kept working for 90 days. That window closes in <strong>${dayLabel}</strong> — once it does, anyone visiting the old URL will land on a "workspace not found" page.
              </p>

              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;width:100%">
                <tr>
                  <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:12px 16px">
                    <div style="font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Old URL — stops working ${escapeHtml(expiryFormatted)}</div>
                    <div style="font-size:14px;color:#92400e;word-break:break-all">${escapeHtml(oldUrl)}</div>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;width:100%">
                <tr>
                  <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px">
                    <div style="font-size:12px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Current URL — keep using this one</div>
                    <a href="${escapeHtml(currentUrl)}" style="font-size:14px;color:#166534;text-decoration:none;font-weight:500;word-break:break-all">${escapeHtml(currentUrl)}</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">
                What you can do:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#374151">
                <li>Forward this email to anyone who still uses the old URL so they update their bookmarks.</li>
                <li>Update emails, docs, and external links that point at the old URL.</li>
                <li>If you need more time, you can rename the workspace back to the old slug from Settings → General to refresh the redirect.</li>
              </ul>

              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(currentUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      Open ${escapeHtml(tenantName)} →
                    </a>
                  </td>
                </tr>
              </table>`;
  const fallbackHtml = buildLpEmailShell({
    headline,
    contentHtml,
    footerNote: `You're receiving this because you're an admin on ${tenantName}.`,
  });

  const tpl = await renderSystemEmail("slug_redirect_expiry", {
    headline,
    expiryIntro: `After your workspace was renamed, links to the old URL kept working for 90 days. That window closes in ${dayLabel} — once it does, anyone visiting the old URL will land on a "workspace not found" page.`,
    oldUrl,
    currentUrl,
    expiryFormatted,
    tenantName,
    ctaUrl: currentUrl,
    workspaceUrl: originOf(currentUrl),
    recipientEmail,
  }, payload.tenantId);
  const subject = tpl?.subject ?? `Heads up: an old ${tenantName} URL stops working in ${dayLabel}`;
  const html = tpl?.html ?? fallbackHtml;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        reply_to: platformReplyTo(),
        to: [recipientEmail],
        subject,
        html,
      }),
    });
    logger.info({ recipientEmail, tenantName, oldUrl, expiresAt: expiresAt.toISOString() }, "Slug redirect expiry warning sent");
    return true;
  } catch (err) {
    logger.error({ err, recipientEmail, oldUrl }, "Failed to send slug redirect expiry warning");
    return false;
  }
}

export interface PaymentFailedPayload {
  /** Every accepted workspace admin gets the same email. */
  recipientEmails: string[];
  /** Tenant whose brand-derived shell co-brands the email (Task #615). */
  tenantId?: number;
  tenantName: string;
  /** Link to the in-app Billing page where the card can be updated. */
  billingUrl: string;
  /** Stripe `attempt_count` for this invoice (1-based). */
  attemptCount: number;
  /** True once Stripe has exhausted its retries (no further attempt). */
  finalAttempt: boolean;
  /** Invoice amount due, in the smallest currency unit (e.g. cents). */
  amountDue: number | null;
  currency: string | null;
  /** Last 4 of the card on file, if known. */
  cardLast4?: string | null;
  fromEmail?: string;
}

/**
 * Dunning email — sent on every `invoice.payment_failed` Stripe event so a
 * tenant's workspace admins learn their renewal charge failed within minutes
 * and can fix the card before the subscription is cancelled.
 *
 * Returns true if Resend accepted the message, false otherwise (including
 * "no API key configured" / "no recipients").
 */
export async function sendPaymentFailedEmail(payload: PaymentFailedPayload): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping payment-failed email");
    return false;
  }
  const recipients = payload.recipientEmails.filter((e) => e && e.includes("@"));
  if (recipients.length === 0) {
    logger.warn({ tenantName: payload.tenantName }, "payment-failed email has no recipients — skipping");
    return false;
  }

  const { tenantName, billingUrl, attemptCount, finalAttempt, amountDue, currency, cardLast4 } = payload;
  // Per the slug-expiry precedent: always send from the verified platform
  // sender, never a per-tenant domain (most tenant domains aren't verified
  // with Resend, which would hard-bounce the one email that matters most).
  const fromAddress = platformFromAddress();

  const amountText =
    amountDue != null && currency
      ? (amountDue / 100).toLocaleString(undefined, {
          style: "currency",
          currency: currency.toUpperCase(),
          maximumFractionDigits: 2,
        })
      : null;
  const cardText = cardLast4 ? `the card ending in ${escapeHtml(cardLast4)}` : "your card on file";

  const headline = finalAttempt
    ? `Action needed: your ${escapeHtml(tenantName)} subscription payment failed`
    : `We couldn't process your ${escapeHtml(tenantName)} payment`;
  const intro = finalAttempt
    ? `We tried charging ${cardText}${amountText ? ` for ${amountText}` : ""} and the payment didn't go through. This was the final automatic attempt, so your paid plan has now been paused. Update your payment method to restore access.`
    : `We tried charging ${cardText}${amountText ? ` for ${amountText}` : ""} and it was declined. We'll retry automatically, but you can avoid any interruption by updating your payment method now.`;

  const contentHtml = `              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
                ${intro}
              </p>

              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;width:100%">
                <tr>
                  <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px">
                    <div style="font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Payment failed${attemptCount > 1 ? ` · attempt ${attemptCount}` : ""}</div>
                    <div style="font-size:14px;color:#991b1b">${amountText ? `${amountText} could not be charged to ${cardText}.` : `${cardText.charAt(0).toUpperCase()}${cardText.slice(1)} was declined.`}</div>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(billingUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      Update payment method →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6">
                Once your payment goes through, your plan stays active with no further action needed.
              </p>`;
  const fallbackHtml = buildLpEmailShell({
    headline,
    contentHtml,
    footerNote: `You're receiving this because you're an admin on ${tenantName}.`,
  });

  const fallbackSubject = finalAttempt
    ? `Your ${tenantName} subscription was paused — payment failed`
    : `Payment failed for ${tenantName} — update your card`;

  const alertLabel = `Payment failed${attemptCount > 1 ? ` · attempt ${attemptCount}` : ""}`;
  const alertText = amountText
    ? `${amountText} could not be charged to ${cardText}.`
    : `${cardText.charAt(0).toUpperCase()}${cardText.slice(1)} was declined.`;
  const tpl = await renderSystemEmail("payment_failed", {
    headline,
    dunningIntro: intro,
    alertLabel,
    alertText,
    tenantName,
    ctaUrl: billingUrl,
    workspaceUrl: originOf(billingUrl),
  }, payload.tenantId);
  const subject = tpl?.subject ?? fallbackSubject;
  const html = tpl?.html ?? fallbackHtml;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: payload.fromEmail ?? fromAddress,
        reply_to: platformReplyTo(),
        to: recipients,
        subject,
        html,
      }),
    });
    logger.info({ tenantName, recipients, attemptCount, finalAttempt }, "Payment-failed email sent");
    return true;
  } catch (err) {
    logger.error({ err, tenantName, recipients }, "Failed to send payment-failed email");
    return false;
  }
}

export interface LeadPayload {
  leadId: number;
  pageId: number;
  pageSlug: string;
  pageTitle: string;
  variantName?: string;
  fields: Record<string, unknown>;
  submittedAt: string;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
  };
}

export interface EmailRecipient {
  email: string;
}

export interface MarketoConfig {
  munchkinId: string;
  clientId: string;
  clientSecret: string;
  fieldMappings?: Record<string, string>;
}

export interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  instanceUrl: string;
  username?: string;
  password?: string;
  fieldMappings?: Record<string, string>;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryFetch(url: string, options: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  const delayMs = [0, 1000, 4000, 16000]; // delays: immediate, 1s, 4s, 16s for attempts 0-3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = delayMs[Math.min(attempt, delayMs.length - 1)];
      await sleep(delay);
    }
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function sendEmailNotification(
  recipients: string[],
  lead: LeadPayload,
  tenantId: number,
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping email notification");
    return;
  }
  if (recipients.length === 0) return;

  let subject = `New lead: ${lead.pageTitle}`;
  let html: string | null = null;

  // Tenant-scope render (Task #588): author-editable template + brand-derived
  // shell. Falls through to the legacy hardcoded HTML below on any failure so a
  // lead notification can never be dropped because of a template/shell error.
  if (tenantId != null) {
    try {
      const rendered = await renderTenantEmail({
        tenantId,
        key: "lead_notification",
        vars: {
          pageTitle: lead.pageTitle,
          submittedAt: new Date(lead.submittedAt).toLocaleString(),
        },
        rawSlots: {
          fieldsTable: buildLeadFieldsTable(lead.fields),
          variantNote: buildLeadVariantNote(lead.variantName),
        },
      });
      if (rendered) {
        subject = rendered.subject;
        html = rendered.html;
        logger.info(
          { leadId: lead.leadId, shellSource: rendered.shellSource },
          "lead notification rendered via tenant shell",
        );
      }
    } catch (err) {
      logger.error(
        { err, leadId: lead.leadId },
        "tenant lead notification render failed — using legacy fallback",
      );
    }
  }

  if (html == null) {
    // Brand-neutral last-resort layout (Task #624): when the tenant template
    // can't render, fall back to a vendor-agnostic email — NO LP Studio or
    // Dandy colors/wording — so a co-branded tenant never receives an email
    // stamped with the platform's (or another customer's) brand.
    const fieldRows = Object.entries(lead.fields)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0ede4;font-weight:600;white-space:nowrap;color:#374151">${escapeHtml(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #f0ede4;color:#4b5563">${escapeHtml(String(v ?? ""))}</td></tr>`)
      .join("");

    html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f1e8;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb">
    <h1 style="margin:0;color:#1f2937;font-size:20px;font-weight:700">New lead</h1>
    <p style="margin:4px 0 0;color:#6b7280;font-size:14px">${escapeHtml(lead.pageTitle)} · ${new Date(lead.submittedAt).toLocaleString()}</p>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tbody>${fieldRows}</tbody>
    </table>
    ${lead.variantName ? `<p style="margin-top:16px;font-size:12px;color:#9ca3af">Variant: ${escapeHtml(lead.variantName)}</p>` : ""}
  </div>
</div>
</body>
</html>`;
  }

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: platformFromAddress(),
        reply_to: platformReplyTo(),
        to: recipients,
        subject,
        html,
      }),
    });
    logger.info({ leadId: lead.leadId, recipients }, "Email notification sent");
  } catch (err) {
    logger.error({ err, leadId: lead.leadId }, "Failed to send email notification");
  }
}

export async function deliverWebhook(webhookUrl: string, lead: LeadPayload): Promise<void> {
  try {
    await retryFetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    logger.info({ leadId: lead.leadId, webhookUrl }, "Webhook delivered");
  } catch (err) {
    logger.error({ err, leadId: lead.leadId, webhookUrl }, "Webhook delivery failed after retries");
  }
}

const marketoTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getMarketoToken(munchkinId: string, clientId: string, clientSecret: string): Promise<string> {
  const cacheKey = `${munchkinId}:${clientId}`;
  const cached = marketoTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const url = `https://${munchkinId}.mktorest.com/identity/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Marketo auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  const token = data.access_token;
  marketoTokenCache.set(cacheKey, { token, expiresAt: Date.now() + data.expires_in * 1000 });
  return token;
}

export async function syncToMarketo(config: MarketoConfig, lead: LeadPayload): Promise<void> {
  try {
    const token = await getMarketoToken(config.munchkinId, config.clientId, config.clientSecret);
    const mappings = config.fieldMappings ?? {};
    const marketoFields: Record<string, unknown> = {};
    for (const [formField, value] of Object.entries(lead.fields)) {
      const marketoField = mappings[formField] ?? formField;
      marketoFields[marketoField] = value;
    }
    // Auto-inject UTM attribution from the URL when the form did not already
    // capture it. Marketo's createOrUpdate is all-or-nothing: a single
    // unrecognized field name causes the ENTIRE lead to be skipped (status
    // "skipped", no record created). So we must (a) match form submissions
    // case- and separator-insensitively (so "UTM Source" already covers
    // utm_source), and (b) refuse to inject a raw lowercase key like
    // "utm_source" when no mapping exists, since it is unlikely to be a valid
    // Marketo REST field name and would poison the whole sync.
    if (lead.utm) {
      const canon = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, "");
      const submittedCanonKeys = new Set(Object.keys(lead.fields).map(canon));
      const mappedTargets = new Set(Object.keys(marketoFields));
      const utmPairs: Array<[string, string | null | undefined]> = [
        ["utm_source",   lead.utm.source],
        ["utm_medium",   lead.utm.medium],
        ["utm_campaign", lead.utm.campaign],
        ["utm_term",     lead.utm.term],
        ["utm_content",  lead.utm.content],
      ];
      for (const [key, value] of utmPairs) {
        if (!value) continue;
        // Skip if the form already submitted any field whose label collapses
        // to the same canonical UTM key (e.g. "UTM Source" → "utmsource").
        if (submittedCanonKeys.has(canon(key))) continue;
        // Otherwise honor an explicit mapping for the URL-param key, if any.
        const explicit = mappings[key];
        if (explicit && !mappedTargets.has(explicit)) {
          marketoFields[explicit] = value;
        }
        // Intentionally do NOT inject the raw lowercase URL-param key as a
        // Marketo field name — it usually is not a valid REST field name and
        // would cause Marketo to skip the whole record.
      }
    }

    const sentFields = Object.keys(marketoFields);
    const res = await retryFetch(`https://${config.munchkinId}.mktorest.com/rest/v1/leads.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "createOrUpdate",
        lookupField: "email",
        input: [marketoFields],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Marketo leads API failed: ${res.status} ${text.slice(0, 500)}`);
    }
    // Marketo returns 200 OK even when the request itself failed at the API
    // level (errors[]) or when individual records were rejected (result[].reasons[]).
    // We must inspect the body to know whether the lead actually synced.
    const body = await res.json().catch(() => null) as {
      success?: boolean;
      requestId?: string;
      errors?: Array<{ code: string; message: string }>;
      result?: Array<{ id?: number; status?: string; reasons?: Array<{ code: string; message: string }> }>;
    } | null;
    if (!body || body.success === false) {
      logger.error({ leadId: lead.leadId, sentFields, body }, "Marketo API returned failure");
      return;
    }
    const record = body.result?.[0];
    const reasons = record?.reasons ?? [];
    if (reasons.length > 0) {
      logger.warn({ leadId: lead.leadId, marketoLeadId: record?.id, status: record?.status, sentFields, reasons }, "Marketo accepted lead but rejected some fields");
    } else {
      logger.info({ leadId: lead.leadId, marketoLeadId: record?.id, status: record?.status, sentFieldCount: sentFields.length }, "Lead synced to Marketo");
    }
  } catch (err) {
    logger.error({ err, leadId: lead.leadId }, "Failed to sync lead to Marketo");
  }
}

const sfTokenCache = new Map<string, { token: string; instanceUrl: string; expiresAt: number }>();

async function getSalesforceToken(config: SalesforceConfig): Promise<{ token: string; instanceUrl: string }> {
  const cacheKey = `${config.clientId}:${config.instanceUrl}`;
  const cached = sfTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return { token: cached.token, instanceUrl: cached.instanceUrl };

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(`${config.instanceUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Salesforce auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string; instance_url: string };
  sfTokenCache.set(cacheKey, { token: data.access_token, instanceUrl: data.instance_url, expiresAt: Date.now() + 3600_000 });
  return { token: data.access_token, instanceUrl: data.instance_url };
}

export async function syncToSalesforce(config: SalesforceConfig, lead: LeadPayload): Promise<void> {
  try {
    const { token, instanceUrl } = await getSalesforceToken(config);
    const mappings = config.fieldMappings ?? {};
    const sfFields: Record<string, unknown> = {};
    for (const [formField, value] of Object.entries(lead.fields)) {
      const sfField = mappings[formField] ?? formField;
      sfFields[sfField] = value;
    }

    const res = await retryFetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sfFields),
    });
    if (!res.ok) throw new Error(`Salesforce Lead create failed: ${res.status}`);
    logger.info({ leadId: lead.leadId }, "Lead synced to Salesforce");
  } catch (err) {
    logger.error({ err, leadId: lead.leadId }, "Failed to sync lead to Salesforce");
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Custom domain status notifications (task #415) ──────────────────────────

export interface CustomDomainActivePayload {
  recipientEmail: string;
  tenantName: string;
  hostname: string;          // e.g. pages.acme.com
  publishedUrl: string;      // https://pages.acme.com
}

export interface CustomDomainStuckPayload {
  recipientEmail: string;
  tenantName: string;
  hostname: string;          // e.g. pages.acme.com
  cnameTarget: string;       // e.g. lpstudio.ai
  settingsUrl: string;       // link back to Settings → Domain
  hoursPending: number;      // for the email body
}

/**
 * Returns true if Resend accepted the email. Callers use this to decide
 * whether to stamp `notified_active_at` — failures stay un-stamped so
 * the next poll retries.
 */
export async function sendCustomDomainActiveEmail(payload: CustomDomainActivePayload): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping custom domain active email");
    return false;
  }
  const { recipientEmail, tenantName, hostname, publishedUrl } = payload;
  const fromAddress = platformFromAddress();
  const headline = `${escapeHtml(hostname)} is live`;

  const contentHtml = `              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
                Your custom domain <strong>${escapeHtml(hostname)}</strong> is now serving traffic for <strong>${escapeHtml(tenantName)}</strong>. SSL is active and pages published on the new host load over HTTPS.
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(publishedUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      Open ${escapeHtml(hostname)} →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6">
                You can detach the domain anytime from Settings → Domain.
              </p>`;
  const html = buildLpEmailShell({
    headline,
    contentHtml,
    footerNote: `You're receiving this because you're an admin on ${tenantName}.`,
  });

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        reply_to: platformReplyTo(),
        to: [recipientEmail],
        subject: `${hostname} is live`,
        html,
      }),
    });
    logger.info({ recipientEmail, tenantName, hostname }, "Custom domain active email sent");
    return true;
  } catch (err) {
    logger.error({ err, recipientEmail, hostname }, "Failed to send custom domain active email");
    return false;
  }
}

/**
 * Returns true if Resend accepted the email. See sendCustomDomainActiveEmail
 * for the dedupe/idempotency contract.
 */
export async function sendCustomDomainStuckEmail(payload: CustomDomainStuckPayload): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping custom domain stuck email");
    return false;
  }
  const { recipientEmail, tenantName, hostname, cnameTarget, settingsUrl, hoursPending } = payload;
  const fromAddress = platformFromAddress();
  const headline = `${escapeHtml(hostname)} still needs DNS setup`;
  const hoursLabel = hoursPending === 1 ? "1 hour" : `${hoursPending} hours`;

  const contentHtml = `              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
                You attached <strong>${escapeHtml(hostname)}</strong> to <strong>${escapeHtml(tenantName)}</strong> about ${hoursLabel} ago, but Cloudflare still hasn't seen a valid DNS record for it. Until that's fixed, visitors to the URL won't reach your pages.
              </p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">
                The most common cause is a missing or incorrect CNAME at your DNS provider. Add this record:
              </p>
              <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:0 0 24px">
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px">
                  <tr style="background:#f9fafb;color:#6b7280">
                    <td style="padding:8px 12px;width:64px">Type</td>
                    <td style="padding:8px 12px">Name</td>
                    <td style="padding:8px 12px">Target</td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;color:#111827">
                    <td style="padding:8px 12px">CNAME</td>
                    <td style="padding:8px 12px;word-break:break-all">${escapeHtml(hostname)}</td>
                    <td style="padding:8px 12px;word-break:break-all">${escapeHtml(cnameTarget)}</td>
                  </tr>
                </table>
              </div>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(settingsUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      Open domain settings →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6">
                Once the CNAME propagates, SSL activates automatically and we'll send a follow-up to confirm.
              </p>`;
  const html = buildLpEmailShell({
    headline,
    contentHtml,
    footerNote: `You're receiving this because you're an admin on ${tenantName}.`,
  });

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        reply_to: platformReplyTo(),
        to: [recipientEmail],
        subject: `Action needed: ${hostname} still isn't pointing to LP Studio`,
        html,
      }),
    });
    logger.info({ recipientEmail, tenantName, hostname, hoursPending }, "Custom domain stuck email sent");
    return true;
  } catch (err) {
    logger.error({ err, recipientEmail, hostname }, "Failed to send custom domain stuck email");
    return false;
  }
}
