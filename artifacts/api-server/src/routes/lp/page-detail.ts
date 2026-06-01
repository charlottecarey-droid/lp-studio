import { Router, type Request, type Response } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

/** Clamp an integer into [min, max], falling back to `def` when not parseable. */
function clampInt(raw: unknown, def: number, min: number, max: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** Percent change cur-vs-prev, rounded to whole percent. null when prev == 0. */
function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/**
 * Resolve + ownership-check a :pageId param for the current tenant.
 * Returns the numeric pageId, or null after having already responded
 * (400 invalid id / 404 not-found-or-cross-tenant).
 */
async function resolvePageId(
  req: Request,
  res: Response,
  tenantId: number,
): Promise<number | null> {
  const pageId = parseInt(String(req.params.pageId), 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "Invalid pageId" });
    return null;
  }
  const pageRes = await db.execute(sql`
    SELECT id, title, slug, status, tenant_id
    FROM lp_pages WHERE id = ${pageId} LIMIT 1
  `);
  const page = pageRes.rows[0] as
    | { id: number; title: string; slug: string; status: string; tenant_id: number }
    | undefined;
  if (!page || page.tenant_id !== tenantId) {
    res.status(404).json({ error: "Page not found" });
    return null;
  }
  // stash for the summary endpoint
  (req as unknown as { _page?: typeof page })._page = page;
  return pageId;
}

