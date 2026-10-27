import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Eye, FolderOpen, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content Hub — per-resource engagement for one page (views in the in-page
 * viewer, opens in a new tab, downloads, unique sessions). Reads
 * GET /api/lp/analytics/pages/:pageId/assets and renders NOTHING when the
 * page has recorded no asset events, so non-hub pages never show an empty
 * panel.
 */
interface AssetRow {
  assetKey: string;
  assetKind: "pdf" | "video" | "link" | string;
  assetTitle: string | null;
  views: number;
  opens: number;
  downloads: number;
  uniqueSessions: number;
  lastAt: string | null;
}

const KIND_LABEL: Record<string, string> = { pdf: "PDF", video: "Video", link: "Link" };

export function PageAssetEngagement({ pageId, days }: { pageId: number; days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["page-assets", pageId, days],
    queryFn: async () => {
      const r = await fetch(`/api/lp/analytics/pages/${pageId}/assets?days=${days}`);
      if (!r.ok) throw new Error("Failed to load asset engagement");
      return (await r.json()) as { days: number; assets: AssetRow[] };
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  const rows = data?.assets ?? [];
  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, r) => ({ views: acc.views + r.views + r.opens, downloads: acc.downloads + r.downloads }),
    { views: 0, downloads: 0 },
  );

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          Resource engagement
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          How much each resource in this hub is being opened and downloaded. {totals.views} opens · {totals.downloads} downloads in the last {days} days.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Resource</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />Viewed</span></th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Opened</span></th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />Downloaded</span></th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />People</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assetKey} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium truncate max-w-[360px]">{r.assetTitle || r.assetKey}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{r.assetKey}</div>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{KIND_LABEL[r.assetKind] ?? r.assetKind}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.views}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.opens}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.downloads}</td>
                  <td className="py-2 text-right tabular-nums">{r.uniqueSessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
