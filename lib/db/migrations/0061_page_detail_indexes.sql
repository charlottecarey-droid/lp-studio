-- Per-page analytics detail view (Task #719) — supporting indexes.
--
-- The unified page-detail dashboard runs several windowed, page-scoped
-- aggregations (summary strip, traffic sources, paginated visits table). These
-- composite indexes keep those queries on index scans instead of seq scans:
--   * lp_page_visits (page_id, created_at)         — windowed visit counts + visits-table CTE
--   * lp_heatmap_events (page_id, session_id)      — per-session engagement enrichment
--   * lp_personalized_link_visits (link_id, visited_at) — personalized stream windowing/ordering

CREATE INDEX IF NOT EXISTS lp_page_visits_page_id_created_at_idx
  ON lp_page_visits (page_id, created_at);

CREATE INDEX IF NOT EXISTS lp_heatmap_events_page_id_session_id_idx
  ON lp_heatmap_events (page_id, session_id);

CREATE INDEX IF NOT EXISTS lp_personalized_link_visits_link_id_visited_at_idx
  ON lp_personalized_link_visits (link_id, visited_at);
