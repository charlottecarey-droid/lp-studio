-- Seed Dandy's (tenant 1) sales-console config into lp_brand_settings.config
-- under a new "salesConsole" key. These values mirror what was previously
-- hardcoded in draft-email.ts, generate-microsite.ts, QuickCampaignWizard.tsx,
-- and campaigns.ts so removing those hardcodes leaves Dandy's behavior
-- completely unchanged. Other tenants start with no salesConsole block —
-- the helper code returns safe empty defaults so no Dandy strings leak.
--
-- Re-runnable: uses jsonb_set with a guard so re-running the migration
-- won't clobber edits Dandy makes through the new Brand Settings UI.

DO $$
DECLARE
  existing_config jsonb;
  has_sales_console boolean;
BEGIN
  SELECT config
    INTO existing_config
    FROM lp_brand_settings
   WHERE tenant_id = 1
   LIMIT 1;

  IF existing_config IS NULL THEN
    -- No brand_settings row yet — insert with empty config so the
    -- jsonb_set below can populate salesConsole on the same pass.
    INSERT INTO lp_brand_settings (tenant_id, config) VALUES (1, '{}'::jsonb);
    existing_config := '{}'::jsonb;
  END IF;

  has_sales_console := existing_config ? 'salesConsole';

  IF NOT has_sales_console THEN
    UPDATE lp_brand_settings
       SET config = jsonb_set(
             config,
             '{salesConsole}',
             jsonb_build_object(
               'senderName',       'Dandy',
               'senderLocalPart',  'partnerships',
               'sendingDomain',    'ent.meetdandy.com',
               'replyTo',          'sales@meetdandy.com',
               'notificationsLocalPart', 'notifications',
               'emailSignature',   '',
               'emailFooter',      '',
               'salesIntroLine',   'You write short, human cold emails for Dandy — a vertically integrated dental lab and clinical performance platform for DSOs.',
               'briefBlurb',       '(a dental lab and clinical performance platform for DSOs)',
               'useBuiltInExemplars', true,
               'valuePropPairs', jsonb_build_array(
                 jsonb_build_object('role','CFO / Finance','theme','Remakes are silently destroying margin',
                   'pain','remakes cost ~$780 each and most DSOs can''t even track them across locations',
                   'proof','Apex Dental Partners cut remakes by 29% after switching to Dandy'),
                 jsonb_build_object('role','CFO / Finance','theme','Scanner CAPEX is an unnecessary barrier',
                   'pain','$40–75K per operatory in scanner hardware is hard to justify when margins are tight',
                   'proof','Dandy deploys scanners free — zero CAPEX'),
                 jsonb_build_object('role','COO / Operations','theme','Too many lab vendors means no control',
                   'pain','when every location picks its own lab, you get inconsistent quality, no leverage on pricing, and no visibility',
                   'proof','DCA consolidated 400+ lab relationships through a strategic partnership with Dandy'),
                 jsonb_build_object('role','COO / Operations','theme','Standardization shouldn''t mean forcing doctors to switch',
                   'pain','ops teams need consistency across locations, but mandating a single workflow alienates doctors',
                   'proof','Dandy''s preferred program standardizes the lab without requiring doctors to change their process'),
                 jsonb_build_object('role','CDO / Clinical','theme','Remakes are a clinical quality problem hiding in plain sight',
                   'pain','most DSOs don''t have location-level remake data, so quality issues go undetected',
                   'proof','DCA practices hit ~1% remake rate with Dandy''s standardized workflow'),
                 jsonb_build_object('role','CDO / Clinical','theme','Catching fit issues before they ship',
                   'pain','bad margins and fit problems only surface after the patient is in the chair — costly for the practice and the patient',
                   'proof','Dandy''s AI margin detection flags fit issues before the crown ships'),
                 jsonb_build_object('role','CEO / President','theme','Same-store growth is the next lever',
                   'pain','acquisitions slow down eventually and same-store performance becomes the primary growth engine',
                   'proof','Apex Dental Partners saw a 12.5% revenue increase with Dandy'),
                 jsonb_build_object('role','CEO / President','theme','Scale without capital risk',
                   'pain','growth requires scanners at every operatory, but $40–75K per site adds up fast',
                   'proof','Dandy deploys free scanners — no capital risk to start'),
                 jsonb_build_object('role','Growth / M&A','theme','Post-acquisition integration shouldn''t break the lab',
                   'pain','every acquisition brings a new lab vendor, new workflows, and new quality standards to normalize',
                   'proof','Dandy scales from 10 to 200+ locations on one platform'),
                 jsonb_build_object('role','IT / Technology / Systems','theme','One fewer vendor to procure and manage',
                   'pain','IT has to spec, procure, and support scanner hardware at every location — it doesn''t scale',
                   'proof','DCA deployed 100 free scanners through Dandy — no hardware procurement for IT')
               )
             ),
             true
           )
     WHERE tenant_id = 1;
  END IF;
END $$;
