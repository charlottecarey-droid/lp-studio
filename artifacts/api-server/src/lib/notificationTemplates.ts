import { pool } from "@workspace/db";

/**
 * Canonical, code-owned registry of notification templates plus a cached
 * accessor that merges SuperAdmin overrides from the `notification_templates`
 * table on top of these defaults.
 *
 * Same resilience contract as `planConfig.ts`: ANY DB error or missing row
 * falls back to the code default for that template, so a config-table hiccup
 * can never silence (or worse, throw inside) a lifecycle send. The defaults
 * here are the source of truth; the table only carries operator edits.
 */

export type NotificationChannel = "email" | "in_app";

export interface NotificationTemplateDef {
  key: string;
  name: string;
  description: string;
  category: "lifecycle" | "system";
  channels: NotificationChannel[];
  emailSubject: string;
  emailIntro: string;
  emailCtaLabel: string;
  inAppTitle: string;
  inAppBody: string;
  enabled: boolean;
}

/**
 * Default copy/channels for every template. Variables use `{{name}}` syntax and
 * are substituted by the dispatcher from its `context` map. Supported vars:
 *   tenantName, daysRemaining, workspaceUrl, billingUrl
 */
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplateDef> = {
  welcome: {
    key: "welcome",
    name: "Welcome",
    description: "Sent when a new workspace finishes onboarding.",
    category: "lifecycle",
    // Email side of welcome stays on the existing, separately-tested
    // sendWelcomeEmail; the dispatcher only owns the in-app inbox item.
    channels: ["in_app"],
    emailSubject: "Welcome to {{tenantName}} on LP Studio",
    emailIntro:
      "Your workspace is ready. Bookmark your URL — it's how you and your teammates sign back in.",
    emailCtaLabel: "Open my workspace",
    inAppTitle: "Welcome to LP Studio 🎉",
    inAppBody:
      "Your {{tenantName}} workspace is ready. Take a tour, invite your team, and publish your first page.",
    enabled: true,
  },
  trial_day_7: {
    key: "trial_day_7",
    name: "Trial — day 7 (halfway)",
    description: "Halfway nudge: 7 days into the 14-day Growth trial.",
    category: "lifecycle",
    channels: ["email", "in_app"],
    emailSubject: "You're halfway through your {{tenantName}} Growth trial",
    emailIntro:
      "You're halfway through your 14-day Growth trial. Pages, Sales Console, and AI generation are all unlocked — here's a good moment to put them to work.",
    emailCtaLabel: "Explore Growth features",
    inAppTitle: "Halfway through your Growth trial",
    inAppBody:
      "You have {{daysRemaining}} days left on your Growth trial. Make the most of unlimited pages, Sales Console, and AI generation.",
    enabled: true,
  },
  trial_day_11: {
    key: "trial_day_11",
    name: "Trial — day 11 (3 days left)",
    description: "Reminder: 3 days remain on the Growth trial.",
    category: "lifecycle",
    channels: ["email", "in_app"],
    emailSubject: "Your {{tenantName}} Growth trial ends in {{daysRemaining}} days",
    emailIntro:
      "Your Growth trial ends in {{daysRemaining}} days. Add a plan now to keep Sales Console, unlimited pages, and AI generation without interruption.",
    emailCtaLabel: "Choose a plan",
    inAppTitle: "Your Growth trial ends soon",
    inAppBody:
      "Only {{daysRemaining}} days left on your Growth trial. Upgrade to keep your Growth features when it ends.",
    enabled: true,
  },
  trial_day_13: {
    key: "trial_day_13",
    name: "Trial — day 13 (last day)",
    description: "Final nudge: trial ends tomorrow.",
    category: "lifecycle",
    channels: ["email", "in_app"],
    emailSubject: "Last day of your {{tenantName}} Growth trial",
    emailIntro:
      "This is the last day of your Growth trial. Once it ends you'll drop to the Free plan — upgrade now to keep Sales Console, unlimited pages, and AI generation.",
    emailCtaLabel: "Upgrade to keep your features",
    inAppTitle: "Your Growth trial ends tomorrow",
    inAppBody:
      "Your Growth trial ends tomorrow. Upgrade now to avoid dropping to the Free plan and losing your Growth features.",
    enabled: true,
  },
};

