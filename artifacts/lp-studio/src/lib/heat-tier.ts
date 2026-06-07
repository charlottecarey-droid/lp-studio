// ── Shared engagement heat scoring ───────────────────────────────────────────
// Single source of truth for the weighted recent-engagement score and heat tier
// used by both the sales dashboard and the Accounts page so the two surfaces can
// never drift. Mirrors the server-side scoring logic.

export interface HeatSignal {
  type: string;
  source?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type HeatTier = "hot" | "warm" | "cool" | "cold";

export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export const SIGNAL_WEIGHTS: Record<string, number> = {
  form_submit:        5,
  email_click:        3,
  link_click:         3,
  visitor_identified: 2,
  email_open:         2,
  page_view:          1,
};

/** Source + activity-aware weight for visitor_identified signals. */
export function visitorWeight(s: HeatSignal): number {
  const source = s.source ?? "";
  const meta   = (s.metadata ?? {}) as Record<string, string | undefined>;
  if (source === "rb2b")       return 3;
  if (source === "apollo")     return 2;
  if (source === "letterdrop") {
    const activity = meta.activityType ?? meta.lastActivity ?? "";
    if (activity.includes("comment"))               return 4;
    if (activity.includes("organization_follower")) return 2;
    if (activity.includes("profile_view"))          return 1;
    return 2;
  }
  return 2;
}

/**
 * Weighted recent-engagement score: sum of signal weights (×1.5) over signals in
 * the trailing 14-day window from `refTime`. Only recent signals count toward the
 * heat tier — this is the same score the per-row heat badges use on both pages.
 */
export function computeHeatScore(acctSignals: HeatSignal[], refTime: number): number {
  const cutoff = refTime - FOURTEEN_DAYS_MS;
  let score = 0;
  for (const s of acctSignals) {
    if (new Date(s.createdAt).getTime() <= cutoff) continue;
    const w = s.type === "visitor_identified" ? visitorWeight(s) : (SIGNAL_WEIGHTS[s.type] ?? 0);
    score += w * 1.5;
  }
  return score;
}

/** Map a weighted heat score to its tier. */
export function heatTierFromScore(score: number): HeatTier {
  if (score >= 15) return "hot";
  if (score >= 8)  return "warm";
  if (score >= 3)  return "cool";
  return "cold";
}

/** Weighted heat tier for an account's signals over the trailing 14-day window. */
export function computeHeatTier(acctSignals: HeatSignal[], refTime: number): HeatTier {
  const cutoff = refTime - FOURTEEN_DAYS_MS;
  const hasRecent = acctSignals.some(s => new Date(s.createdAt).getTime() > cutoff);
  if (!hasRecent) return "cold";
  return heatTierFromScore(computeHeatScore(acctSignals, refTime));
}
