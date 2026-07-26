-- Settings consolidation Phase 2: unify Marketo onto marketo_connections.
--
-- Background: Marketo was the last integration a tenant could configure TWICE,
-- on two live credential stores — `lp_integrations` provider = 'marketo'
-- (form-lead outbound sync via syncLeadToMarketo + the link-export
-- destination) and `marketo_connections` (Sales Console bidirectional sync).
-- After this migration every Marketo consumer reads marketo_connections; the
-- lp_integrations provider is retired (routes deleted, marketing UI card
-- removed) exactly like the 'salesforce' provider was in 0088.
--
-- Step 1 copies each tenant's lp_integrations credentials into
-- marketo_connections:
--   - rest/identity endpoints are synthesized from the Munchkin ID — the
--     marketing-side config never stored them; its sync code always derived
--     `https://{munchkin}.mktorest.com/{rest,identity}`, which is also what
--     the Sales Console connect form collects for a real instance.
--   - client_secret ciphertext copies VERBATIM: both stores encrypt with the
--     same AES-256-GCM envelope (`v1:…`, CREDENTIAL_ENCRYPTION_KEY), so no
--     decrypt/re-encrypt round trip is needed here.
--   - sync_enabled = false: that flag gates the Sales Console bidirectional
--     sync (poller + engagement/campaign write-backs). Migrated tenants only
--     ever had form-lead sync, so it must NOT silently activate the poller
--     against their live Marketo instance. Form-lead sync deliberately keys
--     off status = 'connected' alone (see marketoService.getFormSyncCredentials).
--   - status mirrors the old master toggle: enabled -> connected, else
--     disconnected.
--   - rows missing any of the three credentials are skipped: syncLeadToMarketo
--     bailed on them before every send, so they were dead config.
--   - ON CONFLICT DO NOTHING: a tenant already connected on the Sales Console
--     side keeps that row untouched (it is the richer one — live token,
--     endpoints as entered).
--
-- Step 2 deletes ALL lp_integrations marketo rows (migrated, conflicting, and
-- dead alike) so the retired provider can't linger holding an encrypted secret.
--
-- Idempotent: after the first run no provider='marketo' rows remain, so both
-- statements are no-ops on every subsequent run / fresh DB. Also re-applied by
-- a runProbedSelfHeal in migrate.ts (high-water-mark hazard, same as 0088).
INSERT INTO marketo_connections (
  tenant_id, munchkin_id, rest_endpoint, identity_endpoint,
  client_id, client_secret, status, sync_enabled, import_unlinked_leads
)
SELECT
  tenant_id,
  btrim(config->>'munchkinId'),
  'https://' || btrim(config->>'munchkinId') || '.mktorest.com/rest',
  'https://' || btrim(config->>'munchkinId') || '.mktorest.com/identity',
  btrim(config->>'clientId'),
  config->>'clientSecret',
  CASE WHEN enabled THEN 'connected' ELSE 'disconnected' END,
  false,
  false
FROM lp_integrations
WHERE provider = 'marketo'
  AND NULLIF(btrim(config->>'munchkinId'), '') IS NOT NULL
  AND NULLIF(btrim(config->>'clientId'), '') IS NOT NULL
  AND NULLIF(config->>'clientSecret', '') IS NOT NULL
ON CONFLICT (tenant_id, munchkin_id) DO NOTHING;

DELETE FROM lp_integrations WHERE provider = 'marketo';
