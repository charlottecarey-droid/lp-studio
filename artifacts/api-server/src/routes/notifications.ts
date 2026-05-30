import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth, getTenantId } from "../middleware/requireAuth";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import {
  getNotificationTemplates,
  bustNotificationTemplateCache,
  NOTIFICATION_TEMPLATES,
  type NotificationChannel,
} from "../lib/notificationTemplates";

const router: IRouter = Router();

const INBOX_LIMIT = 50;

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
// SuperAdmin template management (v1). Mounted before adminRouter in
// routes/index.ts so these /admin paths resolve before adminRouter's blanket
// requireAuth wildcard can swallow them (same reason blockCatalog is).
// ---------------------------------------------------------------------------

/** GET /api/admin/notification-templates — list templates (code defaults merged with DB overrides). */
router.get("/admin/notification-templates", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const templates = await getNotificationTemplates();
    res.json({ templates });
  } catch (err) {
    console.error("[notifications] template list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const VALID_CHANNELS: NotificationChannel[] = ["email", "in_app"];

/**
 * PATCH /api/admin/notification-templates/:key — upsert an override row.
 * Only the editable fields are accepted; `key`/`category` are code-owned.
 */
router.patch("/admin/notification-templates/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = String(req.params.key);
  const def = NOTIFICATION_TEMPLATES[key];
  if (!def) {
    res.status(404).json({ error: "Unknown template" });
    return;
  }
  const b = req.body ?? {};

  // Validate channels if provided: subset of valid channels, must be a subset
  // of the code template's declared channels (can't invent an email channel for
  // an in-app-only template like welcome).
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

  const str = (v: unknown): string | null =>
    v === undefined || v === null ? null : String(v).slice(0, 5000);

  try {
    await pool.query(
      `INSERT INTO notification_templates
         (key, name, description, category, channels,
          email_subject, email_intro, email_cta_label, in_app_title, in_app_body, enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       ON CONFLICT (key) DO UPDATE SET
         channels        = COALESCE($5, notification_templates.channels),
         email_subject   = $6,
         email_intro     = $7,
         email_cta_label = $8,
         in_app_title    = $9,
         in_app_body     = $10,
         enabled         = $11,
         updated_at      = now()`,
      [
        key,
        def.name,
        def.description,
        def.category,
        channels ? JSON.stringify(channels) : JSON.stringify(def.channels),
        str(b.emailSubject),
        str(b.emailIntro),
        str(b.emailCtaLabel),
        str(b.inAppTitle),
        str(b.inAppBody),
        typeof b.enabled === "boolean" ? b.enabled : def.enabled,
      ],
    );
    bustNotificationTemplateCache();
    const templates = await getNotificationTemplates();
    res.json({ templates });
  } catch (err) {
    console.error("[notifications] template patch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
