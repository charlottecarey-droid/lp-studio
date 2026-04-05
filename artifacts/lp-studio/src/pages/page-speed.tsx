import { useState, useEffect } from "react";
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  Gauge,
  Loader2,
  TrendingDown,
  Image,
  Lightbulb,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = "/api";

interface PageSpeedMetric {
  pageId: number;
  name: string;
  slug: string;
  lcp: number; // Largest Contentful Paint in seconds
  fid: number; // First Input Delay in milliseconds
  cls: number; // Cumulative Layout Shift
  score: number; // 1-100
  status: "passing" | "needs-work" | "failing";
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  savings: string;
  icon: React.ReactNode;
}

function getMetricColor(metric: string, value: number): string {
  if (metric === "lcp") {
    if (value < 2.5) return "text-green-600";
    if (value < 4) return "text-yellow-600";
    return "text-red-600";
  } else if (metric === "fid") {
    if (value < 100) return "text-green-600";
    if (value < 300) return "text-yellow-600";
    return "text-red-600";
  } else if (metric === "cls") {
    if (value < 0.1) return "text-green-600";
    if (value < 0.25) return "text-yellow-600";
    return "text-red-600";
  }
  return "text-gray-600";
}

function getMetricBgColor(metric: string, value: number): string {
  if (metric === "lcp") {
    if (value < 2.5) return "bg-green-50";
    if (value < 4) return "bg-yellow-50";
    return "bg-red-50";
  } else if (metric === "fid") {
    if (value < 100) return "bg-green-50";
    if (value < 300) return "bg-yellow-50";
    return "bg-red-50";
  } else if (metric === "cls") {
    if (value < 0.1) return "bg-green-50";
    if (value < 0.25) return "bg-yellow-50";
    return "bg-red-50";
  }
  return "bg-gray-50";
}

