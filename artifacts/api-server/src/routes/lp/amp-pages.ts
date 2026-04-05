import { Router } from "express";

const router = Router();

/**
 * Mock AMP pages data with realistic states
 */
const mockAmpPages = [
  {
    pageId: 1,
    name: "SaaS Product Launch",
    ampEnabled: true,
    ampStatus: "valid" as const,
    ampLoadTime: 0.4,
    regularLoadTime: 2.1,
    lastValidated: "2026-04-04T10:00:00Z",
    mobileTraffic: 68,
  },
  {
    pageId: 2,
    name: "Event Registration",
    ampEnabled: true,
    ampStatus: "warnings" as const,
    ampLoadTime: 0.6,
    regularLoadTime: 3.8,
    warnings: 2,
    lastValidated: "2026-04-03T15:00:00Z",
    mobileTraffic: 75,
  },
  {
    pageId: 3,
    name: "Free Trial Signup",
    ampEnabled: true,
    ampStatus: "valid" as const,
    ampLoadTime: 0.35,
    regularLoadTime: 1.9,
    lastValidated: "2026-04-04T14:30:00Z",
    mobileTraffic: 82,
  },
  {
    pageId: 4,
    name: "Webinar Landing",
    ampEnabled: false,
    ampStatus: "not-generated" as const,
    ampLoadTime: 0,
    regularLoadTime: 4.2,
    lastValidated: null,
    mobileTraffic: 45,
  },
  {
    pageId: 5,
    name: "Product Demo",
    ampEnabled: true,
    ampStatus: "warnings" as const,
    ampLoadTime: 0.55,
    regularLoadTime: 2.8,
    warnings: 3,
    lastValidated: "2026-04-02T11:00:00Z",
    mobileTraffic: 62,
  },
  {
    pageId: 6,
    name: "Case Study Download",
    ampEnabled: false,
    ampStatus: "not-generated" as const,
    ampLoadTime: 0,
    regularLoadTime: 3.1,
    lastValidated: null,
    mobileTraffic: 38,
  },
];

/**
 * GET /lp/amp-pages - Get all landing pages with AMP status
 * Returns array of pages with AMP enablement status, load times, and validation info
 */
router.get("/lp/amp-pages", async (req, res): Promise<void> => {
  try {
    res.json(mockAmpPages);
  } catch (err) {
    console.error("AMP pages fetch error:", err);
    res.status(500).json({ error: "Failed to fetch AMP pages" });
  }
});

/**
 * POST /lp/amp-pages/:pageId/generate - Generate AMP version for a page
 * Simulates the generation of an AMP-compatible version with optimized performance
 */
router.post(
  "/lp/amp-pages/:pageId/generate",
  async (req, res): Promise<void> => {
    try {
      const pageId = parseInt(req.params.pageId, 10);

      if (isNaN(pageId)) {
        res.status(400).json({ error: "Invalid pageId" });
        return;
      }

      // Simulate AMP generation with realistic load time
      // AMP typically loads 60-80% faster than regular pages
      const page = mockAmpPages.find((p) => p.pageId === pageId);
      if (!page) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      // Generate realistic AMP load time based on regular load time
      const ampLoadTime = page.regularLoadTime * (0.2 + Math.random() * 0.15);

      res.json({
        success: true,
        pageId,
        ampLoadTime: parseFloat(ampLoadTime.toFixed(2)),
        message: "AMP version generated successfully",
        generatedAt: new Date().toISOString(),
        ampUrl: `/amp/${page.name.toLowerCase().replace(/\s+/g, "-")}`,
      });
    } catch (err) {
      console.error("AMP generation error:", err);
      res.status(500).json({ error: "Failed to generate AMP version" });
    }
  }
);

/**
 * POST /lp/amp-pages/:pageId/validate - Validate AMP compliance
 * Checks for AMP-specific issues and returns validation results
 */
