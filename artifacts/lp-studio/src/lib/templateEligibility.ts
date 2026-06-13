// Template eligibility — shared FE helpers (June 2026).
//
// Templates DECLARE where they're allowed to be AUTO-recommended (segment /
// persona / funnel stage). The backend matching engine
// (api-server/.../template-eligibility.ts) treats an EMPTY constraint on any
// axis as a WILDCARD ("Any"). These helpers give the governance editor + the
// wizard a single source of truth for:
//   • the canonical funnel-stage VALUES the backend uses,
//   • the human LABELS reps see (a clearer, sales-motion phrasing), and
//   • pure formatters for the eligibility summary line.
//
// PURE: no React, no IO. Fully unit-tested (templateEligibility.test.ts) so the
// label↔value map and the summary formatting can't silently drift from the
// backend enum.

/** The canonical funnel-stage values persisted on lp_pages.funnelStage /
 *  eligibleFunnelStages. These MUST match the backend `TemplateFunnelStage`
 *  union (api-server/src/seeds/globalTemplates.ts). */
export type TemplateFunnelStage =
  | "first-meeting"
  | "deal-acceleration"
  | "onboarding"
  | "expansion-renewal";

export interface FunnelStageOption {
  /** The value persisted + matched by the backend. */
  value: TemplateFunnelStage;
  /** The label the rep/admin sees. */
  label: string;
  /** One-line "what this stage means" helptext. */
  description: string;
}

/** The fixed, labeled funnel-stage list, in sales-motion order. The label maps
 *  the backend value to the clearer phrasing reps use (Awareness/Consideration
 *  → first-meeting/deal-acceleration, Renewal/Expansion → expansion-renewal,
 *  etc.) while persisting the canonical value. */
export const FUNNEL_STAGE_OPTIONS: readonly FunnelStageOption[] = [
  {
    value: "first-meeting",
    label: "Awareness / First meeting",
    description: "Earning a first conversation with a new prospect.",
  },
  {
    value: "deal-acceleration",
    label: "Consideration / Proposal",
    description: "Advancing an active deal — proof, business case, proposal support.",
  },
  {
    value: "onboarding",
    label: "Onboarding",
    description: "Getting a newly-won customer live and seeing value.",
  },
  {
    value: "expansion-renewal",
    label: "Renewal / Expansion",
    description: "Renewing or growing an existing customer relationship.",
  },
] as const;

const VALUE_TO_LABEL = new Map<string, string>(
  FUNNEL_STAGE_OPTIONS.map((o) => [o.value, o.label]),
);

const VALID_STAGE_VALUES = new Set<string>(FUNNEL_STAGE_OPTIONS.map((o) => o.value));

/** True when `value` is one of the canonical funnel-stage values. */
export function isFunnelStage(value: string | null | undefined): value is TemplateFunnelStage {
  return typeof value === "string" && VALID_STAGE_VALUES.has(value);
}

/** Map a funnel-stage VALUE → its human LABEL. Unknown/blank values fall back to
 *  a title-cased version of the raw value so the UI never renders an empty cell
 *  for a legacy/unrecognized stage. */
