-- Sales send/inbound child-FK enforcement (task #797)
--
-- Why
-- ───
-- The drizzle schema declares relationships on sales_email_sends.contact_id /
-- hotlink_id and sales_inbound_emails.contact_id / account_id, but the live
-- database never created these as enforced foreign keys: migration 0000 created
-- both tables with those columns as PLAIN integers (no REFERENCES clause), and
-- no later migration ever added them. Only sales_email_sends.campaign_id was
-- ever a real FK (0000 created it ON DELETE CASCADE).
--
-- Because the FKs don't exist in the DB, deleting a contact, campaign, or
-- hotlink does NOT error — but it also does NOT clean up: the related send /
-- inbound rows are left behind as orphans pointing at IDs that no longer exist,
-- gradually polluting reporting data. This migration adds the missing FKs with
-- the intended on-delete behavior:
--   1. sales_email_sends.contact_id   — owned send rows, ON DELETE CASCADE.
--   2. sales_email_sends.hotlink_id   — historical link, ON DELETE SET NULL.
--   3. sales_inbound_emails.contact_id — historical/reporting, ON DELETE SET NULL.
--   4. sales_inbound_emails.account_id — historical/reporting, ON DELETE SET NULL.
--
-- Cleanup first: a FK can't be added while rows violate it. Existing orphans
-- (created precisely because no FK enforced these columns) must be reconciled
-- before ADD CONSTRAINT, or the ALTER fails. contact_id on sales_email_sends is
-- NOT NULL with ON DELETE CASCADE, so its orphans are DELETEd (they can't be
-- nulled); the three SET NULL columns have their orphans nulled.
--
-- Drift note: some DBs may have created these tables via an early push before a
-- column-defining migration, so ADD COLUMN IF NOT EXISTS the columns first so
-- the FK can always be (re)created; it is a no-op where the columns already
-- exist. Drop both the Postgres-default (`_fkey`) and Drizzle-style
-- (`_<reftable>_<refcol>_fk`) constraint names defensively so this migration is
-- idempotent across environments, then re-add with the intended ON DELETE
-- action.

-- ── Orphan cleanup ────────────────────────────────────────────────────────
-- 1. sales_email_sends.contact_id (NOT NULL, CASCADE) — delete orphan sends.
DELETE FROM sales_email_sends s
 WHERE s.contact_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sales_contacts c WHERE c.id = s.contact_id);

-- 2. sales_email_sends.hotlink_id (SET NULL) — null dangling hotlink refs.
UPDATE sales_email_sends s
   SET hotlink_id = NULL
 WHERE s.hotlink_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sales_hotlinks h WHERE h.id = s.hotlink_id);

-- 3. sales_inbound_emails.contact_id (SET NULL) — null dangling contact refs.
UPDATE sales_inbound_emails i
   SET contact_id = NULL
 WHERE i.contact_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sales_contacts c WHERE c.id = i.contact_id);

-- 4. sales_inbound_emails.account_id (SET NULL) — null dangling account refs.
UPDATE sales_inbound_emails i
   SET account_id = NULL
 WHERE i.account_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sales_accounts a WHERE a.id = i.account_id);

-- ── Foreign keys ──────────────────────────────────────────────────────────
-- 1. sales_email_sends.contact_id → sales_contacts(id) ON DELETE CASCADE
ALTER TABLE sales_email_sends
  ADD COLUMN IF NOT EXISTS contact_id integer;
ALTER TABLE sales_email_sends
  DROP CONSTRAINT IF EXISTS sales_email_sends_contact_id_fkey;
ALTER TABLE sales_email_sends
  DROP CONSTRAINT IF EXISTS sales_email_sends_contact_id_sales_contacts_id_fk;
ALTER TABLE sales_email_sends
  ADD CONSTRAINT sales_email_sends_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES sales_contacts(id)
  ON DELETE CASCADE;

-- 2. sales_email_sends.hotlink_id → sales_hotlinks(id) ON DELETE SET NULL
ALTER TABLE sales_email_sends
  ADD COLUMN IF NOT EXISTS hotlink_id integer;
ALTER TABLE sales_email_sends
  DROP CONSTRAINT IF EXISTS sales_email_sends_hotlink_id_fkey;
ALTER TABLE sales_email_sends
  DROP CONSTRAINT IF EXISTS sales_email_sends_hotlink_id_sales_hotlinks_id_fk;
ALTER TABLE sales_email_sends
  ADD CONSTRAINT sales_email_sends_hotlink_id_fkey
  FOREIGN KEY (hotlink_id) REFERENCES sales_hotlinks(id)
  ON DELETE SET NULL;

-- 3. sales_inbound_emails.contact_id → sales_contacts(id) ON DELETE SET NULL
ALTER TABLE sales_inbound_emails
  ADD COLUMN IF NOT EXISTS contact_id integer;
ALTER TABLE sales_inbound_emails
  DROP CONSTRAINT IF EXISTS sales_inbound_emails_contact_id_fkey;
ALTER TABLE sales_inbound_emails
  DROP CONSTRAINT IF EXISTS sales_inbound_emails_contact_id_sales_contacts_id_fk;
ALTER TABLE sales_inbound_emails
  ADD CONSTRAINT sales_inbound_emails_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES sales_contacts(id)
  ON DELETE SET NULL;

-- 4. sales_inbound_emails.account_id → sales_accounts(id) ON DELETE SET NULL
ALTER TABLE sales_inbound_emails
  ADD COLUMN IF NOT EXISTS account_id integer;
ALTER TABLE sales_inbound_emails
  DROP CONSTRAINT IF EXISTS sales_inbound_emails_account_id_fkey;
ALTER TABLE sales_inbound_emails
  DROP CONSTRAINT IF EXISTS sales_inbound_emails_account_id_sales_accounts_id_fk;
ALTER TABLE sales_inbound_emails
  ADD CONSTRAINT sales_inbound_emails_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES sales_accounts(id)
  ON DELETE SET NULL;
