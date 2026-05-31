---
name: Stripe accounts self-heal must be gated on the package tracker
description: Why the stripe.accounts boot self-heal differs from the drizzle 0041/0051 self-heals — it must NOT pre-create the table or it wedges the package migration runner.
---

# Stripe accounts self-heal is gated, unlike the drizzle self-heals

`artifacts/api-server/src/lib/stripeClient.ts` self-heals `stripe.accounts` on boot
(after `runStripeSyncMigrations`). Unlike the drizzle self-heals (`migrate.ts`
notifications-0041 / workflow_send_failures-0051) which are unconditional
`CREATE … IF NOT EXISTS`, the stripe heal MUST be conditional.

**Rule:** only recreate `stripe.accounts` when the package tracker
(`stripe._migrations`) records the FINAL accounts migration applied — name
`rename_id_to_match_stripe_api` (0050). If the tracker is below that (fresh or
mid-migration DB), DEFER to the package's own migrations and touch nothing.

**Why:** `stripe-replit-sync` ALSO creates `accounts` — in `0046_sync_status_per_account`,
whose `CREATE TRIGGER handle_updated_at` is NOT idempotent (no IF NOT EXISTS), and
0047/0048/0050 then ADD/rename columns non-idempotently. If the self-heal
pre-creates the final-shape table while the tracker is < 0050, the package's next
run of 0046+ collides ("trigger handle_updated_at already exists" / "column already
exists"), throws, and the tracker is wedged forever below high-water mark — so the
OTHER 28 stripe tables never advance to final shape either. This actually happened
during this task. On a clean schema the package migrations run fine (0046 succeeds);
the real drift bug is tracker=52 with `accounts` physically dropped, where the
package no-ops (dedup) and only the heal can restore it — and there it can't collide
because the package won't re-run 0046.

**How to apply:** Probe `to_regclass('stripe._migrations')` first (referencing a
missing relation fails at plan time), then check `EXISTS(... WHERE name='rename_id_to_match_stripe_api')`.
The `stripe.*` tables are a MIRROR repopulated from the Stripe API by `syncBackfill`
on every boot, so dropping/rebuilding the schema loses no real data — safe even on
prod (NEON_DATABASE_URL) when a one-time repair is needed. To repair a wedged
tracker: `DROP TABLE stripe.accounts CASCADE` then re-run the package `runMigrations`;
it resumes at 0046 and reaches 0052.
