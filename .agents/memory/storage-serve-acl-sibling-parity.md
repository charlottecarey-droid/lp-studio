---
name: Storage serve ACL must match the media-library list scope
description: Any route that SERVES tenant media must allow the same owned-tenant set the library LIST exposes, or legitimately-listed sibling images render as broken/empty frames.
---

# Storage serve ACL vs media-library list scope parity

**Rule:** The object-serve route (`GET /storage/objects/*path`) must authorize a
logged-in requester against `resolveOwnedTenantIds()` (own tenant **plus
reciprocally-linked sibling tenants**, plus shared/global) — the *same* scope the
media-library LIST endpoints (`/lp/media`, `/lp/media/images`) use — not an
exact-owner-only check (`tenantCanReadAcl`). Keep the anonymous (no-session) path
open so public microsites still serve ACL'd images.

**Why:** When serve authorization is narrower than list authorization, a
sibling-owned image the library legitimately shows fails its `<img>` request;
`content-library.tsx`'s `onError` hides it, so the user sees an empty/broken
frame. Only shared/global images survive, making it look like "most of my images
are missing." Singleton tenants don't hit it; only reciprocal-sibling pairs do.

**How to apply:** Do the owned-set check on the cross-tenant branch only (after
the cheap exact-owner check, before the shared/global fallback) so the hot path
is untouched. This grants nothing the library list didn't already expose. Same
class as `generator-catalog-drawer-acl-parity` — every surface that READS tenant
media must derive scope from `lib/libraryScope.ts`, never a hand-rolled check.

Brand-import / AI-gen mirror uploads carry an `owner: tenant:<id>` ACL; legacy
manual `/lp/upload` uploads have no ACL (public by URL), so only ACL'd assets
ever exhibit the gap.
