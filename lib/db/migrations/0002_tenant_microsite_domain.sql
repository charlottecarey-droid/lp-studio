-- Add microsite_domain column to tenants
-- Allows a tenant to split admin login (domain) from public landing pages (microsite_domain)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS microsite_domain text;

-- Update Dandy (id=1) to use separate admin and public page subdomains
UPDATE tenants
  SET domain = 'ent.meetdandy.com',
      microsite_domain = 'partners.meetdandy.com'
  WHERE id = 1;
