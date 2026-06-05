// The dedicated "system" tenant that owns every global landing-page template.
//
// Global templates (lp_pages.is_global = true) used to be owned by whichever
// customer tenant created or promoted them (the seed assigned them to the
// lowest-id tenant — Dandy — and manually-promoted ones kept their original
// owner). Scattering them across real customer workspaces meant the superadmin
// "Open in builder" action could not reliably edit a template in place, and
// gave globals no clean, neutral home. We now own ALL global templates under a
// single dedicated system tenant resolved by its reserved slug.
//
// This tenant is inert by design: it has no users, no Stripe customer, no
// custom domain and no trial window, so billing sweeps / domain pollers /
// trial logic never act on it. It exists purely as the FK anchor for the
// global template library.

import { pool } from "@workspace/db";

/** Reserved slug — the stable, reliable identifier for the system tenant.
 *  The double-underscore prefix keeps it from ever colliding with a
 *  customer-chosen slug (slugs are lowercase alphanumeric + single hyphens). */
export const SYSTEM_TEMPLATE_TENANT_SLUG = "__system-templates";

/** Display name shown wherever the owning tenant of a global template is
 *  surfaced (e.g. superadmin → Templates → Owner column). */
export const SYSTEM_TEMPLATE_TENANT_NAME = "Global Templates";

// Cached per-process once resolved — the row never moves and its id is stable.
let cachedId: number | null = null;

/**
 * Idempotently ensure the system/template tenant exists and return its id.
 * Reuses the existing row when present (matched by the reserved slug) rather
 * than creating a duplicate. Safe to call concurrently — the INSERT relies on
 * the `tenants.slug` UNIQUE constraint and an ON CONFLICT upsert so racing
 * callers converge on the same row.
 */
export async function ensureSystemTenant(): Promise<number> {
  if (cachedId !== null) return cachedId;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
       VALUES ($1, $2, 'active', 'free')
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [SYSTEM_TEMPLATE_TENANT_NAME, SYSTEM_TEMPLATE_TENANT_SLUG],
  );
  cachedId = r.rows[0].id;
  return cachedId;
}

/**
 * Resolve the system tenant's id without creating it. Returns null when the
 * tenant does not yet exist. Use `ensureSystemTenant()` on any write path that
 * must guarantee the row is present.
 */
export async function getSystemTenantId(): Promise<number | null> {
  if (cachedId !== null) return cachedId;
  const r = await pool.query<{ id: number }>(
    `SELECT id FROM tenants WHERE slug = $1`,
    [SYSTEM_TEMPLATE_TENANT_SLUG],
  );
  cachedId = r.rows[0]?.id ?? null;
  return cachedId;
}
