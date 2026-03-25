import { TestWithVariants } from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import {
  Trophy, TrendingUp, AlertCircle, Sparkles, Users, MousePointerClick,
  FileText, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VariantResult {
  variantId: number;
  variantName: string;
  isControl: boolean;
  impressions: number;
  conversions: number;
  conversionRate: number;
  leads: number;
  leadRate: number;
  relativeUplift?: number | null;
  zScore?: number | null;
  pValue?: number | null;
  isSignificant: boolean;
  confidenceLevel: number;
}

interface TestResultsEnhanced {
  testId: number;
  testName: string;
  status: string;
  totalImpressions: number;
  totalConversions: number;
  totalLeads: number;
  overallConversionRate: number;
  overallLeadRate: number;
  winnerId?: number | null;
  variants: VariantResult[];
  dailySeries: Record<string, string | number>[];
}

const VARIANT_COLORS = [
  "hsl(var(--primary))",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

export function ResultsTab({
  test,
  results,
}: {
  test: TestWithVariants;
  results: TestResultsEnhanced | undefined;
}) {
  if (!results) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Waiting for data...
      </div>
    );
  }

  // Ensure backward compat with old API that may not have these fields
  const totalLeads = totalLeads ?? 0;
  const overallLeadRate = overallLeadRate ?? 0;
  const dailySeries = dailySeries ?? [];
  const variants = results.variants.map((v) => ({
    ...v,
    leads: v.leads ?? 0,
    leadRate: v.leadRate ?? 0,
  }));

  const needsMoreData = results.totalImpressions < 100;

  // CVR chart data
  const cvrChartData = variants.map((v) => ({
    name: v.variantName + (v.isControl ? " (C)" : ""),
    conversionRate: Number((v.conversionRate * 100).toFixed(2)),
    isWinner: v.variantId === results.winnerId,
    isControl: v.isControl,
  }));

  // Daily CVR trend data
  const dailyCvrData = dailySeries.map((d) => {
    const entry: Record<string, string | number> = {
      day: (d.day as string).slice(5), // MM-DD
    };
    for (const v of variants) {
      const imp = (d[`v${v.variantId}_impressions`] as number) || 0;
      const conv = (d[`v${v.variantId}_conversions`] as number) || 0;
      entry[v.variantName] = imp > 0 ? Number(((conv / imp) * 100).toFixed(2)) : 0;
    }
    return entry;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Traffic"
          value={results.totalImpressions.toLocaleString()}
          subtitle="Impressions"
          icon={<Users className="w-4 h-4" />}
        />
        <MetricCard
          title="Conversions"
          value={results.totalConversions.toLocaleString()}
          subtitle={`${(results.overallConversionRate * 100).toFixed(1)}% CVR`}
          icon={<MousePointerClick className="w-4 h-4" />}
        />
        <MetricCard
          title="Leads (MQL)"
          value={totalLeads.toLocaleString()}
          subtitle={`${(overallLeadRate * 100).toFixed(1)}% lead rate`}
          icon={<FileText className="w-4 h-4" />}
        />
        <MetricCard
          title="Winner"
          value={
            results.winnerId
              ? variants.find((v) => v.variantId === results.winnerId)
                  ?.variantName ?? "—"
              : "TBD"
          }
          subtitle={
            results.winnerId ? "Statistically significant" : "Not enough data"
          }
          icon={<Trophy className="w-4 h-4" />}
        />
      </div>

      {needsMoreData && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400 rounded-xl">
          <AlertCircle className="h-4 w-4 stroke-current" />
          <AlertTitle className="font-bold">Gathering Data</AlertTitle>
          <AlertDescription>
            Less than 100 impressions so far. Statistical significance
            calculations may not be reliable yet.
          </AlertDescription>
        </Alert>
      )}

      {/* Charts Section */}
      <Tabs defaultValue="cvr" className="w-full">
        <TabsList className="w-auto">
          <TabsTrigger value="cvr">Conversion Rate</TabsTrigger>
          <TabsTrigger value="mql">Lead Rate (MQL)</TabsTrigger>
          <TabsTrigger value="trend">Daily Trend</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="cvr">
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/60">
            <div className="mb-6">
              <h3 className="font-display font-bold text-xl">
                Conversion Rates by Variant
              </h3>
              <p className="text-sm text-muted-foreground">
                Percentage of visitors who completed the primary conversion goal
              </p>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cvrChartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    unit="%"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    tick={{
                      fill: "hsl(var(--foreground))",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="conversionRate" radius={[0, 6, 6, 0]} barSize={40}>
                    {cvrChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.isWinner
                            ? "hsl(var(--primary))"
                            : entry.isControl
                            ? "hsl(var(--muted-foreground))"
                            : "hsl(var(--primary)/0.4)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mql">
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/60">
            <div className="mb-6">
              <h3 className="font-display font-bold text-xl">
                Lead Rate (MQL) by Variant
              </h3>
              <p className="text-sm text-muted-foreground">
                Percentage of visitors who submitted a form (Marketing Qualified
                Leads)
              </p>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={variants.map((v) => ({
                    name: v.variantName + (v.isControl ? " (C)" : ""),
                    leadRate: Number((v.leadRate * 100).toFixed(2)),
                    leads: v.leads,
                    isControl: v.isControl,
                  }))}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    unit="%"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    tick={{
                      fill: "hsl(var(--foreground))",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      fontWeight: 600,
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      "Lead Rate",
                    ]}
                  />
                  <Bar dataKey="leadRate" radius={[0, 6, 6, 0]} barSize={40}>
                    {variants.map((v, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={VARIANT_COLORS[index % VARIANT_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="trend">
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/60">
            <div className="mb-6">
              <h3 className="font-display font-bold text-xl">
                Daily Conversion Rate Trend
              </h3>
              <p className="text-sm text-muted-foreground">
                CVR per variant over the last 30 days
              </p>
            </div>
            {dailyCvrData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No daily data yet
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyCvrData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="day"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      unit="%"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    {variants.map((v, i) => (
                      <Line
                        key={v.variantId}
                        type="monotone"
                        dataKey={v.variantName}
                        stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="funnel">
          <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/60">
            <div className="mb-6">
              <h3 className="font-display font-bold text-xl">
                Conversion Funnel
              </h3>
              <p className="text-sm text-muted-foreground">
                Traffic → CTA Conversion → Lead (MQL) per variant
              </p>
            </div>
            <div className="space-y-6">
              {variants.map((v, i) => {
                const impWidth = 100;
                const convWidth =
                  v.impressions > 0
                    ? Math.max(
                        (v.conversions / v.impressions) * 100,
                        2
                      )
                    : 0;
                const leadWidth =
                  v.impressions > 0
                    ? Math.max((v.leads / v.impressions) * 100, v.leads > 0 ? 2 : 0)
                    : 0;
                const color = VARIANT_COLORS[i % VARIANT_COLORS.length];

                return (
                  <div key={v.variantId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {v.variantName}
                      </span>
                      {v.isControl && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          Control
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <FunnelBar
                        label="Impressions"
                        value={v.impressions}
                        width={impWidth}
                        color={color}
                        opacity={0.25}
                      />
                      <FunnelBar
                        label="Conversions"
                        value={v.conversions}
                        pct={v.conversionRate * 100}
                        width={convWidth}
                        color={color}
                        opacity={0.55}
                      />
                      <FunnelBar
                        label="Leads (MQL)"
                        value={v.leads}
                        pct={v.leadRate * 100}
                        width={leadWidth}
                        color={color}
                        opacity={1}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Variant Details Grid */}
      <div>
        <h3 className="font-display font-bold text-xl mb-4">
          Variant Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {variants.map((v) => {
            const isWinner = v.variantId === results.winnerId;
            return (
              <Card
                key={v.variantId}
                className={`p-6 rounded-2xl relative overflow-hidden transition-all ${
                  isWinner ? "border-primary shadow-md shadow-primary/10" : ""
                }`}
              >
                {isWinner && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg flex items-center shadow-sm">
                    <Trophy className="w-3 h-3 mr-1" /> Winner
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg">{v.variantName}</h4>
                    {v.isControl && (
                      <Badge variant="outline" className="text-xs font-normal">
                        Control
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 mb-6">
                    <div>
                      <div className="text-2xl font-display font-bold text-primary">
                        {(v.conversionRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                        CVR
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-display font-bold text-purple-500">
                        {v.leads}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                        MQLs
                      </div>
                    </div>
                    {v.relativeUplift !== null &&
                      v.relativeUplift !== undefined && (
                        <div>
                          <div
                            className={`text-xl font-bold flex items-center ${
                              v.relativeUplift > 0
                                ? "text-emerald-500"
                                : v.relativeUplift < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {v.relativeUplift > 0 ? (
                              <ArrowUpRight className="w-4 h-4 mr-0.5" />
                            ) : v.relativeUplift < 0 ? (
                              <ArrowDownRight className="w-4 h-4 mr-0.5" />
                            ) : (
                              <Minus className="w-4 h-4 mr-0.5" />
                            )}
                            {v.relativeUplift > 0 && "+"}
                            {v.relativeUplift.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                            vs Control
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="bg-muted/30 rounded-xl p-4 text-sm grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Impressions</div>
                    <div className="font-medium text-right">
                      {v.impressions.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">Conversions</div>
                    <div className="font-medium text-right">
                      {v.conversions.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">Leads (MQL)</div>
                    <div className="font-medium text-right">
                      {v.leads.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">Lead Rate</div>
                    <div className="font-medium text-right">
                      {(v.leadRate * 100).toFixed(2)}%
                    </div>

                    {!v.isControl && v.pValue !== undefined && v.pValue !== null && (
                      <>
                        <div className="col-span-2 my-1 border-t border-border/50"></div>
                        <div className="text-muted-foreground">Significance</div>
                        <div className="font-medium text-right flex items-center justify-end gap-1">
                          {v.isSignificant ? (
                            <span className="text-emerald-600 flex items-center">
                              <Sparkles className="w-3 h-3 mr-1" /> Yes
                            </span>
                          ) : (
                            <span>Not yet</span>
                          )}
                        </div>
                        <div className="text-muted-foreground">Confidence</div>
                        <div className="font-medium text-right">
                          {v.confidenceLevel.toFixed(1)}%
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5 rounded-2xl border-border/50 shadow-sm flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-muted-foreground">{icon}</div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
      </div>
      <div className="text-2xl font-display font-bold text-foreground">
        {value}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </Card>
  );
}

function FunnelBar({
  label,
  value,
  pct,
  width,
  color,
  opacity,
}: {
  label: string;
  value: number;
  pct?: number;
  width: number;
  color: string;
  opacity: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-muted-foreground text-right shrink-0">
        {label}
      </div>
      <div className="flex-1 h-7 bg-muted/20 rounded-md overflow-hidden relative">
        <div
          className="h-full rounded-md transition-all duration-500"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            opacity,
          }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-xs font-medium">
          {value.toLocaleString()}
          {pct !== undefined && ` (${pct.toFixed(1)}%)`}
        </span>
      </div>
    </div>
  );
}
