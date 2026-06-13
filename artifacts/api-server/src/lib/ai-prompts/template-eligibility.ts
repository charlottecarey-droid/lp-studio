// Template eligibility engine (June 2026).
//
// PRINCIPLE: templates DECLARE where they're allowed to be used (segment /
// persona / funnel stage), and AUTO template selection is GATED by that — a
// data-driven product capability, NOT prompting. Until confidence is high the
// system DEFAULTS to "AI builds from scratch"; templates stay manually
// selectable but are only auto-recommended when the system can confidently
// match them. "Safer to generate a custom page than confidently generate the
// wrong page."
//
// Design constraints (mirror microsite-recommendation.ts / template-intent.ts):
//   • PURE + deterministic: NO model call, NO DB, NO IO. A given input always
//     yields the same decision, so the rep's preview matches generation.
//   • Fully unit-tested.
//   • FAIL-OPEN on the constraint axis: an empty/missing eligibility constraint
//     is a WILDCARD that matches ANY value — so a template that declares
//     nothing remains eligible everywhere (existing templates keep working).
//   • FAIL-SAFE on the recommendation axis: when nothing eligible is found (or
//     governance says so), we recommend NOTHING and build from scratch rather
//     than confidently picking the wrong page.
//
// This engine governs AUTO-recommendation ONLY. A rep can always manually pick
// any template downstream; eligibility never blocks manual selection.

/** Tenant/program governance setting controlling how aggressively the system
 *  auto-picks a template vs. defaulting to AI-from-scratch.
 *    "ai-from-scratch-only" — AI never auto-picks a template (templates still
 *                             manually selectable). The owner's safe DEFAULT.
 *    "template-preferred"   — auto-pick the highest-confidence ELIGIBLE template
 *                             when one clears the minimum confidence threshold;
 *                             otherwise build from scratch.
 *    "template-required"    — auto-pick the highest-confidence eligible template;
 *                             if NONE is eligible, STILL fall back to from-scratch
 *                             (safer than a wrong page) with a reasoning flag. */
export type TemplateAiBehavior =
  | "template-required"
  | "template-preferred"
  | "ai-from-scratch-only";

export const TEMPLATE_AI_BEHAVIORS: readonly TemplateAiBehavior[] = [
  "template-required",
  "template-preferred",
  "ai-from-scratch-only",
] as const;

/** The owner's recommended safe default: until confidence is high, the wizard
 *  defaults to "AI builds from scratch". */
export const DEFAULT_TEMPLATE_AI_BEHAVIOR: TemplateAiBehavior = "ai-from-scratch-only";

/** Coerce an arbitrary stored value into a valid behavior, defaulting safely. */
export function normalizeTemplateAiBehavior(value: unknown): TemplateAiBehavior {
  return TEMPLATE_AI_BEHAVIORS.includes(value as TemplateAiBehavior)
    ? (value as TemplateAiBehavior)
    : DEFAULT_TEMPLATE_AI_BEHAVIOR;
}

/** The selection context resolved from the rep's questionnaire. Every field is
 *  optional — a missing field relaxes the corresponding constraint axis. */
export interface EligibilityContext {
  /** Resolved segment name or id. */
  segment?: string | null;
  /** Resolved persona role/name. */
  persona?: string | null;
  /** Resolved funnel stage/motion (derived from the objective/motion). */
  funnelStage?: string | null;
}

/** A candidate template carrying its declared eligibility constraints. Empty /
 *  null on any axis = WILDCARD (matches any context value on that axis). */
export interface EligibilityCandidate {
  slug: string;
  /** Human label for reasoning (falls back to slug). */
  label?: string;
  /** Segment names/ids the template may be used for. Empty/null = ANY. */
  eligibleSegments?: string[] | null;
  /** Personas it's appropriate for. Empty/null = ANY. */
  eligiblePersonas?: string[] | null;
  /** Funnel stages/motions it fits. Empty/null = ANY. */
  eligibleFunnelStages?: string[] | null;
  /** The template's PRIMARY funnel stage. Used to default the eligible-stages
   *  set to [funnelStage] when eligibleFunnelStages is unset. */
  funnelStage?: string | null;
}

/** A ranked eligible template with its confidence + a human "why". */
export interface RankedEligibleTemplate {
  slug: string;
  label: string;
  /** 0..1 normalized confidence (higher = more specific declared match). */
  confidence: number;
  /** Human-readable explanation of why it's eligible + how specific the match. */
  why: string;
}

