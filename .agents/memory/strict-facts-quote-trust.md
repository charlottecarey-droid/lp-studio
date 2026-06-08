---
name: Strict Facts quote (testimonial) trust paths
description: The three ways a quote escapes Strict Facts flagging, and the easy-to-miss callsites for per-page trusted_fact_forms.
---

A quote/testimonial is NOT flagged by Strict Facts if ANY of:
1. It matches an approved proof point (fact_kind defaults to stat; quote branch in `buildApprovedFacts.addQuote` + `lp_proof_points` row with `fact_kind='quote'` + `approved_for_ai=true`). CRUD must persist `fact_kind` + `attribution_*` for this to work.
2. The proof-point scraper extracted it and it was saved as an approved `fact_kind='quote'` proof point (same path as 1, populated by import).
3. It came from the per-request generation reference URL — carried via `lp_pages.trusted_fact_forms` (jsonb of normalized quote forms), consumed by `syncFactFlags`/`detectAndWriteFlagsForPage` as a skip set alongside `templateForms`.

**Why path 3 needs persistence:** `/fact-flags/sync` re-detects facts AFTER generation with NO URL context. The only durable signal is the per-page `trusted_fact_forms` column.

**url-sourced trust is PAGE-LEVEL, not per-quote** (parity with the established url-sourced *stats* behavior — see `url-sourced-facts-trust.md`): when a per-request URL is scraped (`urlSourcedFacts`), generate-page returns ALL detected quote normalizedForms as trusted. Per-quote provenance was intentionally NOT added (would diverge from the stat design).

**Easy-to-miss callsites for `trusted_fact_forms`:**
- POST /lp/pages must VALIDATE client-supplied `trustedFactForms` against quotes actually detected on the submitted blocks (`detectFacts(effectiveBlocks).filter(quote)`), or a client can pre-whitelist arbitrary forms. (Not a hard security boundary — tenant can one-click bulk-approve their own flags — but keeps the gate meaningful and stops garbage persistence.)
- Page CLONE must copy `trustedFactForms` from source, or a cloned page re-flags already-vetted url-sourced quotes.
- Microsite/sales generators use ref URLs as STYLE inspiration only (no `urlSourcedFacts`), so they deliberately do NOT wire url-sourced quote trust.
