-- Fix 4 (Prompt 2 / database integrity) — index lp_events(page_id, created_at).
--
-- lp_events is the per-page analytics event stream (~4.7k rows and growing).
-- Page-scoped, time-ordered reads (per-page event timelines, recent-activity
-- windows) currently fall back to a seq scan + sort because no existing index
-- leads with page_id. Add a composite (page_id, created_at DESC) index.
--
-- Plain CREATE INDEX (NOT CONCURRENTLY): the migration runner wraps the whole
-- batch in a single transaction, and CREATE INDEX CONCURRENTLY is disallowed
-- inside a transaction. The table is small, so the brief lock is fine. This
-- mirrors 0061, which added the page-detail indexes the same way.
--
-- IF NOT EXISTS keeps it idempotent / a no-op on re-run.
--
-- Journal note: this is idx 73 (when 1752600000000). The destructive orphan
-- cleanup (Fix 3) is reserved for 0072 and must be journaled with a `when`
-- GREATER than 1752600000000 (e.g. 1752700000000) so prod's migration
-- high-water mark does not silently skip it.

CREATE INDEX IF NOT EXISTS lp_events_page_id_created_at_idx
  ON lp_events (page_id, created_at DESC);
