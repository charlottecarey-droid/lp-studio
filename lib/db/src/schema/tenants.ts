import { pgTable, text, serial, timestamp, jsonb, integer, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Tenants — one row per customer organisation.
 * Dandy will be tenant #1. Every other future customer gets their own row.
 * All data (pages, contacts, leads, etc.) will eventually carry a tenant_id FK
 * pointing here. That migration happens when multi-tenancy is activated;
 * for now this table establishes the identity anchor.
 */
export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  micrositeDomain: text("microsite_domain"),
  // Task #412 — Cloudflare Custom Hostname id returned by
  // POST /zones/{zone}/custom_hostnames. Stored so the tenant-admin
  // "remove domain" flow can DELETE the matching Cloudflare resource
  // by id (avoiding a lookup-by-hostname round trip) and so the
  // SaaS UI can poll its TLS/verification status.
  cloudflareHostnameId: text("cloudflare_hostname_id"),
  plan: text("plan").notNull().default("free"),
  // Task #425 — Stripe billing. `plan` remains the source of truth the rest
  // of the app reads (PLAN_FEATURES is keyed by it). Stripe is only ever
  // authoritative for *tier* selection; entitlements stay code-driven. These
  // two columns let the webhook resolve `tenants → customer → subscription`
  // by id, and let the SuperAdmin UI flag drift when an operator changes the
  // plan manually on a Stripe-managed tenant.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("active"),
  // Task #967 — tenant-level default Open Graph / social share-card metadata.
  // These are the TENANT DEFAULT layer of the per-page OG cascade resolved by
  // api-server `resolvePageOG(pageId)`: per-page → tenant default → page
  // content → system fallback. `defaultOgTitle` supports the {{page_title}}
  // token (substituted with the page's own title at resolve time).
  // `defaultOgImageUrl` must be a publicly fetchable absolute 1200×630 URL.
  // All nullable → existing tenants keep falling straight through the cascade.
  defaultOgTitle: text("default_og_title"),
  defaultOgDescription: text("default_og_description"),
  defaultOgImageUrl: text("default_og_image_url"),
  settings: jsonb("settings").default({}),
  // Legacy column kept for compatibility — currently unused (all rows are {}).
  metadata: jsonb("metadata").default({}),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  // When set, this tenant's image library also includes uploads from the linked
  // tenant (and vice versa, when the link is reciprocal). Used to let sibling
  // brands like Dandy and Dandy SMB share one media catalog. Keep this minimal
  // — it is not a general parent/child tenant relationship.
  sharesLibraryWithTenantId: integer("shares_library_with_tenant_id"),
  // TRIALS — every self-serve signup gets an automatic 14-day Growth trial.
  // The trial tier is a constant in @workspace/plan-config (not a column);
  // these two timestamps define the window. NULL on both = no trial (the
  // going-forward-only default for accounts that existed before launch).
  // `effectivePlan` grants the trial tier while now() < trial_expires_at and
  // the stored `plan` is the floor users fall back to after expiry.
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  // Flips true once a trial has elapsed (set lazily on read) so a tenant
  // can't restart a second trial. Default false for new + existing rows.
  hasTrialedBefore: boolean("has_trialed_before").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  // Defense-in-depth: lock `plan` to the canonical 5-tier set so no legacy
  // alias (e.g. 'trial', which normalizePlan() maps to Growth) can ever be
  // persisted. Trials are a date window over a 'free' floor, never a stored
  // plan. Mirrors migration 0041_tenants_plan_canonical_check.sql.
  planCanonicalCheck: check(
    "tenants_plan_canonical_check",
    sql`${t.plan} IN ('free', 'starter', 'growth', 'scale', 'enterprise')`,
  ),
}));

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