// ─── 1. Summary strip ─────────────────────────────────────────────────────────
// GET /lp/analytics/pages/:pageId/summary?days=30
router.get("/lp/analytics/pages/:pageId/summary", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const pageId = await resolvePageId(req, res, tenantId);
  if (pageId === null) return;

  const page = (req as unknown as {
    _page: { id: number; title: string; slug: string; status: string };
  })._page;

  const days = clampInt(req.query.days, 30, 1, 365);
  const now = new Date();
  const curStart = new Date(now.getTime() - days * 86_400_000);
  const prevStart = new Date(now.getTime() - 2 * days * 86_400_000);

  try {
    const [
      anonVisits,
      persVisits,
      anonConv,
      persConv,
      known,
      scroll,
      clicks,
    ] = await Promise.all([
      // anonymous visits
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE created_at > ${curStart}) AS cur,
          count(*) FILTER (WHERE created_at > ${prevStart} AND created_at <= ${curStart}) AS prev
        FROM lp_page_visits WHERE page_id = ${pageId}
      `),
      // personalized visits
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE plv.visited_at > ${curStart}) AS cur,
          count(*) FILTER (WHERE plv.visited_at > ${prevStart} AND plv.visited_at <= ${curStart}) AS prev
        FROM lp_personalized_link_visits plv
        JOIN lp_personalized_links pl ON pl.id = plv.link_id
        WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId}
      `),
      // anonymous conversions (lp_events.page_id)
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE created_at > ${curStart}) AS cur,
          count(*) FILTER (WHERE created_at > ${prevStart} AND created_at <= ${curStart}) AS prev
        FROM lp_events WHERE page_id = ${pageId} AND event_type = 'conversion'
      `),
      // personalized conversions (cta_clicks > 0)
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE plv.visited_at > ${curStart} AND plv.cta_clicks > 0) AS cur,
          count(*) FILTER (WHERE plv.visited_at > ${prevStart} AND plv.visited_at <= ${curStart} AND plv.cta_clicks > 0) AS prev
        FROM lp_personalized_link_visits plv
        JOIN lp_personalized_links pl ON pl.id = plv.link_id
        WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId}
      `),
      // known visitors (distinct personalized contacts by email/contactName)
      db.execute(sql`
        SELECT
          count(DISTINCT COALESCE(NULLIF(pl.email, ''), pl.contact_name)) FILTER (WHERE plv.visited_at > ${curStart}) AS cur,
          count(DISTINCT COALESCE(NULLIF(pl.email, ''), pl.contact_name)) FILTER (WHERE plv.visited_at > ${prevStart} AND plv.visited_at <= ${curStart}) AS prev
        FROM lp_personalized_link_visits plv
        JOIN lp_personalized_links pl ON pl.id = plv.link_id
        WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId}
      `),
      // avg scroll depth across both streams
      db.execute(sql`
        SELECT
          avg(d) FILTER (WHERE ts > ${curStart}) AS cur,
          avg(d) FILTER (WHERE ts > ${prevStart} AND ts <= ${curStart}) AS prev
        FROM (
          SELECT scroll_depth_pct AS d, created_at AS ts
          FROM lp_heatmap_events
          WHERE page_id = ${pageId} AND scroll_depth_pct IS NOT NULL
          UNION ALL
          SELECT plv.scroll_depth_pct AS d, plv.visited_at AS ts
          FROM lp_personalized_link_visits plv
          JOIN lp_personalized_links pl ON pl.id = plv.link_id
          WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId} AND plv.scroll_depth_pct IS NOT NULL
        ) s
      `),
      // total heatmap clicks
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE created_at > ${curStart}) AS cur,
          count(*) FILTER (WHERE created_at > ${prevStart} AND created_at <= ${curStart}) AS prev
        FROM lp_heatmap_events WHERE page_id = ${pageId} AND event_type = 'click'
      `),
    ]);

    const num = (rows: Record<string, unknown>[], key: "cur" | "prev"): number =>
      Number(rows[0]?.[key] ?? 0) || 0;

    const visitsCur = num(anonVisits.rows, "cur") + num(persVisits.rows, "cur");
    const visitsPrev = num(anonVisits.rows, "prev") + num(persVisits.rows, "prev");

    const convCur = num(anonConv.rows, "cur") + num(persConv.rows, "cur");
    const convPrev = num(anonConv.rows, "prev") + num(persConv.rows, "prev");

    const rateCur = visitsCur > 0 ? (convCur / visitsCur) * 100 : 0;
    const ratePrev = visitsPrev > 0 ? (convPrev / visitsPrev) * 100 : 0;

    const knownCur = num(known.rows, "cur");
    const knownPrev = num(known.rows, "prev");

    const scrollCur = num(scroll.rows, "cur");
    const scrollPrev = num(scroll.rows, "prev");

    const clicksCur = num(clicks.rows, "cur");
    const clicksPrev = num(clicks.rows, "prev");

    res.json({
      page: { id: page.id, title: page.title, slug: page.slug, status: page.status },
      metrics: {
        visits: { value: visitsCur, deltaPct: pctDelta(visitsCur, visitsPrev) },
        conversions: { value: convCur, deltaPct: pctDelta(convCur, convPrev) },
        conversionRate: {
          value: Math.round(rateCur * 10) / 10,
          deltaPct: pctDelta(rateCur, ratePrev),
        },
        knownVisitors: { value: knownCur, deltaPct: pctDelta(knownCur, knownPrev) },
        avgScrollDepth: {
          value: Math.round(scrollCur * 10) / 10,
          deltaPct: pctDelta(scrollCur, scrollPrev),
        },
        totalClicks: { value: clicksCur, deltaPct: pctDelta(clicksCur, clicksPrev) },
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to load page summary");
    res.status(500).json({ error: "Failed to load summary" });
  }
});

// ─── 2. Traffic sources ───────────────────────────────────────────────────────
// GET /lp/analytics/pages/:pageId/traffic-sources?days=30
router.get("/lp/analytics/pages/:pageId/traffic-sources", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const pageId = await resolvePageId(req, res, tenantId);
  if (pageId === null) return;

  const days = clampInt(req.query.days, 30, 1, 365);
  const now = new Date();
  const curStart = new Date(now.getTime() - days * 86_400_000);

  try {
    const [anonRows, persRow] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(pv.utm_source, ''), 'Direct') AS source,
          count(*)::int AS visits,
          count(*) FILTER (WHERE c.session_id IS NOT NULL)::int AS conversions
        FROM lp_page_visits pv
        LEFT JOIN (
          SELECT DISTINCT session_id FROM lp_events
          WHERE page_id = ${pageId} AND event_type = 'conversion'
        ) c ON c.session_id = pv.session_id
        WHERE pv.page_id = ${pageId} AND pv.created_at > ${curStart}
        GROUP BY 1
      `),
      db.execute(sql`
        SELECT
          count(*)::int AS visits,
          count(*) FILTER (WHERE plv.cta_clicks > 0)::int AS conversions
        FROM lp_personalized_link_visits plv
        JOIN lp_personalized_links pl ON pl.id = plv.link_id
        WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId} AND plv.visited_at > ${curStart}
      `),
    ]);

    const sources = (anonRows.rows as { source: string; visits: number; conversions: number }[]).map((r) => {
      const visits = Number(r.visits) || 0;
      const conversions = Number(r.conversions) || 0;
      return {
        source: r.source,
        visits,
        conversions,
        cvr: visits > 0 ? Math.round((conversions / visits) * 1000) / 10 : 0,
      };
    });

    const pers = persRow.rows[0] as { visits: number; conversions: number } | undefined;
    const persVisits = Number(pers?.visits ?? 0) || 0;
    if (persVisits > 0) {
      const persConv = Number(pers?.conversions ?? 0) || 0;
      sources.push({
        source: "Personalized link",
        visits: persVisits,
        conversions: persConv,
        cvr: Math.round((persConv / persVisits) * 1000) / 10,
      });
    }

    sources.sort((a, b) => b.visits - a.visits);

    res.json({ sources });
  } catch (err) {
    logger.error({ err }, "Failed to load traffic sources");
    res.status(500).json({ error: "Failed to load traffic sources" });
  }
});

