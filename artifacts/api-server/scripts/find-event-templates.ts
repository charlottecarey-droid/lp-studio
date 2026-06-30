import { config } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const OUT = "/tmp/event-template-detail.json";
const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  writeFileSync(OUT, JSON.stringify({ error: "NO_DB_URL" }, null, 2));
  console.log("NO_DB_URL");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const summit = await pool.query(
    `SELECT id, slug, title, template_label, template_description, industry, category,
            keywords, is_all_in_one, is_global, is_template, status, og_image,
            meta_title, meta_description, custom_css, page_variables, blocks
     FROM lp_pages WHERE slug = 'premium-executive-event-rsvp' LIMIT 1;`,
  );
  const featured = await pool.query(
    `SELECT id, template_id, title, category, enabled, sort_order
     FROM featured_homepage_templates
     WHERE template_id ILIKE '%event%' OR template_id ILIKE '%summit%'
        OR template_id IN ('5017','69152','global-flagship-event-landing','premium-executive-event-rsvp');`,
  );
  writeFileSync(
    OUT,
    JSON.stringify({ summit: summit.rows, featured: featured.rows }, null, 2),
  );
  console.log("WROTE detail; summit rows:", summit.rows.length, "featured rows:", featured.rows.length);
} catch (e) {
  writeFileSync(OUT, JSON.stringify({ error: String(e) }, null, 2));
  console.log("QUERY_ERR");
} finally {
  await pool.end();
}
