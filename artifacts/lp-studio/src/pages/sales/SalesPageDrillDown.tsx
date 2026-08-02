import { useEffect, useState } from "react";
import { Link } from "wouter";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Bell,
  BellRing,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MousePointerClick,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { getLpPageUrl } from "@/lib/utils";
import {
  ComposeButtons,
  useEmailPreviewCopy,
  useOutreachTemplates,
  type ComposeTarget,
} from "@/components/sales/EmailPreviewModal";
import { fmtDwell, initials, type AlertEmail, type PageRow } from "./sales-pages-shared";

const API_BASE = "/api";

/**
 * Sales Pages drill-down — the slide-over a rep opens by clicking a table row.
 *
 * Combines two data sources:
 *   - the marketing per-page analytics endpoints
 *     (/lp/analytics/pages/:id/summary | traffic-sources | visits), which are
 *     tenant-scoped and already de-anonymize form-filling visitors, and
 *   - /sales/pages/:id/engagement for the sales-only slice: per-hotlink view
 *     counts, the full known-viewer list, and the dwell trend.
 *
 * Alert state lives in the PARENT (the table pre-loads every page's
 * subscriptions and the bell in each row must stay in sync), so alert
 * mutations arrive as callbacks.
 */

interface SummaryMetrics {
  visits: { value: number; deltaPct: number | null };
  uniqueVisitors: { value: number; deltaPct: number | null };
  leads: { value: number; deltaPct: number | null };
  conversionRate: { value: number; deltaPct: number | null };
}

interface EngagementData {
  windowDays: number;
  dwell: { avgSeconds: number | null; samples: number; prevAvgSeconds: number | null };
  knownViewers: { contactId: number; name: string; views: number; lastViewedAt: string }[];
  hotlinks: {
    hotlinkId: number;
    token: string;
    createdAt: string;
    contactId: number | null;
    contactName: string;
    views: number;
    lastViewedAt: string | null;
  }[];
}

interface VisitRow {
  id: string | number;
  source: string;
  resolved: boolean;
  visitedAt: string;
  contactName: string | null;
  company: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  scrollDepthPct: number | null;
  /** Tab-visible seconds for this single visit. null = predates dwell
   *  tracking, or the visitor left before the first flush. */
  dwellSeconds: number | null;
  clicks: number;
  converted: boolean;
}

interface SourceRow {
  source: string;
  visits: number;
  conversions: number;
  cvr: number;
}

interface Props {
  /** Row to drill into; null = closed. */
  row: PageRow | null;
  windowDays: number;
  myEmail: string;
  micrositeDomain: string | null;
  tenantHost: string | null;
  /** Parent-owned alert subscriptions for this page (pre-loaded per page). */
  alertEmails: AlertEmail[];
  alertSaving: boolean;
  onAddAlert: (pageId: number, email: string) => Promise<void>;
  onRemoveAlert: (alertId: number, pageId: number) => Promise<void>;
  /** Open the parent's create-links / manage-links modals. */
  onCreateLinks: (pageId: number, pageTitle: string) => void;
  onManageLinks: (row: PageRow) => void;
  onClose: () => void;
}

function DeltaBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null) return null;
  const up = deltaPct >= 0;
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(deltaPct))}%
    </span>
  );
}

