import { useEffect, useState } from "react";
import { Globe, ArrowRight, AlertCircle, Users, TrendingUp, BarChart3, Layers } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = "/api";

interface AdMapping {
  id: string;
  platform: "google" | "meta" | "linkedin" | "bing" | "other";
  utmSource: string | null;
  utmMedium: string | null;
  campaignName: string;
  landingPageId: number;
  landingPageName: string;
  landingPageSlug: string;
  visits: number;
  leads: number;
  cvr: number;
}

interface AdMapStats {
  total: number;
  avgCvr: number;
  totalVisits: number;
  pagesWithoutAds: number;
  adsWithoutPages: number;
  uniqueCampaigns: number;
}

function getCvrColor(cvr: number) {
  if (cvr >= 5) return "bg-green-100 text-green-800";
  if (cvr >= 2) return "bg-yellow-100 text-yellow-800";
  if (cvr > 0) return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-600";
}

function getPlatformLabel(platform: string) {
  switch (platform) {
    case "google": return "Google";
    case "meta": return "Meta";
    case "linkedin": return "LinkedIn";
    case "bing": return "Bing";
    default: return "Other";
  }
}

function getPlatformBadgeColor(platform: string) {
  switch (platform) {
    case "google": return "bg-blue-50 border-blue-200 text-blue-900";
    case "meta": return "bg-purple-50 border-purple-200 text-purple-900";
    case "linkedin": return "bg-slate-50 border-slate-200 text-slate-900";
    case "bing": return "bg-teal-50 border-teal-200 text-teal-900";
    default: return "bg-gray-50 border-gray-200 text-gray-900";
  }
}

function useAdMappings() {
  const [mappings, setMappings] = useState<AdMapping[]>([]);
  const [stats, setStats] = useState<AdMapStats>({
    total: 0,
    avgCvr: 0,
    totalVisits: 0,
    pagesWithoutAds: 0,
    adsWithoutPages: 0,
    uniqueCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/lp/ad-map`)
      .then(r => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then(data => {
        const list = Array.isArray(data.mappings) ? data.mappings : [];
        setMappings(list);
        setStats(data.stats ?? {
          total: 0, avgCvr: 0, totalVisits: 0,
          pagesWithoutAds: 0, adsWithoutPages: 0, uniqueCampaigns: 0,
        });
      })
      .catch(() => {
        setMappings([]);
        setError("Could not load ad map data");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Collect unique platforms from data for filter tabs
  const platforms = Array.from(new Set(mappings.map(m => m.platform)));

  const filteredMappings = selectedPlatform === "all"
    ? mappings
    : mappings.filter(m => m.platform === selectedPlatform);

  // Sort by visits descending
  const sortedMappings = [...filteredMappings].sort((a, b) => b.visits - a.visits);

  return { mappings: sortedMappings, allMappings: mappings, stats, loading, error, platforms, selectedPlatform, setSelectedPlatform };
}

export default function AdMap() {
  const { mappings, allMappings, stats, loading, error, platforms, selectedPlatform, setSelectedPlatform } = useAdMappings();

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900">AdMap</h1>
            <p className="text-slate-600 mt-2">See which campaigns drive traffic to which landing pages</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Campaign → Page Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total UTM Visits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.totalVisits.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Avg CVR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.avgCvr}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Unique Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.uniqueCampaigns}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Pages Without Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.pagesWithoutAds}</div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Filter */}
          <div className="mb-6 flex gap-2 flex-wrap">
            <Button
              variant={selectedPlatform === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPlatform("all")}
            >
              All Platforms
            </Button>
            {platforms.map(platform => (
              <Button
                key={platform}
                variant={selectedPlatform === platform ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPlatform(platform)}
                className="capitalize"
              >
                {getPlatformLabel(platform)}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : error && allMappings.length === 0 ? (
            <Card>
              <CardContent className="pt-8">
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">{error}</p>
                </div>
              </CardContent>
            </Card>
          ) : mappings.length === 0 ? (
            <Card>
              <CardContent className="pt-8">
                <div className="text-center py-12">
                  <Globe className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No campaign traffic yet</h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    {selectedPlatform !== "all"
                      ? `No ${getPlatformLabel(selectedPlatform)} campaigns detected. Try "All Platforms".`
                      : "When visitors arrive with UTM parameters (e.g. from Google Ads, Meta, LinkedIn), their campaign-to-page flow will appear here automatically."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {mappings.map(mapping => (
                <Card key={mapping.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {/* Left: Campaign info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge className={getPlatformBadgeColor(mapping.platform)}>
                            {getPlatformLabel(mapping.platform)}
                          </Badge>
                          {mapping.utmMedium && (
                            <span className="text-xs text-slate-500">{mapping.utmMedium}</span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900 truncate">{mapping.campaignName}</p>
                        {mapping.utmSource && (
                          <p className="text-xs text-slate-500 mt-0.5">via {mapping.utmSource}</p>
                        )}
                      </div>

                      {/* Center: Metrics */}
                      <div className="flex items-center gap-5 shrink-0">
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-lg font-bold text-slate-900">{mapping.visits.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-500">visits</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-lg font-bold text-slate-900">{mapping.leads}</span>
                          </div>
                          <p className="text-xs text-slate-500">leads</p>
                        </div>
                        <div className="text-center">
                          <div className={`text-lg font-bold px-2.5 py-1 rounded-lg ${getCvrColor(mapping.cvr)}`}>
                            {mapping.cvr}%
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">CVR</p>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="h-5 w-5 text-slate-300 shrink-0" />

                      {/* Right: Landing page */}
                      <div className="flex-1 text-right min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{mapping.landingPageName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">/{mapping.landingPageSlug}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Low-performing callout */}
          {mappings.length > 0 && mappings.some(m => m.visits >= 10 && m.cvr < 1) && (
            <Card className="mt-8 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <AlertCircle className="h-5 w-5" />
                  Low Converting Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mappings
                  .filter(m => m.visits >= 10 && m.cvr < 1)
                  .map(m => (
                    <div key={m.id} className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{m.campaignName}</p>
                        <p className="text-sm text-slate-600">
                          {m.visits} visits → {m.leads} leads ({m.cvr}% CVR) on <span className="font-medium">{m.landingPageName}</span>
                        </p>
                      </div>
                      <a href={`/builder/${m.landingPageId}`}>
                        <Button size="sm" variant="outline">Edit Page</Button>
                      </a>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
