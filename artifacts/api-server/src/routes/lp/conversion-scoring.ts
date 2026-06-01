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

export function letterGrade(score: number): string {
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

export interface BlockAnalysis {
  hasHero: boolean;
  hasCtaButton: boolean;
  hasSocialProof: boolean;
  hasForm: boolean;
  hasBooking: boolean;
  formFieldCount: number;
  hasFaq: boolean;
  hasFooter: boolean;
  hasTrustSignals: boolean;
  blockCount: number;
  headlineCount: number;
  imageCount: number;
}

// Social-proof block types the generator and catalog actually emit. Matched by
// exact type (substring keyword matching is avoided here because, e.g.,
// "bold-statement" contains "stat" but is NOT social proof).
const SOCIAL_PROOF_TYPES = new Set<string>([
  "trust-bar",
  "stat-callout",
  "case-studies",
  "case-study",
  "story-hub",
  "testimonial",
  "dso-stat-bar",
  "dso-stat-row",
  "dso-stat-showcase",
  "dso-success-stories",
  "dso-testimonials",
  "dso-case-study",
  "dso-flow-canvas",
  "dso-bento-outcomes",
]);

function valStr(v: unknown): string {
  return typeof v === "string" ? v.toLowerCase() : "";
}

// Analyze the blocks jsonb from a page to compute content-based scores
export function analyzeBlocks(blocks: unknown[]): BlockAnalysis {
  const result: BlockAnalysis = {
    hasHero: false,
    hasCtaButton: false,
    hasSocialProof: false,
    hasForm: false,
    hasBooking: false,
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
    const props = (block.props || {}) as Record<string, unknown>;
    const propsStr = JSON.stringify(props).toLowerCase();

    if (type.includes("hero") || type.includes("header")) result.hasHero = true;
    if (type.includes("cta") || type.includes("button") || propsStr.includes("cta")) result.hasCtaButton = true;

    // ── Social proof ───────────────────────────────────────────────
    // Recognize the full vocabulary: testimonials, logo bars, reviews, trust /
    // stat bars, stat callouts, case studies, story hubs, the dso-* social
    // family, and bento grids whose tiles are quotes or stats.
    if (
      SOCIAL_PROOF_TYPES.has(type) ||
      type.includes("testimonial") ||
      type.includes("review") ||
      type.includes("-logo") ||
      type.includes("logo-") ||
      type.includes("case-stud") ||
      type.includes("success-stor")
    ) {
      result.hasSocialProof = true;
    }
    // Props-based social proof — a block carrying a non-empty stats /
    // testimonials / cases array is credibility content regardless of its type
    // (e.g. a `dandy-conversion-panel` or `dso-ai-feature` with "Join 8,000+
    // practices" stats).
    const statsArr = props.stats;
    const testimonialsArr = props.testimonials;
    const casesArr = props.cases;
    if (
      (Array.isArray(statsArr) && statsArr.length > 0) ||
      (Array.isArray(testimonialsArr) && testimonialsArr.length > 0) ||
      (Array.isArray(casesArr) && casesArr.length > 0)
    ) {
      result.hasSocialProof = true;
    }
    if (type.includes("bento")) {
      const tiles = props.tiles;
      if (Array.isArray(tiles)) {
        for (const t of tiles) {
          const kind = valStr((t as Record<string, unknown>)?.kind) || valStr((t as Record<string, unknown>)?.type);
          if (kind === "quote" || kind === "stat") {
            result.hasSocialProof = true;
            break;
          }
        }
      }
    }

    // ── Forms ──────────────────────────────────────────────────────
    if (type.includes("form") || type.includes("lead") || type.includes("signup")) {
      result.hasForm = true;
      // Multi-step forms store fields under steps[].fields …
      const steps = props.steps;
      if (Array.isArray(steps)) {
        for (const step of steps) {
          const fields = (step as Record<string, unknown>)?.fields;
          if (Array.isArray(fields)) result.formFieldCount += fields.length;
        }
      }
      // … single-step forms store them directly under props.fields.
      const fields = props.fields;
      if (Array.isArray(fields)) result.formFieldCount += fields.length;
    }

    // ── Booking / low-friction capture path ────────────────────────
    // A ChiliPiper-wired CTA, an inline capture block, or an ROI calculator
    // with a CTA is a valid conversion mechanism — not a "no form" gap.
    // Check VALUES (not the serialized props string) because the neutral
    // default props include an empty `chilipiperUrl: ""` key whose name alone
    // contains "chilipiper".
    const ctaMode =
      valStr(props.ctaMode) ||
      valStr(props.primaryCtaMode) ||
      valStr(props.ctaType) ||
      valStr(props.ctaAction);
    const chilipiperUrl = typeof props.chilipiperUrl === "string" ? props.chilipiperUrl.trim() : "";
    const ctaUrls = `${valStr(props.ctaUrl)} ${valStr(props.primaryCtaUrl)} ${valStr(props.ctaHref)}`;
    if (
      ctaMode === "chilipiper" ||
      chilipiperUrl !== "" ||
      ctaUrls.includes("chilipiper") ||
      type === "dso-cta-capture"
    ) {
      result.hasBooking = true;
    }
    // A dedicated final/conversion CTA block (bottom-cta, dso-final-cta,
    // dandy-conversion-panel, a standalone cta-button) IS the page's conversion
    // mechanism, so long as it carries a CTA label. This keeps structurally
    // complete pages from being penalized for "no form" when the conversion
    // path is a low-friction CTA rather than an inline form.
    const isConversionBlock =
      type === "bottom-cta" ||
      type === "cta-button" ||
      type.includes("final-cta") ||
      type.includes("conversion-panel") ||
      type.includes("cta-capture");
    if (isConversionBlock && (valStr(props.ctaText) !== "" || valStr(props.primaryCtaText) !== "")) {
      result.hasBooking = true;
    }
    if (type.includes("roi-calculator") && (props.ctaEnabled === true || valStr(props.ctaText) !== "")) {
      result.hasBooking = true;
    }

    if (type.includes("faq") || type.includes("accordion")) result.hasFaq = true;
    if (type.includes("footer")) result.hasFooter = true;
    // Trust signals — kept DISTINCT from social proof (no "trust" substring, so
    // the social-proof "trust-bar" stat block is not double-counted here).
    if (
      type.includes("badge") ||
      type.includes("security") ||
      type.includes("guarantee") ||
      type.includes("shield") ||
      type.includes("promise") ||
      type.includes("seal") ||
      type.includes("compliance")
    ) {
      result.hasTrustSignals = true;
    }
    if (type.includes("heading") || type.includes("headline") || type.includes("hero")) result.headlineCount++;
    // Imagery — recognized by type keyword (image/gallery/video/photo/carousel)
    // OR by carrying a non-empty images[] array (e.g. `photo-strip`).
    const imagesArr = props.images;
    if (
      type.includes("image") ||
      type.includes("gallery") ||
      type.includes("video") ||
      type.includes("photo") ||
      type.includes("carousel") ||
      (Array.isArray(imagesArr) && imagesArr.length > 0)
    ) {
      result.imageCount++;
    }
  }

  return result;
}

export interface ScoringCategory {
  name: string;
  score: number;
  grade: string;
  recommendation: string;
}

export interface QuickWin {
  impact: "high" | "medium" | "low";
  suggestion: string;
}

// Weighted category order: Headline, CTA, Social, Form, Visual, Speed, Mobile, Trust
const WEIGHTS = [0.15, 0.2, 0.1, 0.15, 0.1, 0.1, 0.1, 0.1];

// Pure scoring — given the structural analysis plus whatever behavioral data
// exists, produce the category breakdown, overall score, and quick wins.
//
// Calibration principle: a structurally complete page with NO traffic yet is
// scored on its structure/content (so it lands in B territory out of the box),
// while behavioral signals (CVR, scroll depth, leads) blend in once real
// traffic exists. A genuinely weak page (no social proof, long form, thin
// structure) still scores low regardless of traffic.
export function computeConversionScore(input: {
  analysis: BlockAnalysis;
  metaTitle?: string | null;
  metaDescription?: string | null;
  impressions: number;
  cvr: number;
  leadCount: number;
  avgScrollDepth: number;
}): { categories: ScoringCategory[]; overallScore: number; quickWins: QuickWin[] } {
  const { analysis, metaTitle, metaDescription, impressions, cvr, leadCount, avgScrollDepth } = input;
  const hasTraffic = impressions > 0;
  const hasScrollData = avgScrollDepth > 0;
  const hasConversionPath = analysis.hasForm || analysis.hasBooking;

  // Headline Clarity: hero block + headings (+ meta title). Pure structure.
  const headlineScore = Math.min(
    (analysis.hasHero ? 40 : 0) +
      (analysis.headlineCount >= 1 ? 30 : 0) +
      (analysis.headlineCount >= 2 ? 15 : 0) +
      (metaTitle ? 15 : 0),
    100,
  );

  // CTA Effectiveness: structural baseline when there's no traffic; once
  // impressions exist, real CVR blends in (and can pull a non-performing CTA
  // down). A page with neither a CTA nor a booking path scores low.
  const cvrScore = Math.min(Math.round((cvr / 5) * 100), 100);
  let ctaScore: number;
  if (!analysis.hasCtaButton && !analysis.hasBooking) {
    ctaScore = 30;
  } else if (hasTraffic) {
    // structure 40% + behavioral CVR 60%
    ctaScore = Math.min(Math.round(85 * 0.4 + cvrScore * 0.6), 100);
  } else {
    ctaScore = analysis.hasBooking ? 90 : 85;
  }

  // Social Proof: present → strong (A-/B+). Absent → low, with a small lift if
  // leads are actually coming in even without a recognized block.
  const socialProofScore = analysis.hasSocialProof ? 88 : leadCount > 5 ? 45 : 20;

  // Form Friction: short forms / low-friction booking score well; only
  // genuinely long forms are penalized. No conversion path at all scores low.
  let formFrictionScore: number;
  if (analysis.hasForm) {
    if (analysis.formFieldCount <= 3) formFrictionScore = 95;
    else if (analysis.formFieldCount <= 5) formFrictionScore = 80;
    else if (analysis.formFieldCount <= 8) formFrictionScore = 55;
    else formFrictionScore = 35;
  } else if (analysis.hasBooking) {
    formFrictionScore = 90; // one-click booking is the lowest friction path
  } else {
    formFrictionScore = 40; // no capture mechanism at all
  }

  // Visual Hierarchy: block count sweet spot, imagery, hero + footer framing.
  const blockCountScore = analysis.blockCount >= 4 && analysis.blockCount <= 20 ? 40 : analysis.blockCount > 0 ? 20 : 0;
  const visualScore = Math.min(
    blockCountScore + (analysis.imageCount >= 1 ? 25 : 0) + (analysis.hasHero ? 20 : 0) + (analysis.hasFooter ? 15 : 0),
    100,
  );

  // Page Speed Impact: block/image-count proxy (unchanged — real metrics need PSI).
  const speedScore = Math.max(100 - analysis.blockCount * 3 - analysis.imageCount * 5, 20);

  // Mobile Responsiveness: scroll depth as a proxy once we have scroll data;
  // until then, assume the responsive block library renders well (structural).
  const scrollScore = Math.min(Math.round(avgScrollDepth), 100);
  const mobileScore = hasScrollData ? Math.min(scrollScore + 20, 100) : 85;

  // Trust Signals: trust badges / guarantees, FAQ, footer, meta description.
  const trustScore = Math.min(
    (analysis.hasTrustSignals ? 40 : 0) +
      (analysis.hasFaq ? 25 : 0) +
      (analysis.hasFooter ? 20 : 0) +
      (metaDescription ? 15 : 0),
    100,
  );

  const categories: ScoringCategory[] = [
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
      recommendation:
        !analysis.hasCtaButton && !analysis.hasBooking
          ? "Add a prominent call-to-action button or booking link"
          : hasTraffic && cvr < 2
            ? "Try action-oriented CTA copy and increase button contrast"
            : "CTA is in place — keep testing copy and placement",
    },
    {
      name: "Social Proof",
      score: socialProofScore,
      grade: letterGrade(socialProofScore),
      recommendation: !analysis.hasSocialProof
        ? "Add testimonials, a stats/trust bar, or case studies to build credibility"
        : "Social proof is present — consider adding specific metrics or named quotes",
    },
    {
      name: "Form Friction",
      score: formFrictionScore,
      grade: letterGrade(formFrictionScore),
      recommendation: !hasConversionPath
        ? "Add a lead capture form or a one-click booking CTA to convert visitors"
        : analysis.hasForm && analysis.formFieldCount > 5
          ? `Reduce form from ${analysis.formFieldCount} fields to 3-4 to improve completion rate`
          : analysis.hasBooking && !analysis.hasForm
            ? "Low-friction booking flow detected — keep the booking CTA prominent"
            : "Form field count is optimized",
    },
    {
      name: "Visual Hierarchy",
      score: visualScore,
      grade: letterGrade(visualScore),
      recommendation:
        analysis.blockCount < 4
          ? "Add more content sections to tell a complete story"
          : analysis.imageCount === 0
            ? "Add at least one image or visual element"
            : "Visual structure looks good",
    },
    {
      name: "Page Speed Impact",
      score: speedScore,
      grade: letterGrade(speedScore),
      recommendation:
        analysis.imageCount > 5
          ? "Optimize images — consider lazy loading below-fold content"
          : analysis.blockCount > 15
            ? "Consider consolidating blocks to improve load time"
            : "Page complexity is within recommended limits",
    },
    {
      name: "Mobile Responsiveness",
      score: mobileScore,
      grade: letterGrade(mobileScore),
      recommendation: hasScrollData && avgScrollDepth < 30
        ? "Low scroll depth suggests mobile layout issues — check on a phone"
        : !hasScrollData
          ? "Built on responsive blocks — validate on a real device once traffic arrives"
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

  const overallScore = Math.round(categories.reduce((sum, cat, i) => sum + cat.score * WEIGHTS[i], 0));

  // Quick wins — lowest weighted-impact categories first.
  const quickWins: QuickWin[] = [];
  const scored = categories.map((c, i) => ({ ...c, weight: WEIGHTS[i] }));
  scored.sort((a, b) => a.score * a.weight - b.score * b.weight);
  for (const cat of scored.slice(0, 3)) {
    if (cat.score < 80) {
      quickWins.push({
        impact: cat.score < 50 ? "high" : "medium",
        suggestion: cat.recommendation,
      });
    }
  }

  return { categories, overallScore, quickWins };
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

    // 3. Compute category scores + overall + quick wins (pure)
    const { categories, overallScore, quickWins } = computeConversionScore({
      analysis,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      impressions,
      cvr,
      leadCount,
      avgScrollDepth,
    });

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
