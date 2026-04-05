import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  Users,
  Mail,
  FileText,
  Globe,
  ArrowLeft,
  Activity,
  ExternalLink,
  Pencil,
  Trash2,
  Brain,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
  TrendingUp,
  MessageSquare,
  Upload,
  Clock,
  Eye,
  MousePointerClick,
  Layout,
  Copy,
  Check,
  Link2,
  Star,
  Bookmark,
  X,
  BookmarkCheck,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import DraftEmailModal from "./DraftEmailModal";
import { SalesLayout } from "@/components/layout/sales-layout";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface Account {
  id: number;
  name: string;
  displayName: string | null;
  domain: string | null;
  industry: string | null;
  segment: string | null;
  parentAccountId: number | null;
  status: string;
  owner: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // ABM / segmentation fields from CSV import
  abmTier: string | null;
  abmStage: string | null;
  practiceSegment: string | null;
  dsoSize: string | null;
  numLocations: number | null;
  privateEquityFirm: string | null;
  city: string | null;
  state: string | null;
  contactCount?: number;
}

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  role: string | null;
  status: string;
  createdAt: string;
  // Enriched fields from CSV import
  tier: string | null;
  titleLevel: string | null;
  contactRole: string | null;
  department: string | null;
  linkedinUrl: string | null;
}

interface Microsite {
  pageId: number;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  hotlinkCount: number;
  firstToken: string | null;
}

interface Hotlink {
  id: number;
  contactId: number;
  pageId: number;
  token: string;
  isActive: boolean;
}

