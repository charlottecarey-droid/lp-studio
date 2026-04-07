import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Building2, Activity, FileText, Plus, ChevronRight,
  Globe, Zap, Mail, PenTool, Send, Flame, Thermometer,
  AlertCircle, ArrowUpRight, Contact, Sparkles, Calculator,
  ChevronDown, SlidersHorizontal, Bookmark, BookmarkCheck, Trash2, X,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHint } from "@/components/ui/page-hint";
import { InfoTip } from "@/components/ui/info-tip";
import { SalesLayout } from "@/components/layout/sales-layout";
import { getSignalIcon, getSignalLabel } from "@/lib/signal-types";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  name: string;
  domain?: string;
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

interface SavedView {
  id: string;
  name: string;
  filters: { ownerFilters: string[]; abmTierFilters: string[]; abmStageFilters: string[]; segmentFilters: string[] };
  createdAt: string;
}

// ── Engagement scoring (mirrors server-side logic) ────────────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
  form_submit:        5,
  email_click:        3,
  link_click:         3,
  visitor_identified: 2,
  email_open:         2,
  page_view:          1,
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function visitorWeight(s: Signal): number {
  const source = s.source ?? "";
  const meta   = (s.metadata ?? {}) as Record<string, string | undefined>;
  if (source === "rb2b")       return 3;
  if (source === "apollo")     return 2;
  if (source === "letterdrop") {
    const activity = meta.activityType ?? meta.lastActivity ?? "";
    if (activity.includes("comment"))               return 4;
    if (activity.includes("organization_follower")) return 2;
    if (activity.includes("profile_view"))          return 1;
    return 2;
  }
  return 2;
}

function computeScore(signals: Signal[], now: number) {
  let score = 0;
  for (const s of signals) {
    const w = s.type === "visitor_identified" ? visitorWeight(s) : (SIGNAL_WEIGHTS[s.type] ?? 0);
    const isRecent = now - new Date(s.createdAt).getTime() < SEVEN_DAYS_MS;
    score += w * (isRecent ? 1.5 : 1);
  }
  return score;
}

function heatLabel(score: number, signalCount7d: number) {
  if (signalCount7d === 0) return null;
  if (score >= 15) return "hot";
  if (score >= 8)  return "warm";
  if (score >= 3)  return "cool";
  return null;
}

