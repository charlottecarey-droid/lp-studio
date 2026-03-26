import { useState, useEffect, useCallback } from "react";
import {
  Zap, Brain, RefreshCw, AlertCircle, TrendingUp, Activity,
  Loader2, BarChart3, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

interface SmartTrafficVariantSummary {
  variantId: number;
  featureBucket: string;
  successes: number;
  failures: number;
  conversionRate: number;
  observations: number;
  trafficShare: number;
}

interface SmartTrafficStats {
  testId: number;
  smartTrafficEnabled: boolean;
  smartTrafficMinSamples: number;
  totalObservations: number;
  estimatedLift: number;
  variantSummary: SmartTrafficVariantSummary[];
  bucketStats: SmartTrafficVariantSummary[];
  uniqueBuckets: string[];
  isLearning: boolean;
  isActive: boolean;
  hasConverged: boolean;
  convergedVariantId: number | null;
}

const COLORS = [
  "hsl(var(--primary))",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

export function SmartTrafficTab({
  testId,
  variantNames,
}: {
  testId: number;
  variantNames: Map<number, string>;
}) {
  const [stats, setStats] = useState<SmartTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [minSamples, setMinSamples] = useState(100);
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lp/tests/${testId}/smart-traffic`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setMinSamples(data.smartTrafficMinSamples);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const toggleSmartTraffic = async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await fetch(`${API_BASE}/lp/tests/${testId}/smart-traffic`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        await fetchStats();
        toast({
          title: enabled ? "Smart traffic enabled" : "Smart traffic disabled",
          description: enabled
            ? "The algorithm will start learning from visitor data."
            : "Traffic will be split using manual weights.",
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update smart traffic", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  const updateMinSamples = async () => {
    try {
      await fetch(`${API_BASE}/lp/tests/${testId}/smart-traffic`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSamples }),
      });
      toast({ title: "Updated", description: `Learning threshold set to ${minSamples} impressions` });
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  const resetStats = async () => {
    setResetting(true);
    try {
      await fetch(`${API_BASE}/lp/tests/${testId}/smart-traffic/reset`, { method: "POST" });
      await fetchStats();
      toast({ title: "Stats reset", description: "Smart traffic will re-learn from scratch." });
    } catch {
      toast({ title: "Error", description: "Failed to reset", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const enabled = stats.smartTrafficEnabled;

  // Build chart data
  const trafficShareData = stats.variantSummary.map((v, i) => ({
    name: variantNames.get(v.variantId) ?? `Variant ${v.variantId}`,
    value: v.observations,
    fill: COLORS[i % COLORS.length],
  }));

  const cvrByVariant = stats.variantSummary.map((v, i) => ({
    name: variantNames.get(v.variantId) ?? `Variant ${v.variantId}`,
    cvr: Number((v.conversionRate * 100).toFixed(2)),
    observations: v.observations,
    fill: COLORS[i % COLORS.length],
  }));

  // Top performing buckets
  const topBuckets = [...stats.bucketStats]
    .filter(b => b.observations >= 10)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 10);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Enable/Disable Section */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-xl">Smart traffic</h3>
            <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
              {enabled ? "Active" : "Off"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg">
            Uses Thompson Sampling to learn which variant converts best for different
            visitor segments and automatically routes traffic to the winner.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Switch
            checked={enabled}
            onCheckedChange={toggleSmartTraffic}
            disabled={toggling}
          />
          {toggling && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
      </div>

      {!enabled && (
        <Alert className="rounded-xl bg-muted/40">
          <Zap className="h-4 w-4" />
          <AlertTitle className="font-bold">Smart traffic is off</AlertTitle>
          <AlertDescription>
            Traffic is being split using your manual variant weights. Enable smart traffic
            to let the algorithm optimize routing automatically.
          </AlertDescription>
        </Alert>
      )}

      {enabled && (
        <>
          {/* Status + Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
              </div>
              <div className="text-lg font-display font-bold">
                {stats.isLearning ? (
                  <span className="text-amber-600">Learning</span>
                ) : (
                  <span className="text-emerald-600">Optimizing</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.isLearning
                  ? `${stats.totalObservations}/${stats.smartTrafficMinSamples} impressions`
                  : `${stats.totalObservations.toLocaleString()} total impressions`}
              </p>
            </Card>

            <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. lift</h4>
              </div>
              <div className="text-2xl font-display font-bold text-primary">
                +{stats.estimatedLift.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs. even split</p>
            </Card>

            <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Segments</h4>
              </div>
              <div className="text-2xl font-display font-bold">
                {stats.uniqueBuckets.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">active feature buckets</p>
            </Card>

            <Card className="p-5 rounded-2xl border-border/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exploration</h4>
              </div>
              <div className="text-2xl font-display font-bold">10%</div>
              <p className="text-xs text-muted-foreground mt-1">random traffic floor</p>
            </Card>
          </div>

          {/* Convergence Alert */}
          {stats.hasConverged && (
            <Alert className="rounded-xl bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4 stroke-current" />
              <AlertTitle className="font-bold">Potential winner detected</AlertTitle>
              <AlertDescription>
                <strong>{variantNames.get(stats.convergedVariantId!) ?? `Variant ${stats.convergedVariantId}`}</strong> is
                receiving over 90% of smart traffic. Consider completing this test and promoting the winner.
              </AlertDescription>
            </Alert>
          )}

          {/* Charts */}
          {stats.variantSummary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Traffic Distribution Pie */}
              <Card className="p-6 rounded-2xl shadow-sm border-border/60">
                <h4 className="font-display font-bold text-lg mb-4">Traffic distribution</h4>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trafficShareData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {trafficShareData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* CVR by Variant */}
              <Card className="p-6 rounded-2xl shadow-sm border-border/60">
                <h4 className="font-display font-bold text-lg mb-4">Conversion rate by variant</h4>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cvrByVariant} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" unit="%" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fill: "hsl(var(--foreground))", fontSize: 13, fontWeight: 500 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar dataKey="cvr" radius={[0, 6, 6, 0]} barSize={32}>
                        {cvrByVariant.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* Top Performing Segments */}
          {topBuckets.length > 0 && (
            <Card className="p-6 rounded-2xl shadow-sm border-border/60">
              <h4 className="font-display font-bold text-lg mb-1">Top performing segments</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Which visitor segments convert best for each variant
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Segment</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Variant</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">CVR</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBuckets.map((b, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-xs">
                          {b.featureBucket.split("|").map((part, j) => (
                            <Badge key={j} variant="secondary" className="mr-1 text-[10px]">
                              {part}
                            </Badge>
                          ))}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {variantNames.get(b.variantId) ?? `#${b.variantId}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-primary">
                          {(b.conversionRate * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {b.observations.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Settings */}
          <Card className="p-6 rounded-2xl shadow-sm border-border/60">
            <h4 className="font-display font-bold text-lg mb-4">Settings</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-semibold">Learning threshold</label>
                  <p className="text-xs text-muted-foreground">
                    Minimum impressions before smart routing activates
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={10000}
                    value={minSamples}
                    onChange={(e) => setMinSamples(parseInt(e.target.value) || 100)}
                    className="w-24 h-9 rounded-lg text-center"
                  />
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={updateMinSamples}>
                    Save
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                <div className="flex-1">
                  <label className="text-sm font-semibold">Reset learning</label>
                  <p className="text-xs text-muted-foreground">
                    Wipe all smart traffic stats and start learning from scratch
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-lg"
                  onClick={resetStats}
                  disabled={resetting}
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Reset
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
