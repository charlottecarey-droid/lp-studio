import { pool } from "@workspace/db";
import {
  TENANT_NOTIFICATION_VARIABLES,
  buildSampleVars,
} from "@workspace/notification-variables";
import type {
  NotificationTemplateDef,
  NotificationBodyMode,
} from "./notificationTemplates";
import {
  TENANT_LEAD_NOTIFICATION_BODY_HTML,
  TENANT_COMMENT_BODY_HTML,
  TENANT_REVIEW_DECISION_BODY_HTML,
  TENANT_FORM_FOLLOWUP_BODY_HTML,
} from "./tenantEmailAssets";

/**
 * Code-owned registry of TENANT-scope notification templates plus a cached,
 * per-tenant accessor that merges a tenant's overrides from the
 * `notification_templates` table (scope='tenant') on top of these defaults.
 *
 * Mirrors `notificationTemplates.ts` (the platform registry) so the resolver is
 * extended, not forked. Same resilience contract: ANY DB error or missing row
 * falls back to the code default, so a config hiccup can never break a tenant
 * send. Requesting a key with NO code default is a programming error and throws
 * loudly (the platform vs tenant key sets are code-owned and must stay in sync
 * with the send sites).
 */

export const TENANT_TEMPLATE_KEYS = [
  "lead_notification",
  "comment",
  "review_decision",
  "form_followup",
] as const;
export type TenantTemplateKey = (typeof TENANT_TEMPLATE_KEYS)[number];

type TenantBaseTemplateDef = Pick<
  NotificationTemplateDef,
  "key" | "name" | "description" | "emailSubject" | "bodyHtml"
>;

const TENANT_BASE_TEMPLATES: Record<TenantTemplateKey, TenantBaseTemplateDef> = {
  lead_notification: {
    key: "lead_notification",
    name: "New lead notification",
    description:
      "Sent to your team when someone submits a form on one of your pages.",
    emailSubject: "New lead: {{pageTitle}}",
    bodyHtml: TENANT_LEAD_NOTIFICATION_BODY_HTML,
  },
  comment: {
    key: "comment",
    name: "New comment",
    description: "Sent to collaborators when a new comment is left on a page.",
    emailSubject: '💬 New comment on "{{pageTitle}}"',
    bodyHtml: TENANT_COMMENT_BODY_HTML,
  },
  review_decision: {
    key: "review_decision",
    name: "Review decision",
    description:
      "Sent to the page owner when a reviewer approves or requests changes.",
    emailSubject: '{{statusLabel}}: "{{pageTitle}}"',
    bodyHtml: TENANT_REVIEW_DECISION_BODY_HTML,
  },
  form_followup: {
    key: "form_followup",
    name: "Form follow-up",
    description:
      "Auto-reply sent to a visitor after they submit a form (uses your sales email template content).",
    emailSubject: "Thanks for reaching out",
    bodyHtml: TENANT_FORM_FOLLOWUP_BODY_HTML,
  },
};

/** Registry-wide default sample values for live preview / test-send. */
const DEFAULT_PREVIEW_DATA: Record<string, string> = buildSampleVars(
  TENANT_NOTIFICATION_VARIABLES,
);

/** The full code-owned tenant registry (defaults filled in). */
export const TENANT_NOTIFICATION_TEMPLATES: Record<string, NotificationTemplateDef> =
  Object.fromEntries(
    Object.entries(TENANT_BASE_TEMPLATES).map(([k, d]) => [
      k,
      {
        key: d.key,
        name: d.name,
        description: d.description,
        category: "lifecycle" as const,
        channels: ["email"] as NotificationTemplateDef["channels"],
        emailSubject: d.emailSubject,
        emailIntro: "",
        emailCtaLabel: "",
        // Envelope overrides default to null = today's behavior (env from, no
        // reply-to, intro-derived preheader). Tenants set them per-template.
        fromEmail: null,
        replyTo: null,
        preheaderText: null,
        inAppTitle: "",
        inAppBody: "",
        bodyHtml: d.bodyHtml,
        bodyMode: "html" as NotificationBodyMode,
        wrapInShell: true,
        previewData: DEFAULT_PREVIEW_DATA,
        enabled: true,
      } satisfies NotificationTemplateDef,
    ]),
  );

