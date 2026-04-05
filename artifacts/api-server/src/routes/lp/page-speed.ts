import { Router } from "express";

const router = Router();

/**
 * GET /lp/page-speed - Get Core Web Vitals metrics for all landing pages
 * Returns an array of pages with LCP, FID, CLS, speed score, and status
 */
router.get("/lp/page-speed", async (req, res): Promise<void> => {
  try {
    // Mock data with realistic Core Web Vitals for various page types
    const mockPages = [
      {
        pageId: 1,
        name: "SaaS Product Launch",
        slug: "saas-launch",
        lcp: 2.1,
        fid: 45,
        cls: 0.05,
        score: 92,
        status: "passing" as const,
      },
      {
        pageId: 2,
        name: "Event Registration",
        slug: "event-reg",
        lcp: 3.8,
        fid: 180,
        cls: 0.18,
        score: 58,
        status: "needs-work" as const,
      },
      {
        pageId: 3,
        name: "Free Trial Signup",
        slug: "free-trial",
        lcp: 1.9,
        fid: 62,
        cls: 0.08,
        score: 95,
        status: "passing" as const,
      },
      {
        pageId: 4,
        name: "Webinar Landing",
        slug: "webinar-2024",
        lcp: 4.2,
        fid: 310,
        cls: 0.28,
        score: 41,
        status: "failing" as const,
      },
      {
        pageId: 5,
        name: "Product Demo",
        slug: "product-demo",
        lcp: 2.6,
        fid: 95,
        cls: 0.12,
        score: 78,
        status: "needs-work" as const,
      },
      {
        pageId: 6,
        name: "Case Study Download",
        slug: "case-study",
        lcp: 1.8,
        fid: 55,
        cls: 0.06,
        score: 94,
        status: "passing" as const,
      },
      {
        pageId: 7,
        name: "Pricing Comparison",
        slug: "pricing",
        lcp: 3.1,
        fid: 140,
        cls: 0.15,
        score: 68,
        status: "needs-work" as const,
      },
      {
        pageId: 8,
        name: "Mobile App Promo",
        slug: "mobile-promo",
        lcp: 2.3,
        fid: 75,
        cls: 0.09,
        score: 88,
        status: "passing" as const,
      },
    ];

    res.json(mockPages);
  } catch (err) {
    console.error("Page speed fetch error:", err);
    res.status(500).json({ error: "Failed to fetch page speed metrics" });
  }
});

/**
 * POST /lp/page-speed/:pageId/optimize - Apply optimizations to a specific page
 * Simulates optimization improvements and returns the results
 */
router.post("/lp/page-speed/:pageId/optimize", async (req, res): Promise<void> => {
  try {
    const pageId = parseInt(req.params.pageId, 10);

    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    // Simulate optimization improvements (LCP and CLS typically improve most)
    const improvements = {
      lcpDelta: -0.4, // LCP typically improves by 0.3-0.5s
      fidDelta: -25, // FID typically improves by 20-40ms
      clsDelta: -0.03, // CLS typically improves by 0.02-0.05
      savedBytes: 340000, // ~340KB saved
      estimatedTimeSaved: 450, // ~450ms improvement
    };

    res.json({
      success: true,
      message: "Optimizations applied successfully",
      pageId,
      improvements,
      appliedAt: new Date().toISOString(),
      nextAnalysisAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    });
  } catch (err) {
    console.error("Optimization error:", err);
    res.status(500).json({ error: "Failed to apply optimizations" });
  }
});

/**
 * POST /lp/page-speed/optimize-all - Apply optimizations to all pages
 * Batch operation for optimizing the entire site
 */
router.post("/lp/page-speed/optimize-all", async (req, res): Promise<void> => {
  try {
    // Simulate batch optimization across all pages
    const pageIds = [1, 2, 3, 4, 5, 6, 7, 8];

    const results = pageIds.map((pageId) => ({
      pageId,
      success: true,
      improvements: {
        lcpDelta: -0.35,
        fidDelta: -20,
        clsDelta: -0.025,
        savedBytes: 320000,
      },
    }));

    res.json({
      success: true,
      message: "Auto-optimization applied to all pages",
      pagesOptimized: pageIds.length,
      results,
      totalBytesRecovered: 2560000, // 2.56MB total
      estimatedTimeImprovement: "3.2s avg",
      appliedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Batch optimization error:", err);
    res.status(500).json({ error: "Failed to apply batch optimizations" });
  }
});

/**
 * GET /lp/page-speed/:pageId/history - Get historical Core Web Vitals trends
 * Returns time-series data for a specific page
 */
router.get("/lp/page-speed/:pageId/history", async (req, res): Promise<void> => {
  try {
    const pageId = parseInt(req.params.pageId, 10);

    if (isNaN(pageId)) {
      res.status(400).json({ error: "Invalid pageId" });
      return;
    }

    // Simulate 30-day historical trend data
    const history = Array.from({ length: 30 }, (_, i) => {
      const daysAgo = 29 - i;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      // Generate realistic trending data (generally improving)
      const baseVariance = 0.3 - (daysAgo * 0.01);
      const lcp = 3.2 + baseVariance + Math.random() * 0.5;
      const fid = 180 + (daysAgo * 2) + Math.random() * 50;
      const cls = 0.2 + baseVariance + Math.random() * 0.08;
      const score = Math.max(30, Math.min(95, 50 + (daysAgo * 1.5) + Math.random() * 15));

      return {
        date: date.toISOString().split("T")[0],
        lcp: Math.max(1.2, Math.round(lcp * 10) / 10),
        fid: Math.max(30, Math.round(fid)),
        cls: Math.max(0.02, Math.round(cls * 100) / 100),
        score: Math.round(score),
      };
    });

    res.json({
      pageId,
      period: "30d",
      metrics: {
        current: history[history.length - 1],
        previous: history[0],
        trend: {
          lcpTrend: "improving",
          fidTrend: "improving",
          clsTrend: "stable",
        },
      },
      history,
    });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch speed history" });
  }
});

export default router;
