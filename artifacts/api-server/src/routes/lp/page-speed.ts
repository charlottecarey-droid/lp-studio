import { Router } from "express";
import { getTenantId } from "../../middleware/requireAuth";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── Block-level performance analysis ────────────────────────────────────────

interface Block {
  type?: string;
  props?: Record<string, unknown>;
  blockSettings?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PageIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  blockId?: string;
  blockType?: string;
}

interface PageSpeedResult {
  pageId: number;
  name: string;
  slug: string;
  score: number;
  status: "passing" | "needs-work" | "failing";
  blockCount: number;
  imageCount: number;
  videoCount: number;
  formCount: number;
  customHtmlCount: number;
  animatedBlocks: number;
  parallaxImages: number;
  heavyBlocks: string[];
  estimatedDomNodes: number;
  issues: PageIssue[];
}

/** Block types known to be render-heavy (complex JS, canvas, WebGL, etc.) */
const HEAVY_BLOCK_TYPES = new Set([
  "roi-calculator",
  "dso-particle-mesh",
  "dso-live-feed",
  "dso-scroll-story",
  "dso-case-flow",
  "dso-ai-feature",
  "dso-paradigm-shift",
  "popup",
]);

/** Average estimated DOM node count per block type */
const DOM_ESTIMATES: Record<string, number> = {
  "hero": 15,
  "full-bleed-hero": 20,
  "trust-bar": 8,
  "benefits-grid": 30,
  "testimonial": 20,
  "how-it-works": 25,
  "product-grid": 40,
  "photo-strip": 25,
  "comparison": 35,
  "case-studies": 30,
  "resources": 25,
  "zigzag-features": 30,
  "product-showcase": 35,
  "form": 40,
  "rich-text": 10,
  "custom-html": 20,
  "video-section": 10,
  "roi-calculator": 50,
  "footer": 20,
  "nav-header": 15,
  "popup": 25,
  "sticky-bar": 10,
  "spacer": 2,
  "cta-button": 5,
  "stat-callout": 12,
  "pas-section": 20,
  "bottom-cta": 10,
};

function analyzePageBlocks(blocks: unknown[]): {
  imageCount: number;
  videoCount: number;
  formCount: number;
  customHtmlCount: number;
  animatedBlocks: number;
  parallaxImages: number;
  heavyBlocks: string[];
  estimatedDomNodes: number;
  issues: PageIssue[];
} {
  let imageCount = 0;
  let videoCount = 0;
  let formCount = 0;
  let customHtmlCount = 0;
  let animatedBlocks = 0;
  let parallaxImages = 0;
  const heavyBlocks: string[] = [];
  let estimatedDomNodes = 0;
  const issues: PageIssue[] = [];

  for (const raw of blocks) {
    const block = raw as Block;
    const type = (block.type || "unknown").toLowerCase();
    const props = block.props || {};
    const settings = block.blockSettings || {};
    const propsStr = JSON.stringify(props).toLowerCase();
    const blockId = (block.id as string) || undefined;

    // DOM estimate
    estimatedDomNodes += DOM_ESTIMATES[type] || 15;

    // Image detection
    const imageFields = ["imageurl", "mediaurl", "bgimageurl", "logourl", "avatarurl", "thumbnailurl"];
    for (const field of imageFields) {
      if (propsStr.includes(`"${field}"`) && propsStr.includes("http")) {
        imageCount++;
      }
    }
    // Background image in settings
    if (settings.bgImageUrl) {
      imageCount++;
    }
    // Photo strip / product grid have multiple images in arrays
    if (type === "photo-strip" || type === "product-grid") {
      const items = (props.items || props.photos || props.products) as unknown[];
      if (Array.isArray(items)) {
        imageCount += items.length;
      }
    }

    // Video detection
    if (type === "video-section" || propsStr.includes("videourl") || propsStr.includes("youtube") || propsStr.includes("vimeo") || propsStr.includes("wistia")) {
      videoCount++;
    }

    // Form detection
    if (type === "form") {
      formCount++;
      const fields = props.fields as unknown[];
      if (Array.isArray(fields) && fields.length > 8) {
        issues.push({
          severity: "warning",
          category: "Interactivity",
          message: `Form has ${fields.length} fields — consider reducing to under 8 for faster interaction`,
          blockId,
          blockType: type,
        });
      }
    }

    // Custom HTML detection
    if (type === "custom-html") {
      customHtmlCount++;
      const html = String(props.html || props.code || "");
      if (html.includes("<script")) {
        issues.push({
          severity: "critical",
          category: "Third-party Scripts",
          message: "Custom HTML block contains <script> tags — these block rendering and add latency",
          blockId,
          blockType: type,
        });
      }
      if (html.includes("<iframe")) {
        issues.push({
          severity: "warning",
          category: "Embeds",
          message: "Custom HTML block contains an iframe embed — consider lazy-loading",
          blockId,
          blockType: type,
        });
      }
    }

    // Animation detection
    const anim = settings.animationStyle || props.animationStyle;
    if (anim && anim !== "none") {
      animatedBlocks++;
    }

    // Parallax detection
    if (settings.bgImageParallax) {
      parallaxImages++;
    }

    // Heavy block detection
    if (HEAVY_BLOCK_TYPES.has(type)) {
      heavyBlocks.push(type);
    }
  }

  // Page-level issues
  if (blocks.length > 20) {
    issues.push({
      severity: "warning",
      category: "Page Size",
      message: `Page has ${blocks.length} blocks — pages over 20 blocks tend to have slower initial paint`,
    });
  }
  if (blocks.length > 35) {
    issues.push({
      severity: "critical",
      category: "Page Size",
      message: `Page has ${blocks.length} blocks — consider splitting into multiple pages or removing unused sections`,
    });
  }
  if (imageCount > 10) {
    issues.push({
      severity: "warning",
      category: "Images",
      message: `${imageCount} images detected — ensure images below the fold are lazy-loaded`,
    });
  }
  if (imageCount > 20) {
    issues.push({
      severity: "critical",
      category: "Images",
      message: `${imageCount} images on a single page — this significantly impacts LCP and total page weight`,
    });
  }
  if (videoCount > 1) {
    issues.push({
      severity: "warning",
      category: "Video",
      message: `${videoCount} video embeds — each adds 200-500KB+ of player scripts. Consider keeping to 1 per page`,
    });
  }
  if (animatedBlocks > 5) {
    issues.push({
      severity: "info",
      category: "Animations",
      message: `${animatedBlocks} animated blocks — excessive animations can cause jank on lower-end devices`,
    });
  }
  if (parallaxImages > 0) {
    issues.push({
      severity: "warning",
      category: "Parallax",
      message: `${parallaxImages} parallax background image(s) — parallax forces compositing and hurts CLS`,
    });
  }
  if (heavyBlocks.length > 0) {
    issues.push({
      severity: "warning",
      category: "Heavy Components",
      message: `Heavy block types detected: ${heavyBlocks.join(", ")} — these add significant JS/render cost`,
    });
  }
  if (estimatedDomNodes > 800) {
    issues.push({
      severity: "warning",
      category: "DOM Size",
      message: `Estimated ~${estimatedDomNodes} DOM nodes — aim to keep under 800 for smooth interactivity`,
    });
  }
  if (customHtmlCount > 2) {
    issues.push({
      severity: "warning",
      category: "Custom Code",
      message: `${customHtmlCount} custom HTML blocks — each one is an unknown performance risk`,
    });
  }

  return { imageCount, videoCount, formCount, customHtmlCount, animatedBlocks, parallaxImages, heavyBlocks, estimatedDomNodes, issues };
}

