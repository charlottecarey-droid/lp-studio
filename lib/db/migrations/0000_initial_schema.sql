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
      ALTER TABLE lp_library_items ADD COLUMN IF NOT EXISTS tenant_id integer;
      -- Task #253 — "Approved for AI" flag (gated by Strict Facts Mode at
      -- generation time). Defaults to TRUE so existing rows stay usable.
      ALTER TABLE lp_library_items ADD COLUMN IF NOT EXISTS approved_for_ai boolean NOT NULL DEFAULT true;

      -- Task #256 — first-class, tenant-scoped proof-point library. One
      -- approved entry can flow through every page and segment that needs
      -- the same number, instead of re-typing it per segment.
      CREATE TABLE IF NOT EXISTS lp_proof_points (
        id              serial PRIMARY KEY,
        tenant_id       integer NOT NULL,
        value           text NOT NULL DEFAULT '',
        label           text NOT NULL DEFAULT '',
        source_url      text NOT NULL DEFAULT '',
        as_of_date      date,
        approved_for_ai boolean NOT NULL DEFAULT true,
        sort_order      integer NOT NULL DEFAULT 0,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_proof_points_tenant_idx ON lp_proof_points (tenant_id);

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

      -- Task #208: track brand-import provenance (source URL + timestamp + per-field confidence)
      ALTER TABLE lp_brand_settings ADD COLUMN IF NOT EXISTS brand_import_source_url text;
      ALTER TABLE lp_brand_settings ADD COLUMN IF NOT EXISTS brand_import_at timestamptz;
      ALTER TABLE lp_brand_settings ADD COLUMN IF NOT EXISTS brand_import_summary jsonb;

      -- Task #209: per-page ad copy generation history. One row per
      -- generation run; the latest row populates the panel on open and the
      -- "previous runs" dropdown lists older runs for revisit/restore.
      CREATE TABLE IF NOT EXISTS lp_page_ad_copy_runs (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        tenant_id integer NOT NULL,
        input_summary jsonb NOT NULL DEFAULT '{}',
        output jsonb NOT NULL DEFAULT '{}',
        created_by text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_page_ad_copy_runs_page_idx ON lp_page_ad_copy_runs (page_id);
      CREATE INDEX IF NOT EXISTS lp_page_ad_copy_runs_tenant_idx ON lp_page_ad_copy_runs (tenant_id);
      -- If the table already existed (created in a prior boot) without the FK,
      -- attach it now. The DO block lets us no-op when the constraint is
      -- already in place.
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'lp_page_ad_copy_runs_page_id_fkey'
        ) THEN
          BEGIN
            ALTER TABLE lp_page_ad_copy_runs
              ADD CONSTRAINT lp_page_ad_copy_runs_page_id_fkey
              FOREIGN KEY (page_id) REFERENCES lp_pages(id) ON DELETE CASCADE;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;
      END$$;

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
        -- template_id is nullable: draft campaigns are created without a
        -- template and a template is picked later in the campaign editor.
        -- Only "scheduled"/"sending"/"sent" campaigns must have one (enforced
        -- in the POST /sales/campaigns route).
        template_id integer REFERENCES sales_email_templates(id),
        account_id integer REFERENCES sales_accounts(id),
        status text NOT NULL DEFAULT 'draft',
        scheduled_at timestamptz,
        sent_at timestamptz,
        recipient_count integer DEFAULT 0,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Existing prod tables were created with template_id NOT NULL, which
      -- breaks "New Campaign" (draft campaigns intentionally start without
      -- a template). CREATE TABLE IF NOT EXISTS skips the new definition
      -- above on existing databases, so we drop the constraint explicitly
      -- here. Safe to run repeatedly.
      ALTER TABLE sales_email_campaigns ALTER COLUMN template_id DROP NOT NULL;

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
      -- Task #134 — gate the post-onboarding welcome email so it fires once per tenant
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

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

      -- Task #133 — slug rename redirects. Each row maps an old (renamed)
      -- slug back to its tenant for a limited window so existing bookmarks
      -- to <oldslug>.lpstudio.ai keep working.
      CREATE TABLE IF NOT EXISTS tenant_slug_redirects (
        old_slug      text PRIMARY KEY,
        tenant_id     integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        expires_at    timestamptz NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tenant_slug_redirects_tenant_id_idx
        ON tenant_slug_redirects (tenant_id);
      CREATE INDEX IF NOT EXISTS tenant_slug_redirects_expires_at_idx
        ON tenant_slug_redirects (expires_at);

      -- Task #152 — track when admins were warned that a slug redirect
      -- is about to expire so the warning job stays idempotent (each
      -- redirect notified at most once).
      ALTER TABLE tenant_slug_redirects
        ADD COLUMN IF NOT EXISTS notified_at timestamptz;

      -- Task #147 — per-tenant inbound webhook secrets. The public webhook
      -- endpoints (/webhooks/rb2b, /webhooks/apollo, /webhooks/letterdrop)
      -- now embed a per-tenant secret in the URL so signals route to the
      -- correct tenant instead of being hardcoded to Dandy (#1).
      CREATE TABLE IF NOT EXISTS tenant_webhook_secrets (
        id            serial PRIMARY KEY,
        tenant_id     integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        integration   text NOT NULL,
        secret        text NOT NULL UNIQUE,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tenant_webhook_secrets_tenant_integration_idx
        ON tenant_webhook_secrets (tenant_id, integration);
      CREATE INDEX IF NOT EXISTS tenant_webhook_secrets_secret_idx
        ON tenant_webhook_secrets (secret);

      -- Task #146 / #236 — explicit tenant_id on sales_briefings, sfdc_opportunities,
      -- and sfdc_leads. The corresponding migration file
      -- (lib/db/migrations/0009_sales_sfdc_tenant_id.sql) was renumbered on
      -- 2026-05-10, which left the prod __drizzle_migrations row pointing at
      -- the OLD content under hash 0009 — so the renumbered file was never
      -- replayed on Neon prod. Result: every read of sales_briefings 500s,
      -- which kills the AI account briefing endpoint and the AI microsite
      -- generator (which reads the briefing first).
      --
      -- This block heals prod on the next deploy. It mirrors the migration's
      -- backfill strategy, but expressed idempotently so it's safe on every
      -- boot (matches how the rest of this file already handles structural
      -- changes against Neon).
      ALTER TABLE sales_briefings    ADD COLUMN IF NOT EXISTS tenant_id integer;
      ALTER TABLE sfdc_opportunities ADD COLUMN IF NOT EXISTS tenant_id integer;
      ALTER TABLE sfdc_leads         ADD COLUMN IF NOT EXISTS tenant_id integer;

      -- Backfill: prefer the parent's tenant_id; fall back to tenant 1 only
      -- if the parent vanished (the FK is ON DELETE CASCADE so this should
      -- be a no-op in practice).
      UPDATE sales_briefings sb
      SET tenant_id = sa.tenant_id
      FROM sales_accounts sa
      WHERE sb.account_id = sa.id AND sb.tenant_id IS NULL;
      UPDATE sales_briefings SET tenant_id = 1 WHERE tenant_id IS NULL;

      UPDATE sfdc_opportunities so
      SET tenant_id = sa.tenant_id
      FROM sales_accounts sa
      WHERE so.account_id = sa.id AND so.tenant_id IS NULL;
      -- Opportunities without an account row: pin to the unique sfdc_connection
      -- tenant if there's exactly one, else tenant 1.
      UPDATE sfdc_opportunities
      SET tenant_id = COALESCE(
        (SELECT tenant_id FROM sfdc_connections WHERE tenant_id IS NOT NULL
           GROUP BY tenant_id
           HAVING COUNT(*) = (SELECT COUNT(*) FROM sfdc_connections WHERE tenant_id IS NOT NULL)
           LIMIT 1),
        1)
      WHERE tenant_id IS NULL;

      -- Leads have no FK path to a connection in the schema today; same
      -- single-connection-or-tenant-1 fallback as the migration file.
      UPDATE sfdc_leads
      SET tenant_id = COALESCE(
        (SELECT tenant_id FROM sfdc_connections WHERE tenant_id IS NOT NULL
           GROUP BY tenant_id
           HAVING COUNT(*) = (SELECT COUNT(*) FROM sfdc_connections WHERE tenant_id IS NOT NULL)
           LIMIT 1),
        1)
      WHERE tenant_id IS NULL;

      -- Flip to NOT NULL only if it's still nullable (re-runs are no-ops).
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='sales_briefings' AND column_name='tenant_id' AND is_nullable='YES') THEN
          ALTER TABLE sales_briefings ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='sfdc_opportunities' AND column_name='tenant_id' AND is_nullable='YES') THEN
          ALTER TABLE sfdc_opportunities ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='sfdc_leads' AND column_name='tenant_id' AND is_nullable='YES') THEN
          ALTER TABLE sfdc_leads ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
      END
      $$;

      -- Add FK constraint only if missing (ADD CONSTRAINT itself is not idempotent).
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_briefings_tenant_id_fkey') THEN
          ALTER TABLE sales_briefings
            ADD CONSTRAINT sales_briefings_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sfdc_opportunities_tenant_id_fkey') THEN
          ALTER TABLE sfdc_opportunities
            ADD CONSTRAINT sfdc_opportunities_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sfdc_leads_tenant_id_fkey') THEN
          ALTER TABLE sfdc_leads
            ADD CONSTRAINT sfdc_leads_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
      END
      $$;

      CREATE INDEX IF NOT EXISTS idx_sales_briefings_tenant_id    ON sales_briefings    (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sfdc_opportunities_tenant_id ON sfdc_opportunities (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sfdc_leads_tenant_id         ON sfdc_leads         (tenant_id);

      -- Per-contact AI call-prep briefs (mirrors sales_briefings but per
      -- person). Persists the markdown brief produced by /api/sales/person-brief
      -- so the contact-detail page can show yesterday's research without
      -- regenerating. See lib/db/migrations/0016_sales_contact_briefings.sql.
      CREATE TABLE IF NOT EXISTS sales_contact_briefings (
        id          serial PRIMARY KEY,
        tenant_id   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        contact_id  integer NOT NULL REFERENCES sales_contacts(id) ON DELETE CASCADE,
        brief_text  text NOT NULL DEFAULT '',
        status      text NOT NULL DEFAULT 'complete',
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX        IF NOT EXISTS idx_sales_contact_briefings_tenant_id     ON sales_contact_briefings (tenant_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_contact_briefings_tenant_contact ON sales_contact_briefings (tenant_id, contact_id);

      -- Task #300 — follow-up email to form submitter (global forms + per-page overrides).
      ALTER TABLE lp_forms              ADD COLUMN IF NOT EXISTS send_follow_up_to_submitter boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_forms              ADD COLUMN IF NOT EXISTS follow_up_template_id       integer REFERENCES sales_email_templates(id) ON DELETE SET NULL;
      ALTER TABLE lp_form_notifications ADD COLUMN IF NOT EXISTS send_follow_up_to_submitter boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_form_notifications ADD COLUMN IF NOT EXISTS follow_up_template_id       integer REFERENCES sales_email_templates(id) ON DELETE SET NULL;
