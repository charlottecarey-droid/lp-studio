import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Gauge,
  AlertTriangle,
  Image,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSpeedPanel } from "@/components/analytics/PageSpeedPanel";

const API_BASE = "/api";

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
  speedSource?: "measured" | "estimated";
  estimatedScore?: number;
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

interface Summary {
  total: number;
  passing: number;
  needsWork: number;
  failing: number;
  avgScore: number;
}

function getStatusColor(status: string) {
  if (status === "passing") return "bg-green-100 text-green-800";
  if (status === "needs-work") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function getStatusLabel(status: string) {
  if (status === "passing") return "Passing";
  if (status === "needs-work") return "Needs Work";
  return "Failing";
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getScoreRingColor(score: number) {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreRingColor(score);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        className="transform rotate-90" style={{ transformOrigin: "center", fontSize: size * 0.3 }}
        fill={color} fontWeight="bold"
      >
        {score}
      </text>
    </svg>
  );
}

function usePageSpeed() {
  const [pages, setPages] = useState<PageSpeedResult[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, passing: 0, needsWork: 0, failing: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/lp/page-speed`)
      .then(r => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then(data => {
        setPages(Array.isArray(data.pages) ? data.pages : []);
        setSummary(data.summary ?? { total: 0, passing: 0, needsWork: 0, failing: 0, avgScore: 0 });
      })
      .catch(() => setError("Could not load page speed data"))
      .finally(() => setLoading(false));
  }, []);

  return { pages, summary, loading, error };
}

export default function PageSpeed() {
  const { pages, summary, loading, error } = usePageSpeed();
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);

  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].pageId);
    }
  }, [pages, selectedPageId]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Page Speed</h1>
            <p className="text-slate-600 mt-2">Block-level performance analysis across all your landing pages</p>
          </div>

          {/* Summary Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-600 mb-1">Avg Score</p>
                  <p className={`text-3xl font-bold ${getScoreColor(summary.avgScore)}`}>{summary.avgScore}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-600 mb-1">Passing</p>
                  <p className="text-3xl font-bold text-green-600">{summary.passing}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-600 mb-1">Needs Work</p>
                  <p className="text-3xl font-bold text-yellow-600">{summary.needsWork}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-600 mb-1">Failing</p>
                  <p className="text-3xl font-bold text-red-600">{summary.failing}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-600 mb-1">Pages Analyzed</p>
                  <p className="text-3xl font-bold text-slate-900">{summary.total}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {error ? (
            <Card>
              <CardContent className="pt-8">
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">{error}</p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><Skeleton className="h-96 rounded-lg" /></div>
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : pages.length === 0 ? (
            <Card>
              <CardContent className="pt-8">
                <div className="text-center py-12">
                  <Gauge className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No pages to analyze</h3>
                  <p className="text-slate-500">Create some landing pages and they'll be analyzed automatically.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pages list */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="h-5 w-5" />
                      All Pages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[640px] overflow-y-auto">
                      {pages.map(page => (
                        <div
                          key={page.pageId}
                          onClick={() => setSelectedPageId(page.pageId)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedPageId === page.pageId
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <ScoreRing score={page.score} size={52} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-slate-900 truncate">{page.name}</h3>
                                <Badge className={getStatusColor(page.status)}>
                                  {getStatusLabel(page.status)}
                                </Badge>
                                {page.speedSource && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 font-normal ${
                                      page.speedSource === "measured"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-slate-100 text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    {page.speedSource === "measured" ? "measured" : "estimated"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">/{page.slug}</p>
                            </div>
                            <div className="flex gap-4 text-sm text-slate-600 shrink-0">
                              <div className="text-center" title="Blocks">
                                <Layers className="h-3.5 w-3.5 mx-auto mb-0.5 text-slate-400" />
                                <span>{page.blockCount}</span>
                              </div>
                              <div className="text-center" title="Images">
                                <Image className="h-3.5 w-3.5 mx-auto mb-0.5 text-slate-400" />
                                <span>{page.imageCount}</span>
                              </div>
                              <div className="text-center" title="Issues">
                                <AlertTriangle className="h-3.5 w-3.5 mx-auto mb-0.5 text-slate-400" />
                                <span>{page.issues.length}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detail panel — shared self-fetching component */}
              <div>
                {selectedPageId !== null ? (
                  <div className="space-y-3">
                    <Link href={`/analytics/pages/${selectedPageId}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        View page detail
                      </Button>
                    </Link>
                    <PageSpeedPanel pageId={selectedPageId} />
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-8">
                      <p className="text-slate-500 text-sm text-center py-8">
                        Select a page to see its performance breakdown
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
