import { Link, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import {
  Plus,
  ArrowUpRight,
  Radio,
  Paintbrush,
  ExternalLink,
  FileText,
  ChevronRight,
  Edit2,
  LayoutGrid,
  Eye,
  Users,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { getRecentEntries } from "@/hooks/use-recently-viewed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { AppLayout } from "@/components/layout/app-layout";
import { NewLauncher } from "@/components/NewLauncher";
import { getLpPageUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { PendingReviewWidget } from "@/components/dashboard/PendingReviewWidget";

const API_BASE = "/api";

interface BuilderPage {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  blocks: unknown[];
  updatedAt: string;
  isTemplate?: boolean;
  createdByName?: string | null;
  updatedByName?: string | null;
}

interface AnalyticsOverview {
  totalVisits: number;
  visitsTrend: number;
  totalLeads: number;
  leadsTrend: number;
  publishedPages: number;
  totalPages: number;
}

interface PageAnalytics {
  pageId: number;
  title: string;
  slug: string;
  status: string;
  visits: number;
  leads: number;
  cvr: number;
}

interface RecentLead {
  id: number;
  pageId: number;
  pageTitle: string | null;
  pageSlug: string | null;
  fields: Record<string, unknown>;
  createdAt: string;
}

function useRecentPages() {
  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/lp/pages`)
      .then(r => r.ok ? r.json() as Promise<BuilderPage[]> : [])
      .then(all => {
        const sorted = [...all].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setPages(sorted);
      })
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, []);

  return { pages, loading };
}

// Dashboard tile data: visits + leads over the last 7 days, with the
// previous-7-days delta surfaced as the trend %. The /overview endpoint
// already returns trend deltas so we don't recompute on the client.
function useOverview7d() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/lp/analytics/overview?days=7`)
      .then(r => r.ok ? r.json() as Promise<AnalyticsOverview> : null)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

// Top performing pages over the last 30 days, ranked by total visits.
// Used to give owners a quick "what's working" view without leaving home.
function useTopPages() {
  const [pages, setPages] = useState<PageAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/lp/analytics/pages?days=30`)
      .then(r => r.ok ? r.json() as Promise<PageAnalytics[]> : [])
      .then(d => setPages(d.filter(p => p.visits > 0).slice(0, 5)))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, []);

  return { pages, loading };
}

function useRecentLeads() {
  const [leads, setLeads] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/lp/leads/recent?limit=5`)
      .then(r => r.ok ? r.json() as Promise<{ leads: RecentLead[] }> : { leads: [] })
      .then(d => setLeads(d.leads ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  return { leads, loading };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Pulls the best human label out of a lead's submitted fields. Forms
// vary, so we try common shapes (name, email, company) before falling
// back to "Anonymous".
function leadLabel(fields: Record<string, unknown>): string {
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = fields[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const name = pick("name", "fullName", "full_name", "firstName", "first_name");
  const last = pick("lastName", "last_name");
  if (name) return last ? `${name} ${last}` : name;
  const email = pick("email", "workEmail", "work_email");
  if (email) return email;
  const company = pick("company", "organization", "practice", "practiceName");
  if (company) return company;
  return "Anonymous";
}

type RecentWorkItem =
  | { kind: "experiment"; id: number; name: string; status: string; testType: string; variantCount: number; slug: string; updatedAt: string; isTemplate?: false; author?: string | null }
  | { kind: "page"; id: number; name: string; status: string; blocks: unknown[]; slug: string; updatedAt: string; isTemplate?: boolean; author?: string | null };

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: tests, isLoading: testsLoading } = useListTests();
  const { pages: allPages, loading: pagesLoading } = useRecentPages();
  const { data: overview, loading: overviewLoading } = useOverview7d();
  const { pages: topPages, loading: topPagesLoading } = useTopPages();
  const { leads: recentLeads, loading: leadsLoading } = useRecentLeads();

  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const today = format(new Date(), "EEEE, MMMM d");

  const realPages = allPages.filter(p => !p.isTemplate);
  const publishedCount = realPages.filter(p => p.status === "published").length;
  const draftCount = realPages.filter(p => p.status === "draft").length;
  const hasAnyContent = realPages.length > 0 || (tests?.length ?? 0) > 0;
  const isEmpty = !pagesLoading && !testsLoading && !hasAnyContent;

  // Stat tiles reframed around what the data shows people actually use:
  // pages (heavily edited), visits, leads, drafts. Tests are demoted out
  // of the headline grid since tenants effectively don't run them.
  const statTiles = [
    {
      label: "Live pages",
      value: pagesLoading ? null : publishedCount,
      icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />,
      href: "/live-pages",
    },
    {
      label: "Visits · 7d",
      value: overviewLoading ? null : (overview?.totalVisits ?? 0),
      trend: overview?.visitsTrend,
      icon: <Eye className="w-3 h-3" />,
      href: "/analytics",
    },
    {
      label: "Leads · 7d",
      value: overviewLoading ? null : (overview?.totalLeads ?? 0),
      trend: overview?.leadsTrend,
      icon: <Users className="w-3 h-3" />,
      href: "/leads",
    },
    {
      label: "Drafts",
      value: pagesLoading ? null : draftCount,
      icon: <FileText className="w-3 h-3" />,
      href: "/pages?status=draft",
    },
  ];

  const personalHistory = getRecentEntries();
  const hasPersonalHistory = personalHistory.length > 0;
  const hasTests = (tests?.length ?? 0) > 0;

  // Recent work: page-first since pages are 99% of edit activity. Tests
  // only mix in when they exist.
  const allWorkItems: RecentWorkItem[] = [
    ...realPages.map(p => ({
      kind: "page" as const,
      id: p.id,
      name: p.title,
      status: p.status,
      blocks: p.blocks,
      slug: p.slug,
      updatedAt: p.updatedAt,
      isTemplate: false,
      author: p.createdByName ?? p.updatedByName ?? null,
    })),
    ...(tests ?? []).map(t => ({
      kind: "experiment" as const,
      id: t.id,
      name: t.name,
      status: t.status,
      testType: t.testType,
      variantCount: t.variantCount ?? 0,
      slug: t.slug,
      updatedAt: t.updatedAt,
    })),
  ];

  const sortRecent = (a: RecentWorkItem, b: RecentWorkItem) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  const recentWork: RecentWorkItem[] = hasPersonalHistory
    ? personalHistory
        .map(entry => allWorkItems.find(w => w.kind === entry.kind && w.id === entry.id))
        .filter((w): w is RecentWorkItem => w !== undefined)
        .sort(sortRecent)
        .slice(0, 6)
    : allWorkItems.sort(sortRecent).slice(0, 6);

  const recentWorkLoading = pagesLoading || testsLoading;

  // Contextual prompt: page-centric. The old prompt pushed people toward
  // the (unused) tests workflow; surface the actual common path instead.
  function getContextualPrompt(): { message: string; href: string; cta: string } | null {
    if (draftCount > 0) {
      return {
        message: `${draftCount} page${draftCount !== 1 ? "s" : ""} in draft — pick one up where you left off`,
        href: "/pages?status=draft",
        cta: "View drafts",
      };
    }
    if ((overview?.totalLeads ?? 0) > 0) {
      return {
        message: `${overview!.totalLeads} new lead${overview!.totalLeads !== 1 ? "s" : ""} this week — review them in Leads`,
        href: "/leads",
        cta: "View leads",
      };
    }
    if (publishedCount === 0 && realPages.length > 0) {
      return {
        message: "No pages are live yet — publish one to start collecting visits",
        href: "/pages",
        cta: "View pages",
      };
    }
    return null;
  }

  const prompt = getContextualPrompt();

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-12">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground/60 mb-1">{today}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{getGreeting()}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {pagesLoading
                ? "Loading your workspace…"
                : isEmpty
                ? "Set up your first landing page to get started."
                : `${publishedCount} live · ${draftCount} draft · ${overview?.totalVisits ?? 0} visit${overview?.totalVisits === 1 ? "" : "s"} this week`}
            </p>
          </div>
          <div className="shrink-0">
            <NewLauncher size="sm" className="rounded-md font-medium text-[13px]" />
          </div>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statTiles.map((stat) => (
            <Link href={stat.href} key={stat.label}>
              <div className="bg-card border border-border rounded-lg px-5 py-4 cursor-pointer transition-colors hover:bg-muted/50">
                {stat.value === null ? (
                  <Skeleton className="h-8 w-12 mb-1" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                      {stat.value.toLocaleString()}
                    </p>
                    {typeof stat.trend === "number" && stat.trend !== 0 && Number.isFinite(stat.trend) && (
                      <span className={`text-[11px] font-medium tabular-nums flex items-center gap-0.5 ${stat.trend > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {stat.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(Math.round(stat.trend))}%
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-1.5">
                  {stat.icon}
                  {stat.label}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Pending Review queue (reviewers only; component self-hides otherwise) ── */}
        <PendingReviewWidget />

        {isEmpty ? (
          /* ── Empty / Onboarding ──────────────────────────────
             Reframed page-first. The previous stepper centered on
             A/B tests, which usage data shows tenants don't run. */
          <div className="flex flex-col gap-4">
            <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Get started</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: "1",
                  title: "Set your brand",
                  desc: "Configure colors, fonts, nav and footer so every page feels on-brand.",
                  cta: "Brand Settings",
                  href: "/brand",
                  icon: <Paintbrush className="w-4 h-4" />,
                },
                {
                  step: "2",
                  title: "Create a page",
                  desc: "Pick a template or start from scratch. Drag-and-drop blocks, no code.",
                  cta: "New Page",
                  href: "/pages",
                  icon: <Plus className="w-4 h-4" />,
                  primary: true,
                },
                {
                  step: "3",
                  title: "Share & track",
                  desc: "Publish, share the URL, then watch visits and leads roll in here.",
                  cta: "View Live Pages",
                  href: "/live-pages",
                  icon: <Radio className="w-4 h-4" />,
                },
              ].map((item) => (
                <Link href={item.href} key={item.step}>
                  <Card className={`group h-full flex flex-col gap-4 p-5 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30 ${item.primary ? "border-foreground/10" : "border-border bg-card"}`}>
                    <div className="flex items-start justify-between">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${item.primary ? "bg-foreground text-background" : "bg-muted text-muted-foreground group-hover:text-foreground transition-colors"}`}>
                        {item.icon}
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground/40 tabular-nums" style={{ fontFamily: "var(--app-font-mono)" }}>0{item.step}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-[13px] font-medium text-foreground">
                      {item.cta} <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Two-column work + signal grid ───────────────────
                Left: Recent work (resume editing).
                Right: Top pages + Recent leads (what's working / who's coming in). */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Recent Work — spans 2 cols on desktop */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Recent work</h2>
                  <div className="flex items-center gap-4">
                    <Link href="/pages">
                      <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                        All pages <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </Link>
                    {hasTests && (
                      <Link href="/tests">
                        <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                          Tests <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </Link>
                    )}
                  </div>
                </div>

                <Card className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                  {recentWorkLoading ? (
                    <div className="p-4 flex flex-col gap-3">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                    </div>
                  ) : recentWork.length === 0 ? (
                    <Link href="/pages">
                      <div className="group flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                          <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">Create your first page</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Pick a template or start from a blank canvas</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground ml-auto transition-colors" />
                      </div>
                    </Link>
                  ) : (
                    recentWork.map((item) => {
                      const isExperiment = item.kind === "experiment";
                      const liveUrl = isExperiment
                        ? getLpPageUrl(item.slug, micrositeDomain)
                        : item.status === "published"
                        ? getLpPageUrl(item.slug, micrositeDomain)
                        : null;
                      const isRunning = item.status === "running" || item.status === "published";

                      const rowHref = isExperiment ? `/tests/${item.id}` : `/builder/${item.id}`;
                      // The row's primary target is a real <Link> covering the
                      // full row via an absolute overlay so keyboard users can
                      // Tab + Enter to open it. Action buttons live alongside,
                      // not nested, so they stay independently focusable, and
                      // the action cluster reveals on focus-within in addition
                      // to hover for keyboard parity.
                      return (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className="group relative flex items-center gap-4 px-4 py-3 hover:bg-muted/30 focus-within:bg-muted/30 transition-colors"
                        >
                          <Link
                            href={rowHref}
                            aria-label={`Open ${item.name}`}
                            className="absolute inset-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <div className={`relative flex-shrink-0 w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/20"}`} />

                          <div className="relative flex-1 min-w-0 pointer-events-none">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-medium text-foreground text-[13px] truncate">{item.name}</span>
                              <StatusBadge status={item.status} />
                            </div>
                            <div className="text-xs text-muted-foreground/70 flex items-center gap-2">
                              <code className="font-mono text-[11px] truncate">/{item.slug}</code>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="tabular-nums">{format(new Date(item.updatedAt), "MMM d")}</span>
                            </div>
                          </div>

                          <div className="relative flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            {liveUrl && isRunning && (
                              <a href={liveUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.name} in a new tab`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Open live page" tabIndex={-1}>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </a>
                            )}
                            <Link href={rowHref} aria-label={`Edit ${item.name}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Edit" tabIndex={-1}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </Card>
              </div>

              {/* Right column: signal — top pages + recent leads */}
              <div className="flex flex-col gap-6">

                {/* Top performing pages (30d) */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Top pages · 30d</h2>
                    <Link href="/analytics">
                      <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                        Analytics <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                  <Card className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {topPagesLoading ? (
                      <div className="p-4 flex flex-col gap-3">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-md" />)}
                      </div>
                    ) : topPages.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground/70">
                        No page visits yet — publish a page and share it to start collecting traffic.
                      </div>
                    ) : (
                      topPages.map(p => (
                        <Link
                          key={p.pageId}
                          href={`/builder/${p.pageId}`}
                          aria-label={`Edit ${p.title} (${p.visits} visits${p.leads ? `, ${p.leads} leads` : ""})`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 focus:bg-muted/30 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        >
                          <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate group-hover:underline underline-offset-2">{p.title}</p>
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 flex items-center gap-3">
                            <span title="Visits"><Eye className="w-3 h-3 inline mr-1 opacity-60" />{p.visits.toLocaleString()}</span>
                            {p.leads > 0 && (
                              <span title="Leads" className="text-foreground"><Users className="w-3 h-3 inline mr-1 opacity-60" />{p.leads}</span>
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                  </Card>
                </div>

                {/* Recent leads */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Recent leads</h2>
                    <Link href="/leads">
                      <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                        All leads <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                  <Card className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {leadsLoading ? (
                      <div className="p-4 flex flex-col gap-3">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-md" />)}
                      </div>
                    ) : recentLeads.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground/70">
                        No leads yet. Add a form block to a published page to start capturing them.
                      </div>
                    ) : (
                      recentLeads.map(lead => (
                        <Link href="/leads" key={lead.id}>
                          <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer group">
                            <Users className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">{leadLabel(lead.fields ?? {})}</p>
                              <p className="text-[11px] text-muted-foreground/70 truncate">
                                {lead.pageTitle ?? `page #${lead.pageId}`}
                              </p>
                            </div>
                            <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
                              {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: false })}
                            </span>
                          </div>
                        </Link>
                      ))
                    )}
                  </Card>
                </div>
              </div>
            </div>

            {/* ── Contextual Prompt ────────────────────────────── */}
            {prompt && (
              <div className="flex items-center gap-4 px-5 py-3.5 bg-card border border-border rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                  {draftCount > 0 ? (
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Users className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{prompt.message}</p>
                </div>
                <Link href={prompt.href} className="shrink-0">
                  <Button variant="outline" size="sm" className="rounded-lg text-xs font-medium">
                    {prompt.cta}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}

      </div>
    </AppLayout>
  );
}
