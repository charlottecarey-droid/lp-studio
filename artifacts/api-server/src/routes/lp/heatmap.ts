import { Router } from "express";
import { db } from "@workspace/db";
import { lpHeatmapEventsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

/**
 * POST /lp/heatmap — batch ingest heatmap events from the client collector.
 * Expects { events: HeatmapEvent[] }.
 */
router.post("/lp/heatmap", async (req, res): Promise<void> => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: "events array is required" });
      return;
    }

    // Cap batch size to prevent abuse
    const batch = events.slice(0, 200);

    const rows = batch.map((e: Record<string, unknown>) => ({
      pageId: Number(e.pageId),
      sessionId: String(e.sessionId ?? ""),
      eventType: String(e.eventType ?? "click"),
      xPct: e.xPct != null ? Number(e.xPct) : null,
      yPct: e.yPct != null ? Number(e.yPct) : null,
      blockId: e.blockId ? String(e.blockId) : null,
      elementTag: e.elementTag ? String(e.elementTag) : null,
      scrollDepthPct: e.scrollDepthPct != null ? Number(e.scrollDepthPct) : null,
      viewportWidth: e.viewportWidth ? Number(e.viewportWidth) : null,
      viewportHeight: e.viewportHeight ? Number(e.viewportHeight) : null,
      device: e.device ? String(e.device) : null,
    }));

    await db.insert(lpHeatmapEventsTable).values(rows);
    res.json({ success: true, count: rows.length });
  } catch (err) {
    console.error("Heatmap ingest error:", err);
    res.status(500).json({ error: "Failed to store heatmap events" });
  }
});

/**
 * GET /lp/pages/:pageId/heatmap — aggregated heatmap data for visualization.
 * Query params:
 *   - type: "click" | "scroll" | "all" (default "all")
 *   - device: "desktop" | "tablet" | "mobile" | "all" (default "all")
 *   - days: number of days to look back (default 30)
 */
router.get("/lp/pages/:pageId/heatmap", async (req, res): Promise<void> => {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    const type = (req.query.type as string) || "all";
    const device = (req.query.device as string) || "all";
    const days = parseInt((req.query.days as string) || "30", 10);

    const conditions = [
      eq(lpHeatmapEventsTable.pageId, pageId),
      sql`${lpHeatmapEventsTable.createdAt} > now() - interval '${sql.raw(String(days))} days'`,
    ];

    if (type !== "all") {
      conditions.push(eq(lpHeatmapEventsTable.eventType, type));
    }
    if (device !== "all") {
      conditions.push(eq(lpHeatmapEventsTable.device, device));
    }

    // Click heatmap data: aggregate clicks into grid cells (1% x 1% buckets)
    const clickData = type === "scroll" ? [] : await db
      .select({
        xBucket: sql<number>`floor(${lpHeatmapEventsTable.xPct})::int`,
        yBucket: sql<number>`floor(${lpHeatmapEventsTable.yPct})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        eq(lpHeatmapEventsTable.pageId, pageId),
        eq(lpHeatmapEventsTable.eventType, "click"),
        sql`${lpHeatmapEventsTable.createdAt} > now() - interval '${sql.raw(String(days))} days'`,
        ...(device !== "all" ? [eq(lpHeatmapEventsTable.device, device)] : []),
      ))
      .groupBy(
        sql`floor(${lpHeatmapEventsTable.xPct})::int`,
        sql`floor(${lpHeatmapEventsTable.yPct})::int`,
      );

    // Scroll depth distribution: histogram of max scroll depths per session
    const scrollData = type === "click" ? [] : await db
      .select({
        depthBucket: sql<number>`(floor(max(${lpHeatmapEventsTable.scrollDepthPct}) / 10) * 10)::int`,
        sessions: sql<number>`count(distinct ${lpHeatmapEventsTable.sessionId})::int`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        eq(lpHeatmapEventsTable.pageId, pageId),
        eq(lpHeatmapEventsTable.eventType, "scroll"),
        sql`${lpHeatmapEventsTable.createdAt} > now() - interval '${sql.raw(String(days))} days'`,
        ...(device !== "all" ? [eq(lpHeatmapEventsTable.device, device)] : []),
      ))
      .groupBy(sql`floor(max(${lpHeatmapEventsTable.scrollDepthPct}) / 10) * 10`)
      .having(sql`max(${lpHeatmapEventsTable.scrollDepthPct}) is not null`);

    // Block-level click breakdown
    const blockClicks = type === "scroll" ? [] : await db
      .select({
        blockId: lpHeatmapEventsTable.blockId,
        elementTag: lpHeatmapEventsTable.elementTag,
        count: sql<number>`count(*)::int`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        eq(lpHeatmapEventsTable.pageId, pageId),
        eq(lpHeatmapEventsTable.eventType, "click"),
        sql`${lpHeatmapEventsTable.blockId} is not null`,
        sql`${lpHeatmapEventsTable.createdAt} > now() - interval '${sql.raw(String(days))} days'`,
        ...(device !== "all" ? [eq(lpHeatmapEventsTable.device, device)] : []),
      ))
      .groupBy(lpHeatmapEventsTable.blockId, lpHeatmapEventsTable.elementTag)
      .orderBy(sql`count(*) desc`)
      .limit(50);

    // Summary stats
    const [stats] = await db
      .select({
        totalClicks: sql<number>`count(*) filter (where ${lpHeatmapEventsTable.eventType} = 'click')::int`,
        totalScrollEvents: sql<number>`count(*) filter (where ${lpHeatmapEventsTable.eventType} = 'scroll')::int`,
        uniqueSessions: sql<number>`count(distinct ${lpHeatmapEventsTable.sessionId})::int`,
        avgScrollDepth: sql<number>`round(avg(case when ${lpHeatmapEventsTable.eventType} = 'scroll' then ${lpHeatmapEventsTable.scrollDepthPct} end)::numeric, 1)`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(
        eq(lpHeatmapEventsTable.pageId, pageId),
        sql`${lpHeatmapEventsTable.createdAt} > now() - interval '${sql.raw(String(days))} days'`,
        ...(device !== "all" ? [eq(lpHeatmapEventsTable.device, device)] : []),
      ));

    res.json({
      clickData,
      scrollData,
      blockClicks,
      stats: stats ?? { totalClicks: 0, totalScrollEvents: 0, uniqueSessions: 0, avgScrollDepth: 0 },
    });
  } catch (err) {
    console.error("Heatmap fetch error:", err);
    res.status(500).json({ error: "Failed to fetch heatmap data" });
  }
});

export default router;
