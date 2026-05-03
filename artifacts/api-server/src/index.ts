import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runMigrations(): Promise<void> {
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
      ALTER TABLE lp_custom_blocks ADD COLUMN IF NOT EXISTS tenant_id integer;
      ALTER TABLE lp_custom_blocks ADD COLUMN IF NOT EXISTS segment text NOT NULL DEFAULT 'core';

      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS animations_enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS smooth_scroll boolean NOT NULL DEFAULT true;

      -- Page review workflow (task #108). All columns are nullable; only populated
      -- while a review is in flight or right after a decision is recorded.
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS submitted_by_user_id integer;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS last_review_decision_by text;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS last_review_decision_at timestamptz;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS last_review_note text;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS asana_task_id text;

      ALTER TABLE lp_media ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';

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

      CREATE TABLE IF NOT EXISTS lp_integrations (
        id serial PRIMARY KEY,
        provider text NOT NULL UNIQUE,
        config jsonb NOT NULL DEFAULT '{}',
        enabled boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Smart Traffic
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE lp_tests ADD COLUMN IF NOT EXISTS smart_traffic_enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_tests ADD COLUMN IF NOT EXISTS smart_traffic_min_samples integer NOT NULL DEFAULT 100;

      CREATE TABLE IF NOT EXISTS lp_smart_traffic_stats (
        id serial PRIMARY KEY,
        test_id integer NOT NULL REFERENCES lp_tests(id) ON DELETE CASCADE,
        variant_id integer NOT NULL REFERENCES lp_variants(id) ON DELETE CASCADE,
        feature_bucket text NOT NULL DEFAULT 'global',
        successes integer NOT NULL DEFAULT 0,
        failures integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT smart_traffic_stats_unique UNIQUE (test_id, variant_id, feature_bucket)
      );

      CREATE TABLE IF NOT EXISTS lp_heatmap_events (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        session_id text NOT NULL,
        event_type text NOT NULL,
        x_pct real,
        y_pct real,
        block_id text,
        element_tag text,
        scroll_depth_pct real,
        viewport_width integer,
        viewport_height integer,
        device text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      -- ─── DSO tables (dso_ prefix to avoid collisions) ─────────────────────

      CREATE TABLE IF NOT EXISTS dso_microsites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text UNIQUE NOT NULL,
        company_name text NOT NULL,
        briefing_data jsonb NOT NULL DEFAULT '{}',
        tier text,
        skin text NOT NULL DEFAULT 'executive',
        salesforce_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_practice_signups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_slug text NOT NULL,
        company_name text NOT NULL,
        practice_name text NOT NULL,
        contact_name text NOT NULL,
        contact_email text NOT NULL,
        contact_phone text,
        practice_address text,
        num_operatories integer,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_views (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        slug text NOT NULL,
        viewed_at timestamptz NOT NULL DEFAULT now(),
        referrer text,
        user_agent text
      );
      CREATE INDEX IF NOT EXISTS idx_dso_microsite_views_slug ON dso_microsite_views(slug);
      CREATE INDEX IF NOT EXISTS idx_dso_microsite_views_microsite_id ON dso_microsite_views(microsite_id);

      CREATE TABLE IF NOT EXISTS dso_microsite_hotlinks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        recipient_name text NOT NULL,
        token text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE dso_microsite_views
        ADD COLUMN IF NOT EXISTS hotlink_id uuid REFERENCES dso_microsite_hotlinks(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS dso_microsite_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        slug text NOT NULL,
        event_type text NOT NULL,
        event_data jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_dso_microsite_events_microsite_id ON dso_microsite_events(microsite_id);

      CREATE TABLE IF NOT EXISTS dso_microsite_alerts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        alert_type text NOT NULL,
        title text NOT NULL,
        detail jsonb DEFAULT '{}',
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_alert_emails (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(microsite_id, email)
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_ab_tests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        skin_key text NOT NULL,
        test_name text NOT NULL,
        content_block text NOT NULL,
        variant_a_label text NOT NULL,
        variant_a_value text NOT NULL,
        variant_b_label text NOT NULL,
        variant_b_value text NOT NULL,
        success_metric text NOT NULL DEFAULT 'views',
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_ab_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id uuid NOT NULL REFERENCES dso_microsite_ab_tests(id) ON DELETE CASCADE,
        variant text NOT NULL,
        event_type text NOT NULL,
        time_on_page_seconds numeric,
        visitor_id text,
        microsite_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_target_contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        salesforce_id text,
        parent_company text NOT NULL DEFAULT '',
        first_name text,
        last_name text,
        title text,
        title_level text,
        department text,
        contact_role text,
        email text,
        phone text,
        linkedin_url text,
        gender text,
        dso_size text,
        pe_firm text,
        created_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_dso_target_contacts_email ON dso_target_contacts (LOWER(email)) WHERE email IS NOT NULL AND email != '';

      CREATE TABLE IF NOT EXISTS dso_email_lists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_email_list_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        list_id uuid NOT NULL REFERENCES dso_email_lists(id) ON DELETE CASCADE,
        contact_id uuid NOT NULL REFERENCES dso_target_contacts(id) ON DELETE CASCADE,
        added_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (list_id, contact_id)
      );

      CREATE TABLE IF NOT EXISTS dso_marketing_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        subject text NOT NULL,
        html_body text,
        plain_body text,
        format text NOT NULL DEFAULT 'plain',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_email_campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        list_id uuid REFERENCES dso_email_lists(id),
        template_id uuid REFERENCES dso_marketing_templates(id),
        template_b_id uuid REFERENCES dso_marketing_templates(id),
        status text NOT NULL DEFAULT 'draft',
        utm_source text DEFAULT 'dandy_dso',
        utm_medium text DEFAULT 'email',
        utm_campaign text,
        utm_content text,
        sender_name text NOT NULL DEFAULT 'Dandy DSO Partnerships',
        sender_email text NOT NULL DEFAULT 'partnerships',
        reply_to_email text NOT NULL DEFAULT 'sales@meetdandy.com',
        ab_test_enabled boolean NOT NULL DEFAULT false,
        scheduled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_email_campaign_sends (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL REFERENCES dso_email_campaigns(id) ON DELETE CASCADE,
        contact_id uuid REFERENCES dso_target_contacts(id),
        recipient_email text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        sent_at timestamptz,
        opened_at timestamptz,
        clicked_at timestamptz,
        variant text
      );

      CREATE TABLE IF NOT EXISTS dso_email_outreach_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid REFERENCES dso_microsites(id) ON DELETE SET NULL,
        hotlink_id uuid REFERENCES dso_microsite_hotlinks(id) ON DELETE SET NULL,
        contact_id uuid REFERENCES dso_target_contacts(id) ON DELETE SET NULL,
        recipient_email text NOT NULL,
        recipient_name text NOT NULL,
        subject text,
        sent_at timestamptz NOT NULL DEFAULT now(),
        opened_at timestamptz,
        clicked_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS dso_email_unsubscribes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_suppressed_emails (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        reason text NOT NULL DEFAULT 'bounce',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_layout_defaults (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_key text NOT NULL UNIQUE,
        config jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_custom_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        background_url text NOT NULL DEFAULT '',
        orientation text NOT NULL DEFAULT 'portrait',
        fields jsonb NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_pdf_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dso_name text NOT NULL,
        practice_count integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_cta_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        first_name text,
        last_name text,
        company_name text,
        source text,
        microsite_id uuid REFERENCES dso_microsites(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE dso_cta_submissions ADD COLUMN IF NOT EXISTS first_name text;
      ALTER TABLE dso_cta_submissions ADD COLUMN IF NOT EXISTS last_name text;
      ALTER TABLE dso_cta_submissions ADD COLUMN IF NOT EXISTS company_name text;
      CREATE INDEX IF NOT EXISTS idx_dso_cta_submissions_email ON dso_cta_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_dso_cta_submissions_created_at ON dso_cta_submissions(created_at DESC);

      CREATE OR REPLACE FUNCTION fn_dso_alert_on_view()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        site_name text;
        hl_name text;
      BEGIN
        SELECT company_name INTO site_name FROM dso_microsites WHERE id = NEW.microsite_id;
        IF NEW.hotlink_id IS NOT NULL THEN
          SELECT recipient_name INTO hl_name FROM dso_microsite_hotlinks WHERE id = NEW.hotlink_id;
        END IF;
        INSERT INTO dso_microsite_alerts (microsite_id, alert_type, title, detail)
        VALUES (
          NEW.microsite_id,
          CASE WHEN NEW.hotlink_id IS NOT NULL THEN 'hotlink_visit' ELSE 'page_visit' END,
          CASE WHEN hl_name IS NOT NULL THEN hl_name || ' visited ' || COALESCE(site_name, 'a microsite')
               ELSE 'New visit on ' || COALESCE(site_name, 'a microsite') END,
          jsonb_build_object('slug', NEW.slug, 'recipient_name', hl_name, 'referrer', NEW.referrer)
        );
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_dso_alert_on_view ON dso_microsite_views;
      CREATE TRIGGER trg_dso_alert_on_view AFTER INSERT ON dso_microsite_views
      FOR EACH ROW EXECUTE FUNCTION fn_dso_alert_on_view();

      CREATE OR REPLACE FUNCTION fn_dso_alert_on_event()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        site_name text;
      BEGIN
        IF NEW.event_type <> 'cta_click' THEN RETURN NEW; END IF;
        SELECT company_name INTO site_name FROM dso_microsites WHERE id = NEW.microsite_id;
        INSERT INTO dso_microsite_alerts (microsite_id, alert_type, title, detail)
        VALUES (
          NEW.microsite_id, 'cta_click',
          'CTA clicked on ' || COALESCE(site_name, 'a microsite'),
          COALESCE(NEW.event_data, '{}')
        );
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_dso_alert_on_event ON dso_microsite_events;
      CREATE TRIGGER trg_dso_alert_on_event AFTER INSERT ON dso_microsite_events
      FOR EACH ROW EXECUTE FUNCTION fn_dso_alert_on_event();

      CREATE OR REPLACE FUNCTION fn_dso_alert_on_signup()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO dso_microsite_alerts (microsite_id, alert_type, title, detail)
        SELECT m.id, 'practice_signup',
          NEW.contact_name || ' signed up from ' || NEW.company_name,
          jsonb_build_object('practice_name', NEW.practice_name, 'contact_email', NEW.contact_email, 'contact_name', NEW.contact_name)
        FROM dso_microsites m WHERE m.slug = NEW.microsite_slug
        LIMIT 1;
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_dso_alert_on_signup ON dso_practice_signups;
      CREATE TRIGGER trg_dso_alert_on_signup AFTER INSERT ON dso_practice_signups
      FOR EACH ROW EXECUTE FUNCTION fn_dso_alert_on_signup();

      -- Additional columns added post-initial migration
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS abm_stage text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS website text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS city text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS state text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS country text DEFAULT 'United States';
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS segment text;
      ALTER TABLE dso_email_outreach_log ADD COLUMN IF NOT EXISTS salesforce_id text;
      CREATE INDEX IF NOT EXISTS idx_dso_email_outreach_log_sfdc ON dso_email_outreach_log(salesforce_id) WHERE salesforce_id IS NOT NULL;
      ALTER TABLE dso_microsites ADD COLUMN IF NOT EXISTS abm_stage text;
      ALTER TABLE dso_microsites ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

      -- Personalized links for LP Studio pages
      CREATE TABLE IF NOT EXISTS lp_personalized_links (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        contact_name text NOT NULL,
        company text,
        email text,
        token text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_lp_personalized_links_page ON lp_personalized_links(page_id);
      CREATE INDEX IF NOT EXISTS idx_lp_personalized_links_token ON lp_personalized_links(token);

      CREATE TABLE IF NOT EXISTS lp_personalized_link_visits (
        id serial PRIMARY KEY,
        link_id integer NOT NULL REFERENCES lp_personalized_links(id) ON DELETE CASCADE,
        ip text,
        city text,
        region text,
        country text,
        scroll_depth_pct real,
        cta_clicks integer NOT NULL DEFAULT 0,
        visited_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_lp_pl_visits_link ON lp_personalized_link_visits(link_id);

      CREATE TABLE IF NOT EXISTS lp_page_alert_emails (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(page_id, email)
      );
      CREATE INDEX IF NOT EXISTS idx_lp_page_alert_emails_page ON lp_page_alert_emails(page_id);

      -- LP Studio page variables (personalization tokens)
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS page_variables jsonb DEFAULT '{}';

      -- Sales Console tables
      CREATE TABLE IF NOT EXISTS sales_accounts (
        id serial PRIMARY KEY,
        name text NOT NULL,
        domain text,
        industry text,
        segment text,
        parent_account_id integer,
        status text NOT NULL DEFAULT 'prospect',
        owner text,
        notes text,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_contacts (
        id serial PRIMARY KEY,
        account_id integer NOT NULL REFERENCES sales_accounts(id) ON DELETE CASCADE,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        title text,
        role text,
        phone text,
        status text NOT NULL DEFAULT 'active',
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_contacts_account ON sales_contacts(account_id);

      CREATE TABLE IF NOT EXISTS sales_signals (
        id serial PRIMARY KEY,
        account_id integer REFERENCES sales_accounts(id) ON DELETE CASCADE,
        contact_id integer,
        hotlink_id integer,
        type text NOT NULL,
        source text,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_signals_account ON sales_signals(account_id);
      CREATE INDEX IF NOT EXISTS idx_sales_signals_created ON sales_signals(created_at DESC);

      CREATE TABLE IF NOT EXISTS sales_hotlinks (
        id serial PRIMARY KEY,
        token text NOT NULL UNIQUE,
        contact_id integer NOT NULL REFERENCES sales_contacts(id) ON DELETE CASCADE,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_token ON sales_hotlinks(token);

      CREATE TABLE IF NOT EXISTS sales_email_templates (
        id serial PRIMARY KEY,
        name text NOT NULL,
        subject text NOT NULL,
        body_html text NOT NULL,
        body_text text,
        merge_vars jsonb DEFAULT '[]',
        category text DEFAULT 'general',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE sales_email_templates ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'plain';

      CREATE TABLE IF NOT EXISTS sales_email_campaigns (
        id serial PRIMARY KEY,
        name text NOT NULL,
        template_id integer NOT NULL REFERENCES sales_email_templates(id),
        account_id integer REFERENCES sales_accounts(id),
        status text NOT NULL DEFAULT 'draft',
        scheduled_at timestamptz,
        sent_at timestamptz,
        recipient_count integer DEFAULT 0,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_email_sends (
        id serial PRIMARY KEY,
        campaign_id integer REFERENCES sales_email_campaigns(id) ON DELETE CASCADE,
        contact_id integer NOT NULL,
        hotlink_id integer,
        email text NOT NULL,
        status text NOT NULL DEFAULT 'queued',
        sent_at timestamptz,
        opened_at timestamptz,
        clicked_at timestamptz,
        bounced_at timestamptz,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_email_sends_campaign ON sales_email_sends(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_sales_email_sends_contact ON sales_email_sends(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_contact ON sales_hotlinks(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_page ON sales_hotlinks(page_id);
      CREATE INDEX IF NOT EXISTS idx_sales_signals_contact ON sales_signals(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_signals_type ON sales_signals(type);

      CREATE TABLE IF NOT EXISTS sales_inbound_emails (
        id serial PRIMARY KEY,
        contact_id integer,
        account_id integer,
        message_id text,
        in_reply_to text,
        from_email text NOT NULL,
        from_name text,
        to_email text NOT NULL,
        subject text,
        body_text text,
        body_html text,
        is_read text NOT NULL DEFAULT 'false',
        metadata jsonb DEFAULT '{}',
        received_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_inbound_contact ON sales_inbound_emails(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_inbound_received ON sales_inbound_emails(received_at DESC);

      -- Sales one-pager custom templates
      CREATE TABLE IF NOT EXISTS sales_one_pager_templates (
        id serial PRIMARY KEY,
        tenant_id integer NOT NULL,
        name text NOT NULL,
        background_url text NOT NULL DEFAULT '',
        orientation text NOT NULL DEFAULT 'portrait',
        fields jsonb NOT NULL DEFAULT '[]',
        header_height integer NOT NULL DEFAULT 30,
        header_image_url text,
        is_deleted boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_one_pager_templates_tenant ON sales_one_pager_templates(tenant_id);

      -- UTM tracking columns on sessions and page visits
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_source text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_medium text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_campaign text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_term text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_content text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_source text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_medium text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_campaign text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_term text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_content text;
      CREATE INDEX IF NOT EXISTS lp_sessions_utm_source_idx ON lp_sessions (utm_source) WHERE utm_source IS NOT NULL;
      CREATE INDEX IF NOT EXISTS lp_page_visits_utm_source_idx ON lp_page_visits (utm_source) WHERE utm_source IS NOT NULL;

      -- UTM tracking columns on leads (for SFDC attribution)
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_source text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_medium text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_campaign text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_term text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_content text;

      -- Schema migration marker table (used to run one-time data migrations safely)
      CREATE TABLE IF NOT EXISTS _schema_migration_markers (
        key text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );

      -- Short-lived exchange codes for cross-domain session handoff (prevents tokens in URLs)
      CREATE TABLE IF NOT EXISTS auth_exchange_codes (
        code text PRIMARY KEY,
        sid text NOT NULL REFERENCES app_sessions(sid) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_exchange_codes_expires ON auth_exchange_codes(expires_at);

      -- Tenant onboarding tracking
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

      -- Global landing-page templates (cross-tenant template library, scoped by industry)
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS industry text;

      -- One-time backfill: mark all tenants that existed BEFORE the onboarding wizard was
      -- introduced as already onboarded so they never see the wizard. This block only runs
      -- once (guarded by the migration marker) so new tenants created after deployment keep
      -- NULL until they complete the wizard themselves.
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM _schema_migration_markers WHERE key = 'onboarding_backfill_v1'
        ) THEN
          UPDATE tenants SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;
          INSERT INTO _schema_migration_markers (key) VALUES ('onboarding_backfill_v1');
        END IF;
      END;
      $$;
    `);
    logger.info("Migrations applied successfully");

    // One-shot backfill of tenants.settings.industry so existing rows get the
    // correct industry without manual DB intervention. Tenants #1 and #5 are
    // Dandy dental tenants; everyone else defaults to "generic". Guarded by a
    // marker so we never overwrite later admin edits.
    try {
      const backfillMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'tenant_industry_backfill_v1'`
      );
      if (backfillMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET settings = COALESCE(settings, '{}'::jsonb)
                          || jsonb_build_object('industry', CASE WHEN id IN (1, 5) THEN 'dental' ELSE 'generic' END)
           WHERE settings IS NULL
              OR NOT (settings ? 'industry')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('tenant_industry_backfill_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("tenants.settings.industry backfill applied");
      }
    } catch (backfillErr) {
      logger.error({ err: backfillErr }, "tenant industry backfill failed (non-fatal)");
    }

    // Task #108 — page review workflow rollout. Two backfills, both idempotent
    // and marker-guarded so reboots are no-ops:
    //   1. Add the system "Content Manager" role to every tenant that lacks
    //      one. Existing custom roles are NEVER touched.
    //   2. Extend the system "Admin" role's permissions with the new
    //      pages.publish + pages.review keys so today's tenant admins keep the
    //      ability to publish without anyone re-saving the role through the UI.
    try {
      const reviewMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'page_review_role_seed_v1'`
      );
      if (reviewMarker.rows.length === 0) {
        const cmPerms = JSON.stringify({
          pages: true, "pages.publish": true, "pages.review": true,
          tests: true, analytics: true, forms_leads: true, brand: true,
          blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
          sales_outreach: true, sales_campaigns: false, sales_signals: true, settings: false, team: false, roles: false,
        });
        await db.execute(sql`
          INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
          SELECT t.id, 'Content Manager', ${cmPerms}::jsonb, false, true
            FROM tenants t
           WHERE NOT EXISTS (
             SELECT 1 FROM tenant_roles r
              WHERE r.tenant_id = t.id AND r.name = 'Content Manager'
           )
        `);
        await db.execute(sql`
          UPDATE tenant_roles
             SET permissions = permissions
                            || '{"pages.publish": true, "pages.review": true}'::jsonb,
                 updated_at = now()
           WHERE is_system = true
             AND name = 'Admin'
             AND (NOT (permissions ? 'pages.publish') OR NOT (permissions ? 'pages.review'))
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('page_review_role_seed_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("Content Manager role + admin perms backfill applied");
      }
    } catch (cmErr) {
      logger.error({ err: cmErr }, "page-review role backfill failed (non-fatal)");
    }

    // Task #113 — page-review-workflow toggle rollout. Mark every tenant that
    // existed BEFORE this change as `requireReviewBeforePublish=true` so they
    // continue to see the Submit/Approve/Reject UI without anyone toggling
    // anything. Tenants created AFTER this change default to FALSE in the
    // POST /api/admin/tenants insert. Marker-guarded so reboots are no-ops
    // and admins who later flip the toggle off are never overwritten.
    try {
      const reviewToggleMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'require_review_toggle_backfill_v1'`
      );
      if (reviewToggleMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET settings = COALESCE(settings, '{}'::jsonb)
                          || '{"requireReviewBeforePublish": true}'::jsonb,
                 updated_at = now()
           WHERE settings IS NULL
              OR NOT (settings ? 'requireReviewBeforePublish')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('require_review_toggle_backfill_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("requireReviewBeforePublish backfill applied");
      }
    } catch (toggleErr) {
      logger.error({ err: toggleErr }, "require-review toggle backfill failed (non-fatal)");
    }

    // Idempotent first-boot seed for the block_catalog table. Safe to run on
    // every boot — uses ON CONFLICT DO NOTHING so admin edits are never
    // clobbered. Adds rows only when missing.
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS block_catalog (
          block_type    text NOT NULL,
          industry      text NOT NULL,
          label         text NOT NULL,
          category      text NOT NULL,
          default_props jsonb NOT NULL DEFAULT '{}'::jsonb,
          is_enabled    boolean NOT NULL DEFAULT true,
          sort_order    integer NOT NULL DEFAULT 0,
          updated_by    integer,
          created_at    timestamptz NOT NULL DEFAULT now(),
          updated_at    timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (block_type, industry)
        );
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS block_catalog_industry_idx ON block_catalog(industry);`);
      // Backfill `updated_by` on databases whose block_catalog was created
      // before that column existed in the CREATE TABLE above. CREATE TABLE
      // IF NOT EXISTS is a no-op for an existing table, so without this
      // ALTER the superadmin GET /admin/block-catalog (which selects
      // updated_by) would 500 with `column "updated_by" does not exist`.
      await db.execute(sql`ALTER TABLE block_catalog ADD COLUMN IF NOT EXISTS updated_by integer;`);
      // Marker table so we only attempt the heavyweight seed once, even though
      // the inserts themselves are idempotent — keeps boot time low.
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS _schema_migration_markers (key text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      `);
      // v3: cleans up the 21 dandy-*/dso-* rows that v2 incorrectly seeded
      // into the generic catalog (their BLOCK_REGISTRY defaults leak Dandy
      // branding when rendered with DEFAULT_BRAND — caught by no-dandy-leak
      // tests). Also cleans up 5 "neutral-sounding" rows whose component
      // code hardcodes Dandy colors/copy. Then runs the standard upsert.
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'block_catalog_generic_seed_v3'`
      );
      const alreadySeeded = marker.rows.length > 0;
      if (!alreadySeeded) {
        // Targeted cleanup of the v2 mis-seed. Only deletes the specific
        // block_types we know we shouldn't have inserted; admin-curated
        // entries for any other block_type are untouched.
        const LEAKY_TYPES_TO_REMOVE = [
          "dandy-cta-block", "dandy-form-right-alt", "dandy-product-hero",
          "dandy-site-footer", "dandy-site-header", "dandy-switchback",
          "dandy-versus", "dandy-vertical-tabs", "dandy-video-testimonials",
          "dso-heartland-hero", "dso-insights-dashboard", "dso-insights-video",
          "dso-lab-tour", "dso-partnership-perks", "dso-practice-hero",
          "dso-practice-nav",
          "horizontal-showcase", "bold-statement", "sticky-stack",
          "event-page", "spatial-tour",
        ];
        let removed = 0;
        for (const badType of LEAKY_TYPES_TO_REMOVE) {
          const cleanup = await db.execute<{ block_type: string }>(sql`
            DELETE FROM block_catalog
             WHERE industry = 'generic' AND block_type = ${badType}
            RETURNING block_type
          `);
          removed += cleanup.rows.length;
        }

        const { GENERIC_BLOCK_CATALOG_SEED } = await import("./seeds/blockCatalog");
        let inserted = 0;
        for (const row of GENERIC_BLOCK_CATALOG_SEED) {
          const propsJson = JSON.stringify(row.default_props ?? {});
          const result = await db.execute<{ "?column?": number }>(sql`
            INSERT INTO block_catalog (block_type, industry, label, category, default_props, sort_order)
            VALUES (${row.block_type}, 'generic', ${row.label}, ${row.category}, ${propsJson}::jsonb, ${row.sort_order ?? 0})
            ON CONFLICT (block_type, industry) DO NOTHING
            RETURNING 1
          `);
          if (result.rows.length > 0) inserted++;
        }
        await db.execute(sql`
          INSERT INTO _schema_migration_markers (key) VALUES ('block_catalog_generic_seed_v3') ON CONFLICT DO NOTHING
        `);
        logger.info(
          { removed, inserted, total: GENERIC_BLOCK_CATALOG_SEED.length },
          "block_catalog generic seed applied (v3 cleanup)"
        );
      }
    } catch (seedErr) {
      // Don't block boot on seed errors — admins can re-run scripts/seed-block-catalog.cjs
      logger.error({ err: seedErr }, "block_catalog seed failed (non-fatal)");
    }

    // Idempotent seed for the global landing-page templates available to all
    // generic-industry tenants. Owned by the lowest-id tenant (Dandy) by
    // default — `is_global=true` makes ownership irrelevant for visibility.
    // Marker-gated so we only attempt once per database.
    // Global templates seed — runs on every boot until the latest marker is
    // present. We bumped from v1 → v2 when the starter library was rewritten
    // with real BLOCK_REGISTRY block types and ogImage thumbnails. The upsert
    // below replaces blocks/labels/og_image on existing rows so older seeded
    // entries (v1) get their bogus block types fixed, but tenant edits to
    // titles or new template additions remain untouched.
    try {
      const SEED_MARKER = "global_templates_seed_v8";
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = ${SEED_MARKER}`
      );
      if (marker.rows.length === 0) {
        const ownerRow = await db.execute<{ id: number }>(
          sql`SELECT id FROM tenants ORDER BY id ASC LIMIT 1`,
        );
        const ownerId = ownerRow.rows[0]?.id;
        if (!ownerId) {
          logger.warn("Skipping global_templates seed — no tenants exist yet");
        } else {
          const { GLOBAL_TEMPLATE_SEEDS } = await import("./seeds/globalTemplates");
          let upserted = 0;
          for (const tpl of GLOBAL_TEMPLATE_SEEDS) {
            const blocksJson = JSON.stringify(tpl.blocks);
            const result = await db.execute<{ "?column?": number }>(sql`
              INSERT INTO lp_pages (
                tenant_id, title, slug, blocks, status,
                is_template, template_label, template_description,
                is_global, industry, mode, og_image
              ) VALUES (
                ${ownerId}, ${tpl.title}, ${tpl.slug}, ${blocksJson}::jsonb, 'draft',
                true, ${tpl.templateLabel}, ${tpl.templateDescription},
                true, ${tpl.industry}, 'marketing', ${tpl.ogImage}
              )
              ON CONFLICT (tenant_id, slug) DO UPDATE SET
                blocks               = EXCLUDED.blocks,
                template_label       = EXCLUDED.template_label,
                template_description = EXCLUDED.template_description,
                og_image             = EXCLUDED.og_image,
                is_template          = true,
                is_global            = true,
                industry             = EXCLUDED.industry
              RETURNING 1
            `);
            if (result.rows.length > 0) upserted++;
          }
          await db.execute(sql`
            INSERT INTO _schema_migration_markers (key) VALUES (${SEED_MARKER}) ON CONFLICT DO NOTHING
          `);
          logger.info({ upserted, total: GLOBAL_TEMPLATE_SEEDS.length }, "global_templates seed applied");
        }
      }
    } catch (seedErr) {
      logger.error({ err: seedErr }, "global_templates seed failed (non-fatal)");
    }
  } catch (err) {
    logger.error({ err }, "Migration failed — halting server startup");
    throw err;
  }
}

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to start server: migrations failed");
    process.exit(1);
  });
