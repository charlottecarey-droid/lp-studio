import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Eye, FolderOpen, ScanEye, UserCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content Hub — per-resource engagement for one page: the funnel from seen
 * (card scrolled into view) through viewed (in-page viewer) / opened (new
 * tab) to downloaded, the people who acted, and how many of them are
 * identified through the resource gate. Reads
 * GET /api/lp/analytics/pages/:pageId/assets and renders NOTHING when the
 * page has recorded no asset events, so non-hub pages never show an empty
 * panel. The tenant-wide view lives in Analytics → Resources.
 */
interface AssetRow {
  assetKey: string;
  assetKind: "pdf" | "video" | "link" | string;
  assetTitle: string | null;
  seen: number;
  views: number;
  opens: number;
  downloads: number;
  uniqueSessions: number;
  identified: number;
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
    (acc, r) => ({ opened: acc.opened + r.views + r.opens, downloads: acc.downloads + r.downloads, identified: acc.identified + (r.identified ?? 0) }),
    { opened: 0, downloads: 0, identified: 0 },
  );
  const rate = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");

  return (
    <Card>
      <CardHeader className="space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              Resource engagement
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Seen → opened → downloaded, per resource. {totals.opened} opens · {totals.downloads} downloads{totals.identified > 0 ? ` · ${totals.identified} identified` : ""} in the last {days} days.
            </p>
          </div>
          <Link href={`/analytics/resources?pageId=${pageId}`} className="text-xs text-primary hover:underline whitespace-nowrap">
            All resources →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Resource</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><ScanEye className="w-3.5 h-3.5" />Seen</span></th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />Viewed</span></th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" />Opened</span></th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />Downloaded</span></th>
                <th className="py-2 pr-3 font-medium text-right" title="Opened or downloaded ÷ seen">Open rate</th>
                <th className="py-2 pr-3 font-medium text-right"><span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />Sessions</span></th>
                <th className="py-2 font-medium text-right"><span className="inline-flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />Identified</span></th>
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
                  <td className="py-2 pr-3 text-right tabular-nums">{r.seen ?? 0}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.views}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.opens}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.downloads}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{rate(r.uniqueSessions, r.seen ?? 0)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.uniqueSessions}</td>
                  <td className="py-2 text-right tabular-nums">{r.identified ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
