import { Router, type IRouter, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { pool } from "@workspace/db";
import {
  PLATFORM_NOTIFICATION_VARIABLES,
  TENANT_NOTIFICATION_VARIABLES,
  buildSampleVars,
} from "@workspace/notification-variables";
import { requireAuth, getTenantId, requirePermission, type AuthUser } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import {
  getTenantNotificationTemplates,
  getTenantNotificationTemplate,
  bustTenantNotificationTemplateCache,
  TENANT_NOTIFICATION_TEMPLATES,
} from "../lib/tenantNotificationTemplates";
import {
  resolveTenantShell,
  getTenantEmailShellOverrides,
  bustTenantEmailShellCache,
  ensureFooterAddress,
} from "../lib/tenantEmailShell";
import {
  buildLeadFieldsTable,
  buildLeadVariantNote,
  buildCommentCtaBlock,
  buildReviewCommentBlock,
} from "../lib/tenantEmailAssets";
import {
  getNotificationTemplates,
  getNotificationTemplate,
  bustNotificationTemplateCache,
  NOTIFICATION_TEMPLATES,
  type NotificationChannel,
} from "../lib/notificationTemplates";
import {
  listTriggers,
  getTrigger,
  upsertTrigger,
  deleteTrigger,
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from "../lib/workflowStore";
import { validateWorkflowDefinition, parseAudienceConfig, parseScheduledConfig } from "../lib/workflowTypes";
import { platformFromAddress, platformReplyTo } from "../lib/platformSender";
import { runWorkflowSweep, runWorkflowTick, retryWorkflowSendFailure } from "../lib/workflowEngine";
import { previewAudience } from "../lib/workflowAudience";
import { PLANS } from "@workspace/plan-config";
import { listWorkflowSendFailures } from "../lib/workflowSendFailures";
import {
  getEmailShell,
  getEmailShellOverrides,
  getPlatformPhysicalAddress,
  bustEmailShellCache,
  EMAIL_SHELL_ID,
} from "../lib/emailShell";
import { renderEmail, expandEmailVars, DEFAULT_EMAIL_SHELL } from "../lib/emailRender";
import { addStreamClient } from "../lib/notificationStream";
import {
  getOptOuts,
  setOptOut,
  unsubscribeAllLifecycleEmails,
  verifyUnsubscribeToken,
} from "../lib/notificationPreferences";
import {
  buildPreferenceGroups,
  groupMemberKeys,
  groupOptOutKey,
  isKnownPreferenceGroup,
  parseGroupOptOutKey,
} from "../lib/notificationPreferenceGroups";
import { getRequestHost } from "../lib/requestHost";
import {
  checkSenderDomain,
  getAllowedSenderDomains,
  type SenderDomainCheck,
} from "../lib/resendDomainStatus";

const router: IRouter = Router();

const INBOX_LIMIT = 50;

// Heartbeat keeps the SSE connection from being reaped by idle-timeout proxies
// (Cloudflare, the dev Vite proxy) and lets the client notice a dead link.
const SSE_HEARTBEAT_MS = 25_000;

/**
 * GET /api/notifications/stream — Server-Sent Events channel that pushes newly
 * created in-app notifications to the signed-in user in near-real-time, so the
 * bell badge updates without waiting on the polling interval. Scoped to the
 * active (user, tenant) pair exactly like the inbox endpoints. Clients fall
 * back to polling when this channel is unavailable (see use-notifications.ts).
 */
router.get("/notifications/stream", requireAuth, (req, res): void => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    // `no-transform` makes the compression middleware skip this response so
    // events aren't buffered; the rest disables proxy/browser caching.
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Flush headers immediately so the browser marks the EventSource as open.
  res.write(`retry: 5000\n\n`);
  res.write(`: connected\n\n`);

  const cleanup = addStreamClient(tenantId, user.userId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      /* connection gone; close handler will clean up */
    }
  }, SSE_HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    cleanup();
    res.end();
  });
});

// ---------------------------------------------------------------------------
// Email preferences (Task #587)
//
// One-click unsubscribe (PUBLIC, no session) + the signed-in user's per-email
// opt-out toggles. The unsubscribe token is stateless, host-bound and reusable,
// so it keeps working when an old email is clicked weeks later. Suppression ONLY
// ever applies to lifecycle-category emails — system/transactional emails (auth,
// billing) always send and have no working one-click link.
// ---------------------------------------------------------------------------

