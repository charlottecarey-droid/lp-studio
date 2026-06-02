import { Router } from "express";
import { db } from "@workspace/db";
import { lpSessionsTable, lpPageVisitsTable, lpPagesTable, lpLeadsTable, lpEventsTable, lpVariantsTable, lpTestsTable, lpFormsTable } from "@workspace/db";
import { sql, eq, and, inArray } from "drizzle-orm";
import { isTestLead } from "@workspace/lead-utils";
import { getTenantId } from "../../middleware/requireAuth";

// Suspected test/junk leads are excluded from lead counts by default so the
// Analytics numbers reconcile with the Submissions tab (which hides them too).
// "?includeTest=1" (or "true") counts them, mirroring the leads list pattern.
function wantsTestLeads(req: { query: Record<string, unknown> }): boolean {
  return req.query.includeTest === "1" || req.query.includeTest === "true";
}

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

router.get("/lp/analytics/locations", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
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
        .innerJoin(lpTestsTable, eq(lpTestsTable.id, lpSessionsTable.testId))
        .where(and(
          eq(lpTestsTable.tenantId, tenantId),
          sql`${lpSessionsTable.city} is not null`,
        ))
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
        .innerJoin(lpPagesTable, eq(lpPagesTable.id, lpPageVisitsTable.pageId))
        .where(and(
          eq(lpPagesTable.tenantId, tenantId),
          sql`${lpPageVisitsTable.city} is not null`,
        ))
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

router.get("/lp/analytics/countries", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const [sessionRows, visitRows] = await Promise.all([
      db
        .select({
          country: lpSessionsTable.country,
          countryCode: lpSessionsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpSessionsTable)
        .innerJoin(lpTestsTable, eq(lpTestsTable.id, lpSessionsTable.testId))
        .where(and(
          eq(lpTestsTable.tenantId, tenantId),
          sql`${lpSessionsTable.country} is not null`,
        ))
        .groupBy(lpSessionsTable.country, lpSessionsTable.countryCode),
      db
        .select({
          country: lpPageVisitsTable.country,
          countryCode: lpPageVisitsTable.countryCode,
          count: sql<number>`count(*)::int`,
        })
        .from(lpPageVisitsTable)
        .innerJoin(lpPagesTable, eq(lpPagesTable.id, lpPageVisitsTable.pageId))
        .where(and(
          eq(lpPagesTable.tenantId, tenantId),
          sql`${lpPageVisitsTable.country} is not null`,
        ))
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
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "30", 10) || 30));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    // Get daily visit counts from page visits — scoped to the caller's tenant
    const visitsByDay = await db
      .select({
        date: sql<string>`to_char(${lpPageVisitsTable.createdAt}::date, 'YYYY-MM-DD')`,
        visits: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
      })
      .from(lpPageVisitsTable)
      .innerJoin(lpPagesTable, eq(lpPagesTable.id, lpPageVisitsTable.pageId))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`,
      ))
      .groupBy(sql`${lpPageVisitsTable.createdAt}::date`)
      .orderBy(sql`${lpPageVisitsTable.createdAt}::date`);

    // Get daily lead counts. The test-lead heuristic is a JS rule (not
    // expressible in SQL), so fetch the in-window rows and bucket by UTC day
    // in memory, excluding suspected test/junk leads by default.
    const includeTest = wantsTestLeads(req);
    const leadRows = await db
      .select({
        fields: lpLeadsTable.fields,
        createdAt: lpLeadsTable.createdAt,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        sql`${lpLeadsTable.createdAt} > ${dateFilter}`,
      ));

    // Merge into a single timeline
    const leadsMap = new Map<string, number>();
    for (const r of leadRows) {
      if (!includeTest && isTestLead(r.fields as Record<string, unknown>)) continue;
      const dateStr = r.createdAt.toISOString().split("T")[0];
      leadsMap.set(dateStr, (leadsMap.get(dateStr) ?? 0) + 1);
    }

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

    // Leads per page. The test-lead heuristic is a JS rule (not expressible
    // in SQL), so fetch the in-window rows and count per page in memory,
    // excluding suspected test/junk leads by default.
    const includeTest = wantsTestLeads(req);
    const leadFieldRows = await db
      .select({
        pageId: lpLeadsTable.pageId,
        fields: lpLeadsTable.fields,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        inArray(lpLeadsTable.pageId, pageIds),
        sql`${lpLeadsTable.createdAt} > ${dateFilter}`,
      ));

    const leadsByPage = new Map<number, number>();
    for (const r of leadFieldRows) {
      if (!includeTest && isTestLead(r.fields as Record<string, unknown>)) continue;
      leadsByPage.set(r.pageId, (leadsByPage.get(r.pageId) ?? 0) + 1);
    }

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
        if (row.variantId == null) continue;
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

    // Current period visits — scoped to the caller's tenant
    const [currentVisits] = await db
      .select({
        total: sql<number>`count(*)::int`,
        unique: sql<number>`count(distinct ${lpPageVisitsTable.sessionId})::int`,
      })
      .from(lpPageVisitsTable)
      .innerJoin(lpPagesTable, eq(lpPagesTable.id, lpPageVisitsTable.pageId))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`,
      ));

    // Previous period visits (for trend) — scoped to the caller's tenant
    const [prevVisits] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(lpPageVisitsTable)
      .innerJoin(lpPagesTable, eq(lpPagesTable.id, lpPageVisitsTable.pageId))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        sql`${lpPageVisitsTable.createdAt} > ${prevDateFilter}`,
        sql`${lpPageVisitsTable.createdAt} <= ${dateFilter}`,
      ));

    // Leads for both the current AND previous window in one read. The
    // test-lead heuristic is a JS rule (not expressible in SQL), so we fetch
    // the rows spanning both periods (createdAt > prevDateFilter) and bucket
    // them in memory, excluding suspected test/junk leads by default so these
    // totals reconcile with the Submissions tab.
    const includeTest = wantsTestLeads(req);
    const leadWindowRows = await db
      .select({
        fields: lpLeadsTable.fields,
        // Bucket each lead against the SAME DB `now()` boundary used by the
        // visits queries, so the current/previous split can't drift from the
        // SQL window because of app-clock vs DB-clock skew.
        isCurrent: sql<boolean>`(${lpLeadsTable.createdAt} > ${dateFilter})`,
      })
      .from(lpLeadsTable)
      .where(and(
        eq(lpLeadsTable.tenantId, tenantId),
        sql`${lpLeadsTable.createdAt} > ${prevDateFilter}`,
      ));

    let currentLeadCount = 0;
    let prevLeadCount = 0;
    for (const r of leadWindowRows) {
      if (!includeTest && isTestLead(r.fields as Record<string, unknown>)) continue;
      if (r.isCurrent) currentLeadCount++;
      else prevLeadCount++;
    }
    const currentLeads = { total: currentLeadCount };
    const prevLeads = { total: prevLeadCount };

    // Total published pages
    const [pageCount] = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${lpPagesTable.status} = 'published')::int`,
      })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    // Marketo ghost-submit telemetry. Hidden Forms2 submits emit
    // `ghost_submit_attempted` events when fired and `ghost_submit_failed`
    // events when the loader/script errors out. We expose both so the
    // funnel report can surface the failure count over time, and the
    // attempt count gives us a denominator to compute the failure rate
    // without us having to alert on raw counts (which scale with traffic).
    //
    // Tenant scoping: lp_events has no direct tenant column, so we join
    // through the optional `session_id` → lp_sessions → lp_tests scope OR
    // through (test_id → lp_tests). Since these telemetry events come from
    // the standard FormBlock (not necessarily inside an A/B test), they
    // typically have NULL test_id/variant_id. To scope by tenant cheaply
    // we restrict to event rows whose `session_id` ALSO appears in this
    // tenant's lp_page_visits within the same window — every ghost submit
    // is preceded by a page visit on the same session.
    const [ghostAttempts] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(lpEventsTable)
      .where(and(
        eq(lpEventsTable.eventType, "conversion"),
        eq(lpEventsTable.conversionType, "ghost_submit_attempted"),
        sql`${lpEventsTable.createdAt} > ${dateFilter}`,
        sql`${lpEventsTable.sessionId} in (
          select distinct ${lpPageVisitsTable.sessionId}
          from ${lpPageVisitsTable}
          inner join ${lpPagesTable} on ${lpPagesTable.id} = ${lpPageVisitsTable.pageId}
          where ${lpPagesTable.tenantId} = ${tenantId}
            and ${lpPageVisitsTable.createdAt} > ${dateFilter}
        )`,
      ));

    const [ghostFailures] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(lpEventsTable)
      .where(and(
        eq(lpEventsTable.eventType, "conversion"),
        eq(lpEventsTable.conversionType, "ghost_submit_failed"),
        sql`${lpEventsTable.createdAt} > ${dateFilter}`,
        sql`${lpEventsTable.sessionId} in (
          select distinct ${lpPageVisitsTable.sessionId}
          from ${lpPageVisitsTable}
          inner join ${lpPagesTable} on ${lpPagesTable.id} = ${lpPageVisitsTable.pageId}
          where ${lpPagesTable.tenantId} = ${tenantId}
            and ${lpPageVisitsTable.createdAt} > ${dateFilter}
        )`,
      ));

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
      // Marketo ghost-submit health. `ghostSubmitAttempts` is the number
      // of hidden Forms2 submits we *fired*; `ghostSubmitFailures` is the
      // number that never got off the ground (loader/script error, CSP
      // block, network failure). A non-zero failure count means leads are
      // being silently dropped from Marketo — this is the signal task #279
      // wants surfaced before marketing notices missing leads.
      ghostSubmitAttempts: ghostAttempts?.total ?? 0,
      ghostSubmitFailures: ghostFailures?.total ?? 0,
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
      ghostSubmitAttempts: 0,
      ghostSubmitFailures: 0,
      period: "30d",
    });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /lp/analytics/ghost-submits — drill-down for the ghost panel   */
/*                                                                     */
/*  Returns the top failing (page, form) pairs over the active period  */
/*  so admins can pinpoint which page or form is silently dropping     */
/*  Marketo leads — without this, a CSP / Marketo config regression    */
/*  could only be caught by manually bisecting across published pages. */
/* ------------------------------------------------------------------ */

router.get("/lp/analytics/ghost-submits", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || "30", 10) || 30));
    const dateFilter = sql`now() - make_interval(days => ${days})`;

    // Tenant scope: lp_events has no direct tenant column. Page-attributed
    // ghost rows can be filtered to this tenant's lp_pages cheaply via the
    // new page_id column. Rows without a page_id (legacy pre-migration
    // events) are intentionally excluded — they can't be attributed to a
    // specific page anyway, so they belong only in the tenant-wide totals
    // already returned by /lp/analytics/overview.
    const tenantPages = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    if (tenantPages.length === 0) {
      res.json([]);
      return;
    }

    const pageIds = tenantPages.map(p => p.id);
    const pageById = new Map(tenantPages.map(p => [p.id, p]));

    const rows = await db
      .select({
        pageId: lpEventsTable.pageId,
        formId: lpEventsTable.formId,
        conversionType: lpEventsTable.conversionType,
        count: sql<number>`count(*)::int`,
      })
      .from(lpEventsTable)
      .where(and(
        eq(lpEventsTable.eventType, "conversion"),
        inArray(lpEventsTable.conversionType, ["ghost_submit_attempted", "ghost_submit_failed"]),
        sql`${lpEventsTable.createdAt} > ${dateFilter}`,
        inArray(lpEventsTable.pageId, pageIds),
      ))
      .groupBy(lpEventsTable.pageId, lpEventsTable.formId, lpEventsTable.conversionType);

    // Resolve form names. Restrict the lookup to forms owned by this
    // tenant so a ghost-submit row carrying a stale formId from another
    // tenant (shouldn't happen, but defence-in-depth) never leaks a name.
    const formIds = Array.from(new Set(rows.map(r => r.formId).filter((id): id is number => id != null)));
    const formNameById = new Map<number, string>();
    if (formIds.length > 0) {
      const forms = await db
        .select({ id: lpFormsTable.id, name: lpFormsTable.name })
        .from(lpFormsTable)
        .where(and(eq(lpFormsTable.tenantId, tenantId), inArray(lpFormsTable.id, formIds)));
      for (const f of forms) formNameById.set(f.id, f.name);
    }

    type Bucket = {
      pageId: number;
      pageTitle: string;
      pageSlug: string;
      formId: number | null;
      formName: string | null;
      attempts: number;
      failures: number;
    };
    const merged = new Map<string, Bucket>();
    for (const row of rows) {
      if (row.pageId == null) continue;
      const page = pageById.get(row.pageId);
      if (!page) continue;
      const key = `${row.pageId}|${row.formId ?? ""}`;
      let bucket = merged.get(key);
      if (!bucket) {
        bucket = {
          pageId: row.pageId,
          pageTitle: page.title,
          pageSlug: page.slug,
          formId: row.formId,
          formName: row.formId != null ? formNameById.get(row.formId) ?? null : null,
          attempts: 0,
          failures: 0,
        };
        merged.set(key, bucket);
      }
      if (row.conversionType === "ghost_submit_attempted") bucket.attempts += row.count;
      if (row.conversionType === "ghost_submit_failed") bucket.failures += row.count;
    }

    // Surface the worst offenders first: rows with ANY failure ranked by
    // raw failure count (not rate — a 100% failure rate on a single
    // attempt is less urgent than 50% of a high-traffic form).
    const result = [...merged.values()]
      .filter(b => b.attempts > 0 || b.failures > 0)
      .sort((a, b) => {
        if (b.failures !== a.failures) return b.failures - a.failures;
        return b.attempts - a.attempts;
      });

    res.json(result);
  } catch (err) {
    console.error("Ghost-submit drill-down error:", err);
    res.json([]);
  }
});

export default router;
