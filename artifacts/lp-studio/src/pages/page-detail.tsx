import { lazy, Suspense, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  MousePointerClick,
  Target,
  Percent,
  ScrollText,
  Eye,
  ExternalLink,
  PencilRuler,
  FlaskConical,
  Gauge,
  Sparkles,
  Globe,
  Megaphone,
  Map as MapIcon,
  Table as TableIcon,
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageConversionScore } from "@/components/analytics/PageConversionScore";
import { PageSpeedPanel } from "@/components/analytics/PageSpeedPanel";
import { PageTrafficSources } from "@/components/analytics/PageTrafficSources";
import { PageProgrammaticVars } from "@/components/analytics/PageProgrammaticVars";

const HeatmapOverlay = lazy(() =>
  import("@/components/heatmap/HeatmapOverlay").then(m => ({ default: m.HeatmapOverlay })),
);

const API_BASE = "/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Metric {
  value: number;
  deltaPct: number | null;
}

interface SummaryResponse {
  page: { id: number; title: string; slug: string; status: string };
  metrics: {
    visits: Metric;
    conversions: Metric;
    conversionRate: Metric;
    knownVisitors: Metric;
    avgScrollDepth: Metric;
    totalClicks: Metric;
  };
}

interface TestRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  testType: string;
  variantCount: number;
}

interface AdMapping {
  id: string | number;
  platform: string;
  campaignName: string;
  landingPageId: number;
  visits: number;
  leads: number;
  cvr: number;
}

interface VisitRow {
  id: string;
  source: "anonymous" | "personalized";
  visitedAt: string;
  contactName: string | null;
  company: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string | null;
  scrollDepthPct: number | null;
  clicks: number | null;
  converted: boolean;
}

interface VisitsResponse {
  visits: VisitRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flagEmoji(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const offset = 0x1f1e6 - 65;
  return String.fromCodePoint(
    countryCode.toUpperCase().charCodeAt(0) + offset,
    countryCode.toUpperCase().charCodeAt(1) + offset,
  );
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "published" || status === "live") return "default";
  if (status === "draft") return "secondary";
  return "outline";
}

function TrendBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {positive ? "+" : ""}
      {Math.round(value)}
      {suffix}
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
  trend?: number | null;
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
          {trend !== undefined && !loading && <TrendBadge value={trend ?? null} />}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* A section wrapper so each analytics surface reads consistently and any
   internal failure is visually contained (the child components self-handle
   their own loading/error/empty states). */
