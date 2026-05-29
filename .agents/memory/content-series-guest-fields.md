---
name: Content Series episode guest fields
description: Where podcast guest identity comes from, why RSS can't supply it, and the hero-targeting contract for the Content Series block.
---

# Content Series (podcast) guest fields

**Podcast RSS feeds carry NO structured guest field.** `<author>` / `<itunes:author>`
is the show producer/host (e.g. always "Dandy" for The Margin Line). The guest's
name/title/company only ever live in the episode `<title>` and description prose.
So RSS sync (`/lp/rss/parse`) cannot populate `guestName`/`guestTitle`/`guestCompany`
— it only pulls title, description, date, audio URL, artwork.

**To auto-populate guests, read the prose with AI**, never the feed. Endpoint
`POST /lp/rss/extract-guests` does this (text-only input, no URL → no SSRF;
auth-gated + rate-limited). It must return `""` for unstated fields, never invent.
Surfaced in the editor as an "Extract guests" button that fills only episodes
missing a guest name and never overwrites manually-typed title/company.

**Hero targeting contract:** when a visitor lands via `?episode=<slug>` or
`?utm_content=<slug>`, the hero must reflect that episode's OWN guest. Guest
identity in `applyEpisodeToHero` must come from the episode alone — never fall
back to the block-level `heroGuestName`/`heroGuestTitle`, which belong to a
different (default/featured) episode.
**Why:** the original bug mixed the targeted episode's title/description with the
default episode's guest, showing the wrong person.
**How to apply:** any future change to hero resolution must keep guest fields
sourced from the applied episode; rely on the existing `(heroGuestName ||
heroGuestTitle)` render guards so a guest-less episode shows no guest line rather
than a stale one.
