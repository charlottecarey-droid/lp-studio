---
name: Trial plan write-path landmine
description: No production write path may persist tenants.plan='trial'; trials are a date window, not a stored plan. 'trial' read-normalizes to growth.
---

# Trial plan write-path landmine

`normalizePlan("trial")` maps to **growth** (kept as a read-side backward-compat alias for
pre-existing rows). The self-serve trial is represented ONLY by the date window columns
`trial_started_at` / `trial_expires_at` (+ `has_trialed_before`) plus a stored `plan='free'`
floor — never by a stored `plan='trial'`.

**Rule:** NO production tenant-creation or plan-update path may write `plan='trial'` (or any
non-canonical alias). Canonical plans only: `free | starter | growth | scale | enterprise`.
- Both `tenants.plan` Drizzle default and the DB column default are `'free'`.
- `auth` signup inserts `plan='free'` + the trial window (`TRIAL_DURATION_DAYS`).
- Admin create (`POST /api/admin/tenants`) and admin PATCH both validate input against
  `PLANS` and 400 on anything non-canonical (mirror each other).
- Stripe webhook writes only typed canonical plans (or `free` on downgrade).

**Why:** storing `plan='trial'` silently grants Growth entitlements *indefinitely* with no
trial window (normalize→growth), bypassing the bounded-trial model. This was a real
authorization gap: the legacy default `'trial'` + an unvalidated admin-create input both
let new tenants get free Growth forever.

**How to apply:**
- A source-scan guardrail test (`api-server/src/lib/noTrialDefault.guardrail.test.ts`) fails
  if `?? "trial"` or `.default("trial")` reappears in `api-server/src` or `lib/db/src`
  (test/setup files excluded). Keep it green/blocking.
- Test fixtures (`royal-tenant.ts`, `webhook-tenant-routing.spec.ts`, `review-workflow-tenant.ts`)
  INTENTIONALLY insert `plan='trial'` to exercise the legacy read-normalization alias — leave
  them; they are not a production path.
- Any NEW writer of `tenants.plan` (scripts, jobs, new routes) must validate against `PLANS`.
- Going-forward-only: existing accounts are not retro-enrolled; Dandy (`dandy`/`dandy-smb`)
  is always enterprise and is excluded from the `trial→free` cleanup.