function Section({
  title,
  icon: Icon,
  description,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            {title}
          </CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  A/B tests section                                                  */
/* ------------------------------------------------------------------ */

function AbTestsSection({ pageId }: { pageId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["page-ab-tests", pageId],
    queryFn: async (): Promise<TestRow[]> => {
      const r = await fetch(`${API_BASE}/lp/tests?pageId=${pageId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<TestRow[]>;
    },
    enabled: Number.isFinite(pageId),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError)
    return <p className="text-sm text-muted-foreground py-4">Could not load A/B tests.</p>;

  const tests = data ?? [];
  if (tests.length === 0)
    return (
      <div className="text-center py-8">
        <FlaskConical className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No A/B tests reference this page.</p>
      </div>
    );

  return (
    <div className="divide-y">
      {tests.map(t => (
        <Link key={t.id} href={`/tests/${t.id}`}>
          <a className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.variantCount} variant{t.variantCount === 1 ? "" : "s"} · {t.testType}
              </p>
            </div>
            <Badge variant={t.status === "running" ? "default" : "secondary"}>{t.status}</Badge>
          </a>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ad map section                                                     */
/* ------------------------------------------------------------------ */

function AdMapSection({ pageId }: { pageId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["page-ad-map", pageId],
    queryFn: async (): Promise<{ mappings: AdMapping[] }> => {
      const r = await fetch(`${API_BASE}/lp/ad-map?pageId=${pageId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ mappings: AdMapping[] }>;
    },
    enabled: Number.isFinite(pageId),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError) return <p className="text-sm text-muted-foreground py-4">Could not load ad map.</p>;

  const mappings = data?.mappings ?? [];
  if (mappings.length === 0)
    return (
      <div className="text-center py-8">
        <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No ad campaigns mapped to this page.</p>
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="font-medium px-3 py-2">Campaign</th>
            <th className="font-medium px-3 py-2">Platform</th>
            <th className="font-medium px-3 py-2 text-right">Visits</th>
            <th className="font-medium px-3 py-2 text-right">Leads</th>
            <th className="font-medium px-3 py-2 text-right">CVR</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map(m => (
            <tr key={m.id} className="border-b hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5 font-medium truncate max-w-[220px]">{m.campaignName}</td>
              <td className="px-3 py-2.5 capitalize text-muted-foreground">{m.platform}</td>
              <td className="px-3 py-2.5 text-right">{m.visits.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right">{m.leads.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{m.cvr.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Visits table (net-new)                                             */
/* ------------------------------------------------------------------ */

function VisitsTable({ pageId, days }: { pageId: number; days: number }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [convertedOnly, setConvertedOnly] = useState(false);
  const [knownOnly, setKnownOnly] = useState(false);
  const limit = 25;

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["page-visits", pageId, days, page, search, convertedOnly, knownOnly],
    queryFn: async (): Promise<VisitsResponse> => {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("contactSearch", search);
      if (convertedOnly) params.set("convertedOnly", "true");
      if (knownOnly) params.set("knownOnly", "true");
      const r = await fetch(`${API_BASE}/lp/analytics/pages/${pageId}/visits?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<VisitsResponse>;
    },
    enabled: Number.isFinite(pageId),
  });

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function toggle(setter: (v: boolean) => void, current: boolean) {
    setter(!current);
    setPage(1);
  }

  const visits = data?.visits ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={applySearch} className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, company, email…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
        <Button
          type="button"
          size="sm"
          variant={knownOnly ? "default" : "outline"}
          onClick={() => toggle(setKnownOnly, knownOnly)}
        >
          Known only
        </Button>
        <Button
          type="button"
          size="sm"
          variant={convertedOnly ? "default" : "outline"}
          onClick={() => toggle(setConvertedOnly, convertedOnly)}
        >
          Converted only
        </Button>
      </div>

      {isError ? (
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Could not load visits.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <div className="text-center py-10">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No visits match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="font-medium px-3 py-2">Visitor</th>
                <th className="font-medium px-3 py-2">Source</th>
                <th className="font-medium px-3 py-2">Location</th>
                <th className="font-medium px-3 py-2">Device</th>
                <th className="font-medium px-3 py-2 text-right">Scroll</th>
                <th className="font-medium px-3 py-2 text-right">Clicks</th>
                <th className="font-medium px-3 py-2 text-center">Conv.</th>
                <th className="font-medium px-3 py-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {visits.map(v => {
                const identity =
                  v.contactName || v.company || v.email || (v.source === "personalized" ? "Known visitor" : "Anonymous");
                const loc = [v.city, v.region, v.country].filter(Boolean).join(", ");
                return (
                  <tr key={v.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-medium truncate max-w-[200px]">{identity}</p>
                      {v.company && v.contactName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{v.company}</p>
                      )}
                      {v.utmCampaign && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {v.utmCampaign}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={v.source === "personalized" ? "default" : "secondary"}>
                        {v.source === "personalized" ? "Known" : "Anonymous"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {loc ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{flagEmoji(v.countryCode)}</span>
                          <span className="truncate max-w-[160px]">{loc}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground capitalize">{v.device || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {v.scrollDepthPct != null ? `${Math.round(v.scrollDepthPct)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {v.clicks != null ? v.clicks : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {v.converted ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Converted" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                      {new Date(v.visitedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isError && total > 0 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} visit{total === 1 ? "" : "s"}
            {isFetching && " · updating…"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">Page {page}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!data?.hasMore}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const RANGES = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

export default function PageDetail() {
  const [, params] = useRoute("/analytics/pages/:pageId");
  const pageId = params?.pageId ? parseInt(params.pageId, 10) : NaN;
  const [days, setDays] = useState(30);

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ["page-summary", pageId, days],
    queryFn: async (): Promise<SummaryResponse> => {
      const r = await fetch(`${API_BASE}/lp/analytics/pages/${pageId}/summary?days=${days}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<SummaryResponse>;
    },
    enabled: Number.isFinite(pageId),
  });

  if (!Number.isFinite(pageId)) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <p className="text-muted-foreground">Invalid page.</p>
          <Link href="/analytics">
            <a className="text-sm text-primary underline mt-2 inline-block">Back to analytics</a>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const page = summary?.page;
  const m = summary?.metrics;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <Link href="/analytics">
            <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Analytics
            </a>
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {isLoading ? (
                <Skeleton className="h-8 w-64" />
              ) : (
                <h1 className="text-2xl font-bold font-display flex items-center gap-3 min-w-0">
                  <span className="truncate">{page?.title || `Page ${pageId}`}</span>
                  {page?.status && (
                    <Badge variant={statusVariant(page.status)} className="capitalize shrink-0">
                      {page.status}
                    </Badge>
                  )}
                </h1>
              )}
              {page?.slug && <p className="text-sm text-muted-foreground mt-1">/lp/{page.slug}</p>}
            </div>
            <div className="flex items-center gap-2">
              {page?.slug && (
                <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1.5" />
                    View live
                  </Button>
                </a>
              )}
              <Link href={`/builder/${pageId}`}>
                <Button variant="outline" size="sm">
                  <PencilRuler className="w-4 h-4 mr-1.5" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>

          {/* Date range selector */}
          <div className="flex items-center gap-1.5">
            {RANGES.map(r => (
              <Button
                key={r.value}
                size="sm"
                variant={days === r.value ? "default" : "outline"}
                onClick={() => setDays(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary strip */}
        {isError ? (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Could not load this page's summary.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Visits" value={m?.visits.value ?? 0} trend={m?.visits.deltaPct} icon={Users} loading={isLoading} />
            <StatCard label="Conversions" value={m?.conversions.value ?? 0} trend={m?.conversions.deltaPct} icon={Target} loading={isLoading} />
            <StatCard label="CVR" value={m ? `${m.conversionRate.value.toFixed(1)}%` : "0%"} trend={m?.conversionRate.deltaPct} icon={Percent} loading={isLoading} />
            <StatCard label="Known" value={m?.knownVisitors.value ?? 0} trend={m?.knownVisitors.deltaPct} icon={Users} loading={isLoading} />
            <StatCard label="Avg Scroll" value={m ? `${Math.round(m.avgScrollDepth.value)}%` : "0%"} trend={m?.avgScrollDepth.deltaPct} icon={ScrollText} loading={isLoading} />
            <StatCard label="Clicks" value={m?.totalClicks.value ?? 0} trend={m?.totalClicks.deltaPct} icon={MousePointerClick} loading={isLoading} />
          </div>
        )}

        {/* Visits table */}
        <Section title="Visits" icon={TableIcon} description="Every recorded visit, with resolved identity for personalized links.">
          <VisitsTable pageId={pageId} days={days} />
        </Section>

        {/* Two-column analytics grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Conversion Score" icon={Sparkles}>
            <PageConversionScore pageId={pageId} />
          </Section>
          <Section title="Page Speed" icon={Gauge}>
            <PageSpeedPanel pageId={pageId} />
          </Section>
          <Section title="Traffic Sources" icon={Globe}>
            <PageTrafficSources pageId={pageId} days={days} />
          </Section>
          <Section title="A/B Tests" icon={FlaskConical}>
            <AbTestsSection pageId={pageId} />
          </Section>
          <Section title="Programmatic Variables" icon={MapIcon}>
            <PageProgrammaticVars pageId={pageId} />
          </Section>
          <Section title="Ad Map" icon={Megaphone}>
            <AdMapSection pageId={pageId} />
          </Section>
        </div>

        {/* Heatmap (lazy — heavy) */}
        <Section title="Heatmap" icon={MousePointerClick} description="Click and scroll behavior across this page.">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <HeatmapOverlay pageId={pageId} />
          </Suspense>
        </Section>
      </div>
    </AppLayout>
  );
}
