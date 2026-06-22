---
name: Storage serve ACL must match library list scope (reciprocal siblings)
description: Object-serve ACL allowed only the exact owner tenant while the media library listed reciprocal-sibling images, so sibling-owned thumbnails 403'd and rendered as empty frames.
---

# Storage serve ACL vs media-library list scope parity

The media library LIST endpoints (`GET /lp/media`, `/lp/media/images`) scope
visible rows via `resolveOwnedTenantIds(tenantId)` — the requester's own tenant
**plus reciprocally-linked sibling tenants** (e.g. an account-microsite pair),
plus shared/global rows. The object SERVE route (`GET /storage/objects/*path`)
must honor that **same** owned-tenant set, or sibling-owned images the library
legitimately lists 403 on serve and the content-library `<img onError>` hides
them → user sees "empty frame" / broken thumbnails (only shared images survive).

**Why:** `tenantCanReadAcl` allows ONLY the exact owner tenant
(`requester === ownerTenant`). The serve route used it, so it diverged from the
list scope. Reproduced on prod data: a tenant-10 session lists 594 library
images but 147 are owned by sibling 14055 → all 147 would 403. Tenants 10↔14055
are reciprocal siblings (`owned [10,14055]`/`[14055,10]`); singletons aren't
affected, which is why only some tenants hit the bug.

**How to apply:** On the cross-tenant path only (after the exact-owner
`tenantCanReadAcl` check fails, before the `isSharedOrGlobalAsset` fallback),
resolve `resolveOwnedTenantIds(requesterTenantId)` and allow if the object's
owner tenant is in that set. Keep the anonymous (no-session) path untouched —
public microsites must serve ACL'd images with no cookie. This grants nothing
the library list didn't already expose, and runs only on the rare cross-tenant
branch (hot path unaffected). Same class as the
generator-catalog-drawer-acl-parity lesson: any surface that READS tenant media
must share `lib/libraryScope.ts` scope, never a narrower hand-rolled check.

Brand-import/AI-gen mirror uploads carry `owner: tenant:<id>` ACL
(assets-uploader); legacy `/lp/upload` manual uploads have no ACL (public by
URL), which is why manual uploads never showed the bug.
