import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runMigrations() {
  try {
    await db.execute(sql`
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS city text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS region text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS country text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS country_code text;

      CREATE TABLE IF NOT EXISTS lp_page_visits (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        session_id text NOT NULL,
        city text,
        region text,
        country text,
        country_code text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_library_items (
        id serial PRIMARY KEY,
        type text NOT NULL,
        name text NOT NULL DEFAULT '',
        content jsonb NOT NULL DEFAULT '{}',
        is_default boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_library_items_type_idx ON lp_library_items (type);

      CREATE TABLE IF NOT EXISTS lp_block_defaults (
        block_type text PRIMARY KEY,
        props jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE lp_block_defaults ADD COLUMN IF NOT EXISTS block_settings jsonb NOT NULL DEFAULT '{}';

      CREATE TABLE IF NOT EXISTS lp_custom_blocks (
        id serial PRIMARY KEY,
        name text NOT NULL DEFAULT 'Untitled Block',
        block_type text NOT NULL DEFAULT 'rich-text',
        props jsonb NOT NULL DEFAULT '{}',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE lp_custom_blocks ADD COLUMN IF NOT EXISTS block_settings jsonb NOT NULL DEFAULT '{}';

      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS animations_enabled boolean NOT NULL DEFAULT true;

      CREATE TABLE IF NOT EXISTS lp_brand_presets (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL,
        config jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_leads (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        variant_id integer,
        fields jsonb NOT NULL DEFAULT '{}',
        ip text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_leads_page_id_idx ON lp_leads (page_id);
      CREATE INDEX IF NOT EXISTS lp_leads_created_at_idx ON lp_leads (created_at);

      CREATE TABLE IF NOT EXISTS lp_form_notifications (
        id serial PRIMARY KEY,
        page_id integer NOT NULL UNIQUE REFERENCES lp_pages(id) ON DELETE CASCADE,
        email_recipients jsonb NOT NULL DEFAULT '[]',
        webhook_url text,
        marketo_config jsonb,
        salesforce_config jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_forms (
        id serial PRIMARY KEY,
        name text NOT NULL,
        description text,
        steps jsonb NOT NULL DEFAULT '[]',
        multi_step boolean NOT NULL DEFAULT false,
        submit_button_text text DEFAULT 'Submit',
        success_message text,
        redirect_url text,
        background_style text DEFAULT 'white',
        email_recipients jsonb NOT NULL DEFAULT '[]',
        webhook_url text,
        marketo_config jsonb,
        salesforce_config jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    logger.info("Migrations applied successfully");
  } catch (err) {
    logger.error({ err }, "Migration failed — continuing anyway");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
