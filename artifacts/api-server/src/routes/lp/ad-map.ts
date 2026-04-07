import { Router } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { db } from "@workspace/db";
import { lpPageVisitsTable, lpPagesTable, lpLeadsTable } from "@workspace/db";
import { eq, sql, isNotNull } from "drizzle-orm";

const router = Router();

/**
 * Normalise a utm_source string into a platform bucket.
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

// GET /lp/ad-map — UTM-based campaign-to-page mappings driven by lead attribution
router.get("/lp/ad-map", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    // 1. All tenant pages
    const pages = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    const pageMap = new Map(pages.map(p => [p.id, p]));

    // 2. Aggregate leads by (pageId, utmSource, utmMedium, utmCampaign)
    //    Only rows that have a utm_source so we know which campaign they came from.
    const leadRows = await db
      .select({
        pageId:      lpLeadsTable.pageId,
        utmSource:   lpLeadsTable.utmSource,
        utmMedium:   lpLeadsTable.utmMedium,
        utmCampaign: lpLeadsTable.utmCampaign,
        leads:       sql<number>`count(*)`.as("leads"),
      })
      .from(lpLeadsTable)
      .where(
        sql`${lpLeadsTable.tenantId} = ${tenantId} AND ${lpLeadsTable.utmSource} IS NOT NULL AND ${lpLeadsTable.utmSource} <> ''`
      )
      .groupBy(
        lpLeadsTable.pageId,
        lpLeadsTable.utmSource,
        lpLeadsTable.utmMedium,
        lpLeadsTable.utmCampaign,
      );

    // 3. Total page visits per page (all visits, UTM or not) — used as CVR denominator
    const visitCounts = await db
      .select({
        pageId: lpPageVisitsTable.pageId,
        visits: sql<number>`count(*)`.as("visits"),
      })
      .from(lpPageVisitsTable)
      .innerJoin(lpPagesTable, eq(lpPageVisitsTable.pageId, lpPagesTable.id))
      .where(eq(lpPagesTable.tenantId, tenantId))
      .groupBy(lpPageVisitsTable.pageId);

    const visitsByPage = new Map(visitCounts.map(r => [r.pageId, Number(r.visits)]));

    // 4. Build mappings
    const pagesWithAds = new Set<number>();
    const campaignKeys = new Set<string>();

    const mappings = leadRows.map((row, idx) => {
      const page = pageMap.get(row.pageId);
      if (!page) return null;

      pagesWithAds.add(row.pageId);
      const campaignKey = `${row.utmSource}|${row.utmCampaign || "(none)"}`;
      campaignKeys.add(campaignKey);

      const leads  = Number(row.leads);
      const visits = visitsByPage.get(row.pageId) ?? 0;
      const cvr    = visits > 0 ? ((leads / visits) * 100) : 0;

      return {
        id: `map-${idx}`,
        platform:        detectPlatform(row.utmSource, row.utmMedium),
        utmSource:       row.utmSource,
        utmMedium:       row.utmMedium || null,
        campaignName:    row.utmCampaign || "(direct / no campaign)",
        landingPageId:   page.id,
        landingPageName: page.title,
        landingPageSlug: page.slug,
        visits,
        leads,
        cvr: Math.round(cvr * 10) / 10,
      };
    }).filter(Boolean);

    // 5. Stats
    const pagesWithoutAds = pages.filter(p => !pagesWithAds.has(p.id)).length;
    const avgCvr = mappings.length > 0
      ? Math.round(mappings.reduce((s, m) => s + (m?.cvr ?? 0), 0) / mappings.length * 10) / 10
      : 0;
    const totalVisits = mappings.reduce((s, m) => s + (m?.visits ?? 0), 0);

    res.json({
      mappings,
      stats: {
        total:           mappings.length,
        avgCvr,
        totalVisits,
        pagesWithoutAds,
        adsWithoutPages: 0,
        uniqueCampaigns: campaignKeys.size,
      },
    });
  } catch (err) {
    console.error("AdMap error:", err);
    res.status(500).json({ error: "Failed to load ad mappings" });
  }
});

export default router;
