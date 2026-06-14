// Generator presets — FE client (June 2026).
//
// Fetches the EFFECTIVE, enabled, ordered presets for the current tenant from
// GET /api/lp/generator-presets?surface=… (global defaults ∪ tenant overrides ∪
// tenant-specific presets, merged server-side). The marketing + sales
// generators call this instead of their old hardcoded lists.
//
// FAIL-OPEN by contract: the endpoint itself returns [] on any error, and this
// client also returns [] on a network/parse failure, so the generators always
// fall back to their safe built-in state (marketing renders nothing; sales uses
// its built-in objective cards).

export type PresetSurface = "marketing" | "sales" | "both";

/** One effective preset as returned by GET /lp/generator-presets. Mirrors the
 *  server's EffectivePreset (api-server/src/lib/generatorPresets.ts). */
export interface EffectivePreset {
  key: string;
  globalPresetId: number | null;
  tenantPresetId: number | null;
  scope: "global" | "tenant";
  overridden: boolean;
  surface: PresetSurface;
  label: string;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
  enabled: boolean;
  sortOrder: number;
}

/**
 * Fetch the effective ENABLED presets for a generator surface. Returns [] on any
 * failure (fail-open) so callers never have to handle errors — an empty list is
 * the safe "fall back to built-in" signal.
 */
export async function fetchGeneratorPresets(
  surface: "marketing" | "sales",
): Promise<EffectivePreset[]> {
  try {
    const res = await fetch(`/api/lp/generator-presets?surface=${surface}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { presets?: EffectivePreset[] };
    return Array.isArray(data.presets) ? data.presets : [];
  } catch {
    return [];
  }
}
