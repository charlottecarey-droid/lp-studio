import { pool } from "@workspace/db";
import { logger } from "./logger";
import { publishInAppNotification } from "./notificationStream";
import {
  getNotificationTemplate,
  type NotificationChannel,
  type NotificationTemplateDef,
} from "./notificationTemplates";

/**
 * Channel-aware notification dispatcher.
 *
 * One entry point, `dispatchNotification`, fans a single logical event out to
 * every recipient on every channel the (DB-overridable) template declares:
 *
 *   - in_app: INSERTs a `notification_sends` row with status='sent'. The row
 *     IS the inbox item — the bell/inbox reads these directly.
 *   - email:  claims a row (status='pending'), sends via Resend, then marks it
 *     'sent'. On send failure the claim row is DELETED so the next sweep can
 *     retry (transient provider errors must not permanently silence a nudge).
 *
 * Idempotency: every (recipient, channel) pair derives a `dedupe_key` from the
 * caller's `dedupeBase`. A UNIQUE(dedupe_key, channel) index means a second
 * dispatch for the same milestone/recipient is a no-op — safe under overlapping
 * sweeps, retries, and process restarts.
 *
 * Disabled templates short-circuit before any row is written, so flipping a
 * template off in SuperAdmin (and back on later) does not burn its dedupe slot.
 */

export interface NotificationRecipient {
  /** In-app target. Null for email-only recipients with no app_users row yet. */
  appUserId: number | null;
  email: string | null;
  name?: string | null;
}

export interface DispatchInput {
  templateKey: string;
  tenantId: number | null;
  recipients: NotificationRecipient[];
  /** Variables substituted into `{{...}}` placeholders. */
  context?: Record<string, string | number | null | undefined>;
  /** Stable per-event prefix, e.g. `trial_day_7:tenant:42`. */
  dedupeBase: string;
  /** Restrict to a subset of the template's channels (e.g. ['in_app']). */
  channels?: NotificationChannel[];
}

export interface DispatchResult {
  templateKey: string;
  skippedDisabled: boolean;
  inAppCreated: number;
  emailsSent: number;
  emailsFailed: number;
  deduped: number;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replace `{{key}}` placeholders. Values are coerced to strings. */
function render(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(context, key) ? context[key] : "",
  );
}

