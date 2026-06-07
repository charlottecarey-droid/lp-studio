---
name: Strict Facts review flow (per-page fact flags)
description: Cross-surface design constraints for the persistent fact-review flow (lp_page_fact_flags) — what gets a real flag+gate vs advisory-only, and how telemetry works.
---

# Strict Facts simplified review flow

Persistent per-page fact review: detect stats+claims+quotes in AI content, write
`lp_page_fact_flags` rows (pending), per-row actions, bulk-approve, and a publish
gate. Replaces the old ephemeral `strictMismatches` handoff (deleted). Never
re-add `sanitizeBlocksStrict` — see `strict-facts-no-scrub.md`.

## Anchoring rule: only page-backed surfaces get a real flag + gate
Flags are keyed by `(tenantId, pageId)`. Anything that is an `lp_pages` row gets
the full flow: landing pages, microsites, web one-pagers (all edited in the
shared BuilderEditor → banner + FactReviewModal already cover them).

- Sales generators (`generate-microsite.ts`, `web-one-pager.ts`) insert pages
  **server-side**, bypassing the client create flow, so they must call
  `detectAndWriteFlagsForPage(...)` best-effort right after the insert (template
  facts pre-tagged via `templateFactForms(templateBlocks)` so vetted templates
  produce no flags).
- The client create flows (pages-gallery, NewMicrositeModal) call
  `syncFactFlags(pageId)` best-effort.

**Why:** a page-scoped table can't anchor a surface with no pageId.

## AI email drafts are ADVISORY-ONLY (deliberate scope drift)
Email drafts are EPHEMERAL — no pageId, never persisted as an lp_page — so they
get NO flag row and NO publish gate. Instead `detectAdvisoryFacts(tenantId,
{subject, body})` returns `factWarnings` in the route JSON and the composer
renders a soft amber "review before sending" notice. Detection wraps the body as
`[{type:"richtext", props:{subject, body}}]` so the same `detectFacts` walker
applies.
**How to apply:** if asked to "gate" or "block" email sends on facts, push back —
the table model can't anchor it; keep it advisory unless emails become persisted.

## Telemetry = structured pino logs, not an analytics SDK
There is no analytics pipeline in api-server. `factFlags/telemetry.ts` →
`trackFactEvent(event, props)` emits `logger.info({event, ...}, "[fact-flags] …")`
with a stable `event` field for log-based analytics. Best-effort (never throws).
Server-observable events only (created/approved/edited/swapped/removed/undo/
library_upgrade/bulk_approved/published_with_bulk_approve/quote_approve_confirmed/
advisory_detected). Pure client events (e.g. "modal dismissed") are NOT wired —
no client telemetry transport exists.

## Publish gate = WARN-and-confirm, never silent-pass, never hard-block
The shared `enforceFactFlagPublishGate` (in `routes/lp/fact-flags.ts`, used by BOTH
the PUT publish path and the `/approve` path) must:
- WARN (409 `code:"fact_flags_pending"`, `pendingCount`, `checkFailed`) when pending>0
  **OR** when the pending-count query itself THREW. The count helper
  `getPendingFactFlagState` returns `{pending, ok}` — a failed query is `ok:false`,
  NOT `pending:0`. Never collapse "couldn't check" into "clean" or unapproved stats
  publish silently. (Old `countPendingFactFlags`→`catch→return 0` was the bug.)
- Still publish on explicit `bulkApproveFactFlags:true` even if the bulk-approve
  UPDATE fails (best-effort, swallowed) — a confirmed user is never hard-blocked.
**Why:** the original failure looked like "review modal never appears, pages publish
with unapproved stats" — caused by the gate silently passing on a schema/query error.
**Regression test:** `factFlags.integration.test.ts` renames `lp_page_fact_flags`
mid-test to force the count query to throw, asserts 409+checkFailed (page stays
draft) then 200 with bulkApprove. Restore the table in `finally`.

## Write-route 500s were undiagnosable — now logged
Every catch in `fact-flags.ts` returns `String(err)` to the client but historically
did NOT log server-side, so prod 500s (e.g. save-to-library) showed only pino-http's
generic line with no pg detail. All catches now `logger.error({err}, "fact-flags
route error")`. The real prod DB is Neon (has full Strict Facts schema, INSERT works
— see `prod-db-is-neon-not-helium.md`); `executeSql` hits empty Helium, so don't
diagnose schema state from it.

## Gotchas
- `logger.warn` is pino: object FIRST, message SECOND (`logger.warn({err}, "msg")`).
  The `(msg, {obj})` order does not typecheck.
- `normalizeText` turns commas into spaces, so `statKernel("3,000+")` degrades to
  `"3"` — comma-bearing numbers don't fuzzy-match their comma-free form.
- Tests: pure detection/normalize → plain vitest unit test; endpoint + publish
  gate → hermetic ephemeral PG via `startEphemeralPg` + `drizzle-kit push` +
  in-process `inject()` (see `hermetic-ephemeral-pg-tests.md`,
  `vitest-listen-hangs-inproc-inject.md`).
