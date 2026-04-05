import { Router } from "express";

const router = Router();

// Mock data for ad mappings
interface AdMapping {
  id: string;
  platform: "google" | "meta" | "linkedin";
  adGroupName: string;
  landingPageName: string;
  messageMatch: number;
  ctr: number;
  cpc: number;
}

const mockMappings: AdMapping[] = [
  {
    id: "map-1",
    platform: "google",
    adGroupName: "Brand Keywords",
    landingPageName: "Homepage V2",
    messageMatch: 94,
    ctr: 8.2,
    cpc: 1.45,
  },
  {
    id: "map-2",
    platform: "meta",
    adGroupName: "Retargeting",
    landingPageName: "Free Trial Offer",
    messageMatch: 87,
    ctr: 6.5,
    cpc: 0.65,
  },
  {
    id: "map-3",
    platform: "linkedin",
    adGroupName: "Decision Makers",
    landingPageName: "Enterprise Demo",
    messageMatch: 72,
    ctr: 4.1,
    cpc: 3.25,
  },
  {
    id: "map-4",
    platform: "google",
    adGroupName: "Product Keywords",
    landingPageName: "Features Page",
    messageMatch: 91,
    ctr: 7.8,
    cpc: 1.60,
  },
  {
    id: "map-5",
    platform: "meta",
    adGroupName: "Lookalike Audience",
    landingPageName: "Pricing Page",
    messageMatch: 64,
    ctr: 3.2,
    cpc: 0.58,
  },
  {
    id: "map-6",
    platform: "linkedin",
    adGroupName: "HR Professionals",
    landingPageName: "Case Study - Fortune 500",
    messageMatch: 79,
    ctr: 5.3,
    cpc: 2.95,
  },
  {
    id: "map-7",
    platform: "google",
    adGroupName: "Competitor Keywords",
    landingPageName: "Why Choose Us",
    messageMatch: 85,
    ctr: 6.9,
    cpc: 1.85,
  },
  {
    id: "map-8",
    platform: "meta",
    adGroupName: "Video Engagement",
    landingPageName: "Product Demo Video",
    messageMatch: 88,
    ctr: 5.6,
    cpc: 0.72,
  },
];

// GET /lp/ad-map - Retrieve all ad mappings and stats
router.get("/lp/ad-map", async (_req, res): Promise<void> => {
  try {
    const avgMatch = Math.round(
      mockMappings.reduce((sum, m) => sum + m.messageMatch, 0) / mockMappings.length
    );

    const stats = {
      total: mockMappings.length,
      avgMatch,
      pagesWithoutAds: 3,
      adsWithoutPages: 2,
    };

    res.json({
      mappings: mockMappings,
      stats,
    });
  } catch (_err) {
    res.json({
      mappings: mockMappings,
      stats: {
        total: mockMappings.length,
        avgMatch: 82,
        pagesWithoutAds: 3,
        adsWithoutPages: 2,
      },
    });
  }
});

// POST /lp/ad-map - Create a new ad mapping
router.post("/lp/ad-map", async (req, res): Promise<void> => {
  try {
    const { platform, adGroupName, landingPageName, messageMatch, ctr, cpc } = req.body;

    if (!platform || !adGroupName || !landingPageName) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const newMapping: AdMapping = {
      id: `map-${Date.now()}`,
      platform,
      adGroupName,
      landingPageName,
      messageMatch: messageMatch ?? 75,
      ctr: ctr ?? 5,
      cpc: cpc ?? 1.5,
    };

    // In a real implementation, save to database
    mockMappings.push(newMapping);

    res.status(201).json({
      success: true,
      id: newMapping.id,
      mapping: newMapping,
    });
  } catch (_err) {
    res.status(500).json({
      success: false,
      error: "Failed to create ad mapping",
    });
  }
});

export default router;
