import { logger } from "./logger";

export interface LeadPayload {
  leadId: number;
  pageId: number;
  pageSlug: string;
  pageTitle: string;
  variantName?: string;
  fields: Record<string, unknown>;
  submittedAt: string;
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
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(Math.pow(2, attempt - 1) * 1000);
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
        from: process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <notifications@send.ent.meetdandy.com>",
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
    if (!res.ok) throw new Error(`Marketo leads API failed: ${res.status}`);
    logger.info({ leadId: lead.leadId }, "Lead synced to Marketo");
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
