-- Ensure at most one hotlink per (contact, page) so that find-or-create
-- in the campaign send/preview/test paths is concurrency-safe. We use a
-- PARTIAL index because contact_id is nullable (SET NULL on contact delete
-- during SFDC re-sync) and we don't want to constrain those rows.
CREATE UNIQUE INDEX IF NOT EXISTS sales_hotlinks_contact_page_unique
  ON sales_hotlinks (contact_id, page_id)
  WHERE contact_id IS NOT NULL;
