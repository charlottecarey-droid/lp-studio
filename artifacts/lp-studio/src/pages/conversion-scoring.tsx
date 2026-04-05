import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target,
  RefreshCw,
  Zap,
  Eye,
  MessageSquare,
  FileText,
  Smartphone,
  Shield,
  TrendingUp,
  BarChart2,
  Layers,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PageOption {
  id: number;
  title: string;
  slug: string;
  status: string;
}

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

interface ScoringResult {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  overallScore: number;
  totalVisits: number;
  conversions: number;
  impressions: number;
  cvr: number;
  leadCount: number;
  categories: ScoringCategory[];
  quickWins: QuickWin[];
  metrics: {
    avgScrollDepth: number;
    clicksPerSession: number;
    blockCount: number;
  };
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Headline Clarity": Eye,
  "CTA Effectiveness": Target,
  "Social Proof": MessageSquare,
  "Form Friction": FileText,
  "Visual Hierarchy": Layers,
  "Page Speed Impact": Zap,
  "Mobile Responsiveness": Smartphone,
  "Trust Signals": Shield,
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
  if (score >= 60) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (grade.startsWith("B")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (grade.startsWith("C")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

// Circular score ring
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function ConversionScoring() {
  const { toast } = useToast();
  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingScore, setLoadingScore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load pages list
  useEffect(() => {
    fetch("/api/lp/conversion-scoring/pages")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PageOption[]>;
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPages(list);
        if (list.length > 0) setSelectedPageId(list[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPages(false));
  }, []);

  // Load score when page changes
  useEffect(() => {
    if (selectedPageId === null) return;
    setLoadingScore(true);
    setError(null);
    fetch(`/api/lp/conversion-scoring/${selectedPageId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ScoringResult>;
      })
      .then((data) => setResult(data))
      .catch((err) => {
        setError(err.message);
        setResult(null);
      })
      .finally(() => setLoadingScore(false));
  }, [selectedPageId]);

  const handleReanalyze = () => {
    if (selectedPageId === null) return;
    setLoadingScore(true);
    fetch(`/api/lp/conversion-scoring/${selectedPageId}`)
      .then((r) => r.json() as Promise<ScoringResult>)
      .then((data) => {
        setResult(data);
        toast({ title: "Analysis updated", description: `Score: ${data.overallScore}/100` });
      })
      .catch(() => toast({ title: "Analysis failed", variant: "destructive" }))
      .finally(() => setLoadingScore(false));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Conversion Scoring</h1>
            <p className="text-muted-foreground">
              Analyze your landing pages' conversion potential based on real visitor data and page structure
            </p>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={handleReanalyze} disabled={loadingScore}>
              {loadingScore ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Re-analyze
            </Button>
          )}
        </div>

        {/* Page Selector */}
        {loadingPages ? (
          <Skeleton className="h-10 w-full max-w-sm" />
        ) : pages.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No pages found. Create a landing page first to analyze it.</p>
          </Card>
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Analyze page:</label>
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-background max-w-md flex-1"
              value={selectedPageId ?? ""}
              onChange={(e) => setSelectedPageId(Number(e.target.value))}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.slug}) — {p.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading */}
        {loadingScore && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6"><Skeleton className="h-32 w-full" /></Card>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loadingScore && (
          <Card className="p-6 text-center">
            <p className="text-destructive">{error}</p>
          </Card>
        )}

        {/* Results */}
        {result && !loadingScore && (
          <>
            {/* Score + Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Overall Score */}
              <Card className="p-6 flex flex-col items-center justify-center">
                <p className="text-sm font-medium text-muted-foreground mb-3">Overall Score</p>
                <ScoreRing score={result.overallScore} />
              </Card>

              {/* Key Metrics */}
              <Card className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-4">Traffic</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total visits</span>
                    <span className="font-semibold">{result.totalVisits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impressions</span>
                    <span className="font-semibold">{result.impressions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Conversions</span>
                    <span className="font-semibold">{result.conversions.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-4">Conversion</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CVR</span>
                    <span className={`font-semibold ${scoreColor(result.cvr > 3 ? 80 : result.cvr > 1 ? 60 : 30)}`}>{result.cvr}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Leads</span>
                    <span className="font-semibold">{result.leadCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Blocks</span>
                    <span className="font-semibold">{result.metrics.blockCount}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-4">Engagement</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg scroll depth</span>
                    <span className="font-semibold">{result.metrics.avgScrollDepth}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Clicks/session</span>
                    <span className="font-semibold">{result.metrics.clicksPerSession}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Wins */}
            {result.quickWins.length > 0 && (
              <Card className="p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Quick Wins
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-3">
                  {result.quickWins.map((win, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <Badge
                        variant="outline"
                        className={
                          win.impact === "high"
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                        }
                      >
                        {win.impact}
                      </Badge>
                      <span>{win.suggestion}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Category Breakdown Grid */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.name] || BarChart2;
                  return (
                    <Card key={cat.name} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${scoreBg(cat.score)}`}>
                          <Icon className={`h-4 w-4 ${scoreColor(cat.score)}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{cat.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${scoreColor(cat.score)}`}>{cat.score}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${gradeColor(cat.grade)}`}>
                                {cat.grade}
                              </Badge>
                            </div>
                          </div>
                          {/* Score bar */}
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                cat.score >= 80 ? "bg-green-500" : cat.score >= 60 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${cat.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">{cat.recommendation}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
