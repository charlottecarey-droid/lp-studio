import { db } from "@workspace/db";
import { lpSmartTrafficStatsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { Request } from "express";
import { randomBytes } from "crypto";

/** Crypto-safe random float in [0, 1) */
function secureRandom(): number {
  return randomBytes(4).readUInt32BE(0) / 0x100000000;
}

// ─── Visitor Feature Collection ───────────────────────────────────────────────

export interface VisitorFeatures {
  device: "mobile" | "tablet" | "desktop";
  browser: "chrome" | "safari" | "firefox" | "edge" | "other";
  os: "windows" | "macos" | "ios" | "android" | "linux" | "other";
  country: string;
  dayOfWeek: number;   // 0-6
  hourOfDay: number;   // 0-23
  referrerDomain: string;
  utmSource: string;
  utmMedium: string;
}

const MOBILE_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_REGEX = /iPad|Android(?!.*Mobile)/i;

function parseDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (TABLET_REGEX.test(ua)) return "tablet";
  if (MOBILE_REGEX.test(ua)) return "mobile";
  return "desktop";
}

function parseBrowser(ua: string): VisitorFeatures["browser"] {
  if (/Edg\//i.test(ua)) return "edge";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "safari";
  if (/Firefox\//i.test(ua)) return "firefox";
  return "other";
}

function parseOs(ua: string): VisitorFeatures["os"] {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mac OS X/i.test(ua)) return "macos";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

function extractDomain(referer: string | undefined): string {
  if (!referer) return "direct";
  try {
    return new URL(referer).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function collectFeatures(req: Request, countryCode: string | null, timezone?: string): VisitorFeatures {
  const ua = req.headers["user-agent"] ?? "";
  const now = new Date();

  // NOTE: Currently using UTC for dayOfWeek and hourOfDay. To use local timezone,
  // pass timezone param (e.g., from geo-IP header). Without timezone support,
  // all visitors are bucketed by UTC time regardless of their local zone.
  let dayOfWeek = now.getUTCDay();
  let hourOfDay = now.getUTCHours();

  // If timezone is provided, apply offset to calculate local time
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const partsMap = new Map(parts.map(p => [p.type, p.value]));
      const localDate = new Date(
        parseInt(partsMap.get("year")!),
        parseInt(partsMap.get("month")!) - 1,
        parseInt(partsMap.get("day")!),
        parseInt(partsMap.get("hour")!),
        parseInt(partsMap.get("minute")!),
        parseInt(partsMap.get("second")!)
      );
      dayOfWeek = localDate.getDay();
      hourOfDay = localDate.getHours();
    } catch {
      // Fallback to UTC if timezone format is invalid
    }
  }

  return {
    device: parseDevice(ua),
    browser: parseBrowser(ua),
    os: parseOs(ua),
    country: (countryCode ?? "unknown").toLowerCase(),
    dayOfWeek,
    hourOfDay,
    referrerDomain: extractDomain(req.headers.referer),
    utmSource: (req.query.utm_source as string ?? "none").toLowerCase(),
    utmMedium: (req.query.utm_medium as string ?? "none").toLowerCase(),
  };
}

// ─── Feature Bucketing ────────────────────────────────────────────────────────

/**
 * Create a composite feature bucket key from the most predictive features.
 * Start with device + country as the default context dimensions.
 */
export function featureBucket(features: VisitorFeatures): string {
  return `${features.device}|${features.country}`;
}

// ─── Thompson Sampling ────────────────────────────────────────────────────────

/**
 * Sample from a Beta distribution using the Jöhnk algorithm.
 * Beta(α, β) where α = successes + 1, β = failures + 1
 */
function sampleBeta(alpha: number, beta: number): number {
  // For large α, β use the normal approximation
  if (alpha > 1 && beta > 1) {
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const stddev = Math.sqrt(variance);
    // Box-Muller transform for normal random
    const u1 = secureRandom();
    const u2 = secureRandom();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.min(1, mean + z * stddev));
  }

  // Jöhnk's algorithm for small parameters
  while (true) {
    const u = secureRandom();
    const v = secureRandom();
    const x = u ** (1 / alpha);
    const y = v ** (1 / beta);
    if (x + y <= 1) {
      return x / (x + y);
    }
  }
}

interface VariantStats {
  variantId: number;
  successes: number;
  failures: number;
}

/**
 * Pick the best variant for a visitor using Thompson Sampling.
 *
 * @param testId - The test being run
 * @param variantIds - Available variant IDs
 * @param features - Visitor features for contextual bucketing
 * @param minSamples - Minimum total impressions before smart routing activates
 * @param explorationRate - Fraction of traffic routed randomly (safety floor)
 * @returns The chosen variant ID, or null if not enough data (fall back to random)
 */
export async function pickVariantThompson(
  testId: number,
  variantIds: number[],
  features: VisitorFeatures,
  minSamples: number = 100,
  explorationRate: number = 0.1,
): Promise<number | null> {
  if (variantIds.length <= 1) return variantIds[0] ?? null;

  // Exploration floor: 10% of traffic is random regardless
  if (secureRandom() < explorationRate) return null;

  const bucket = featureBucket(features);

  // Build a map of variant stats, preferring bucket-specific over global
  const bucketMap = new Map<number, VariantStats>();
  const globalMap = new Map<number, VariantStats>();

  // Two targeted queries: one for this visitor's feature bucket, one for global fallback
  const bucketStats = await db
    .select({
      variantId: lpSmartTrafficStatsTable.variantId,
      successes: lpSmartTrafficStatsTable.successes,
      failures: lpSmartTrafficStatsTable.failures,
    })
    .from(lpSmartTrafficStatsTable)
    .where(
      and(
        eq(lpSmartTrafficStatsTable.testId, testId),
        eq(lpSmartTrafficStatsTable.featureBucket, bucket),
      )
    );

  const globalStats = await db
    .select({
      variantId: lpSmartTrafficStatsTable.variantId,
      successes: lpSmartTrafficStatsTable.successes,
      failures: lpSmartTrafficStatsTable.failures,
    })
    .from(lpSmartTrafficStatsTable)
    .where(
      and(
        eq(lpSmartTrafficStatsTable.testId, testId),
        eq(lpSmartTrafficStatsTable.featureBucket, "global"),
      )
    );

  for (const s of bucketStats) bucketMap.set(s.variantId, s);
  for (const s of globalStats) globalMap.set(s.variantId, s);

  // Check if we have enough total observations
  let totalObservations = 0;
  for (const s of globalStats) {
    totalObservations += s.successes + s.failures;
  }
  if (totalObservations < minSamples) return null; // Not enough data yet

  // Thompson Sampling: sample from Beta distribution for each variant
  let bestVariantId = variantIds[0];
  let bestSample = -1;

  for (const vid of variantIds) {
    // Prefer bucket-specific stats if they have >= 30 observations, else fall back to global
    const bStats = bucketMap.get(vid);
    const gStats = globalMap.get(vid);

    let alpha: number;
    let beta: number;

    if (bStats && (bStats.successes + bStats.failures) >= 30) {
      alpha = bStats.successes + 1;
      beta = bStats.failures + 1;
    } else if (gStats) {
      alpha = gStats.successes + 1;
      beta = gStats.failures + 1;
    } else {
      // No data — uniform prior
      alpha = 1;
      beta = 1;
    }

    const sample = sampleBeta(alpha, beta);
    if (sample > bestSample) {
      bestSample = sample;
      bestVariantId = vid;
    }
  }

  return bestVariantId;
}

// ─── Stats Updates ────────────────────────────────────────────────────────────

/**
 * Record an impression (failure in bandit terms) for a variant.
 */
export async function recordImpression(testId: number, variantId: number, features: VisitorFeatures) {
  const bucket = featureBucket(features);
  const buckets = [bucket, "global"];

  for (const b of buckets) {
    await db
      .insert(lpSmartTrafficStatsTable)
      .values({ testId, variantId, featureBucket: b, successes: 0, failures: 1 })
      .onConflictDoUpdate({
        target: [lpSmartTrafficStatsTable.testId, lpSmartTrafficStatsTable.variantId, lpSmartTrafficStatsTable.featureBucket],
        set: {
          failures: sql`${lpSmartTrafficStatsTable.failures} + 1`,
        },
      });
  }
}

/**
 * Record a conversion (success in bandit terms) for a variant.
 * We increment successes and decrement failures (since the impression was already counted as a failure).
 */
export async function recordConversion(testId: number, variantId: number, features: VisitorFeatures) {
  const bucket = featureBucket(features);
  const buckets = [bucket, "global"];

  for (const b of buckets) {
    await db
      .insert(lpSmartTrafficStatsTable)
      .values({ testId, variantId, featureBucket: b, successes: 1, failures: 0 })
      .onConflictDoUpdate({
        target: [lpSmartTrafficStatsTable.testId, lpSmartTrafficStatsTable.variantId, lpSmartTrafficStatsTable.featureBucket],
        set: {
          successes: sql`${lpSmartTrafficStatsTable.successes} + 1`,
          // Move from failure to success: decrement failures (but don't go below 0)
          failures: sql`GREATEST(${lpSmartTrafficStatsTable.failures} - 1, 0)`,
        },
      });
  }
}

// ─── Smart Traffic Insights ───────────────────────────────────────────────────

export interface SmartTrafficInsight {
  variantId: number;
  featureBucket: string;
  successes: number;
  failures: number;
  conversionRate: number;
  observations: number;
  trafficShare: number;
}

/**
 * Get smart traffic stats for a test, including per-bucket breakdown.
 */
export async function getSmartTrafficStats(testId: number) {
  const allStats = await db
    .select()
    .from(lpSmartTrafficStatsTable)
    .where(eq(lpSmartTrafficStatsTable.testId, testId));

  // Global totals per variant
  const globalStats = allStats.filter(s => s.featureBucket === "global");
  const totalObservations = globalStats.reduce((sum, s) => sum + s.successes + s.failures, 0);

  const variantSummary = globalStats.map(s => {
    const observations = s.successes + s.failures;
    return {
      variantId: s.variantId,
      featureBucket: "global",
      successes: s.successes,
      failures: s.failures,
      conversionRate: observations > 0 ? s.successes / observations : 0,
      observations,
      trafficShare: totalObservations > 0 ? observations / totalObservations : 0,
    };
  });

  // Per-bucket breakdown (exclude global)
  const bucketStats = allStats
    .filter(s => s.featureBucket !== "global")
    .map(s => {
      const observations = s.successes + s.failures;
      return {
        variantId: s.variantId,
        featureBucket: s.featureBucket,
        successes: s.successes,
        failures: s.failures,
        conversionRate: observations > 0 ? s.successes / observations : 0,
        observations,
        trafficShare: 0, // Calculated per-bucket if needed
      };
    });

  // Simulate what Thompson Sampling would route right now for a few key buckets
  const uniqueBuckets = [...new Set(bucketStats.map(s => s.featureBucket))];

  // Calculate estimated lift
  const evenCvr = totalObservations > 0
    ? globalStats.reduce((sum, s) => sum + s.successes, 0) / totalObservations
    : 0;

  // Smart CVR = weighted average where weights are proportional to what Thompson would assign
  // For simplicity, use the variant with the highest global conversion rate as the "smart" winner
  const bestVariant = variantSummary.reduce((best, v) =>
    v.conversionRate > best.conversionRate ? v : best
  , variantSummary[0] ?? { conversionRate: 0 });

  const estimatedLift = evenCvr > 0 && bestVariant
    ? ((bestVariant.conversionRate - evenCvr) / evenCvr) * 100
    : 0;

  // Convergence detection: flag if one variant is getting >90% of traffic
  const convergenceThreshold = 0.9;
  const convergedVariant = variantSummary.find(v => v.trafficShare > convergenceThreshold);
  const hasConverged = !!convergedVariant && totalObservations >= 200;

  return {
    totalObservations,
    estimatedLift: Math.max(0, estimatedLift),
    variantSummary,
    bucketStats,
    uniqueBuckets,
    isLearning: totalObservations < 100,
    isActive: totalObservations >= 100,
    hasConverged,
    convergedVariantId: hasConverged ? convergedVariant!.variantId : null,
  };
}

/**
 * Reset all smart traffic stats for a test.
 */
export async function resetSmartTrafficStats(testId: number) {
  await db
    .delete(lpSmartTrafficStatsTable)
    .where(eq(lpSmartTrafficStatsTable.testId, testId));
}