export interface EligibilitySelection {
  /** Eligible templates ranked by confidence (highest first). */
  eligible: RankedEligibleTemplate[];
  /** The slug the system AUTO-recommends, or null = build from scratch. */
  recommendedSlug: string | null;
  /** True when the system should build a custom page from scratch (no auto
   *  template). Always true under "ai-from-scratch-only". */
  fromScratch: boolean;
  /** Human-readable "why" trail for the preview panel. */
  reasoning: string[];
}

// ─── Scoring ──────────────────────────────────────────────────────────────
//
// A template that matches on SPECIFICALLY-DECLARED values outranks one that
// only matches because it left the axis wildcard. So an explicitly
// DSO+renewal+exec template beats a wildcard template for a DSO renewal exec
// context. Each axis contributes:
//   • EXPLICIT match (context value present AND listed in the declared set):
//     +EXPLICIT_AXIS_SCORE.
//   • WILDCARD match (declared set empty → matches any): +WILDCARD_AXIS_SCORE
//     (small, > 0 so a fully-wildcard template is still ranked, just lowest).
//   • context value absent (nothing to match against): neutral (0) — neither
//     rewarded nor penalized, so a missing persona doesn't sink a template.
const EXPLICIT_AXIS_SCORE = 10;
const WILDCARD_AXIS_SCORE = 1;
const MAX_AXIS_SCORE = EXPLICIT_AXIS_SCORE * 3; // three axes, all explicit

/** Minimum normalized confidence an eligible template must clear before
 *  "template-preferred" will auto-recommend it. A purely-wildcard match (no
 *  explicit declared axis) sits below this, so an unconstrained template is
 *  never CONFIDENTLY auto-picked under template-preferred — it falls through to
 *  from-scratch. "template-required" ignores the threshold (it takes the best
 *  eligible regardless) but still falls back to scratch when none is eligible. */
export const MIN_AUTO_RECOMMEND_CONFIDENCE = 0.4;

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function setHas(set: string[] | null | undefined, value: string): boolean {
  if (!Array.isArray(set) || set.length === 0) return false;
  const target = norm(value);
  if (!target) return false;
  return set.some((s) => norm(s) === target);
}

function isWildcard(set: string[] | null | undefined): boolean {
  return !Array.isArray(set) || set.length === 0;
}

/** The effective allowed funnel-stage set: the declared eligibleFunnelStages,
 *  or [funnelStage] when only the singular primary is known, or [] (wildcard). */
export function effectiveEligibleFunnelStages(c: EligibilityCandidate): string[] {
  if (Array.isArray(c.eligibleFunnelStages) && c.eligibleFunnelStages.length > 0) {
    return c.eligibleFunnelStages;
  }
  if (c.funnelStage && c.funnelStage.trim()) return [c.funnelStage];
  return [];
}

interface AxisEval {
  /** Whether this axis permits the candidate (wildcard OR explicit match OR
   *  context value absent for an optional axis). */
  pass: boolean;
  /** Score contribution for confidence ranking. */
  score: number;
  /** True when the match was an EXPLICIT declared match (not just wildcard). */
  explicit: boolean;
}

/** Evaluate one constraint axis.
 *  - personaOptional=true: when the context value is absent, the axis passes
 *    regardless of what the template declares (persona is optional context).
 *  - personaOptional=false: when the context value is absent, a WILDCARD
 *    template still passes, but a template that DECLARES a constraint cannot be
 *    confirmed eligible (we can't match an unknown context value against a
 *    declared set) → it fails. */
function evalAxis(
  declared: string[] | null | undefined,
  contextValue: string | null | undefined,
  personaOptional: boolean,
): AxisEval {
  const hasContext = norm(contextValue).length > 0;
  if (isWildcard(declared)) {
    // Declared nothing → matches any context value (incl. absent).
    return { pass: true, score: WILDCARD_AXIS_SCORE, explicit: false };
  }
  if (!hasContext) {
    // Template declares a constraint but we have no context value to match.
    // Persona axis is optional → still eligible (no explicit credit). Required
    // axes (segment/funnel) cannot be confirmed → not eligible.
    return personaOptional
      ? { pass: true, score: WILDCARD_AXIS_SCORE, explicit: false }
      : { pass: false, score: 0, explicit: false };
  }
  if (setHas(declared, contextValue!)) {
    return { pass: true, score: EXPLICIT_AXIS_SCORE, explicit: true };
  }
  // Declared a constraint AND the context value is NOT in it → not eligible.
  return { pass: false, score: 0, explicit: false };
}

