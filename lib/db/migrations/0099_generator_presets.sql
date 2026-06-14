-- June 2026 — admin-configurable GENERATOR PRESETS.
--
-- A "generator preset" is one curated quick-start option shown inside a
-- generator: the MARKETING landing-page generator's "starter chips" (each
-- prefilling a prompt skeleton) and the SALES microsite generator's "objective
-- cards" (each mapping to a MicrositeObjective). Both were HARDCODED in the FE
-- (StarterPromptChips.tsx + micrositeFlow.OBJECTIVE_CARDS). This moves them into
-- superadmin-curatable config with a per-tenant override layer, mirroring how
-- GLOBAL templates (lp_pages.is_global) are seeded for all tenants and how
-- featured_homepage_templates is superadmin-owned config.
--
-- GLOBAL vs TENANT representation (mirrors the global-template + per-tenant
-- visibility pattern):
--   • generator_presets — the canonical preset rows. tenant_id NULL = a GLOBAL
--     preset (superadmin-managed default, visible to every tenant); tenant_id
--     set = a TENANT-SPECIFIC preset that tenant added (only that tenant sees
--     it). scope is derived from tenant_id (NULL → global).
--   • generator_preset_overrides — a tenant's OVERRIDE of a GLOBAL preset. One
--     row per (tenant_id, global_preset_id). It can hide the global preset
--     (enabled=false), reorder it (sort_order), and/or override its display +
--     template tie (label/description/icon/prompt_skeleton/objective/tied_*).
--     A NULL override column means "inherit the global value". Tenants never
--     mutate the shared global row, so one tenant's edits never leak to another.
--
-- TEMPLATE TIE: a preset can tie to a template by slug (tied_template_slug) or
-- by intent (tied_template_intent) — both reuse the EXISTING eligibility/intent
-- system (lib/ai-prompts/template-eligibility.ts). A tie is only ever a
-- RECOMMENDATION input; selectEligibleTemplate still gates whether it surfaces.
-- NULL on both = "no template / AI from scratch".
--
-- SURFACE: 'marketing' | 'sales' | 'both' — which generator(s) a preset is for.
--
-- Seeding (marker-gated, idempotent) lives in api-server/src/migrate.ts
-- (generator_presets_seed_v1): the current hardcoded chips/objectives are
-- seeded as GLOBAL rows. Marketing presets seed DISABLED (enabled=false) per the
-- owner — the chips stay hidden until a superadmin turns them on, replacing the
-- old MARKETING_STARTER_CHIPS_ENABLED code flag. Sales objective presets seed
-- ENABLED so the microsite generator's objective cards keep working exactly as
-- today (the generators also fall back to the built-in objectives when the
-- config is empty, so sales is never broken if unconfigured).
--
-- Additive + fail-open: nothing here is required for the generators to work; a
-- missing/empty config falls back to the safe built-in state.

CREATE TABLE IF NOT EXISTS generator_presets (
  id                   serial PRIMARY KEY,
  -- NULL = GLOBAL (superadmin default for all tenants); set = tenant-specific.
  tenant_id            integer REFERENCES tenants(id) ON DELETE CASCADE,
  -- 'marketing' | 'sales' | 'both'
  surface              text NOT NULL DEFAULT 'marketing',
  label                text NOT NULL DEFAULT '',
  description          text,
  -- lucide-react icon name (FE maps to an imported icon); NULL = no icon.
  icon                 text,
  -- MARKETING prefill skeleton; NULL/empty for sales-only presets.
  prompt_skeleton      text,
  -- SALES objective enum value (MicrositeObjective); NULL for marketing-only.
  objective            text,
  -- Template tie (reuses the eligibility/intent system). NULL on both = no
  -- template / AI from scratch.
  tied_template_slug   text,
  tied_template_intent text,
  enabled              boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Effective-list reads filter by surface + (tenant_id IS NULL OR tenant_id = $t)
-- and order by sort_order; index the common access path.
CREATE INDEX IF NOT EXISTS generator_presets_surface_tenant_idx
  ON generator_presets (surface, tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS generator_presets_tenant_idx
  ON generator_presets (tenant_id);

-- Per-tenant override of a GLOBAL preset. One row per (tenant_id, global_preset).
-- Override columns are NULL = "inherit the global value".
CREATE TABLE IF NOT EXISTS generator_preset_overrides (
  id                   serial PRIMARY KEY,
  tenant_id            integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The GLOBAL generator_presets.id being overridden (CASCADE so removing a
  -- global preset removes its overrides).
  global_preset_id     integer NOT NULL REFERENCES generator_presets(id) ON DELETE CASCADE,
  -- NULL = inherit the global preset's enabled flag; false = tenant hid it.
  enabled              boolean,
  -- NULL = inherit the global sort_order.
  sort_order           integer,
  -- Display + template-tie overrides. NULL = inherit the global value.
  label                text,
  description          text,
  icon                 text,
  prompt_skeleton      text,
  objective            text,
  tied_template_slug   text,
  tied_template_intent text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS generator_preset_overrides_tenant_global_unique
  ON generator_preset_overrides (tenant_id, global_preset_id);
CREATE INDEX IF NOT EXISTS generator_preset_overrides_tenant_idx
  ON generator_preset_overrides (tenant_id);
