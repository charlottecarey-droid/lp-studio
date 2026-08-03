import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Building2, Activity, FileText, ChevronRight,
  Globe, Zap, Mail, PenTool, Flame, Thermometer,
  AlertCircle, ArrowUpRight, Contact, Sparkles,
  ChevronDown, SlidersHorizontal, X,
  Brain, Search,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SalesAssistantBar } from "@/components/sales/SalesAssistantBar";
import { InfoTip } from "@/components/ui/info-tip";
import { SalesLayout } from "@/components/layout/sales-layout";
import { getSignalIcon, getSignalLabel } from "@/lib/signal-types";
import {
  FOURTEEN_DAYS_MS,
  computeHeatScore,
  computeHeatTier,
  normalizeHeatScoringConfig,
  type HeatTier,
} from "@/lib/heat-tier";
import { useAuth } from "@/context/AuthContext";
import { useBrandConfig } from "@/context/BrandConfigContext";
import { GenerateMicrositeModal } from "@/components/sales/GenerateMicrositeModal";

const API_BASE = "/api";

/** Dashboard scope preference. Purely a display default, so localStorage is
 *  the right home for it — unlike saved views, losing it costs nothing. */
const SCOPE_KEY = "sc_dash_scope";
/** Shared empty array so the filter memos keep stable identities. */
const EMPTY_FILTER: string[] = [];

// ── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  name: string;
  displayName?: string;
  domain?: string;
  segment?: string;
  practiceSegment?: string;
  abmTier?: string;
  abmStage?: string;
  owner?: string;
}

interface Signal {
  id: number;
  type: string;
  source?: string;
  metadata?: Record<string, unknown>;
  accountId?: number;
  accountName?: string;
  contactId?: number;
  contactName?: string;
  createdAt: string;
}

interface MicrositeGroup {
  accountId: number;
  accountName: string;
  pages: { pageId: number }[];
}


// ── Account briefing picker (header CTA) ──────────────────────────────────────

