import { Router } from "express";
import { db } from "@workspace/db";
import { lpTestsTable, lpVariantsTable, lpEventsTable, lpLeadsTable, lpPagesTable } from "@workspace/db";
import { GetTestResultsParams } from "@workspace/api-zod";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

const router = Router();

function zScore(p1: number, p2: number, n1: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0;
  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return (p1 - p2) / se;
}

function pFromZ(z: number): number {
  // Two-tailed p-value approximation
  const absZ = Math.abs(z);
  if (absZ > 8) return absZ > 0 ? 0 : 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absZ);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);
  return 2 * (1 - y);
}

router.get("/lp/tests/:testId/results", async (req, res): Promise<void> => {
  const params = GetTestResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [test] = await db
    .select()
    .from(lpTestsTable)
    .where(eq(lpTestsTable.id, params.data.testId));

  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }

  const variants = await db
    .select()
    .from(lpVariantsTable)
    .where(eq(lpVariantsTable.testId, params.data.testId));

  // Get impression and conversion counts per variant
  const eventCounts = await db
    .select({
      variantId: lpEventsTable.variantId,
      eventType: lpEventsTable.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(lpEventsTable)
    .where(eq(lpEventsTable.testId, params.data.testId))
    .groupBy(lpEventsTable.variantId, lpEventsTable.eventType);

  const countMap = new Map<number, { impressions: number; conversions: number }>();
  for (const row of eventCounts) {
    if (!countMap.has(row.variantId)) {
      countMap.set(row.variantId, { impressions: 0, conversions: 0 });
    }
    const entry = countMap.get(row.variantId)!;
    if (row.eventType === "impression") entry.impressions = row.count;
    if (row.eventType === "conversion") entry.conversions = row.count;
  }

  // Get lead (MQL) counts per variant
  const variantPageIds = variants
    .filter((v) => v.builderPageId != null)
    .map((v) => v.builderPageId!);

  const leadCountMap = new Map<number, number>();
  if (variantPageIds.length > 0 || variants.length > 0) {
    // Leads can be linked by variantId directly
    const leadCounts = await db
      .select({
        variantId: lpLeadsTable.variantId,
        count: sql<number>`count(*)::int`,
      })
      .from(lpLeadsTable)
      .where(
        sql`${lpLeadsTable.variantId} IN (${sql.join(
          variants.map((v) => sql`${v.id}`),
          sql`, `
        )})`
      )
      .groupBy(lpLeadsTable.variantId);

    for (const row of leadCounts) {
      if (row.variantId != null) {
        leadCountMap.set(row.variantId, row.count);
      }
    }
  }

  // Daily time-series for the last 30 days
  const dailyEvents = await db
    .select({
      variantId: lpEventsTable.variantId,
      eventType: lpEventsTable.eventType,
      day: sql<string>`to_char(${lpEventsTable.createdAt}::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(lpEventsTable)
    .where(
      and(
        eq(lpEventsTable.testId, params.data.testId),
        gte(lpEventsTable.createdAt, sql`now() - interval '30 days'`)
      )
    )
    .groupBy(lpEventsTable.variantId, lpEventsTable.eventType, sql`${lpEventsTable.createdAt}::date`)
    .orderBy(sql`${lpEventsTable.createdAt}::date`);

  // Build daily map: { day -> { variantId -> { impressions, conversions } } }
  const dailyMap = new Map<string, Map<number, { impressions: number; conversions: number }>>();
  for (const row of dailyEvents) {
    if (!dailyMap.has(row.day)) dailyMap.set(row.day, new Map());
    const dayData = dailyMap.get(row.day)!;
    if (!dayData.has(row.variantId)) dayData.set(row.variantId, { impressions: 0, conversions: 0 });
    const entry = dayData.get(row.variantId)!;
    if (row.eventType === "impression") entry.impressions = row.count;
    if (row.eventType === "conversion") entry.conversions = row.count;
  }

  const control = variants.find(v => v.isControl) ?? variants[0];
  const controlCounts = countMap.get(control?.id ?? 0) ?? { impressions: 0, conversions: 0 };
  const controlRate = controlCounts.impressions > 0
    ? controlCounts.conversions / controlCounts.impressions
    : 0;

  let totalImpressions = 0;
  let totalConversions = 0;
  let winnerId: number | null = null;
  let bestRate = controlRate;

  const variantResults = variants.map(v => {
    const counts = countMap.get(v.id) ?? { impressions: 0, conversions: 0 };
    totalImpressions += counts.impressions;
    totalConversions += counts.conversions;

    const conversionRate = counts.impressions > 0
      ? counts.conversions / counts.impressions
      : 0;

    let relativeUplift: number | null = null;
    let z = 0;
    let pValue = 1;
    let isSignificant = false;

    if (!v.isControl && control) {
      relativeUplift = controlRate > 0
        ? ((conversionRate - controlRate) / controlRate) * 100
        : null;
      z = zScore(conversionRate, controlRate, counts.impressions, controlCounts.impressions);
      pValue = pFromZ(z);
      isSignificant = pValue < 0.05;
    }

    if (conversionRate > bestRate && isSignificant) {
      bestRate = conversionRate;
      winnerId = v.id;
    }

    const leads = leadCountMap.get(v.id) ?? 0;
    const leadRate = counts.impressions > 0 ? leads / counts.impressions : 0;

    return {
      variantId: v.id,
      variantName: v.name,
      isControl: v.isControl,
      impressions: counts.impressions,
      conversions: counts.conversions,
      conversionRate,
      leads,
      leadRate,
      relativeUplift,
      zScore: v.isControl ? null : z,
      pValue: v.isControl ? null : pValue,
      isSignificant: v.isControl ? false : isSignificant,
      confidenceLevel: v.isControl ? 100 : Math.round((1 - pValue) * 100),
    };
  });

  // Build daily time-series array
  const dailySeries: { day: string; [key: string]: number | string }[] = [];
  const sortedDays = [...dailyMap.keys()].sort();
  for (const day of sortedDays) {
    const dayData = dailyMap.get(day)!;
    const entry: Record<string, number | string> = { day };
    for (const v of variants) {
      const d = dayData.get(v.id);
      entry[`v${v.id}_impressions`] = d?.impressions ?? 0;
      entry[`v${v.id}_conversions`] = d?.conversions ?? 0;
    }
    dailySeries.push(entry);
  }

  const totalLeads = variantResults.reduce((s, v) => s + v.leads, 0);

  res.json({
    testId: test.id,
    testName: test.name,
    status: test.status,
    totalImpressions,
    totalConversions,
    totalLeads,
    overallConversionRate: totalImpressions > 0 ? totalConversions / totalImpressions : 0,
    overallLeadRate: totalImpressions > 0 ? totalLeads / totalImpressions : 0,
    winnerId,
    variants: variantResults,
    dailySeries,
  });
});

export default router;
