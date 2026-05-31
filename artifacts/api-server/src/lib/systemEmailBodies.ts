/**
 * Code-owned default BODIES for the transactional / auth system emails
 * (magic link, email verification, password reset, workspace invite, dunning,
 * slug-redirect expiry).
 *
 * These are the inner HTML of the branded master shell (wrapInShell = true) —
 * the shell supplies the head, header wordmark, and compliance footer. They are
 * seeded as the editable defaults of the matching `notification_templates`
 * rows; an operator can rewrite them in SuperAdmin while the dispatcher path
 * keeps a HARD code fallback (the original hardcoded emails) so a blank/broken
 * template can never break sign-in.
 *
 * Tokens use the canonical camelCase set + a few per-template tokens supplied by
 * the sender (e.g. {{expiryLabel}}, {{inviteBody}}, {{oldUrl}}). Values are
 * HTML-escaped on substitution, so the action URL ({{ctaUrl}}) is safe inside
 * an href and the "paste this link" line.
 */

const HEADLINE_STYLE =
  "margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;line-height:1.14;font-weight:800;letter-spacing:-0.03em;color:#1A1815;";
const INTRO_STYLE =
  "margin:20px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#2A2722;";
const SMALL_STYLE =
  "margin:18px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#5C5853;";
const PASTE_STYLE =
  "margin:14px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#8B857C;word-break:break-all;";

function headline(): string {
  return `<h1 style="${HEADLINE_STYLE}">{{headline}}</h1>`;
}

/** Dark CTA button linking to the action URL ({{ctaUrl}}). Label is trusted copy. */
function ctaButton(label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#1A1815;border-radius:6px;">
                    <a href="{{ctaUrl}}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.005em;color:#F6F2E9;text-decoration:none;border-radius:6px;">${label} →</a>
                  </td>
                </tr>
              </table>`;
}

/** Single-action auth email body (sign-in / verify / reset). */
function actionBody(opts: { intro: string; ctaLabel: string; expiryHtml: string }): string {
  return `${headline()}
              <p style="${INTRO_STYLE}">${opts.intro}</p>
              ${ctaButton(opts.ctaLabel)}
              <p style="${SMALL_STYLE}">${opts.expiryHtml}</p>
              <p style="${PASTE_STYLE}">Or paste this link into your browser:<br>{{ctaUrl}}</p>`;
}

export const MAGIC_LINK_BODY_HTML = actionBody({
  intro: "Click the button below to sign in to LP Studio. No password needed.",
  ctaLabel: "Sign in to LP Studio",
  expiryHtml:
    "This link expires in {{expiryLabel}} and can only be used once. If you didn't request it, you can safely ignore this email.",
});

export const EMAIL_VERIFICATION_BODY_HTML = actionBody({
  intro:
    "Welcome to LP Studio! Please confirm this is your email address to finish setting up your account.",
  ctaLabel: "Confirm email",
  expiryHtml:
    "This link expires in {{expiryLabel}}. If you didn't create an LP Studio account, you can safely ignore this email.",
});

export const PASSWORD_RESET_BODY_HTML = actionBody({
  intro:
    "We received a request to reset the password for your LP Studio account. Click below to choose a new one.",
  ctaLabel: "Reset password",
  expiryHtml:
    "This link expires in {{expiryLabel}} and can only be used once. If you didn't request a reset, you can safely ignore this email — your password won't change.",
});

/**
 * Workspace invite. The variable sentence ({{inviteBody}}) and CTA label
 * ({{ctaLabel}}) are supplied by the sender so one template covers both the
 * new-account and existing-user cases.
 */
export const WORKSPACE_INVITE_BODY_HTML = `${headline()}
              <p style="${INTRO_STYLE}">{{inviteBody}}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background:#F1ECE1;border:1px solid #E4DCCB;border-radius:6px;padding:10px 16px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#3A362F;">
                    <strong style="font-weight:600;">Workspace:</strong> {{tenantName}}
                    <span style="color:#B8B0A2;margin:0 6px;">·</span>
                    <strong style="font-weight:600;">Role:</strong> {{roleName}}
                  </td>
                </tr>
              </table>
              ${ctaButton("{{ctaLabel}}")}
              <p style="${SMALL_STYLE}">Sign in using the Google account associated with <strong style="color:#3A362F;">{{recipientEmail}}</strong>. If you weren't expecting this invitation, you can safely ignore this email.</p>`;

/**
 * Dunning (payment failed). {{dunningIntro}} and {{alertText}} carry the
 * attempt/amount-specific copy from the sender.
 */
export const PAYMENT_FAILED_BODY_HTML = `${headline()}
              <p style="${INTRO_STYLE}">{{dunningIntro}}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;width:100%;">
                <tr>
                  <td style="background:#FBEAE7;border:1px solid #F0C8C0;border-radius:6px;padding:12px 16px;">
                    <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#A23A28;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">{{alertLabel}}</div>
                    <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#A23A28;line-height:1.5;">{{alertText}}</div>
                  </td>
                </tr>
              </table>
              ${ctaButton("Update payment method")}
              <p style="${SMALL_STYLE}">Once your payment goes through, your plan stays active with no further action needed.</p>`;

/**
 * Slug-redirect expiry warning. {{expiryIntro}} carries the day-count sentence;
 * {{oldUrl}} / {{currentUrl}} / {{expiryFormatted}} are supplied by the sender.
 */
export const SLUG_REDIRECT_EXPIRY_BODY_HTML = `${headline()}
              <p style="${INTRO_STYLE}">{{expiryIntro}}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;width:100%;">
                <tr>
                  <td style="background:#FAF1DC;border:1px solid #ECDCAE;border-radius:6px;padding:12px 16px;">
                    <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#8A6A1E;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Old URL — stops working {{expiryFormatted}}</div>
                    <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#8A6A1E;word-break:break-all;">{{oldUrl}}</div>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;width:100%;">
                <tr>
                  <td style="background:#EAF3E7;border:1px solid #C5DEBC;border-radius:6px;padding:12px 16px;">
                    <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#3D6B2E;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Current URL — keep using this one</div>
                    <a href="{{currentUrl}}" style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#3D6B2E;text-decoration:none;font-weight:500;word-break:break-all;">{{currentUrl}}</a>
                  </td>
                </tr>
              </table>
              ${ctaButton("Open {{tenantName}}")}
              <p style="${SMALL_STYLE}">Tip: forward this to anyone still using the old URL, and update bookmarks, docs, and external links. Need more time? Rename the workspace back to the old slug in Settings → General to refresh the redirect.</p>`;
