-- Event-level catalog data that isn't a session: keynote speakers, sponsors
-- and the details derived from an import (event name, date span, venues).
--
-- One jsonb rather than three tables: this is import OUTPUT that the publish
-- route copies onto the agenda block's props, not something queried or joined.
-- Shape: { speakers: EvaPerson[], sponsors: EvaSponsor[], derived: {...},
--          importedAt: string }
ALTER TABLE sales_events
  ADD COLUMN IF NOT EXISTS catalog_extras jsonb NOT NULL DEFAULT '{}'::jsonb;
