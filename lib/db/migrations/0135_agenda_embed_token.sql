-- Embed token for sales event agendas (Aug 2026).
--
-- Third-party sites (a customer's own event page) embed a published agenda by
-- token: their page carries ?agenda=<token>, a loader script iframes
-- /api/embed/agenda/<token>, and the api-server 302s to the published
-- /lp/<slug> page. The token exists so those URLs stay opaque — the page slug
-- is agenda-<account>-<event>, which would leak the account list into any
-- marketing URL that carries it.
--
-- Minted on first publish, never rotated on republish (links printed into a
-- customer's website must not break). Globally unique BY DESIGN — this is a
-- random value we generate, not an external system's id (contrast 0133/0134):
-- the embed redirect resolves it with no tenant in hand and verifies the
-- request host's tenant against the agenda's tenant after lookup.

ALTER TABLE "sales_event_agendas" ADD COLUMN IF NOT EXISTS "embed_token" text;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_event_agendas_embed_token_key"
  ON "sales_event_agendas" ("embed_token")
  WHERE "embed_token" IS NOT NULL;
