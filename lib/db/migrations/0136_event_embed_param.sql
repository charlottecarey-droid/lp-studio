-- Customisable embed link-param name per event (Aug 2026).
--
-- The agenda embed widget (0135) reads an URL param off the customer's own
-- event page to pick which agenda to render. The default name is
-- "lp_agenda", but event platforms already squat on obvious names —
-- RainFocus uses ?agenda on the very pages this widget targets
-- (procore.com/groundbreak) — so the name must be per-site configurable,
-- and it lives on the EVENT because one customer website hosts all of an
-- event's agendas: every copied link and the installed snippet's
-- data-param have to agree.
--
-- NULL = loader default ("lp_agenda"). Validated app-side to [A-Za-z0-9_-],
-- max 32 chars.

ALTER TABLE "sales_events" ADD COLUMN IF NOT EXISTS "embed_param" text;
