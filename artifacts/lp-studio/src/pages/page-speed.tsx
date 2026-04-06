import { useState, useEffect } from "react";
import {
  Gauge,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Image,
  Code2,
  Layers,
  Play,
  Sparkles,
  Box,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

function getSeverityColor(severity: string) {
  if (severity === "critical") return "bg-red-100 text-red-800 border-red-200";
  if (severity === "warning") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function getSeverityIcon(severity: string) {
  if (severity === "critical") return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />;
  return <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />;
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

  const selectedPage = pages.find(p => p.pageId === selectedPageId);

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
            <h1 className="text-4xl font-bold text-slate-900">Page Speed</h1>
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

              {/* Detail panel */}
              <div>
                {selectedPage ? (
                  <div className="space-y-4">
                    {/* Score + breakdown */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg truncate">{selectedPage.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                          <ScoreRing score={selectedPage.score} size={80} />
                          <div>
                            <Badge className={getStatusColor(selectedPage.status)}>
                              {getStatusLabel(selectedPage.status)}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">~{selectedPage.estimatedDomNodes} DOM nodes</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <Layers className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                            <p className="font-bold text-slate-900">{selectedPage.blockCount}</p>
                            <p className="text-xs text-slate-500">blocks</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <Image className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                            <p className="font-bold text-slate-900">{selectedPage.imageCount}</p>
                            <p className="text-xs text-slate-500">images</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <Play className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                            <p className="font-bold text-slate-900">{selectedPage.videoCount}</p>
                            <p className="text-xs text-slate-500">videos</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <Code2 className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                            <p className="font-bold text-slate-900">{selectedPage.customHtmlCount}</p>
                            <p className="text-xs text-slate-500">custom HTML</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <Sparkles className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                            <p className="font-bold text-slate-900">{selectedPage.animatedBlocks}</p>
                            <p className="text-xs text-slate-500">animated</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                            <Box className="h-4 w-4 mx-auto text-slate-500 mb-1" />
                            <p className="font-bold text-slate-900">{selectedPage.formCount}</p>
                            <p className="text-xs text-slate-500">forms</p>
                          </div>
                        </div>

                        {selectedPage.heavyBlocks.length > 0 && (
                          <div className="mt-3 p-2.5 bg-red-50 rounded-lg">
                            <p className="text-xs font-medium text-red-800">
                              Heavy blocks: {selectedPage.heavyBlocks.join(", ")}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Issues */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Issues ({selectedPage.issues.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedPage.issues.length === 0 ? (
                          <div className="text-center py-6">
                            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-600">No issues detected</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[350px] overflow-y-auto">
                            {selectedPage.issues
                              .sort((a, b) => {
                                const order = { critical: 0, warning: 1, info: 2 };
                                return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                              })
                              .map((issue, idx) => (
                                <div key={idx} className={`flex gap-2 p-2.5 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                                  {getSeverityIcon(issue.severity)}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">{issue.category}</p>
                                    <p className="text-xs mt-0.5 opacity-80">{issue.message}</p>
                                    {issue.blockType && (
                                      <p className="text-xs mt-0.5 opacity-60">Block: {issue.blockType}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
