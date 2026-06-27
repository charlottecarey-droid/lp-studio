---
name: lp_pages create must auto-dedupe the per-tenant slug
description: Why POST /api/lp/pages 500s on regenerated pages, and the dedupe pattern that fixes it.
---

# lp_pages create must auto-dedupe the per-tenant slug

`POST /api/lp/pages` does not derive the slug itself — the client (AI page
generator) sends a `slug` derived from the title. Two pages generated for the
same product yield the SAME slug → the INSERT hits `lp_pages_tenant_slug_unique`
(SQLSTATE 23505) and the user sees a frequent, confusing "Failed to create
page".

**Why:** The clone path already auto-suffixes a colliding slug (`foo`, `foo-2`,
`foo-3`, …); the create path did NOT — it inserted the client slug verbatim, so
the common "regenerate a page for the same product" flow failed every time.

**How to apply:** Before the create INSERT, run a tenant-scoped dedupe loop
(mirror the clone path): query `lp_pages` for `(slug, tenantId)`; if taken, try
`${slug}-N`. Keep the suffixed slug ≤255 by trimming the base before appending
(strip trailing dashes so you never emit `base--2`). The catch stays the race
safety net: classify the unique violation with `isUniqueViolation` (walks the
cause chain) → 409, never a generic 500. It is a PER-TENANT constraint, so always
scope the existence check by `tenantId`.
