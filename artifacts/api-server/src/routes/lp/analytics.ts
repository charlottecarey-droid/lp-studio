import { Router } from "express";
import { db } from "@workspace/db";
import { lpSessionsTable, lpPageVisitsTable, lpPagesTable, lpLeadsTable, lpEventsTable, lpVariantsTable } from "@workspace/db";
import { sql, eq, and, inArray } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

/* ------------------------------------------------------------------ */
/*  Country normalization helpers                                      */
/* ------------------------------------------------------------------ */

const COUNTRY_CODE_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  RU: "Russia",
  ZA: "South Africa",
  NZ: "New Zealand",
  IE: "Ireland",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  PT: "Portugal",
  IL: "Israel",
  SG: "Singapore",
  AE: "United Arab Emirates",
  LT: "Lithuania",
};

function normalizeCountry(country: string, countryCode: string): string {
  if (countryCode && COUNTRY_CODE_NAMES[countryCode]) {
    return COUNTRY_CODE_NAMES[countryCode];
  }
  return country || "Unknown";
}

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/locations — city-level geo data                  */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/locations", async (_req, res): Promise<void> => {
  try {
    const [sessionCities, visitCities] = await Promise.all([
      db
        .select({
          city: lpSessionsTable.city,
          region: lpSessionsTable.region,
          country: lpSessionsTable.country,
          countryCode: lpSessionsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpSessionsTable)
        .where(sql`${lpSessionsTable.city} is not null`)
        .groupBy(
          lpSessionsTable.city,
          lpSessionsTable.region,
          lpSessionsTable.country,
          lpSessionsTable.countryCode,
        ),
      db
        .select({
          city: lpPageVisitsTable.city,
          region: lpPageVisitsTable.region,
          country: lpPageVisitsTable.country,
          countryCode: lpPageVisitsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpPageVisitsTable)
        .where(sql`${lpPageVisitsTable.city} is not null`)
        .groupBy(
          lpPageVisitsTable.city,
          lpPageVisitsTable.region,
          lpPageVisitsTable.country,
          lpPageVisitsTable.countryCode,
        ),
    ]);

    const merged = new Map<string, { city: string; region: string; country: string; countryCode: string; count: number }>();

    for (const row of [...sessionCities, ...visitCities]) {
      const cc = row.countryCode ?? "";
      const normalizedCountry = normalizeCountry(row.country ?? "", cc);
      const key = `${row.city ?? ""}|${row.region ?? ""}|${cc}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count += row.count;
      } else {
        merged.set(key, {
          city: row.city ?? "",
          region: row.region ?? "",
          country: normalizedCountry,
          countryCode: cc,
          count: row.count,
        });
      }
    }

    const results = [...merged.values()].sort((a, b) => b.count - a.count);
    res.json(results);
  } catch (_err) {
    res.json([]);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/countries — normalized country-level data        */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/countries", async (_req, res): Promise<void> => {
  try {
    const [sessionRows, visitRows] = await Promise.all([
      db
        .select({
          country: lpSessionsTable.country,
          countryCode: lpSessionsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpSessionsTable)
        .where(sql`${lpSessionsTable.country} is not null`)
        .groupBy(lpSessionsTable.country, lpSessionsTable.countryCode),
      db
        .select({
          country: lpPageVisitsTable.country,
          countryCode: lpPageVisitsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpPageVisitsTable)
        .where(sql`${lpPageVisitsTable.country} is not null`)
        .groupBy(lpPageVisitsTable.country, lpPageVisitsTable.countryCode),
    ]);

    // Merge by countryCode (not country name) to avoid "US" vs "United States" dupes
    const merged = new Map<string, { country: string; countryCode: string; count: number }>();
    for (const row of [...sessionRows, ...visitRows]) {
      const cc = row.countryCode ?? row.country ?? "";
      const normalizedCountry = normalizeCountry(row.country ?? "", cc);
      const existing = merged.get(cc);
      if (existing) {
        existing.count += row.count;
      } else {
        merged.set(cc, { country: normalizedCountry, countryCode: cc, count: row.count });
      }
    }

    const results = [...merged.values()].sort((a, b) => b.count - a.count);
    res.json(results);
  } catch (_err) {
    res.json([]);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/traffic — daily visit counts over time           */
/*  Query: ?days=30 (default 30)                                       */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/traffic", async (req, res): Promise<void> => {
  try {
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "30", 10) || 30));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    // Get daily visit counts from page visits
    const visitsByDay = await db
      .select({
        date: sql<string>`to_char(${lpPageVisitsTable.createdAt}::date, 'YYYY-MM-DD')`,
        visits: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
      })
      .from(lpPageVisitsTable)
      .where(sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`)
      .groupBy(sql`${lpPageVisitsTable.createdAt}::date`)
      .orderBy(sql`${lpPageVisitsTable.createdAt}::date`);

    // Get daily lead counts
    const tenantId = getTenantId(req, res);
    let leadsByDay: { date: string; leads: number }[] = [];
    if (tenantId !== null) {
      leadsByDay = await db
        .select({
          date: sql<string>`to_char(${lpLeadsTable.createdAt}::date, 'YYYY-MM-DD')`,
          leads: sql<number>`count(*)::int`,
        })
        .from(lpLeadsTable)
        .where(and(
          eq(lpLeadsTable.tenantId, tenantId),
          sql`${lpLeadsTable.createdAt} > ${dateFilter}`,
        ))
        .groupBy(sql`${lpLeadsTable.createdAt}::date`)
        .orderBy(sql`${lpLeadsTable.createdAt}::date`);
    }

    // Merge into a single timeline
    const leadsMap = new Map(leadsByDay.map(r => [r.date, r.leads]));

    // Fill in gaps to create complete timeline
    const result: { date: string; visits: number; uniqueVisitors: number; leads: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayData = visitsByDay.find(r => r.date === dateStr);
      result.push({
        date: dateStr,
        visits: dayData?.visits ?? 0,
        uniqueVisitors: dayData?.uniqueVisitors ?? 0,
        leads: leadsMap.get(dateStr) ?? 0,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Traffic analytics error:", err);
    res.json([]);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/pages — per-page metrics                         */
/*  Returns top pages by visit count with leads and CVR                */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/pages", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "30", 10) || 30));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    // All pages for this tenant
    const pages = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    if (pages.length === 0) {
      res.json([]);
      return;
    }

    const pageIds = pages.map(p => p.id);

    // Visit counts per page
    const visitRows = await db
      .select({
        pageId: lpPageVisitsTable.pageId,
        visits: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
      })
      .from(lpPageVisitsTable)
      .where(and(
        inArray(lpPageVisitsTable.pageId, pageIds),
        sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`,
      ))
      .groupBy(lpPageVisitsTable.pageId);

    const visitsByPage = new Map(visitRows.map(r => [r.pageId, { visits: r.visits, unique: r.uniqueVisitors }]));

    // Leads per page
    const leadRows = await db
      .select({
        pageId: lpLeadsTable.pageId,
        leads: sql<number>`count(*)::int`,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        inArray(lpLeadsTable.pageId, pageIds),
        sql`${lpLeadsTable.createdAt} > ${dateFilter}`,
      ))
      .groupBy(lpLeadsTable.pageId);

    const leadsByPage = new Map(leadRows.map(r => [r.pageId, r.leads]));

    // Impressions + conversions per page (via variants → events)
    const variants = await db
      .select({ id: lpVariantsTable.id, pageId: lpVariantsTable.builderPageId })
      .from(lpVariantsTable)
      .where(inArray(lpVariantsTable.builderPageId, pageIds));

    const cvrByPage: Record<number, { impressions: number; conversions: number }> = {};
    for (const pid of pageIds) cvrByPage[pid] = { impressions: 0, conversions: 0 };

    if (variants.length > 0) {
      const variantToPage = new Map<number, number>();
      for (const v of variants) {
        if (v.pageId != null) variantToPage.set(v.id, v.pageId);
      }

      const eventRows = await db
        .select({
          variantId: lpEventsTable.variantId,
          eventType: lpEventsTable.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(lpEventsTable)
        .where(and(
          inArray(lpEventsTable.variantId, variants.map(v => v.id)),
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

    const result = pages.map(p => {
      const v = visitsByPage.get(p.id) ?? { visits: 0, unique: 0 };
      const leads = leadsByPage.get(p.id) ?? 0;
      const { impressions, conversions } = cvrByPage[p.id] ?? { impressions: 0, conversions: 0 };
      const totalVisits = v.visits + impressions;
      const cvr = totalVisits > 0 ? (leads / totalVisits) * 100 : 0;

      return {
        pageId: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        visits: totalVisits,
        uniqueVisitors: v.unique,
        leads,
        impressions,
        conversions,
        cvr: Math.round(cvr * 100) / 100,
      };
    });

    // Sort by visits desc
    result.sort((a, b) => b.visits - a.visits);
    res.json(result);
  } catch (err) {
    console.error("Page analytics error:", err);
    res.json([]);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/overview — summary stats for the dashboard       */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/overview", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "30", 10) || 30));
    const dateFilter = sql`now() - make_interval(days => ${days})`;
    const prevDateFilter = sql`now() - make_interval(days => ${days * 2})`;

    // Current period visits
    const [currentVisits] = await db
      .select({
        total: sql<number>`count(*)::int`,
        unique: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
      })
      .from(lpPageVisitsTable)
      .where(sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`);

    // Previous period visits (for trend)
    const [prevVisits] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(lpPageVisitsTable)
      .where(and(
        sql`${lpPageVisitsTable.createdAt} > ${prevDateFilter}`,
        sql`${lpPageVisitsTable.createdAt} <= ${dateFilter}`,
      ));

    // Current period leads
    const [currentLeads] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        sql`${lpLeadsTable.createdAt} > ${dateFilter}`,
      ));

    // Previous period leads
    const [prevLeads] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        sql`${lpLeadsTable.createdAt} > ${prevDateFilter}`,
        sql`${lpLeadsTable.createdAt} <= ${dateFilter}`,
      ));

    // Total published pages
    const [pageCount] = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${lpPagesTable.status} = 'published')::int`,
      })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    const totalV = currentVisits?.total ?? 0;
    const prevV = prevVisits?.total ?? 0;
    const totalL = currentLeads?.total ?? 0;
    const prevL = prevLeads?.total ?? 0;
    const cvr = totalV > 0 ? (totalL / totalV) * 100 : 0;
    const prevCvr = prevV > 0 ? (prevL / prevV) * 100 : 0;

    res.json({
      totalVisits: totalV,
      uniqueVisitors: currentVisits?.unique ?? 0,
      visitsTrend: prevV > 0 ? ((totalV - prevV) / prevV) * 100 : 0,
      totalLeads: totalL,
      leadsTrend: prevL > 0 ? ((totalL - prevL) / prevL) * 100 : 0,
      cvr: Math.round(cvr * 100) / 100,
      cvrTrend: Math.round((cvr - prevCvr) * 100) / 100,
      totalPages: pageCount?.total ?? 0,
      publishedPages: pageCount?.published ?? 0,
      period: `${days}d`,
    });
  } catch (err) {
    console.error("Overview analytics error:", err);
    res.json({
      totalVisits: 0,
      uniqueVisitors: 0,
      visitsTrend: 0,
      totalLeads: 0,
      leadsTrend: 0,
      cvr: 0,
      cvrTrend: 0,
      totalPages: 0,
      publishedPages: 0,
      period: "30d",
    });
  }
});

export default router;
