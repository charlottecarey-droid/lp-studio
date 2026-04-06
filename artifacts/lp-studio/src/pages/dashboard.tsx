import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import {
  Plus,
  ArrowUpRight,
  BarChart3,
  Radio,
  Paintbrush,
  ExternalLink,
  FileText,
  Activity,
  ChevronRight,
  FlaskConical,
  Edit2,
  LayoutGrid,
  Zap,
  Share2,
} from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { getRecentEntries } from "@/hooks/use-recently-viewed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { AppLayout } from "@/components/layout/app-layout";
import { getLpPageUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface BuilderPage {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  blocks: unknown[];
  updatedAt: string;
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type RecentWorkItem =
  | { kind: "experiment"; id: number; name: string; status: string; testType: string; variantCount: number; slug: string; updatedAt: string }
  | { kind: "page"; id: number; name: string; status: string; blocks: unknown[]; slug: string; updatedAt: string };

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: tests, isLoading } = useListTests();
  const { pages: allPages, loading: pagesLoading } = useRecentPages();

  const running = tests?.filter(t => t.status === "running") ?? [];
  const drafts  = tests?.filter(t => t.status === "draft")   ?? [];

  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const today = format(new Date(), "EEEE, MMMM d");

  const isEmpty = !isLoading && (!tests || tests.length === 0);

  const statTiles = [
    {
      label: "Live Pages",
      value: (isLoading || pagesLoading) ? null : running.length + allPages.filter(p => p.status === "published").length,
      icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />,
      color: "text-emerald-600 dark:text-emerald-400",
      accent: true,
      href: "/live-pages",
    },
    {
      label: "Experiments",
      value: isLoading ? null : (tests?.length ?? 0),
      icon: <FlaskConical className="w-3 h-3" />,
      color: "text-foreground",
      accent: false,
      href: "/tests",
    },
    {
      label: "Drafts",
      value: isLoading ? null : drafts.length,
      icon: <FileText className="w-3 h-3" />,
      color: "text-foreground",
      accent: false,
      href: "/tests?status=draft",
    },
    {
      label: "A/B Tests",
      value: isLoading ? null : (tests?.filter(t => t.testType === "ab").length ?? 0),
      icon: <Activity className="w-3 h-3" />,
      color: "text-foreground",
      accent: false,
      href: "/tests",
    },
  ];

  const personalHistory = getRecentEntries();
  const hasPersonalHistory = personalHistory.length > 0;

  const allWorkItems: RecentWorkItem[] = [
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
    ...allPages.map(p => ({
      kind: "page" as const,
      id: p.id,
      name: p.title,
      status: p.status,
      blocks: p.blocks,
      slug: p.slug,
      updatedAt: p.updatedAt,
    })),
  ];

  const recentWork: RecentWorkItem[] = hasPersonalHistory
    ? personalHistory
        .map(entry => allWorkItems.find(w => w.kind === entry.kind && w.id === entry.id))
        .filter((w): w is RecentWorkItem => w !== undefined)
        .slice(0, 6)
    : allWorkItems
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6);

  const recentWorkLoading = isLoading || pagesLoading;

  function getContextualPrompt(): { message: string; href: string; cta: string } {
    if (drafts.length > 0) {
      return {
        message: `You have ${drafts.length} draft${drafts.length !== 1 ? "s" : ""} — pick one to run`,
        href: "/tests?status=draft",
        cta: "View drafts",
      };
    }
    if (running.length === 0 && (tests?.length ?? 0) > 0) {
      return {
        message: "No pages are live yet — set one running",
        href: "/tests",
        cta: "View experiments",
      };
    }
    return {
      message: "Share a page for stakeholder review",
      href: "/reviews",
      cta: "Go to Approvals",
    };
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
              {isLoading
                ? "Loading your workspace…"
                : isEmpty
                ? "Set up your first landing page to get started."
                : (() => { const liveCount = running.length + allPages.filter(p => p.status === "published").length; return `${liveCount} page${liveCount !== 1 ? "s" : ""} live · ${tests?.length ?? 0} total experiment${tests?.length !== 1 ? "s" : ""}`; })()}
            </p>
          </div>
          <Link href="/pages/new" className="shrink-0">
            <Button size="sm" className="rounded-md font-medium text-[13px]">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Page
            </Button>
          </Link>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statTiles.map((stat) => (
            <Link href={stat.href} key={stat.label}>
              <div className={`bg-card border rounded-lg px-5 py-4 cursor-pointer transition-colors hover:bg-muted/50 ${stat.accent ? "border-border" : "border-border"}`}>
                {stat.value === null ? (
                  <Skeleton className="h-8 w-12 mb-1" />
                ) : (
                  <p className={`text-2xl font-semibold tracking-tight ${stat.color}`}>{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-1.5">
                  {stat.icon}
                  {stat.label}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {isEmpty ? (
          /* ── Empty / Onboarding ────────────────────────────── */
          <div className="flex flex-col gap-4">
            <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Get started</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: "1",
                  title: "Set your brand",
                  desc: "Configure colors, button style, nav CTA, and footer so every page feels on-brand.",
                  cta: "Brand Settings",
                  href: "/brand",
                  icon: <Paintbrush className="w-4 h-4" />,
                },
                {
                  step: "2",
                  title: "Create an experiment",
                  desc: "Pick a template or start from scratch. Run an A/B test or serve a single variant.",
                  cta: "Create Experiment",
                  href: "/tests/new",
                  icon: <Plus className="w-4 h-4" />,
                  primary: true,
                },
                {
                  step: "3",
                  title: "Share & track",
                  desc: "Set your experiment to Running and share the URL. Impressions are tracked automatically.",
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
            {/* ── Recent Work ──────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Recent work</h2>
                <div className="flex items-center gap-4">
                  <Link href="/tests">
                    <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                      Experiments <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                  <Link href="/pages">
                    <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                      Pages <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
              </div>

              <Card className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {recentWorkLoading ? (
                  <div className="p-4 flex flex-col gap-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                  </div>
                ) : recentWork.length === 0 ? (
                  <Link href="/tests/new">
                    <div className="group flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">Create your first experiment</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Build a landing page and run an A/B test</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground ml-auto transition-colors" />
                    </div>
                  </Link>
                ) : (
                  recentWork.map((item) => {
                    const isExperiment = item.kind === "experiment";
                    const liveUrl = isExperiment ? getLpPageUrl(item.slug, micrositeDomain) : null;
                    const isRunning = item.status === "running" || item.status === "published";

                    const rowHref = isExperiment ? `/tests/${item.id}` : `/builder/${item.id}`;
                    return (
                      <div
                        key={`${item.kind}-${item.id}`}
                        onClick={() => navigate(rowHref)}
                        className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <div className={`flex-shrink-0 w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/20"}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-medium text-foreground text-[13px]">{item.name}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${isExperiment ? "bg-muted text-muted-foreground" : "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"}`}>
                              {isExperiment ? (
                                <><FlaskConical className="w-2.5 h-2.5" /> Experiment</>
                              ) : (
                                <><LayoutGrid className="w-2.5 h-2.5" /> Page</>
                              )}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            {isExperiment ? (
                              <code className="font-mono text-[11px]">{micrositeDomain ? `/${item.slug}` : `/lp/${item.slug}`}</code>
                            ) : (
                              <code className="font-mono text-[11px]">/{item.slug}</code>
                            )}
                          </div>
                        </div>

                        <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground shrink-0">
                          {isExperiment ? (
                            <span className="tabular-nums"><strong className="text-foreground font-medium">{(item as Extract<RecentWorkItem, { kind: "experiment" }>).variantCount}</strong> variants</span>
                          ) : (
                            <span className="tabular-nums"><strong className="text-foreground font-medium">{(item as Extract<RecentWorkItem, { kind: "page" }>).blocks.length}</strong> blocks</span>
                          )}
                          <span className="tabular-nums">{format(new Date(item.updatedAt), "MMM d")}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isExperiment && item.status === "running" && liveUrl && (
                            <a href={liveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Open live page">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                          {isExperiment ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="View & edit" onClick={e => { e.stopPropagation(); navigate(`/tests/${item.id}`); }}>
                              <BarChart3 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Edit page" onClick={e => { e.stopPropagation(); navigate(`/builder/${item.id}`); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>
            </div>

            {/* ── Contextual Prompt ────────────────────────────── */}
            <div className="flex items-center gap-4 px-5 py-3.5 bg-card border border-border rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                {drafts.length > 0 ? (
                  <FileText className="w-4 h-4 text-muted-foreground" />
                ) : running.length === 0 ? (
                  <Zap className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Share2 className="w-4 h-4 text-muted-foreground" />
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
          </>
        )}

      </div>
    </AppLayout>
  );
}
