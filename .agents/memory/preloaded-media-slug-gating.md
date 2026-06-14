---
name: Preloaded media slug-gating
description: Hardcoded PRELOADED_VIDEOS in storage.ts bypasses the lp_media read ACL and must be Dandy-slug-gated separately.
---

storage.ts `GET /lp/media` returns TWO sources: uploaded `lp_media` rows
(correctly scoped by `libraryReadablePredicate` = own tenant + reciprocal
sibling) AND a hardcoded `PRELOADED_VIDEOS` array (Dandy-branded clips). The
hardcoded list is NOT in the DB, so the reciprocal-sibling ACL does NOT cover
it — it leaks to every tenant unless gated explicitly.

**Rule:** any hardcoded Dandy media appended to a media-listing response must be
gated on `isProtectedEnterpriseSlug(tenantSlug)` (canonical `dandy`/`dandy-smb`
guard, re-exported from `@workspace/plan-config` via `lib/planFeatures`), NOT on
the reciprocal-sibling library ACL and NOT on a single `=== "dandy"` slug check
(that misses Dandy SMB).

**Why:** images and uploaded videos share `lp_media` and inherit the sibling
ACL automatically; preloaded videos are code constants and silently bypass it,
so "Dandy Ent + Dandy SMB only" must be expressed by the slug guard instead.

**How to apply:** when adding/auditing any preloaded/hardcoded media in a
listing route, gate the whole list with `isProtectedEnterpriseSlug`; don't
reuse `libraryReadablePredicate` (it only filters DB rows) and don't hardcode a
single slug. Generators do not consume `PRELOADED_VIDEOS`.
