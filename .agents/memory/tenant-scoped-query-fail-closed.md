---
name: Tenant-scoped queries must fail closed on null tenantId
description: Any DB helper that reads tenant-owned rows must require tenantId and refuse to query when it is null — never fall back to an unfiltered or "first row" query.
---

Rule: any function that reads tenant-owned rows (brand settings, media, leads, proof points, case studies, etc.) must take a non-optional `tenantId: number`, OR — if it must accept `number | null` because the route is unauth — return empty / `{}` immediately when null.

**Why:** Two real leaks shipped this way:
- `fetchLibraryImages()` had no tenantId param at all — pulled Dandy sales-rep photos onto a Frambam furniture LP via the block "Refresh tiles" path.
- `fetchMediaCatalog(tenantId?)` and a sibling `fetchBrand(tenantId?)` in the AI page generator had optional tenantId; when the request was unauth, they fell back to `eq(mediaType, "image")` / `select().limit(1)` — querying the global pool / arbitrary tenant's brand row.

The pattern that creates the bug: writing `const where = tenantId != null ? and(..., eq(table.tenantId, tenantId)) : eq(...)` — the "else" branch is the leak. Same with `tenantId ? query.where(...).limit(1) : query.limit(1)`.

**How to apply:**
- When auth is required: take `tenantId: number` (non-null). The route's `getTenantId(req, res)` 401s before the helper is ever called.
- When the route is intentionally unauth (e.g. `/lp/generate-page`): take `tenantId: number | null` and `if (tenantId == null) return EMPTY;` as the first line. The generator can fall back to Unsplash / AI image gen / a generic prompt — that's fine. Cross-tenant leakage is not.
- Never write `query.limit(1)` without a tenant filter against any tenant-scoped table. If "no tenant" is a legitimate state, return early before the query.