interface TenantTemplateRow {
  key: string;
  name: string | null;
  description: string | null;
  email_subject: string | null;
  from_email: string | null;
  reply_to: string | null;
  preheader_text: string | null;
  body_html: string | null;
  body_mode: string | null;
  wrap_in_shell: boolean | null;
  preview_data: Record<string, string> | null;
  enabled: boolean;
}

function rowToDef(
  row: TenantTemplateRow,
  fallback: NotificationTemplateDef,
): NotificationTemplateDef {
  return {
    ...fallback,
    name: row.name ?? fallback.name,
    description: row.description ?? fallback.description,
    emailSubject: row.email_subject ?? fallback.emailSubject,
    fromEmail: row.from_email ?? fallback.fromEmail,
    replyTo: row.reply_to ?? fallback.replyTo,
    preheaderText: row.preheader_text ?? fallback.preheaderText,
    bodyHtml: row.body_html ?? fallback.bodyHtml,
    bodyMode:
      row.body_mode === "html"
        ? "html"
        : row.body_mode === "wysiwyg"
          ? "wysiwyg"
          : fallback.bodyMode,
    wrapInShell: row.wrap_in_shell ?? fallback.wrapInShell,
    previewData:
      row.preview_data &&
      typeof row.preview_data === "object" &&
      !Array.isArray(row.preview_data)
        ? (row.preview_data as Record<string, string>)
        : fallback.previewData,
    enabled: row.enabled,
  };
}

const CACHE_TTL_MS = 60_000;
interface CacheEntry {
  data: Record<string, NotificationTemplateDef>;
  expiresAt: number;
}
const cache = new Map<number, CacheEntry>();
let generation = 0;

async function loadFromDb(
  tenantId: number,
): Promise<Record<string, NotificationTemplateDef>> {
  const merged: Record<string, NotificationTemplateDef> = {};
  for (const [k, def] of Object.entries(TENANT_NOTIFICATION_TEMPLATES))
    merged[k] = { ...def };
  try {
    const r = await pool.query<TenantTemplateRow>(
      `SELECT key, name, description, email_subject,
              from_email, reply_to, preheader_text,
              body_html, body_mode, wrap_in_shell, preview_data, enabled
         FROM notification_templates
        WHERE scope = 'tenant' AND tenant_id = $1`,
      [tenantId],
    );
    for (const row of r.rows) {
      const fallback = TENANT_NOTIFICATION_TEMPLATES[row.key];
      if (!fallback) continue; // ignore rows with no code counterpart
      merged[row.key] = rowToDef(row, fallback);
    }
  } catch (err) {
    console.error(
      "[tenantNotificationTemplates] DB load failed, using code defaults:",
      err,
    );
  }
  return merged;
}

async function getAll(
  tenantId: number,
): Promise<Record<string, NotificationTemplateDef>> {
  const now = Date.now();
  const hit = cache.get(tenantId);
  if (hit && now < hit.expiresAt) return hit.data;
  const myGeneration = generation;
  const loaded = await loadFromDb(tenantId);
  if (myGeneration === generation) {
    cache.set(tenantId, { data: loaded, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return loaded;
}

/**
 * Resolve one tenant template (DB override merged over code default). Throws if
 * `key` is not a known tenant template (programming error — keys are code-owned).
 */
export async function getTenantNotificationTemplate(
  tenantId: number,
  key: string,
): Promise<NotificationTemplateDef> {
  if (!TENANT_NOTIFICATION_TEMPLATES[key]) {
    throw new Error(`Unknown tenant notification template key: ${key}`);
  }
  const all = await getAll(tenantId);
  return all[key] ?? TENANT_NOTIFICATION_TEMPLATES[key];
}

/** All tenant templates for the settings management screen. */
export async function getTenantNotificationTemplates(
  tenantId: number,
): Promise<NotificationTemplateDef[]> {
  const all = await getAll(tenantId);
  return TENANT_TEMPLATE_KEYS.map((k) => all[k]).filter(
    (t): t is NotificationTemplateDef => Boolean(t),
  );
}

/** Bust the cache after a save so edits go live immediately. */
export function bustTenantNotificationTemplateCache(tenantId?: number): void {
  if (tenantId == null) {
    cache.clear();
  } else {
    cache.delete(tenantId);
  }
  generation += 1;
}
