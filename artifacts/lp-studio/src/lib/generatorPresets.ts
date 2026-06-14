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

/** Result of POST /lp/generator-presets/resolve-template — whether a marketing
 *  chip's tied template should be auto-applied for the page's context, gated by
 *  the tenant's eligibility governance (reused micrositeTemplateAiBehavior). */
export interface ResolvedChipTemplate {
  /** Slug to use as the AI starting point, or null = build from scratch. */
  recommendedTemplateSlug: string | null;
  fromScratch: boolean;
  /** Human-readable "why" trail (the modal surfaces the last line as a note). */
  reasoning: string[];
}

/**
 * Resolve whether a marketing chip's TIED template is eligible for the page's
 * current context (segment + the preset's implied funnel stage), gated by the
 * tenant's template-AI governance. Mirrors the sales microsite recommend gate.
 *
 * FAIL-OPEN by contract: the endpoint returns the tied slug as-is on any server
 * error, and this client returns the tied slug as-is on a network/parse failure,
 * so generation is never blocked by the gate.
 */
export async function resolveChipTemplate(args: {
  tiedTemplateSlug: string;
  segmentId?: string;
}): Promise<ResolvedChipTemplate> {
  const tiedTemplateSlug = args.tiedTemplateSlug.trim();
  // Fail-open shape used on any client-side failure.
  const failOpen: ResolvedChipTemplate = {
    recommendedTemplateSlug: tiedTemplateSlug || null,
    fromScratch: !tiedTemplateSlug,
    reasoning: [],
  };
  if (!tiedTemplateSlug) {
    return { recommendedTemplateSlug: null, fromScratch: true, reasoning: [] };
  }
  try {
    const res = await fetch("/api/lp/generator-presets/resolve-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiedTemplateSlug, segmentId: args.segmentId ?? "" }),
    });
    if (!res.ok) return failOpen;
    const data = (await res.json()) as Partial<ResolvedChipTemplate>;
    return {
      recommendedTemplateSlug:
        typeof data.recommendedTemplateSlug === "string"
          ? data.recommendedTemplateSlug
          : null,
      fromScratch: data.fromScratch === true,
      reasoning: Array.isArray(data.reasoning)
        ? data.reasoning.filter((r): r is string => typeof r === "string")
        : [],
    };
  } catch {
    return failOpen;
  }
}
