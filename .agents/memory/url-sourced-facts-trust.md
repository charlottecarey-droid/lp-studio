---
name: URL-sourced facts trust (strict-facts relaxation)
description: When a user-provided source URL scrapes successfully, that generation's facts are trusted and strict-facts guards must relax — only for per-request URLs, never brand inspirationUrls.
---

# URL-sourced facts trust

When a user hands the AI a source URL **for a specific generation** and it scrapes
successfully, that page is a TRUSTED fact source for that one generation. The
strict-facts guards in `generate-page.ts` must NOT blank case studies, rebuild
`dso-success-stories` from the approved-only pool, force the "Add a quote in brand
settings" placeholder, or flag the URL's stats as unapproved (`strictMismatches`).

**Why:** users were pasting a real case-study URL and getting back a mostly-empty
page (guards stripped the very facts they provided) with one section still showing
DCA's hardcoded demo numbers. The provided URL is explicit user intent to use those
facts.

**How to apply:**
- The trust signal is `urlSourcedFacts` = a **per-request** reference URL
  (`perRequestUrls`) scraped successfully. It is deliberately distinct from the
  brand's persisted `inspirationUrls` (auto-merged for voice/structure only — those
  do NOT confer fact trust). Match on the **normalized** URL (`new URL(...)` with an
  `https://` default) so a bare `site.com` request matches the scraper's
  `https://site.com/` result.
- Gate every fact guard on `!urlSourcedFacts` in BOTH the template and freeform
  paths: the strict stat scan + `enforceApprovedCaseStudies`, and the always-on
  `enforceDsoSuccessStoriesApproved`. Keep `stripAiInlineColors` ON regardless —
  it's fact-independent.
- Template mode also needs a prompt OVERRIDE when `urlSourcedFacts`: rule 6 normally
  freezes numeric values, so without an override the AI keeps the template's example
  numbers (e.g. DCA's). Tell it to replace stat values / names / quotes / case-study
  prose with the reference page's real facts (keep image/link/color/anchor fields).
- Out of scope (Task #1136): do NOT persist the scraped reference as approved
  `lp_proof_points` rows — the trust is ephemeral, per-generation only.

## DCA default leak (separate but related fix)

`BlockDsoCaseStudy.tsx` uses `props.x ?? DEFAULT_X` for every field, so any field a
generation leaves unset renders DCA's demo constants (9,600 hours / 45-site / $9.2M).
Fix at GENERATION, never the component (the component defaults are what Dandy's
non-generated/default rendering — block library, canvas, template previews — relies
on, and must stay unchanged). `fillDsoCaseStudyNeutralDefaults()` (exported from
`generate-page.ts`) runs on every generated `dso-case-study` in both paths: keeps AI
values, fills only genuinely-missing fields with neutral/empty values (`stats: []`,
`results: []`, empty strings, generic section headings). Runs in ALL cases, not just
URL-sourced.
