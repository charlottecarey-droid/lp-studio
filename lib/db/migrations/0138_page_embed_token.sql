-- Per-page embed token (Aug 2026) — personalized website embeds.
--
-- Migration 0135 gave event agendas an opaque token so a customer's own
-- website could render a DIFFERENT agenda per visitor from one installed
-- snippet. This generalizes that to any published page: a link carrying
-- ?lp_page=<token> selects which page fills the embedded section, so a
-- homepage slot (or a whole body between the site's nav and footer) can be
-- personalized per account.
--
-- A token rather than the slug: these URLs are handed to named accounts,
-- and slugs read like "acme-corp-welcome" — using them would publish the
-- account list to anyone who collects the links.
--
-- Minted on demand (a page needs no token until someone copies a link) and
-- never rotated, because the links live in emails we cannot edit after
-- sending. Globally unique by design — the redirect resolves the token with
-- no tenant in hand, then verifies the request host's tenant against the
-- page's, exactly as 0135 does.

ALTER TABLE "lp_pages" ADD COLUMN IF NOT EXISTS "embed_token" text;

CREATE UNIQUE INDEX IF NOT EXISTS "lp_pages_embed_token_key"
  ON "lp_pages" ("embed_token")
  WHERE "embed_token" IS NOT NULL;
