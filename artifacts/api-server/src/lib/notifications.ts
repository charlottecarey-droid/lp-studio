import { logger } from "./logger";

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
    ? `You've been invited to join ${escapeHtml(tenantName)}`
    : `You now have access to ${escapeHtml(tenantName)}`;
  const bodyText = isNewUser
    ? `${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(tenantName)}</strong> on LP Studio as a <strong>${escapeHtml(roleName)}</strong>. Create your account to get started.`
    : `${escapeHtml(inviterName)} has added you to <strong>${escapeHtml(tenantName)}</strong> on LP Studio as a <strong>${escapeHtml(roleName)}</strong>. Sign in to access your workspace.`;

  const html = `<!DOCTYPE html>
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
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%">

          <!-- Header -->
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

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 40px">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
                ${bodyText}
              </p>

              <!-- Role badge -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px">
                <tr>
                  <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 16px">
                    <span style="font-size:13px;color:#166534;font-weight:500">Workspace:</span>
                    <span style="font-size:13px;color:#166534;margin-left:6px">${escapeHtml(tenantName)}</span>
                    <span style="font-size:13px;color:#9ca3af;margin:0 6px">·</span>
                    <span style="font-size:13px;color:#166534;font-weight:500">Role:</span>
                    <span style="font-size:13px;color:#166534;margin-left:6px">${escapeHtml(roleName)}</span>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(signInUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      ${escapeHtml(actionLabel)} →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6">
                Sign in using the Google account associated with <strong style="color:#6b7280">${escapeHtml(inviteeEmail)}</strong>.
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8faf8;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
                You're receiving this because an admin at ${escapeHtml(tenantName)} added your email address.
                &nbsp;·&nbsp;
                <a href="${escapeHtml(signInUrl)}" style="color:#6b7280;text-decoration:underline">LP Studio</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subject = isNewUser
    ? `You've been invited to join ${tenantName} on LP Studio`
    : `You now have access to ${tenantName} on LP Studio`;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: invite.fromEmail ?? process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <noreply@lpstudio.ai>",
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

export interface WelcomePayload {
  recipientEmail: string;
  recipientName?: string | null;
  tenantName: string;
  workspaceUrl: string;
  fromEmail?: string;
}

export async function sendWelcomeEmail(welcome: WelcomePayload): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }

  const { recipientEmail, recipientName, tenantName, workspaceUrl } = welcome;
  const greetingName = (recipientName ?? "").trim().split(/\s+/)[0] || "there";
  const headline = `Welcome to ${escapeHtml(tenantName)} on LP Studio`;

  const html = `<!DOCTYPE html>
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
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%">
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
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
                Hi ${escapeHtml(greetingName)}, your workspace is ready. Bookmark this URL — it's how you and your teammates will sign back in:
              </p>

              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px">
                <tr>
                  <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px">
                    <a href="${escapeHtml(workspaceUrl)}" style="font-size:14px;color:#166534;text-decoration:none;font-weight:500;word-break:break-all">${escapeHtml(workspaceUrl)}</a>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(workspaceUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      Open my workspace →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6">
                Sign in using the Google account associated with <strong style="color:#6b7280">${escapeHtml(recipientEmail)}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8faf8;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
                You're receiving this because you just created the ${escapeHtml(tenantName)} workspace on LP Studio.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: welcome.fromEmail ?? process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <noreply@lpstudio.ai>",
        to: [recipientEmail],
        subject: `Welcome to ${tenantName} on LP Studio — your workspace URL`,
        html,
      }),
    });
    logger.info({ recipientEmail, tenantName, workspaceUrl }, "Welcome email sent");
  } catch (err) {
    logger.error({ err, recipientEmail }, "Failed to send welcome email");
  }
}

export interface SlugRedirectExpiryPayload {
  recipientEmail: string;
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
  const fromAddress = process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <noreply@lpstudio.ai>";
  const expiryFormatted = expiresAt.toUTCString().replace(/ GMT$/, " UTC");
  const headline = `An old ${escapeHtml(tenantName)} URL is about to stop working`;
  const dayLabel = daysUntilExpiry === 1 ? "1 day" : `${daysUntilExpiry} days`;

  const html = `<!DOCTYPE html>
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
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%">
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
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">
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
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8faf8;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
                You're receiving this because you're an admin on ${escapeHtml(tenantName)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        subject: `Heads up: an old ${tenantName} URL stops working in ${dayLabel}`,
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
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping email notification");
    return;
  }
  if (recipients.length === 0) return;

  const fieldRows = Object.entries(lead.fields)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;white-space:nowrap;color:#003A30">${escapeHtml(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#333">${escapeHtml(String(v ?? ""))}</td></tr>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">
  <div style="background:#003A30;padding:24px 32px">
    <h1 style="margin:0;color:#C7E738;font-size:20px">New Lead Submission</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:14px">${escapeHtml(lead.pageTitle)} · ${new Date(lead.submittedAt).toLocaleString()}</p>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tbody>${fieldRows}</tbody>
    </table>
    ${lead.variantName ? `<p style="margin-top:16px;font-size:12px;color:#94a3b8">Variant: ${escapeHtml(lead.variantName)}</p>` : ""}
  </div>
</div>
</body>
</html>`;

  try {
    await retryFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <notifications@ent.meetdandy.com>",
        to: recipients,
        subject: `New lead: ${lead.pageTitle}`,
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
