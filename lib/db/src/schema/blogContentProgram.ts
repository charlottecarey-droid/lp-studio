import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Phase 4 — LP Studio blog content program (autonomous publishing, June 2026).
 *
 * Three superadmin-owned, NOT-tenant-scoped tables (same rationale as
 * blog_posts: this is platform marketing config, not per-customer data) that
 * let the program maintain a 30–90 day publishing backlog with minimal manual
 * work while preserving editorial oversight:
 *
 *   blog_content_themes    — strategic guardrails / content pillars.
 *   blog_topics            — the topic pipeline/queue (a small status machine).
 *   blog_program_settings  — singleton program config + guardrails.
 *
 * Generated posts link back to their topic via blog_posts.topic_id (added in
 * the blogPosts schema). Oversight is preserved by construction: the default
 * mode is REVIEW, autopublish defaults OFF, and the autonomous pipeline only
 * ever acts on PRE-APPROVED topics inside the guardrails below.
 */

/**
 * blog_content_themes — the strategic guardrails. Each theme is a content
 * pillar the recommender draws from. `priority` (1 low … 5 high) orders which
 * themes get topped up / drafted first; `targetKeywords` seeds SEO intent;
 * `active=false` parks a theme without deleting its topics.
 */
export const blogContentThemesTable = pgTable(
  "blog_content_themes",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priority: integer("priority").notNull().default(3),
    targetKeywords: jsonb("target_keywords").notNull().default([]),
    audience: text("audience").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    activeIdx: index("blog_content_themes_active_idx").on(t.active, t.priority),
  }),
);

export type BlogContentTheme = typeof blogContentThemesTable.$inferSelect;
export type NewBlogContentTheme = typeof blogContentThemesTable.$inferInsert;

/**
 * blog_topics — the topic pipeline/queue. A topic moves through a small status
 * machine:
 *   suggested → approved | rejected
 *   approved  → drafting → drafted → scheduled → published
 * `source` records provenance ('ai' | 'manual'); `rationale` is the AI's reason
 * (or human note); `postId` links to the blog_posts DRAFT generated for an
 * approved topic; `decidedAt`/`decidedBy` audit the approve/reject decision.
 * `themeId` is nullable (manual topics needn't belong to a theme; a deleted
 * theme nulls the link, preserving the topic's history).
 */
export const blogTopicsTable = pgTable(
  "blog_topics",
  {
    id: serial("id").primaryKey(),
    themeId: integer("theme_id").references(() => blogContentThemesTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    angle: text("angle").notNull().default(""),
    targetKeyword: text("target_keyword").notNull().default(""),
    // suggested | approved | rejected | drafting | drafted | scheduled | published
    status: text("status").notNull().default("suggested"),
    // 'ai' | 'manual'
    source: text("source").notNull().default("ai"),
    rationale: text("rationale").notNull().default(""),
    postId: integer("post_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("blog_topics_status_idx").on(t.status, t.createdAt),
    themeIdx: index("blog_topics_theme_idx").on(t.themeId),
  }),
);

export type BlogTopic = typeof blogTopicsTable.$inferSelect;
export type NewBlogTopic = typeof blogTopicsTable.$inferInsert;

/**
 * blog_program_settings — the program config + guardrails as a SINGLETON row
 * (id=1, enforced in-app via ON CONFLICT + a CHECK in SQL). Defaults are the
 * safest posture: REVIEW mode, autopublish OFF — a fresh DB never autonomously
 * publishes. Guardrails read by the autonomous tick:
 *   mode                  — 'review' (default) | 'autonomous'.
 *   postsPerWeek          — target cadence used to space the calendar.
 *   targetBacklogDays     — backlog window the program tries to keep filled
 *                           (clamped 30–90 in-app).
 *   publishDays           — allowed weekdays (0=Sun … 6=Sat) for scheduling.
 *   publishHour           — local hour scheduled posts go out at.
 *   maxAutonomousPerWeek  — hard cap on autonomous output per rolling week.
 *   autopublishEnabled    — THE strongest gate; when false the autonomous
 *                           pipeline may generate + schedule but the
 *                           blogPublishPoller must not auto-flip to published.
 *   defaultThemeId        — optional theme to weight recommendations toward.
 *   writingInstructions   — superadmin-editable editorial brief injected into
 *                           every generation call (outline/draft/metadata).
 */
export const blogProgramSettingsTable = pgTable("blog_program_settings", {
  id: integer("id").primaryKey().default(1),
  mode: text("mode").notNull().default("review"),
  postsPerWeek: integer("posts_per_week").notNull().default(2),
  targetBacklogDays: integer("target_backlog_days").notNull().default(45),
  publishDays: jsonb("publish_days").notNull().default([2, 4]),
  publishHour: integer("publish_hour").notNull().default(9),
  maxAutonomousPerWeek: integer("max_autonomous_per_week").notNull().default(3),
  autopublishEnabled: boolean("autopublish_enabled").notNull().default(false),
  defaultThemeId: integer("default_theme_id").references(
    () => blogContentThemesTable.id,
    { onDelete: "set null" },
  ),
  // Superadmin-editable editorial brief injected into every generation call
  // (outline + draft + metadata). Seeded with a default once (only when empty)
  // so the program's writing standard can evolve without code changes.
  writingInstructions: text("writing_instructions").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type BlogProgramSettings = typeof blogProgramSettingsTable.$inferSelect;
export type NewBlogProgramSettings = typeof blogProgramSettingsTable.$inferInsert;
