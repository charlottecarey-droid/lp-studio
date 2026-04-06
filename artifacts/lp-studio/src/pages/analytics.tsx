import { useEffect, useState } from "react";
import { MapPin, Globe, TrendingUp, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = "/api";

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

function useLocations() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_BASE}/lp/analytics/locations`).then(r => r.json() as Promise<CityRow[]>),
      fetch(`${API_BASE}/lp/analytics/countries`).then(r => r.json() as Promise<CountryRow[]>),
    ])
      .then(([c, co]) => { setCities(c); setCountries(co); })
      .catch(() => setError("Failed to load analytics data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  return { cities, countries, loading, error, reload: load };
}

function flagEmoji(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(
    countryCode.toUpperCase().charCodeAt(0) + offset,
    countryCode.toUpperCase().charCodeAt(1) + offset,
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

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[...Array(6)].map((_, i) => (
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

export default function AnalyticsPage() {
  const { cities, countries, loading, error, reload } = useLocations();

  const totalVisits = countries.reduce((s, r) => s + r.count, 0);
  const topCities = cities.slice(0, 20);
  const topCountries = countries.slice(0, 10);
  const maxCity = topCities[0]?.count ?? 1;
  const maxCountry = topCountries[0]?.count ?? 1;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Visitor Locations</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Where your page visitors are coming from, based on their IP address.
            </p>
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Total Visitors
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-5">
              {loading ? <Skeleton className="h-7 w-16" /> : (
                <p className="text-2xl font-bold">{totalVisits.toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Countries
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-5">
              {loading ? <Skeleton className="h-7 w-10" /> : (
                <p className="text-2xl font-bold">{countries.length}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Cities
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-5">
              {loading ? <Skeleton className="h-7 w-10" /> : (
                <p className="text-2xl font-bold">{cities.length}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

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
            {/* Top Countries */}
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
                    key={row.country}
                    label={row.country || "Unknown"}
                    count={row.count}
                    max={maxCountry}
                    flag={flagEmoji(row.countryCode)}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Top Cities */}
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
      </div>
    </AppLayout>
  );
}
