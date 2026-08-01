-- Time-on-page for the Sales Pages view (and per-page analytics).
--
-- Accumulated tab-VISIBLE seconds reported by the viewer's dwell beacon
-- (hooks/use-dwell-tracker.ts → POST /lp/track/dwell). The client reports a
-- cumulative total for the session and the server MAX-merges it onto the
-- visit row, so replayed / out-of-order beacons can never inflate the value.
-- Capped client- and server-side at 30 minutes so a tab left open overnight
-- doesn't poison averages. NULL = the visit predates dwell tracking (UIs
-- render "—" rather than treating it as zero).
ALTER TABLE lp_page_visits
  ADD COLUMN IF NOT EXISTS dwell_seconds integer;