export const TEMPLATE_KEYS = Object.keys(NOTIFICATION_TEMPLATES);

interface TemplateRow {
  key: string;
  name: string;
  description: string;
  category: string;
  channels: unknown;
  email_subject: string | null;
  email_intro: string | null;
  email_cta_label: string | null;
  in_app_title: string | null;
  in_app_body: string | null;
  enabled: boolean;
}

const CACHE_TTL_MS = 60_000;
let cache: Record<string, NotificationTemplateDef> | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<Record<string, NotificationTemplateDef>> | null = null;
let generation = 0;

function sanitizeChannels(raw: unknown, fallback: NotificationChannel[]): NotificationChannel[] {
  if (!Array.isArray(raw)) return fallback;
  const valid = raw.filter((c): c is NotificationChannel => c === "email" || c === "in_app");
  return valid.length ? Array.from(new Set(valid)) : fallback;
}

function rowToDef(row: TemplateRow, fallback: NotificationTemplateDef): NotificationTemplateDef {
  return {
    key: fallback.key,
    name: row.name ?? fallback.name,
    description: row.description ?? fallback.description,
    category: (row.category === "system" ? "system" : "lifecycle"),
    channels: sanitizeChannels(row.channels, fallback.channels),
    // null override columns fall back to the code default copy.
    emailSubject: row.email_subject ?? fallback.emailSubject,
    emailIntro: row.email_intro ?? fallback.emailIntro,
    emailCtaLabel: row.email_cta_label ?? fallback.emailCtaLabel,
    inAppTitle: row.in_app_title ?? fallback.inAppTitle,
    inAppBody: row.in_app_body ?? fallback.inAppBody,
    enabled: row.enabled,
  };
}

async function loadFromDb(): Promise<Record<string, NotificationTemplateDef>> {
  const merged: Record<string, NotificationTemplateDef> = {};
  for (const [k, def] of Object.entries(NOTIFICATION_TEMPLATES)) merged[k] = { ...def };
  try {
    const r = await pool.query<TemplateRow>(
      `SELECT key, name, description, category, channels,
              email_subject, email_intro, email_cta_label,
              in_app_title, in_app_body, enabled
         FROM notification_templates`,
    );
    for (const row of r.rows) {
      const fallback = NOTIFICATION_TEMPLATES[row.key];
      if (!fallback) continue; // ignore rows with no code counterpart
      merged[row.key] = rowToDef(row, fallback);
    }
  } catch (err) {
    console.error("[notificationTemplates] DB load failed, using code defaults:", err);
  }
  return merged;
}

async function getAll(): Promise<Record<string, NotificationTemplateDef>> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) return cache;
  if (inFlight) return inFlight;
  const myGeneration = generation;
  inFlight = loadFromDb()
    .then((loaded) => {
      if (myGeneration === generation) {
        cache = loaded;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      }
      return loaded;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Resolve one template (DB override merged over code default). */
export async function getNotificationTemplate(key: string): Promise<NotificationTemplateDef | null> {
  const all = await getAll();
  return all[key] ?? NOTIFICATION_TEMPLATES[key] ?? null;
}

/** All templates, for the SuperAdmin management screen. */
export async function getNotificationTemplates(): Promise<NotificationTemplateDef[]> {
  const all = await getAll();
  return TEMPLATE_KEYS.map((k) => all[k]).filter(Boolean);
}

/** Bust the cache after a SuperAdmin save so edits go live immediately. */
export function bustNotificationTemplateCache(): void {
  cache = null;
  cacheExpiresAt = 0;
  generation += 1;
}
