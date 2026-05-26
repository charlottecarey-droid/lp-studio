-- Task #415 — Custom domain TLS status email notifications.
--
-- Server-side poller (lib/customDomainPoller.ts) watches every tenant
-- with a non-null cloudflare_hostname_id, derives the current
-- Cloudflare status, and emails tenant admins on two transitions:
--   1. pending -> active   (TLS issued, domain is live)
--   2. pending >= 24h      (DNS likely misconfigured, needs attention)
--
-- The two `notified_*_at` columns serve as idempotency guards: the
-- poller updates them via `... WHERE custom_domain_notified_*_at IS NULL`
-- so a single transition produces a single email even if two processes
-- race. Attach resets them (and stamps attached_at = now()) so a
-- detach/re-attach cycle re-arms both emails. Detach clears all four.
--
-- last_seen_status is informational — useful for ops dashboards and
-- debugging the poller — but is NOT part of the dedupe key.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS custom_domain_attached_at        timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_last_seen_status   text,
  ADD COLUMN IF NOT EXISTS custom_domain_notified_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_notified_stuck_at  timestamptz;

-- Backfill attached_at for any tenant that already has a custom domain
-- attached today so the 24h "stuck" timer has a reasonable anchor and
-- doesn't immediately fire a false-positive on the next poll.
UPDATE tenants
   SET custom_domain_attached_at = COALESCE(custom_domain_attached_at, updated_at, now())
 WHERE cloudflare_hostname_id IS NOT NULL
   AND custom_domain_attached_at IS NULL;
