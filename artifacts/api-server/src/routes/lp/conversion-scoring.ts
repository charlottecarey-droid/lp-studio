// Conversion Scoring — real data from lpEvents, lpHeatmapEvents, lpPageVisits, lpLeads, lpPages
import { Router } from "express";
import { db } from "@workspace/db";
import {
  lpPagesTable,
  lpVariantsTable,
  lpEventsTable,
  lpHeatmapEventsTable,
  lpPageVisitsTable,
  lpLeadsTable,
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────

function letterGrade(score: number): string {
  if (score >= 93) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 73) return "B";
  if (score >= 68) return "B-";
  if (score >= 63) return "C+";
  if (score >= 55) return "C";
  if (score >= 48) return "C-";
  if (score >= 40) return "D+";
  if (score >= 33) return "D";
  return "F";
}

interface Block {
  type?: string;
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

// Analyze the blocks jsonb from a page to compute content-based scores
function analyzeBlocks(blocks: unknown[]): {
  hasHero: boolean;
  hasCtaButton: boolean;
  hasSocialProof: boolean;
  hasForm: boolean;
  formFieldCount: number;
  hasFaq: boolean;
  hasFooter: boolean;
  hasTrustSignals: boolean;
  blockCount: number;
  headlineCount: number;
  imageCount: number;
} {
  const result = {
    hasHero: false,
    hasCtaButton: false,
    hasSocialProof: false,
    hasForm: false,
    formFieldCount: 0,
    hasFaq: false,
    hasFooter: false,
    hasTrustSignals: false,
    blockCount: blocks.length,
    headlineCount: 0,
    imageCount: 0,
  };

  for (const raw of blocks) {
    const block = raw as Block;
    const type = (block.type || "").toLowerCase();
    const propsStr = JSON.stringify(block.props || {}).toLowerCase();

    if (type.includes("hero") || type.includes("header")) result.hasHero = true;
    if (type.includes("cta") || type.includes("button") || propsStr.includes("cta")) result.hasCtaButton = true;
    if (type.includes("testimonial") || type.includes("social") || type.includes("review") || type.includes("logo")) result.hasSocialProof = true;
    if (type.includes("form") || type.includes("lead") || type.includes("signup")) {
      result.hasForm = true;
      // Try to count form fields from props
      const steps = (block.props as Record<string, unknown>)?.steps;
      if (Array.isArray(steps)) {
        for (const step of steps) {
          const fields = (step as Record<string, unknown>)?.fields;
          if (Array.isArray(fields)) result.formFieldCount += fields.length;
        }
      }
    }
    if (type.includes("faq") || type.includes("accordion")) result.hasFaq = true;
    if (type.includes("footer")) result.hasFooter = true;
    if (type.includes("trust") || type.includes("badge") || type.includes("security") || type.includes("guarantee")) result.hasTrustSignals = true;
    if (type.includes("heading") || type.includes("headline") || type.includes("hero")) result.headlineCount++;
    if (type.includes("image") || type.includes("gallery") || type.includes("video")) result.imageCount++;
  }

  return result;
}

// ─── GET /lp/conversion-scoring/pages — list tenant pages for the selector ─────

router.get("/lp/conversion-scoring/pages", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const pages = await db
      .select({ id: lpPagesTable.id, title: lpPagesTable.title, slug: lpPagesTable.slug, status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId))
      .orderBy(lpPagesTable.title);

    res.json(pages);
  } catch (err) {
    console.error("GET /lp/conversion-scoring/pages error:", err);
    res.status(500).json({ error: "Failed to load pages" });
  }
});

// ─── GET /lp/conversion-scoring/:pageId — real scoring ──────────

