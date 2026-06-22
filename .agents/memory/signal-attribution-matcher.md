---
name: signal attribution centralized matcher
description: Tenant-scoped signal→contact/account matching rules; SQL/JS canonicalization parity; backfill conventions.
---

# Sales signal attribution matcher

All ingest paths (rb2b/apollo/letterdrop webhooks, POST /signals, form-submit leads, inbound replies) and the
retroactive backfill resolve linkage through ONE helper: `resolveSignalLinkage(tenantId, identity)` in
`artifacts/api-server/src/lib/signalAttribution.ts`. Rules can never drift between paths — wire new ingest there.

**Resolution order (tenant-scoped, exact/canonical, never fuzzy):**
contact = email (ci) → canonical LinkedIn URL; account = matched contact's accountId → company domain → exact company name.

**Why fail-closed on null tenant:** the same email / LinkedIn / domain legitimately appears in multiple tenants'
CRMs; a global lookup leaks attribution across tenants. Null tenant returns no linkage. NEVER add a global fallback.

**Why no fuzzy name matching:** mis-attribution risk. Name match is case-insensitive *exact* (trimmed) only.

## SQL/JS canonicalization parity (the subtle bug)
The LinkedIn canonicalizer exists twice: JS `normalizeLinkedinUrl` (runtime matcher) and a SQL `regexp_replace`
chain (`linkedinColExpr` + the migrate backfill). They MUST agree. Correct steps: strip protocol, strip `www.`,
strip query/fragment, strip trailing slash — **KEEP THE PATH**.
**Trap:** a SQL strip of `[/?#].*$` collapses every profile URL to the bare domain (`linkedin.com`), so every
contact matches every signal → mass mis-attribution. Use `[?#].*$` then `/+$` instead. In a JS template literal
`'^www\.'` becomes `'^www.'` (dot=any char); write `'^www\\.'` to keep the literal dot.

## Scoring is frontend-derived
Account "heat" score is computed client-side from `signal.accountId` over a 14-day window (lp-studio heat-tier.ts).
There is NO stored score column — fixing `account_id` is sufficient; nothing to recompute server-side.

## Backfill conventions
Retroactive repair lives in `migrate.ts` gated by a `_schema_migration_markers` key (e.g.
`sales_signal_attribution_backfill_v2`), idempotent + non-fatal. Each match UPDATE uses `HAVING count(*) = 1`
(unambiguous only). Clear DANGLING account_id first (so COALESCE/IS NULL re-resolve works), then resolve
contacts (email→linkedin) deriving account, then fill null account (domain→name), then re-null still-dangling
contact pointers. NEVER run the backfill from the dev shell — `lib/db`/NEON_DATABASE_URL hits PROD; it runs on deploy.
