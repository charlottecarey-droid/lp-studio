import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Download, ExternalLink, FolderOpen, Layers, ScanEye, UserCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Analytics → Resources. Tenant-wide Content Hub engagement from
 * GET /api/lp/analytics/resources: the seen → opened → downloaded funnel per
 * resource across every hub page, a per-page roll-up, and the people
 * identified through a resource gate with what they opened. Filterable by
 * page (`?pageId=` deep-links from a page's own analytics panel).
 */
interface Totals {
  resources: number;
  seenSessions: number;
  views: number;
  opens: number;
  downloads: number;
  activeSessions: number;
  sessions: number;
  identified: number;
}
interface AssetRow {
  pageId: number;
  pageTitle: string | null;
  pageSlug: string | null;
  assetKey: string;
  assetKind: string;
  assetTitle: string | null;
  seen: number;
  views: number;
  opens: number;
  downloads: number;
  uniqueSessions: number;
  identified: number;
  lastAt: string | null;
}
interface PageRow {
  pageId: number;
  pageTitle: string | null;
  pageSlug: string | null;
  resources: number;
  seenSessions: number;
  opened: number;
  downloads: number;
  activeSessions: number;
  identified: number;
  lastAt: string | null;
}
interface PersonRow {
  leadId: number;
  email: string | null;
  name: string | null;
  company: string | null;
  opened: number;
  downloads: number;
  resources: number;
  lastAsset: string | null;
  lastAt: string | null;
}
interface ResourcesData {
  days: number;
  pageId: number | null;
  totals: Totals;
  assets: AssetRow[];
  pages: PageRow[];
  people: PersonRow[];
}

const KIND_LABEL: Record<string, string> = { pdf: "PDF", video: "Video", link: "Link" };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
const rate = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");

function Stat({ label, value, hint, icon: Icon, loading }: { label: string; value: string | number; hint?: string; icon: React.ComponentType<{ className?: string }>; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </span>
        {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>}
        {hint && !loading && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Th({ children, right, title }: { children: React.ReactNode; right?: boolean; title?: string }) {
  return <th className={`py-2 pr-3 font-medium ${right ? "text-right" : "text-left"}`} title={title}>{children}</th>;
}

export function ResourcesTab({ days, active }: { days: number; active: boolean }) {
  const [location] = useLocation();
  const initialPage = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("pageId")) || null : null;
  const [pageId, setPageId] = useState<number | null>(initialPage);
  const [data, setData] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Page options come from an unfiltered load so the filter keeps listing
  // every hub page while one is selected.
  const [pageOptions, setPageOptions] = useState<PageRow[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const q = `days=${days}${pageId ? `&pageId=${pageId}` : ""}`;
    Promise.all([
      fetch(`/api/lp/analytics/resources?${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("load")))),
      pageId ? fetch(`/api/lp/analytics/resources?days=${days}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
    ])
      .then(([d, all]: [ResourcesData, ResourcesData | null]) => {
        if (cancelled) return;
        setData(d);
        setPageOptions((all ?? d).pages ?? []);
      })
      .catch(() => !cancelled && setError("Failed to load resource analytics"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [active, days, pageId, location]);

  const t = data?.totals;
  const opened = (t?.views ?? 0) + (t?.opens ?? 0);

  return (
    <div className="space-y-6" data-testid="resources-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Content Hub resources across every hub page: what visitors saw, opened and downloaded, and who they are once a gate identifies them.
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Page
          <select
            value={pageId ?? ""}
            onChange={(e) => setPageId(e.target.value ? Number(e.target.value) : null)}
            className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
            aria-label="Filter by page"
          >
            <option value="">All hub pages</option>
            {pageOptions.map((p) => (
              <option key={p.pageId} value={p.pageId}>{p.pageTitle || p.pageSlug || `Page ${p.pageId}`}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat label="Resources" value={t?.resources ?? 0} hint="with any activity" icon={Layers} loading={loading} />
        <Stat label="Seen" value={t?.seenSessions ?? 0} hint="sessions that scrolled a resource into view" icon={ScanEye} loading={loading} />
        <Stat label="Opened" value={opened} hint={`${t?.views ?? 0} in-page · ${t?.opens ?? 0} new tab`} icon={ExternalLink} loading={loading} />
        <Stat label="Downloads" value={t?.downloads ?? 0} icon={Download} loading={loading} />
        <Stat label="Active sessions" value={t?.activeSessions ?? 0} hint={`${rate(t?.activeSessions ?? 0, t?.seenSessions ?? 0)} of seen`} icon={Users} loading={loading} />
        <Stat label="Identified" value={t?.identified ?? 0} hint="people known through a gate" icon={UserCheck} loading={loading} />
      </div>

      {!loading && data && data.assets.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No resource activity in the last {days} days. Content Hub pages start reporting as soon as a visitor scrolls a resource into view.
          </CardContent>
        </Card>
      )}

      {(loading || (data && data.pages.length > 0)) && !pageId && (
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="w-4 h-4 text-muted-foreground" />By page</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <Th>Page</Th><Th right>Resources</Th><Th right>Seen</Th><Th right>Opened</Th><Th right>Downloads</Th><Th right title="Sessions that opened or downloaded ÷ sessions that saw a resource">Open rate</Th><Th right>Identified</Th><Th right>Last</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.pages.map((p) => (
                      <tr key={p.pageId} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Link href={`/analytics/pages/${p.pageId}`} className="font-medium hover:underline">{p.pageTitle || p.pageSlug || `Page ${p.pageId}`}</Link>
                          {p.pageSlug && <div className="text-[11px] text-muted-foreground font-mono">/{p.pageSlug}</div>}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.resources}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.seenSessions}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.opened}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.downloads}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{rate(p.activeSessions, p.seenSessions)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.identified}</td>
                        <td className="py-2 text-right text-muted-foreground">{fmtDate(p.lastAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(loading || (data && data.assets.length > 0)) && (
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" />Resources</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Seen → opened → downloaded. Open rate is sessions that opened or downloaded, over sessions that saw the card.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <Th>Resource</Th><Th>Type</Th>{!pageId && <Th>Page</Th>}<Th right>Seen</Th><Th right>Viewed</Th><Th right>Opened</Th><Th right>Downloads</Th><Th right>Open rate</Th><Th right>Sessions</Th><Th right>Identified</Th><Th right>Last</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.assets.map((r) => (
                      <tr key={`${r.pageId}-${r.assetKey}`} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium truncate max-w-[320px]">{r.assetTitle || r.assetKey}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{r.assetKey}</div>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{KIND_LABEL[r.assetKind] ?? r.assetKind}</td>
                        {!pageId && <td className="py-2 pr-3 text-muted-foreground truncate max-w-[180px]">{r.pageTitle || r.pageSlug || r.pageId}</td>}
                        <td className="py-2 pr-3 text-right tabular-nums">{r.seen}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.views}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.opens}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.downloads}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{rate(r.uniqueSessions, r.seen)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.uniqueSessions}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.identified}</td>
                        <td className="py-2 text-right text-muted-foreground">{fmtDate(r.lastAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data && data.people.length > 0 && (
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><UserCheck className="w-4 h-4 text-muted-foreground" />People</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Visitors identified through a resource gate (or a form on the page), with everything they opened since.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <Th>Person</Th><Th>Company</Th><Th right>Opened</Th><Th right>Downloads</Th><Th right>Resources</Th><Th>Last resource</Th><Th right>Last</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.leadId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`/leads?leadId=${p.leadId}`} className="font-medium hover:underline">{p.name || p.email || `Lead ${p.leadId}`}</Link>
                        {p.name && p.email && <div className="text-[11px] text-muted-foreground">{p.email}</div>}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.company || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.opened}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.downloads}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.resources}</td>
                      <td className="py-2 pr-3 truncate max-w-[260px]">{p.lastAsset || "—"}</td>
                      <td className="py-2 text-right text-muted-foreground">{fmtDate(p.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
