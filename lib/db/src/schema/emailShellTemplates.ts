import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Email branded shell — the wrapper every platform email is rendered into
 * (header with logo, brand colors, body slot, footer). A platform singleton:
 * exactly one meaningful row, keyed `platform_default`.
 *
 * Mirrors the `notification_templates` resilience contract: the canonical
 * shell + its brand pieces live in code (`emailRender.ts` /
 * `PLATFORM_DEFAULT_SHELL`); this table stores the SuperAdmin OVERRIDES. Any
 * column left NULL falls back to the code default, so an editor mistake or a
 * DB hiccup can never produce a broken (or empty) frame.
 *
 * `shellHtml` is the full raw HTML with `{{logoHtml}}`, `{{headerBg}}`,
 * `{{headline}}`, `{{body}}`, `{{footerHtml}}` slots. The structured columns
 * (`logoHtml`, `headerBg`, `footerHtml`) feed those slots so the simple
 * logo/color/footer form can edit the brand without touching raw HTML.
 */
export const emailShellTemplatesTable = pgTable("email_shell_templates", {
  // Singleton key. Only `platform_default` is used today.
  id: text("id").primaryKey(),
  // Full raw shell HTML override (null = code default PLATFORM_DEFAULT_SHELL).
  shellHtml: text("shell_html"),
  // Brand pieces injected into the shell slots (null = code default).
  logoHtml: text("logo_html"),
  headerBg: text("header_bg"),
  footerHtml: text("footer_html"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: text("updated_by"),
});

export type EmailShellTemplate = typeof emailShellTemplatesTable.$inferSelect;
export type InsertEmailShellTemplate = typeof emailShellTemplatesTable.$inferInsert;
