import { Router, type IRouter, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { pool } from "@workspace/db";
import {
  PLATFORM_NOTIFICATION_VARIABLES,
  buildSampleVars,
} from "@workspace/notification-variables";
import { requireAuth, getTenantId, type AuthUser } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import {
  getNotificationTemplates,
  getNotificationTemplate,
  bustNotificationTemplateCache,
  NOTIFICATION_TEMPLATES,
  type NotificationChannel,
} from "../lib/notificationTemplates";
import {
  getEmailShell,
  getEmailShellOverrides,
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
  lifecycleEmailTemplateKeys,
} from "../lib/notificationPreferences";
import { getRequestHost } from "../lib/requestHost";

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

/**
 * GET /api/notifications/preferences — the signed-in user's lifecycle email
 * opt-outs. Scoped to BOTH app_user_id and tenant_id. Returns the manageable
 * lifecycle email templates plus the keys the user has opted out of.
 */
router.get("/notifications/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  try {
    const all = await getNotificationTemplates();
    const templates = all
      .filter((t) => t.category === "lifecycle" && t.channels.includes("email"))
      .map((t) => ({ key: t.key, name: t.name, description: t.description }));
    const optedOut = (await getOptOuts(tenantId, user.userId))
      .filter((o) => o.channel === "email")
      .map((o) => o.templateKey);
    res.json({ templates, optedOut });
  } catch (err) {
    console.error("[notifications] preferences get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PATCH /api/notifications/preferences { templateKey, subscribed } — toggle one
 * lifecycle email for the signed-in user. Only known lifecycle email templates
 * are accepted (a non-lifecycle/unknown key is rejected so this can never
 * suppress a system email).
 */
router.patch("/notifications/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const tenantId = getTenantId(req, res);
  if (tenantId == null) return;
  const b = req.body ?? {};
  const templateKey = typeof b.templateKey === "string" ? b.templateKey : "";
  const subscribed = typeof b.subscribed === "boolean" ? b.subscribed : null;
  if (!templateKey || subscribed === null) {
    res.status(400).json({ error: "templateKey (string) and subscribed (boolean) are required" });
    return;
  }
  if (!lifecycleEmailTemplateKeys().includes(templateKey)) {
    res.status(400).json({ error: "Unknown or non-lifecycle template" });
    return;
  }
  try {
    await setOptOut(tenantId, user.userId, templateKey, "email", !subscribed);
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
  targetType: "template" | "shell";
  targetKey: string;
  editorEmail: string | null;
  action: "update" | "reset" | "test_send";
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

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const from = process.env["RESEND_FROM_EMAIL"] ?? "LP Studio <noreply@lpstudio.ai>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
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
  const def = NOTIFICATION_TEMPLATES[key];
  if (!def) {
    res.status(404).json({ error: "Unknown template" });
    return;
  }
  const b = req.body ?? {};

  // Validate channels if provided: subset of valid channels AND of the code
  // template's declared channels (can't invent an email channel for an
  // in-app-only template like welcome).
  let channels: NotificationChannel[] | undefined;
  if (b.channels !== undefined) {
    if (!Array.isArray(b.channels)) {
      res.status(400).json({ error: "channels must be an array" });
      return;
    }
    const filtered = (b.channels as unknown[]).filter((c): c is NotificationChannel =>
      VALID_CHANNELS.includes(c as NotificationChannel),
    );
    channels = Array.from(new Set<NotificationChannel>(filtered)).filter((c) => def.channels.includes(c));
  }

  const bodyMode =
    b.bodyMode === "html" ? "html" : b.bodyMode === "wysiwyg" ? "wysiwyg" : null;
  const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : null;
  const previewData =
    b.previewData && typeof b.previewData === "object" && !Array.isArray(b.previewData)
      ? JSON.stringify(b.previewData)
      : null;

  const editorEmail = (req as Request & { authUser?: AuthUser }).authUser?.email ?? null;

  try {
    await pool.query(
      `INSERT INTO notification_templates
         (key, name, description, category, channels,
          email_subject, email_intro, email_cta_label, in_app_title, in_app_body,
          body_html, body_mode, wrap_in_shell, preview_data, enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
       ON CONFLICT (key) DO UPDATE SET
         channels        = COALESCE($5, notification_templates.channels),
         email_subject   = $6,
         email_intro     = $7,
         email_cta_label = $8,
         in_app_title    = $9,
         in_app_body     = $10,
         body_html       = $11,
         body_mode       = $12,
         wrap_in_shell   = $13,
         preview_data    = $14::jsonb,
         enabled         = $15,
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
    const shell = await getEmailShell();
    const bodyHtml = typeof b.bodyHtml === "string" ? b.bodyHtml : tpl.bodyHtml;
    const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : tpl.wrapInShell;
    const vars = buildPreviewVars({ ...tpl.previewData, ...(b.previewData as object) });
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
      const shell = await getEmailShell();
      const bodyHtml = typeof b.bodyHtml === "string" ? b.bodyHtml : tpl.bodyHtml;
      const wrapInShell = typeof b.wrapInShell === "boolean" ? b.wrapInShell : tpl.wrapInShell;
      const vars = buildPreviewVars({ ...tpl.previewData, ...(b.previewData as object) });
      const html = renderEmail({ shell, bodyHtml, wrapInShell, vars });
      const subject = `[Test] ${substitutePlain(
        typeof b.emailSubject === "string" ? b.emailSubject : tpl.emailSubject,
        vars,
      )}`;
      await sendViaResend(to, subject, html);
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
      `INSERT INTO email_shell_templates (id, shell_html, logo_html, header_bg, footer_html, updated_at, updated_by)
       VALUES ($1,$2,$3,$4,$5, now(), $6)
       ON CONFLICT (id) DO UPDATE SET
         shell_html  = $2,
         logo_html   = $3,
         header_bg   = $4,
         footer_html = $5,
         updated_at  = now(),
         updated_by  = $6`,
      [
        EMAIL_SHELL_ID,
        longStr(b.shellHtml),
        longStr(b.logoHtml),
        shortStr(b.headerBg),
        longStr(b.footerHtml),
        editorEmail,
      ],
    );
    bustEmailShellCache();
    await writeEditLog({
      targetType: "shell",
      targetKey: EMAIL_SHELL_ID,
      editorEmail,
      action: "update",
      diff: { fields: ["shellHtml", "logoHtml", "headerBg", "footerHtml"].filter(has) },
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
    const shell = {
      shellHtml: typeof b.shellHtml === "string" ? b.shellHtml : DEFAULT_EMAIL_SHELL.shellHtml,
      logoHtml: typeof b.logoHtml === "string" ? b.logoHtml : DEFAULT_EMAIL_SHELL.logoHtml,
      headerBg: typeof b.headerBg === "string" ? b.headerBg : DEFAULT_EMAIL_SHELL.headerBg,
      footerHtml: typeof b.footerHtml === "string" ? b.footerHtml : DEFAULT_EMAIL_SHELL.footerHtml,
    };
    const sampleTpl = NOTIFICATION_TEMPLATES["trial_day_7"];
    const vars = buildPreviewVars();
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

export default router;
