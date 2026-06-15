import { pool } from "@workspace/db";
import { logger } from "./logger";
import { publishInAppNotification } from "./notificationStream";
import {
  getNotificationTemplate,
  type NotificationChannel,
  type NotificationTemplateDef,
} from "./notificationTemplates";
import { expandEmailVars, renderEmail } from "./emailRender";
import { resolveEmailShellForEmail } from "./tenantEmailShell";
import { isOptedOut, makeUnsubscribeToken } from "./notificationPreferences";
import { recordWorkflowSendFailure, type SendFailureChannel } from "./workflowSendFailures";
import { platformFromAddress, platformReplyTo } from "./platformSender";

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
  /**
   * Workflow origin (Task #625). Present only when a workflow STEP drives this
   * dispatch; when set, a transient per-recipient send failure that would
   * otherwise be silently dropped is recorded in the workflow_send_failures
   * ledger so a superadmin can see and retry it. Generic (non-workflow)
   * callers — e.g. the trial sweep — leave it unset and keep today's behavior.
   */
  failureLedger?: { workflowId: number; stepId: string; enrollmentId: number | null };
}

export interface DispatchResult {
  templateKey: string;
  skippedDisabled: boolean;
  inAppCreated: number;
  inAppFailed: number;
  emailsSent: number;
  emailsFailed: number;
  /** Lifecycle emails skipped because the recipient opted out (Task #587). */
  emailsSuppressed: number;
  deduped: number;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Postgres error codes that signal a STRUCTURAL problem with the schema the
// dispatcher writes to: the target table (42P01 undefined_table) or a column
// (42703 undefined_column) does not exist. These mean a broken deployment — e.g.
// 0041_notifications.sql was silently skipped on a drifted DB — not a transient
// blip. They must NEVER be swallowed: a missing notification_sends table should
// fail loudly so the regression is caught, instead of the feature looking
// healthy while dropping every notification on the floor.
const STRUCTURAL_PG_ERROR_CODES = new Set(["42P01", "42703"]);

export function isStructuralDbError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && STRUCTURAL_PG_ERROR_CODES.has(code);
}

/**
 * Best-effort capture of a transient per-recipient send failure into the
 * workflow_send_failures ledger (Task #625). No-op unless this dispatch was
 * driven by a workflow STEP (input.failureLedger set). Never throws — the
 * underlying record call swallows its own errors so a failing safety-net can't
 * abort the rest of the send loop.
 */
async function captureWorkflowFailure(
  input: DispatchInput,
  r: NotificationRecipient,
  channel: SendFailureChannel,
  dedupeKey: string,
  ctx: Record<string, string>,
  err: unknown,
): Promise<void> {
  const origin = input.failureLedger;
  if (!origin) return;
  await recordWorkflowSendFailure({
    workflowId: origin.workflowId,
    enrollmentId: origin.enrollmentId,
    stepId: origin.stepId,
    tenantId: input.tenantId,
    appUserId: r.appUserId,
    recipientEmail: r.email,
    recipientName: r.name ?? null,
    channel,
    templateKey: input.templateKey,
    dedupeBase: input.dedupeBase,
    dedupeKey,
    context: ctx,
    error: err instanceof Error ? err.message : String(err),
  });
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  envelope?: { from?: string | null; replyTo?: string | null },
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("[notificationDispatcher] RESEND_API_KEY not set — skipping email");
    throw new Error("RESEND_API_KEY not configured");
  }
  // Per-template sender override wins; otherwise the verified platform default.
  const from = (envelope?.from && envelope.from.trim()) || platformFromAddress();
  const payload: Record<string, unknown> = { from, to, subject, html };
  // Explicit per-send reply-to wins; otherwise fall back to the platform default.
  const replyTo = (envelope?.replyTo && envelope.replyTo.trim()) || platformReplyTo();
  if (replyTo) {
    payload["reply_to"] = replyTo;
  }
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

/**
 * Build the one-click, host-bound unsubscribe URL for a lifecycle email's
 * footer. Returns null for system/transactional emails (never one-click
 * unsubscribable), recipients with no app_users row, tenantless sends, or when
 * no workspace URL is available — callers then fall back to the generic
 * "/settings/notifications" link that `expandEmailVars` supplies.
 */
function buildLifecycleUnsubUrl(
  tpl: NotificationTemplateDef,
  input: DispatchInput,
  r: NotificationRecipient,
  ctx: Record<string, string>,
): string | null {
  if (tpl.category !== "lifecycle") return null;
  if (r.appUserId == null || input.tenantId == null) return null;
  const workspaceUrl = ctx["workspaceUrl"];
  if (!workspaceUrl) return null;
  let host: string;
  try {
    host = new URL(workspaceUrl).host;
  } catch {
    return null;
  }
  if (!host) return null;
  const token = makeUnsubscribeToken(r.appUserId, input.tenantId, host);
  return `${workspaceUrl.replace(/\/+$/, "")}/api/notifications/unsubscribe?token=${token}`;
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
    result.inAppFailed += 1;
    logger.error({ err, dedupeKey }, "[notificationDispatcher] in-app insert failed");
    // A missing notification_sends table/column is a structural regression, not
    // a transient error — rethrow so the caller (and the trial sweep endpoint)
    // surfaces it loudly instead of returning a clean result while every
    // notification is silently dropped.
    if (isStructuralDbError(err)) throw err;
    // Transient drop: record it for retry if this dispatch came from a workflow.
    await captureWorkflowFailure(input, r, "in_app", dedupeKey, ctx, err);
  }
}

