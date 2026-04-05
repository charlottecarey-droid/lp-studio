import { useEffect, useState } from "react";
import { Plus, ArrowRight, Globe, BarChart3, AlertCircle, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = "/api";

interface AdMapping {
  id: string;
  platform: "google" | "meta" | "linkedin";
  adGroupName: string;
  landingPageName: string;
  messageMatch: number;
  ctr: number;
  cpc: number;
}

interface AdMapStats {
  total: number;
  avgMatch: number;
  pagesWithoutAds: number;
  adsWithoutPages: number;
}

const DEFAULT_MAPPINGS: AdMapping[] = [
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

function getScoreColor(score: number) {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "google":
      return "🔍";
    case "meta":
      return "f";
    case "linkedin":
      return "in";
    default:
      return "📱";
  }
}

function getPlatformBadgeColor(platform: string) {
  switch (platform) {
    case "google":
      return "bg-blue-50 border-blue-200 text-blue-900";
    case "meta":
      return "bg-purple-50 border-purple-200 text-purple-900";
    case "linkedin":
      return "bg-slate-50 border-slate-200 text-slate-900";
    default:
      return "bg-gray-50 border-gray-200 text-gray-900";
  }
}

function useAdMappings() {
  const [mappings, setMappings] = useState<AdMapping[]>([]);
  const [stats, setStats] = useState<AdMapStats>({
    total: 0,
    avgMatch: 0,
    pagesWithoutAds: 0,
    adsWithoutPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/lp/ad-map`)
      .then(r => r.json())
      .then(data => {
        setMappings(data.mappings || DEFAULT_MAPPINGS);
        setStats(data.stats);
      })
      .catch(() => {
        setMappings(DEFAULT_MAPPINGS);
        const avgMatch = Math.round(
          DEFAULT_MAPPINGS.reduce((sum, m) => sum + m.messageMatch, 0) / DEFAULT_MAPPINGS.length
        );
        setStats({
          total: DEFAULT_MAPPINGS.length,
          avgMatch,
          pagesWithoutAds: 3,
          adsWithoutPages: 2,
        });
        setError("Using demo data");
      })
      .finally(() => setLoading(false));
  };

  const addMapping = (mapping: Omit<AdMapping, "id">) => {
    const newMapping = { ...mapping, id: `map-${Date.now()}` };
    const updated = [...mappings, newMapping];
    setMappings(updated);

    fetch(`${API_BASE}/lp/ad-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mapping),
    }).catch(() => {
      // Use optimistic update
    });
  };

  useEffect(() => {
    load();
  }, []);

  const filteredMappings = selectedPlatform === "all"
    ? mappings
    : mappings.filter(m => m.platform === selectedPlatform);

  return { mappings: filteredMappings, stats, loading, error, addMapping, selectedPlatform, setSelectedPlatform };
}

function AddMappingDialog({ onAdd }: { onAdd: (mapping: Omit<AdMapping, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    platform: "google" as const,
    adGroupName: "",
    landingPageName: "",
    messageMatch: 75,
    ctr: 5,
    cpc: 1.5,
  });

  const handleAdd = () => {
    if (formData.adGroupName && formData.landingPageName) {
      onAdd(formData);
      setFormData({
        platform: "google",
        adGroupName: "",
        landingPageName: "",
        messageMatch: 75,
        ctr: 5,
        cpc: 1.5,
      });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Mapping
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Ad Mapping</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Platform</label>
            <select
              className="w-full px-3 py-2 border rounded-md mt-1"
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
            >
              <option value="google">Google Ads</option>
              <option value="meta">Meta Ads</option>
              <option value="linkedin">LinkedIn Ads</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Ad Group Name</label>
            <Input
              value={formData.adGroupName}
              onChange={(e) => setFormData({ ...formData, adGroupName: e.target.value })}
              placeholder="e.g., Brand Keywords"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Landing Page Name</label>
            <Input
              value={formData.landingPageName}
              onChange={(e) => setFormData({ ...formData, landingPageName: e.target.value })}
              placeholder="e.g., Homepage V2"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Message Match Score ({formData.messageMatch}%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.messageMatch}
              onChange={(e) => setFormData({ ...formData, messageMatch: parseInt(e.target.value) })}
              className="w-full mt-1"
            />
          </div>
          <Button onClick={handleAdd} className="w-full">
            Create Mapping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdMap() {
  const { mappings, stats, loading, selectedPlatform, setSelectedPlatform, addMapping } = useAdMappings();

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900">AdMap</h1>
                <p className="text-slate-600 mt-2">Connect your ads to landing pages for perfect message match</p>
              </div>
              <AddMappingDialog onAdd={addMapping} />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Avg Message Match</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.avgMatch}%</div>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Ads Without Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{stats.adsWithoutPages}</div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Filter */}
          <div className="mb-6 flex gap-2">
            {["all", "google", "meta", "linkedin"].map(platform => (
              <Button
                key={platform}
                variant={selectedPlatform === platform ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPlatform(platform)}
                className="capitalize"
              >
                {platform === "all" ? "All Platforms" : platform.charAt(0).toUpperCase() + platform.slice(1)}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.length === 0 ? (
                <Card>
                  <CardContent className="pt-8">
                    <div className="text-center py-12">
                      <Globe className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600 mb-4">No ad mappings found</p>
                      <AddMappingDialog onAdd={addMapping} />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                mappings.map(mapping => (
                  <Card key={mapping.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        {/* Left side: Ad Group */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <Badge className={getPlatformBadgeColor(mapping.platform)}>
                              {mapping.platform.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-slate-600">Ad Group</span>
                          </div>
                          <p className="font-semibold text-slate-900 truncate">{mapping.adGroupName}</p>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className={`text-2xl font-bold px-3 py-2 rounded-lg ${getScoreColor(mapping.messageMatch)}`}>
                              {mapping.messageMatch}%
                            </div>
                            <p className="text-xs text-slate-600 mt-1">Message Match</p>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-slate-900">{mapping.ctr.toFixed(1)}%</div>
                            <p className="text-xs text-slate-600">CTR</p>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-slate-900">${mapping.cpc.toFixed(2)}</div>
                            <p className="text-xs text-slate-600">CPC</p>
                          </div>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="h-5 w-5 text-slate-400" />

                        {/* Right side: Landing Page */}
                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-end gap-3 mb-3">
                            <span className="text-sm text-slate-600">Landing Page</span>
                          </div>
                          <p className="font-semibold text-slate-900 truncate">{mapping.landingPageName}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Recommendations Section */}
          {mappings.length > 0 && (
            <Card className="mt-8 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <AlertCircle className="h-5 w-5" />
                  Improve Message Match
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mappings
                  .filter(m => m.messageMatch < 75)
                  .map(m => (
                    <div key={m.id} className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{m.adGroupName}</p>
                        <p className="text-sm text-slate-600">
                          Current message match: {m.messageMatch}% - Consider reviewing ad copy alignment
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </div>
                  ))}
                {mappings.filter(m => m.messageMatch < 75).length === 0 && (
                  <p className="text-slate-600">All mappings have good message match scores!</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
