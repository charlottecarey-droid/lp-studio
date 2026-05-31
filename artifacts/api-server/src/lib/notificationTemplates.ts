import { pool } from "@workspace/db";
import {
  PLATFORM_NOTIFICATION_VARIABLES,
  buildSampleVars,
} from "@workspace/notification-variables";
import { buildDefaultBodyHtml } from "./emailRender";
import {
  MAGAZINE_WELCOME_HTML,
  WORKSPACE_INVITE_MAGAZINE_HTML,
} from "./emailHtmlAssets";
import {
  MAGIC_LINK_BODY_HTML,
  EMAIL_VERIFICATION_BODY_HTML,
  PASSWORD_RESET_BODY_HTML,
  PAYMENT_FAILED_BODY_HTML,
  SLUG_REDIRECT_EXPIRY_BODY_HTML,
} from "./systemEmailBodies";

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
export type NotificationBodyMode = "wysiwyg" | "html";

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
  // Free-form email body (Phase 1). Default is built from emailIntro/emailCtaLabel
  // so unedited templates render byte-identically to the legacy frame.
  bodyHtml: string;
  bodyMode: NotificationBodyMode;
  // false = body_html is the entire email (no branded shell).
  wrapInShell: boolean;
  // Sample variable values for live preview / test-send.
  previewData: Record<string, string>;
  enabled: boolean;
}

/** The structured (code-owned) fields; the free-form body fields are derived. */
type BaseTemplateDef = Pick<
  NotificationTemplateDef,
  | "key" | "name" | "description" | "category" | "channels"
  | "emailSubject" | "emailIntro" | "emailCtaLabel"
  | "inAppTitle" | "inAppBody" | "enabled"
> &
  // Optional body overrides for templates whose email is NOT the structured
  // intro+CTA frame (e.g. the welcome magazine = full custom HTML), plus an
  // optional per-template preview sample set for tokens not in the global catalog.
  Partial<Pick<NotificationTemplateDef, "bodyHtml" | "bodyMode" | "wrapInShell" | "previewData">>;

/**
 * Default copy/channels for every template. Variables use `{{name}}` syntax and
 * are substituted by the dispatcher from its `context` map. Supported vars:
 *   tenantName, daysRemaining, workspaceUrl, billingUrl, ctaUrl
 */
