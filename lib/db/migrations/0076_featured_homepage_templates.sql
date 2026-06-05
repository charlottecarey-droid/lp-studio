-- Featured homepage templates — superadmin-editable list driving the marketing
-- homepage "templates" section (previously a hardcoded TEMPLATES array). The
-- table is idempotent (CREATE TABLE IF NOT EXISTS) and seeded with the six
-- entries that were hardcoded, but ONLY when the table is empty so a redeploy
-- never resurrects rows a superadmin deleted.
CREATE TABLE IF NOT EXISTS "featured_homepage_templates" (
  "id" serial PRIMARY KEY,
  "template_id" text NOT NULL,
  "title" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "thumbnail_url" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT '',
  "blocks_count" integer NOT NULL DEFAULT 0,
  "enabled" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "featured_homepage_templates_sort_idx"
  ON "featured_homepage_templates" ("sort_order");

INSERT INTO "featured_homepage_templates"
  ("template_id", "title", "description", "thumbnail_url", "category", "blocks_count", "enabled", "sort_order")
SELECT * FROM (VALUES
  ('product-launch-keynote', 'Product Launch Keynote',
    'Apple-event reveal style: sticky chapter nav, full-bleed hero with video, feature slabs, comparison table, plans, and a closing CTA. Toggle Light/Dark/Auto.',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&h=630&fit=crop',
    'Launch', 12, true, 0),
  ('inside-dandy-event', 'Executive Event RSVP',
    'Premium invite-only event landing page with a 3-day agenda, photo gallery, and multi-step RSVP form. Built for high-touch VIP events.',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=1200&h=630&fit=crop',
    'Events', 9, true, 1),
  ('story-hub-dark-luxury', 'Customer Story Hub',
    'Editorial dark-luxury gallery of customer stories. Cinematic featured hero, filterable grid, stats row, and closing CTA.',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1200&h=630&fit=crop',
    'Story', 10, true, 2),
  ('video-hero', 'Video Hero',
    'Lead with the demo video, back it up with proof. Highest-converting structure for warm traffic that already knows the category.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&h=630&fit=crop',
    'Marketing', 7, true, 3),
  ('social-proof-leader', 'Social Proof Leader',
    'Lead with a powerful customer testimonial. Skeptics trust peers more than brands — open with the quote, then back it with the why.',
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1200&h=630&fit=crop',
    'Sales', 8, true, 4),
  ('inside-dandy-spatial-tour', 'Immersive Product Tour',
    'Cinematic, vertical-journey landing page. Five-station scroll narrative, spatial-VR vibe, dark forest palette. For premium product reveals.',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&h=630&fit=crop',
    'Launch', 11, true, 5)
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM "featured_homepage_templates");