async function dispatchEmail(
  input: DispatchInput,
  tpl: NotificationTemplateDef,
  r: NotificationRecipient,
  rk: string,
  content: RenderedContent,
  ctx: Record<string, string>,
  result: DispatchResult,
): Promise<void> {
  if (!r.email) return;

  // Per-recipient email opt-out (Task #587). ONLY lifecycle-category emails are
  // ever suppressed — system/transactional emails (auth, billing) always send
  // and never consult the preference store. Checked before claiming the dedupe
  // slot so a suppressed recipient leaves no 'pending' row behind.
  if (tpl.category === "lifecycle" && r.appUserId != null && input.tenantId != null) {
    if (await isOptedOut(input.tenantId, r.appUserId, input.templateKey, "email")) {
      result.emailsSuppressed += 1;
      return;
    }
  }

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
    // Structural schema errors (missing table/column) are a deployment
    // regression — rethrow loudly rather than silently skipping the send.
    if (isStructuralDbError(err)) throw err;
    // Transient claim blip drops the recipient before any delivery — record it.
    result.emailsFailed += 1;
    await captureWorkflowFailure(input, r, "email", dedupeKey, ctx, err);
    return;
  }

  try {
    // Brandable account/lifecycle emails (slug-expiry, dunning) co-brand with
    // the tenant's own logo via the brand-derived shell; everything else (trial
    // nudges and any non-brandable key) renders in the platform LP Studio shell.
    // Resolves to the platform shell on any DB error, so a send never breaks.
    const { shell, source: shellSource, physicalAddress } = await resolveEmailShellForEmail({
      key: input.templateKey,
      tenantId: input.tenantId,
      wrapInShell: tpl.wrapInShell,
    });
    const firstName = (r.name ?? "").trim().split(/\s+/)[0] ?? "";
    const unsubscribeUrl = buildLifecycleUnsubUrl(tpl, input, r, ctx);
    // Inbox preview text: per-template override (token-substituted) wins;
    // otherwise the intro paragraph, matching today's behavior.
    const preheaderText = tpl.preheaderText ? render(tpl.preheaderText, ctx) : content.emailIntro;
    const html = renderEmail({
      shell,
      bodyHtml: tpl.bodyHtml,
      wrapInShell: tpl.wrapInShell,
      vars: expandEmailVars({
        ...ctx,
        recipientName: ctx["recipientName"] ?? firstName,
        recipientEmail: r.email,
        headline: content.inAppTitle,
        subject: content.emailSubject,
        preheaderText,
        ctaUrl: ctaUrl ?? "",
        // Tokenized one-click link for lifecycle emails; falls back to the
        // generic settings-page link in expandEmailVars when null.
        ...(unsubscribeUrl ? { unsubscribeUrl } : {}),
        // Co-branded (brandable) emails carry the tenant's own postal address in
        // the footer; non-brandable keys resolve "" → expandEmailVars default.
        ...(ctx["physicalAddress"] === undefined && physicalAddress
          ? { physicalAddress }
          : {}),
      }),
    });
    await sendEmail(r.email, content.emailSubject, html, {
      from: tpl.fromEmail,
      replyTo: tpl.replyTo,
    });
    await pool.query(
      `UPDATE notification_sends SET status='sent', sent_at=now() WHERE id=$1`,
      [claimedId],
    );
    result.emailsSent += 1;
    logger.info(
      { templateKey: input.templateKey, tenantId: input.tenantId, shellSource },
      "[notificationDispatcher] lifecycle email sent",
    );
  } catch (err) {
    // Delete the claim so a later sweep can retry this recipient/milestone.
    result.emailsFailed += 1;
    logger.error({ err, dedupeKey }, "[notificationDispatcher] email send failed — releasing claim");
    try {
      await pool.query(`DELETE FROM notification_sends WHERE id=$1`, [claimedId]);
    } catch (delErr) {
      logger.error({ delErr, claimedId }, "[notificationDispatcher] failed to release email claim");
    }
    // Durable trace of the dropped send for the superadmin retry queue.
    await captureWorkflowFailure(input, r, "email", dedupeKey, ctx, err);
  }
}

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const result: DispatchResult = {
    templateKey: input.templateKey,
    skippedDisabled: false,
    inAppCreated: 0,
    inAppFailed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    emailsSuppressed: 0,
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
        await dispatchEmail(input, tpl, r, rk, content, ctx, result);
      }
    }
  }

  return result;
}
