---
name: Trial plan write-path landmine
description: Never persist tenants.plan='trial' — it read-normalizes to growth (= indefinite free Growth). Trials are a date window, not a stored plan.
---

# Trial plan write-path landmine

**Rule:** no production tenant-creation or plan-update path may write `plan='trial'`
(or any non-canonical alias). The self-serve trial is a *date window*
(`trial_started_at` / `trial_expires_at`) over a stored `plan='free'` floor —
never a stored `plan='trial'`. Validate every plan write against the canonical
set (`free | starter | growth | scale | enterprise`).

**Why:** `normalizePlan("trial")` maps to **growth** as a read-side backward-compat
alias for pre-existing rows. So a *stored* `plan='trial'` silently grants Growth
entitlements indefinitely with no trial window — bypassing the bounded-trial model.
This was a real authorization gap: a legacy default of `'trial'` plus an
unvalidated admin-create plan input both let new tenants get free Growth forever.

**How to apply:**
- Defaults (Drizzle + DB column), signup, admin create, admin PATCH, and the Stripe
  webhook must all resolve to canonical plans only; reject/ coerce anything else.
- A source-scan guardrail test fails if `?? "trial"` or `.default("trial")` reappears
  in production source — keep it green/blocking.
- Test fixtures may still insert `plan='trial'` on purpose to exercise the legacy
  read-normalization alias; that is not a production path — leave them.
- CAVEAT (observed): a DB `CHECK tenants_plan_canonical_check` now rejects
  `plan='trial'` at insert time, so the `royal-tenant.ts` e2e fixture (defaults to
  `plan='trial'`) fails its tenant INSERT — this reds out ~24 e2e specs that share
  that fixture, independent of any feature work. If you see `tenants_plan_canonical_check`
  violations in e2e, it's this fixture/constraint mismatch, not your change.
- Going-forward-only: existing accounts are not retro-enrolled; Dandy
  (`dandy`/`dandy-smb`) is always enterprise and excluded from any `trial→free` cleanup.
