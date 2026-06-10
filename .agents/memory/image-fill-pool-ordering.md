---
name: Image fill tiering by ORIGIN (current-ref scrape vs stale scrape vs starter)
description: How findBestImage tiers fill candidates by origin, and how currentReference decides strict-pass eligibility for scrapes
---

`findBestImage` + `buildReferenceFillPool`
(artifacts/api-server/src/routes/lp/generate-page.ts, shared by generate-page +
generate-microsite via fillEmptyImages) decide which library/scraped/starter image
fills an empty slot. The selection is tiered by IMAGE ORIGIN, not by raw score.

**The three tiers (findBestImage picks `best ?? bestScraped ?? bestStarter`):**
  1. `best` — the tenant's OWN curated assets (drawer uploads, brand-import
     photography, AI-generated, purpose-tagged) AND scrapes flagged
     `currentReference: true`. ONLY this tier may fill in the STRICT pass.
  2. `bestScraped` — STALE scrapes (`isScrapedImage && !currentReference`):
     harvested for an unrelated prior generation. Relaxed/last-resort pass only.
  3. `bestStarter` — generic STARTER seeds (`isStarterImage`, tag "starter"). The
     ABSOLUTE last resort, BELOW every scrape. Relaxed pass only.
Because the tiers are explicit, a score-0 stale scrape always beats a score-0
starter and a score-0 current-ref scrape always beats both — pool ORDER no longer
decides cross-origin ties (it only breaks ties WITHIN one tier).

**`currentReference` is the strict-pass key for scrapes (NOT contentScore>0).**
The old "scraped pass strict only on contentScore>0" rule is GONE. Instead
`buildReferenceFillPool` sets `currentReference: true` (via object-spread clones,
never in-place mutation) on:
  • freshScrapedMedia — scraped during THIS generation, and
  • currentRefScraped — catalog rows whose host matches a reference URL supplied
    in THIS prompt ("make my page look like this site").
It does NOT flag otherScraped (stale, other-host) or starters.
**Why:** a NEW tenant's only library is their OWN website's scrape, and a user
pointing us at a URL wants THAT site's imagery — even if topically generic. Those
must win prime hero/feature slots in the strict pass; only stale unrelated scrapes
and starters defer. Gating on contentScore>0 wrongly rejected generic-but-wanted
reference imagery.

**Off-topic CURATED guard still applies in strict (independent of tiers).** In the
strict pass, a curated CONTENT image that carries a topical tag (hasTopicalTag) yet
scores `contentScore<=0` for an `lp-feature` slot is rejected (e.g. a "scanner"
product shot landing on a "what dentists say" strip). Exemptions: untagged uploads
(benefit of the doubt), and any scraped image (current-ref scrapes are explicitly
allowed through). Hero + product-detail slots are unaffected.

**Per-generation bucket rotation (rotationSeed).** `buildReferenceFillPool` takes
an optional `rotationSeed` (routes pass `Math.floor(Math.random()*1_000_000)+1`,
built ONCE per generation) and rotates EACH bucket independently via
`rotateBucket` (no-op when len<=1 or seed<=0) so cross-bucket priority is preserved
while the start offset WITHIN a bucket of interchangeable assets varies — fixes
"same on-topic photo wins the first slot on every page". seed<=0 is a deterministic
no-op so unit fixtures keep fixed ordering.

**curatedFillPool (relaxed pre-AI pass) excludes starters in BOTH generators**
(`!isScrapedImage(img) && !isStarterImage(img)`), or starters fill feature slots
before scraped images get their turn. New-tenant-only-starters still fills via the
FINAL relaxed full-pool pass — the strict-pass starter/stale-scrape skip is safe
ONLY because every generation flow guarantees that later relaxed pass.

**How to apply:** Never fold "starter"-tagged rows into the curated bucket; never
let a starter or stale scrape win in the STRICT pass. To make a scrape strict-
eligible, flag it `currentReference` in buildReferenceFillPool (don't relax the
gate elsewhere). isStarterImage/isScrapedImage are mutually exclusive. In tests,
strict-eligible scrapes need `currentReference: true` on the fixture; to exercise a
stale scrape or starter filling a slot, pass relaxed-mode. Keep rotationSeed
defaulting to 0 in tests asserting exact pool order.
