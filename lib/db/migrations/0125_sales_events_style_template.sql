-- Per-event agenda styling: publish every agenda of this event with the look
-- of one chosen page. A rep styles ONE agenda in the builder (colors, hero
-- layout, section styling), points the event at it, and every agenda published
-- for the event inherits that styling — so Groundbreak pages all match while
-- an executive event can look premium. ON DELETE SET NULL: a deleted template
-- page degrades to tenant defaults rather than breaking publish.
ALTER TABLE sales_events
  ADD COLUMN IF NOT EXISTS style_template_page_id integer
  REFERENCES lp_pages(id) ON DELETE SET NULL;
