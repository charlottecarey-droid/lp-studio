import {
  PLANS,
  type Plan,
  type PlanConfigEntry,
  type PlanFeatures,
  type PlanLimits,
} from "@workspace/plan-config";

/**
 * Shared structured-402 contract for every plan gate.
 *
 * All gates — boolean feature gates (`requirePlanFeature`) and numeric cap
 * gates (pages / forms / user seats / AI generations / heatmap sessions) —
 * deny with this single machine-readable shape so the client can render one
 * upgrade CTA instead of bespoke per-gate handling:
 *
 *   {
 *     error: "plan_upgrade_required",
 *     gate,                    // feature key OR cap key
 *     currentUsage,            // numeric for caps, null for boolean gates
 *     cap,                     // numeric for caps, null for boolean gates
 *     currentPlan,             // the tenant's resolved plan
 *     minimumPlanWithFeature,  // lowest tier (by sortOrder) that admits it
 *     upgradeUrl,
 *   }
 *
 * `minimumPlanWithFeature` is computed against the LIVE, SuperAdmin-editable
 * config passed in by the caller (from `getPlanConfig()`), so it always
 * reflects the current per-tier matrix rather than the canonical defaults.
 */

export const UPGRADE_URL = "/settings/billing";

/** Keys of PlanFeatures whose value is a boolean (excludes `limits`). */
export type BooleanFeatureKey = {
  [K in keyof PlanFeatures]: PlanFeatures[K] extends boolean ? K : never;
}[keyof PlanFeatures];

export type CapKey = keyof PlanLimits;

export interface PlanUpgradeRequired {
  error: "plan_upgrade_required";
  gate: string;
  currentUsage: number | null;
  cap: number | null;
  currentPlan: Plan;
  minimumPlanWithFeature: Plan | null;
  upgradeUrl: string;
}

function plansBySortOrder(config: Record<Plan, PlanConfigEntry>): Plan[] {
  return [...PLANS].sort((a, b) => config[a].sortOrder - config[b].sortOrder);
}

/**
 * Lowest tier (by sortOrder) whose config enables `feature`, or null if no
 * tier offers it.
 */
export function minimumPlanForFeature(
  feature: BooleanFeatureKey,
  config: Record<Plan, PlanConfigEntry>,
): Plan | null {
  for (const p of plansBySortOrder(config)) {
    if (config[p].features[feature] === true) return p;
  }
  return null;
}

/**
 * Lowest tier (by sortOrder) whose `cap` admits the given `usage` — i.e. the
 * cap is unlimited (null) or strictly greater than the current usage, so at
 * least one more can be created. Null if no tier admits it.
 */
export function minimumPlanForCap(
  cap: CapKey,
  usage: number,
  config: Record<Plan, PlanConfigEntry>,
): Plan | null {
  for (const p of plansBySortOrder(config)) {
    const limit = config[p].features.limits[cap];
    if (limit === null || limit > usage) return p;
  }
  return null;
}

/** Build the 402 body for a boolean feature gate. */
export function featureUpgradeBody(
  feature: BooleanFeatureKey,
  currentPlan: Plan,
  config: Record<Plan, PlanConfigEntry>,
): PlanUpgradeRequired {
  return {
    error: "plan_upgrade_required",
    gate: feature,
    currentUsage: null,
    cap: null,
    currentPlan,
    minimumPlanWithFeature: minimumPlanForFeature(feature, config),
    upgradeUrl: UPGRADE_URL,
  };
}

/** Build the 402 body for a numeric cap gate. */
export function capUpgradeBody(
  cap: CapKey,
  currentUsage: number,
  capValue: number,
  currentPlan: Plan,
  config: Record<Plan, PlanConfigEntry>,
): PlanUpgradeRequired {
  return {
    error: "plan_upgrade_required",
    gate: cap,
    currentUsage,
    cap: capValue,
    currentPlan,
    minimumPlanWithFeature: minimumPlanForCap(cap, currentUsage, config),
    upgradeUrl: UPGRADE_URL,
  };
}
