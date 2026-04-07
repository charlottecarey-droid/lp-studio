import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import {
  Activity,
  Trash2,
  Filter,
  Globe,
  Mail,
  Building2,
  List,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useLocation, Link } from "wouter";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PageHint } from "@/components/ui/page-hint";
import { InfoTip } from "@/components/ui/info-tip";
import { getSignalIcon, getSignalLabel, SIGNAL_TYPES } from "@/lib/signal-types";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface Signal {
  id: number;
  type: string;
  source: string | null;
  accountId?: number;
  accountName?: string;
  contactName?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AccountForFilter {
  id: number;
  name: string;
  owner: string | null;
  abmTier: string | null;
}

// getSignalIcon, getSignalLabel, and SIGNAL_TYPES imported from @/lib/signal-types

export default function SalesSignals() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [groupByAccount, setGroupByAccount] = useState(false);
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(new Set());

  // Account-level filters inherited from saved view / Accounts page
  const [acctFilterOwners, setAcctFilterOwners] = useState<string[]>([]);
  const [acctFilterTier, setAcctFilterTier] = useState("");
  const [acctFilterViewName, setAcctFilterViewName] = useState<string | null>(null);
  const [acctAccountNames, setAcctAccountNames] = useState<Set<string> | null>(null);
  const [acctBannerDismissed, setAcctBannerDismissed] = useState(false);

  // Read active filters from localStorage (set by accounts page)
  useEffect(() => {
    if (!user?.userId) return;
    const lsKey = `sc_acct_filters_${user.userId}`;
    const viewsKey = `sc_acct_views_${user.userId}`;
    try {
      const stored = JSON.parse(localStorage.getItem(lsKey) ?? "{}") as Record<string, unknown>;
      let owners: string[] = [];
      if (Array.isArray(stored.ownerFilters)) owners = stored.ownerFilters as string[];
      else if (typeof stored.ownerFilter === "string" && stored.ownerFilter) owners = [stored.ownerFilter];
      const tierF = typeof stored.abmTierFilter === "string" ? stored.abmTierFilter : "";
      setAcctFilterOwners(owners);
      setAcctFilterTier(tierF);
      // Try to find the active saved view name
      try {
        const views = JSON.parse(localStorage.getItem(viewsKey) ?? "[]") as Array<{ id: string; name: string; filters: { ownerFilters: string[]; abmTierFilter: string } }>;
        const match = views.find(v =>
          JSON.stringify(v.filters.ownerFilters.slice().sort()) === JSON.stringify(owners.slice().sort()) &&
          v.filters.abmTierFilter === tierF
        );
        setAcctFilterViewName(match?.name ?? null);
      } catch { setAcctFilterViewName(null); }
      if (owners.length > 0 || tierF) {
        fetch(`${API_BASE}/sales/accounts`)
          .then(r => r.ok ? r.json() : [])
          .then((accounts: AccountForFilter[]) => {
            const matching = accounts.filter(a => {
              const matchesOwner = owners.length === 0 || owners.includes(a.owner ?? "");
              const matchesTier = !tierF || a.abmTier === tierF;
              return matchesOwner && matchesTier;
            });
            setAcctAccountNames(new Set(matching.map(a => a.name)));
          })
          .catch(() => {});
      }
    } catch {}
  }, [user?.userId]);

  function fetchSignals() {
    setLoading(true);
    const url = filter
      ? `${API_BASE}/sales/signals?type=${filter}&limit=500`
      : `${API_BASE}/sales/signals?limit=500`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setSignals(Array.isArray(res) ? res : res.data ?? []))
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }

  // Initial fetch
  useEffect(() => { fetchSignals(); }, [filter]);

  // SSE real-time updates with reconnect on error
  useEffect(() => {
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;
    let active = true;

    function connect() {
      if (!active) return;
      es = new EventSource(`${API_BASE}/sales/signals/stream`);
      es.onmessage = (event) => {
        try {
          const signal = JSON.parse(event.data);
          if (signal.type === "connected") return;
          if (filter && signal.type !== filter) return;
          setSignals((prev) => [signal, ...prev].slice(0, 500));
        } catch {}
      };
      es.onerror = () => {
        es.close();
        if (active) retryTimer = setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      active = false;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [filter]);

  async function handleClearAll() {
    setClearing(true);
    try {
      await fetch(`${API_BASE}/sales/signals`, { method: "DELETE" });
      setSignals([]);
      setConfirmClear(false);
    } catch (err) {
      console.error("Failed to clear signals:", err);
    } finally {
      setClearing(false);
    }
  }

  const acctFilterActive = acctAccountNames !== null && !acctBannerDismissed;

  // Apply account filter to signals
  const filteredSignals = acctFilterActive
    ? signals.filter(s => !s.accountName || acctAccountNames!.has(s.accountName))
    : signals;

  // Group signals by account
  const groupedSignals = useMemo(() => {
    if (!groupByAccount) return null;
    const groups = new Map<string, Signal[]>();
    for (const s of filteredSignals) {
      const key = s.accountName || "Unknown Account";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    // Sort groups by most recent signal
    return [...groups.entries()].sort((a, b) => {
      const aLatest = new Date(a[1][0].createdAt).getTime();
      const bLatest = new Date(b[1][0].createdAt).getTime();
      return bLatest - aLatest;
    });
  }, [groupByAccount, filteredSignals]);

  function toggleAccountCollapse(accountName: string) {
    setCollapsedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountName)) next.delete(accountName);
      else next.add(accountName);
      return next;
    });
  }

  const pag = usePagination(filteredSignals, 25);

  // Virtual list
  const signalScrollRef = useRef<HTMLDivElement>(null);
  const signalVirtualizer = useVirtualizer({
    count: filteredSignals.length,
    getScrollElement: () => signalScrollRef.current,
    estimateSize: () => 80,
    overscan: 10,
    measureElement: el => el?.getBoundingClientRect().height ?? 80,
  });

  const types = SIGNAL_TYPES;

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/sales")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back
            </button>
            <h1 className="text-2xl font-display font-bold text-foreground">Activity</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time engagement feed{acctFilterActive ? " — filtered to your active view" : " across all accounts"}
            </p>
          </div>
          {signals.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-muted-foreground">Clear all {signals.length} signals?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {clearing ? "Clearing…" : "Yes, clear all"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmClear(false)} className="text-xs">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmClear(true)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </Button>
            )
          )}
        </div>

        {/* Page Hint */}
        <PageHint
          id="sales-signals"
          title="Real-Time Engagement Signals"
          description="Every time a contact opens an email, visits a microsite, or clicks a personalized link, it appears here. Use these signals to time your follow-ups when prospects are actively engaged."
          tips={[
            "Filter by signal type to focus on what matters — page visits show the strongest intent",
            "Switch to 'By Account' view to see engagement grouped by company",
            "Click any signal to jump to that account's full profile",
          ]}
          color="amber"
          icon={<TrendingUp className="w-5 h-5" />}
        />

        {/* Account filter banner */}
        {acctFilterActive && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/8 border border-primary/20 rounded-xl text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Filter className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {acctFilterViewName
                  ? <><strong>{acctFilterViewName}</strong> — showing signals from filtered accounts</>
                  : <>Showing signals from filtered accounts</>}
                {acctFilterOwners.length === 1 && <strong className="ml-1">{acctFilterOwners[0]}</strong>}
                {acctFilterOwners.length > 1 && <strong className="ml-1">{acctFilterOwners.length} owners</strong>}
                {acctFilterTier && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">{acctFilterTier}</span>}
                <span className="ml-2 text-muted-foreground">({filteredSignals.length} of {signals.length})</span>
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => navigate("/sales/accounts")}
                className="text-xs text-primary hover:underline font-medium"
              >
                Change filters
              </button>
              <button
                onClick={() => { setAcctAccountNames(null); setAcctFilterOwners([]); setAcctFilterTier(""); setAcctFilterViewName(null); setAcctBannerDismissed(true); }}
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Signal type filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(null)}
            className="rounded-lg text-xs"
          >
            All
          </Button>
          {types.map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
              className="rounded-lg text-xs gap-1.5"
            >
              {getSignalIcon(t)}
              {t.replace(/_/g, " ")}
            </Button>
          ))}

          <div className="ml-auto flex items-center gap-1 border border-border rounded-lg overflow-hidden">
            <InfoTip content="Shows all signals in chronological order, most recent first." color="default">
              <button
                onClick={() => setGroupByAccount(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${!groupByAccount ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-3 h-3" />
                Timeline
              </button>
            </InfoTip>
            <InfoTip content="Groups signals by account so you can see each company's engagement pattern." color="default">
              <button
                onClick={() => setGroupByAccount(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${groupByAccount ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Building2 className="w-3 h-3" />
                By Account
              </button>
            </InfoTip>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[56px] rounded-xl" />)}
          </div>
        ) : filteredSignals.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed border-border text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">
              {acctFilterActive ? "No signals for this view" : "No signals yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {acctFilterActive
                ? "There are no signals from accounts in your active view. Try a different view or clear the filter."
                : "Signals appear when contacts view your pages, open emails, click links, or submit forms. Start by creating a microsite and sending outreach."}
            </p>
            {!acctFilterActive && (
              <div className="flex items-center gap-3 mt-4">
                <Link href="/sales/microsites">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Globe className="w-3.5 h-3.5" />
                    Create a Microsite
                  </Button>
                </Link>
                <Link href="/sales/draft-email">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    Draft an Email
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ) : groupByAccount && groupedSignals ? (
          /* ── Grouped by Account view ─── */
          <>
            <p className="text-xs text-muted-foreground px-1">{filteredSignals.length} signal{filteredSignals.length !== 1 ? "s" : ""} across {groupedSignals.length} account{groupedSignals.length !== 1 ? "s" : ""}</p>
            <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto rounded-xl">
              {groupedSignals.map(([accountName, acctSignals]) => {
                const isCollapsed = collapsedAccounts.has(accountName);
                return (
                  <div key={accountName} className="border border-border/60 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleAccountCollapse(accountName)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-foreground flex-1">{accountName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{acctSignals.length} signal{acctSignals.length !== 1 ? "s" : ""}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="flex flex-col divide-y divide-border/40">
                        {acctSignals.map((signal) => (
                          <div key={signal.id} className="flex items-center gap-4 px-5 py-3 bg-card hover:bg-muted/20 transition-colors">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                              {getSignalIcon(signal.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {signal.contactName ?? "Anonymous"}{" "}
                                <span className="text-muted-foreground font-normal">
                                  {getSignalLabel(signal.type).toLowerCase()}
                                </span>
                              </p>
                              {signal.source && <p className="text-xs text-muted-foreground truncate">{signal.source}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(signal.createdAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ── Flat timeline view ─── */
          <>
            <p className="text-xs text-muted-foreground px-1">{filteredSignals.length} signal{filteredSignals.length !== 1 ? "s" : ""}</p>
            <div ref={signalScrollRef} className="h-[70vh] overflow-y-auto rounded-xl">
              <div style={{ height: signalVirtualizer.getTotalSize(), width: "100%", position: "relative" }}>
                {signalVirtualizer.getVirtualItems().map((virtualRow) => {
                  const signal = filteredSignals[virtualRow.index];
                  const rowStyle: CSSProperties = {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  };
                  const dest = signal.accountId
                    ? `/sales/accounts/${signal.accountId}?tab=activity`
                    : "/sales/signals";
                  return (
                    <div
                      key={signal.id}
                      data-index={virtualRow.index}
                      ref={signalVirtualizer.measureElement}
                      style={rowStyle}
                      className="pb-2"
                    >
                      <Link href={dest} className="block text-foreground no-underline">
                        <div className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-xl hover:border-primary/25 hover:bg-muted/20 transition-all cursor-pointer">
                          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                            {getSignalIcon(signal.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {signal.type === "visitor_identified"
                                ? (() => {
                                    const m = signal.metadata as Record<string, string | undefined>;
                                    const personName = [m.firstName, m.lastName].filter(Boolean).join(" ");
                                    const company = signal.accountName ?? m.companyName ?? "Unknown company";
                                    return personName
                                      ? <>{personName} <span className="text-muted-foreground font-normal">· {company}</span></>
                                      : <>{company}</>;
                                  })()
                                : <>{signal.contactName ?? "Anonymous"}{" "}<span className="text-muted-foreground font-normal">{getSignalLabel(signal.type).toLowerCase()}</span></>
                              }
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {signal.type === "visitor_identified"
                                ? (() => {
                                    const m = signal.metadata as Record<string, string | undefined>;
                                    const slug = m.slug ?? (m.pageUrl ? m.pageUrl.split("/").filter(Boolean).pop() : null);
                                    const activity = m.lastActivity || m.activityType?.replace(/_/g, " ");
                                    return <>
                                      {slug
                                        ? <span>Visited <span className="font-mono text-[11px]">/{slug}</span></span>
                                        : activity
                                          ? <span className="capitalize">{activity}</span>
                                          : <span>Identified</span>
                                      }
                                      {signal.source && <><span className="text-border">·</span><span className="capitalize">{signal.source}</span></>}
                                      {m.linkedinUrl && <><span className="text-border">·</span><a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>LinkedIn</a></>}
                                    </>;
                                  })()
                                : <>
                                    {signal.accountName && <span className="font-medium text-muted-foreground">{signal.accountName}</span>}
                                    {signal.source && <><span className="text-border">·</span><span>{signal.source}</span></>}
                                  </>
                              }
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {format(new Date(signal.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </SalesLayout>
  );
}
