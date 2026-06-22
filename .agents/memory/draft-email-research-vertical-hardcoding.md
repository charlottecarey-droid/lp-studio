---
name: Draft Email research vertical-hardcoding
description: Why Sales Console "AI Draft Email never finds research on anyone" — Perplexity queries were dental-hardcoded in a multi-tenant app.
---

# Draft Email research queries must stay vertical-neutral

The Sales Console "AI Draft Email" (`artifacts/api-server/src/routes/sales/draft-email.ts`)
gathers prospect research via Perplexity (`model: "sonar"`). The four research
prompts (person, company, linkedin, site-fallback) had **hardcoded dental/DSO
vocabulary** — restricting person searches to "(dental industry, DSO, healthcare
ops)" and publications like "Dental Economics, DSO News, Group Dentistry Now".

**Symptom:** "no research found on ANYONE — even Marc Benioff." Because the query
told Perplexity to look only for a *dental* footprint, it correctly returned
"No person-level information found" for any non-dental subject. The pipeline,
key, and model were all fine.

**Rule:** This is a multi-tenant app — research prompts must never bake in one
vertical. Derive an `industryHint` from the **account's** `industry`/`segment`
fields and inject it only when present; an empty hint must mean "search the whole
web, no industry filter."

**Why:** The key was present and valid, queries returned in ~2.5s (NOT a timeout
issue — the 12s `fetchWithTimeout` cap was a red herring). The only thing
suppressing results was the dental wording inside the prompt strings.

**How to apply:** When touching these prompts, keep them generic-by-default.
The citation relevance filter (`isCitationRelevant` / `trustedDomains`) also
carries dental entries, but those are *additive keep-rules* — they never drop
non-dental sources and don't affect whether research is found, so they are not
the bug. Verify any prompt change by hitting `api.perplexity.ai` directly with a
known public figure: dental-constrained → "No person-level information found";
neutral → rich talks/quotes/citations.