router.get("/lp/conversion-scoring/:pageId", async (req, res): Promise<void> => {
  try {
    const tenantId = getTenantId(req, res);
    if (tenantId === null) return;

    const pageId = parseInt(String(req.params.pageId), 10);
    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    // 1. Get the page with blocks
    const [page] = await db
      .select()
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const days = 30;
    const dateFilter = sql`now() - make_interval(days => ${days})`;
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const analysis = analyzeBlocks(blocks);

    // 2. Behavioral metrics — same queries as performance.ts
    const variants = await db
      .select({ id: lpVariantsTable.id })
      .from(lpVariantsTable)
      .where(eq(lpVariantsTable.builderPageId, pageId));

    let impressions = 0;
    let conversions = 0;

    if (variants.length > 0) {
      const variantIds = variants.map(v => v.id);
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
    }

    const cvr = impressions > 0 ? (conversions / impressions) * 100 : 0;

    // Visits
    const [visitStats] = await db
      .select({ visits: sql<number>`count(*)::int` })
      .from(lpPageVisitsTable)
      .where(and(eq(lpPageVisitsTable.pageId, pageId), sql`${lpPageVisitsTable.createdAt} > ${dateFilter}`));
    const totalVisits = (visitStats?.visits ?? 0) + impressions;

    // Scroll depth
    const [scrollStats] = await db
      .select({ avgDepth: sql<number>`round(avg(max_depth)::numeric, 1)` })
      .from(
        db.select({ max_depth: sql<number>`max(${lpHeatmapEventsTable.scrollDepthPct})`.as("max_depth") })
          .from(lpHeatmapEventsTable)
          .where(and(eq(lpHeatmapEventsTable.pageId, pageId), eq(lpHeatmapEventsTable.eventType, "scroll"), sql`${lpHeatmapEventsTable.createdAt} > ${dateFilter}`))
          .groupBy(lpHeatmapEventsTable.sessionId)
          .as("scroll_sessions")
      );
    const avgScrollDepth = scrollStats?.avgDepth ?? 0;

    // Clicks
    const [clickStats] = await db
      .select({
        totalClicks: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${lpHeatmapEventsTable.sessionId})::int`,
      })
      .from(lpHeatmapEventsTable)
      .where(and(eq(lpHeatmapEventsTable.pageId, pageId), eq(lpHeatmapEventsTable.eventType, "click"), sql`${lpHeatmapEventsTable.createdAt} > ${dateFilter}`));
    const clicksPerSession = (clickStats?.uniqueSessions ?? 0) > 0 ? (clickStats?.totalClicks ?? 0) / clickStats!.uniqueSessions : 0;

    // Leads
    const [leadStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lpLeadsTable)
      .where(and(eq(lpLeadsTable.pageId, pageId), sql`${lpLeadsTable.createdAt} > ${dateFilter}`));
    const leadCount = leadStats?.count ?? 0;

    // 3. Compute category scores (0-100)

    // Headline Clarity: has hero block + at least one heading = good
    const headlineScore = Math.min(
      (analysis.hasHero ? 40 : 0) +
      (analysis.headlineCount >= 1 ? 30 : 0) +
      (analysis.headlineCount >= 2 ? 15 : 0) +
      (page.metaTitle ? 15 : 0),
      100
    );

    // CTA Effectiveness: has CTA + good CVR
    const cvrScore = Math.min(Math.round((cvr / 5) * 100), 100);
    const ctaScore = Math.min(
      (analysis.hasCtaButton ? 40 : 0) +
      Math.round(cvrScore * 0.6),
      100
    );

    // Social Proof: testimonials, logos, reviews
    const socialProofScore = analysis.hasSocialProof ? 80 : (leadCount > 5 ? 40 : 15);

    // Form Friction: fewer fields = better; no form = lower score
    let formFrictionScore = 50; // default if no form
    if (analysis.hasForm) {
      if (analysis.formFieldCount <= 3) formFrictionScore = 95;
      else if (analysis.formFieldCount <= 5) formFrictionScore = 75;
      else if (analysis.formFieldCount <= 8) formFrictionScore = 50;
      else formFrictionScore = 30;
    }

    // Visual Hierarchy: block count (sweet spot 6-15), images, proper structure
    const blockCountScore = analysis.blockCount >= 4 && analysis.blockCount <= 20 ? 40 : (analysis.blockCount > 0 ? 20 : 0);
    const visualScore = Math.min(
      blockCountScore +
      (analysis.imageCount >= 1 ? 25 : 0) +
      (analysis.hasHero ? 20 : 0) +
      (analysis.hasFooter ? 15 : 0),
      100
    );

    // Page Speed Impact: based on block/image count (proxy — real metrics need PSI)
    const speedScore = Math.max(100 - (analysis.blockCount * 3) - (analysis.imageCount * 5), 20);

    // Mobile Responsiveness: scroll depth as proxy (good scroll = mobile works)
    const scrollScore = Math.min(Math.round(avgScrollDepth), 100);
    const mobileScore = totalVisits > 0 ? Math.min(scrollScore + 20, 100) : 50;

    // Trust Signals: trust badges, FAQ, footer with legal
    const trustScore = Math.min(
      (analysis.hasTrustSignals ? 40 : 0) +
      (analysis.hasFaq ? 25 : 0) +
      (analysis.hasFooter ? 20 : 0) +
      (page.metaDescription ? 15 : 0),
      100
    );

    // 4. Build categories array
    const categories = [
      {
        name: "Headline Clarity",
        score: headlineScore,
        grade: letterGrade(headlineScore),
        recommendation: !analysis.hasHero
          ? "Add a hero block with a clear headline above the fold"
          : headlineScore < 70
          ? "Add a benefit-driven subheadline to your hero section"
          : "Headline structure looks solid",
      },
      {
        name: "CTA Effectiveness",
        score: ctaScore,
        grade: letterGrade(ctaScore),
        recommendation: !analysis.hasCtaButton
          ? "Add a prominent call-to-action button"
          : cvr < 2
          ? "Try action-oriented CTA copy and increase button contrast"
          : "CTA is performing well — keep testing variants",
      },
      {
        name: "Social Proof",
        score: socialProofScore,
        grade: letterGrade(socialProofScore),
        recommendation: !analysis.hasSocialProof
          ? "Add customer testimonials or logo bar above the fold"
          : "Social proof is present — consider adding specific metrics or quotes",
      },
      {
        name: "Form Friction",
        score: formFrictionScore,
        grade: letterGrade(formFrictionScore),
        recommendation: !analysis.hasForm
          ? "Add a lead capture form to convert visitors"
          : analysis.formFieldCount > 5
          ? `Reduce form from ${analysis.formFieldCount} fields to 3-4 to improve completion rate`
          : "Form field count is optimized",
      },
      {
        name: "Visual Hierarchy",
        score: visualScore,
        grade: letterGrade(visualScore),
        recommendation: analysis.blockCount < 4
          ? "Add more content sections to tell a complete story"
          : analysis.imageCount === 0
          ? "Add at least one image or visual element"
          : "Visual structure looks good",
      },
      {
        name: "Page Speed Impact",
        score: speedScore,
        grade: letterGrade(speedScore),
        recommendation: analysis.imageCount > 5
          ? "Optimize images — consider lazy loading below-fold content"
          : analysis.blockCount > 15
          ? "Consider consolidating blocks to improve load time"
          : "Page complexity is within recommended limits",
      },
      {
        name: "Mobile Responsiveness",
        score: mobileScore,
        grade: letterGrade(mobileScore),
        recommendation: avgScrollDepth < 30
          ? "Low scroll depth suggests mobile layout issues — check on a phone"
          : "Scroll depth indicates content is engaging on all devices",
      },
      {
        name: "Trust Signals",
        score: trustScore,
        grade: letterGrade(trustScore),
        recommendation: !analysis.hasTrustSignals
          ? "Add trust badges, security icons, or a guarantee near your CTA"
          : !analysis.hasFaq
          ? "Add an FAQ section to address common objections"
          : "Trust signals are well-placed",
      },
    ];

    // 5. Overall score (weighted)
    const weights = [0.15, 0.20, 0.10, 0.15, 0.10, 0.10, 0.10, 0.10];
    const overallScore = Math.round(
      categories.reduce((sum, cat, i) => sum + cat.score * weights[i], 0)
    );

    // 6. Quick wins — sorted by impact
    const quickWins: Array<{ impact: "high" | "medium" | "low"; suggestion: string }> = [];
    const scored = categories.map((c, i) => ({ ...c, weight: weights[i] }));
    scored.sort((a, b) => (a.score * a.weight) - (b.score * b.weight));
    for (const cat of scored.slice(0, 3)) {
      if (cat.score < 80) {
        quickWins.push({
          impact: cat.score < 50 ? "high" : "medium",
          suggestion: cat.recommendation,
        });
      }
    }

    res.json({
      pageId,
      pageTitle: page.title,
      pageSlug: page.slug,
      overallScore,
      totalVisits,
      conversions,
      impressions,
      cvr: Math.round(cvr * 100) / 100,
      leadCount,
      categories,
      quickWins,
      metrics: {
        avgScrollDepth,
        clicksPerSession: Math.round(clicksPerSession * 100) / 100,
        blockCount: analysis.blockCount,
      },
    });
  } catch (err) {
    console.error("GET /lp/conversion-scoring/:pageId error:", err);
    res.status(500).json({ error: "Failed to compute conversion score" });
  }
});

export default router;