/** Branded confirmation/error page for the public unsubscribe route. */
function unsubPage(heading: string, message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F6F2E9}
.box{text-align:center;padding:48px;max-width:440px}h1{color:#1A1815;margin:0 0 12px;font-size:24px;letter-spacing:-0.02em}p{color:#5C5853;line-height:1.6;font-size:15px;margin:0}</style></head>
<body><div class="box"><h1>${heading}</h1><p>${message}</p></div></body></html>`;
}

/**
 * GET /api/notifications/unsubscribe?token=… — one-click unsubscribe from the
 * lifecycle-email footer. PUBLIC (no session): the recipient clicks straight
 * from their inbox. Opts the recipient out of ALL lifecycle emails; granular
 * re-subscribe lives on /settings/notifications. The host the token was minted
 * for is re-checked against the request host.
 */
router.get("/notifications/unsubscribe", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  // Use the canonical host resolver (honors the CF worker's X-Original-Host and
  // Replit's X-Forwarded-Host) so a token minted for the tenant's real host
  // verifies regardless of proxy hops.
  const host = getRequestHost(req);
  const claims = token ? verifyUnsubscribeToken(token, host) : null;
  if (!claims) {
    res
      .status(400)
      .type("html")
      .send(
        unsubPage(
          "Link no longer valid",
          "This unsubscribe link is invalid or has expired. You can manage your email preferences from Email preferences in your workspace settings.",
        ),
      );
    return;
  }
  try {
    await unsubscribeAllLifecycleEmails(claims.tenantId, claims.appUserId);
    res
      .status(200)
      .type("html")
      .send(
        unsubPage(
          "You've been unsubscribed",
          "You won't receive any more update emails. You can re-enable them anytime from Email preferences in your workspace settings.",
        ),
      );
  } catch (err) {
    console.error("[notifications] unsubscribe error:", err);
    res
      .status(500)
      .type("html")
      .send(
        unsubPage(
          "Something went wrong",
          "We couldn't process your request. Please try again, or manage your preferences from your workspace settings.",
        ),
      );
  }
});

/** Live lifecycle EMAIL template keys (code registry + operator-created rows). */
async function lifecycleEmailKeysLive(): Promise<string[]> {
  const all = await getNotificationTemplates();
  return all
    .filter((t) => t.category === "lifecycle" && t.channels.includes("email"))
    .map((t) => t.key);
}

/**
 * GET /api/notifications/preferences — the signed-in user's PERSONAL email
 * preferences, grouped into human-friendly categories (not raw internal
 * templates). Scoped to BOTH app_user_id and tenant_id. Account / security /
 * billing emails are transactional and never appear here — they always send.
 */
router.get("/notifications/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  try {
    const lifecycleEmailKeys = await lifecycleEmailKeysLive();
    const emailRows = (await getOptOuts(tenantId, user.userId)).filter(
      (o) => o.channel === "email",
    );
    const perTemplateOptedOut: string[] = [];
    const groupOptedOutIds: string[] = [];
    for (const o of emailRows) {
      const gid = parseGroupOptOutKey(o.templateKey);
      if (gid) groupOptedOutIds.push(gid);
      else perTemplateOptedOut.push(o.templateKey);
    }
    const groups = buildPreferenceGroups(
      lifecycleEmailKeys,
      perTemplateOptedOut,
      groupOptedOutIds,
    );
    res.json({ groups, recipientEmail: user.email });
  } catch (err) {
    console.error("[notifications] preferences get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /api/notifications/preferences { groupId, subscribed } — subscribe or
 * unsubscribe the signed-in user from a whole preference CATEGORY at once. Member
 * template keys are resolved from the live registry against a fixed, code-owned
 * group taxonomy, so the client can never name an arbitrary template — this can
 * never suppress a system/transactional email, and unknown groups are rejected.
 */
router.patch("/notifications/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  const b = req.body ?? {};
  const groupId = typeof b.groupId === "string" ? b.groupId : "";
  const subscribed = typeof b.subscribed === "boolean" ? b.subscribed : null;
  if (!groupId || subscribed === null) {
    res.status(400).json({ error: "groupId (string) and subscribed (boolean) are required" });
    return;
  }
  if (!isKnownPreferenceGroup(groupId)) {
    res.status(400).json({ error: "Unknown preference group" });
    return;
  }
  try {
    if (subscribed) {
      // Re-subscribe: clear the durable group opt-out AND any legacy per-template
      // rows (e.g. from one-click unsubscribe) so the category really turns back on.
      await setOptOut(tenantId, user.userId, groupOptOutKey(groupId), "email", false);
      const lifecycleEmailKeys = await lifecycleEmailKeysLive();
      for (const key of groupMemberKeys(groupId, lifecycleEmailKeys)) {
        await setOptOut(tenantId, user.userId, key, "email", false);
      }
    } else {
      // Unsubscribe the whole category durably — a single group-level row that
      // also covers templates added to this category later.
      await setOptOut(tenantId, user.userId, groupOptOutKey(groupId), "email", true);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[notifications] preferences patch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/notifications — the signed-in user's in-app inbox (most recent
 * first). Scoped to BOTH app_user_id and tenant_id so an operator who switches
 * tenants only sees the active tenant's items.
 */
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  try {
    const r = await pool.query(
      `SELECT id, template_key, title, body, cta_url, cta_label, read_at, created_at
         FROM notification_sends
        WHERE app_user_id = $1 AND tenant_id = $2 AND channel = 'in_app' AND status = 'sent'
        ORDER BY created_at DESC
        LIMIT $3`,
      [user.userId, tenantId, INBOX_LIMIT],
    );
    const items = r.rows.map((row) => ({
      id: row.id,
      templateKey: row.template_key,
      title: row.title,
      body: row.body,
      ctaUrl: row.cta_url,
      ctaLabel: row.cta_label,
      read: row.read_at != null,
      createdAt: row.created_at,
    }));
    res.json({ items });
  } catch (err) {
    console.error("[notifications] list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/notifications/unread-count — badge count for the bell. */
router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  try {
    const r = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM notification_sends
        WHERE app_user_id = $1 AND tenant_id = $2 AND channel = 'in_app'
          AND status = 'sent' AND read_at IS NULL`,
      [user.userId, tenantId],
    );
    res.json({ count: Number(r.rows[0]?.count ?? 0) });
  } catch (err) {
    console.error("[notifications] unread-count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/notifications/mark-read { ids: number[] } — mark specific items read. */
router.post("/notifications/mark-read", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  const rawIds = (req.body?.ids ?? []) as unknown;
  const ids = Array.isArray(rawIds)
    ? rawIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (!ids.length) {
    res.status(400).json({ error: "ids must be a non-empty array of integers" });
    return;
  }
  try {
    await pool.query(
      `UPDATE notification_sends SET read_at = now()
        WHERE app_user_id = $1 AND tenant_id = $2 AND channel = 'in_app'
          AND read_at IS NULL AND id = ANY($3::int[])`,
      [user.userId, tenantId, ids],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[notifications] mark-read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/notifications/mark-all-read — clear the whole inbox badge. */
router.post("/notifications/mark-all-read", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  try {
    await pool.query(
      `UPDATE notification_sends SET read_at = now()
        WHERE app_user_id = $1 AND tenant_id = $2 AND channel = 'in_app' AND read_at IS NULL`,
      [user.userId, tenantId],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[notifications] mark-all-read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------------------
// SuperAdmin email authoring. Mounted before adminRouter in routes/index.ts so
// these /admin paths resolve before adminRouter's blanket requireAuth wildcard
// can swallow them (same reason blockCatalog is).
//
// Every editor route is gated by requireSuperadmin (identity-based, 403 on a
// non-superadmin). Edits / resets / test-sends are appended to
// `email_template_edit_log` for attribution. The render pipeline (renderEmail +
// the shared shell) is the SAME one production sends use, so preview and
// test-send are faithful.
// ---------------------------------------------------------------------------

const VALID_CHANNELS: NotificationChannel[] = ["email", "in_app"];
// Short fields (subject/intro/labels) vs. long fields (free-form body / raw
// shell HTML) get different caps so a real HTML body isn't silently truncated.
const SHORT_MAX = 5000;
const LONG_MAX = 200_000;

const shortStr = (v: unknown): string | null =>
  v === undefined || v === null ? null : String(v).slice(0, SHORT_MAX);
const longStr = (v: unknown): string | null =>
  v === undefined || v === null ? null : String(v).slice(0, LONG_MAX);

/**
 * Validate an operator-supplied "from" / "reply-to" value. Accepts either a
 * bare address (`a@b.com`) or a display-name form (`Acme <a@b.com>`). Returns
 * the extracted address, or null when the string contains no plausible address.
 */
function extractEmailAddress(v: string): string | null {
  const angle = v.match(/<([^>]+)>\s*$/);
  const addr = (angle ? angle[1] : v).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? addr : null;
}

/**
 * Resolve an envelope override field (from_email / reply_to) from a request
 * body. A blank/absent value clears the override (null = use default); a present
 * value must look like a real email or the caller gets a 400. Returns
 * `{ value }` on success or `{ error }` for an invalid address.
 */
function envelopeOrNull(
  raw: unknown,
  label: string,
): { value: string | null } | { error: string } {
  if (raw === undefined || raw === null) return { value: null };
  const s = String(raw).trim();
  if (!s) return { value: null };
  if (!extractEmailAddress(s)) {
    return { error: `Enter a valid ${label} (an email address, optionally as "Name <email>").` };
  }
  return { value: s.slice(0, SHORT_MAX) };
}

/**
 * Build the human-readable error shown when a custom from-address uses a domain
 * that isn't a verified sending domain. Lists the allowed domains so the user
 * knows what they can pick (or to leave the field blank for the default).
 */
function senderDomainError(check: SenderDomainCheck): string {
  const allowed = check.allowedDomains.length
    ? check.allowedDomains.join(", ")
    : "none are verified yet";
  return (
    `The sender domain "${check.domain}" isn't a verified sending domain, so ` +
    `emails from it would fail to deliver or be rejected. Use an address on a ` +
    `verified domain (${allowed}), or leave the sender blank to use the ` +
    `platform default. Add and verify the domain in Resend to send from it.`
  );
}

/**
 * Resolve the inbox preheader (preview text) for a render. An operator override
 * wins; otherwise it falls back to the template's intro (today's behavior), with
 * `{{token}}` substitution applied so the preview matches delivery.
 */
function resolvePreheader(
  rawOverride: unknown,
  tpl: { emailIntro: string },
  vars: Record<string, string>,
): string {
  const override =
    typeof rawOverride === "string" && rawOverride.trim() ? rawOverride : null;
  return substitutePlain(override ?? tpl.emailIntro ?? "", vars);
}

/** Plain `{{key}}` substitution (NOT escaped) — for subject lines / logging. */
function substitutePlain(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : "",
  );
}

/** Sample substitution map for preview / test-send, with caller overrides. */
function buildPreviewVars(overrides?: unknown): Record<string, string> {
  const base = buildSampleVars(PLATFORM_NOTIFICATION_VARIABLES);
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      base[k] = String(v);
    }
  }
  return expandEmailVars(base);
}

/** Append an audit row. Best-effort: a logging failure must not fail the edit. */
async function writeEditLog(opts: {
  targetType: "template" | "shell" | "workflow" | "trigger";
  targetKey: string;
  editorEmail: string | null;
  action: "update" | "reset" | "test_send" | "create" | "delete";
  diff: unknown;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_template_edit_log (target_type, target_key, editor_email, action, diff)
       VALUES ($1,$2,$3,$4,$5)`,
      [opts.targetType, opts.targetKey, opts.editorEmail, opts.action, JSON.stringify(opts.diff ?? {})],
    );
  } catch (err) {
    console.error("[notifications] edit-log write failed:", err);
  }
}

/** Test-send cap: 10 per hour per superadmin (cost + abuse guard). */
const testSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request): string => {
    const u = (req as Request & { authUser?: AuthUser }).authUser;
    if (u?.userId != null) return `u:${u.userId}`;
    return `ip:${ipKeyGenerator(req.ip ?? "unknown", 56)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Test-send rate limit reached (10 per hour). Wait a bit and try again.",
    code: "rate_limited",
  },
});

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  envelope?: { from?: string | null; replyTo?: string | null },
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  // Operator-configured sender wins; otherwise the verified platform default.
  const from = (envelope?.from && envelope.from.trim()) || platformFromAddress();
  const payload: Record<string, unknown> = { from, to, subject, html };
  // Explicit per-send reply-to wins; otherwise fall back to the platform default.
  const replyTo = (envelope?.replyTo && envelope.replyTo.trim()) || platformReplyTo();
  if (replyTo) {
    payload["reply_to"] = replyTo;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  }
}

// --- Templates -------------------------------------------------------------

/** GET /api/admin/notification-templates — list (code defaults merged with DB overrides). */
router.get("/admin/notification-templates", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const templates = await getNotificationTemplates();
    res.json({ templates, variables: PLATFORM_NOTIFICATION_VARIABLES });
  } catch (err) {
    console.error("[notifications] template list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/sending-domains — the verified sending domains a custom
 * from-address may use. The editor renders these as the allowed set and warns
 * live when a typed domain isn't among them. `available: false` means the list
 * couldn't be determined (no Resend key / API down) — the editor then suppresses
 * the warning and the save guard fails open.
 */
router.get("/admin/sending-domains", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const { domains, available } = await getAllowedSenderDomains();
    res.json({ domains, available });
  } catch (err) {
    console.error("[notifications] admin sending-domains error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/admin/notification-templates/:key — one resolved template. */
router.get("/admin/notification-templates/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = String(req.params.key);
  try {
    const tpl = await getNotificationTemplate(key);
    if (!tpl) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    res.json({ template: tpl, variables: PLATFORM_NOTIFICATION_VARIABLES });
  } catch (err) {
    console.error("[notifications] template get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /api/admin/notification-templates/:key — upsert an override row.
 * Only editable fields are accepted; `key`/`category` are code-owned.
 */
router.patch("/admin/notification-templates/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = String(req.params.key);
  // Resolve the template so DB-only blank-slate templates (created via
  // POST /admin/notification-templates, no code counterpart) are editable too —
  // gating only on the code registry would 404 them and make them unsaveable in
  // the editor. `codeDef` stays the pure code def (or undefined for DB-only) so
  // the declared-channel subset rule below applies to code-owned templates only.
  const codeDef = NOTIFICATION_TEMPLATES[key];
  const def = codeDef ?? (await getNotificationTemplate(key));
  if (!def) {
    res.status(404).json({ error: "Unknown template" });
    return;
  }
  const b = req.body ?? {};

  // Validate channels if provided: always a subset of the valid channels. For a
  // code-owned template, also restrict to its declared channels (can't invent an
  // email channel for an in-app-only template like welcome). DB-only templates
  // have no code-declared subset, so any valid channel (email / in_app) is OK.
  let channels: NotificationChannel[] | undefined;
  if (b.channels !== undefined) {
    if (!Array.isArray(b.channels)) {
      res.status(400).json({ error: "channels must be an array" });
      return;
    }
    const filtered = (b.channels as unknown[]).filter((c): c is NotificationChannel =>
      VALID_CHANNELS.includes(c as NotificationChannel),
    );
    const unique = Array.from(new Set<NotificationChannel>(filtered));
    channels = codeDef ? unique.filter((c) => codeDef.channels.includes(c)) : unique;
  }

  const bodyMode =
    b.bodyMode === "html" ? "html" : b.bodyMode === "wysiwyg" ? "wysiwyg" : null;
  const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : null;
  const previewData =
    b.previewData && typeof b.previewData === "object" && !Array.isArray(b.previewData)
      ? JSON.stringify(b.previewData)
      : null;

  // Envelope overrides: blank = clear (use default), invalid = 400.
  const fromRes = envelopeOrNull(b.fromEmail, "sender / from address");
  if ("error" in fromRes) {
    res.status(400).json({ error: fromRes.error });
    return;
  }
  // A custom from-address must use a verified sending domain or real sends fail
  // silently. Fails open when the verified list can't be determined.
  if (fromRes.value) {
    const domainCheck = await checkSenderDomain(fromRes.value);
    if (!domainCheck.allowed) {
      res.status(400).json({ error: senderDomainError(domainCheck), code: "unverified_sender_domain" });
      return;
    }
  }
  const replyRes = envelopeOrNull(b.replyTo, "reply-to address");
  if ("error" in replyRes) {
    res.status(400).json({ error: replyRes.error });
    return;
  }
  const preheaderText = shortStr(b.preheaderText);

  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;

  try {
    await pool.query(
      `INSERT INTO notification_templates
         (key, name, description, category, channels,
          email_subject, email_intro, email_cta_label,
          from_email, reply_to, preheader_text, in_app_title, in_app_body,
          body_html, body_mode, wrap_in_shell, preview_data, enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
       ON CONFLICT (key) WHERE scope = 'platform' DO UPDATE SET
         channels        = COALESCE($5, notification_templates.channels),
         email_subject   = $6,
         email_intro     = $7,
         email_cta_label = $8,
         from_email      = $9,
         reply_to        = $10,
         preheader_text  = $11,
         in_app_title    = $12,
         in_app_body     = $13,
         body_html       = $14,
         body_mode       = $15,
         wrap_in_shell   = $16,
         preview_data    = $17::jsonb,
         enabled         = $18,
         updated_at      = now()`,
      [
        key,
        def.name,
        def.description,
        def.category,
        channels ? JSON.stringify(channels) : JSON.stringify(def.channels),
        shortStr(b.emailSubject),
        shortStr(b.emailIntro),
        shortStr(b.emailCtaLabel),
        fromRes.value,
        replyRes.value,
        preheaderText,
        shortStr(b.inAppTitle),
        shortStr(b.inAppBody),
        longStr(b.bodyHtml),
        bodyMode,
        wrapInShell,
        previewData,
        typeof b.enabled === "boolean" ? b.enabled : def.enabled,
      ],
    );
    bustNotificationTemplateCache();
    await writeEditLog({
      targetType: "template",
      targetKey: key,
      editorEmail,
      action: "update",
      diff: {
        fields: Object.keys(b).filter((f) => f !== "key" && f !== "category"),
      },
    });
    const templates = await getNotificationTemplates();
    res.json({ templates });
  } catch (err) {
    console.error("[notifications] template patch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/admin/notification-templates/:key/preview — render the (possibly
 * unsaved) body through the live shell with sample data. Returns the full HTML.
 */
router.post("/admin/notification-templates/:key/preview", requireSuperadmin, async (req, res): Promise<void> => {
  const key = String(req.params.key);
  const b = req.body ?? {};
  try {
    const tpl = await getNotificationTemplate(key);
    if (!tpl) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    const baseShell = await getEmailShell();
    const mergedPreview = { ...tpl.previewData, ...(b.previewData as object) };
    const physicalAddress = addressForPreview(mergedPreview, await getPlatformPhysicalAddress());
    // Mirror the live platform send: a saved custom footer that omits the token
    // still carries the address, and the footer token resolves to it.
    const shell = { ...baseShell, footerHtml: ensureFooterAddress(baseShell.footerHtml, physicalAddress) };
    const bodyHtml = typeof b.bodyHtml === "string" ? b.bodyHtml : tpl.bodyHtml;
    const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : tpl.wrapInShell;
    const vars = buildPreviewVars(mergedPreview);
    vars["physicalAddress"] = physicalAddress;
    vars["preheaderText"] = resolvePreheader(b.preheaderText, tpl, vars);
    const html = renderEmail({ shell, bodyHtml, wrapInShell, vars });
    const subject = substitutePlain(
      typeof b.emailSubject === "string" ? b.emailSubject : tpl.emailSubject,
      vars,
    );
    res.json({ html, subject });
  } catch (err) {
    console.error("[notifications] template preview error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/admin/notification-templates/:key/test-send — render and send the
 * template to the requesting superadmin's own email. Rate-limited to 10/hour.
 */
router.post(
  "/admin/notification-templates/:key/test-send",
  requireSuperadmin,
  testSendLimiter,
  async (req, res): Promise<void> => {
    const key = String(req.params.key);
    const b = req.body ?? {};
    const user = (req as Request & { authUser?: AuthUser }).authUser;
    // Optional recipient override; falls back to the requesting superadmin.
    const requested = typeof b.to === "string" ? b.to.trim() : "";
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requested);
    if (requested && !isEmail) {
      res.status(400).json({ error: "Enter a valid email address to send the test to." });
      return;
    }
    const to = requested || user?.email;
    if (!to) {
      res.status(400).json({ error: "Your account has no email address to send to." });
      return;
    }
    try {
      const tpl = await getNotificationTemplate(key);
      if (!tpl) {
        res.status(404).json({ error: "Unknown template" });
        return;
      }
      const baseShell = await getEmailShell();
      const mergedPreview = { ...tpl.previewData, ...(b.previewData as object) };
      const physicalAddress = addressForPreview(mergedPreview, await getPlatformPhysicalAddress());
      const shell = { ...baseShell, footerHtml: ensureFooterAddress(baseShell.footerHtml, physicalAddress) };
      const bodyHtml = typeof b.bodyHtml === "string" ? b.bodyHtml : tpl.bodyHtml;
      const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : tpl.wrapInShell;
      const vars = buildPreviewVars(mergedPreview);
      vars["physicalAddress"] = physicalAddress;
      vars["preheaderText"] = resolvePreheader(b.preheaderText, tpl, vars);
      const html = renderEmail({ shell, bodyHtml, wrapInShell, vars });
      const subject = `[Test] ${substitutePlain(
        typeof b.emailSubject === "string" ? b.emailSubject : tpl.emailSubject,
        vars,
      )}`;
      // Honor the (possibly unsaved) envelope overrides from the editor so the
      // test reflects exactly what delivery will look like; blank → env default.
      const fromOverride =
        typeof b.fromEmail === "string" && b.fromEmail.trim() ? b.fromEmail.trim() : tpl.fromEmail;
      const replyOverride =
        typeof b.replyTo === "string" && b.replyTo.trim() ? b.replyTo.trim() : tpl.replyTo;
      await sendViaResend(to, subject, html, { from: fromOverride, replyTo: replyOverride });
      // Attribute the action to the requesting superadmin (not the recipient,
      // which may be an override address) so the audit trail stays accurate.
      const editor = user?.email ?? to;
      await pool.query(
        `UPDATE notification_templates SET last_test_sent_at = now(), last_test_sent_by = $2 WHERE key = $1`,
        [key, editor],
      );
      await writeEditLog({
        targetType: "template",
        targetKey: key,
        editorEmail: editor,
        action: "test_send",
        diff: { sentTo: to },
      });
      res.json({ ok: true, sentTo: to });
    } catch (err) {
      console.error("[notifications] template test-send error:", err);
      res.status(502).json({ error: "Failed to send test email." });
    }
  },
);

// --- Shell -----------------------------------------------------------------

/** GET /api/admin/email-shell — overrides (nulls = using default) + code defaults. */
router.get("/admin/email-shell", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const overrides = await getEmailShellOverrides();
    res.json({ overrides, defaults: DEFAULT_EMAIL_SHELL });
  } catch (err) {
    console.error("[notifications] shell get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /api/admin/email-shell — upsert the singleton override row. A field set
 * to null clears that override (falls back to the code default = "restore").
 */
router.patch("/admin/email-shell", requireSuperadmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  const has = (f: string): boolean => Object.prototype.hasOwnProperty.call(b, f);
  try {
    await pool.query(
      `INSERT INTO email_shell_templates (id, shell_html, logo_html, header_bg, footer_html, physical_address, updated_at, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6, now(), $7)
       ON CONFLICT (id) DO UPDATE SET
         shell_html      = $2,
         logo_html       = $3,
         header_bg       = $4,
         footer_html     = $5,
         physical_address = $6,
         updated_at      = now(),
         updated_by      = $7`,
      [
        EMAIL_SHELL_ID,
        longStr(b.shellHtml),
        longStr(b.logoHtml),
        shortStr(b.headerBg),
        longStr(b.footerHtml),
        longStr(b.physicalAddress),
        editorEmail,
      ],
    );
    bustEmailShellCache();
    await writeEditLog({
      targetType: "shell",
      targetKey: EMAIL_SHELL_ID,
      editorEmail,
      action: "update",
      diff: { fields: ["shellHtml", "logoHtml", "headerBg", "footerHtml", "physicalAddress"].filter(has) },
    });
    const overrides = await getEmailShellOverrides();
    res.json({ overrides, defaults: DEFAULT_EMAIL_SHELL });
  } catch (err) {
    console.error("[notifications] shell patch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/admin/email-shell/preview — render a sample email through the
 * (possibly unsaved) shell so the operator sees the frame with real chrome.
 */
router.post("/admin/email-shell/preview", requireSuperadmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  try {
    // The draft address (if the editor passed one) wins; otherwise fall back to
    // the saved platform address so the preview matches a live send.
    const physicalAddress =
      typeof b.physicalAddress === "string"
        ? b.physicalAddress.trim()
        : await getPlatformPhysicalAddress();
    const footerDraft =
      typeof b.footerHtml === "string" ? b.footerHtml : DEFAULT_EMAIL_SHELL.footerHtml;
    const shell = {
      shellHtml: typeof b.shellHtml === "string" ? b.shellHtml : DEFAULT_EMAIL_SHELL.shellHtml,
      logoHtml: typeof b.logoHtml === "string" ? b.logoHtml : DEFAULT_EMAIL_SHELL.logoHtml,
      headerBg: typeof b.headerBg === "string" ? b.headerBg : DEFAULT_EMAIL_SHELL.headerBg,
      footerHtml: ensureFooterAddress(footerDraft, physicalAddress),
    };
    const sampleTpl = NOTIFICATION_TEMPLATES["trial_day_7"];
    const vars = buildPreviewVars();
    vars["physicalAddress"] = physicalAddress;
    const html = renderEmail({
      shell,
      bodyHtml: sampleTpl?.bodyHtml ?? "<p>Sample email body</p>",
      wrapInShell: true,
      vars,
    });
    res.json({ html });
  } catch (err) {
    console.error("[notifications] shell preview error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/admin/email-template-log — recent audit entries (most recent first). */
router.get("/admin/email-template-log", requireSuperadmin, async (req, res): Promise<void> => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  try {
    const r = await pool.query(
      `SELECT id, target_type, target_key, editor_email, action, diff, created_at
         FROM email_template_edit_log
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
    );
    res.json({ entries: r.rows });
  } catch (err) {
    console.error("[notifications] edit-log list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------------------
// SuperAdmin email-workflow composer (Task #589). Composable layer ABOVE the
// code-default dispatchNotification: blank-slate templates, triggers, and
// multi-step workflows. Platform scope only. Every route is requireSuperadmin
// (mounted before adminRouter, same as the authoring routes above). System and
// locked rows are protected by the store layer (delete/update guards), so these
// routes never need to special-case them.
// ---------------------------------------------------------------------------

const WORKFLOW_KEY_RE = /^[a-z0-9_]{2,64}$/;

/**
 * Reject a definition whose send steps reference a template that does not exist
 * (code-owned or DB blank-slate). Without this, an enabled workflow could be
 * saved that silently no-ops at dispatch time — defeating the hard-fallback
 * guarantee. Returns the first unknown templateKey, or null when all resolve.
 */
async function findUnknownTemplateKey(
  definition: { steps: { templateKey: string }[] },
): Promise<string | null> {
  for (const step of definition.steps) {
    if (step.templateKey && !(await getNotificationTemplate(step.templateKey))) {
      return step.templateKey;
    }
  }
  return null;
}

/** POST /api/admin/notification-templates — create a blank-slate DB-only
 * platform template (no code counterpart). Always `lifecycle`: `system` is
 * reserved for code-owned auth/billing templates and is rejected. */
router.post("/admin/notification-templates", requireSuperadmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  if (!WORKFLOW_KEY_RE.test(key)) {
    res.status(400).json({ error: "key must be 2-64 chars: lowercase letters, digits, underscore" });
    return;
  }
  if (NOTIFICATION_TEMPLATES[key]) {
    res.status(409).json({ error: "A code-owned template already uses that key" });
    return;
  }
  const name = shortStr(b.name) ?? key;
  let channels: NotificationChannel[] = ["email"];
  if (Array.isArray(b.channels)) {
    const filtered = (b.channels as unknown[]).filter((c): c is NotificationChannel =>
      VALID_CHANNELS.includes(c as NotificationChannel),
    );
    if (filtered.length) channels = Array.from(new Set(filtered));
  }
  const bodyMode = b.bodyMode === "html" ? "html" : "wysiwyg";
  const previewData =
    b.previewData && typeof b.previewData === "object" && !Array.isArray(b.previewData)
      ? JSON.stringify(b.previewData)
      : null;
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    const existing = await pool.query(
      `SELECT 1 FROM notification_templates WHERE key = $1 AND scope = 'platform'`,
      [key],
    );
    if ((existing.rowCount ?? 0) > 0) {
      res.status(409).json({ error: "A template with that key already exists" });
      return;
    }
    await pool.query(
      `INSERT INTO notification_templates
         (key, name, description, category, scope, channels,
          email_subject, email_intro, email_cta_label, in_app_title, in_app_body,
          body_html, body_mode, wrap_in_shell, preview_data, enabled, updated_at)
       VALUES ($1,$2,$3,'lifecycle','platform',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14, now())`,
      [
        key,
        name,
        shortStr(b.description) ?? "",
        JSON.stringify(channels),
        shortStr(b.emailSubject),
        shortStr(b.emailIntro),
        shortStr(b.emailCtaLabel),
        shortStr(b.inAppTitle),
        shortStr(b.inAppBody),
        longStr(b.bodyHtml),
        bodyMode,
        typeof b.wrapInShell === "boolean" ? b.wrapInShell : true,
        previewData,
        typeof b.enabled === "boolean" ? b.enabled : true,
      ],
    );
    bustNotificationTemplateCache();
    await writeEditLog({ targetType: "template", targetKey: key, editorEmail, action: "create", diff: { name } });
    const tpl = await getNotificationTemplate(key);
    res.status(201).json({ template: tpl });
  } catch (err) {
    console.error("[notifications] blank-template create error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Workflow triggers -----------------------------------------------------

/** GET /api/admin/email-workflow-triggers — all triggers (system first). */
router.get("/admin/email-workflow-triggers", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    res.json({ triggers: await listTriggers() });
  } catch (err) {
    console.error("[notifications] trigger list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/admin/email-workflow-triggers — create/update a non-system trigger. */
router.post("/admin/email-workflow-triggers", requireSuperadmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  if (!WORKFLOW_KEY_RE.test(key)) {
    res.status(400).json({ error: "key must be 2-64 chars: lowercase letters, digits, underscore" });
    return;
  }
  const triggerType = b.triggerType;
  if (triggerType !== "event" && triggerType !== "scheduled" && triggerType !== "audience") {
    res.status(400).json({ error: "triggerType must be event, scheduled, or audience" });
    return;
  }
  const eventKey =
    triggerType === "event"
      ? (typeof b.eventKey === "string" && b.eventKey.trim() ? b.eventKey.trim() : null)
      : null;
  if (triggerType === "event" && !eventKey) {
    res.status(400).json({ error: "an event trigger needs an eventKey" });
    return;
  }
  const config =
    b.config && typeof b.config === "object" && !Array.isArray(b.config)
      ? (b.config as Record<string, unknown>)
      : {};
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    const trigger = await upsertTrigger({
      key,
      name: shortStr(b.name) ?? key,
      description: shortStr(b.description) ?? "",
      triggerType,
      eventKey,
      config,
      enabled: typeof b.enabled === "boolean" ? b.enabled : true,
      updatedBy: editorEmail,
    });
    await writeEditLog({ targetType: "trigger", targetKey: key, editorEmail, action: "update", diff: { triggerType } });
    res.json({ trigger });
  } catch (err) {
    console.error("[notifications] trigger upsert error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /api/admin/email-workflow-triggers/:key — edit an existing non-system
 * trigger in place. Keeps the key and triggerType immutable (those identify the
 * trigger and bind it to its workflows); updates name + config (and eventKey for
 * event triggers). Scheduled/audience configs are revalidated via the producer's
 * own parsers so an edit can never store a config that would silently fail to
 * fire. Because the scheduled occurrence id is derived from the config at sweep
 * time, saving a new time/timezone recomputes future occurrences automatically.
 */
router.patch("/admin/email-workflow-triggers/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = String(req.params.key);
  let existing;
  try {
    existing = await getTrigger(key);
  } catch (err) {
    // A failed read is an operational error, not a missing trigger — surface it
    // as 500 rather than masking it as a 404 (which would wrongly tell the admin
    // the trigger no longer exists).
    console.error("[notifications] trigger read error:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Trigger not found" });
    return;
  }
  if (existing.is_system) {
    res.status(403).json({ error: "System triggers cannot be edited" });
    return;
  }
  const b = req.body ?? {};
  const triggerType = existing.trigger_type;
  const eventKey =
    triggerType === "event"
      ? (typeof b.eventKey === "string" && b.eventKey.trim() ? b.eventKey.trim() : existing.event_key)
      : null;
  if (triggerType === "event" && !eventKey) {
    res.status(400).json({ error: "an event trigger needs an eventKey" });
    return;
  }
  const rawConfig =
    b.config && typeof b.config === "object" && !Array.isArray(b.config)
      ? (b.config as Record<string, unknown>)
      : {};
  let config: Record<string, unknown> = {};
  if (triggerType === "scheduled") {
    const parsed = parseScheduledConfig(rawConfig);
    if (!parsed) {
      res.status(400).json({ error: "Invalid schedule: check audience, frequency, time, timezone, and day/date" });
      return;
    }
    config = parsed as unknown as Record<string, unknown>;
  } else if (triggerType === "audience") {
    const parsed = parseAudienceConfig(rawConfig);
    if (!parsed) {
      res.status(400).json({ error: "Invalid audience: a role is required" });
      return;
    }
    config = parsed as unknown as Record<string, unknown>;
  }
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    const trigger = await upsertTrigger({
      key,
      name: shortStr(b.name) ?? existing.name ?? key,
      description: shortStr(b.description) ?? existing.description ?? "",
      triggerType,
      eventKey,
      config,
      enabled: typeof b.enabled === "boolean" ? b.enabled : existing.enabled,
      updatedBy: editorEmail,
    });
    await writeEditLog({ targetType: "trigger", targetKey: key, editorEmail, action: "update", diff: { triggerType } });
    res.json({ trigger });
  } catch (err) {
    console.error("[notifications] trigger edit error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** DELETE /api/admin/email-workflow-triggers/:key — non-system only. */
router.delete("/admin/email-workflow-triggers/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = String(req.params.key);
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    const ok = await deleteTrigger(key);
    if (!ok) {
      res.status(404).json({ error: "Trigger not found or is system-protected" });
      return;
    }
    await writeEditLog({ targetType: "trigger", targetKey: key, editorEmail, action: "delete", diff: {} });
    res.json({ ok: true });
  } catch (err) {
    console.error("[notifications] trigger delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Workflows -------------------------------------------------------------

/** GET /api/admin/email-workflows — workflows + triggers + templates for the composer. */
router.get("/admin/email-workflows", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const [workflows, triggers, templates] = await Promise.all([
      listWorkflows(),
      listTriggers(),
      getNotificationTemplates(),
    ]);
    res.json({ workflows, triggers, templates });
  } catch (err) {
    console.error("[notifications] workflow list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/admin/email-workflows/:id — one workflow. */
router.get("/admin/email-workflows/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const wf = await getWorkflow(id);
    if (!wf) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json({ workflow: wf });
  } catch (err) {
    console.error("[notifications] workflow get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/admin/email-workflows — create a workflow. */
router.post("/admin/email-workflows", requireSuperadmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  if (!WORKFLOW_KEY_RE.test(key)) {
    res.status(400).json({ error: "key must be 2-64 chars: lowercase letters, digits, underscore" });
    return;
  }
  const triggerKey = typeof b.triggerKey === "string" ? b.triggerKey.trim() : "";
  if (!triggerKey) {
    res.status(400).json({ error: "triggerKey is required" });
    return;
  }
  const validated = validateWorkflowDefinition(b.definition);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    const unknownTpl = await findUnknownTemplateKey(validated.definition);
    if (unknownTpl) {
      res.status(400).json({ error: `Unknown template "${unknownTpl}"` });
      return;
    }
    const triggers = await listTriggers();
    if (!triggers.some((t) => t.key === triggerKey)) {
      res.status(400).json({ error: "Unknown triggerKey" });
      return;
    }
    const workflow = await createWorkflow({
      key,
      name: shortStr(b.name) ?? key,
      description: shortStr(b.description) ?? "",
      triggerKey,
      enabled: typeof b.enabled === "boolean" ? b.enabled : true,
      definition: validated.definition,
      updatedBy: editorEmail,
    });
    await writeEditLog({ targetType: "workflow", targetKey: key, editorEmail, action: "create", diff: { triggerKey } });
    res.status(201).json({ workflow });
  } catch (err: unknown) {
    // Unique-key collision surfaces as a 409 rather than a generic 500.
    if (err && typeof err === "object" && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A workflow with that key already exists" });
      return;
    }
    console.error("[notifications] workflow create error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** PATCH /api/admin/email-workflows/:id — update a non-locked workflow. */
router.patch("/admin/email-workflows/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const b = req.body ?? {};
  const updates: Parameters<typeof updateWorkflow>[1] = { updatedBy: (req as Request & { authUser?: AuthUser }).authUser?.email ?? null };
  if (b.name !== undefined) updates.name = shortStr(b.name) ?? "";
  if (b.description !== undefined) updates.description = shortStr(b.description) ?? "";
  if (b.triggerKey !== undefined) updates.triggerKey = String(b.triggerKey).trim();
  if (b.enabled !== undefined) updates.enabled = Boolean(b.enabled);
  if (b.definition !== undefined) {
    const validated = validateWorkflowDefinition(b.definition);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    updates.definition = validated.definition;
  }
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    if (updates.definition !== undefined) {
      const unknownTpl = await findUnknownTemplateKey(updates.definition);
      if (unknownTpl) {
        res.status(400).json({ error: `Unknown template "${unknownTpl}"` });
        return;
      }
    }
    if (updates.triggerKey !== undefined) {
      const triggers = await listTriggers();
      if (!triggers.some((t) => t.key === updates.triggerKey)) {
        res.status(400).json({ error: "Unknown triggerKey" });
        return;
      }
    }
    const workflow = await updateWorkflow(id, updates);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found, or it is locked (immutable)" });
      return;
    }
    await writeEditLog({ targetType: "workflow", targetKey: workflow.key, editorEmail, action: "update", diff: { fields: Object.keys(b) } });
    res.json({ workflow });
  } catch (err) {
    console.error("[notifications] workflow patch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** DELETE /api/admin/email-workflows/:id — non-system, non-locked only. */
router.delete("/admin/email-workflows/:id", requireSuperadmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
  try {
    const ok = await deleteWorkflow(id);
    if (!ok) {
      res.status(404).json({ error: "Workflow not found, or it is system/locked (protected)" });
      return;
    }
    await writeEditLog({ targetType: "workflow", targetKey: String(id), editorEmail, action: "delete", diff: {} });
    res.json({ ok: true });
  } catch (err) {
    console.error("[notifications] workflow delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/admin/email-workflows/sweep — manually run a full scheduler tick
 * once (scheduled + audience producers, then the engine sweep) so superadmins
 * can test scheduled/audience/delayed steps without waiting for the boot timer. */
router.post("/admin/email-workflows/sweep", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const result = await runWorkflowTick();
    res.json(result);
  } catch (err) {
    console.error("[notifications] manual sweep error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/admin/email-workflow-audience/preview — resolve a scheduled/audience
 * role filter to a live recipient count + small sample, for the composer UI. */
router.post("/admin/email-workflow-audience/preview", requireSuperadmin, async (req, res): Promise<void> => {
  const config = parseAudienceConfig(req.body ?? {});
  if (!config) {
    res.status(400).json({ error: "role must be one of: everyone, superadmin, admin, member" });
    return;
  }
  try {
    const preview = await previewAudience(config);
    res.json(preview);
  } catch (err) {
    console.error("[notifications] audience preview error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/email-workflow-audience/options — picker data for the audience
 * composer: the canonical plan tiers, every workspace (id/name/slug), and the
 * distinct tenant-role names that exist across all workspaces (so admins can
 * target by plan, by workspace, or by specific role names).
 */
router.get("/admin/email-workflow-audience/options", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const [tenants, roleNames] = await Promise.all([
      pool.query<{ id: number; name: string; slug: string }>(
        `SELECT id, name, slug FROM tenants ORDER BY name ASC`,
      ),
      pool.query<{ name: string }>(
        `SELECT DISTINCT name FROM tenant_roles ORDER BY name ASC`,
      ),
    ]);
    res.json({
      plans: PLANS,
      tenants: tenants.rows,
      roleNames: roleNames.rows.map((r) => r.name),
    });
  } catch (err) {
    console.error("[notifications] audience options error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/workflow-send-failures — the recipient-failure safety-net queue
 * (Task #625). Unresolved failures by default; `?resolved=true` for the cleared
 * history.
 */
router.get("/admin/workflow-send-failures", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const resolvedParam = typeof req.query["resolved"] === "string" ? req.query["resolved"] : undefined;
    const opts =
      resolvedParam === "true"
        ? { resolved: true }
        : resolvedParam === "false"
          ? { resolved: false }
          : {};
    const failures = await listWorkflowSendFailures(opts);
    res.json({ failures });
  } catch (err) {
    console.error("[notifications] workflow send-failures list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/admin/workflow-send-failures/:id/retry — re-attempt one failed send.
 * Reuses the original dedupe key, so a recipient who already received the email
 * is never sent a second copy (the attempt resolves as a deduped no-op).
 */
router.post(
  "/admin/workflow-send-failures/:id/retry",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
    try {
      const result = await retryWorkflowSendFailure(id);
      if (result.outcome === "not_found") {
        res.status(404).json({ error: "Failure not found" });
        return;
      }
      await writeEditLog({
        targetType: "workflow",
        targetKey: `send-failure:${id}`,
        editorEmail,
        action: "update",
        diff: { retry: result.outcome },
      });
      res.json(result);
    } catch (err) {
      console.error("[notifications] workflow send-failure retry error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// Tenant email authoring (Task #588). The tenant-admin mirror of the SuperAdmin
// authoring routes above. Every route is gated by requireAuth +
// requirePermission("settings") and is scoped to the caller's ACTIVE tenant via
// getTenantId — the tenant is NEVER taken from a request param/body, so a tenant
// admin can only ever read/write their own templates & shell. A superadmin can
// act on another tenant only through the audited X-Tenant-Id override that
// getTenantId already enforces.
// ---------------------------------------------------------------------------

/**
 * Pick the `{{physicalAddress}}` value a tenant preview/test-send should show.
 * An explicit preview-data override wins (so the editor can experiment); otherwise
 * the tenant's REAL saved address is used so the preview matches a live send. An
 * unset saved address resolves to "" → the footer omits the line cleanly.
 */
function addressForPreview(previewData: unknown, savedAddress: string): string {
  if (previewData && typeof previewData === "object" && !Array.isArray(previewData)) {
    const v = (previewData as Record<string, unknown>)["physicalAddress"];
    if (v !== null && v !== undefined) return String(v);
  }
  return savedAddress;
}

/** Sample substitution map for tenant preview / test-send, with overrides. */
function buildTenantPreviewVars(overrides?: unknown): Record<string, string> {
  const base = buildSampleVars(TENANT_NOTIFICATION_VARIABLES);
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      base[k] = String(v);
    }
  }
  return expandEmailVars(base);
}

/**
 * Sample raw-slot HTML per tenant template key so a preview/test-send renders
 * the dynamic markup (field table, CTA, etc.) faithfully instead of leaving a
 * literal `{{fieldsTable}}` token in the output.
 */
function sampleTenantRawSlots(key: string): Record<string, string> {
  switch (key) {
    case "lead_notification":
      return {
        fieldsTable: buildLeadFieldsTable({
          Name: "Jordan Avery",
          Email: "jordan@example.com",
          Company: "Northwind Labs",
        }),
        variantNote: buildLeadVariantNote("Variant A"),
      };
    case "comment":
      return { ctaBlock: buildCommentCtaBlock("https://example.com/page") };
    case "review_decision":
      return {
        commentBlock: buildReviewCommentBlock(
          "Looks great — just tighten the hero copy and ship it.",
          "#16a34a",
        ),
      };
    case "form_followup":
      return {
        content:
          "<p style=\"margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.62;color:#2A2722;\">Thanks for reaching out — a member of our team will follow up shortly.</p>",
      };
    default:
      return {};
  }
}

// --- Tenant templates ------------------------------------------------------

/** GET /api/tenant/notification-templates — this tenant's templates (defaults + overrides). */
router.get(
  "/tenant/notification-templates",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    try {
      const templates = await getTenantNotificationTemplates(tenantId);
      const { source } = await resolveTenantShell(tenantId);
      res.json({ templates, variables: TENANT_NOTIFICATION_VARIABLES, shellSource: source });
    } catch (err) {
      console.error("[notifications] tenant template list error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/**
 * GET /api/tenant/sending-domains — verified sending domains a tenant's custom
 * from-address may use (account-wide verified domains + the platform default).
 * Mirrors the admin route; powers the editor's live warning and allowed-set hint.
 */
router.get(
  "/tenant/sending-domains",
  requireAuth,
  requirePermission("settings"),
  async (_req, res): Promise<void> => {
    try {
      const { domains, available } = await getAllowedSenderDomains();
      res.json({ domains, available });
    } catch (err) {
      console.error("[notifications] tenant sending-domains error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/** GET /api/tenant/notification-templates/:key — one resolved tenant template. */
router.get(
  "/tenant/notification-templates/:key",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const key = String(req.params.key);
    if (!TENANT_NOTIFICATION_TEMPLATES[key]) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    try {
      const tpl = await getTenantNotificationTemplate(tenantId, key);
      res.json({ template: tpl, variables: TENANT_NOTIFICATION_VARIABLES });
    } catch (err) {
      console.error("[notifications] tenant template get error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/**
 * PATCH /api/tenant/notification-templates/:key — upsert this tenant's override
 * row (scope='tenant', tenant_id = active tenant). `key`/`name`/`category` are
 * code-owned; only the authoring fields are accepted.
 */
router.patch(
  "/tenant/notification-templates/:key",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const key = String(req.params.key);
    const def = TENANT_NOTIFICATION_TEMPLATES[key];
    if (!def) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    const b = req.body ?? {};
    const bodyMode = b.bodyMode === "html" ? "html" : b.bodyMode === "wysiwyg" ? "wysiwyg" : null;
    const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : null;
    const previewData =
      b.previewData && typeof b.previewData === "object" && !Array.isArray(b.previewData)
        ? JSON.stringify(b.previewData)
        : null;

    // Envelope overrides: blank = clear (use default), invalid = 400.
    const fromRes = envelopeOrNull(b.fromEmail, "sender / from address");
    if ("error" in fromRes) {
      res.status(400).json({ error: fromRes.error });
      return;
    }
    // A custom from-address must use a verified sending domain or real sends
    // fail silently. Fails open when the verified list can't be determined.
    if (fromRes.value) {
      const domainCheck = await checkSenderDomain(fromRes.value);
      if (!domainCheck.allowed) {
        res.status(400).json({ error: senderDomainError(domainCheck), code: "unverified_sender_domain" });
        return;
      }
    }
    const replyRes = envelopeOrNull(b.replyTo, "reply-to address");
    if ("error" in replyRes) {
      res.status(400).json({ error: replyRes.error });
      return;
    }
    const preheaderText = shortStr(b.preheaderText);

    const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
    try {
      await pool.query(
        `INSERT INTO notification_templates
           (key, name, description, category, channels, scope, tenant_id,
            email_subject, email_intro, email_cta_label,
            from_email, reply_to, preheader_text, in_app_title, in_app_body,
            body_html, body_mode, wrap_in_shell, preview_data, enabled, updated_at)
         VALUES ($1,$2,$3,$4,$5,'tenant',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now())
         ON CONFLICT (tenant_id, key) WHERE scope = 'tenant' DO UPDATE SET
           email_subject   = $7,
           email_intro     = $8,
           email_cta_label = $9,
           from_email      = $10,
           reply_to        = $11,
           preheader_text  = $12,
           in_app_title    = $13,
           in_app_body     = $14,
           body_html       = $15,
           body_mode       = $16,
           wrap_in_shell   = $17,
           preview_data    = $18::jsonb,
           enabled         = $19,
           updated_at      = now()`,
        [
          key,
          def.name,
          def.description,
          def.category,
          JSON.stringify(def.channels),
          tenantId,
          shortStr(b.emailSubject),
          shortStr(b.emailIntro),
          shortStr(b.emailCtaLabel),
          fromRes.value,
          replyRes.value,
          preheaderText,
          shortStr(b.inAppTitle),
          shortStr(b.inAppBody),
          longStr(b.bodyHtml),
          bodyMode,
          wrapInShell,
          previewData,
          typeof b.enabled === "boolean" ? b.enabled : def.enabled,
        ],
      );
      bustTenantNotificationTemplateCache(tenantId);
      await writeEditLog({
        targetType: "template",
        targetKey: `tenant:${tenantId}:${key}`,
        editorEmail,
        action: "update",
        diff: { fields: Object.keys(b).filter((f) => f !== "key" && f !== "category") },
      });
      const templates = await getTenantNotificationTemplates(tenantId);
      res.json({ templates });
    } catch (err) {
      console.error("[notifications] tenant template patch error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/** POST /api/tenant/notification-templates/:key/preview — render through this tenant's shell. */
router.post(
  "/tenant/notification-templates/:key/preview",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const key = String(req.params.key);
    if (!TENANT_NOTIFICATION_TEMPLATES[key]) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    const b = req.body ?? {};
    try {
      const tpl = await getTenantNotificationTemplate(tenantId, key);
      const { shell, physicalAddress } = await resolveTenantShell(tenantId);
      const bodyHtml = typeof b.bodyHtml === "string" ? b.bodyHtml : tpl.bodyHtml;
      const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : tpl.wrapInShell;
      const previewData = { ...tpl.previewData, ...(b.previewData as object) };
      const vars = buildTenantPreviewVars(previewData);
      // Reflect the tenant's REAL saved address in the preview footer (so what the
      // admin sees matches what recipients get), unless preview data overrode it.
      vars["physicalAddress"] = addressForPreview(previewData, physicalAddress);
      vars["preheaderText"] = resolvePreheader(b.preheaderText, tpl, vars);
      const html = renderEmail({
        shell,
        bodyHtml,
        wrapInShell,
        vars,
        rawSlots: sampleTenantRawSlots(key),
      });
      const subject = substitutePlain(
        typeof b.emailSubject === "string" ? b.emailSubject : tpl.emailSubject,
        vars,
      );
      res.json({ html, subject });
    } catch (err) {
      console.error("[notifications] tenant template preview error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/** POST /api/tenant/notification-templates/:key/test-send — send to the requester. Rate-limited. */
router.post(
  "/tenant/notification-templates/:key/test-send",
  requireAuth,
  requirePermission("settings"),
  testSendLimiter,
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const key = String(req.params.key);
    if (!TENANT_NOTIFICATION_TEMPLATES[key]) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    const b = req.body ?? {};
    const user = (req as Request & { authUser?: AuthUser }).authUser;
    const requested = typeof b.to === "string" ? b.to.trim() : "";
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requested);
    if (requested && !isEmail) {
      res.status(400).json({ error: "Enter a valid email address to send the test to." });
      return;
    }
    const to = requested || user?.email;
    if (!to) {
      res.status(400).json({ error: "Your account has no email address to send to." });
      return;
    }
    try {
      const tpl = await getTenantNotificationTemplate(tenantId, key);
      const { shell, physicalAddress } = await resolveTenantShell(tenantId);
      const bodyHtml = typeof b.bodyHtml === "string" ? b.bodyHtml : tpl.bodyHtml;
      const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : tpl.wrapInShell;
      const previewData = { ...tpl.previewData, ...(b.previewData as object) };
      const vars = buildTenantPreviewVars(previewData);
      vars["physicalAddress"] = addressForPreview(previewData, physicalAddress);
      vars["preheaderText"] = resolvePreheader(b.preheaderText, tpl, vars);
      const html = renderEmail({
        shell,
        bodyHtml,
        wrapInShell,
        vars,
        rawSlots: sampleTenantRawSlots(key),
      });
      const subject = `[Test] ${substitutePlain(
        typeof b.emailSubject === "string" ? b.emailSubject : tpl.emailSubject,
        vars,
      )}`;
      // Honor the (possibly unsaved) envelope overrides so the test reflects
      // exactly what delivery will look like; blank → env default.
      const fromOverride =
        typeof b.fromEmail === "string" && b.fromEmail.trim() ? b.fromEmail.trim() : tpl.fromEmail;
      const replyOverride =
        typeof b.replyTo === "string" && b.replyTo.trim() ? b.replyTo.trim() : tpl.replyTo;
      await sendViaResend(to, subject, html, { from: fromOverride, replyTo: replyOverride });
      // Metadata-only audit: the actor is the tenant admin; the recipient
      // address (PII) is deliberately NOT recorded in this multi-tenant log.
      await writeEditLog({
        targetType: "template",
        targetKey: `tenant:${tenantId}:${key}`,
        editorEmail: user?.email ?? null,
        action: "test_send",
        diff: { customRecipient: !!requested },
      });
      res.json({ ok: true, sentTo: to });
    } catch (err) {
      console.error("[notifications] tenant template test-send error:", err);
      res.status(502).json({ error: "Failed to send test email." });
    }
  },
);

// --- Tenant shell ----------------------------------------------------------

/** GET /api/tenant/email-shell — this tenant's overrides + brand-derived defaults. */
router.get(
  "/tenant/email-shell",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    try {
      const { overrides, derived } = await getTenantEmailShellOverrides(tenantId);
      res.json({ overrides, defaults: derived });
    } catch (err) {
      console.error("[notifications] tenant shell get error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/**
 * PATCH /api/tenant/email-shell — upsert this tenant's shell row. A null field
 * clears that override (falls back to the brand-derived value).
 */
router.patch(
  "/tenant/email-shell",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const b = req.body ?? {};
    const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;
    const has = (f: string): boolean => Object.prototype.hasOwnProperty.call(b, f);
    try {
      // Self-serve invite-branding override (default OFF): store a real boolean
      // (null = off) so a truthy read is safe. Absent in the body → null (off),
      // matching how the text overrides clear when omitted; the editor always
      // sends the full draft.
      const brandInviteEmails =
        typeof b.brandInviteEmails === "boolean" ? b.brandInviteEmails : null;
      await pool.query(
        `INSERT INTO tenant_email_shells (tenant_id, shell_html, logo_html, header_bg, footer_html, physical_address, brand_invite_emails, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8)
         ON CONFLICT (tenant_id) DO UPDATE SET
           shell_html         = $2,
           logo_html          = $3,
           header_bg          = $4,
           footer_html        = $5,
           physical_address   = $6,
           brand_invite_emails = $7,
           updated_at         = now(),
           updated_by         = $8`,
        [
          tenantId,
          longStr(b.shellHtml),
          longStr(b.logoHtml),
          shortStr(b.headerBg),
          longStr(b.footerHtml),
          shortStr(b.physicalAddress),
          brandInviteEmails,
          editorEmail,
        ],
      );
      bustTenantEmailShellCache(tenantId);
      await writeEditLog({
        targetType: "shell",
        targetKey: `tenant:${tenantId}`,
        editorEmail,
        action: "update",
        diff: {
          fields: ["shellHtml", "logoHtml", "headerBg", "footerHtml", "physicalAddress", "brandInviteEmails"].filter(has),
        },
      });
      const { overrides, derived } = await getTenantEmailShellOverrides(tenantId);
      res.json({ overrides, defaults: derived });
    } catch (err) {
      console.error("[notifications] tenant shell patch error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/** POST /api/tenant/email-shell/preview — render a sample email through the (possibly unsaved) shell. */
router.post(
  "/tenant/email-shell/preview",
  requireAuth,
  requirePermission("settings"),
  async (req, res): Promise<void> => {
    const tenantId = getTenantId(req, res);
    if (tenantId == null) return;
    const b = req.body ?? {};
    try {
      const { overrides, derived } = await getTenantEmailShellOverrides(tenantId);
      const shell = {
        shellHtml: typeof b.shellHtml === "string" ? b.shellHtml : derived.shellHtml,
        logoHtml: typeof b.logoHtml === "string" ? b.logoHtml : derived.logoHtml,
        headerBg: typeof b.headerBg === "string" ? b.headerBg : derived.headerBg,
        footerHtml: typeof b.footerHtml === "string" ? b.footerHtml : derived.footerHtml,
      };
      const sampleTpl = TENANT_NOTIFICATION_TEMPLATES["lead_notification"];
      const vars = buildTenantPreviewVars();
      // Reflect the (possibly unsaved draft) address so the editor sees the real
      // footer; blank string is honored (shows clean omission), falling back to
      // the saved override only when the draft field is absent entirely.
      vars["physicalAddress"] =
        typeof b.physicalAddress === "string"
          ? b.physicalAddress.trim()
          : (overrides.physicalAddress ?? "");
      const html = renderEmail({
        shell,
        bodyHtml: sampleTpl?.bodyHtml ?? "<p>Sample email body</p>",
        wrapInShell: true,
        vars,
        rawSlots: sampleTenantRawSlots("lead_notification"),
      });
      res.json({ html });
    } catch (err) {
      console.error("[notifications] tenant shell preview error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