function BriefingPickerButton({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...accounts].sort((a, b) =>
      (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
    );
    if (!q) return sorted.slice(0, 8);
    return sorted
      .filter(a =>
        (a.displayName ?? a.name).toLowerCase().includes(q) ||
        (a.domain ?? "").toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [accounts, query]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-lg font-medium text-[13px]">
          <Brain className="w-3.5 h-3.5 mr-1.5" />
          Account briefing
          <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        <DropdownMenuLabel className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground px-2 py-1">
          Generate briefing for…
        </DropdownMenuLabel>
        <div className="px-1.5 py-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search accounts…"
              className="h-8 pl-7 text-[13px]"
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            No matching accounts
          </div>
        ) : (
          filtered.map(a => (
            <Link key={a.id} href={`/sales/accounts/${a.id}`}>
              <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md mx-0.5" onSelect={() => setOpen(false)}>
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{a.displayName ?? a.name}</span>
              </DropdownMenuItem>
            </Link>
          ))
        )}
        <DropdownMenuSeparator />
        <Link href="/sales/accounts">
          <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md mx-0.5 text-muted-foreground" onSelect={() => setOpen(false)}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="text-[12px]">View all accounts</span>
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Engagement scoring ────────────────────────────────────────────────────────
// Weighted recent-engagement score + heat tier live in the shared @/lib/heat-tier
// module (imported above) so the dashboard and the Accounts page stay in lockstep.

const HEAT_CONFIG = {
  hot:  { label: "Hot",  icon: <Flame className="w-3 h-3" />,       className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400" },
  warm: { label: "Warm", icon: <Thermometer className="w-3 h-3" />, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400" },
  cool: { label: "Warming Up", icon: <Zap className="w-3 h-3" />,    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400" },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SalesDashboard() {
  const { user } = useAuth();
  const lsKey = user?.userId ? `sc_acct_filters_${user.userId}` : null;
  const viewsKey = user?.userId ? `sc_acct_views_${user.userId}` : null;

  function readLsArr(key: string): string[] {
    if (!lsKey) return [];
    try {
      const stored = JSON.parse(localStorage.getItem(lsKey) ?? "{}") as Record<string, unknown>;
      if (Array.isArray(stored[key])) return stored[key] as string[];
      if (key === "ownerFilters" && typeof stored.ownerFilter === "string" && stored.ownerFilter) return [stored.ownerFilter];
      if (key === "abmTierFilters" && typeof stored.abmTierFilter === "string" && stored.abmTierFilter) return [stored.abmTierFilter];
      return [];
    } catch { return []; }
  }

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [micrositeGroups, setMicrositeGroups] = useState<MicrositeGroup[]>([]);
  const [signalsToday, setSignalsToday] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Filter state — same localStorage key as the Accounts page
  /** Dashboard scope: just mine, or the whole team's. Everything richer —
   *  tier, stage, segment, saved views — lives on Accounts, which is the one
   *  place that filters accounts now. */
  const [mineOnly, setMineOnly] = useState<boolean>(() => {
    try { return localStorage.getItem(SCOPE_KEY) !== "all"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(SCOPE_KEY, mineOnly ? "mine" : "all"); } catch { /* private mode */ }
  }, [mineOnly]);
  const ownerFilters = useMemo(
    () => (mineOnly && user?.name ? [user.name] : []),
    [mineOnly, user?.name],
  );
  const [showNewMicrosite, setShowNewMicrosite] = useState(false);
  const abmTierFilters: string[] = EMPTY_FILTER;
  const abmStageFilters: string[] = EMPTY_FILTER;
  const segmentFilters: string[] = EMPTY_FILTER;

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/signals?limit=300`).then(r => r.ok ? r.json() : { data: [] }).then(r => Array.isArray(r) ? r : r.data ?? []),
      fetch(`${API_BASE}/sales/microsites/overview`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/stats`).then(r => r.ok ? r.json() : { signalsToday: 0 }),
    ])
      .then(([accts, sigs, overview, serverStats]) => {
        setAccounts(Array.isArray(accts) ? accts : []);
        setSignals(Array.isArray(sigs) ? sigs : []);
        setMicrositeGroups(Array.isArray(overview) ? overview : []);
        setSignalsToday(serverStats.signalsToday ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Computed data ─────────────────────────────────────────────────────────

  const uniqueOwners     = useMemo(() => Array.from(new Set(accounts.map(a => a.owner).filter(Boolean))).sort() as string[], [accounts]);
  const uniqueAbmTiers   = useMemo(() => Array.from(new Set(accounts.map(a => a.abmTier).filter(Boolean))).sort() as string[], [accounts]);
  const uniqueAbmStages  = useMemo(() => Array.from(new Set(accounts.map(a => a.abmStage).filter(Boolean))).sort() as string[], [accounts]);
  const uniqueSegments   = useMemo(() => Array.from(new Set(accounts.map(a => a.practiceSegment).filter(Boolean))).sort() as string[], [accounts]);

  // Workspace-configurable heat scoring (points per signal + tier thresholds).
  const { brand } = useBrandConfig();
  const isDandy = brand?.isDandy === true;
  const heatScoring = useMemo(() => normalizeHeatScoringConfig(brand.heatScoring), [brand.heatScoring]);

  const { hotAccounts, needsAttention, hotCount, filteredAccountCount } = useMemo(() => {
    if (!accounts.length) return { hotAccounts: [], needsAttention: [], hotCount: 0, filteredAccountCount: 0 };

    const now = Date.now();

    // Build microsite lookup: accountId → page count
    const micrositeCounts = new Map<number, number>();
    for (const g of micrositeGroups) {
      if (g.accountId > 0) micrositeCounts.set(g.accountId, g.pages?.length ?? 0);
    }

    // Group signals by account
    const sigsByAccount = new Map<number, Signal[]>();
    for (const s of signals) {
      if (!s.accountId) continue;
      const arr = sigsByAccount.get(s.accountId) ?? [];
      arr.push(s);
      sigsByAccount.set(s.accountId, arr);
    }

    type EnrichedAccount = Account & {
      score: number;
      signalCount14d: number;
      heat: HeatTier;
      lastSignal: Signal | null;
      hasMicrosite: boolean;
      daysSinceLastSignal: number | null;
    };

    const enriched: EnrichedAccount[] = accounts.map(acct => {
      const acctSignals = sigsByAccount.get(acct.id) ?? [];
      // Weighted recent-engagement score + tier from the shared helper so the
      // dashboard's heat always matches the Accounts page.
      const score = computeHeatScore(acctSignals, now, heatScoring);
      const fourteenDaysAgo = now - FOURTEEN_DAYS_MS;
      const signalCount14d = acctSignals.filter(s => new Date(s.createdAt).getTime() > fourteenDaysAgo).length;
      const heat = computeHeatTier(acctSignals, now, heatScoring);
      const sorted = [...acctSignals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastSignal = sorted[0] ?? null;
      const hasMicrosite = (micrositeCounts.get(acct.id) ?? 0) > 0;
      const daysSinceLastSignal = lastSignal
        ? Math.floor((now - new Date(lastSignal.createdAt).getTime()) / (24 * 60 * 60 * 1000))
        : null;
      return { ...acct, score, signalCount14d, heat, lastSignal, hasMicrosite, daysSinceLastSignal };
    });

    // Apply all filters
    const ownerFiltered = enriched.filter(a => {
      const matchesOwner   = ownerFilters.length === 0   || ownerFilters.includes(a.owner ?? "");
      const matchesTier    = abmTierFilters.length === 0  || abmTierFilters.includes(a.abmTier ?? "");
      const matchesStage   = abmStageFilters.length === 0 || abmStageFilters.includes(a.abmStage ?? "");
      const matchesSegment = segmentFilters.length === 0  || segmentFilters.includes(a.practiceSegment ?? "");
      return matchesOwner && matchesTier && matchesStage && matchesSegment;
    });

    // Most-engaged list: any account with signals in the last 2 weeks, ranked by
    // weighted score. This is a "most engaged" ranking, NOT the hot-tier count.
    const hot = ownerFiltered
      .filter(a => a.signalCount14d > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Needs attention: no microsite OR gone quiet (last signal > 14 days or no signal at all)
    const attention = ownerFiltered
      .filter(a => {
        if (!a.hasMicrosite) return true;
        if (a.daysSinceLastSignal === null) return true; // has microsite but 0 signals ever
        if (a.daysSinceLastSignal > 14 && a.hasMicrosite) return true;
        return false;
      })
      .sort((a, b) => {
        // No microsite first, then by longest quiet
        if (!a.hasMicrosite && b.hasMicrosite) return -1;
        if (a.hasMicrosite && !b.hasMicrosite) return 1;
        return (b.daysSinceLastSignal ?? 9999) - (a.daysSinceLastSignal ?? 9999);
      })
      .slice(0, 6);

    // Hot (last 2 weeks) headline: accounts in the HOT tier (score ≥ 15), the
    // same weighted definition the Accounts page Engagement panel uses.
    const hotTierCount = ownerFiltered.filter(a => a.heat === "hot").length;

    return { hotAccounts: hot, needsAttention: attention, hotCount: hotTierCount, filteredAccountCount: ownerFiltered.length };
  }, [accounts, signals, micrositeGroups, ownerFilters, abmTierFilters, abmStageFilters, segmentFilters, heatScoring]);

  const recentSignals = useMemo(() => {
    const isFiltered = ownerFilters.length > 0 || abmTierFilters.length > 0 || abmStageFilters.length > 0 || segmentFilters.length > 0;
    const filteredAccountIds = isFiltered
      ? new Set(accounts.filter(a => {
          const matchesOwner   = ownerFilters.length === 0   || ownerFilters.includes(a.owner ?? "");
          const matchesTier    = abmTierFilters.length === 0  || abmTierFilters.includes(a.abmTier ?? "");
          const matchesStage   = abmStageFilters.length === 0 || abmStageFilters.includes(a.abmStage ?? "");
          const matchesSegment = segmentFilters.length === 0  || segmentFilters.includes(a.practiceSegment ?? "");
          return matchesOwner && matchesTier && matchesStage && matchesSegment;
        }).map(a => a.id))
      : null;
    return [...signals]
      .filter(s => !filteredAccountIds || !s.accountId || filteredAccountIds.has(s.accountId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [signals, accounts, ownerFilters, abmTierFilters, abmStageFilters, segmentFilters]);

  const isEmpty = !loading && accounts.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SalesLayout>
      <div className="flex flex-col gap-8 pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{getGreeting()}</h1>
            <p className="text-sm text-muted-foreground mt-1">Here's what needs your attention today.</p>
          </div>
          {/* Header actions — the assistant bar below covers new-microsite /
              new-account / draft-email; only the briefing picker (no assistant
              equivalent) keeps a dedicated button. */}
          <div className="hidden sm:flex items-center gap-2">
            <BriefingPickerButton accounts={accounts} />
          </div>
        </div>

        {/* ── Sales assistant — "what would you like to do today?" ────── */}
        <SalesAssistantBar />

        {/* ── Stats strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Accounts", value: accounts.length === 0 ? 0 : filteredAccountCount, color: "text-foreground" },
            { label: "Hot (last 2 weeks)", value: hotCount, color: "text-orange-600 dark:text-orange-400" },
            { label: "Signals today", value: signalsToday, color: "text-foreground" },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border/50 rounded-xl px-5 py-4">
              {loading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <p className={`text-2xl font-semibold tracking-tight ${stat.color}`}>{stat.value}</p>
              )}
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Scope ──────────────────────────────────────────────────
            One toggle, not a filter bar. This page used to carry a full copy of
            the Accounts page's filtering — four multi-selects, a saved-views
            dropdown and a save dialog — sharing a localStorage key with it, so
            reps had two places to do the same thing and no way to tell which
            was authoritative. Filtering and saved views belong on Accounts; a
            dashboard needs only "mine or everyone's". */}
        {!loading && accounts.length > 0 && user?.name && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Showing:</span>
            </div>
            {([
              { label: "My accounts", mine: true },
              { label: "Everyone's", mine: false },
            ] as const).map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setMineOnly(opt.mine)}
                className={`h-7 px-3 rounded-md border text-xs font-medium transition-colors ${
                  mineOnly === opt.mine
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-1">
              {filteredAccountCount} of {accounts.length} accounts
            </span>
            <Link href="/sales/accounts">
              <span className="text-xs text-primary hover:underline cursor-pointer ml-auto">
                Filter and save views on Accounts →
              </span>
            </Link>
          </div>
        )}

        {isEmpty ? (
          /* ── Onboarding ───────────────────────────────────────────── */
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Get started</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Add an account", desc: "Create your first target account — a company or organization you want to engage.", cta: "Add Account", href: "/sales/accounts", icon: <Building2 className="w-4 h-4" />, primary: true },
                { step: "2", title: "Build a microsite", desc: "Use the page builder to create a personalized microsite for the account.", cta: "Create Microsite", href: "/sales/microsites", icon: <FileText className="w-4 h-4" />, action: "newMicrosite" as const },
                { step: "3", title: "Send outreach", desc: "Generate a personalized email, attach the microsite link, and send it.", cta: "Start Outreach", href: "/sales/draft-email", icon: <Mail className="w-4 h-4" /> },
              ].map(item => {
                const card = (
                  <Card className={`group h-full flex flex-col gap-4 p-5 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-sm ${item.primary ? "border-[#1B4332]/20 bg-[#1B4332]/[0.03] hover:border-[#1B4332]/30" : "border-border/50 bg-card hover:border-border"}`}>
                    <div className="flex items-start justify-between">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.primary ? "bg-[#1B4332] text-[var(--brand-accent)]" : "bg-muted/60 text-muted-foreground group-hover:bg-muted transition-colors"}`}>{item.icon}</div>
                      <span className="text-[11px] font-semibold text-muted-foreground/40 tabular-nums">Step {item.step}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-[13px] font-medium text-[#1B4332] dark:text-[var(--brand-accent)]">{item.cta} <ChevronRight className="w-3.5 h-3.5" /></div>
                  </Card>
                );
                if (item.action === "newMicrosite") {
                  return (
                    <button key={item.step} type="button" onClick={() => setShowNewMicrosite(true)} className="text-left">
                      {card}
                    </button>
                  );
                }
                return (
                  <Link href={item.href} key={item.step}>
                    {card}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* ── Main 2-col layout ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* ── Hot accounts (wider) ─────────────────────────────── */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <div className="flex items-center gap-1">
                      <h2 className="text-sm font-semibold text-foreground">Most engaged</h2>
                      <InfoTip
                        content="Accounts ranked by engagement recency and frequency. The heat badge shows how active they've been in the last 2 weeks."
                        color="amber"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground/60">in the last 2 weeks</span>
                  </div>
                  <Link href="/sales/accounts">
                    <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                      View all <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                <Card className="border border-border/50 rounded-xl overflow-hidden flex flex-col" style={{ height: 380 }}>
                  {loading ? (
                    <div className="p-4 flex flex-col gap-3 overflow-hidden">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                    </div>
                  ) : hotAccounts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
                        <Flame className="w-4 h-4 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">No engagement yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Accounts will appear here when contacts open emails or visit microsites.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs rounded-lg"
                        onClick={() => setShowNewMicrosite(true)}
                      >
                        <Globe className="w-3.5 h-3.5" />Create a microsite
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                    {hotAccounts.map(acct => {
                      const heat = acct.heat;
                      const heatCfg = heat === "cold" ? null : HEAT_CONFIG[heat];
                      return (
                        <Link
                          key={acct.id}
                          href={`/sales/accounts/${acct.id}`}
                          className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
                        >
                          {/* Heat badge — fixed width (fits the longest "Warming Up" label) so column stays aligned */}
                          <div className="w-[96px] shrink-0 flex">
                            {heatCfg ? (
                              <Badge variant="outline" className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md ${heatCfg.className}`}>
                                {heatCfg.icon}{heatCfg.label}
                              </Badge>
                            ) : null}
                          </div>

                          {/* Account info — flex-1 with overflow-hidden so text truncates */}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-[13px] font-medium text-foreground truncate">{acct.name}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 overflow-hidden">
                              <span className="shrink-0 tabular-nums">{acct.signalCount14d} signal{acct.signalCount14d !== 1 ? "s" : ""} in last 2 weeks</span>
                              {acct.lastSignal && (
                                <>
                                  <span className="shrink-0 text-border">·</span>
                                  <span className="flex items-center gap-1 min-w-0 truncate">
                                    {getSignalIcon(acct.lastSignal.type, "w-3 h-3 shrink-0")}
                                    <span className="truncate">{getSignalLabel(acct.lastSignal.type).toLowerCase()}{" "}{formatDistanceToNow(new Date(acct.lastSignal.createdAt), { addSuffix: true })}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Quick actions — hidden on mobile, hover-reveal on desktop */}
                          <div className="hidden sm:flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Link href={`/sales/draft-email?accountId=${acct.id}`} onClick={e => e.stopPropagation()}>
                              <Button size="sm" className="h-7 px-2.5 text-xs gap-1 rounded-lg" style={{ backgroundColor: "#1B4332", color: "#fff" }}>
                                <PenTool className="w-3 h-3" />Email
                              </Button>
                            </Link>
                          </div>
                        </Link>
                      );
                    })}
                    </div>
                  )}
                </Card>
              </div>

              {/* ── Live signals feed (narrower) ─────────────────────── */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent-warm))] animate-pulse" />
                    <div className="flex items-center gap-1">
                      <h2 className="text-sm font-semibold text-foreground">Live signals</h2>
                      <InfoTip
                        content="Real-time feed of all engagement events — email opens, page visits, link clicks. Most recent activity appears first."
                        color="blue"
                      />
                    </div>
                  </div>
                  <Link href="/sales/signals">
                    <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                      View all <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                <Card className="border border-border/50 rounded-xl overflow-hidden flex flex-col" style={{ height: 380 }}>
                  {loading ? (
                    <div className="p-3 flex flex-col gap-2 overflow-hidden">
                      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                    </div>
                  ) : recentSignals.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <Activity className="w-4 h-4 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">No signals yet — send outreach to start seeing engagement.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                      {recentSignals.map(signal => (
                        <Link
                          key={signal.id}
                          href={signal.accountId ? `/sales/accounts/${signal.accountId}?tab=activity` : "/sales/signals"}
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                            {getSignalIcon(signal.type, "w-4 h-4")}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            {signal.type === "visitor_identified" ? (() => {
                              const m = (signal.metadata ?? {}) as Record<string, string | undefined>;
                              const personName = [m.firstName, m.lastName].filter(Boolean).join(" ");
                              const company = signal.accountName ?? m.companyName ?? "";
                              const title = m.title ?? "";
                              const slug = m.slug ?? (m.pageUrl ? m.pageUrl.split("/").filter(Boolean).pop() : null);
                              return <>
                                <p className="text-xs font-medium text-foreground truncate leading-snug">
                                  {personName || company || "Unknown visitor"}
                                  {company && personName && <span className="text-muted-foreground font-normal"> · {company}</span>}
                                </p>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 overflow-hidden">
                                  {title && <span className="truncate">{title}</span>}
                                  {title && <span className="text-border shrink-0">·</span>}
                                  {slug ? <span className="shrink-0">visited <span className="font-mono">/{slug}</span></span> : <span className="shrink-0">identified</span>}
                                  <span className="text-border shrink-0">·</span>
                                  <span className="shrink-0">{formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}</span>
                                </div>
                              </>;
                            })() : <>
                              <p className="text-xs font-medium text-foreground truncate leading-snug">
                                {signal.contactName ?? signal.accountName ?? "Unknown"}{" "}
                                <span className="text-muted-foreground font-normal">{getSignalLabel(signal.type).toLowerCase()}</span>
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 overflow-hidden">
                                {signal.accountName && <span className="font-medium truncate">{signal.accountName}</span>}
                                <span className="text-border shrink-0">·</span>
                                <span className="shrink-0">{formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}</span>
                              </div>
                            </>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* ── Needs attention ──────────────────────────────────── */}
            {(loading || needsAttention.length > 0) && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
                  <span className="text-xs text-muted-foreground/60">no microsite or gone quiet</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {loading ? (
                    [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                  ) : (
                    needsAttention.map(acct => {
                      const noMicrosite = !acct.hasMicrosite;
                      const reason = noMicrosite
                        ? "No microsite"
                        : acct.daysSinceLastSignal !== null
                          ? `Quiet ${acct.daysSinceLastSignal}d`
                          : "No engagement";
                      return (
                        <Card key={acct.id} className="group flex flex-col gap-2 p-4 rounded-xl border border-border/50 hover:border-amber-200/60 dark:hover:border-amber-800/40 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-foreground truncate">{acct.name}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${noMicrosite ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                              {reason}
                            </span>
                          </div>
                          {acct.segment && <p className="text-xs text-muted-foreground">{acct.segment}</p>}
                          <div className="flex items-center gap-1.5 mt-auto pt-1">
                            {noMicrosite ? (
                              <Link href={`/sales/accounts?highlight=${acct.id}`}>
                                <Button size="sm" className="h-7 px-2.5 text-xs gap-1 w-full rounded-lg" style={{ backgroundColor: "#1B4332", color: "#fff" }}>
                                  <Sparkles className="w-3 h-3" />Generate microsite
                                </Button>
                              </Link>
                            ) : (
                              <Link href={`/sales/draft-email?accountId=${acct.id}`}>
                                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 w-full rounded-lg">
                                  <PenTool className="w-3 h-3" />Re-engage
                                </Button>
                              </Link>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </div>
      <GenerateMicrositeModal open={showNewMicrosite} onClose={() => setShowNewMicrosite(false)} />
    </SalesLayout>
  );
}
