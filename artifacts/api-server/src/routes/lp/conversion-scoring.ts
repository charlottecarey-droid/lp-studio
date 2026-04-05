import { Router } from "express";

const router = Router();

interface ScoringCategory {
  name: string;
  score: number;
  grade: string;
  recommendation: string;
}

interface QuickWin {
  impact: "high" | "medium" | "low";
  suggestion: string;
}

interface ScoringResponse {
  pageId: string;
  overallScore: number;
  categories: ScoringCategory[];
  quickWins: QuickWin[];
  history: number[];
}

const mockScoringData: Record<string, ScoringResponse> = {
  "page-1": {
    pageId: "page-1",
    overallScore: 73,
    categories: [
      {
        name: "Headline Clarity",
        score: 82,
        grade: "B+",
        recommendation: "Add a specific benefit to your headline",
      },
      {
        name: "CTA Effectiveness",
        score: 65,
        grade: "C+",
        recommendation: "Use action-oriented language and increase button contrast",
      },
      {
        name: "Social Proof",
        score: 78,
        grade: "B",
        recommendation: "Add customer testimonials above the fold",
      },
      {
        name: "Form Friction",
        score: 71,
        grade: "C+",
        recommendation: "Reduce form fields from 6 to 3",
      },
      {
        name: "Visual Hierarchy",
        score: 75,
        grade: "B-",
        recommendation: "Increase contrast between section backgrounds",
      },
      {
        name: "Page Speed Impact",
        score: 68,
        grade: "C+",
        recommendation: "Optimize image sizes and lazy load below-fold content",
      },
      {
        name: "Mobile Responsiveness",
        score: 79,
        grade: "B",
        recommendation: "Improve touch target sizes on mobile devices",
      },
      {
        name: "Trust Signals",
        score: 70,
        grade: "C",
        recommendation: "Add security badges and customer count badge",
      },
    ],
    quickWins: [
      { impact: "high", suggestion: "Add a customer testimonial above the fold" },
      { impact: "high", suggestion: "Reduce form fields from 6 to 3" },
      { impact: "medium", suggestion: "Add a trust badge near the CTA button" },
    ],
    history: [68, 70, 71, 72, 73],
  },
  "page-2": {
    pageId: "page-2",
    overallScore: 82,
    categories: [
      {
        name: "Headline Clarity",
        score: 90,
        grade: "A",
        recommendation: "Excellent headline clarity and focus",
      },
      {
        name: "CTA Effectiveness",
        score: 85,
        grade: "B+",
        recommendation: "Strong CTA but test different button colors",
      },
      {
        name: "Social Proof",
        score: 88,
        grade: "A-",
        recommendation: "Great use of customer testimonials",
      },
      {
        name: "Form Friction",
        score: 80,
        grade: "B",
        recommendation: "Form is well optimized",
      },
      {
        name: "Visual Hierarchy",
        score: 82,
        grade: "B+",
        recommendation: "Good visual hierarchy, consider stronger CTAs",
      },
      {
        name: "Page Speed Impact",
        score: 78,
        grade: "B",
        recommendation: "Page loads quickly, monitor for regressions",
      },
      {
        name: "Mobile Responsiveness",
        score: 84,
        grade: "B+",
        recommendation: "Excellent mobile experience",
      },
      {
        name: "Trust Signals",
        score: 82,
        grade: "B+",
        recommendation: "Good trust signals, add pricing transparency",
      },
    ],
    quickWins: [
      { impact: "high", suggestion: "A/B test button colors for higher contrast" },
      { impact: "medium", suggestion: "Add pricing transparency section" },
      { impact: "low", suggestion: "Add more customer case studies" },
    ],
    history: [75, 78, 80, 81, 82],
  },
  "page-3": {
    pageId: "page-3",
    overallScore: 58,
    categories: [
      {
        name: "Headline Clarity",
        score: 45,
        grade: "D+",
        recommendation: "Headline is too generic and vague",
      },
      {
        name: "CTA Effectiveness",
        score: 52,
        grade: "D",
        recommendation: "CTA button is barely visible",
      },
      {
        name: "Social Proof",
        score: 48,
        grade: "D+",
        recommendation: "Missing customer testimonials and reviews",
      },
      {
        name: "Form Friction",
        score: 62,
        grade: "D+",
        recommendation: "Form has too many required fields",
      },
      {
        name: "Visual Hierarchy",
        score: 55,
        grade: "D",
        recommendation: "Visual hierarchy is unclear and confusing",
      },
      {
        name: "Page Speed Impact",
        score: 51,
        grade: "D",
        recommendation: "Page loads slowly, optimize images",
      },
      {
        name: "Mobile Responsiveness",
        score: 59,
        grade: "D+",
        recommendation: "Mobile experience needs improvement",
      },
      {
        name: "Trust Signals",
        score: 54,
        grade: "D",
        recommendation: "Missing security and trust badges",
      },
    ],
    quickWins: [
      { impact: "high", suggestion: "Rewrite headline to focus on main benefit" },
      { impact: "high", suggestion: "Make CTA button more prominent" },
      { impact: "high", suggestion: "Add customer testimonials and trust badges" },
    ],
    history: [55, 56, 57, 58, 58],
  },
  "page-4": {
    pageId: "page-4",
    overallScore: 91,
    categories: [
      {
        name: "Headline Clarity",
        score: 95,
        grade: "A+",
        recommendation: "Outstanding headline with clear value proposition",
      },
      {
        name: "CTA Effectiveness",
        score: 92,
        grade: "A",
        recommendation: "Highly effective CTA with strong contrast",
      },
      {
        name: "Social Proof",
        score: 94,
        grade: "A",
        recommendation: "Excellent use of testimonials and social proof",
      },
      {
        name: "Form Friction",
        score: 90,
        grade: "A-",
        recommendation: "Optimally designed form with minimal friction",
      },
      {
        name: "Visual Hierarchy",
        score: 92,
        grade: "A",
        recommendation: "Perfect visual hierarchy guides user journey",
      },
      {
        name: "Page Speed Impact",
        score: 88,
        grade: "A-",
        recommendation: "Excellent page speed performance",
      },
      {
        name: "Mobile Responsiveness",
        score: 91,
        grade: "A",
        recommendation: "Outstanding mobile experience",
      },
      {
        name: "Trust Signals",
        score: 90,
        grade: "A-",
        recommendation: "Comprehensive trust signals throughout",
      },
    ],
    quickWins: [
      { impact: "low", suggestion: "Consider testing multi-step form flow" },
      { impact: "low", suggestion: "Add video testimonial section" },
      { impact: "low", suggestion: "Expand case studies section" },
    ],
    history: [85, 88, 90, 91, 91],
  },
  "page-5": {
    pageId: "page-5",
    overallScore: 76,
    categories: [
      {
        name: "Headline Clarity",
        score: 80,
        grade: "B",
        recommendation: "Clear headline but could be more specific",
      },
      {
        name: "CTA Effectiveness",
        score: 72,
        grade: "C+",
        recommendation: "CTA needs stronger urgency messaging",
      },
      {
        name: "Social Proof",
        score: 75,
        grade: "B-",
        recommendation: "Add more recent customer reviews",
      },
      {
        name: "Form Friction",
        score: 77,
        grade: "B",
        recommendation: "Form is acceptable, consider progressive profiling",
      },
      {
        name: "Visual Hierarchy",
        score: 76,
        grade: "B-",
        recommendation: "Good structure but needs better spacing",
      },
      {
        name: "Page Speed Impact",
        score: 73,
        grade: "C+",
        recommendation: "Optimize third-party scripts",
      },
      {
        name: "Mobile Responsiveness",
        score: 80,
        grade: "B",
        recommendation: "Mobile experience is solid",
      },
      {
        name: "Trust Signals",
        score: 74,
        grade: "C+",
        recommendation: "Add more credibility indicators",
      },
    ],
    quickWins: [
      { impact: "high", suggestion: "Add urgency messaging to CTA" },
      { impact: "medium", suggestion: "Include fresh customer testimonials" },
      { impact: "medium", suggestion: "Optimize third-party scripts" },
    ],
    history: [72, 73, 74, 75, 76],
  },
  "page-6": {
    pageId: "page-6",
    overallScore: 66,
    categories: [
      {
        name: "Headline Clarity",
        score: 72,
        grade: "C+",
        recommendation: "Headline is decent but lacks emotional appeal",
      },
      {
        name: "CTA Effectiveness",
        score: 60,
        grade: "D+",
        recommendation: "CTA button is not prominent enough",
      },
      {
        name: "Social Proof",
        score: 68,
        grade: "C",
        recommendation: "Limited social proof elements",
      },
      {
        name: "Form Friction",
        score: 65,
        grade: "C",
        recommendation: "Form fields could be better organized",
      },
      {
        name: "Visual Hierarchy",
        score: 68,
        grade: "C",
        recommendation: "Needs better visual organization",
      },
      {
        name: "Page Speed Impact",
        score: 62,
        grade: "D+",
        recommendation: "Consider image optimization",
      },
      {
        name: "Mobile Responsiveness",
        score: 70,
        grade: "C+",
        recommendation: "Mobile version could be improved",
      },
      {
        name: "Trust Signals",
        score: 64,
        grade: "D+",
        recommendation: "Add trust badges and security icons",
      },
    ],
    quickWins: [
      { impact: "high", suggestion: "Make CTA button more prominent" },
      { impact: "medium", suggestion: "Add social proof elements" },
      { impact: "medium", suggestion: "Optimize images for faster loading" },
    ],
    history: [62, 63, 64, 65, 66],
  },
};

// GET /lp/conversion-scoring/:pageId
router.get("/lp/conversion-scoring/:pageId", async (req, res): Promise<void> => {
  const pageId = String(req.params.pageId);
  const data = mockScoringData[pageId] || mockScoringData["page-1"];
  res.json(data);
});

// POST /lp/conversion-scoring/:pageId/analyze
router.post("/lp/conversion-scoring/:pageId/analyze", async (req, res): Promise<void> => {
  const pageId = String(req.params.pageId);
  const currentData = mockScoringData[pageId] || mockScoringData["page-1"];
  const newScore = Math.min(100, currentData.overallScore + Math.floor(Math.random() * 5) + 1);
  res.json({ success: true, score: newScore });
});

export default router;
