import { useEffect, useState } from "react";
import {
  MapPin, Globe, TrendingUp, TrendingDown, RefreshCw,
  BarChart3, Users, FileText, ArrowUpRight, ArrowDownRight, Minus,
  Eye, MousePointerClick, Target,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const API_BASE = "/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CityRow {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  count: number;
}

interface CountryRow {
  country: string;
  countryCode: string;
  count: number;
}

interface TrafficDay {
  date: string;
  visits: number;
  uniqueVisitors: number;
  leads: number;
}

interface PageMetrics {
  pageId: number;
  title: string;
  slug: string;
  status: string;
  visits: number;
  uniqueVisitors: number;
  leads: number;
  impressions: number;
  conversions: number;
  cvr: number;
}

interface Overview {
  totalVisits: number;
  uniqueVisitors: number;
  visitsTrend: number;
  totalLeads: number;
  leadsTrend: number;
  cvr: number;
  cvrTrend: number;
  totalPages: number;
  publishedPages: number;
  period: string;
}

/* ------------------------------------------------------------------ */
/*  Data hooks                                                         */
/* ------------------------------------------------------------------ */

function useAnalytics(days: number) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [traffic, setTraffic] = useState<TrafficDay[]>([]);
  const [pages, setPages] = useState<PageMetrics[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_BASE}/lp/analytics/overview?days=${days}`).then(r => r.json()),
      fetch(`${API_BASE}/lp/analytics/traffic?days=${days}`).then(r => r.json()),
      fetch(`${API_BASE}/lp/analytics/pages?days=${days}`).then(r => r.json()),
      fetch(`${API_BASE}/lp/analytics/locations`).then(r => r.json()),
      fetch(`${API_BASE}/lp/analytics/countries`).then(r => r.json()),
    ])
      .then(([o, t, p, c, co]) => {
        setOverview(o);
        setTraffic(t);
        setPages(p);
        setCities(c);
        setCountries(co);
      })
      .catch(() => setError("Failed to load analytics data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [days]);
  return { overview, traffic, pages, cities, countries, loading, error, reload: load };
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                  */
/* ------------------------------------------------------------------ */

function flagEmoji(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(
    countryCode.toUpperCase().charCodeAt(0) + offset,
    countryCode.toUpperCase().charCodeAt(1) + offset,
  );
}

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {positive ? "+" : ""}{Math.round(value)}{suffix}
    </span>
  );
}

function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" />
            {label}
          </span>
          {trend !== undefined && !loading && <TrendBadge value={trend} />}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BarRow({ label, sub, count, max, flag }: { label: string; sub?: string; count: number; max: number; flag?: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5">
      {flag && <span className="text-lg w-7 text-center shrink-0">{flag}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-sm font-semibold tabular-nums shrink-0">{count.toLocaleString()}</span>
        </div>
        {sub && <p className="text-xs text-muted-foreground mb-1">{sub}</p>}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-7 h-6 rounded" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline — tiny inline chart for traffic trends                   */
/* ------------------------------------------------------------------ */

function Sparkline({
  data,
  dataKey,
  color = "currentColor",
  height = 120,
  showArea = true,
}: {
  data: TrafficDay[];
  dataKey: keyof TrafficDay;
  color?: string;
  height?: number;
  showArea?: boolean;
}) {
  const values = data.map(d => d[dataKey] as number);
  const max = Math.max(...values, 1);
  const w = 600;
  const h = height;
  const padding = 2;

  const points = values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * (w - padding * 2),
    y: h - padding - (v / max) * (h - padding * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {showArea && (
        <path d={areaD} fill={color} opacity={0.08} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Traffic chart with labels                                          */
/* ------------------------------------------------------------------ */

function TrafficChart({ data, loading }: { data: TrafficDay[]; loading: boolean }) {
  const totalVisits = data.reduce((s, d) => s + d.visits, 0);
  const totalLeads = data.reduce((s, d) => s + d.leads, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Traffic Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[160px] w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) return null;

  // Format date labels
  const firstDate = data[0]?.date;
  const lastDate = data[data.length - 1]?.date;
  const fmt = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Traffic Over Time
          </CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-foreground" />
              Visits ({totalVisits.toLocaleString()})
            </span>
            {totalLeads > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Leads ({totalLeads})
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="relative">
          <Sparkline data={data} dataKey="visits" color="var(--foreground, #000)" height={140} />
          {totalLeads > 0 && (
            <div className="absolute inset-0">
              <Sparkline data={data} dataKey="leads" color="#10b981" height={140} showArea={false} />
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
          <span>{fmt(firstDate)}</span>
          <span>{fmt(lastDate)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Pages table                                                        */
/* ------------------------------------------------------------------ */

function PagesTable({ pages, loading }: { pages: PageMetrics[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No page data yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Publish pages to start seeing metrics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-5 py-3">Page</th>
              <th className="text-right px-4 py-3">Visits</th>
              <th className="text-right px-4 py-3">Unique</th>
              <th className="text-right px-4 py-3">Leads</th>
              <th className="text-right px-5 py-3">CVR</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pages.map((p) => (
              <tr key={p.pageId} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate max-w-xs">{p.title}</p>
                    <p className="text-xs text-muted-foreground truncate">/lp/{p.slug}</p>
                  </div>
                </td>
                <td className="text-right px-4 py-3 text-sm tabular-nums font-medium">
                  {p.visits.toLocaleString()}
                </td>
                <td className="text-right px-4 py-3 text-sm tabular-nums text-muted-foreground">
                  {p.uniqueVisitors.toLocaleString()}
                </td>
                <td className="text-right px-4 py-3 text-sm tabular-nums">
                  {p.leads > 0 ? (
                    <span className="font-medium text-emerald-600">{p.leads}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="text-right px-5 py-3 text-sm tabular-nums">
                  {p.cvr > 0 ? (
                    <span className="font-medium">{p.cvr.toFixed(1)}%</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Conversion funnel                                                  */
/* ------------------------------------------------------------------ */

function ConversionFunnel({ overview, pages, loading }: { overview: Overview | null; pages: PageMetrics[]; loading: boolean }) {
  const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
  const totalConversions = pages.reduce((s, p) => s + p.conversions, 0);

  const funnelSteps = [
    {
      label: "Total Visits",
      value: overview?.totalVisits ?? 0,
      icon: Eye,
      color: "bg-blue-500",
    },
    {
      label: "Form Impressions",
      value: totalImpressions,
      icon: MousePointerClick,
      color: "bg-indigo-500",
    },
    {
      label: "Form Submissions",
      value: overview?.totalLeads ?? 0,
      icon: Target,
      color: "bg-emerald-500",
    },
  ];

  const maxValue = Math.max(...funnelSteps.map(s => s.value), 1);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            const pct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
            const dropoff = i > 0 && funnelSteps[i - 1].value > 0
              ? ((funnelSteps[i - 1].value - step.value) / funnelSteps[i - 1].value * 100)
              : 0;

            return (
              <div key={step.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <step.icon className="w-4 h-4 text-muted-foreground" />
                    {step.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {i > 0 && dropoff > 0 && (
                      <span className="text-xs text-muted-foreground">
                        −{Math.round(dropoff)}% drop
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums">{step.value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${step.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion rates */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-3.5">
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Visit → Lead Rate</p>
            <p className="text-lg font-bold">
              {overview && overview.totalVisits > 0
                ? ((overview.totalLeads / overview.totalVisits) * 100).toFixed(2)
                : "0.00"}%
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3.5">
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Form → Submit Rate</p>
            <p className="text-lg font-bold">
              {totalImpressions > 0
                ? ((overview?.totalLeads ?? 0) / totalImpressions * 100).toFixed(2)
                : "0.00"}%
            </p>
          </div>
        </div>

        {/* Top converting pages */}
        {pages.filter(p => p.leads > 0).length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Top Converting Pages
            </h4>
            <div className="space-y-2">
              {pages
                .filter(p => p.leads > 0)
                .sort((a, b) => b.cvr - a.cvr)
                .slice(0, 5)
                .map(p => (
                  <div key={p.pageId} className="flex items-center justify-between py-1.5">
                    <span className="text-sm truncate max-w-[200px]">{p.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{p.leads} leads</span>
                      <span className="text-sm font-semibold text-emerald-600">{p.cvr.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { overview, traffic, pages, cities, countries, loading, error, reload } = useAnalytics(days);

  const totalVisits = countries.reduce((s, r) => s + r.count, 0);
  const topCities = cities.slice(0, 20);
  const topCountries = countries.slice(0, 10);
  const maxCity = topCities[0]?.count ?? 1;
  const maxCountry = topCountries[0]?.count ?? 1;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Track visitor activity, page performance, and conversions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex items-center rounded-md border text-sm">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    days === d
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  } ${d === 7 ? "rounded-l-md" : ""} ${d === 90 ? "rounded-r-md" : ""}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={reload}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="conversions">Conversions</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Visits"
                value={overview?.totalVisits ?? 0}
                trend={overview?.visitsTrend}
                icon={Eye}
                loading={loading}
              />
              <StatCard
                label="Unique Visitors"
                value={overview?.uniqueVisitors ?? 0}
                icon={Users}
                loading={loading}
              />
              <StatCard
                label="Leads"
                value={overview?.totalLeads ?? 0}
                trend={overview?.leadsTrend}
                icon={Target}
                loading={loading}
              />
              <StatCard
                label="Conversion Rate"
                value={overview ? `${overview.cvr.toFixed(2)}%` : "0%"}
                trend={overview?.cvrTrend}
                icon={TrendingUp}
                loading={loading}
              />
            </div>

            {/* Traffic chart */}
            <TrafficChart data={traffic} loading={loading} />

            {/* Quick view: top pages + top locations side by side */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top pages by visits */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Top Pages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <LoadingSkeleton rows={5} />
                  ) : pages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No data</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {pages.slice(0, 5).map(p => (
                        <BarRow
                          key={p.pageId}
                          label={p.title}
                          sub={`/lp/${p.slug}`}
                          count={p.visits}
                          max={pages[0]?.visits ?? 1}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top countries */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Top Countries
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {loading ? <LoadingSkeleton rows={5} /> : topCountries.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No data</p>
                  ) : topCountries.slice(0, 5).map(row => (
                    <BarRow
                      key={row.countryCode || row.country}
                      label={row.country || "Unknown"}
                      count={row.count}
                      max={maxCountry}
                      flag={flagEmoji(row.countryCode)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PAGES TAB */}
          <TabsContent value="pages" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Pages"
                value={overview?.totalPages ?? 0}
                icon={FileText}
                loading={loading}
              />
              <StatCard
                label="Published"
                value={overview?.publishedPages ?? 0}
                icon={Globe}
                loading={loading}
              />
              <StatCard
                label="Pages with Leads"
                value={pages.filter(p => p.leads > 0).length}
                icon={Target}
                loading={loading}
              />
              <StatCard
                label="Avg CVR"
                value={(() => {
                  const pagesWithVisits = pages.filter(p => p.visits > 0);
                  if (pagesWithVisits.length === 0) return "0%";
                  const avg = pagesWithVisits.reduce((s, p) => s + p.cvr, 0) / pagesWithVisits.length;
                  return `${avg.toFixed(2)}%`;
                })()}
                icon={TrendingUp}
                loading={loading}
              />
            </div>

            <PagesTable pages={pages} loading={loading} />
          </TabsContent>

          {/* LOCATIONS TAB */}
          <TabsContent value="locations" className="space-y-6 mt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Total Visitors"
                value={totalVisits}
                icon={TrendingUp}
                loading={loading}
              />
              <StatCard
                label="Countries"
                value={countries.length}
                icon={Globe}
                loading={loading}
              />
              <StatCard
                label="Cities"
                value={cities.length}
                icon={MapPin}
                loading={loading}
              />
            </div>

            {/* No data yet */}
            {!loading && !error && totalVisits === 0 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">No location data yet</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Data will appear here once visitors access your published pages.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Charts */}
            {(loading || totalVisits > 0) && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      Top Countries
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    {loading ? <LoadingSkeleton /> : topCountries.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No data</p>
                    ) : topCountries.map(row => (
                      <BarRow
                        key={row.countryCode || row.country}
                        label={row.country || "Unknown"}
                        count={row.count}
                        max={maxCountry}
                        flag={flagEmoji(row.countryCode)}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Top Cities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    {loading ? <LoadingSkeleton /> : topCities.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No data</p>
                    ) : topCities.map(row => (
                      <BarRow
                        key={`${row.city}-${row.region}-${row.country}`}
                        label={row.city || "Unknown"}
                        sub={[row.region, row.country].filter(Boolean).join(", ")}
                        count={row.count}
                        max={maxCity}
                        flag={flagEmoji(row.countryCode)}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* CONVERSIONS TAB */}
          <TabsContent value="conversions" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Total Leads"
                value={overview?.totalLeads ?? 0}
                trend={overview?.leadsTrend}
                icon={Target}
                loading={loading}
              />
              <StatCard
                label="Conversion Rate"
                value={overview ? `${overview.cvr.toFixed(2)}%` : "0%"}
                trend={overview?.cvrTrend}
                icon={TrendingUp}
                loading={loading}
              />
              <StatCard
                label="Pages with Leads"
                value={pages.filter(p => p.leads > 0).length}
                icon={FileText}
                loading={loading}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <ConversionFunnel overview={overview} pages={pages} loading={loading} />

              {/* Lead trend chart */}
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    Lead Volume
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  {loading ? (
                    <Skeleton className="h-[160px] w-full rounded" />
                  ) : (
                    <>
                      <Sparkline data={traffic} dataKey="leads" color="#10b981" height={160} />
                      {traffic.length > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
                          <span>{new Date(traffic[0].date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          <span>{new Date(traffic[traffic.length - 1].date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