router.post(
  "/lp/amp-pages/:pageId/validate",
  async (req, res): Promise<void> => {
    try {
      const pageId = parseInt(req.params.pageId, 10);

      if (isNaN(pageId)) {
        res.status(400).json({ error: "Invalid pageId" });
        return;
      }

      const page = mockAmpPages.find((p) => p.pageId === pageId);
      if (!page || !page.ampEnabled) {
        res.status(404).json({ error: "AMP page not found or not enabled" });
        return;
      }

      // Simulate realistic validation results based on page status
      let warnings: Array<{ type: string; message: string; details?: string }> =
        [];
      let errors: Array<{ type: string; message: string; details?: string }> =
        [];

      // Different validation outcomes based on page ID for variety
      if (pageId === 2 || pageId === 5) {
        // Pages with warnings
        warnings = [
          {
            type: "warning",
            message: "Custom font not AMP-compatible",
            details:
              "Custom fonts must be loaded asynchronously or from AMP-approved sources",
          },
          {
            type: "warning",
            message: "Image missing width/height attributes",
            details: "All images must specify width and height for layout stability",
          },
        ];
        if (pageId === 5) {
          warnings.push({
            type: "warning",
            message: "Script tag needs async attribute",
            details: "Non-AMP scripts must be loaded asynchronously",
          });
        }
      } else if (pageId === 1 || pageId === 3) {
        // Pages with no issues
        warnings = [];
        errors = [];
      }

      res.json({
        pageId,
        valid: errors.length === 0,
        warnings,
        errors,
        passedChecks: 24,
        totalChecks: 24 + warnings.length + errors.length,
        completedAt: new Date().toISOString(),
        nextCheckScheduled: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    } catch (err) {
      console.error("AMP validation error:", err);
      res.status(500).json({ error: "Failed to validate AMP" });
    }
  }
);

/**
 * POST /lp/amp-pages/generate-all - Generate AMP versions for all non-AMP pages
 * Batch operation to create AMP versions for entire site
 */
router.post(
  "/lp/amp-pages/generate-all",
  async (req, res): Promise<void> => {
    try {
      const nonAmpPages = mockAmpPages.filter((p) => !p.ampEnabled);

      const results = nonAmpPages.map((page) => ({
        pageId: page.pageId,
        name: page.name,
        success: true,
        ampLoadTime: parseFloat(
          (page.regularLoadTime * (0.2 + Math.random() * 0.15)).toFixed(2)
        ),
        speedImprovement: Math.round(
          ((page.regularLoadTime -
            page.regularLoadTime * (0.2 + Math.random() * 0.15)) /
            page.regularLoadTime) *
            100
        ),
      }));

      res.json({
        success: true,
        pagesGenerated: nonAmpPages.length,
        results,
        totalTimeEstimate: "2-3 minutes",
        generatedAt: new Date().toISOString(),
        message: `AMP versions generated for ${nonAmpPages.length} page${nonAmpPages.length > 1 ? "s" : ""}`,
      });
    } catch (err) {
      console.error("Batch AMP generation error:", err);
      res
        .status(500)
        .json({ error: "Failed to generate AMP versions for all pages" });
    }
  }
);

/**
 * GET /lp/amp-pages/:pageId - Get detailed AMP info for a specific page
 * Returns full details including validation history and performance metrics
 */
router.get(
  "/lp/amp-pages/:pageId",
  async (req, res): Promise<void> => {
    try {
      const pageId = parseInt(req.params.pageId, 10);

      if (isNaN(pageId)) {
        res.status(400).json({ error: "Invalid pageId" });
        return;
      }

      const page = mockAmpPages.find((p) => p.pageId === pageId);
      if (!page) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      // Return extended data with mock performance history
      res.json({
        ...page,
        performanceHistory: [
          {
            date: "2026-04-04",
            ampLoadTime: page.ampLoadTime,
            regularLoadTime: page.regularLoadTime,
            bounceRate: 18,
            conversions: 142,
          },
          {
            date: "2026-04-03",
            ampLoadTime: page.ampLoadTime + 0.1,
            regularLoadTime: page.regularLoadTime,
            bounceRate: 22,
            conversions: 138,
          },
          {
            date: "2026-04-02",
            ampLoadTime: page.ampLoadTime + 0.15,
            regularLoadTime: page.regularLoadTime,
            bounceRate: 25,
            conversions: 130,
          },
        ],
        recommendations:
          page.ampEnabled && page.ampStatus !== "valid"
            ? [
                "Optimize custom fonts for AMP compatibility",
                "Add missing image dimensions",
                "Review third-party scripts for AMP compliance",
              ]
            : [],
      });
    } catch (err) {
      console.error("AMP page detail error:", err);
      res.status(500).json({ error: "Failed to fetch AMP page details" });
    }
  }
);

/**
 * DELETE /lp/amp-pages/:pageId/disable - Disable AMP for a page
 * Removes the AMP version and reverts to standard page delivery
 */
router.delete(
  "/lp/amp-pages/:pageId/disable",
  async (req, res): Promise<void> => {
    try {
      const pageId = parseInt(req.params.pageId, 10);

      if (isNaN(pageId)) {
        res.status(400).json({ error: "Invalid pageId" });
        return;
      }

      const page = mockAmpPages.find((p) => p.pageId === pageId);
      if (!page) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      res.json({
        success: true,
        pageId,
        message: "AMP disabled successfully",
        disabledAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("AMP disable error:", err);
      res.status(500).json({ error: "Failed to disable AMP" });
    }
  }
);

export default router;
