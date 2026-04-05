import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Building2, Users, Activity, FileText, Plus, ChevronRight,
  Globe, Zap, Mail, PenTool, Send, Flame, Thermometer,
  AlertCircle, ArrowUpRight, Contact, Sparkles, Calculator,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";
import { getSignalIcon, getSignalLabel } from "@/lib/signal-types";

const API_BASE = "/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  name: string;
  domain?: string;
  segment?: string;
  abmTier?: string;
}

interface Signal {
  id: number;
  type: string;
  source?: string;
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

// ── Engagement scoring (mirrors server-side logic) ────────────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
  form_submit: 5,
  email_click: 3,
  link_click: 3,
  email_open: 2,
  page_view: 1,
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function computeScore(signals: Signal[], now: number) {
  let score = 0;
  for (const s of signals) {
    const w = SIGNAL_WEIGHTS[s.type] ?? 0;
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [micrositeGroups, setMicrositeGroups] = useState<MicrositeGroup[]>([]);
  const [signalsToday, setSignalsToday] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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

  const { hotAccounts, needsAttention, hotCount } = useMemo(() => {
    if (!accounts.length) return { hotAccounts: [], needsAttention: [], hotCount: 0 };

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

    // Hot accounts: have any signals, sorted by 7-day score desc
    const hot = enriched
      .filter(a => a.signalCount7d > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Needs attention: no microsite OR gone quiet (last signal > 14 days or no signal at all)
    const attention = enriched
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

    return { hotAccounts: hot, needsAttention: attention, hotCount: hot.length };
  }, [accounts, signals, micrositeGroups]);

  const recentSignals = useMemo(
    () => [...signals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10),
    [signals]
  );

  const isEmpty = !loading && accounts.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
          style={{ background: "linear-gradient(135deg, #003A30 0%, #005244 50%, #003A30 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #C7E738 0%, transparent 50%), radial-gradient(circle at 80% 20%, #C7E738 0%, transparent 40%)" }}
          />
          <div className="relative">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-white">{getGreeting()}</h1>
            <p className="text-white/50 mt-1 text-sm">Here's what needs your attention today.</p>
          </div>

          {/* Summary strip */}
          <div className="relative flex items-center gap-5 shrink-0">
            <div className="text-center">
              {loading ? <Skeleton className="h-7 w-8 bg-white/10 mx-auto mb-1" /> : <p className="text-2xl font-display font-bold text-white">{accounts.length}</p>}
              <p className="text-xs text-white/50 font-medium">Accounts</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              {loading ? <Skeleton className="h-7 w-8 bg-white/10 mx-auto mb-1" /> : <p className="text-2xl font-display font-bold text-[#C7E738]">{hotCount}</p>}
              <p className="text-xs text-white/50 font-medium">Hot this week</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              {loading ? <Skeleton className="h-7 w-8 bg-white/10 mx-auto mb-1" /> : <p className="text-2xl font-display font-bold text-white">{signalsToday}</p>}
              <p className="text-xs text-white/50 font-medium">Signals today</p>
            </div>
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <Link href="/sales/accounts" className="hidden sm:block">
              <Button size="sm" className="rounded-xl font-semibold" style={{ backgroundColor: "#C7E738", color: "#003A30" }}>
                <Plus className="w-4 h-4 mr-1.5" />New account
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Tool Cards ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-display font-bold text-foreground">Your tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: "accounts",   icon: <Building2 className="w-5 h-5" />, title: "Accounts",    description: "Your target DSOs. Search, filter by ABM stage, view engagement history and AI briefings.", cta: "View Accounts →",  href: "/sales/accounts" },
              { id: "draft",      icon: <PenTool className="w-5 h-5" />,   title: "Draft Email",  description: "AI-powered outreach. Pick a contact and generate a research-driven personalized email in seconds.", cta: "Draft Email →",    href: "/sales/draft-email" },
              { id: "microsites", icon: <Globe className="w-5 h-5" />,     title: "Microsites",   description: "Personalized landing pages. Create branded microsites for prospects, customize sections, and generate trackable hotlinks.", cta: "View Microsites →", href: "/sales/microsites" },
              { id: "campaigns",  icon: <Send className="w-5 h-5" />,      title: "Campaigns",    description: "Bulk email outreach. Build audiences, compose templated emails with merge variables, and track performance.", cta: "View Campaigns →", href: "/sales/campaigns" },
              { id: "activity",   icon: <Zap className="w-5 h-5" />,       title: "Activity",     description: "Engagement intelligence. See who visited your microsites, opened emails, clicked CTAs, and submitted forms.", cta: "View Activity →",  href: "/sales/signals" },
              { id: "contacts",   icon: <Contact className="w-5 h-5" />,   title: "Contacts",     description: "Your prospect database. Browse contacts, see engagement scores, and draft personalized emails in one click.", cta: "View Contacts →",  href: "/sales/contacts" },
              { id: "roi-calc",   icon: <Calculator className="w-5 h-5" />, title: "ROI Calculator", description: "Calculate invisible waste impact for DSO prospects. Model denture workflow and remake savings across practices.", cta: "Open Calculator →", href: "/sales/roi-calculator" },
              { id: "one-pager",  icon: <FileText className="w-5 h-5" />,  title: "One-Pager",     description: "Generate branded PDF one-pagers for prospects. Choose from 5 templates, customize content, and export.", cta: "Create One-Pager →", href: "/sales/one-pager" },
            ].map(tool => (
              <Link href={tool.href} key={tool.id}>
                <Card className="group relative h-full flex flex-col gap-3 p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[#C7E738]/15 flex items-center justify-center text-[#2D6A4F] group-hover:bg-[#C7E738]/25 transition-colors">
                      {tool.icon}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-foreground mb-1.5">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    {tool.cta}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {isEmpty ? (
          /* ── Onboarding ───────────────────────────────────────────── */
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-display font-bold text-foreground">Get started</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "01", title: "Add an account", desc: "Create your first target account — a DSO, practice, or company you want to engage.", cta: "Add Account", href: "/sales/accounts", icon: <Building2 className="w-5 h-5" />, primary: true },
                { step: "02", title: "Build a microsite", desc: "Use the page builder to create a personalized microsite for the account.", cta: "Create Microsite", href: "/sales/microsites", icon: <FileText className="w-5 h-5" /> },
                { step: "03", title: "Send outreach", desc: "Generate a personalized email, attach the microsite link, and send it.", cta: "Start Outreach", href: "/sales/draft-email", icon: <Mail className="w-5 h-5" /> },
              ].map(item => (
                <Link href={item.href} key={item.step}>
                  <Card className={`group h-full flex flex-col gap-4 p-6 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${item.primary ? "border-primary/40 bg-primary/5 hover:border-primary/60" : "border-border/60 bg-card hover:border-primary/20"}`}>
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.primary ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"}`}>{item.icon}</div>
                      <span className="text-xs font-bold text-muted-foreground/50 font-mono">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground mb-1.5">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">{item.cta} <ChevronRight className="w-4 h-4" /></div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Main 2-col layout ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* ── Hot accounts (wider) ─────────────────────────────── */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <h2 className="text-base font-display font-bold text-foreground">Hot accounts</h2>
                    <span className="text-xs text-muted-foreground font-normal">— most engaged this week</span>
                  </div>
                  <Link href="/sales/accounts">
                    <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                      All accounts <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                {loading ? (
                  <div className="flex flex-col gap-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : hotAccounts.length === 0 ? (
                  <Card className="flex flex-col items-center gap-3 p-8 rounded-2xl border border-dashed border-border text-center">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">No engagement yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Accounts will appear here when contacts open emails or visit microsites.</p>
                    </div>
                    <Link href="/sales/microsites">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Globe className="w-3.5 h-3.5" />Create a microsite
                      </Button>
                    </Link>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-2">
                    {hotAccounts.map(acct => {
                      const heat = acct.heat as "hot" | "warm" | "cool" | null;
                      const heatCfg = heat ? HEAT_CONFIG[heat] : null;
                      return (
                        <div
                          key={acct.id}
                          className="group flex items-center gap-3 px-4 py-3.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 hover:shadow-sm transition-all"
                        >
                          {/* Heat badge */}
                          {heatCfg ? (
                            <Badge variant="outline" className={`text-[10px] font-bold shrink-0 flex items-center gap-1 px-2 py-0.5 ${heatCfg.className}`}>
                              {heatCfg.icon}{heatCfg.label}
                            </Badge>
                          ) : (
                            <div className="w-[52px] shrink-0" />
                          )}

                          {/* Account info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{acct.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground/70">{acct.signalCount7d} signal{acct.signalCount7d !== 1 ? "s" : ""} this week</span>
                              {acct.lastSignal && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    {getSignalIcon(acct.lastSignal.type, "w-3 h-3")}
                                    {getSignalLabel(acct.lastSignal.type).toLowerCase()}
                                    {" "}{formatDistanceToNow(new Date(acct.lastSignal.createdAt), { addSuffix: true })}
                                    {acct.lastSignal.contactName && <span className="text-foreground/60">by {acct.lastSignal.contactName}</span>}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Link href={`/sales/accounts?highlight=${acct.id}`}>
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1">
                                <Building2 className="w-3 h-3" />View
                              </Button>
                            </Link>
                            <Link href={`/sales/draft-email?accountId=${acct.id}`}>
                              <Button size="sm" className="h-7 px-2.5 text-xs gap-1" style={{ backgroundColor: "#003A30", color: "#C7E738" }}>
                                <PenTool className="w-3 h-3" />Draft email
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Live signals feed (narrower) ─────────────────────── */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-base font-display font-bold text-foreground">Live signals</h2>
                  </div>
                  <Link href="/sales/signals">
                    <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                      All <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                <div className="flex flex-col gap-1.5">
                  {loading ? (
                    [...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
                  ) : recentSignals.length === 0 ? (
                    <Card className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-dashed border-border text-center">
                      <Activity className="w-5 h-5 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">No signals yet — send outreach to start seeing engagement.</p>
                    </Card>
                  ) : (
                    recentSignals.map(signal => (
                      <div key={signal.id} className="flex items-start gap-2.5 px-3.5 py-2.5 bg-card border border-border/60 rounded-xl hover:border-primary/20 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                          {getSignalIcon(signal.type, "w-3.5 h-3.5")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground leading-snug">
                            {signal.contactName ?? signal.accountName ?? "Unknown"}{" "}
                            <span className="text-muted-foreground font-normal">{getSignalLabel(signal.type).toLowerCase()}</span>
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                            {signal.accountName && <span className="font-medium truncate">{signal.accountName}</span>}
                            <span>·</span>
                            <span className="shrink-0">{formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Needs attention ──────────────────────────────────── */}
            {(loading || needsAttention.length > 0) && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h2 className="text-base font-display font-bold text-foreground">Needs attention</h2>
                  <span className="text-xs text-muted-foreground font-normal">— no microsite or gone quiet</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {loading ? (
                    [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                  ) : (
                    needsAttention.map(acct => {
                      const noMicrosite = !acct.hasMicrosite;
                      const reason = noMicrosite
                        ? "No microsite yet"
                        : acct.daysSinceLastSignal !== null
                          ? `Quiet for ${acct.daysSinceLastSignal}d`
                          : "No engagement yet";
                      return (
                        <Card key={acct.id} className="group flex flex-col gap-2.5 p-4 rounded-xl border border-border/60 hover:border-amber-200 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{acct.name}</p>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${noMicrosite ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                              {reason}
                            </span>
                          </div>
                          {acct.segment && <p className="text-xs text-muted-foreground">{acct.segment}</p>}
                          <div className="flex items-center gap-1.5 mt-auto pt-1">
                            {noMicrosite ? (
                              <Link href={`/sales/accounts?highlight=${acct.id}`}>
                                <Button size="sm" className="h-7 px-2.5 text-xs gap-1 w-full" style={{ backgroundColor: "#003A30", color: "#C7E738" }}>
                                  <Sparkles className="w-3 h-3" />Generate microsite
                                </Button>
                              </Link>
                            ) : (
                              <Link href={`/sales/draft-email?accountId=${acct.id}`}>
                                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 w-full">
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