/** Score 0-100 based on block analysis. Deductions from a perfect 100. */
function computeScore(blockCount: number, analysis: ReturnType<typeof analyzePageBlocks>): number {
  let score = 100;

  // Block count penalty
  if (blockCount > 12) score -= Math.min(15, (blockCount - 12) * 1.5);

  // Image penalty (first 5 are free)
  if (analysis.imageCount > 5) score -= Math.min(20, (analysis.imageCount - 5) * 2);

  // Video penalty
  score -= analysis.videoCount * 5;

  // Custom HTML penalty
  score -= analysis.customHtmlCount * 4;

  // Heavy block penalty
  score -= analysis.heavyBlocks.length * 6;

  // Parallax penalty
  score -= analysis.parallaxImages * 5;

  // Animation overuse
  if (analysis.animatedBlocks > 5) score -= (analysis.animatedBlocks - 5) * 2;

  // DOM size penalty
  if (analysis.estimatedDomNodes > 600) score -= Math.min(15, Math.floor((analysis.estimatedDomNodes - 600) / 50) * 2);

  // Critical issues add extra penalty
  const criticals = analysis.issues.filter(i => i.severity === "critical").length;
  score -= criticals * 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getStatus(score: number): "passing" | "needs-work" | "failing" {
  if (score >= 80) return "passing";
  if (score >= 50) return "needs-work";
  return "failing";
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /lp/page-speed — Analyze all pages for the tenant */
router.get("/lp/page-speed", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  try {
    const pages = await db
      .select({
        id: lpPagesTable.id,
        title: lpPagesTable.title,
        slug: lpPagesTable.slug,
        blocks: lpPagesTable.blocks,
        status: lpPagesTable.status,
      })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId));

    const results: PageSpeedResult[] = pages.map(page => {
      const blocks = Array.isArray(page.blocks) ? page.blocks : [];
      const analysis = analyzePageBlocks(blocks);
      const score = computeScore(blocks.length, analysis);

      return {
        pageId: page.id,
        name: page.title,
        slug: page.slug,
        score,
        status: getStatus(score),
        blockCount: blocks.length,
        ...analysis,
      };
    });

    // Sort: failing first, then needs-work, then passing (worst scores on top)
    results.sort((a, b) => a.score - b.score);

    const passing = results.filter(r => r.status === "passing").length;
    const needsWork = results.filter(r => r.status === "needs-work").length;
    const failing = results.filter(r => r.status === "failing").length;
    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0;

    res.json({
      pages: results,
      summary: { total: results.length, passing, needsWork, failing, avgScore },
    });
  } catch (err) {
    console.error("Page speed analysis error:", err);
    res.status(500).json({ error: "Failed to analyze pages" });
  }
});

/** GET /lp/page-speed/:pageId — Detailed analysis for a single page */
router.get("/lp/page-speed/:pageId", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;

  const pageId = parseInt(req.params.pageId, 10);
  if (isNaN(pageId)) {
    res.status(400).json({ error: "Invalid pageId" });
    return;
  }

  try {
    const [page] = await db
      .select()
      .from(lpPagesTable)
      .where(eq(lpPagesTable.id, pageId));

    if (!page || page.tenantId !== tenantId) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const analysis = analyzePageBlocks(blocks);
    const score = computeScore(blocks.length, analysis);

    res.json({
      pageId: page.id,
      name: page.title,
      slug: page.slug,
      score,
      status: getStatus(score),
      blockCount: blocks.length,
      ...analysis,
    });
  } catch (err) {
    console.error("Page speed detail error:", err);
    res.status(500).json({ error: "Failed to analyze page" });
  }
});

export default router;
