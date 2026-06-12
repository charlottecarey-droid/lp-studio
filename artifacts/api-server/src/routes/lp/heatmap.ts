import { Router } from "express";
import { db } from "@workspace/db";
import { lpHeatmapEventsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getTenantPlan } from "../../lib/planFeatures";
import { getPlanConfig } from "../../lib/planConfig";
import { capUpgradeBody } from "../../lib/planGate";
import {
  resolveTenantIdForPage,
  countTenantHeatmapSessionsThisMonth,
} from "../../lib/heatmapUsage";
import { rateLimit, envLimit } from "../../lib/rateLimit";

const router = Router();

// Launch hardening (June 2026) — /lp/heatmap is PUBLIC (LP_PUBLIC allowlist
// in routes/index.ts) and already batches up to 200 events per POST, so a
// real visitor session needs only a handful of requests per minute. Override
// via RATE_LIMIT_HEATMAP_PER_MIN.
const heatmapIngestLimiter = rateLimit({
  name: "lp-heatmap",
  windowMs: 60 * 1000,
  max: envLimit("RATE_LIMIT_HEATMAP_PER_MIN", 100),
});

/**
 * POST /lp/heatmap — batch ingest heatmap events from the client collector.
 * Expects { events: HeatmapEvent[] }.
 */
router.post("/lp/heatmap", heatmapIngestLimiter, async (req, res): Promise<void> => {
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

    // Plan-tier heatmap session-quota gate (`heatmapSessionsPerMonth`).
    // Public, visitor-facing collector — there is no authUser, so the owning
    // tenant is resolved per distinct page in the batch (lp_heatmap_events has
    // no tenant_id). Each page maps to a tenant; tenants over their monthly
    // distinct-session cap are "blocked" and ALL their events are dropped — we
    // resolve every page rather than just the first so a mixed-page batch can't
    // smuggle an over-cap tenant's events in under an under-cap tenant's page.
    // Best-effort: any error fails OPEN (records events) over 503-ing visitors.
    let allowedRows = rows;
    let denial: ReturnType<typeof capUpgradeBody> | null = null;
    try {
      const config = await getPlanConfig();
      const distinctPageIds = [...new Set(rows.map((r) => r.pageId).filter((id) => Number.isFinite(id)))];
      const pageTenant = new Map<number, number | null>();
      await Promise.all(
        distinctPageIds.map(async (pid) => {
          pageTenant.set(pid, await resolveTenantIdForPage(pid));
        }),
      );
      const distinctTenantIds = [...new Set([...pageTenant.values()].filter((t): t is number => t != null))];
      const blocked = new Set<number>();
      const denialByTenant = new Map<number, ReturnType<typeof capUpgradeBody>>();
      await Promise.all(
        distinctTenantIds.map(async (tid) => {
          const plan = await getTenantPlan(tid);
          const cap = config[plan].features.limits.heatmapSessionsPerMonth;
          if (cap === null) return;
          const current = await countTenantHeatmapSessionsThisMonth(tid);
          if (current >= cap) {
            blocked.add(tid);
            denialByTenant.set(tid, capUpgradeBody("heatmapSessionsPerMonth", current, cap, plan, config));
          }
        }),
      );
      if (blocked.size > 0) {
        // Keep events for unresolved pages (fail open) and under-cap tenants only.
        allowedRows = rows.filter((r) => {
          const tid = pageTenant.get(r.pageId);
          return tid == null || !blocked.has(tid);
        });
        // Only the normal collector case — a single resolved tenant, fully over
        // cap — surfaces the structured 402 (the browser collector ignores it).
        // Mixed/abuse batches just silently drop the blocked tenant's rows and
        // report success with the count actually persisted.
        const hasUnresolved = [...pageTenant.values()].some((t) => t == null);
        if (!hasUnresolved && distinctTenantIds.length === 1) {
          denial = denialByTenant.get(distinctTenantIds[0]) ?? null;
        }
      }
    } catch (err) {
      console.error("[lp/heatmap] session-quota check failed (failing open):", err);
      allowedRows = rows;
    }

    if (denial) {
      res.status(402).json(denial);
      return;
    }

    if (allowedRows.length > 0) {
      await db.insert(lpHeatmapEventsTable).values(allowedRows);
    }
    res.json({ success: true, count: allowedRows.length });
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
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "30", 10) || 30));

    const conditions = [
      eq(lpHeatmapEventsTable.pageId, pageId),
      sql`${lpHeatmapEventsTable.createdAt} > now() - make_interval(days => ${days})`,
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
        sql`${lpHeatmapEventsTable.createdAt} > now() - make_interval(days => ${days})`,
        ...(device !== "all" ? [eq(lpHeatmapEventsTable.device, device)] : []),
      ))
      .groupBy(
        sql`floor(${lpHeatmapEventsTable.xPct})::int`,
        sql`floor(${lpHeatmapEventsTable.yPct})::int`,
      );

    // Scroll depth distribution: histogram of max scroll depths per session
    // Must use a subquery — aggregate functions are not allowed inside GROUP BY
    const scrollQuery = device !== "all"
      ? sql`
          SELECT (floor(max_depth / 10) * 10)::int AS "depthBucket", count(*)::int AS sessions
          FROM (
            SELECT session_id, max(scroll_depth_pct) AS max_depth
            FROM lp_heatmap_events
            WHERE page_id = ${pageId}
              AND event_type = 'scroll'
              AND created_at > now() - make_interval(days => ${days})
              AND device = ${device}
            GROUP BY session_id
            HAVING max(scroll_depth_pct) IS NOT NULL
          ) sub
          GROUP BY floor(max_depth / 10) * 10
          ORDER BY 1`
      : sql`
          SELECT (floor(max_depth / 10) * 10)::int AS "depthBucket", count(*)::int AS sessions
          FROM (
            SELECT session_id, max(scroll_depth_pct) AS max_depth
            FROM lp_heatmap_events
            WHERE page_id = ${pageId}
              AND event_type = 'scroll'
              AND created_at > now() - make_interval(days => ${days})
            GROUP BY session_id
            HAVING max(scroll_depth_pct) IS NOT NULL
          ) sub
          GROUP BY floor(max_depth / 10) * 10
          ORDER BY 1`;
    const scrollData: { depthBucket: number; sessions: number }[] = type === "click" ? [] : await db.execute(scrollQuery).then(r => r.rows as { depthBucket: number; sessions: number }[]);

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
        sql`${lpHeatmapEventsTable.createdAt} > now() - make_interval(days => ${days})`,
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
        sql`${lpHeatmapEventsTable.createdAt} > now() - make_interval(days => ${days})`,
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
