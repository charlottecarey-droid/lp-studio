---
name: Industry templates use ind- slug, not the industry tag
description: Why the "Industry templates" gallery section keys off the ind- slug prefix, not the industry column.
---

The seeded industry starter templates (`artifacts/api-server/src/seeds/industryTemplates.ts`) are ALL stored with `industry: null` on purpose — so they stay visible to every tenant regardless of the tenant's `settings.industry`. Their only reliable marker is the slug prefix `ind-` (e.g. `ind-dental-family-practice`) plus a `"Dental — Family Practice"`-style `templateLabel`.

**Rule:** any library logic that needs to identify "industry templates" must recognize them by `isGlobal && slug startsWith "ind-"`, NOT by a non-null `industry` tag. The shared helper is `isIndustryTemplate()` in `artifacts/lp-studio/src/lib/template-library.ts` (= `hasRealIndustry(t) || ind- slug`). `hasRealIndustry()` (real, non-"generic" tag) is the older check and silently misses every seeded industry template.

**Why:** with `industry: null`, the original `buildTemplateGroups` industry bucket (which used `hasRealIndustry`) never matched, so all `ind-*` templates fell into the "Block templates" catch-all and the "Industry templates" section was always empty and dropped. Reported as "the Industry templates category is missing."

**How to apply:** the section order in `buildTemplateGroups` is featured → yours → homepage → fullPage → block → industry. `fullPage` is checked before industry, but seeded industry templates start with a `hero` block (not full-page) so they reach the industry bucket. Use `isIndustryTemplate` in both the grouping bucket and `templateMatchesType("Industry-specific")`. The Industry *dropdown* (`collectIndustries`/`templateMatchesIndustry`) still keys off the real tag — `ind-*` templates have none, so they stay always-visible there (not a regression). Both galleries (template-marketplace.tsx + sales-marketplace.tsx) already carry `slug` from the enriched endpoint.
