-- Page version history: a snapshot of a page's editable content, taken before
-- saves that change it, before restores, and before deletes. Lets a rep (or the
-- Claude connector) list a page's history and restore any earlier version, and
-- bring back a deleted page. page_id has no FK on purpose: a deleted page's
-- versions must outlive the page row.
CREATE TABLE IF NOT EXISTS "lp_page_versions" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL,
  "page_id" integer NOT NULL,
  "title" text NOT NULL DEFAULT '',
  "slug" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'draft',
  "snapshot" jsonb NOT NULL,
  "reason" text NOT NULL DEFAULT 'save',
  "note" text,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lp_page_versions_page_idx" ON "lp_page_versions" ("tenant_id", "page_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "lp_page_versions_deleted_idx" ON "lp_page_versions" ("tenant_id", "created_at" DESC) WHERE "reason" = 'delete';