const HEAT_CONFIG = {
  hot:  { label: "Hot",  icon: <Flame className="w-3 h-3" />,       className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400" },
  warm: { label: "Warm", icon: <Thermometer className="w-3 h-3" />, className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400" },
  cool: { label: "Cool", icon: <Zap className="w-3 h-3" />,          className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400" },
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
  const [ownerFilters, setOwnerFilters] = useState<string[]>(() => readLsArr("ownerFilters"));
  const [abmTierFilters, setAbmTierFilters] = useState<string[]>(() => readLsArr("abmTierFilters"));
  const [abmStageFilters, setAbmStageFilters] = useState<string[]>(() => readLsArr("abmStageFilters"));
  const [segmentFilters, setSegmentFilters] = useState<string[]>(() => readLsArr("segmentFilters"));
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [showTierDropdown, setShowTierDropdown] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);
  const tierDropdownRef = useRef<HTMLDivElement>(null);
  const stageDropdownRef = useRef<HTMLDivElement>(null);
  const segmentDropdownRef = useRef<HTMLDivElement>(null);

  // Saved views — same key as Accounts page so they share views
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (!viewsKey) return [];
    try { return JSON.parse(localStorage.getItem(viewsKey) ?? "[]"); } catch { return []; }
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [dirtyViewId, setDirtyViewId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const viewsDropdownRef = useRef<HTMLDivElement>(null);

  // Persist filter changes back to localStorage so Accounts page picks them up too
  useEffect(() => {
    if (!lsKey) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify({ ownerFilters, abmTierFilters, abmStageFilters, segmentFilters }));
    } catch {}
  }, [ownerFilters, abmTierFilters, abmStageFilters, segmentFilters, lsKey]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) setShowOwnerDropdown(false);
      if (tierDropdownRef.current && !tierDropdownRef.current.contains(e.target as Node)) setShowTierDropdown(false);
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) setShowStageDropdown(false);
      if (segmentDropdownRef.current && !segmentDropdownRef.current.contains(e.target as Node)) setShowSegmentDropdown(false);
      if (viewsDropdownRef.current && !viewsDropdownRef.current.contains(e.target as Node)) setShowViewsDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Saved view helpers
  function markDirty() {
    if (activeViewId) { setDirtyViewId(activeViewId); setActiveViewId(null); }
  }
  function toggleOwner(name: string) {
    markDirty();
    setOwnerFilters(prev => prev.includes(name) ? prev.filter(o => o !== name) : [...prev, name]);
  }
  function toggleTier(val: string) {
    markDirty();
    setAbmTierFilters(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }
  function toggleStage(val: string) {
    markDirty();
    setAbmStageFilters(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }
  function toggleSegment(val: string) {
    markDirty();
    setSegmentFilters(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }
  function currentFilters(): SavedView["filters"] {
    return { ownerFilters, abmTierFilters, abmStageFilters, segmentFilters };
  }
  function saveView() {
    if (!saveViewName.trim() || !viewsKey) return;
    const view: SavedView = { id: Date.now().toString(), name: saveViewName.trim(), filters: currentFilters(), createdAt: new Date().toISOString() };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    try { localStorage.setItem(viewsKey, JSON.stringify(updated)); } catch {}
    setActiveViewId(view.id); setDirtyViewId(null); setShowSaveDialog(false); setSaveViewName("");
  }
  function updateView(id: string) {
    const updated = savedViews.map(v => v.id === id ? { ...v, filters: currentFilters() } : v);
    setSavedViews(updated);
    if (viewsKey) { try { localStorage.setItem(viewsKey, JSON.stringify(updated)); } catch {} }
    setActiveViewId(id); setDirtyViewId(null);
  }
  function loadView(view: SavedView) {
    setOwnerFilters(view.filters.ownerFilters ?? []);
    setAbmTierFilters(view.filters.abmTierFilters ?? []);
    setAbmStageFilters(view.filters.abmStageFilters ?? []);
    setSegmentFilters(view.filters.segmentFilters ?? []);
    setActiveViewId(view.id); setDirtyViewId(null); setShowViewsDropdown(false);
  }
  function deleteView(id: string) {
    const updated = savedViews.filter(v => v.id !== id);
    setSavedViews(updated);
    if (viewsKey) { try { localStorage.setItem(viewsKey, JSON.stringify(updated)); } catch {} }
    if (activeViewId === id) setActiveViewId(null);
    if (dirtyViewId === id) setDirtyViewId(null);
  }

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
      signalCount7d: number;
      heat: "hot" | "warm" | "cool" | null;
      lastSignal: Signal | null;
      hasMicrosite: boolean;
      daysSinceLastSignal: number | null;
    };

    const enriched: EnrichedAccount[] = accounts.map(acct => {
      const acctSignals = sigsByAccount.get(acct.id) ?? [];
      const score = computeScore(acctSignals, now);
      const sevenDaysAgo = now - SEVEN_DAYS_MS;
      const signalCount7d = acctSignals.filter(s => new Date(s.createdAt).getTime() > sevenDaysAgo).length;
      const heat = heatLabel(score, signalCount7d);
      const sorted = [...acctSignals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastSignal = sorted[0] ?? null;
      const hasMicrosite = (micrositeCounts.get(acct.id) ?? 0) > 0;
      const daysSinceLastSignal = lastSignal
        ? Math.floor((now - new Date(lastSignal.createdAt).getTime()) / (24 * 60 * 60 * 1000))
        : null;
      return { ...acct, score, signalCount7d, heat, lastSignal, hasMicrosite, daysSinceLastSignal };
    });

    // Apply all filters
    const ownerFiltered = enriched.filter(a => {
      const matchesOwner   = ownerFilters.length === 0   || ownerFilters.includes(a.owner ?? "");
      const matchesTier    = abmTierFilters.length === 0  || abmTierFilters.includes(a.abmTier ?? "");
      const matchesStage   = abmStageFilters.length === 0 || abmStageFilters.includes(a.abmStage ?? "");
      const matchesSegment = segmentFilters.length === 0  || segmentFilters.includes(a.practiceSegment ?? "");
      return matchesOwner && matchesTier && matchesStage && matchesSegment;
    });

    // Hot accounts: have any signals, sorted by 7-day score desc
    const hot = ownerFiltered
      .filter(a => a.signalCount7d > 0)
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

    return { hotAccounts: hot, needsAttention: attention, hotCount: hot.length, filteredAccountCount: ownerFiltered.length };
  }, [accounts, signals, micrositeGroups, ownerFilters, abmTierFilters, abmStageFilters, segmentFilters]);

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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{getGreeting()}</h1>
            <p className="text-muted-foreground mt-1 text-sm">Here's what needs your attention today.</p>
          </div>
          <Link href="/sales/accounts" className="hidden sm:block">
            <Button size="sm" className="rounded-lg font-medium text-[13px] shadow-sm" style={{ backgroundColor: "#1B4332", color: "#C7E738" }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />New account
            </Button>
          </Link>
        </div>

        {/* ── PageHint banner ────────────────────────────────────────── */}
        <PageHint
          id="sales-dashboard"
          title="Your Sales Command Center"
          description="This dashboard tracks real-time engagement across all your accounts. Metrics update as contacts open emails, visit microsites, and interact with your content."
          tips={[
            <><strong>Filter by owner, ABM tier, stage, or segment</strong> — then save the view to return to that filtered view instantly on any page.</>,
            "Hot Accounts show which prospects are actively engaging right now",
            "The Signals feed shows every email open, page visit, and link click as it happens",
            "Click any account to see their full engagement timeline"
          ]}
          color="violet"
          icon={<Zap className="w-4 h-4" />}
        />

        {/* ── Stats strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Accounts", value: accounts.length === 0 ? 0 : filteredAccountCount, color: "text-foreground" },
            { label: "Hot this week", value: hotCount, color: "text-orange-600 dark:text-orange-400" },
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

        {/* ── Account filters ────────────────────────────────────────── */}
        {!loading && accounts.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filter accounts:</span>
              </div>

              {/* My Accounts quick chip */}
              {user?.name && (
                <button
                  type="button"
                  onClick={() => toggleOwner(user.name)}
                  className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-xs font-medium transition-colors ${
                    ownerFilters.includes(user.name)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  My Accounts
                </button>
              )}

              {/* Owner multi-select dropdown */}
              <div className="relative" ref={ownerDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowOwnerDropdown(v => !v)}
                  className={`flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-md border text-xs transition-colors ${
                    ownerFilters.length > 0
                      ? "border-primary/50 bg-primary/5 text-foreground"
                      : "border-input bg-background text-foreground"
                  }`}
                >
                  <span>
                    {ownerFilters.length === 0 ? "All Owners" : ownerFilters.length === 1 ? ownerFilters[0] : `${ownerFilters.length} Owners`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
                {showOwnerDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-xl border border-border bg-card shadow-lg py-1 max-h-64 overflow-y-auto">
                    {uniqueOwners.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No owners found</p>
                    ) : (
                      <>
                        <button type="button" onClick={() => { markDirty(); setOwnerFilters([]); }} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                          Clear selection
                        </button>
                        <div className="border-t border-border/50 my-1" />
                        {uniqueOwners.map(owner => (
                          <label key={owner} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer rounded-sm transition-colors">
                            <input
                              type="checkbox"
                              checked={ownerFilters.includes(owner)}
                              onChange={() => toggleOwner(owner)}
                              className="w-3.5 h-3.5 accent-primary"
                            />
                            <span className="text-xs text-foreground truncate">{owner}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ABM Tier multi-select dropdown */}
              <div className="relative" ref={tierDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowTierDropdown(v => !v)}
                  className={`flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-md border text-xs transition-colors ${
                    abmTierFilters.length > 0
                      ? "border-primary/50 bg-primary/5 text-foreground"
                      : "border-input bg-background text-foreground"
                  }`}
                >
                  <span>
                    {abmTierFilters.length === 0 ? "All ABM Tiers" : abmTierFilters.length === 1 ? abmTierFilters[0] : `${abmTierFilters.length} Tiers`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
                {showTierDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-44 rounded-xl border border-border bg-card shadow-lg py-1 max-h-64 overflow-y-auto">
                    {uniqueAbmTiers.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No tiers found</p>
                    ) : (
                      <>
                        <button type="button" onClick={() => { markDirty(); setAbmTierFilters([]); }} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                          Clear selection
                        </button>
                        <div className="border-t border-border/50 my-1" />
                        {uniqueAbmTiers.map(tier => (
                          <label key={tier} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer rounded-sm transition-colors">
                            <input
                              type="checkbox"
                              checked={abmTierFilters.includes(tier)}
                              onChange={() => toggleTier(tier)}
                              className="w-3.5 h-3.5 accent-primary"
                            />
                            <span className="text-xs text-foreground truncate">{tier}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ABM Stage multi-select */}
              {uniqueAbmStages.length > 0 && (
                <div className="relative" ref={stageDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowStageDropdown(v => !v)}
                    className={`flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-md border text-xs transition-colors ${
                      abmStageFilters.length > 0
                        ? "border-primary/50 bg-primary/5 text-foreground"
                        : "border-input bg-background text-foreground"
                    }`}
                  >
                    <span>
                      {abmStageFilters.length === 0 ? "All ABM Stages" : abmStageFilters.length === 1 ? abmStageFilters[0] : `${abmStageFilters.length} Stages`}
                    </span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {showStageDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-xl border border-border bg-card shadow-lg py-1 max-h-64 overflow-y-auto">
                      <button type="button" onClick={() => { markDirty(); setAbmStageFilters([]); }} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        Clear selection
                      </button>
                      <div className="border-t border-border/50 my-1" />
                      {uniqueAbmStages.map(stage => (
                        <label key={stage} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer rounded-sm transition-colors">
                          <input type="checkbox" checked={abmStageFilters.includes(stage)} onChange={() => toggleStage(stage)} className="w-3.5 h-3.5 accent-primary" />
                          <span className="text-xs text-foreground truncate">{stage}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Segment multi-select */}
              {uniqueSegments.length > 0 && (
                <div className="relative" ref={segmentDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowSegmentDropdown(v => !v)}
                    className={`flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-md border text-xs transition-colors ${
                      segmentFilters.length > 0
                        ? "border-primary/50 bg-primary/5 text-foreground"
                        : "border-input bg-background text-foreground"
                    }`}
                  >
                    <span>
                      {segmentFilters.length === 0 ? "All Segments" : segmentFilters.length === 1 ? segmentFilters[0] : `${segmentFilters.length} Segments`}
                    </span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {showSegmentDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-xl border border-border bg-card shadow-lg py-1 max-h-64 overflow-y-auto">
                      <button type="button" onClick={() => { markDirty(); setSegmentFilters([]); }} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        Clear selection
                      </button>
                      <div className="border-t border-border/50 my-1" />
                      {uniqueSegments.map(seg => (
                        <label key={seg} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer rounded-sm transition-colors">
                          <input type="checkbox" checked={segmentFilters.includes(seg)} onChange={() => toggleSegment(seg)} className="w-3.5 h-3.5 accent-primary" />
                          <span className="text-xs text-foreground truncate">{seg}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Clear all */}
              {(ownerFilters.length > 0 || abmTierFilters.length > 0 || abmStageFilters.length > 0 || segmentFilters.length > 0) && (
                <button
                  type="button"
                  onClick={() => { markDirty(); setOwnerFilters([]); setAbmTierFilters([]); setAbmStageFilters([]); setSegmentFilters([]); }}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-input transition-colors"
                >
                  Clear filters
                </button>
              )}

              {/* Save list view / Update view button */}
              {(ownerFilters.length > 0 || abmTierFilters.length > 0 || abmStageFilters.length > 0 || segmentFilters.length > 0) && !activeViewId && (() => {
                const dirtyView = dirtyViewId ? savedViews.find(v => v.id === dirtyViewId) : null;
                if (dirtyView) {
                  return (
                    <div className="flex items-center gap-1 ml-auto">
                      <button type="button" onClick={() => updateView(dirtyView.id)}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-primary/40 bg-primary/8 text-xs text-primary hover:bg-primary/15 transition-colors font-medium"
                        title={`Save changes to "${dirtyView.name}"`}>
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Update view</span>
                      </button>
                      <button type="button" onClick={() => { setSaveViewName(""); setShowSaveDialog(true); }}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                        <Bookmark className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save as new</span>
                      </button>
                    </div>
                  );
                }
                return (
                  <button type="button" onClick={() => { setSaveViewName(""); setShowSaveDialog(true); }}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors ml-auto"
                    title="Save this filter as a view">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save list view</span>
                  </button>
                );
              })()}

              {/* Saved views dropdown */}
              {savedViews.length > 0 && (
                <div className={`relative ${(ownerFilters.length > 0 || abmTierFilters.length > 0 || abmStageFilters.length > 0 || segmentFilters.length > 0) && !activeViewId ? "" : "ml-auto"}`} ref={viewsDropdownRef}>
                  <button type="button" onClick={() => setShowViewsDropdown(v => !v)}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors ${
                      activeViewId ? "border-primary/50 bg-primary/8 text-primary" : "border-input bg-background text-muted-foreground hover:text-foreground"
                    }`}>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>{activeViewId ? savedViews.find(v => v.id === activeViewId)?.name ?? "Views" : `Views (${savedViews.length})`}</span>
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </button>
                  {showViewsDropdown && (
                    <div className="absolute top-full right-0 mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-lg py-1">
                      <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saved Views</p>
                      {savedViews.map(view => (
                        <div key={view.id} className="flex items-center gap-1 px-2 py-1 hover:bg-muted/50 rounded-sm group">
                          <button type="button" onClick={() => loadView(view)}
                            className={`flex-1 text-left text-xs truncate py-0.5 ${activeViewId === view.id ? "text-primary font-medium" : "text-foreground"}`}>
                            {view.name}
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                            className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0" title="Delete view">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save view dialog */}
            {showSaveDialog && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
                <Input
                  value={saveViewName}
                  onChange={e => setSaveViewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setShowSaveDialog(false); }}
                  placeholder="View name…"
                  className="h-7 text-xs flex-1"
                  autoFocus
                />
                <Button size="sm" className="h-7 px-3 text-xs" onClick={saveView} disabled={!saveViewName.trim()}>Save</Button>
                <button onClick={() => setShowSaveDialog(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Active view / filter count indicator */}
            {(ownerFilters.length > 0 || abmTierFilters.length > 0 || abmStageFilters.length > 0 || segmentFilters.length > 0) && !showSaveDialog && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg text-xs text-muted-foreground">
                {activeViewId && <BookmarkCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                <span>
                  {activeViewId && <span className="font-medium text-foreground mr-1">{savedViews.find(v => v.id === activeViewId)?.name} · </span>}
                  Showing {filteredAccountCount} of {accounts.length} accounts
                </span>
                <button onClick={() => { setOwnerFilters([]); setAbmTierFilters([]); setAbmStageFilters([]); setSegmentFilters([]); setActiveViewId(null); setDirtyViewId(null); }}
                  className="text-xs text-primary hover:underline ml-1">Clear all</button>
              </div>
            )}
          </div>
        )}

        {/* ── Tool Cards ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick access</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "accounts",   icon: <Building2 className="w-4 h-4" />, title: "Accounts",       href: "/sales/accounts" },
              { id: "draft",      icon: <PenTool className="w-4 h-4" />,   title: "Draft Email",     href: "/sales/draft-email" },
              { id: "microsites", icon: <Globe className="w-4 h-4" />,     title: "Microsites",      href: "/sales/microsites" },
              { id: "campaigns",  icon: <Send className="w-4 h-4" />,      title: "Campaigns",       href: "/sales/campaigns" },
              { id: "activity",   icon: <Zap className="w-4 h-4" />,       title: "Activity",        href: "/sales/signals" },
              { id: "contacts",   icon: <Contact className="w-4 h-4" />,   title: "Contacts",        href: "/sales/contacts" },
              { id: "roi-calc",   icon: <Calculator className="w-4 h-4" />, title: "ROI Calculator", href: "/sales/roi-calculator" },
              { id: "one-pager",  icon: <FileText className="w-4 h-4" />,  title: "One-Pager",       href: "/sales/one-pager" },
            ].map(tool => (
              <Link href={tool.href} key={tool.id}>
                <div className="group flex items-center gap-3 px-4 py-3.5 bg-card border border-border/50 rounded-xl hover:border-border hover:shadow-sm transition-all duration-200 cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:bg-[#1B4332]/10 group-hover:text-[#1B4332] dark:group-hover:bg-[#C7E738]/10 dark:group-hover:text-[#C7E738] transition-colors shrink-0">
                    {tool.icon}
                  </div>
                  <span className="text-[13px] font-medium text-foreground">{tool.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {isEmpty ? (
          /* ── Onboarding ───────────────────────────────────────────── */
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Get started</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Add an account", desc: "Create your first target account — a DSO, practice, or company you want to engage.", cta: "Add Account", href: "/sales/accounts", icon: <Building2 className="w-4 h-4" />, primary: true },
                { step: "2", title: "Build a microsite", desc: "Use the page builder to create a personalized microsite for the account.", cta: "Create Microsite", href: "/sales/microsites", icon: <FileText className="w-4 h-4" /> },
                { step: "3", title: "Send outreach", desc: "Generate a personalized email, attach the microsite link, and send it.", cta: "Start Outreach", href: "/sales/draft-email", icon: <Mail className="w-4 h-4" /> },
              ].map(item => (
                <Link href={item.href} key={item.step}>
                  <Card className={`group h-full flex flex-col gap-4 p-5 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-sm ${item.primary ? "border-[#1B4332]/20 bg-[#1B4332]/[0.03] hover:border-[#1B4332]/30" : "border-border/50 bg-card hover:border-border"}`}>
                    <div className="flex items-start justify-between">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.primary ? "bg-[#1B4332] text-[#C7E738]" : "bg-muted/60 text-muted-foreground group-hover:bg-muted transition-colors"}`}>{item.icon}</div>
                      <span className="text-[11px] font-semibold text-muted-foreground/40 tabular-nums">Step {item.step}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-[13px] font-medium text-[#1B4332] dark:text-[#C7E738]">{item.cta} <ChevronRight className="w-3.5 h-3.5" /></div>
                  </Card>
                </Link>
              ))}
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
                      <h2 className="text-sm font-semibold text-foreground">Hot accounts</h2>
                      <InfoTip
                        content="Accounts ranked by engagement recency and frequency. The heat badge shows how active they've been in the last 7 days."
                        color="amber"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground/60">most engaged this week</span>
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
                      <Link href="/sales/microsites">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg">
                          <Globe className="w-3.5 h-3.5" />Create a microsite
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                    {hotAccounts.map(acct => {
                      const heat = acct.heat as "hot" | "warm" | "cool" | null;
                      const heatCfg = heat ? HEAT_CONFIG[heat] : null;
                      return (
                        <Link
                          key={acct.id}
                          href={`/sales/accounts/${acct.id}`}
                          className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
                        >
                          {/* Heat badge — fixed width so column stays aligned */}
                          <div className="w-[58px] shrink-0 flex">
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
                              <span className="shrink-0 tabular-nums">{acct.signalCount7d} signal{acct.signalCount7d !== 1 ? "s" : ""} this week</span>
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
                              <Button size="sm" className="h-7 px-2.5 text-xs gap-1 rounded-lg" style={{ backgroundColor: "#1B4332", color: "#C7E738" }}>
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
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                            <p className="text-xs font-medium text-foreground truncate leading-snug">
                              {signal.contactName ?? signal.accountName ?? "Unknown"}{" "}
                              <span className="text-muted-foreground font-normal">{getSignalLabel(signal.type).toLowerCase()}</span>
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 overflow-hidden">
                              {signal.accountName && <span className="font-medium truncate">{signal.accountName}</span>}
                              <span className="text-border shrink-0">·</span>
                              <span className="shrink-0">{formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}</span>
                            </div>
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
                                <Button size="sm" className="h-7 px-2.5 text-xs gap-1 w-full rounded-lg" style={{ backgroundColor: "#1B4332", color: "#C7E738" }}>
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
    </SalesLayout>
  );
}
