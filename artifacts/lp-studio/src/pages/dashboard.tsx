import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
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
import { getLpPublicBase } from "@/lib/utils";

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

  const base = getLpPublicBase();
  const today = format(new Date(), "EEEE, MMMM d");

  const isEmpty = !isLoading && (!tests || tests.length === 0);

  const statTiles = [
    {
      label: "Live Pages",
      value: (isLoading || pagesLoading) ? null : running.length + allPages.filter(p => p.status === "published").length,
      icon: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />,
      bigIcon: <Radio className="w-5 h-5 text-emerald-500/40" />,
      color: "text-emerald-600",
      accent: true,
      href: "/live-pages",
    },
    {
      label: "All Experiments",
      value: isLoading ? null : (tests?.length ?? 0),
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      bigIcon: <FlaskConical className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/tests",
    },
    {
      label: "Drafts",
      value: isLoading ? null : drafts.length,
      icon: <FileText className="w-3.5 h-3.5" />,
      bigIcon: <FileText className="w-5 h-5 text-muted-foreground/20" />,
      color: "text-foreground",
      accent: false,
      href: "/tests?status=draft",
    },
    {
      label: "A/B Tests",
      value: isLoading ? null : (tests?.filter(t => t.testType === "ab").length ?? 0),
      icon: <Activity className="w-3.5 h-3.5" />,
      bigIcon: <Activity className="w-5 h-5 text-muted-foreground/20" />,
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

        {/* ── Hero Banner ──────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
          style={{
            background: "linear-gradient(135deg, #003A30 0%, #005244 50%, #003A30 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, #C7E738 0%, transparent 50%), radial-gradient(circle at 80% 20%, #C7E738 0%, transparent 40%)",
            }}
          />
          <div className="relative">
            <p className="text-sm font-medium text-white/50 mb-1">{today}</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
              {getGreeting()}
            </h1>
            <p className="text-white/60 mt-1.5 text-base">
              {isLoading
                ? "Loading your workspace…"
                : isEmpty
                ? "Set up your first landing page to get started."
                : (() => { const liveCount = running.length + allPages.filter(p => p.status === "published").length; return `${liveCount} page${liveCount !== 1 ? "s" : ""} live · ${tests?.length ?? 0} total experiment${tests?.length !== 1 ? "s" : ""}`; })()}
            </p>
          </div>
          <Link href="/tests/new" className="relative shrink-0">
            <Button
              size="lg"
              className="rounded-xl font-semibold px-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#C7E738", color: "#003A30" }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Experiment
            </Button>
          </Link>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statTiles.map((stat) => (
            <Link href={stat.href} key={stat.label}>
              <Card className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${stat.accent ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-500/50" : "border-border/60 bg-card hover:border-primary/30"}`}>
                <div className="absolute top-3 right-3 opacity-60">
                  {stat.bigIcon}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {stat.icon}
                  {stat.label}
                </div>
                {stat.value === null ? (
                  <Skeleton className="h-10 w-14 rounded-lg" />
                ) : (
                  <div className="flex items-end justify-between">
                    <p className={`text-4xl font-display font-bold leading-none ${stat.color}`}>{stat.value}</p>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors mb-1" />
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>

        {isEmpty ? (
          /* ── Empty / Onboarding ────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <h2 className="text-lg font-display font-bold text-foreground">Get started in 3 steps</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: "01",
                  title: "Set your brand",
                  desc: "Configure Dandy's colors, button style, nav CTA, and footer so every page feels on-brand from the start.",
                  cta: "Open Brand Settings",
                  href: "/brand",
                  icon: <Paintbrush className="w-5 h-5" />,
                },
                {
                  step: "02",
                  title: "Create an experiment",
                  desc: "Pick a template or start from scratch. Run an A/B test or serve a single variant — track every impression automatically.",
                  cta: "Create First Experiment",
                  href: "/tests/new",
                  icon: <Plus className="w-5 h-5" />,
                  primary: true,
                },
                {
                  step: "03",
                  title: "Share & track",
                  desc: "Set your experiment to Running and share the URL. Visitors are bucketed automatically and every impression is tracked.",
                  cta: "View Live Pages",
                  href: "/live-pages",
                  icon: <Radio className="w-5 h-5" />,
                },
              ].map((item) => (
                <Link href={item.href} key={item.step}>
                  <Card className={`group relative h-full flex flex-col gap-4 p-6 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${item.primary ? "border-primary/40 bg-primary/5 hover:border-primary/60" : "border-border/60 bg-card hover:border-primary/20"}`}>
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.primary ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"}`}>
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold text-muted-foreground/50 font-mono">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground mb-1.5">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
                      {item.cta} <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Recent Work ──────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-foreground">Recent Work</h2>
                <div className="flex items-center gap-4">
                  <Link href="/tests">
                    <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      View all experiments →
                    </span>
                  </Link>
                  <Link href="/pages">
                    <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      View all pages →
                    </span>
                  </Link>
                </div>
              </div>

              {recentWorkLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
                </div>
              ) : recentWork.length === 0 ? (
                <Link href="/tests/new">
                  <Card className="group flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border hover:border-primary/40 cursor-pointer transition-all">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Create your first experiment</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Build a landing page and run an A/B test</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary ml-auto transition-colors" />
                  </Card>
                </Link>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {recentWork.map((item, i) => {
                    const isExperiment = item.kind === "experiment";
                    const liveUrl = isExperiment ? `${base}/lp/${item.slug}` : null;
                    const isRunning = item.status === "running" || item.status === "published";

                    const rowHref = isExperiment ? `/tests/${item.id}` : `/builder/${item.id}`;
                    return (
                      <motion.div
                        key={`${item.kind}-${item.id}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => navigate(rowHref)}
                        className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150 cursor-pointer"
                      >
                        <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{item.name}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isExperiment ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"}`}>
                              {isExperiment ? (
                                <><FlaskConical className="w-2.5 h-2.5" /> Experiment</>
                              ) : (
                                <><LayoutGrid className="w-2.5 h-2.5" /> Page</>
                              )}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isExperiment ? (
                              <code className="font-mono">/lp/{item.slug}</code>
                            ) : (
                              <code className="font-mono">/{item.slug}</code>
                            )}
                          </div>
                        </div>

                        <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground shrink-0">
                          {isExperiment ? (
                            <span><strong className="text-foreground font-semibold">{(item as Extract<RecentWorkItem, { kind: "experiment" }>).variantCount}</strong> variants</span>
                          ) : (
                            <span><strong className="text-foreground font-semibold">{(item as Extract<RecentWorkItem, { kind: "page" }>).blocks.length}</strong> blocks</span>
                          )}
                          <span>{format(new Date(item.updatedAt), "MMM d")}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isExperiment && item.status === "running" && liveUrl && (
                            <a href={liveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Open live page">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                          {isExperiment ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="View & edit" onClick={e => { e.stopPropagation(); navigate(`/tests/${item.id}`); }}>
                              <BarChart3 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="Edit page" onClick={e => { e.stopPropagation(); navigate(`/builder/${item.id}`); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Contextual Prompt ────────────────────────────── */}
            <div className="flex items-start gap-4 p-5 bg-card border-l-4 border-l-primary border border-border/60 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                {drafts.length > 0 ? (
                  <FileText className="w-4 h-4 text-primary" />
                ) : running.length === 0 ? (
                  <Zap className="w-4 h-4 text-primary" />
                ) : (
                  <Share2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-0.5">What's next?</p>
                <p className="text-sm text-muted-foreground">{prompt.message}</p>
              </div>
              <Link href={prompt.href} className="shrink-0">
                <Button variant="outline" size="sm" className="rounded-lg text-xs font-semibold hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors">
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
