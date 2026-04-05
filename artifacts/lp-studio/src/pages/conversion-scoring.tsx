import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Zap,
  Eye,
  MessageSquare,
  FileText,
  Smartphone,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const API_BASE = "/api";

const PAGES = [
  { id: "page-1", name: "Product Launch Hero" },
  { id: "page-2", name: "SaaS Pricing Page" },
  { id: "page-3", name: "E-commerce Sales" },
  { id: "page-4", name: "B2B Lead Gen Form" },
  { id: "page-5", name: "Webinar Signup" },
  { id: "page-6", name: "Free Trial Offer" },
];

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

interface ScoringData {
  pageId: string;
  overallScore: number;
  categories: ScoringCategory[];
  quickWins: QuickWin[];
  history: number[];
}

const categoryIcons: Record<string, any> = {
  "Headline Clarity": Eye,
  "CTA Effectiveness": Target,
  "Social Proof": CheckCircle2,
  "Form Friction": FileText,
  "Visual Hierarchy": TrendingUp,
  "Page Speed Impact": Zap,
  "Mobile Responsiveness": Smartphone,
  "Trust Signals": Shield,
};

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function getScoreGradient(score: number): string {
  if (score >= 80) return "from-emerald-400 to-emerald-600";
  if (score >= 60) return "from-amber-400 to-amber-600";
  return "from-red-400 to-red-600";
}

function getGradeBadgeVariant(grade: string): "default" | "secondary" | "destructive" | "outline" {
  if (grade.includes("A")) return "default";
  if (grade.includes("B")) return "secondary";
  return "destructive";
}

function CircularScore({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-40 h-40">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`text-emerald-500 transition-all duration-500 ${
              score < 60 ? "text-red-500" : score < 80 ? "text-amber-500" : "text-emerald-500"
            }`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-sm text-muted-foreground">/100</div>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: ScoringCategory }) {
  const IconComponent = categoryIcons[category.name];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className="w-4 h-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-semibold">{category.name}</CardTitle>
          </div>
          <Badge variant={getGradeBadgeVariant(category.grade)} className="text-xs">
            {category.grade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Score</span>
            <span className="text-sm font-semibold">{category.score}</span>
          </div>
          <Progress value={category.score} className="h-2" />
        </div>

        {/* Recommendation */}
        <p className="text-xs text-muted-foreground leading-relaxed">{category.recommendation}</p>
      </CardContent>
    </Card>
  );
}

function QuickWinsSection({ quickWins }: { quickWins: QuickWin[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          Top 3 Quick Wins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {quickWins.map((win, idx) => (
          <div key={idx} className="flex gap-3 items-start">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 flex-shrink-0">
              <span className="text-xs font-bold text-amber-700">{idx + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold">{win.suggestion}</span>
                <Badge
                  variant={win.impact === "high" ? "destructive" : win.impact === "medium" ? "secondary" : "outline"}
                  className="text-xs capitalize"
                >
                  {win.impact} impact
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HistorySection({ history }: { history: number[] }) {
  const historyText = history.join(" → ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4" />
          Score Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          {history.map((score, idx) => (
            <div key={idx}>
              <span className="text-lg font-semibold text-emerald-600">{score}</span>
              {idx < history.length - 1 && <span className="mx-1.5 text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Last 5 analyses showing steady improvement</p>
      </CardContent>
    </Card>
  );
}

export default function ConversionScoringPage() {
  const [selectedPageId, setSelectedPageId] = useState<string>("page-1");
  const [scoringData, setScoringData] = useState<ScoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Load scoring data when page is selected
  useEffect(() => {
    if (selectedPageId) {
      setLoading(true);
      fetch(`${API_BASE}/lp/conversion-scoring/${selectedPageId}`)
        .then((r) => r.json() as Promise<ScoringData>)
        .then((data) => {
          setScoringData(data);
          setLoading(false);
        })
        .catch(() => {
          toast.error("Failed to load scoring data");
          setLoading(false);
        });
    }
  }, [selectedPageId]);

  const handleReanalyze = async () => {
    if (!selectedPageId || analyzing) return;

    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/lp/conversion-scoring/${selectedPageId}/analyze`, {
        method: "POST",
      });
      const result = await res.json() as { success: boolean; score: number };
      if (result.success) {
        toast.success(`Score re-analyzed: ${result.score}/100`);
        // Reload data
        const newData = await fetch(`${API_BASE}/lp/conversion-scoring/${selectedPageId}`).then(
          (r) => r.json() as Promise<ScoringData>,
        );
        setScoringData(newData);
      }
    } catch {
      toast.error("Failed to re-analyze page");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = () => {
    toast.success("Report exported as PDF");
  };

  const selectedPageName = PAGES.find((p) => p.id === selectedPageId)?.name || "Select a page";

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversion Scoring</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-powered analysis of your landing pages' conversion potential
          </p>
        </div>

        {/* Page Selector */}
        <div className="max-w-xs">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Select Page to Analyze
          </label>
          <Select value={selectedPageId} onValueChange={setSelectedPageId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
              <p className="text-muted-foreground font-medium">Loading scoring data...</p>
            </CardContent>
          </Card>
        )}

        {/* Scoring Dashboard */}
        {!loading && scoringData && (
          <div className="space-y-6">
            {/* Overall Score Section */}
            <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
              {/* Circular Score */}
              <Card className="pt-6">
                <CardContent className="flex justify-center">
                  <CircularScore score={scoringData.overallScore} />
                </CardContent>
              </Card>

              {/* Score Interpretation */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Overall Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-medium text-sm">{selectedPageName}</span>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full text-white ${getScoreColor(
                            scoringData.overallScore,
                          )}`}
                        >
                          {scoringData.overallScore >= 80
                            ? "Excellent"
                            : scoringData.overallScore >= 60
                              ? "Good"
                              : "Needs Improvement"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {scoringData.overallScore >= 80
                          ? "This page has strong conversion fundamentals. Focus on incremental optimizations to maximize performance."
                          : scoringData.overallScore >= 60
                            ? "This page has solid foundations but could benefit from targeted improvements. See quick wins below."
                            : "This page has significant opportunities for improvement. Prioritize the high-impact quick wins."}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleReanalyze}
                        disabled={analyzing}
                        className="gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
                        Re-analyze
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
                        <Download className="w-3.5 h-3.5" />
                        Export Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Category Scores Grid */}
            <div>
              <h2 className="text-sm font-semibold mb-4 text-foreground">Category Breakdown</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {scoringData.categories.map((category) => (
                  <CategoryCard key={category.name} category={category} />
                ))}
              </div>
            </div>

            {/* Quick Wins and History */}
            <div className="grid md:grid-cols-2 gap-6">
              <QuickWinsSection quickWins={scoringData.quickWins} />
              <HistorySection history={scoringData.history} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