function normalizeContext(ctx: DispatchInput["context"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!ctx) return out;
  for (const [k, v] of Object.entries(ctx)) {
    if (v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

function recipientKey(r: NotificationRecipient): string | null {
  if (r.appUserId != null) return `u${r.appUserId}`;
  if (r.email) return `e:${r.email.trim().toLowerCase()}`;
  return null;
}

/**
 * Branded email wrapper, mirroring the LP Studio house style used by the other
 * Resend templates in `notifications.ts` (#003A30 header, #C7E738 CTA). The
 * intro paragraph and CTA are the operator-editable pieces; this frame is not.
 */
function renderEmailHtml(opts: {
  headline: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string | null;
}): string {
  const ctaBlock = opts.ctaUrl
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:8px">
                <tr>
                  <td style="background:#C7E738;border-radius:8px">
                    <a href="${escapeHtml(opts.ctaUrl)}" target="_blank"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#003A30;text-decoration:none;letter-spacing:-0.1px">
                      ${escapeHtml(opts.ctaLabel)}
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
  <title>${escapeHtml(opts.headline)}</title>
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
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;line-height:1.3">${escapeHtml(opts.headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 40px;border-radius:0 0 12px 12px">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151">
                ${escapeHtml(opts.intro)}
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

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("[notificationDispatcher] RESEND_API_KEY not set — skipping email");
    throw new Error("RESEND_API_KEY not configured");
  }
  const from = process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <noreply@lpstudio.ai>";
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (res.ok) return;
      // 4xx (except 429) are not retryable.
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
      }
      lastErr = new Error(`Resend ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Resend send failed");
}

interface RenderedContent {
  inAppTitle: string;
  inAppBody: string;
  emailSubject: string;
  emailIntro: string;
  emailCtaLabel: string;
}

function renderContent(tpl: NotificationTemplateDef, ctx: Record<string, string>): RenderedContent {
  return {
    inAppTitle: render(tpl.inAppTitle, ctx),
    inAppBody: render(tpl.inAppBody, ctx),
    emailSubject: render(tpl.emailSubject, ctx),
    emailIntro: render(tpl.emailIntro, ctx),
    emailCtaLabel: render(tpl.emailCtaLabel, ctx),
  };
}

async function dispatchInApp(
  input: DispatchInput,
  r: NotificationRecipient,
  rk: string,
  content: RenderedContent,
  ctx: Record<string, string>,
  result: DispatchResult,
): Promise<void> {
  if (r.appUserId == null) return; // no inbox target
  const appUserId = r.appUserId;
  const dedupeKey = `${input.dedupeBase}:${rk}`;
  const ctaUrl = ctx["workspaceUrl"] ?? null;
  try {
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO notification_sends
         (tenant_id, app_user_id, recipient_email, template_key, channel, status,
          title, body, cta_url, cta_label, dedupe_key, sent_at)
       VALUES ($1,$2,$3,$4,'in_app','sent',$5,$6,$7,$8,$9, now())
       ON CONFLICT (dedupe_key, channel) DO NOTHING
       RETURNING id`,
      [
        input.tenantId,
        r.appUserId,
        r.email ?? null,
        input.templateKey,
        content.inAppTitle,
        content.inAppBody,
        ctaUrl,
        ctaUrl ? content.emailCtaLabel : null,
        dedupeKey,
      ],
    );
    if (ins.rows.length) {
      result.inAppCreated += 1;
      // Push to any live SSE clients for this user so the bell updates without
      // waiting on the poll interval. Best-effort and in-process only — the
      // client's polling backstop covers misses (e.g. another replica). The
      // SSE channel is keyed by tenant, so a tenantless send has nowhere to go.
      if (input.tenantId != null) {
        publishInAppNotification(input.tenantId, appUserId, {
          id: ins.rows[0].id,
          templateKey: input.templateKey,
          title: content.inAppTitle,
          body: content.inAppBody,
          ctaUrl,
          ctaLabel: ctaUrl ? content.emailCtaLabel : null,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      result.deduped += 1;
    }
  } catch (err) {
    logger.error({ err, dedupeKey }, "[notificationDispatcher] in-app insert failed");
  }
}

async function dispatchEmail(
  input: DispatchInput,
  r: NotificationRecipient,
  rk: string,
  content: RenderedContent,
  ctx: Record<string, string>,
  result: DispatchResult,
): Promise<void> {
  if (!r.email) return;
  const dedupeKey = `${input.dedupeBase}:${rk}`;
  const ctaUrl = ctx["billingUrl"] ?? ctx["workspaceUrl"] ?? null;

  // Claim the dedupe slot first so concurrent sweeps can't double-send.
  let claimedId: number | null = null;
  try {
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO notification_sends
         (tenant_id, app_user_id, recipient_email, template_key, channel, status,
          subject, body, cta_url, cta_label, dedupe_key)
       VALUES ($1,$2,$3,$4,'email','pending',$5,$6,$7,$8,$9)
       ON CONFLICT (dedupe_key, channel) DO NOTHING
       RETURNING id`,
      [
        input.tenantId,
        r.appUserId,
        r.email,
        input.templateKey,
        content.emailSubject,
        content.emailIntro,
        ctaUrl,
        content.emailCtaLabel,
        dedupeKey,
      ],
    );
    if (!ins.rows.length) {
      result.deduped += 1;
      return; // already handled
    }
    claimedId = ins.rows[0].id;
  } catch (err) {
    logger.error({ err, dedupeKey }, "[notificationDispatcher] email claim failed");
    return;
  }

  try {
    const html = renderEmailHtml({
      headline: content.inAppTitle,
      intro: content.emailIntro,
      ctaLabel: content.emailCtaLabel,
      ctaUrl,
    });
    await sendEmail(r.email, content.emailSubject, html);
    await pool.query(
      `UPDATE notification_sends SET status='sent', sent_at=now() WHERE id=$1`,
      [claimedId],
    );
    result.emailsSent += 1;
  } catch (err) {
    // Delete the claim so a later sweep can retry this recipient/milestone.
    result.emailsFailed += 1;
    logger.error({ err, dedupeKey }, "[notificationDispatcher] email send failed — releasing claim");
    try {
      await pool.query(`DELETE FROM notification_sends WHERE id=$1`, [claimedId]);
    } catch (delErr) {
      logger.error({ delErr, claimedId }, "[notificationDispatcher] failed to release email claim");
    }
  }
}

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const result: DispatchResult = {
    templateKey: input.templateKey,
    skippedDisabled: false,
    inAppCreated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    deduped: 0,
  };

  const tpl = await getNotificationTemplate(input.templateKey);
  if (!tpl) {
    logger.warn({ templateKey: input.templateKey }, "[notificationDispatcher] unknown template");
    return result;
  }
  if (!tpl.enabled) {
    result.skippedDisabled = true;
    return result;
  }

  const ctx = normalizeContext(input.context);
  const content = renderContent(tpl, ctx);
  const activeChannels = (input.channels ?? tpl.channels).filter((c) => tpl.channels.includes(c));

  for (const r of input.recipients) {
    const rk = recipientKey(r);
    if (!rk) continue;
    for (const channel of activeChannels) {
      if (channel === "in_app") {
        await dispatchInApp(input, r, rk, content, ctx, result);
      } else if (channel === "email") {
        await dispatchEmail(input, r, rk, content, ctx, result);
      }
    }
  }

  return result;
}