const BASE_TEMPLATES: Record<string, BaseTemplateDef> = {
  welcome: {
    key: "welcome",
    name: "Welcome",
    description: "Sent when a new workspace finishes onboarding.",
    category: "lifecycle",
    // The dispatcher owns BOTH channels: the in-app inbox item and the welcome
    // email, so operators can edit the welcome email subject/intro/CTA from the
    // SuperAdmin Notifications tab like every other lifecycle template.
    channels: ["email", "in_app"],
    emailSubject: "Welcome to {{tenantName}} on LP Studio",
    emailIntro:
      "Your workspace is ready. Bookmark your URL — it's how you and your teammates sign back in.",
    emailCtaLabel: "Open my workspace",
    inAppTitle: "Welcome to LP Studio 🎉",
    inAppBody:
      "Your {{tenantName}} workspace is ready. Take a tour, invite your team, and publish your first page.",
    // The welcome email is a self-contained, on-brand magazine layout: the body
    // IS the entire email (full custom HTML, no shell chrome). Tokens use the
    // canonical camelCase set ({{tenantName}}, {{recipientName}}, {{workspaceUrl}},
    // {{ctaUrl}}, {{recipientEmail}}, {{unsubscribeUrl}}).
    bodyHtml: MAGAZINE_WELCOME_HTML,
    bodyMode: "html",
    wrapInShell: false,
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

  // ─── System / transactional & auth emails ──────────────────────────────
  // Email-only. Each has a code-owned default body (master-shell inner HTML)
  // AND a HARD code fallback in lib/notifications.ts: if the template row is
  // disabled, blank, or fails to render, the original hardcoded email sends so
  // sign-in / billing alerts can never break. The action URL is carried by the
  // {{ctaUrl}} token (HTML-escaped on substitution).
  magic_link: {
    key: "magic_link",
    name: "Sign-in link (magic link)",
    description: "Passwordless sign-in link. The link also verifies the email on redemption.",
    category: "system",
    channels: ["email"],
    emailSubject: "Your LP Studio sign-in link",
    emailIntro: "Your one-time sign-in link for LP Studio.",
    emailCtaLabel: "Sign in to LP Studio",
    inAppTitle: "Sign-in link",
    inAppBody: "A sign-in link was requested for your account.",
    bodyHtml: MAGIC_LINK_BODY_HTML,
    bodyMode: "html",
    wrapInShell: true,
    previewData: {
      headline: "Your sign-in link",
      ctaUrl: "https://app.lpstudio.ai/auth/magic?token=sample",
      expiryLabel: "15 minutes",
      recipientEmail: "jordan@acme.com",
    },
    enabled: true,
  },
  email_verification: {
    key: "email_verification",
    name: "Confirm your email",
    description: "Email-address verification link sent after email+password registration.",
    category: "system",
    channels: ["email"],
    emailSubject: "Confirm your email for LP Studio",
    emailIntro: "Confirm your email address to finish setting up your LP Studio account.",
    emailCtaLabel: "Confirm email",
    inAppTitle: "Confirm your email",
    inAppBody: "Please confirm your email address.",
    bodyHtml: EMAIL_VERIFICATION_BODY_HTML,
    bodyMode: "html",
    wrapInShell: true,
    previewData: {
      headline: "Confirm your email",
      ctaUrl: "https://app.lpstudio.ai/auth/verify?token=sample",
      expiryLabel: "24 hours",
      recipientEmail: "jordan@acme.com",
    },
    enabled: true,
  },
  password_reset: {
    key: "password_reset",
    name: "Reset your password",
    description: "Forgot-password reset link.",
    category: "system",
    channels: ["email"],
    emailSubject: "Reset your LP Studio password",
    emailIntro: "Reset the password for your LP Studio account.",
    emailCtaLabel: "Reset password",
    inAppTitle: "Reset your password",
    inAppBody: "A password reset was requested for your account.",
    bodyHtml: PASSWORD_RESET_BODY_HTML,
    bodyMode: "html",
    wrapInShell: true,
    previewData: {
      headline: "Reset your password",
      ctaUrl: "https://app.lpstudio.ai/auth/reset?token=sample",
      expiryLabel: "1 hour",
      recipientEmail: "jordan@acme.com",
    },
    enabled: true,
  },
  workspace_invite: {
    key: "workspace_invite",
    name: "Workspace invite",
    description: "Sent when a teammate is invited to (or added to) a workspace.",
    category: "system",
    channels: ["email"],
    emailSubject: "You've been invited to join {{tenantName}} on LP Studio",
    emailIntro: "You've been invited to a workspace on LP Studio.",
    emailCtaLabel: "Accept invite",
    inAppTitle: "Workspace invite",
    inAppBody: "You've been invited to join {{tenantName}}.",
    // Self-contained on-brand magazine layout: the body IS the entire email
    // (full custom HTML, no shell chrome). Tokens: {{inviterName}} {{tenantName}}
    // {{roleName}} {{workspaceUrl}} {{workspaceHost}} {{acceptUrl}} {{recipientEmail}}.
    bodyHtml: WORKSPACE_INVITE_MAGAZINE_HTML,
    bodyMode: "html",
    wrapInShell: false,
    previewData: {
      headline: "You've been invited to join Acme",
      inviteBody:
        "Taylor has invited you to join <strong>Acme</strong> on LP Studio as a <strong>Editor</strong>. Create your account to get started.",
      inviterName: "Taylor",
      tenantName: "Acme",
      roleName: "Editor",
      ctaLabel: "Create your account",
      ctaUrl: "https://app.lpstudio.ai/invite/sample",
      acceptUrl: "https://app.lpstudio.ai/invite/sample",
      workspaceUrl: "https://acme.lpstudio.ai",
      workspaceHost: "acme.lpstudio.ai",
      recipientEmail: "jordan@acme.com",
    },
    enabled: true,
  },
  payment_failed: {
    key: "payment_failed",
    name: "Payment failed (dunning)",
    description: "Sent on every Stripe invoice.payment_failed so admins can fix the card.",
    category: "system",
    channels: ["email"],
    emailSubject: "Payment failed for {{tenantName}} — update your card",
    emailIntro: "We couldn't process your subscription payment.",
    emailCtaLabel: "Update payment method",
    inAppTitle: "Payment failed",
    inAppBody: "We couldn't process your {{tenantName}} payment.",
    bodyHtml: PAYMENT_FAILED_BODY_HTML,
    bodyMode: "html",
    wrapInShell: true,
    previewData: {
      headline: "We couldn't process your Acme payment",
      dunningIntro:
        "We tried charging the card ending in 4242 for $49.00 and it was declined. We'll retry automatically, but you can avoid any interruption by updating your payment method now.",
      alertLabel: "Payment failed · attempt 2",
      alertText: "$49.00 could not be charged to the card ending in 4242.",
      tenantName: "Acme",
      ctaUrl: "https://app.lpstudio.ai/billing",
      recipientEmail: "jordan@acme.com",
    },
    enabled: true,
  },
  slug_redirect_expiry: {
    key: "slug_redirect_expiry",
    name: "Old URL expiring",
    description: "Warns admins that a renamed workspace's old redirect URL is about to expire.",
    category: "system",
    channels: ["email"],
    emailSubject: "Heads up: an old {{tenantName}} URL stops working soon",
    emailIntro: "An old URL for your workspace is about to stop working.",
    emailCtaLabel: "Open {{tenantName}}",
    inAppTitle: "Old URL expiring",
    inAppBody: "An old {{tenantName}} URL is about to stop working.",
    bodyHtml: SLUG_REDIRECT_EXPIRY_BODY_HTML,
    bodyMode: "html",
    wrapInShell: true,
    previewData: {
      headline: "An old Acme URL is about to stop working",
      expiryIntro:
        "After your workspace was renamed, links to the old URL kept working for 90 days. That window closes in 3 days — once it does, anyone visiting the old URL will land on a \"workspace not found\" page.",
      oldUrl: "https://old-acme.lpstudio.ai",
      currentUrl: "https://acme.lpstudio.ai",
      expiryFormatted: "Fri, 12 Jun 2026 00:00:00 UTC",
      tenantName: "Acme",
      ctaUrl: "https://acme.lpstudio.ai",
      recipientEmail: "jordan@acme.com",
    },
    enabled: true,
  },
};

// Registry-wide default sample values for live preview / test-send.
const DEFAULT_PREVIEW_DATA: Record<string, string> = buildSampleVars(PLATFORM_NOTIFICATION_VARIABLES);

/**
 * The full code-owned registry: structured fields plus the derived free-form
 * defaults. `bodyHtml` is built from the intro/CTA so an UNEDITED template
 * renders byte-identically to the legacy hardcoded frame.
 */
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplateDef> = Object.fromEntries(
  Object.entries(BASE_TEMPLATES).map(([k, d]) => [
    k,
    {
      ...d,
      bodyHtml: d.bodyHtml ?? buildDefaultBodyHtml(d.emailIntro, d.emailCtaLabel),
      bodyMode: d.bodyMode ?? ("wysiwyg" as NotificationBodyMode),
      wrapInShell: d.wrapInShell ?? true,
      // Per-template overrides (e.g. system-email tokens) layer over the global
      // catalog samples so previews/test-sends fill every token.
      previewData: d.previewData
        ? { ...DEFAULT_PREVIEW_DATA, ...d.previewData }
        : DEFAULT_PREVIEW_DATA,
    } satisfies NotificationTemplateDef,
  ]),
);

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
  body_html: string | null;
  body_mode: string | null;
  wrap_in_shell: boolean | null;
  preview_data: Record<string, string> | null;
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
    bodyHtml: row.body_html ?? fallback.bodyHtml,
    bodyMode: row.body_mode === "html" ? "html" : row.body_mode === "wysiwyg" ? "wysiwyg" : fallback.bodyMode,
    wrapInShell: row.wrap_in_shell ?? fallback.wrapInShell,
    previewData:
      row.preview_data && typeof row.preview_data === "object" && !Array.isArray(row.preview_data)
        ? (row.preview_data as Record<string, string>)
        : fallback.previewData,
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
              in_app_title, in_app_body,
              body_html, body_mode, wrap_in_shell, preview_data,
              enabled
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
