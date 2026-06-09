// ── Shared engagement heat scoring ───────────────────────────────────────────
// Single source of truth for the account "heat" tier shown on the sales
// dashboard and the Accounts page so the two surfaces can never drift.
//
// Model: every signal in the trailing 14-day window is worth a configurable
// number of POINTS by its type (set per workspace in Settings → Lead scoring).
// The points are summed, then mapped to a tier by two thresholds:
//   score >= hotThreshold   → "hot"          ("Hot")
//   score >= warmThreshold  → "warm"         ("Warm")
//   score >  0              → "cool"         ("Warming Up")
//   else                    → "cold"         (no badge)
// Setting a signal type's points to 0 means "don't count it", so the points
// table alone also controls which signals contribute.

export interface HeatSignal {
  type: string;
  source?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type HeatTier = "hot" | "warm" | "cool" | "cold";

export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Per-workspace heat-scoring configuration. Persisted in the brand-settings
 * JSONB (`BrandConfig.heatScoring`) and edited in Settings → Lead scoring.
 * `points` is keyed by signal type (see `SIGNAL_TYPES` in `signal-types.tsx`).
 */
export interface HeatScoringConfig {
  /** Points awarded per signal of each type, summed over the 14-day window. */
  points: Record<string, number>;
  /** Total points (over 14 days) at which an account becomes "Warm". */
  warmThreshold: number;
  /** Total points (over 14 days) at which an account becomes "Hot". */
  hotThreshold: number;
}

/**
 * Brand-agnostic defaults. Mirrors the signal types shown across the app
 * (`SIGNAL_TYPES`), plus the legacy `link_click` type so historical link-click
 * signals keep counting. With these defaults a single form submit reaches
 * "Warm" and a form submit plus any other touch reaches "Hot".
 */
export const DEFAULT_HEAT_SCORING: HeatScoringConfig = {
  points: {
    form_submit:        5,
    email_replied:      3,
    email_click:        2,
    link_click:         2,
    visitor_identified: 2,
    page_view:          1,
    email_open:         1,
    email_sent:         0,
  },
  warmThreshold: 3,
  hotThreshold:  6,
};

/**
 * Coerce a possibly-partial/legacy stored config into a complete, sane
 * `HeatScoringConfig`. Fills missing point keys from the defaults (preserving
 * unknown keys like `link_click` that the editor doesn't surface), clamps
 * points to non-negative integers, and guarantees `hotThreshold >= warmThreshold`.
 */
export function normalizeHeatScoringConfig(
  raw: Partial<HeatScoringConfig> | null | undefined,
): HeatScoringConfig {
  const points: Record<string, number> = { ...DEFAULT_HEAT_SCORING.points };
  if (raw && typeof raw === "object" && raw.points && typeof raw.points === "object") {
    for (const [key, value] of Object.entries(raw.points)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        points[key] = Math.max(0, Math.round(value));
      }
    }
  }
  const rawWarm = raw?.warmThreshold;
  const rawHot = raw?.hotThreshold;
  const warmThreshold =
    typeof rawWarm === "number" && Number.isFinite(rawWarm) && rawWarm >= 1
      ? Math.round(rawWarm)
      : DEFAULT_HEAT_SCORING.warmThreshold;
  let hotThreshold =
    typeof rawHot === "number" && Number.isFinite(rawHot) && rawHot >= 1
      ? Math.round(rawHot)
      : DEFAULT_HEAT_SCORING.hotThreshold;
  if (hotThreshold < warmThreshold) hotThreshold = warmThreshold;
  return { points, warmThreshold, hotThreshold };
}

/**
 * Weighted engagement score: sum of per-type points for an account's signals
 * over the trailing 14-day window from `refTime`. Signals older than 14 days
 * (and types with 0 / unset points) do not contribute.
 */
export function computeHeatScore(
  acctSignals: HeatSignal[],
  refTime: number,
  config: HeatScoringConfig = DEFAULT_HEAT_SCORING,
): number {
  const cutoff = refTime - FOURTEEN_DAYS_MS;
  let score = 0;
  for (const s of acctSignals) {
    if (new Date(s.createdAt).getTime() <= cutoff) continue;
    score += config.points[s.type] ?? 0;
  }
  return score;
}

/** Map a heat score to its tier using the config's thresholds. */
export function heatTierFromScore(
  score: number,
  config: HeatScoringConfig = DEFAULT_HEAT_SCORING,
): HeatTier {
  if (score >= config.hotThreshold) return "hot";
  if (score >= config.warmThreshold) return "warm";
  if (score > 0) return "cool";
  return "cold";
}

/** Heat tier for an account's signals over the trailing 14-day window. */
export function computeHeatTier(
  acctSignals: HeatSignal[],
  refTime: number,
  config: HeatScoringConfig = DEFAULT_HEAT_SCORING,
): HeatTier {
  return heatTierFromScore(computeHeatScore(acctSignals, refTime, config), config);
}
