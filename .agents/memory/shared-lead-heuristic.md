---
name: Shared lead/test heuristic
description: Single source of truth for "what counts as a test/junk lead" and lead field extraction across frontend + backend.
---

The test-lead heuristic, lead name/email extraction, and the normalized field
accessor live in `@workspace/lead-utils` (`lib/lead-utils`), consumed by BOTH
the api-server (backend) and lp-studio (frontend). It exports from `./src`
directly (no dist runtime), so there's no composite-dist drift — but its
`tsconfig.json` is still `composite` and listed in both consumers' tsconfig
`references` + package.json deps.

**Rule:** Never re-inline an `isTestLead` / `leadName` / `fieldAccessor` copy in
a page or route. EVERY lead-count surface must agree: dashboard "Recent leads"
widget, the master `/lp/leads/all` list, the per-page `/lp/leads` list, the
`/lp/leads/summary` counts, AND the analytics lead totals
(`/lp/analytics/overview` totalLeads + leadsTrend + cvr, `/lp/analytics/traffic`
daily leads, `/lp/analytics/pages` per-page leads) and A/B `/lp/tests/:id/results`
MQL counts. Test-lead filtering is JS-only (not expressible in SQL), so any
endpoint that counts leads must load the `fields` rows and tally in memory
(can't use SQL `count(*)`).

**Why:** Divergent copies caused QA traffic to inflate some counts but not
others. The gibberish-name detection (keyboard mash / no-vowel / 5+ consonant
run) is deliberately conservative — it only judges single alphabetic tokens of
length ≥ 4 and treats "y" as a vowel so real short names (Lynn, Ng, Schmidt)
are never flagged. There's a unit test guarding the false-positive list.

**How to apply:** When changing detection rules, edit only
`lib/lead-utils/src/index.ts` and update its `index.test.ts`. `includeTest=1`
query param reveals hidden test leads everywhere.
