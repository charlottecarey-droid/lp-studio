---
name: Generator media catalog must mirror the drawer read-ACL
description: fetchMediaCatalog scope has to equal the media drawer's read scope, or generation starves
---

The AI page + microsite generator's `fetchMediaCatalog(tenantId)` (routes/lp/generate-page.ts)
and the media drawer (routes/storage.ts) MUST resolve the SAME read scope, now via the
shared helper `lib/libraryScope.ts` (`resolveOwnedTenantIds` + `libraryReadablePredicate`):
own tenant + RECIPROCAL sibling (`tenants.shares_library_with_tenant_id` pointing BOTH ways)
+ `is_shared = true` rows.

**Why:** they drifted — the drawer showed a reciprocal sibling's ~1000 images but
`fetchMediaCatalog` queried `eq(tenantId)` only. So when generating for the smaller sibling
(e.g. Dandy SMB sharing ENT's drawer), the generator's candidate pool collapsed to a handful,
the dedup/scoring had nothing to reach for, and it repeated one image (the scanner shot) across
hero/feature/detail slots. The drawer ACL and the generator scope are the same security
boundary and must stay one source of truth.

**How to apply:** never reintroduce a single-tenant `eq(lpMediaTable.tenantId, …)` in the
generator catalog. Keep the `tenantId == null` fail-closed guard. If the drawer ACL changes,
change `lib/libraryScope.ts` and both callers move together.

Related but SEPARATE: untagged images (most page-reference scrapes, and any untagged uploads)
all score 0 in `scoreImage`; the strict fill gate places anything `bestScore >= 0`, so it falls
back to pool/recency order, not relevance — pulling in off-topic photos once tagged matches run
out. Raising scrape supply (photo caps, companion-page harvest) amplifies this. Tagging is the
real lever for relevance; the scorer can only differentiate images that carry purpose/content tags.
