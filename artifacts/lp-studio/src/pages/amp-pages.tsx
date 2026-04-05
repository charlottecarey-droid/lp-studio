import { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Smartphone,
  Globe,
  Loader2,
  Eye,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";

interface AmpPage {
  pageId: number;
  name: string;
  ampEnabled: boolean;
  ampStatus: "valid" | "warnings" | "errors" | "not-generated";
  ampLoadTime: number;
  regularLoadTime: number;
  lastValidated: string;
  warnings?: number;
  errors?: number;
  mobileTraffic?: number;
}

interface ValidationResult {
  type: "pass" | "warning" | "error";
  message: string;
  details?: string;
}

interface ValidationResponse {
  pageId: number;
  valid: boolean;
  warnings: ValidationResult[];
  errors: ValidationResult[];
  completedAt?: string;
}

function getStatusColor(status: string): string {
  if (status === "valid") return "bg-green-100 text-green-800";
  if (status === "warnings") return "bg-yellow-100 text-yellow-800";
  if (status === "errors") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

function getStatusIcon(status: string): React.ReactNode {
  if (status === "valid")
    return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "warnings")
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  if (status === "errors")
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  return <Smartphone className="w-4 h-4 text-gray-500" />;
}

function calculateSpeedImprovement(
  ampLoadTime: number,
  regularLoadTime: number
): number {
  return Math.round(
    ((regularLoadTime - ampLoadTime) / regularLoadTime) * 100
  );
}

export default function AmpPages() {
  const [pages, setPages] = useState<AmpPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [selectedPageValidation, setSelectedPageValidation] = useState<
    ValidationResponse | null
  >(null);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Load AMP pages
  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/lp/amp-pages`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load")))
      .then((data) => setPages(data as AmpPage[]))
      .catch(() => setError("Failed to load AMP pages"))
      .finally(() => setLoading(false));
  };

  const toggleAmp = async (pageId: number, newState: boolean) => {
    if (!newState) {
      // If toggling off, just update locally
      setPages(
        pages.map((p) =>
          p.pageId === pageId
            ? {
                ...p,
                ampEnabled: false,
                ampStatus: "not-generated" as const,
              }
            : p
        )
      );
      setShowToast("AMP disabled for this page");
      return;
    }

    // Toggling on: generate AMP
    setTogglingId(pageId);
    try {
      const response = await fetch(
        `${API_BASE}/lp/amp-pages/${pageId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Failed to generate AMP");

      const result = await response.json();

      // Update the page with new AMP data
      setPages(
        pages.map((p) =>
          p.pageId === pageId
            ? {
                ...p,
                ampEnabled: true,
                ampLoadTime: result.ampLoadTime || p.ampLoadTime * 0.7,
                ampStatus: "valid" as const,
                lastValidated: new Date().toISOString(),
              }
            : p
        )
      );

      setShowToast("AMP version generated successfully");
    } catch (err) {
      setShowToast("Failed to generate AMP version");
    } finally {
      setTogglingId(null);
    }
  };

  const validateAmp = async (pageId: number) => {
    if (!pages.find((p) => p.pageId === pageId)?.ampEnabled) {
      setShowToast("Please enable AMP first");
      return;
    }

    setValidatingId(pageId);
    try {
      const response = await fetch(
        `${API_BASE}/lp/amp-pages/${pageId}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Failed to validate AMP");

      const result = (await response.json()) as ValidationResponse;
      setSelectedPageValidation({
        ...result,
        pageId,
      });

      // Update page status based on validation
      setPages(
        pages.map((p) => {
          if (p.pageId === pageId) {
            const status =
              result.errors.length > 0
                ? ("errors" as const)
                : result.warnings.length > 0
                  ? ("warnings" as const)
                  : ("valid" as const);
            return {
              ...p,
              ampStatus: status,
              warnings: result.warnings.length,
              errors: result.errors.length,
              lastValidated: new Date().toISOString(),
            };
          }
          return p;
        })
      );

      setShowToast("AMP validation complete");
    } catch (err) {
      setShowToast("Failed to validate AMP");
    } finally {
      setValidatingId(null);
    }
  };

  const generateAllAmp = async () => {
    const disabledPages = pages.filter((p) => !p.ampEnabled);
    if (disabledPages.length === 0) {
      setShowToast("All pages already have AMP enabled");
      return;
    }

    setGeneratingAll(true);
    try {
      for (const page of disabledPages) {
        await toggleAmp(page.pageId, true);
        // Small delay between requests
        await new Promise((r) => setTimeout(r, 300));
      }
      setShowToast(
        `Generated AMP for ${disabledPages.length} page${disabledPages.length > 1 ? "s" : ""}`
      );
    } finally {
      setGeneratingAll(false);
    }
  };

  // Calculate stats
  const totalAmp = pages.filter((p) => p.ampEnabled).length;
  const avgLoadTime =
    pages.length > 0
      ? (
          pages.reduce((sum, p) => sum + p.ampLoadTime, 0) / pages.length
        ).toFixed(2)
      : "0";
  const validPages = pages.filter(
    (p) => p.ampEnabled && p.ampStatus === "valid"
  ).length;
  const mobileTrafficPct =
    pages.length > 0
      ? Math.round(
          pages.reduce((sum, p) => sum + (p.mobileTraffic || 0), 0) /
            pages.length
        )
      : 0;

  // Mock toast display
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showToast]);

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">
        {/* Toast notification */}
        {showToast && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
            <Zap className="w-4 h-4" />
            {showToast}
          </div>
        )}

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">AMP Pages</h1>
              <p className="text-gray-600 text-sm">
                Create lightning-fast Accelerated Mobile Pages for your landing
                pages
              </p>
            </div>
          </div>
        </div>

        {/* Benefits Card */}
        <Alert className="border-blue-200 bg-blue-50">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 font-medium">
            AMP pages load 4x faster on mobile, improving Quality Score and
            reducing bounce rate. Enable AMP on all your high-traffic landing
            pages for maximum impact.
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {totalAmp}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  AMP Pages Enabled
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {avgLoadTime}s
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Avg Load Time
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">
                  {validPages}
                </div>
                <p className="text-sm text-gray-600 mt-1">Valid AMP Pages</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {mobileTrafficPct}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Mobile Traffic</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generate All Button */}
        <div className="flex justify-end">
          <Button
            onClick={generateAllAmp}
            disabled={generatingAll || pages.filter((p) => !p.ampEnabled).length === 0}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {generatingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Generate All AMP Pages
              </>
            )}
          </Button>
        </div>

        {/* Pages Table */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                Landing Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Page Name
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">
                        AMP Enabled
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        AMP Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Load Time (AMP vs Regular)
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Improvement
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Last Validated
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pages.map((page) => (
                      <tr key={page.pageId} className="hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <span className="font-medium text-gray-900">
                            {page.name}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Switch
                            checked={page.ampEnabled}
                            onCheckedChange={(checked) =>
                              toggleAmp(page.pageId, checked)
                            }
                            disabled={togglingId === page.pageId}
                          />
                          {togglingId === page.pageId && (
                            <div className="mt-1">
                              <Loader2 className="w-3 h-3 animate-spin mx-auto text-blue-600" />
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(page.ampStatus)}
                            <Badge
                              className={getStatusColor(page.ampStatus)}
                              variant="secondary"
                            >
                              {page.ampStatus.charAt(0).toUpperCase() +
                                page.ampStatus.slice(1)}
                            </Badge>
                            {page.warnings !== undefined && page.warnings > 0 && (
                              <span className="text-xs text-gray-600">
                                {page.warnings} warning{page.warnings > 1 ? "s" : ""}
                              </span>
                            )}
                            {page.errors !== undefined && page.errors > 0 && (
                              <span className="text-xs text-red-600 font-medium">
                                {page.errors} error{page.errors > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-900 font-medium">
                            {page.ampLoadTime.toFixed(2)}s
                          </span>
                          <span className="text-gray-500 text-xs">
                            {" "}
                            vs {page.regularLoadTime.toFixed(2)}s
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {page.ampEnabled ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-green-700 font-semibold">
                                {calculateSpeedImprovement(
                                  page.ampLoadTime,
                                  page.regularLoadTime
                                )}
                                %
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs text-gray-600">
                          {page.lastValidated
                            ? new Date(page.lastValidated).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            {page.ampEnabled && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => validateAmp(page.pageId)}
                                  disabled={validatingId === page.pageId}
                                  className="gap-1"
                                >
                                  {validatingId === page.pageId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Validate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    validateAmp(page.pageId);
                                  }}
                                  className="gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  Preview
                                </Button>
                              </>
                            )}
                            {!page.ampEnabled && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleAmp(page.pageId, true)}
                                disabled={togglingId === page.pageId}
                                className="gap-1"
                              >
                                {togglingId === page.pageId ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Zap className="w-3 h-3" />
                                )}
                                Generate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Panel */}
        {selectedPageValidation && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">
                AMP Validation Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Validation Issues</h3>
                <div className="space-y-2">
                  {selectedPageValidation.errors.length === 0 &&
                    selectedPageValidation.warnings.length === 0 && (
                      <div className="flex items-center gap-2 text-green-700 bg-green-100 p-3 rounded">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">All checks passed!</span>
                      </div>
                    )}

                  {selectedPageValidation.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-red-100 p-3 rounded text-red-800"
                    >
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{err.message}</p>
                        {err.details && (
                          <p className="text-sm text-red-700 mt-1">
                            {err.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedPageValidation.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-yellow-100 p-3 rounded text-yellow-800"
                    >
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{warn.message}</p>
                        {warn.details && (
                          <p className="text-sm text-yellow-700 mt-1">
                            {warn.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPageValidation(null)}
                className="mt-2"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
