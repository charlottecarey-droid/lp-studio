import { pool } from "@workspace/db";
import {
  PLAN_CONFIG,
  PLANS,
  type Plan,
  type PlanConfigEntry,
  type PlanFeatures,
} from "@workspace/plan-config";

/**
 * Cached accessor over the `plan_config` DB table.
 *
 * The table is seeded from (and overrides) the canonical defaults in
 * `@workspace/plan-config`. SuperAdmin edits mutate the table; everything
 * server-side that gates on plan reads through here so edits go live within
 * the cache TTL.
 *
 * Caching: in-memory, per-process, 60s TTL, busted explicitly on a
 * SuperAdmin save via `bustPlanConfigCache()`. With multiple server
 * processes each holds its own cache, so a save is visible everywhere within
 * one TTL window even without cross-process invalidation.
 *
 * Resilience: ANY DB error (or a missing row) falls back to the canonical
 * defaults for the affected tier. Gating must never fail open or throw just
 * because the config table hiccuped — the defaults ARE the historical
 * hardcoded matrix, so the fallback is exactly the pre-Phase-1 behavior.
 */

const CACHE_TTL_MS = 60_000;

interface PlanConfigRow {
  tier: string;
  display_name: string;
  price_monthly: number | null;
  price_annual: number | null;
  self_serve: boolean;
  sort_order: number;
  sales_console: boolean;
  ai_image_gen: boolean;
  custom_domain: boolean;
  branded_email_subdomain: boolean;
  custom_email_domain: boolean;
  smart_traffic: boolean;
  custom_blocks: boolean;
  programmatic_pages: boolean;
  multi_workspace: boolean;
  cap_pages: number | null;
  cap_forms: number | null;
  cap_user_seats: number | null;
  cap_ai_generations_per_month: number | null;
  cap_heatmap_sessions_per_month: number | null;
}

let cache: Record<Plan, PlanConfigEntry> | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<Record<Plan, PlanConfigEntry>> | null = null;
// Bumped on every bust so an in-flight load started before the bust can't
// repopulate the cache with now-stale data after it resolves.
let generation = 0;

function rowToEntry(row: PlanConfigRow, fallback: PlanConfigEntry): PlanConfigEntry {
  return {
    tier: fallback.tier,
    displayName: row.display_name ?? fallback.displayName,
    priceMonthly: row.price_monthly,
    priceAnnual: row.price_annual,
    selfServe: row.self_serve,
    sortOrder: row.sort_order,
    features: {
      salesConsole: row.sales_console,
      aiImageGen: row.ai_image_gen,
      customDomain: row.custom_domain,
      brandedEmailSubdomain: row.branded_email_subdomain,
      customEmailDomain: row.custom_email_domain,
      smartTraffic: row.smart_traffic,
      customBlocks: row.custom_blocks,
      programmaticPages: row.programmatic_pages,
      multiWorkspace: row.multi_workspace,
      limits: {
        pages: row.cap_pages,
        forms: row.cap_forms,
        userSeats: row.cap_user_seats,
        aiGenerationsPerMonth: row.cap_ai_generations_per_month,
        heatmapSessionsPerMonth: row.cap_heatmap_sessions_per_month,
      },
    },
  };
}

async function loadFromDb(): Promise<Record<Plan, PlanConfigEntry>> {
  // Start from canonical defaults so any tier missing a DB row keeps working.
  const merged: Record<Plan, PlanConfigEntry> = {
    free: PLAN_CONFIG.free,
    starter: PLAN_CONFIG.starter,
    growth: PLAN_CONFIG.growth,
    scale: PLAN_CONFIG.scale,
    enterprise: PLAN_CONFIG.enterprise,
  };
  try {
    const r = await pool.query<PlanConfigRow>(
      `SELECT tier, display_name, price_monthly, price_annual, self_serve, sort_order,
              sales_console, ai_image_gen, custom_domain,
              branded_email_subdomain, custom_email_domain,
              smart_traffic, custom_blocks, programmatic_pages, multi_workspace,
              cap_pages, cap_forms, cap_user_seats,
              cap_ai_generations_per_month, cap_heatmap_sessions_per_month
         FROM plan_config`,
    );
    for (const row of r.rows) {
      const tier = (row.tier ?? "").toLowerCase();
      if ((PLANS as readonly string[]).includes(tier)) {
        const p = tier as Plan;
        merged[p] = rowToEntry(row, PLAN_CONFIG[p]);
      }
    }
  } catch (err) {
    console.warn("[planConfig] DB load failed; using canonical defaults", err);
    return {
      free: PLAN_CONFIG.free,
      starter: PLAN_CONFIG.starter,
      growth: PLAN_CONFIG.growth,
      scale: PLAN_CONFIG.scale,
      enterprise: PLAN_CONFIG.enterprise,
    };
  }
  return merged;
}

/**
 * Full per-tier config (display names, prices, caps, flags), DB-backed and
 * cached. Falls back to canonical defaults on any failure.
 */
export async function getPlanConfig(): Promise<Record<Plan, PlanConfigEntry>> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) return cache;
  if (inFlight) return inFlight;
  const startedGeneration = generation;
  inFlight = loadFromDb()
    .then((cfg) => {
      // Only commit if no bust happened while this load was in flight;
      // otherwise return the fresh config to this caller but leave the
      // cache empty so the next call reloads.
      if (startedGeneration === generation) {
        cache = cfg;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      }
      return cfg;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Just the enforceable feature/cap matrix per tier (DB-backed, cached). */
export async function getPlanFeaturesMap(): Promise<Record<Plan, PlanFeatures>> {
  const cfg = await getPlanConfig();
  return {
    free: cfg.free.features,
    starter: cfg.starter.features,
    growth: cfg.growth.features,
    scale: cfg.scale.features,
    enterprise: cfg.enterprise.features,
  };
}

/** Resolve one tier's feature/cap matrix (DB-backed, cached). */
export async function getPlanFeatures(plan: Plan): Promise<PlanFeatures> {
  const cfg = await getPlanConfig();
  return cfg[plan].features;
}

/** Invalidate the in-memory cache. Call after a SuperAdmin save. */
export function bustPlanConfigCache(): void {
  cache = null;
  cacheExpiresAt = 0;
  // Invalidate any load already in flight so it can't repopulate the cache
  // with data read before this save. inFlight itself is left alone — the
  // pending promise still resolves for its current waiters, it just won't
  // commit to the cache (see getPlanConfig generation check).
  generation += 1;
}