export function SalesPageDrillDown({
  row,
  windowDays,
  myEmail,
  micrositeDomain,
  tenantHost,
  alertEmails,
  alertSaving,
  onAddAlert,
  onRemoveAlert,
  onCreateLinks,
  onManageLinks,
  onClose,
}: Props) {
  const pageId = row?.pageId ?? null;

  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitsPage, setVisitsPage] = useState(1);
  const [visitsHasMore, setVisitsHasMore] = useState(false);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  // Shared with the Pages-table modal: same copy semantics, same compose
  // behaviour (a clipboard failure must never swallow the draft). Keyed by
  // hotlink token here — the contact is already fixed per row, so this surface
  // offers the drafts directly instead of a choose-a-link modal.
  const outreach = useOutreachTemplates();
  const { busyKey: previewBusyToken, copiedKey: previewCopiedToken, copyPreview } = useEmailPreviewCopy(outreach);
  const [alertInput, setAlertInput] = useState("");
  const [alertToggling, setAlertToggling] = useState(false);

  // Fetch everything when a row opens. `pageId` is the dependency so
  // switching rows without closing refetches cleanly.
  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    setLoading(true);
    setMetrics(null);
    setEngagement(null);
    setSources(null);
    setVisits([]);
    setVisitsPage(1);
    setVisitsHasMore(false);
    setAlertInput("");
    Promise.all([
      fetch(`${API_BASE}/lp/analytics/pages/${pageId}/summary?days=${windowDays}`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/sales/pages/${pageId}/engagement?days=${windowDays}`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/lp/analytics/pages/${pageId}/traffic-sources?days=${windowDays}`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/lp/analytics/pages/${pageId}/visits?days=${windowDays}&limit=25&page=1`).then(r => r.ok ? r.json() : null),
    ])
      .then(([summary, eng, srcs, vis]) => {
        if (cancelled) return;
        setMetrics(summary?.metrics ?? null);
        setEngagement(eng ?? null);
        setSources(srcs?.sources ?? []);
        setVisits(vis?.visits ?? []);
        setVisitsHasMore(Boolean(vis?.hasMore));
      })
      .catch(err => console.error("Failed to load page drill-down:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageId, windowDays]);

  async function loadMoreVisits() {
    if (!pageId || visitsLoading) return;
    setVisitsLoading(true);
    try {
      const next = visitsPage + 1;
      const res = await fetch(`${API_BASE}/lp/analytics/pages/${pageId}/visits?days=${windowDays}&limit=25&page=${next}`);
      if (res.ok) {
        const data = await res.json();
        setVisits(prev => [...prev, ...(data.visits ?? [])]);
        setVisitsPage(next);
        setVisitsHasMore(Boolean(data.hasMore));
      }
    } finally {
      setVisitsLoading(false);
    }
  }

  function copyHotlink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/p/${token}`).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  /** Copy the card for one hotlink, optionally opening a prefilled draft.
   *  The address rides on the parent row's hotlink (the engagement payload
   *  carries no email), matched by contact. */
  function copyPreviewForToken(token: string, contactId: number | null, name: string, target?: ComposeTarget) {
    if (!row) return;
    const email = row.hotlinks.find(hl => hl.contactId === contactId)?.contactEmail ?? null;
    void copyPreview({
      key: token,
      pageId: row.pageId,
      pageUrl: `${window.location.origin}/p/${token}`,
      title: row.pageTitle,
      ...(target ? { compose: { target, to: email, firstName: name } } : {}),
    });
  }

  const mineSub = alertEmails.find(ae => ae.email.toLowerCase() === myEmail);
  async function toggleMine() {
    if (!pageId || !myEmail || alertToggling) return;
    setAlertToggling(true);
    try {
      if (mineSub) await onRemoveAlert(mineSub.id, pageId);
      else await onAddAlert(pageId, myEmail);
    } finally {
      setAlertToggling(false);
    }
  }

  const pageUrl = row ? getLpPageUrl(row.pageSlug, micrositeDomain, tenantHost) : "#";
  const dwell = engagement?.dwell;
  const dwellDelta =
    dwell && dwell.avgSeconds != null && dwell.prevAvgSeconds != null && dwell.prevAvgSeconds > 0
      ? ((dwell.avgSeconds - dwell.prevAvgSeconds) / dwell.prevAvgSeconds) * 100
      : null;

  return (
    <Sheet open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {row && (
          <div className="flex flex-col gap-5">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                {row.pageTitle}
                <StatusBadge status={row.pageStatus}>{row.pageStatus === "published" ? "Published" : "Draft"}</StatusBadge>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                {row.accountName && (
                  <Link href={`/sales/accounts/${row.accountId}`}>
                    <span className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
                      <Building2 className="w-3.5 h-3.5" />{row.accountName}
                    </span>
                  </Link>
                )}
                <span className="font-mono text-xs">/{row.pageSlug}</span>
                <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
                <Link href={`/builder/${row.pageId}`}>
                  <span className="inline-flex items-center gap-1 text-xs hover:text-foreground transition-colors cursor-pointer">
                    <Pencil className="w-3 h-3" /> Edit
                  </span>
                </Link>
              </SheetDescription>
            </SheetHeader>

            {/* ── Stat strip (last N days vs the N before) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Views", value: metrics?.visits.value, delta: metrics?.visits.deltaPct ?? null },
                { label: "Unique visitors", value: metrics?.uniqueVisitors.value, delta: metrics?.uniqueVisitors.deltaPct ?? null },
                { label: "Leads", value: metrics?.leads.value, delta: metrics?.leads.deltaPct ?? null },
                { label: "Avg time", value: dwell ? fmtDwell(dwell.avgSeconds) : undefined, delta: dwellDelta },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  {loading && stat.value === undefined ? (
                    <Skeleton className="h-6 w-12 mt-1 rounded" />
                  ) : (
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">{stat.value ?? "—"}</span>
                      <DeltaBadge deltaPct={stat.delta} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-3">Last {windowDays} days, compared to the {windowDays} before.</p>

            <Tabs defaultValue="visitors">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="visitors">Visitors</TabsTrigger>
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="alerts">Alerts</TabsTrigger>
              </TabsList>

              {/* ── Visitors ── */}
              <TabsContent value="visitors" className="flex flex-col gap-4 pt-3">
                {engagement && engagement.knownViewers.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Known viewers · all time
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {engagement.knownViewers.map(v => (
                        <Link key={v.contactId} href={`/sales/contacts/${v.contactId}`}>
                          <span className="inline-flex items-center gap-1.5 text-xs pl-1 pr-2.5 py-1 rounded-full bg-background border border-border hover:border-primary/40 transition-colors cursor-pointer">
                            <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">{initials(v.name)}</span>
                            <span className="text-foreground font-medium">{v.name}</span>
                            <span className="text-muted-foreground">{v.views}× · {formatDistanceToNowStrict(new Date(v.lastViewedAt))} ago</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Recent visits
                  </p>
                  {loading ? (
                    <div className="flex flex-col gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
                  ) : visits.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3">No visits in the last {windowDays} days.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border/50 rounded-lg border border-border overflow-hidden">
                      {/* Column headers — the per-visit numbers were bare
                          values with only a hover title, so "89%" read as
                          anyone's guess. Widths here must match the row cells
                          below or the labels drift out of alignment. */}
                      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/40">
                        <span className="w-6 shrink-0" aria-hidden />
                        <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Visitor</span>
                        <span className="w-14 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</span>
                        <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scroll</span>
                        <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">When</span>
                      </div>
                      {visits.map(v => {
                        const known = v.source !== "anonymous" || v.resolved;
                        const who = v.contactName || v.email || v.company;
                        const where = [v.city, v.region || v.country].filter(Boolean).join(", ");
                        return (
                          <div key={`${v.source}-${v.id}`} className="flex items-center gap-2.5 px-3 py-2 bg-background">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${known ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {known && who ? initials(who) : <Users className="w-3 h-3" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {known ? (who ?? "Known visitor") : "Anonymous visitor"}
                                {v.company && who !== v.company && <span className="text-muted-foreground font-normal"> · {v.company}</span>}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[
                                  where || null,
                                  v.utmSource ? `via ${v.utmSource}` : null,
                                ].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                            {v.source === "personalized" && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-primary/10 text-primary shrink-0">Link</span>
                            )}
                            {v.resolved && v.source === "anonymous" && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-emerald-100 text-emerald-700 shrink-0">Lead</span>
                            )}
                            {v.converted && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-emerald-100 text-emerald-700 shrink-0">Converted</span>
                            )}
                            <span
                              className={`w-14 shrink-0 text-right text-[11px] tabular-nums ${v.dwellSeconds != null ? "text-foreground" : "text-muted-foreground/50"}`}
                              title={v.dwellSeconds != null ? "Time on page for this visit" : "No time recorded for this visit"}
                            >
                              {fmtDwell(v.dwellSeconds)}
                            </span>
                            <span
                              className={`w-12 shrink-0 text-right text-[11px] tabular-nums ${v.scrollDepthPct != null ? "text-foreground" : "text-muted-foreground/50"}`}
                              title={v.scrollDepthPct != null ? "How far down the page they scrolled" : "No scroll recorded for this visit"}
                            >
                              {v.scrollDepthPct != null ? `${Math.round(v.scrollDepthPct)}%` : "—"}
                            </span>
                            <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNowStrict(new Date(v.visitedAt), { addSuffix: false })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {visitsHasMore && (
                    <Button variant="outline" size="sm" className="mt-2 h-7 text-xs w-full" disabled={visitsLoading} onClick={loadMoreVisits}>
                      {visitsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Load more"}
                    </Button>
                  )}
                </div>
              </TabsContent>

              {/* ── Links ── */}
              <TabsContent value="links" className="flex flex-col gap-3 pt-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onCreateLinks(row.pageId, row.pageTitle)}>
                    <Plus className="w-3 h-3" /> New links
                  </Button>
                  {row.hotlinks.length > 0 && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onManageLinks(row)}>
                      <Pencil className="w-3 h-3" /> Manage
                    </Button>
                  )}
                </div>
                {loading ? (
                  <div className="flex flex-col gap-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
                ) : !engagement || engagement.hotlinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3">
                    No personalized links yet — create one per contact so every visit is attributed to a person.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border/50 rounded-lg border border-border overflow-hidden">
                    {engagement.hotlinks.map(hl => (
                      <div key={hl.hotlinkId} className="flex items-center gap-2.5 px-3 py-2 bg-background">
                        <span className="w-6 h-6 rounded-full bg-muted-foreground/10 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                          {initials(hl.contactName)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {hl.contactName || <span className="text-muted-foreground italic font-normal">Unknown contact</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">/p/{hl.token}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums shrink-0" title="Views via this link">
                          <MousePointerClick className="w-3 h-3" />
                          {hl.views}
                        </span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 w-20 text-right">
                          {hl.lastViewedAt ? `${formatDistanceToNowStrict(new Date(hl.lastViewedAt))} ago` : "never"}
                        </span>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                          title="Copy link"
                          onClick={() => copyHotlink(hl.token)}
                        >
                          {copiedToken === hl.token ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                          title="Copy email preview — a linked screenshot that pastes into an email"
                          disabled={previewBusyToken !== null}
                          onClick={() => copyPreviewForToken(hl.token, hl.contactId, hl.contactName)}
                        >
                          {previewBusyToken === hl.token
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : previewCopiedToken === hl.token
                              ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                              : <Mail className="w-3.5 h-3.5" />}
                        </Button>
                        <ComposeButtons
                          disabled={previewBusyToken !== null}
                          name={hl.contactName}
                          email={row.hotlinks.find(r => r.contactId === hl.contactId)?.contactEmail ?? null}
                          onCompose={target => copyPreviewForToken(hl.token, hl.contactId, hl.contactName, target)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Sources ── */}
              <TabsContent value="sources" className="pt-3">
                {loading ? (
                  <div className="flex flex-col gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 rounded-lg" />)}</div>
                ) : !sources || sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3">No traffic in the last {windowDays} days.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {(() => {
                      const max = Math.max(...sources.map(s => s.visits), 1);
                      return sources.map(s => (
                        <div key={s.source} className="flex items-center gap-2.5">
                          <span className="text-xs text-foreground w-32 truncate shrink-0" title={s.source}>{s.source}</span>
                          <div className="flex-1 h-4 rounded bg-muted/50 overflow-hidden">
                            <div className="h-full rounded bg-primary/25" style={{ width: `${Math.max(3, (s.visits / max) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-foreground tabular-nums w-10 text-right shrink-0">{s.visits}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums w-14 text-right shrink-0" title="Conversion rate">{s.cvr}% cvr</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </TabsContent>

              {/* ── Alerts ── */}
              <TabsContent value="alerts" className="flex flex-col gap-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  Everyone below gets an email the moment a known contact opens this page.
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {alertEmails.map(ae => (
                    <span key={ae.id} className="inline-flex items-center gap-1 text-xs bg-background border border-border text-muted-foreground px-2 py-0.5 rounded-md">
                      <Mail className="w-3 h-3" />
                      {ae.email}
                      {ae.email.toLowerCase() === myEmail && <span className="text-[9px] font-bold uppercase text-primary">you</span>}
                      <button onClick={() => void onRemoveAlert(ae.id, row.pageId)} className="ml-0.5 text-muted-foreground/50 hover:text-foreground transition-colors" title="Remove">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {alertEmails.length === 0 && <span className="text-xs text-muted-foreground/60">No subscribers yet.</span>}
                </div>
                {myEmail && (
                  <Button size="sm" variant={mineSub ? "outline" : "default"} className="h-8 text-xs gap-1.5 self-start" disabled={alertToggling} onClick={() => void toggleMine()}>
                    {alertToggling
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : mineSub ? <><Bell className="w-3.5 h-3.5" /> Stop alerting me</> : <><BellRing className="w-3.5 h-3.5" /> Alert me on every visit</>}
                  </Button>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    type="email"
                    value={alertInput}
                    onChange={e => setAlertInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && alertInput.trim()) { void onAddAlert(row.pageId, alertInput.trim()); setAlertInput(""); } }}
                    placeholder="teammate@email.com"
                    className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 w-56"
                  />
                  <Button
                    size="sm" variant="outline" className="h-7 px-2.5 text-xs"
                    disabled={!alertInput.trim() || alertSaving}
                    onClick={() => { void onAddAlert(row.pageId, alertInput.trim()); setAlertInput(""); }}
                  >
                    {alertSaving ? "Saving…" : "Add teammate"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Alerts fire on personalized-link visits, so create links for the contacts you care about.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
