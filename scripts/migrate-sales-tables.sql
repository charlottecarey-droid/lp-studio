-- Sales Console Schema Migration
-- Run this against your Neon Postgres database to create the sales tables.
-- Alternatively, use `drizzle-kit push` from lib/db which will auto-create from the Drizzle schema.

-- Accounts
CREATE TABLE IF NOT EXISTS sales_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  segment TEXT,
  parent_account_id INTEGER,
  status TEXT NOT NULL DEFAULT 'prospect',
  owner TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS sales_contacts (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES sales_accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  role TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hotlinks (tracked links per contact per page)
CREATE TABLE IF NOT EXISTS sales_hotlinks (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES sales_contacts(id) ON DELETE CASCADE,
  page_id INTEGER NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email Templates
CREATE TABLE IF NOT EXISTS sales_email_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  merge_vars JSONB DEFAULT '[]',
  category TEXT DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS sales_email_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  template_id INTEGER NOT NULL REFERENCES sales_email_templates(id),
  account_id INTEGER REFERENCES sales_accounts(id),
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email Sends (individual send records)
CREATE TABLE IF NOT EXISTS sales_email_sends (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES sales_email_campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL,
  hotlink_id INTEGER,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signals (engagement events)
CREATE TABLE IF NOT EXISTS sales_signals (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES sales_accounts(id) ON DELETE CASCADE,
  contact_id INTEGER,
  hotlink_id INTEGER,
  type TEXT NOT NULL,
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sales_contacts_account ON sales_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_contact ON sales_hotlinks(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_page ON sales_hotlinks(page_id);
CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_token ON sales_hotlinks(token);
CREATE INDEX IF NOT EXISTS idx_sales_email_sends_campaign ON sales_email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_email_sends_contact ON sales_email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_signals_account ON sales_signals(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_signals_contact ON sales_signals(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_signals_type ON sales_signals(type);
CREATE INDEX IF NOT EXISTS idx_sales_signals_created ON sales_signals(created_at DESC);
