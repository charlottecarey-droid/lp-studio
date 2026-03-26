import { Router } from "express";
import { db } from "@workspace/db";
import { lpPagesTable, lpVariantsTable, lpEventsTable, lpHeatmapEventsTable, lpPageVisitsTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";

const router = Router();

/**
 * GET /lp/pages/performance/batch — performance scores for multiple pages at once.
 * Used by the pages gallery to show badges.
 * Query params: ids=1,2,3
 *
 * IMPORTANT: This static route MUST come before the :pageId route below.
 */
router.get("/lp/pages/performance/batch", async (req, res): Promise<void> => {
  try {
    const idsParam = (req.query.ids as string) || "";
    const pageIds = idsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
    if (pageIds.length === 0) {
      res.json([]);
      return;
    }

    const days = 30;
    const dateFilter = sql`now() - interval '${sql.raw(String(days))} days'`;

    // Batch: get all variants linked to these pages
    const variants = await db
      .select({ id: lpVariantsTable.id, testId: lpVariantsTable.testId, pageId: lpVariantsTable.builderPageId })
      .from(lpVariantsTable)
      .where(inArray(lpVariantsTable.builderPageId, pageIds));

    // CVR per page
    const cvrByPage: Record<number, { impressions: number; conversions: number }> = {};
    for (const pid of pageIds) cvrByPage[pid] = { impressions: 0, conversions: 0 };

    if (variants.length > 0) {
      const variantToPage = new Map<number, number>();
      for (const v of variants) {
        if (v.pageId != null) variantToPage.set(v.id, v.pageId);
      }
      const variantIds = variants.map(v => v.id);

      const eventRows = await db
        .select({
          variantId: lpEventsTable.variantId,
          eventType: lpEventsTable.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(lpEventsTable)
        .where(and(
          inArray(lpEventsTable.variantId, variantIds),
          sql`${lpEventsTable.createdAt} > ${dateFilter}`,
        ))
        .groupBy(lpEventsTable.variantId, lpEventsTable.eventType);

      for (const row of eventRows) {
        const pid = variantToPage.get(row.variantId);
        if (pid == null) continue;
        if (row.eventType === "impression") cvrByPage[pid].impressions += row.count;
        if (row.eventType === "conversion") cvrByPage[pid].conversions += row.count;
      }
    }

    // Scroll depth per page
    const scrollRows = await db
      .select({
        pageId: lpHeatmapEventsTable.pageId,
        avgDepth: sql<number>`round(avg(${lpHeatmapEventsTable.scrollDepthPct})::numeric, 1)`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        inArray(lpHeatmapEventsTable.pageId, pageIds),
        eq(lpHeatmapEventsTable.eventType, "scroll"),
        sql`${lpHeatmapEventsTable.createdAt} > ${dateFilter}`,
      ))
      .groupBy(lpHeatmapEventsTable.pageId);

    const scrollByPage = new Map(scrollRows.map(r => [r.pageId, r.avgDepth ?? 0]));

    // Click engagement per page
    const clickRows = await db
      .select({
        pageId: lpHeatmapEventsTable.pageId,
        totalClicks: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${lpHeatmapEventsTable.sessionId})::int`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        inArray(lpHeatmapEventsTable.pageId, pageIds),
        eq(lpHeatmapEventsTable.eventType, "click"),
        sql`${lpHeatmapEventsTable.createdAt} > ${dateFilter}`,
      ))
      .groupBy(lpHeatmapEventsTable.pageId);

    const clicksByPage = new Map(clickRows.map(r => [r.pageId, {
      clicksPerSession: r.sessions > 0 ? r.totalClicks / r.sessions : 0,
    }]));

    // Visit counts per page
    const visitRows = await db
      .select({
        pageId: lpPageVisitsTable.pageId,
        visits: sql<number>`count(*)::int`,
      })
      .from(lpPageVisitsTable)
      .where(and(
        inArray(lpPageVisitsTable.pageId, pageIds),
        sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`,
      ))
      .groupBy(lpPageVisitsTable.pageId);

    const visitsByPage = new Map(visitRows.map(r => [r.pageId, r.visits]));

    const results = pageIds.map(pid => {
      const { impressions, conversions } = cvrByPage[pid] ?? { impressions: 0, conversions: 0 };
      const cvr = impressions > 0 ? (conversions / impressions) * 100 : 0;
      const avgScroll = scrollByPage.get(pid) ?? 0;
      const clicks = clicksByPage.get(pid)?.clicksPerSession ?? 0;
      const visits = (visitsByPage.get(pid) ?? 0) + impressions;

      return {
        pageId: pid,
        metrics: {
          cvr: Math.round(cvr * 100) / 100,
          impressions,
          conversions,
          totalVisits: visits,
          avgScrollDepth: avgScroll,
          clicksPerSession: Math.round(clicks * 100) / 100,
        },
        scores: {
          cvr: Math.min(Math.round((cvr / 5) * 100), 100),
          scroll: Math.min(Math.round(avgScroll), 100),
          engagement: Math.min(Math.round((clicks / 5) * 100), 100),
        },
      };
    });

    res.json(results);
  } catch (err) {
    console.error("Batch performance error:", err);
    res.json([]);
  }
});

/**
 * GET /lp/pages/:pageId/performance — behavioral performance metrics for a page.
 *
 * Returns raw metrics so the client can combine with SEO score (computed client-side)
 * to produce a composite performance score.
 *
 * Composite formula (client-side):
 *   Performance = CVR * 0.40 + ScrollScore * 0.20 + EngagementScore * 0.20 + SEOScore * 0.20
 */
router.get("/lp/pages/:pageId/performance", async (req, res): Promise<void> => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    const days = parseInt((req.query.days as string) || "30", 10);
    const dateFilter = sql`now() - interval '${sql.raw(String(days))} days'`;

    // 1. Get the page
    const [page] = await db.select().from(lpPagesTable).where(eq(lpPagesTable.id, pageId));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    // 2. Find all variants that link to this page
    const variants = await db
      .select({ id: lpVariantsTable.id, testId: lpVariantsTable.testId })
      .from(lpVariantsTable)
      .where(eq(lpVariantsTable.builderPageId, pageId));

    let cvr = 0;
    let impressions = 0;
    let conversions = 0;

    if (variants.length > 0) {
      const variantIds = variants.map(v => v.id);

      // Count impressions and conversions for these variants
      const [eventStats] = await db
        .select({
          impressions: sql<number>`count(*) filter (where ${lpEventsTable.eventType} = 'impression')::int`,
          conversions: sql<number>`count(*) filter (where ${lpEventsTable.eventType} = 'conversion')::int`,
        })
        .from(lpEventsTable)
        .where(and(
          inArray(lpEventsTable.variantId, variantIds),
          sql`${lpEventsTable.createdAt} > ${dateFilter}`,
        ));

      impressions = eventStats?.impressions ?? 0;
      conversions = eventStats?.conversions ?? 0;
      cvr = impressions > 0 ? (conversions / impressions) * 100 : 0;
    }

    // Also count page visits for standalone pages (not linked to tests)
    const [visitStats] = await db
      .select({
        visits: sql<number>`count(*)::int`,
      })
      .from(lpPageVisitsTable)
      .where(and(
        eq(lpPageVisitsTable.pageId, pageId),
        sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`,
      ));
    const totalVisits = (visitStats?.visits ?? 0) + impressions;

    // 3. Scroll depth — average max scroll depth per session from heatmap data
    const [scrollStats] = await db
      .select({
        avgMaxScroll: sql<number>`round(avg(max_depth)::numeric, 1)`,
        sessionCount: sql<number>`count(*)::int`,
      })
      .from(
        db.select({
          max_depth: sql<number>`max(${lpHeatmapEventsTable.scrollDepthPct})`.as("max_depth"),
        })
        .from(lpHeatmapEventsTable)
        .where(and(
          eq(lpHeatmapEventsTable.pageId, pageId),
          eq(lpHeatmapEventsTable.eventType, "scroll"),
          sql`${lpHeatmapEventsTable.createdAt} > ${dateFilter}`,
        ))
        .groupBy(lpHeatmapEventsTable.sessionId)
        .as("scroll_sessions")
      );

    const avgScrollDepth = scrollStats?.avgMaxScroll ?? 0;

    // 4. Click engagement — average clicks per session
    const [clickStats] = await db
      .select({
        totalClicks: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${lpHeatmapEventsTable.sessionId})::int`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        eq(lpHeatmapEventsTable.pageId, pageId),
        eq(lpHeatmapEventsTable.eventType, "click"),
        sql`${lpHeatmapEventsTable.createdAt} > ${dateFilter}`,
      ));

    const clicksPerSession = (clickStats?.uniqueSessions ?? 0) > 0
      ? (clickStats?.totalClicks ?? 0) / clickStats!.uniqueSessions
      : 0;

    // 5. Compute behavioral sub-scores (0-100 each)
    // CVR score: 0% → 0, 5%+ → 100 (linear scale, 5% is excellent for landing pages)
    const cvrScore = Math.min(Math.round((cvr / 5) * 100), 100);

    // Scroll score: avg scroll depth directly maps to score (0-100%)
    const scrollScore = Math.min(Math.round(avgScrollDepth), 100);

    // Engagement score: 0 clicks → 0, 5+ clicks/session → 100
    const engagementScore = Math.min(Math.round((clicksPerSession / 5) * 100), 100);

    res.json({
      pageId,
      period: `${days}d`,
      metrics: {
        cvr: Math.round(cvr * 100) / 100,
        impressions,
        conversions,
        totalVisits,
        avgScrollDepth,
        clicksPerSession: Math.round(clicksPerSession * 100) / 100,
      },
      scores: {
        cvr: cvrScore,
        scroll: scrollScore,
        engagement: engagementScore,
        // SEO score is computed client-side and merged in
      },
    });
  } catch (err) {
    console.error("Performance score error:", err);
    res.status(500).json({ error: "Failed to compute performance score" });
  }
});

export default router;