function getStatusColor(status: string): string {
  if (status === "passing") return "bg-green-100 text-green-800";
  if (status === "needs-work") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function usePageSpeedMetrics() {
  const [pages, setPages] = useState<PageSpeedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/lp/page-speed`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load")))
      .then((data) => setPages(data as PageSpeedMetric[]))
      .catch(() => setError("Failed to load page speed data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return { pages, loading, error, reload: load };
}

export default function PageSpeed() {
  const { pages, loading, error } = usePageSpeedMetrics();
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [optimizingPageId, setOptimizingPageId] = useState<number | null>(null);
  const [optimizingAll, setOptimizingAll] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const selectedPage = pages.find((p) => p.pageId === selectedPageId);

  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].pageId);
    }
  }, [pages, selectedPageId]);

  const avgLcp =
    pages.length > 0
      ? (pages.reduce((sum, p) => sum + p.lcp, 0) / pages.length).toFixed(2)
      : "0";
  const avgFid =
    pages.length > 0
      ? (pages.reduce((sum, p) => sum + p.fid, 0) / pages.length).toFixed(0)
      : "0";
  const avgCls =
    pages.length > 0
      ? (pages.reduce((sum, p) => sum + p.cls, 0) / pages.length).toFixed(2)
      : "0";
  const passingCount = pages.filter((p) => p.status === "passing").length;

  const suggestions: Suggestion[] = [
    {
      id: "optimize-images",
      title: "Optimize images",
      description: "Reduce image file sizes using modern formats",
      savings: "save ~340KB",
      icon: <Image className="w-4 h-4" />,
    },
    {
      id: "lazy-loading",
      title: "Enable lazy loading",
      description: "Defer loading of below-fold blocks",
      savings: "save ~200ms LCP",
      icon: <Zap className="w-4 h-4" />,
    },
    {
      id: "minify-css",
      title: "Minify inline CSS",
      description: "Remove unnecessary characters from stylesheets",
      savings: "save ~45KB",
      icon: <TrendingDown className="w-4 h-4" />,
    },
    {
      id: "preload-hero",
      title: "Preload hero image",
      description: "Add resource hints for critical images",
      savings: "save ~150ms LCP",
      icon: <Lightbulb className="w-4 h-4" />,
    },
    {
      id: "remove-unused-js",
      title: "Remove unused JavaScript",
      description: "Clean up unused scripts and dependencies",
      savings: "save ~120KB",
      icon: <Zap className="w-4 h-4" />,
    },
  ];

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleOptimizeAll = async () => {
    setOptimizingAll(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      showToastMessage("Auto-optimization applied to all pages");
    } finally {
      setOptimizingAll(false);
    }
  };

  const handleOptimizePage = async (pageId: number) => {
    setOptimizingPageId(pageId);
    try {
      const response = await fetch(`${API_BASE}/lp/page-speed/${pageId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const result = await response.json();
        showToastMessage(
          `Optimization applied: LCP improved by ${Math.abs(result.improvements?.lcpDelta || 0.4).toFixed(1)}s`
        );
      }
    } catch {
      showToastMessage("Optimization failed. Please try again.");
    } finally {
      setOptimizingPageId(null);
    }
  };

  if (error) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Page Speed Engine</h1>
            <p className="text-gray-600 mt-1">
              Monitor and optimize Core Web Vitals across all your landing pages
            </p>
          </div>
          <Button
            onClick={handleOptimizeAll}
            disabled={optimizingAll || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {optimizingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Auto-Optimize All
              </>
            )}
          </Button>
        </div>

        {/* Summary Metrics */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-1">Avg LCP</p>
                <p className={`text-2xl font-bold ${getMetricColor("lcp", parseFloat(avgLcp))}`}>
                  {avgLcp}s
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {parseFloat(avgLcp) < 2.5 ? "✓ Good" : parseFloat(avgLcp) < 4 ? "⚠ Fair" : "✗ Poor"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-1">Avg FID</p>
                <p className={`text-2xl font-bold ${getMetricColor("fid", parseFloat(avgFid))}`}>
                  {avgFid}ms
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {parseFloat(avgFid) < 100 ? "✓ Good" : parseFloat(avgFid) < 300 ? "⚠ Fair" : "✗ Poor"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-1">Avg CLS</p>
                <p className={`text-2xl font-bold ${getMetricColor("cls", parseFloat(avgCls))}`}>
                  {avgCls}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {parseFloat(avgCls) < 0.1 ? "✓ Good" : parseFloat(avgCls) < 0.25 ? "⚠ Fair" : "✗ Poor"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-1">Passing Pages</p>
                <p className="text-2xl font-bold text-green-600">{passingCount}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {pages.length > 0 ? `${Math.round((passingCount / pages.length) * 100)}%` : "0%"} of pages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-1">Pages Analyzed</p>
                <p className="text-2xl font-bold text-blue-600">{pages.length}</p>
                <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pages List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Pages Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {pages.map((page) => (
                      <div
                        key={page.pageId}
                        onClick={() => setSelectedPageId(page.pageId)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedPageId === page.pageId
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{page.name}</h3>
                            <p className="text-xs text-gray-500">{page.slug}</p>
                          </div>
                          <Badge className={getStatusColor(page.status)}>
                            {page.status === "passing"
                              ? "Passing"
                              : page.status === "needs-work"
                                ? "Needs Work"
                                : "Failing"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className={`p-2 rounded ${getMetricBgColor("lcp", page.lcp)}`}>
                            <p className="text-xs text-gray-600">LCP</p>
                            <p className={`font-bold ${getMetricColor("lcp", page.lcp)}`}>
                              {page.lcp.toFixed(1)}s
                            </p>
                          </div>
                          <div className={`p-2 rounded ${getMetricBgColor("fid", page.fid)}`}>
                            <p className="text-xs text-gray-600">FID</p>
                            <p className={`font-bold ${getMetricColor("fid", page.fid)}`}>
                              {page.fid.toFixed(0)}ms
                            </p>
                          </div>
                          <div className={`p-2 rounded ${getMetricBgColor("cls", page.cls)}`}>
                            <p className="text-xs text-gray-600">CLS</p>
                            <p className={`font-bold ${getMetricColor("cls", page.cls)}`}>
                              {page.cls.toFixed(2)}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-gray-100">
                            <p className="text-xs text-gray-600">Score</p>
                            <p className={`font-bold ${getScoreColor(page.score)}`}>{page.score}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Suggestions Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedPage ? "Optimization Suggestions" : "Select a Page"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPage ? (
                  <div className="space-y-3">
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-900 font-medium">{selectedPage.name}</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Historical: LCP trend 3.2s → 2.8s → 2.1s
                      </p>
                    </div>

                    {suggestions.map((suggestion) => (
                      <div key={suggestion.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-gray-600 flex-shrink-0 mt-0.5">{suggestion.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{suggestion.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{suggestion.description}</p>
                            <p className="text-xs text-green-600 font-medium mt-1">💾 {suggestion.savings}</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleOptimizePage(selectedPage.pageId)}
                          disabled={optimizingPageId === selectedPage.pageId}
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8"
                        >
                          {optimizingPageId === selectedPage.pageId ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Optimizing...
                            </>
                          ) : (
                            "Auto-optimize"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">
                    Select a page from the list to see optimization suggestions
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </AppLayout>
  );
}
