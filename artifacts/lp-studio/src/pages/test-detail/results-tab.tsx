import { TestWithVariants, TestResults } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Trophy, TrendingUp, AlertCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function ResultsTab({ test, results }: { test: TestWithVariants, results: TestResults | undefined }) {
  
  if (!results) {
    return <div className="p-12 text-center text-muted-foreground">Waiting for data...</div>;
  }

  const needsMoreData = results.totalImpressions < 100;
  
  // Format data for Recharts
  const chartData = results.variants.map(v => ({
    name: v.variantName + (v.isControl ? ' (C)' : ''),
    conversionRate: Number((v.conversionRate * 100).toFixed(2)),
    isWinner: v.variantId === results.winnerId,
    isControl: v.isControl
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Total Traffic" value={results.totalImpressions.toLocaleString()} subtitle="Impressions" />
        <MetricCard title="Total Conversions" value={results.totalConversions.toLocaleString()} subtitle="Actions taken" />
        <MetricCard title="Avg. Conversion Rate" value={`${(results.overallConversionRate * 100).toFixed(2)}%`} subtitle="Across all variants" />
      </div>

      {needsMoreData && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400 rounded-xl">
          <AlertCircle className="h-4 w-4 stroke-current" />
          <AlertTitle className="font-bold">Gathering Data</AlertTitle>
          <AlertDescription>
            This test has less than 100 impressions. Statistical significance calculations may not be reliable yet. Let it run longer.
          </AlertDescription>
        </Alert>
      )}

      {/* Chart Section */}
      <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/60">
        <div className="mb-6">
          <h3 className="font-display font-bold text-xl">Conversion Rates</h3>
          <p className="text-sm text-muted-foreground">Percentage of visitors who clicked the CTA</p>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" unit="%" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis dataKey="name" type="category" width={150} tick={{ fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 500 }} />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
              />
              <Bar dataKey="conversionRate" radius={[0, 6, 6, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isWinner ? 'hsl(var(--primary))' : entry.isControl ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary)/0.4)'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Variant Details Grid */}
      <div>
        <h3 className="font-display font-bold text-xl mb-4">Detailed Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.variants.map((v) => {
            const isWinner = v.variantId === results.winnerId;
            return (
              <Card key={v.variantId} className={`p-6 rounded-2xl relative overflow-hidden transition-all ${isWinner ? 'border-primary shadow-md shadow-primary/10' : ''}`}>
                
                {isWinner && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg flex items-center shadow-sm">
                    <Trophy className="w-3 h-3 mr-1" /> Winner
                  </div>
                )}
                
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg">{v.variantName}</h4>
                    {v.isControl && <Badge variant="outline" className="text-xs font-normal">Control</Badge>}
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="text-3xl font-display font-bold text-primary">
                        {(v.conversionRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">Conversion Rate</div>
                    </div>
                    {v.relativeUplift !== null && v.relativeUplift !== undefined && (
                      <div>
                        <div className={`text-xl font-bold flex items-center ${v.relativeUplift > 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                          {v.relativeUplift > 0 && '+'}{v.relativeUplift.toFixed(1)}%
                          {v.relativeUplift > 0 && <TrendingUp className="w-4 h-4 ml-1" />}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">vs Control</div>
                      </div>
                    )}
                  </div>

                  <div className="bg-muted/30 rounded-xl p-4 text-sm grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Impressions</div>
                    <div className="font-medium text-right">{v.impressions.toLocaleString()}</div>
                    <div className="text-muted-foreground">Conversions</div>
                    <div className="font-medium text-right">{v.conversions.toLocaleString()}</div>
                    
                    {!v.isControl && v.pValue !== undefined && (
                      <>
                        <div className="col-span-2 my-1 border-t border-border/50"></div>
                        <div className="text-muted-foreground">Significance</div>
                        <div className="font-medium text-right flex items-center justify-end gap-1">
                          {v.isSignificant ? (
                            <span className="text-emerald-600 flex items-center"><Sparkles className="w-3 h-3 mr-1"/> Yes</span>
                          ) : (
                            <span>Not yet</span>
                          )}
                        </div>
                        <div className="text-muted-foreground">Confidence</div>
                        <div className="font-medium text-right">{(v.confidenceLevel * 100).toFixed(1)}%</div>
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

function MetricCard({ title, value, subtitle }: { title: string, value: string, subtitle: string }) {
  return (
    <Card className="p-6 rounded-2xl border-border/50 shadow-sm flex flex-col justify-center">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="text-3xl font-display font-bold mt-2 text-foreground">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </Card>
  );
}
