import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Globe } from "lucide-react";

const API_BASE = "/api";

export interface TrafficSource {
  source: string;
  visits: number;
  conversions: number;
  cvr: number;
}

interface TrafficSourcesResponse {
  sources: TrafficSource[];
}

async function fetchTrafficSources(pageId: number, days: number): Promise<TrafficSourcesResponse> {
  const r = await fetch(`${API_BASE}/lp/analytics/pages/${pageId}/traffic-sources?days=${days}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<TrafficSourcesResponse>;
}

export function PageTrafficSources({ pageId, days = 30 }: { pageId: number; days?: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["page-traffic-sources", pageId, days],
    queryFn: () => fetchTrafficSources(pageId, days),
    enabled: Number.isFinite(pageId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Could not load traffic sources.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sources = data?.sources ?? [];

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No traffic recorded for this page yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxVisits = Math.max(...sources.map((s) => s.visits), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="font-medium px-3 py-2">Source</th>
            <th className="font-medium px-3 py-2 text-right">Visits</th>
            <th className="font-medium px-3 py-2 text-right">Conversions</th>
            <th className="font-medium px-3 py-2 text-right">CVR</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s, idx) => (
            <tr key={`${s.source}-${idx}`} className="border-b hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate max-w-[200px]">{s.source}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5 max-w-[200px]">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${(s.visits / maxVisits) * 100}%` }}
                  />
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold">{s.visits.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right">{s.conversions.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{s.cvr}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PageTrafficSources;
