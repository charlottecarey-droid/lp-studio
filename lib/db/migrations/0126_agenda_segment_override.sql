-- Per-agenda segment override.
--
-- The account's CRM segment is the default, but a conference's segment names
-- are often its own ("Owners" at the show vs "Owner/Developer" in Salesforce),
-- and a rep sometimes knows the attendee is coming as a different persona than
-- the account record says. NULL = use the account's segment.
ALTER TABLE sales_event_agendas
  ADD COLUMN IF NOT EXISTS segment_override text;