interface PageBlock {
  type: string;
  [key: string]: unknown;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    qualified: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    churned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] ?? styles.prospect}`}>
      {status}
    </span>
  );
}

function abmStageStyle(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("won"))      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (s.includes("lost"))     return "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400";
  if (s.includes("opportun")) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (s.includes("meeting"))  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
  if (s.includes("engaged"))  return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
  if (s.includes("target"))   return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400";
}

function PageStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

interface SavedView {
  id: string;
  name: string;
  filters: { ownerFilters: string[]; abmTierFilter: string };
  createdAt: string;
}

/* ─── Account List View ──────────────────────────────────────── */

function AccountListView() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const lsKey = user?.userId ? `sc_acct_filters_${user.userId}` : null;
  const viewsKey = user?.userId ? `sc_acct_views_${user.userId}` : null;

  function readLsOwners(): string[] {
    if (!lsKey) return [];
    try {
      const stored = JSON.parse(localStorage.getItem(lsKey) ?? "{}") as Record<string, unknown>;
      if (Array.isArray(stored.ownerFilters)) return stored.ownerFilters as string[];
      if (typeof stored.ownerFilter === "string" && stored.ownerFilter) return [stored.ownerFilter];
      return [];
    } catch { return []; }
  }
  function readLsTier(): string {
    if (!lsKey) return "";
    try { return (JSON.parse(localStorage.getItem(lsKey) ?? "{}") as Record<string, string>).abmTierFilter ?? ""; }
    catch { return ""; }
  }

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [abmTierFilter, setAbmTierFilter] = useState(() => readLsTier());
  const [abmStageFilter, setAbmStageFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [ownerFilters, setOwnerFilters] = useState<string[]>(() => readLsOwners());
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Saved views
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

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) setShowOwnerDropdown(false);
      if (viewsDropdownRef.current && !viewsDropdownRef.current.contains(e.target as Node)) setShowViewsDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Persist ownerFilters + abmTierFilter to localStorage (shared with Contacts & Signals pages)
  useEffect(() => {
    if (!lsKey) return;
    try { localStorage.setItem(lsKey, JSON.stringify({ ownerFilters, abmTierFilter })); }
    catch {}
  }, [ownerFilters, abmTierFilter, lsKey]);

  function markDirty() {
    if (activeViewId) { setDirtyViewId(activeViewId); setActiveViewId(null); }
  }

  function toggleOwner(name: string) {
    markDirty();
    setOwnerFilters(prev => prev.includes(name) ? prev.filter(o => o !== name) : [...prev, name]);
  }

  function saveView() {
    if (!saveViewName.trim() || !viewsKey) return;
    const view: SavedView = {
      id: Date.now().toString(),
      name: saveViewName.trim(),
      filters: { ownerFilters, abmTierFilter },
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    try { localStorage.setItem(viewsKey, JSON.stringify(updated)); } catch {}
    setActiveViewId(view.id);
    setDirtyViewId(null);
    setShowSaveDialog(false);
    setSaveViewName("");
  }

  function updateView(id: string) {
    const updated = savedViews.map(v =>
      v.id === id ? { ...v, filters: { ownerFilters, abmTierFilter } } : v
    );
    setSavedViews(updated);
    if (viewsKey) { try { localStorage.setItem(viewsKey, JSON.stringify(updated)); } catch {} }
    setActiveViewId(id);
    setDirtyViewId(null);
  }

  function loadView(view: SavedView) {
    setOwnerFilters(view.filters.ownerFilters);
    setAbmTierFilter(view.filters.abmTierFilter);
    setActiveViewId(view.id);
    setDirtyViewId(null);
    setShowViewsDropdown(false);
  }

  function deleteView(id: string) {
    const updated = savedViews.filter(v => v.id !== id);
    setSavedViews(updated);
    if (viewsKey) { try { localStorage.setItem(viewsKey, JSON.stringify(updated)); } catch {} }
    if (activeViewId === id) setActiveViewId(null);
    if (dirtyViewId === id) setDirtyViewId(null);
  }

  // New account form state
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(() => {
    setIsSyncing(true);
    fetch(`${API_BASE}/sales/accounts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setAccounts(data);
        setLastSyncTime(new Date());
      })
      .catch(() => setAccounts([]))
      .finally(() => {
        setLoading(false);
        setIsSyncing(false);
      });
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const uniqueAbmTiers    = Array.from(new Set(accounts.map(a => a.abmTier).filter(Boolean))).sort() as string[];
  const uniqueAbmStages   = Array.from(new Set(accounts.map(a => a.abmStage).filter(Boolean))).sort() as string[];
  const uniqueSegments    = Array.from(new Set(accounts.map(a => a.practiceSegment).filter(Boolean))).sort() as string[];
  const uniqueOwners      = Array.from(new Set(accounts.map(a => a.owner).filter(Boolean))).sort() as string[];

  const isFiltered = !!(search || abmTierFilter || abmStageFilter || segmentFilter || ownerFilters.length > 0);

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      a.name.toLowerCase().includes(q) ||
      (a.displayName ?? "").toLowerCase().includes(q) ||
      (a.domain ?? "").toLowerCase().includes(q) ||
      (a.owner ?? "").toLowerCase().includes(q) ||
      (a.practiceSegment ?? "").toLowerCase().includes(q);
    const matchesTier    = !abmTierFilter        || a.abmTier === abmTierFilter;
    const matchesStage   = !abmStageFilter        || a.abmStage === abmStageFilter;
    const matchesSegment = !segmentFilter         || a.practiceSegment === segmentFilter;
    const matchesOwner   = ownerFilters.length === 0 || ownerFilters.includes(a.owner ?? "");
    return matchesSearch && matchesTier && matchesStage && matchesSegment && matchesOwner;
  });

  function clearFilters() {
    setSearch(""); setAbmTierFilter(""); setAbmStageFilter(""); setSegmentFilter(""); setOwnerFilters([]);
    setActiveViewId(null);
    setDirtyViewId(null);
    if (lsKey) { try { localStorage.removeItem(lsKey); } catch {} }
  }

  const accPag = usePagination(filtered, 25);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/sales/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          domain: newDomain.trim() || null,
          segment: newSegment.trim() || null,
          industry: newIndustry.trim() || null,
        }),
      });
      if (res.ok) {
        setNewName(""); setNewDomain(""); setNewSegment(""); setNewIndustry("");
        setShowNewForm(false);
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your target accounts and track engagement
            </p>
          </div>
          <Button
            onClick={() => setShowNewForm(!showNewForm)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Account
          </Button>
        </div>

        {/* New Account Form */}
        {showNewForm && (
          <Card className="p-6 rounded-2xl border border-primary/30 bg-primary/5">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground">Create New Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Name *</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Heartland Dental"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Domain</label>
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="e.g. heartland.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Segment</label>
                  <Input
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                    placeholder="e.g. DSO, Independent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Industry</label>
                  <Input
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="e.g. Dental"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving || !newName.trim()}>
                  {saving ? "Creating…" : "Create Account"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Search + Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts, owner…" className="pl-10" />
            </div>

            {/* My Accounts quick chip */}
            {user?.name && (
              <button
                type="button"
                onClick={() => { toggleOwner(user.name); }}
                className={`flex items-center gap-1.5 h-10 px-3 rounded-md border text-sm font-medium transition-colors ${
                  ownerFilters.includes(user.name)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                My Accounts
              </button>
            )}

            {/* ABM Tier — always visible */}
            <div className="relative">
              <select value={abmTierFilter} onChange={(e) => { markDirty(); setAbmTierFilter(e.target.value); }}
                className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">All ABM Tiers</option>
                {uniqueAbmTiers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Multi-owner dropdown — always visible */}
            <div className="relative" ref={ownerDropdownRef}>
              <button
                type="button"
                onClick={() => setShowOwnerDropdown(v => !v)}
                className={`flex items-center gap-2 h-10 pl-3 pr-2 rounded-md border text-sm transition-colors ${
                  ownerFilters.length > 0
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-input bg-background text-foreground"
                }`}
              >
                <span>
                  {ownerFilters.length === 0
                    ? "All Owners"
                    : ownerFilters.length === 1
                    ? ownerFilters[0]
                    : `${ownerFilters.length} Owners`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {showOwnerDropdown && (
                <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-lg py-1 max-h-64 overflow-y-auto">
                  {uniqueOwners.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No owners found</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setOwnerFilters([]); setActiveViewId(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
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
                          <span className="text-sm text-foreground truncate">{owner}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {uniqueAbmStages.length > 0 && (
              <div className="relative">
                <select value={abmStageFilter} onChange={(e) => setAbmStageFilter(e.target.value)}
                  className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">All ABM Stages</option>
                  {uniqueAbmStages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}
            {uniqueSegments.length > 0 && (
              <div className="relative">
                <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}
                  className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">All Segments</option>
                  {uniqueSegments.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}

            {/* Update / Save view buttons */}
            {isFiltered && !activeViewId && (() => {
              const dirtyView = dirtyViewId ? savedViews.find(v => v.id === dirtyViewId) : null;
              if (dirtyView) {
                return (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateView(dirtyView.id)}
                      className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-primary/40 bg-primary/8 text-sm text-primary hover:bg-primary/15 transition-colors font-medium"
                      title={`Save changes to "${dirtyView.name}"`}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Update view</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveViewName(""); setShowSaveDialog(true); }}
                      className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      title="Save as a new view"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Save as new</span>
                    </button>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  onClick={() => { setSaveViewName(""); setShowSaveDialog(true); }}
                  className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  title="Save this filter as a view"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save list view</span>
                </button>
              );
            })()}

            {/* Saved views dropdown */}
            {savedViews.length > 0 && (
              <div className="relative" ref={viewsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowViewsDropdown(v => !v)}
                  className={`flex items-center gap-1.5 h-10 px-3 rounded-md border text-sm font-medium transition-colors ${
                    activeViewId
                      ? "border-primary/50 bg-primary/8 text-primary"
                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>{activeViewId ? savedViews.find(v => v.id === activeViewId)?.name ?? "Views" : `Views (${savedViews.length})`}</span>
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </button>
                {showViewsDropdown && (
                  <div className="absolute top-full right-0 mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-lg py-1">
                    <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saved Views</p>
                    {savedViews.map(view => (
                      <div key={view.id} className="flex items-center gap-1 px-2 py-1 hover:bg-muted/50 rounded-sm group">
                        <button
                          type="button"
                          onClick={() => loadView(view)}
                          className={`flex-1 text-left text-sm truncate py-0.5 ${activeViewId === view.id ? "text-primary font-medium" : "text-foreground"}`}
                        >
                          {view.name}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                          className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                          title="Delete view"
                        >
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
                onChange={(e) => setSaveViewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setShowSaveDialog(false); }}
                placeholder="View name…"
                className="h-7 text-sm flex-1"
                autoFocus
              />
              <Button size="sm" className="h-7 px-3 text-xs" onClick={saveView} disabled={!saveViewName.trim()}>Save</Button>
              <button onClick={() => setShowSaveDialog(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {isFiltered && !showSaveDialog && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg text-sm text-muted-foreground">
              {activeViewId && <BookmarkCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
              <span>
                {activeViewId && <span className="font-medium text-foreground mr-1">{savedViews.find(v => v.id === activeViewId)?.name} · </span>}
                {filtered.length} account{filtered.length !== 1 ? "s" : ""} match your filters
              </span>
              <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-1">Clear all</button>
            </div>
          )}
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/40">
          <div className="flex-1">
            <Link href="/sales/sfdc" className="text-muted-foreground hover:text-foreground transition-colors">
              Data synced from Salesforce
            </Link>
            {lastSyncTime && (
              <span className="text-muted-foreground/70">
                {" "} · Last updated: {format(lastSyncTime, "MMM d, h:mm a")}
              </span>
            )}
          </div>
          <DisplayNameImportButton onImported={fetchAccounts} />
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              setIsSyncing(true);
              try {
                await fetch(`${API_BASE}/sales/sfdc/sync/accounts`, { method: "POST" });
                fetchAccounts();
              } catch (error) {
                console.error("Failed to sync accounts:", error);
                setIsSyncing(false);
              }
            }}
            disabled={isSyncing}
            className="h-7 w-7 p-0"
            title="Sync accounts from Salesforce"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Account List */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {search ? "No accounts match your search" : "No accounts yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {search ? "Try a different search term" : "Click 'New Account' to add your first target account"}
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {accPag.pageItems.map((account) => (
              <div
                key={account.id}
                onClick={() => navigate(`/sales/accounts/${account.id}`)}
                className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150 cursor-pointer"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{account.displayName ?? account.name}</span>
                    {account.abmTier && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {account.abmTier}
                      </span>
                    )}
                    {account.abmStage && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${abmStageStyle(account.abmStage)}`}>
                        {account.abmStage}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {account.displayName && <span className="text-muted-foreground/50 truncate max-w-[160px]" title={account.name}>SF: {account.name}</span>}
                    {account.practiceSegment && <span>{account.practiceSegment}</span>}
                    {account.domain && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {account.domain}
                      </span>
                    )}
                    {account.numLocations && <span>{account.numLocations} locations</span>}
                    {account.owner && <span>· {account.owner}</span>}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  {(account.contactCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {account.contactCount}
                    </span>
                  )}
                  <span>{format(new Date(account.updatedAt), "MMM d")}</span>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            ))}
            <PaginationBar
              page={accPag.page} totalPages={accPag.totalPages}
              from={accPag.from} to={accPag.to} total={accPag.total}
              onPage={accPag.setPage} label="accounts"
            />
          </div>
        )}
      </div>
    </SalesLayout>
  );
}

/* ─── Briefing Panel ─────────────────────────────────────────── */

interface BriefingData {
  companyName?: string;
  overview?: string;
  tier?: string;
  organizationalModel?: string;
  leadership?: { name: string; title: string }[];
  sizeAndLocations?: {
    locationCount?: string | null;
    regions?: string[];
    headquarters?: string | null;
    estimatedRevenue?: string | null;
    ownership?: string | null;
  };
  recentNews?: { headline: string; summary: string; date?: string | null }[];
  buyingCommittee?: { role: string; painPoints: string; recommendedMessage: string }[];
  fitAnalysis?: {
    primaryValueProp?: string;
    keyPainPoints?: string[];
    proofPoints?: string[];
    potentialObjections?: string[];
    recommendedApproach?: string;
  };
  talkingPoints?: string[];
  pageRecommendations?: {
    heroHeadline?: string;
    contentFocus?: string;
    ctaStrategy?: string;
  };
  sources?: string[];
}

interface Briefing {
  id: number;
  accountId: number;
  briefingData: BriefingData;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function BriefingPanel({ accountId }: { accountId: number }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/sales/accounts/${accountId}/briefing`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setBriefing)
      .catch(() => setBriefing(null))
      .finally(() => setLoading(false));
  }, [accountId]);

  async function generateBriefing() {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/sales/accounts/${accountId}/briefing`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
        setExpanded(true);
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-[120px] rounded-2xl" />;
  }

  const data = briefing?.briefingData;

  // No briefing yet — show generate CTA
  if (!briefing || !data?.overview || data.overview.includes("not yet available")) {
    return (
      <Card className="p-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">AI Account Briefing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate an AI-powered research briefing with leadership, news, pain points, and recommended approach
            </p>
          </div>
          <Button onClick={generateBriefing} disabled={generating} className="gap-2">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Researching…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Briefing
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Briefing exists — show expandable summary
  return (
    <Card className="rounded-2xl border border-border/60 overflow-hidden">
      {/* Header — always visible */}
      <div
        className="flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground text-sm">AI Briefing</p>
            {data.tier && data.tier !== "Unknown" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {data.tier}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{data.overview}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => { e.stopPropagation(); generateBriefing(); }}
          disabled={generating}
          title="Refresh briefing"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border/40 pt-5">

          {/* Overview */}
          {data.overview && (
            <div>
              <p className="text-sm text-foreground leading-relaxed">{data.overview}</p>
            </div>
          )}

          {/* Size & Locations */}
          {data.sizeAndLocations && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.sizeAndLocations.locationCount && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Locations</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{data.sizeAndLocations.locationCount}</p>
                </div>
              )}
              {data.sizeAndLocations.headquarters && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">HQ</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{data.sizeAndLocations.headquarters}</p>
                </div>
              )}
              {data.sizeAndLocations.estimatedRevenue && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Revenue</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{data.sizeAndLocations.estimatedRevenue}</p>
                </div>
              )}
              {data.sizeAndLocations.ownership && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Ownership</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{data.sizeAndLocations.ownership}</p>
                </div>
              )}
            </div>
          )}

          {/* Leadership */}
          {data.leadership && data.leadership.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Leadership</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.leadership.map((person, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {person.name?.[0] ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{person.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fit Analysis */}
          {data.fitAnalysis && data.fitAnalysis.primaryValueProp && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dandy Fit Analysis</h4>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-900/30">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{data.fitAnalysis.primaryValueProp}</p>
                {data.fitAnalysis.keyPainPoints && data.fitAnalysis.keyPainPoints.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {data.fitAnalysis.keyPainPoints.map((pt, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {pt}
                      </span>
                    ))}
                  </div>
                )}
                {data.fitAnalysis.recommendedApproach && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-3">
                    <span className="font-semibold">Approach:</span> {data.fitAnalysis.recommendedApproach}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Buying Committee */}
          {data.buyingCommittee && data.buyingCommittee.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Buying Committee</h4>
              <div className="flex flex-col gap-2">
                {data.buyingCommittee.map((person, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/30">
                    <p className="text-sm font-medium text-foreground">{person.role}</p>
                    <p className="text-xs text-muted-foreground mt-1">{person.painPoints}</p>
                    <p className="text-xs text-primary mt-1 italic">{person.recommendedMessage}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Talking Points */}
          {data.talkingPoints && data.talkingPoints.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Talking Points</h4>
              <div className="flex flex-col gap-1.5">
                {data.talkingPoints.map((pt, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <MessageSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent News */}
          {data.recentNews && data.recentNews.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent News</h4>
              <div className="flex flex-col gap-2">
                {data.recentNews.map((news, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{news.headline}</p>
                      {news.date && <span className="text-[10px] text-muted-foreground">{news.date}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{news.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Page Recommendations */}
          {data.pageRecommendations && data.pageRecommendations.heroHeadline && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Microsite Recommendations</h4>
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium text-foreground">"{data.pageRecommendations.heroHeadline}"</p>
                {data.pageRecommendations.contentFocus && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-semibold">Focus:</span> {data.pageRecommendations.contentFocus}
                  </p>
                )}
                {data.pageRecommendations.ctaStrategy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold">CTA:</span> {data.pageRecommendations.ctaStrategy}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Sources */}
          {data.sources && data.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sources</h4>
              <div className="flex flex-wrap gap-1.5">
                {data.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {new URL(src).hostname.replace("www.", "")}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Updated timestamp */}
          {briefing?.updatedAt && (
            <p className="text-[10px] text-muted-foreground text-right">
              Last updated {format(new Date(briefing.updatedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─── Activity Timeline ──────────────────────────────────────── */

interface Signal {
  id: number;
  accountId: number | null;
  contactId: number | null;
  type: string;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const signalConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  page_view: { icon: Eye, label: "Page View", color: "text-blue-500" },
  email_open: { icon: Mail, label: "Email Opened", color: "text-amber-500" },
  email_click: { icon: MousePointerClick, label: "Email Clicked", color: "text-emerald-500" },
  form_submit: { icon: FileText, label: "Form Submitted", color: "text-purple-500" },
};

function ActivityTimeline({ accountId, contacts }: { accountId: number; contacts: Contact[] }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/sales/signals?accountId=${accountId}&limit=20`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => Array.isArray(res) ? res : res.data ?? [])
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <Skeleton className="h-[120px] rounded-2xl" />;
  if (signals.length === 0) {
    return (
      <Card className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border">
        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
          <Activity className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Signals will appear here when contacts engage with microsites and emails
          </p>
        </div>
      </Card>
    );
  }

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-2">
      {signals.map((signal) => {
        const config = signalConfig[signal.type] ?? { icon: Activity, label: signal.type, color: "text-muted-foreground" };
        const Icon = config.icon;
        const contact = signal.contactId ? contactMap.get(signal.contactId) : null;

        return (
          <div key={signal.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border/60 rounded-xl">
            <div className={`mt-0.5 ${config.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                <span className="font-medium">{config.label}</span>
                {contact && (
                  <span className="text-muted-foreground"> by {contact.firstName} {contact.lastName}</span>
                )}
              </p>
              {signal.source && (
                <p className="text-xs text-muted-foreground mt-0.5">{signal.source}</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(new Date(signal.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Display Name CSV Import ────────────────────────────────── */

function DisplayNameImportButton({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ sfdcId: string | null; accountName: string | null; displayName: string }[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number; skipped: number; notFoundNames: string[] } | null>(null);
  const [error, setError] = useState("");

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
      return row;
    });
  }

  function normRow(r: Record<string, string>) {
    return {
      sfdcId: (r.sfdc_id ?? r.sfdcId ?? r.salesforce_id ?? "").trim() || null,
      accountName: (r.account_name ?? r.accountName ?? r.name ?? "").trim() || null,
      displayName: (r.display_name ?? r.displayName ?? r.clean_name ?? "").trim(),
    };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const rows = parseCSV(evt.target?.result as string);
      setAllRows(rows);
      setPreview(rows.slice(0, 5).map(normRow));
      setResult(null);
      setError("");
      setOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleApply() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sales/import/display-names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: allRows }),
      });
      const data = await res.json() as { success?: boolean; summary?: typeof result; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Import failed");
      setResult(data.summary!);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs gap-1 text-muted-foreground"
        title="Upload a CSV to bulk-set display names"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5" />
        Display names
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">Import display names</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{allRows.length} rows · matched by SFDC ID then account name</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {!result ? (
              <>
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/40">
                  <p className="font-medium text-foreground mb-1">Expected columns (any order):</p>
                  <p><code className="font-mono">sfdc_id</code> — Salesforce Account ID (primary match key)</p>
                  <p><code className="font-mono">account_name</code> — account name (fallback if no sfdc_id)</p>
                  <p><code className="font-mono">display_name</code> — clean name to use in the UI and outreach</p>
                  <p className="mt-1 text-muted-foreground/70">Leave display_name blank to clear a name back to the raw SF value.</p>
                </div>

                {preview.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Match</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Display name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preview.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-foreground font-mono truncate max-w-[180px]">
                              {r.sfdcId ?? r.accountName ?? <span className="text-destructive">missing</span>}
                            </td>
                            <td className="px-3 py-1.5 text-foreground truncate max-w-[180px]">
                              {r.displayName || <span className="text-muted-foreground italic">clear</span>}
                            </td>
                          </tr>
                        ))}
                        {allRows.length > 5 && (
                          <tr>
                            <td colSpan={2} className="px-3 py-1.5 text-muted-foreground text-center">
                              + {allRows.length - 5} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleApply} disabled={loading || allRows.length === 0}>
                    {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Applying…</> : `Apply to ${allRows.length} accounts`}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.updated}</p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">updated</p>
                    </div>
                    {result.notFound > 0 && (
                      <div className="flex-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.notFound}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">not found</p>
                      </div>
                    )}
                    {result.skipped > 0 && (
                      <div className="flex-1 rounded-lg bg-muted/50 border border-border px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">skipped</p>
                      </div>
                    )}
                  </div>
                  {result.notFoundNames.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 max-h-28 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Not matched:</p>
                      {result.notFoundNames.map((n, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono truncate">{n}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setOpen(false); setResult(null); }}>Close</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setResult(null); fileRef.current?.click(); }}>Import another file</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Contact Import (CSV) ───────────────────────────────────── */

function ContactImportWizard({ accountId, onImported }: { accountId: number; onImported: () => void }) {
  const [show, setShow] = useState(false);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const targetFields = ["firstName", "lastName", "email", "title", "role", "phone"];

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const hdrs = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      setHeaders(hdrs);
      // Auto-map by common names
      const autoMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {
        "first_name": "firstName", "first name": "firstName", "firstname": "firstName",
        "last_name": "lastName", "last name": "lastName", "lastname": "lastName",
        "email": "email", "email_address": "email",
        "title": "title", "job_title": "title", "job title": "title",
        "role": "role", "buyer_role": "role",
        "phone": "phone", "phone_number": "phone",
      };
      hdrs.forEach((h) => {
        const key = h.toLowerCase().trim();
        if (nameMap[key]) autoMap[h] = nameMap[key];
      });
      setMapping(autoMap);

      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        hdrs.forEach((h, i) => { row[h] = vals[i] ?? ""; });
        return row;
      });
      setCsvRows(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    let imported = 0;
    let errors = 0;

    for (const row of csvRows) {
      const contact: Record<string, unknown> = { accountId };
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field && row[csvCol]) contact[field] = row[csvCol];
      }
      if (!contact.firstName || !contact.lastName) { errors++; continue; }

      try {
        const res = await fetch(`${API_BASE}/sales/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contact),
        });
        if (res.ok) imported++;
        else errors++;
      } catch {
        errors++;
      }
    }

    setResult({ imported, errors });
    setImporting(false);
    if (imported > 0) onImported();
  }

  if (!show) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShow(true)} className="gap-1.5">
        <Upload className="w-3.5 h-3.5" />
        Import CSV
      </Button>
    );
  }

  return (
    <Card className="p-5 rounded-2xl border border-primary/30 bg-primary/5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Import Contacts from CSV</h3>
          <Button variant="ghost" size="sm" onClick={() => { setShow(false); setCsvRows([]); setResult(null); }}>Cancel</Button>
        </div>

        {result ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Imported {result.imported} contacts{result.errors > 0 ? `, ${result.errors} skipped` : ""}
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setShow(false); setCsvRows([]); setResult(null); }}>
              Done
            </Button>
          </div>
        ) : csvRows.length === 0 ? (
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            <p className="text-xs text-muted-foreground mt-2">CSV should have headers: first_name, last_name, email, title, role</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{csvRows.length} rows found. Map CSV columns to contact fields:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {headers.map((h) => (
                <div key={h}>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">
                    {h}
                  </label>
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="">— skip —</option>
                    {targetFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleImport} disabled={importing || !mapping.firstName || !mapping.lastName}>
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing…</>
                ) : (
                  `Import ${csvRows.length} Contacts`
                )}
              </Button>
              {(!mapping.firstName || !mapping.lastName) && (
                <p className="text-xs text-red-500">Map at least firstName and lastName</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Account Detail View ────────────────────────────────────── */

function AccountDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { domainContext } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Microsites
  const [microsites, setMicrosites] = useState<Microsite[]>([]);
  const [micrositesLoading, setMicrositesLoading] = useState(false);
  const [showMicrositeModal, setShowMicrositeModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Hotlinks (per-contact personalized links for this account)
  const [hotlinks, setHotlinks] = useState<Hotlink[]>([]);
  const [copiedContactId, setCopiedContactId] = useState<number | null>(null);

  // AI email draft
  const [draftEmailContact, setDraftEmailContact] = useState<Contact | null>(null);

  // Display name inline editing
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");

  async function saveDisplayName() {
    if (!account) return;
    const value = displayNameInput.trim();
    setEditingDisplayName(false);
    if (value === (account.displayName ?? "")) return;
    const res = await fetch(`${API_BASE}/sales/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: value }),
    });
    if (res.ok) {
      const updated = await res.json() as Account;
      setAccount(updated);
    }
  }

  // Last signal time for Overview stat
  const [lastSignalTime, setLastSignalTime] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/sales/signals?accountId=${id}&limit=1`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then((res: any) => Array.isArray(res) ? res : res.data ?? [])
      .then((sigs: { createdAt: string }[]) => {
        if (sigs.length > 0) setLastSignalTime(sigs[0].createdAt);
      })
      .catch(() => {});
  }, [id]);

  // Detail tabs
  type DetailTab = "overview" | "contacts" | "microsites" | "activity";
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  // Contacts section ref for scrolling
  const contactsSectionRef = useRef<HTMLDivElement>(null);

  // New contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast, setContactLast] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/accounts/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/sales/accounts/${id}/contacts`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([acct, ctcts]) => {
        setAccount(acct);
        setContacts(ctcts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const fetchMicrosites = useCallback(() => {
    setMicrositesLoading(true);
    fetch(`${API_BASE}/sales/accounts/${id}/microsites`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMicrosites)
      .catch(() => setMicrosites([]))
      .finally(() => setMicrositesLoading(false));
  }, [id]);

  const fetchHotlinks = useCallback(() => {
    fetch(`${API_BASE}/sales/hotlinks?accountId=${id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setHotlinks)
      .catch(() => setHotlinks([]));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchMicrosites(); fetchHotlinks(); }, [fetchMicrosites, fetchHotlinks]);

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactFirst.trim() || !contactLast.trim()) return;
    setSavingContact(true);
    try {
      const res = await fetch(`${API_BASE}/sales/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: Number(id),
          firstName: contactFirst.trim(),
          lastName: contactLast.trim(),
          email: contactEmail.trim() || null,
          title: contactTitle.trim() || null,
          role: contactRole.trim() || null,
        }),
      });
      if (res.ok) {
        setContactFirst(""); setContactLast(""); setContactEmail("");
        setContactTitle(""); setContactRole("");
        setShowContactForm(false);
        fetchData();
      }
    } finally {
      setSavingContact(false);
    }
  }


  function getHotlinkBase() {
    const partnerDomain = domainContext?.micrositeDomain;
    if (partnerDomain) return `https://${partnerDomain}`;
    return window.location.origin;
  }

  function handleCopyToken(token: string) {
    navigator.clipboard.writeText(`${getHotlinkBase()}/p/${token}`).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  function handleCopyContactLink(contactId: number, token: string) {
    navigator.clipboard.writeText(`${getHotlinkBase()}/p/${token}`).then(() => {
      setCopiedContactId(contactId);
      setTimeout(() => setCopiedContactId(null), 2000);
    });
  }

  if (loading) {
    return (
      <SalesLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-[200px] rounded-2xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </div>
      </SalesLayout>
    );
  }

  if (!account) {
    return (
      <SalesLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-lg font-semibold text-foreground">Account not found</p>
          <Button variant="outline" onClick={() => navigate("/sales/accounts")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Accounts
          </Button>
        </div>
      </SalesLayout>
    );
  }

  const DETAIL_TABS: { id: DetailTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "microsites", label: "Microsites", count: microsites.length },
    { id: "activity", label: "Activity" },
  ];

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Back + Header */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg mt-1"
            onClick={() => navigate("/sales/accounts")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              {editingDisplayName ? (
                <input
                  autoFocus
                  className="text-2xl font-display font-bold bg-transparent border-b-2 border-primary outline-none text-foreground min-w-0 w-72"
                  value={displayNameInput}
                  onChange={e => setDisplayNameInput(e.target.value)}
                  onBlur={saveDisplayName}
                  onKeyDown={e => { if (e.key === "Enter") saveDisplayName(); if (e.key === "Escape") setEditingDisplayName(false); }}
                  placeholder={account.name}
                />
              ) : (
                <h1
                  className="text-2xl font-display font-bold text-foreground truncate cursor-pointer group flex items-center gap-2"
                  onClick={() => { setDisplayNameInput(account.displayName ?? ""); setEditingDisplayName(true); }}
                  title="Click to set a clean display name"
                >
                  {account.displayName ?? account.name}
                  <Pencil className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </h1>
              )}
              {account.abmStage && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${abmStageStyle(account.abmStage)}`}>
                  {account.abmStage}
                </span>
              )}
            </div>
            {account.displayName && account.displayName !== account.name && (
              <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">SF: {account.name}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
              {account.domain && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {account.domain}
                </span>
              )}
              {account.owner && <span>· {account.owner}</span>}
              {account.abmTier && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {account.abmTier}
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={() => { setDetailTab("microsites"); setShowMicrositeModal(true); }}
            className="gap-2 shrink-0"
            size="sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Microsite
          </Button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 border-b border-border">
          {DETAIL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setDetailTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                detailTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {detailTab === "overview" && (
          <div className="flex flex-col gap-4">
            {/* Quick stats row */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setDetailTab("contacts")}
                className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer text-center"
              >
                <span className="text-2xl font-bold text-foreground">{contacts.length}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Contacts</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("microsites")}
                className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer text-center"
              >
                <span className="text-2xl font-bold text-foreground">{micrositesLoading ? "–" : microsites.length}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Microsites</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("activity")}
                className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer text-center"
              >
                <span className="text-2xl font-bold text-foreground">
                  {lastSignalTime ? format(new Date(lastSignalTime), "MMM d") : "–"}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Last Signal</span>
              </button>
            </div>

            {/* Account metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {account.segment && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Segment</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.segment}</p>
                </div>
              )}
              {account.industry && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Industry</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.industry}</p>
                </div>
              )}
              {account.numLocations && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Locations</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.numLocations}</p>
                </div>
              )}
              {(account.city || account.state) && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">HQ</p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {[account.city, account.state].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
              {account.abmStage && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">ABM Stage</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.abmStage}</p>
                </div>
              )}
              {account.privateEquityFirm && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">PE Firm</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.privateEquityFirm}</p>
                </div>
              )}
              {account.dsoSize && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">DSO Size</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.dsoSize}</p>
                </div>
              )}
              {account.practiceSegment && (
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Practice Segment</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{account.practiceSegment}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            {account.notes && (
              <Card className="p-5 rounded-2xl border border-border/60">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{account.notes}</p>
              </Card>
            )}

            {/* AI Briefing */}
            <BriefingPanel accountId={Number(id)} />
          </div>
        )}

        {/* ── Contacts Tab ── */}
        {detailTab === "contacts" && (
          <div ref={contactsSectionRef} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {contacts.length} Contact{contacts.length !== 1 ? "s" : ""}
              </h2>
              <div className="flex items-center gap-2">
                <ContactImportWizard accountId={Number(id)} onImported={fetchData} />
                <Button variant="outline" size="sm" onClick={() => setShowContactForm(!showContactForm)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add Contact
                </Button>
              </div>
            </div>

            {/* New Contact Form */}
            {showContactForm && (
              <Card className="p-5 rounded-2xl border border-primary/30 bg-primary/5">
                <form onSubmit={handleCreateContact} className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-foreground">Add Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name *</label>
                      <Input value={contactFirst} onChange={(e) => setContactFirst(e.target.value)} placeholder="Jane" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name *</label>
                      <Input value={contactLast} onChange={(e) => setContactLast(e.target.value)} placeholder="Smith" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                      <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@company.com" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Job Title</label>
                      <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="VP of Operations" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Buyer Role</label>
                      <Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Decision Maker" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={savingContact || !contactFirst.trim() || !contactLast.trim()}>
                      {savingContact ? "Adding…" : "Add Contact"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowContactForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {contacts.length === 0 ? (
              <Card className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">No contacts yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add contacts to start sending personalized outreach
                  </p>
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  const latestByContact = new Map<number, string>();
                  for (const hl of hotlinks) {
                    if (!latestByContact.has(hl.contactId)) {
                      latestByContact.set(hl.contactId, hl.token);
                    }
                  }

                  const PERSONA_ORDER = ["Decision Maker", "Champion", "Influencer", "Other"];
                  const grouped = new Map<string, Contact[]>();
                  for (const c of contacts) {
                    const key = c.contactRole ?? c.role ?? "Other";
                    const bucket = grouped.get(key) ?? [];
                    bucket.push(c);
                    grouped.set(key, bucket);
                  }
                  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
                    const ai = PERSONA_ORDER.indexOf(a);
                    const bi = PERSONA_ORDER.indexOf(b);
                    if (ai !== -1 && bi !== -1) return ai - bi;
                    if (ai !== -1) return -1;
                    if (bi !== -1) return 1;
                    return a.localeCompare(b);
                  });

                  const personaBadgeStyle: Record<string, string> = {
                    "Decision Maker": "bg-primary/15 text-primary",
                    "Champion": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                    "Influencer": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                  };

                  return sortedGroups.map(([role, groupContacts]) => (
                    <div key={role} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 px-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${personaBadgeStyle[role] ?? "bg-muted text-muted-foreground"}`}>
                          {role}
                        </span>
                        <span className="text-xs text-muted-foreground">{groupContacts.length} contact{groupContacts.length !== 1 ? "s" : ""}</span>
                      </div>
                      {groupContacts.map((contact) => {
                        const token = latestByContact.get(contact.id);
                        return (
                          <div key={contact.id} className="flex items-center gap-3 px-5 py-3 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all">
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                              {contact.firstName[0]}{contact.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground">{contact.firstName} {contact.lastName}</p>
                                {contact.titleLevel && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{contact.titleLevel}</span>
                                )}
                                {contact.tier && contact.tier !== "0.0" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase">{contact.tier}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                                {contact.title && <span>{contact.title}</span>}
                                {contact.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{contact.email}</span>}
                                {contact.linkedinUrl && (
                                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-0.5 hover:text-primary transition-colors"
                                    onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="w-3 h-3" />LinkedIn
                                  </a>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setDraftEmailContact(contact)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary text-xs font-medium transition-all shrink-0"
                              title="Draft AI email"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Draft Email</span>
                            </button>
                            {token && (
                              <button
                                onClick={() => handleCopyContactLink(contact.id, token)}
                                title="Copy personalized link"
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
                              >
                                {copiedContactId === contact.id ? (
                                  <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500 font-medium">Copied</span></>
                                ) : (
                                  <><Link2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Link</span></>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Microsites Tab ── */}
        {detailTab === "microsites" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layout className="w-4 h-4 text-muted-foreground" />
                {micrositesLoading ? "Loading…" : `${microsites.length} Microsite${microsites.length !== 1 ? "s" : ""}`}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMicrositeModal(true)}
                className="gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Microsite
              </Button>
            </div>

            {micrositesLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : microsites.length === 0 ? (
              <Card className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-dashed border-border text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Layout className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">No microsites yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                    Generate a personalized microsite for this account. Hotlinks will be auto-created for all contacts with an email.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-2 mt-1"
                  onClick={() => setShowMicrositeModal(true)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Microsite
                </Button>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {microsites.map((site) => (
                  <div
                    key={site.pageId}
                    className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layout className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium text-foreground truncate">{site.title}</span>
                        <PageStatusBadge status={site.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{site.hotlinkCount} personalized link{site.hotlinkCount !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>Updated {format(new Date(site.updatedAt), "MMM d")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {site.firstToken && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-8 px-2.5 text-xs"
                          onClick={() => handleCopyToken(site.firstToken!)}
                        >
                          {copiedToken === site.firstToken ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Link
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 px-2.5 text-xs"
                        onClick={() => navigate(`/builder/${site.pageId}`)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Builder
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Activity Tab ── */}
        {detailTab === "activity" && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
            <ActivityTimeline accountId={Number(id)} contacts={contacts} />
          </div>
        )}

      </div>

      <GenerateMicrositeModal
        open={showMicrositeModal}
        onClose={() => setShowMicrositeModal(false)}
        accountName={account.displayName ?? account.name}
        accountId={id}
        onCreated={() => { fetchMicrosites(); fetchHotlinks(); }}
      />

      {draftEmailContact && (
        <DraftEmailModal
          contact={draftEmailContact}
          accountId={Number(id)}
          accountName={account.displayName ?? account.name}
          onClose={() => setDraftEmailContact(null)}
        />
      )}
    </SalesLayout>
  );
}

/* ─── Generate Microsite Modal ───────────────────────────────── */

type MicrositeAudience = "dso-corporate" | "dso-practice" | "independent";

const AUDIENCE_OPTIONS: { value: MicrositeAudience; label: string; sub: string }[] = [
  { value: "dso-corporate", label: "DSO Leadership", sub: "VPs, CFOs, Chief Dental Officers" },
  { value: "dso-practice", label: "DSO Practice", sub: "Dentists & office managers in a network" },
  { value: "independent", label: "Independent Practice", sub: "Solo or small group practices" },
];

interface MarketingTemplate {
  id: number;
  title: string;
  templateLabel: string | null;
  templateDescription: string | null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function GenerateMicrositeModal({
  open,
  onClose,
  accountName,
  accountId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accountName: string;
  accountId: string;
  onCreated: () => void;
}) {
  const [, navigate] = useLocation();
  const [audience, setAudience] = useState<MicrositeAudience | null>(null);
  const [prompt, setPrompt] = useState("");
  const [step, setStep] = useState<"idle" | "generating" | "linking" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [createdPageId, setCreatedPageId] = useState<number | null>(null);
  const [hotlinkCount, setHotlinkCount] = useState(0);
  const [marketingTemplates, setMarketingTemplates] = useState<MarketingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketingTemplate | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE}/lp/templates`)
      .then(r => r.json())
      .then((data: MarketingTemplate[]) => setMarketingTemplates(data))
      .catch(() => {});
  }, [open]);

  function reset() {
    setAudience(null);
    setPrompt("");
    setStep("idle");
    setErrorMsg("");
    setCreatedPageId(null);
    setHotlinkCount(0);
    setSelectedTemplate(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate() {
    if (!audience) return;
    setStep("generating");
    setErrorMsg("");
    try {
      let pageId: number;

      // Always AI-generate — if a template is selected, its block layout is passed
      // as a fixed constraint so AI customises the copy while preserving the structure
      const genRes = await fetch(`${API_BASE}/sales/accounts/${accountId}/generate-microsite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          prompt: prompt.trim() || undefined,
          ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error ?? "Generation failed");
      }
      const { page } = await genRes.json();
      pageId = page.id;

      setCreatedPageId(pageId);

      // Bulk-create hotlinks for all contacts with email
      setStep("linking");
      const linkRes = await fetch(`${API_BASE}/sales/accounts/${accountId}/microsites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      if (!linkRes.ok) throw new Error("Failed to create hotlinks");
      const { totalCount } = await linkRes.json();
      setHotlinkCount(totalCount);

      setStep("done");
      onCreated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  const busy = step === "generating" || step === "linking";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate Microsite
          </DialogTitle>
        </DialogHeader>

        {step === "done" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Microsite created!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hotlinkCount > 0
                  ? `${hotlinkCount} personalised hotlink${hotlinkCount !== 1 ? "s" : ""} created for contacts with email.`
                  : "No contacts with email found — add contacts to generate hotlinks."}
              </p>
            </div>

            {/* Workflow nudge — next steps */}
            <div className="w-full rounded-lg bg-muted/40 border border-border/50 px-4 py-3 text-left">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Next steps</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">1</div>
                  <span className="text-xs text-foreground">Preview & edit in the Builder</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">2</div>
                  <span className="text-xs text-foreground">Draft outreach emails with personalised links</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">3</div>
                  <span className="text-xs text-foreground">Track engagement in Activity</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 w-full">
              {createdPageId && (
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => { handleClose(); navigate(`/builder/${createdPageId}`); }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Builder
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => { handleClose(); navigate("/sales/draft-email"); }}
              >
                <Mail className="w-3.5 h-3.5" />
                Draft Email
              </Button>
            </div>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => setStep("idle")}>Try Again</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="text-sm text-muted-foreground">
              Dandy AI will create a personalised landing page for <strong>{accountName}</strong> and
              generate unique hotlinks for each contact with an email address.
            </div>

            {/* Marketing Templates (optional starting point) */}
            {marketingTemplates.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Start from a template <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="flex flex-col gap-2">
                  {marketingTemplates.map((t) => {
                    const label = t.templateLabel ?? t.title;
                    const isSelected = selectedTemplate?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={busy}
                        onClick={() => setSelectedTemplate(isSelected ? null : t)}
                        className={[
                          "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-amber-300",
                          isSelected
                            ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400"
                            : "border-border bg-background hover:border-amber-300",
                          busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                        ].join(" ")}
                      >
                        <span className="text-sm font-medium leading-tight flex items-center gap-1.5">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                          {label}
                        </span>
                        {t.templateDescription && (
                          <span className="text-xs text-muted-foreground">{t.templateDescription}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedTemplate && (
                  <p className="text-xs text-muted-foreground">Template selected — AI will use this layout and personalise all copy for {accountName}.</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Who is this page for? <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-col gap-2">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busy}
                    onClick={() => setAudience(opt.value)}
                    className={[
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary/30",
                      audience === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-background hover:border-primary/40",
                      busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium leading-tight">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-prompt" className="text-xs font-medium">
                Additional instructions <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="ms-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Focus on their enterprise expansion, emphasise ROI and onboarding speed…"
                rows={2}
                disabled={busy}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {step === "generating" ? "Generating personalised copy…" : "Creating contact hotlinks…"}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose} disabled={busy}>
                Cancel
              </Button>
              <Button className="flex-1 gap-1.5" onClick={handleGenerate} disabled={busy || !audience}>
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Exported Route Handler ─────────────────────────────────── */

export default function SalesAccounts() {
  const [matchDetail, params] = useRoute("/sales/accounts/:id");

  if (matchDetail && params?.id) {
    return <AccountDetailView id={params.id} />;
  }

  return <AccountListView />;
}