// ─── 3. Visits table (paginated UNION of both streams) ─────────────────────────
// GET /lp/analytics/pages/:pageId/visits?days=30&page=1&limit=50&contactSearch=&convertedOnly=&knownOnly=
router.get("/lp/analytics/pages/:pageId/visits", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const pageId = await resolvePageId(req, res, tenantId);
  if (pageId === null) return;

  const days = clampInt(req.query.days, 30, 1, 365);
  const limit = clampInt(req.query.limit, 50, 1, 100);
  const pageNum = Math.max(1, clampInt(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER));
  const offset = (pageNum - 1) * limit;

  const knownOnly = String(req.query.knownOnly ?? "") === "true";
  const convertedOnly = String(req.query.convertedOnly ?? "") === "true";
  const contactSearch = String(req.query.contactSearch ?? "").trim();

  const now = new Date();
  const curStart = new Date(now.getTime() - days * 86_400_000);

  try {
    const combinedCte = sql`
      WITH combined AS (
        SELECT
          'pv-' || pv.id AS id,
          'anonymous' AS source,
          pv.created_at AS visited_at,
          NULL::text AS contact_name,
          NULL::text AS company,
          NULL::text AS email,
          pv.city, pv.region, pv.country, pv.country_code,
          pv.utm_source, pv.utm_medium, pv.utm_campaign,
          pv.session_id,
          NULL::real AS scroll_depth_pct,
          0 AS clicks,
          EXISTS (
            SELECT 1 FROM lp_events e
            WHERE e.session_id = pv.session_id AND e.page_id = ${pageId} AND e.event_type = 'conversion'
          ) AS converted
        FROM lp_page_visits pv
        WHERE pv.page_id = ${pageId} AND pv.created_at > ${curStart}
        UNION ALL
        SELECT
          'pl-' || plv.id AS id,
          'personalized' AS source,
          plv.visited_at AS visited_at,
          pl.contact_name, pl.company, pl.email,
          plv.city, plv.region, plv.country, NULL::text AS country_code,
          NULL::text AS utm_source, NULL::text AS utm_medium, NULL::text AS utm_campaign,
          NULL::text AS session_id,
          plv.scroll_depth_pct,
          plv.cta_clicks AS clicks,
          (plv.cta_clicks > 0) AS converted
        FROM lp_personalized_link_visits plv
        JOIN lp_personalized_links pl ON pl.id = plv.link_id
        WHERE pl.page_id = ${pageId} AND pl.tenant_id = ${tenantId} AND plv.visited_at > ${curStart}
      )
    `;

    const conds = [sql`1 = 1`];
    if (knownOnly) conds.push(sql`source = 'personalized'`);
    if (convertedOnly) conds.push(sql`converted = true`);
    if (contactSearch) {
      const like = `%${contactSearch}%`;
      conds.push(sql`(contact_name ILIKE ${like} OR company ILIKE ${like} OR email ILIKE ${like})`);
    }
    const whereClause = sql.join(conds, sql` AND `);

    const [dataRes, countRes] = await Promise.all([
      db.execute(sql`
        ${combinedCte}
        SELECT * FROM combined
        WHERE ${whereClause}
        ORDER BY visited_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        ${combinedCte}
        SELECT count(*)::int AS total FROM combined
        WHERE ${whereClause}
      `),
    ]);

    interface CombinedRow {
      id: string;
      source: "anonymous" | "personalized";
      visited_at: Date | string;
      contact_name: string | null;
      company: string | null;
      email: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      country_code: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      session_id: string | null;
      scroll_depth_pct: number | null;
      clicks: number | null;
      converted: boolean;
    }

    const rows = dataRes.rows as unknown as CombinedRow[];

    // Enrich anonymous rows' engagement from lp_heatmap_events in one query.
    const sessionIds = Array.from(
      new Set(
        rows
          .filter((r) => r.source === "anonymous" && r.session_id)
          .map((r) => r.session_id as string),
      ),
    );

    const engagementBySession = new Map<
      string,
      { maxScroll: number | null; clicks: number; device: string | null }
    >();

    if (sessionIds.length > 0) {
      const heat = await db.execute(sql`
        SELECT
          session_id,
          max(scroll_depth_pct) AS max_scroll,
          count(*) FILTER (WHERE event_type = 'click')::int AS clicks,
          mode() WITHIN GROUP (ORDER BY device) AS device
        FROM lp_heatmap_events
        WHERE page_id = ${pageId} AND session_id = ANY(${sessionIds})
        GROUP BY session_id
      `);
      for (const r of heat.rows as {
        session_id: string;
        max_scroll: number | null;
        clicks: number | null;
        device: string | null;
      }[]) {
        engagementBySession.set(r.session_id, {
          maxScroll: r.max_scroll != null ? Number(r.max_scroll) : null,
          clicks: Number(r.clicks ?? 0) || 0,
          device: r.device ?? null,
        });
      }
    }

    const visits = rows.map((r) => {
      const isAnon = r.source === "anonymous";
      const eng = isAnon && r.session_id ? engagementBySession.get(r.session_id) : undefined;
      const scrollDepthPct = isAnon
        ? eng?.maxScroll ?? null
        : r.scroll_depth_pct != null
          ? Number(r.scroll_depth_pct)
          : null;
      const clicks = isAnon ? eng?.clicks ?? 0 : Number(r.clicks ?? 0) || 0;
      const device = isAnon ? eng?.device ?? null : null;
      return {
        id: r.id,
        source: r.source,
        visitedAt: r.visited_at,
        contactName: r.contact_name,
        company: r.company,
        email: r.email,
        city: r.city,
        region: r.region,
        country: r.country,
        countryCode: r.country_code,
        utmSource: r.utm_source,
        utmMedium: r.utm_medium,
        utmCampaign: r.utm_campaign,
        device,
        scrollDepthPct,
        clicks,
        converted: Boolean(r.converted),
      };
    });

    const total = Number((countRes.rows[0] as { total: number } | undefined)?.total ?? 0) || 0;

    res.json({
      visits,
      total,
      page: pageNum,
      limit,
      hasMore: offset + visits.length < total,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load page visits");
    res.status(500).json({ error: "Failed to load visits" });
  }
});

export default router;