export function funnelStageLabel(value: string | null | undefined): string {
  if (!value) return "";
  const known = VALUE_TO_LABEL.get(value);
  if (known) return known;
  // Fallback: title-case the raw value ("expansion-renewal" → "Expansion renewal").
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Keep only valid funnel-stage values, de-duplicated, in canonical order. Used
 *  to sanitize a stored/edited eligibleFunnelStages array before display/save. */
export function normalizeFunnelStages(values: readonly string[] | null | undefined): TemplateFunnelStage[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: TemplateFunnelStage[] = [];
  for (const o of FUNNEL_STAGE_OPTIONS) {
    if (values.includes(o.value) && !seen.has(o.value)) {
      seen.add(o.value);
      out.push(o.value);
    }
  }
  return out;
}

/** The shape the editor + summary work with. Each axis: empty = ANY (wildcard). */
export interface TemplateEligibility {
  eligibleSegments: string[];
  eligiblePersonas: string[];
  eligibleFunnelStages: string[];
  /** The PRIMARY funnel stage (single). null = none chosen. */
  funnelStage: string | null;
}

/** Resolve a segment/persona id → its display name via a lookup map, falling
 *  back to the id itself when unknown (e.g. a stale id whose segment was
 *  renamed). Pure — the map is provided by the caller. */
function labelFor(id: string, names: Readonly<Record<string, string>>): string {
  const n = names[id];
  return n && n.trim() ? n : id;
}

/**
 * Build the one-line human summary of a template's eligibility for the settings
 * row, e.g.:
 *   "Any segment · Any persona · Renewal / Expansion"
 *   "DSO, Group Practice · Executive · Awareness / First meeting, Renewal / Expansion"
 *   "Any audience or stage" (fully wildcard)
 *
 * `segmentNames` / `personaNames` map id → display name (so renamed segments
 * still read cleanly). Empty axes render as "Any …".
 */
export function formatEligibilitySummary(
  e: TemplateEligibility,
  segmentNames: Readonly<Record<string, string>> = {},
  personaNames: Readonly<Record<string, string>> = {},
): string {
  const segs = (e.eligibleSegments ?? []).filter((s) => s.trim());
  const personas = (e.eligiblePersonas ?? []).filter((p) => p.trim());
  const stages = normalizeFunnelStages(e.eligibleFunnelStages);

  if (segs.length === 0 && personas.length === 0 && stages.length === 0) {
    return "Any audience or stage";
  }

  const segPart =
    segs.length === 0
      ? "Any segment"
      : segs.map((s) => labelFor(s, segmentNames)).join(", ");
  const personaPart =
    personas.length === 0
      ? "Any persona"
      : personas.map((p) => labelFor(p, personaNames)).join(", ");
  const stagePart =
    stages.length === 0
      ? "Any stage"
      : stages.map((s) => funnelStageLabel(s)).join(", ");

  return [segPart, personaPart, stagePart].join(" · ");
}

// ── AI behavior governance ──────────────────────────────────────────────────

/** Mirror of the backend `TemplateAiBehavior` union (template-eligibility.ts). */
export type TemplateAiBehavior =
  | "template-required"
  | "template-preferred"
  | "ai-from-scratch-only";

/** The owner's safe default — until confidence is high, AI builds from scratch. */
export const DEFAULT_TEMPLATE_AI_BEHAVIOR: TemplateAiBehavior = "ai-from-scratch-only";

const VALID_BEHAVIORS = new Set<string>([
  "template-required",
  "template-preferred",
  "ai-from-scratch-only",
]);

/** Coerce an arbitrary stored value into a valid behavior, defaulting safely. */
export function normalizeTemplateAiBehavior(value: unknown): TemplateAiBehavior {
  return typeof value === "string" && VALID_BEHAVIORS.has(value)
    ? (value as TemplateAiBehavior)
    : DEFAULT_TEMPLATE_AI_BEHAVIOR;
}

export interface AiBehaviorOption {
  value: TemplateAiBehavior;
  label: string;
  description: string;
  /** Marks the recommended safe default for the UI to badge. */
  recommended?: boolean;
}

/** The 3-option governance control, ordered safest → most aggressive. */
export const AI_BEHAVIOR_OPTIONS: readonly AiBehaviorOption[] = [
  {
    value: "ai-from-scratch-only",
    label: "AI from scratch only",
    description:
      "Safest: AI builds a custom page unless you manually pick a template. Reps can always choose a template themselves; AI never auto-picks one.",
    recommended: true,
  },
  {
    value: "template-preferred",
    label: "Template preferred",
    description:
      "AI auto-picks a template only when an eligible one confidently matches the audience and stage; otherwise it builds from scratch.",
  },
  {
    value: "template-required",
    label: "Template required",
    description:
      "AI always prefers an eligible template, picking the best match. If none is eligible it still builds from scratch (safer than the wrong page).",
  },
] as const;
