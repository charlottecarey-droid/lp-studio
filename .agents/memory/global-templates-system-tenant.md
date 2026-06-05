---
name: Global templates owned by the system tenant
description: All is_global LP templates are owned by one dedicated system tenant identified by reserved slug, not a column flag.
---

# Global LP templates live under one system tenant

Every `lp_pages.is_global = true AND is_template = true` row is owned by a single
dedicated **system tenant**, resolved by its reserved slug `__system-templates`
(display name "Global Templates"). There is **no boolean column** marking a tenant
as "system" — the slug IS the identifier. Helper: `ensureSystemTenant()` /
`getSystemTenantId()` in `api-server/src/lib/systemTenant.ts`.

**Why:** Globals used to be scattered across real customer tenants (seed assigned
them to the lowest-id tenant — Dandy; manual promotions kept their original
owner). That gave the global library no neutral home and made the superadmin
"Open in builder" cross-tenant edit-in-place flow unreliable.

**How to apply:**
- Visibility is tenant-agnostic: `GET /lp/templates` surfaces globals to every
  tenant via `isGlobal=true`, so changing the owner never hides them. salesMode
  business-case detection is also tenant-agnostic (first block `business-case%`).
- Boot consolidation step in `migrate.ts` (runs every boot, self-healing) pulls
  any stray global back under the system tenant, de-colliding slug clashes with a
  `-<pageId>` suffix. It MUST run **before** the `global_templates seed` step or
  the seed's `ON CONFLICT (tenant_id, slug)` upsert inserts duplicates.
- The seed (`global_templates_seed_v26`) resolves its ownerId via
  `ensureSystemTenant()`, not the lowest-id tenant.
- Promote route `PUT /api/admin/lp/templates/:id`: setting `is_global=true`
  re-homes the page to the system tenant (slug de-collision). Demotion is left
  untouched — the original owner is unrecoverable.
- `isAppSuperadmin` in `pages.ts` honors `isRootSuperadminEmail` (mirrors
  requireSuperadmin) so the root operator's in-place template edits work even
  when their app_users row lacks role='superadmin' (email-casing upsert).
- The system tenant is inert: plan='free', no users / Stripe / domain / trial,
  so billing sweeps and pollers never act on it.
