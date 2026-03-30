import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  MoreHorizontal,
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
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface Account {
  id: number;
  name: string;
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

/* ─── Account List View ──────────────────────────────────────── */

function AccountListView() {
  const [, navigate] = useLocation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.domain ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (a.segment ?? "").toLowerCase().includes(search.toLowerCase())
  );

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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="pl-10"
          />
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
            {filtered.map((account) => (
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
                    <span className="font-semibold text-foreground text-sm">{account.name}</span>
                    {account.segment && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                        {account.segment}
                      </span>
                    )}
                    <StatusBadge status={account.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {account.domain && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {account.domain}
                      </span>
                    )}
                    {account.industry && <span>{account.industry}</span>}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span>{format(new Date(account.updatedAt), "MMM d")}</span>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            ))}
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
      .then((r) => (r.ok ? r.json() : []))
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
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // AI microsite generation
  const [generatingMicrosite, setGeneratingMicrosite] = useState(false);

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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => navigate("/sales/accounts")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-foreground truncate">
                {account.name}
              </h1>
              <StatusBadge status={account.status} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              {account.domain && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {account.domain}
                </span>
              )}
              {account.segment && <span className="font-medium">{account.segment}</span>}
              {account.industry && <span>{account.industry}</span>}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: generatingMicrosite ? "Generating…" : "AI Microsite",
              icon: generatingMicrosite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />,
              onClick: async () => {
                if (generatingMicrosite) return;
                setGeneratingMicrosite(true);
                try {
                  const res = await fetch(`${API_BASE}/sales/accounts/${id}/generate-microsite`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    navigate(`/pages/${data.page.id}`);
                  }
                } finally {
                  setGeneratingMicrosite(false);
                }
              },
            },
            { label: "Create Microsite", icon: <FileText className="w-4 h-4" />, href: "/sales/pages" },
            { label: "Send Email", icon: <Mail className="w-4 h-4" />, href: "/sales/outreach" },
            { label: "View Signals", icon: <Activity className="w-4 h-4" />, href: "/sales/signals" },
            { label: "Add Contact", icon: <Users className="w-4 h-4" />, onClick: () => setShowContactForm(true) },
          ].map((action) => (
            <Card
              key={action.label}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/60 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
              onClick={action.onClick ?? (() => {})}
            >
              {action.href ? (
                <Link href={action.href} className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </Link>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </>
              )}
            </Card>
          ))}
        </div>

        {/* AI Briefing */}
        <BriefingPanel accountId={Number(id)} />

        {/* Notes */}
        {account.notes && (
          <Card className="p-5 rounded-2xl border border-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{account.notes}</p>
          </Card>
        )}

        {/* Activity Timeline */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-display font-bold text-foreground">Activity</h2>
          <ActivityTimeline accountId={Number(id)} contacts={contacts} />
        </div>

        {/* Contacts */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-foreground">
              Contacts ({contacts.length})
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
            <div className="flex flex-col gap-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-4 px-5 py-3 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {contact.title && <span>{contact.title}</span>}
                      {contact.title && contact.email && <span>·</span>}
                      {contact.email && <span>{contact.email}</span>}
                    </div>
                  </div>
                  {contact.role && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {contact.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SalesLayout>
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
