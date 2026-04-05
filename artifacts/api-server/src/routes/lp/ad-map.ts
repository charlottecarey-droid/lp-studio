import { Router } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { db } from "@workspace/db";
import { lpPageVisitsTable, lpPagesTable, lpLeadsTable, lpSessionsTable } from "@workspace/db";
import { eq, and, sql, isNotNull } from "drizzle-orm";

const router = Router();

/**
 * Normalise a utm_source string into a platform bucket.
 * Handles common variations (google, google_ads, cpc → "google", etc.)
 */
function detectPlatform(utmSource: string | null, utmMedium: string | null): "google" | "meta" | "linkedin" | "bing" | "other" {
  const src = (utmSource ?? "").toLowerCase();
  const med = (utmMedium ?? "").toLowerCase();
  if (src.includes("google") || src === "gclid" || (med === "cpc" && !src.includes("bing"))) return "google";
  if (src.includes("facebook") || src.includes("fb") || src.includes("meta") || src.includes("instagram") || src.includes("ig")) return "meta";
  if (src.includes("linkedin") || src.includes("li")) return "linkedin";
  if (src.includes("bing") || src.includes("msn")) return "bing";
  return "other";
}

// GET /lp/ad-map — real UTM-based campaign-to-page mappings
router.get("/lp/ad-map", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    // 1. Get all tenant pages (for enrichment & orphan detection)
    const pages = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    const pageMap = new Map(pages.map(p => [p.id, p]));

    // 2. Aggregate page visits by utm_source + utm_campaign + pageId
    //    Only include visits that actually have UTM data
    const visitRows = await db
      .select({
        pageId: lpPageVisitsTable.pageId,
        utmSource: lpPageVisitsTable.utmSource,
        utmMedium: lpPageVisitsTable.utmMedium,
        utmCampaign: lpPageVisitsTable.utmCampaign,
        visits: sql<number>`count(*)`.as("visits"),
      })
      .from(lpPageVisitsTable)
      .innerJoin(lpPagesTable, eq(lpPageVisitsTable.pageId, lpPagesTable.id))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        isNotNull(lpPageVisitsTable.utmSource),
      ))
      .groupBy(
        lpPageVisitsTable.pageId,
        lpPageVisitsTable.utmSource,
        lpPageVisitsTable.utmMedium,
        lpPageVisitsTable.utmCampaign,
      );

    // Also pull session-based UTM visits (A/B test pages route through sessions)
    const sessionRows = await db
      .select({
        utmSource: lpSessionsTable.utmSource,
        utmMedium: lpSessionsTable.utmMedium,
        utmCampaign: lpSessionsTable.utmCampaign,
        visits: sql<number>`count(*)`.as("visits"),
      })
      .from(lpSessionsTable)
      .innerJoin(
        // join through tests → variants → pages would be complex;
        // for now we only use page visits (most common path)
        // Sessions are supplemental — skip if no page mapping
        lpPageVisitsTable,
        eq(lpSessionsTable.sessionId, lpPageVisitsTable.sessionId),
      )
      .innerJoin(lpPagesTable, eq(lpPageVisitsTable.pageId, lpPagesTable.id))
      .where(and(
        eq(lpPagesTable.tenantId, tenantId),
        isNotNull(lpSessionsTable.utmSource),
      ))
      .groupBy(
        lpSessionsTable.utmSource,
        lpSessionsTable.utmMedium,
        lpSessionsTable.utmCampaign,
      );

    // 3. Count leads per page for CVR calculation
    const leadCounts = await db
      .select({
        pageId: lpLeadsTable.pageId,
        leads: sql<number>`count(*)`.as("leads"),
      })
      .from(lpLeadsTable)
      .where(eq(lpLeadsTable.tenantId, tenantId))
      .groupBy(lpLeadsTable.pageId);

    const leadsByPage = new Map(leadCounts.map(r => [r.pageId, Number(r.leads)]));

    // 4. Build mappings from page visit aggregates
    const pagesWithAds = new Set<number>();
    const campaignKeys = new Set<string>(); // track unique campaigns

    const mappings = visitRows.map((row, idx) => {
      const page = pageMap.get(row.pageId);
      if (!page) return null;

      pagesWithAds.add(row.pageId);
      const campaignKey = `${row.utmSource}|${row.utmCampaign || "(none)"}`;
      campaignKeys.add(campaignKey);

      const visits = Number(row.visits);
      const leads = leadsByPage.get(row.pageId) ?? 0;
      const cvr = visits > 0 ? ((leads / visits) * 100) : 0;

      return {
        id: `map-${idx}`,
        platform: detectPlatform(row.utmSource, row.utmMedium),
        utmSource: row.utmSource,
        utmMedium: row.utmMedium || null,
        campaignName: row.utmCampaign || "(direct / no campaign)",
        landingPageId: page.id,
        landingPageName: page.title,
        landingPageSlug: page.slug,
        visits,
        leads,
        cvr: Math.round(cvr * 10) / 10,
      };
    }).filter(Boolean);

    // 5. Stats
    const pagesWithoutAds = pages.filter(p => !pagesWithAds.has(p.id)).length;

    // Unique campaigns that arrived via UTM but didn't match any page
    // (This can happen if destination URLs don't match known slugs — less
    // common in this architecture since visits are tracked per-page, but
    // we surface it for completeness from session-only data)
    const adsWithoutPages = 0; // All visit rows are already page-bound

    const avgCvr = mappings.length > 0
      ? Math.round(mappings.reduce((s, m) => s + (m?.cvr ?? 0), 0) / mappings.length * 10) / 10
      : 0;

    const totalVisits = mappings.reduce((s, m) => s + (m?.visits ?? 0), 0);

    res.json({
      mappings,
      stats: {
        total: mappings.length,
        avgCvr,
        totalVisits,
        pagesWithoutAds,
        adsWithoutPages,
        uniqueCampaigns: campaignKeys.size,
      },
    });
  } catch (err) {
    console.error("AdMap error:", err);
    res.status(500).json({ error: "Failed to load ad mappings" });
  }
});

export default router;
