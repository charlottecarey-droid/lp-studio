---
name: Reserved media tags exclude images from AI reuse
description: How "do not let the AI reuse this image" works (logo, team-photo) — tag at save + EXCLUDE_TAGS + restore-at-render
---

Some `lp_media` images must never be reused by the AI page generator as hero/feature/section
imagery even though they live in the same tenant media pool the generator scores. Two reserved
tags follow this pattern: brand logos (`logo`) and team-member headshots (`team-photo`).

**The three coordinated pieces:**

1. **Tag at the save route.** The owning route merges the reserved tag onto the matching
   `lp_media` row (tenant-scoped match on `tenant_id` + `url`), idempotently, preserving
   existing tags. Logos: brand PUT route. Headshots: the `team_member` library create/update
   routes (read the item's `photo` field). Best-effort — never fail the save on a tagging
   hiccup; no row matching the URL (e.g. external URL) = no-op.
2. **Exclude from the AI pool.** Add the tag to `EXCLUDE_TAGS` in the generate-page route.
   `fetchMediaCatalog` filters tagged rows out of `images` (the scored/offered pool) but KEEPS
   them in `allImages` so `sanitizeAIImageUrls` can still recognise and clear them if the model
   assigns one anyway.
3. **Backfill existing rows** via a marker-gated migrate step joining `lp_media` to the
   library table on `url = content ->> 'photo'`, idempotent independent of the marker.

**Why excluding the headshot does NOT break "Meet the Team":** the team block does NOT source
member photos from the AI catalog. The AI receives the verbatim headshot URLs from the
team-members section builder, and a final reconcile pass forces each member's `photo` to the
saved row's value. So the section renders correctly regardless of catalog exclusion. Same shape
for logos (kept verbatim, preserved out of the image pipeline — see
logo-preserve-replace-imagery.md).

**jsonb idempotent tag-merge SQL** (works on Neon; the agent `executeSql` callback hits the
stale Helium DB and errors `m.tenant_id does not exist` — ignore that, validate via an
api-server vitest integration test against the real pool instead):
`SET tags = COALESCE(tags,'[]'::jsonb) || '["<tag>"]'::jsonb WHERE ... AND NOT (COALESCE(tags,'[]'::jsonb) ? '<tag>')`.

**Known gap:** replacing a member's photo tags the new headshot but leaves the stale tag on the
old one (it stays excluded from AI even when no longer a headshot). Un-tagging on replace/delete
when no other member references the URL is a deliberate follow-up, not a bug.