/** Build the human "why" for one eligible candidate. */
function buildWhy(
  label: string,
  confidence: number,
  explicitAxes: string[],
): string {
  const tier = confidenceTier(confidence);
  if (explicitAxes.length === 0) {
    return `${label} (${tier} confidence — matches any context, no specific declaration)`;
  }
  return `${label} (${tier} confidence — explicitly declared for ${explicitAxes.join(" + ")})`;
}

function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.66) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

/**
 * Decide which template (if any) the system may AUTO-recommend for a context,
 * gated by the tenant's governance behavior.
 *
 * Pure + deterministic. See module header for the principle. Eligibility rule:
 *   ELIGIBLE iff
 *     (eligibleSegments empty OR includes the context segment)
 *     AND (eligibleFunnelStages empty OR includes the context funnel stage)
 *     AND (eligiblePersonas empty OR persona absent OR includes the persona).
 * Confidence rewards EXPLICIT declared matches over wildcard matches, so a
 * specifically-declared template beats an unconstrained one.
 */
export function selectEligibleTemplate(
  context: EligibilityContext,
  candidates: EligibilityCandidate[],
  aiBehavior: TemplateAiBehavior,
): EligibilitySelection {
  const behavior = normalizeTemplateAiBehavior(aiBehavior);
  const reasoning: string[] = [];

  const seg = norm(context.segment);
  const persona = norm(context.persona);
  const stage = norm(context.funnelStage);
  if (context.segment && seg) reasoning.push(`Segment = ${context.segment}`);
  if (context.funnelStage && stage) reasoning.push(`Funnel = ${context.funnelStage}`);
  if (context.persona && persona) reasoning.push(`Persona = ${context.persona}`);

  // Rank every eligible candidate regardless of behavior — even under
  // ai-from-scratch-only we still surface what WOULD be eligible (the UI can
  // show "templates available" while AI defaults to scratch).
  const ranked: RankedEligibleTemplate[] = [];
  for (const c of candidates) {
    const label = c.label?.trim() || c.slug;
    const segAxis = evalAxis(c.eligibleSegments, context.segment, false);
    const stageDeclared = effectiveEligibleFunnelStages(c);
    const stageAxis = evalAxis(stageDeclared, context.funnelStage, false);
    const personaAxis = evalAxis(c.eligiblePersonas, context.persona, true);

    if (!segAxis.pass || !stageAxis.pass || !personaAxis.pass) continue;

    const rawScore = segAxis.score + stageAxis.score + personaAxis.score;
    const confidence = Math.min(1, rawScore / MAX_AXIS_SCORE);
    const explicitAxes: string[] = [];
    if (segAxis.explicit) explicitAxes.push("segment");
    if (personaAxis.explicit) explicitAxes.push("persona");
    if (stageAxis.explicit) explicitAxes.push("funnel stage");

    ranked.push({
      slug: c.slug,
      label,
      confidence,
      why: buildWhy(label, confidence, explicitAxes),
    });
  }

  // Highest confidence first; stable tie-break by slug so the decision is
  // deterministic across runs.
  ranked.sort((a, b) => (b.confidence - a.confidence) || a.slug.localeCompare(b.slug));

  // ── Governance gate ──────────────────────────────────────────────────────
  if (behavior === "ai-from-scratch-only") {
    reasoning.push(
      "→ Defaulting to from-scratch (governance: ai-from-scratch-only) — AI will not auto-pick a template; templates remain manually selectable",
    );
    return { eligible: ranked, recommendedSlug: null, fromScratch: true, reasoning };
  }

  if (ranked.length === 0) {
    reasoning.push(
      behavior === "template-required"
        ? "→ No eligible template exists for this context; building from scratch (safer than a wrong page)"
        : "→ No eligible template; building from scratch",
    );
    return { eligible: ranked, recommendedSlug: null, fromScratch: true, reasoning };
  }

  const top = ranked[0];

  if (behavior === "template-preferred" && top.confidence < MIN_AUTO_RECOMMEND_CONFIDENCE) {
    // Eligible, but only on a low-confidence (wildcard) basis — don't
    // confidently auto-pick; default to from-scratch.
    reasoning.push(
      `→ Top eligible template (${top.label}) only matches on a wildcard basis (confidence ${top.confidence.toFixed(2)} < ${MIN_AUTO_RECOMMEND_CONFIDENCE}); building from scratch instead`,
    );
    return { eligible: ranked, recommendedSlug: null, fromScratch: true, reasoning };
  }

  reasoning.push(`→ eligible: ${top.label} (${confidenceTier(top.confidence)} confidence)`);
  return { eligible: ranked, recommendedSlug: top.slug, fromScratch: false, reasoning };
}
