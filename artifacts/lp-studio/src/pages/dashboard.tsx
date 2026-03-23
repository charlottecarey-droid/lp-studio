import { Link } from "wouter";
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
  Zap,
  Activity,
  ChevronRight,
  FlaskConical,
  ClipboardCheck,
  Share2,
  Edit2,
  Wrench,
} from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { AppLayout } from "@/components/layout/app-layout";

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
        setPages(sorted.slice(0, 3));
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

export default function Dashboard() {
  const { data: tests, isLoading } = useListTests();
  const { pages: recentPages, loading: pagesLoading } = useRecentPages();

  const running = tests?.filter(t => t.status === "running") ?? [];
  const drafts  = tests?.filter(t => t.status === "draft")   ?? [];
  const recent  = [...(tests ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5);

  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  const today = format(new Date(), "EEEE, MMMM d");

  const isEmpty = !isLoading && (!tests || tests.length === 0);

  const statTiles = [
    {
      label: "Live Pages",
      value: isLoading ? null : running.length,
      icon: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />,
      color: "text-emerald-600",
      href: "/live-pages",
    },
    {
      label: "All Tests",
      value: isLoading ? null : (tests?.length ?? 0),
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      color: "text-foreground",
      href: "/tests",
    },
    {
      label: "Drafts",
      value: isLoading ? null : drafts.length,
      icon: <FileText className="w-3.5 h-3.5" />,
      color: "text-foreground",
      href: "/tests?status=draft",
    },
    {
      label: "A/B Tests",
      value: isLoading ? null : (tests?.filter(t => t.testType === "ab").length ?? 0),
      icon: <Activity className="w-3.5 h-3.5" />,
      color: "text-foreground",
      href: "/tests",
    },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-12">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{today}</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight">
              {getGreeting()}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-base">
              {isLoading
                ? "Loading your workspace…"
                : isEmpty
                ? "Set up your first landing page to get started."
                : `${running.length} page${running.length !== 1 ? "s" : ""} live · ${tests?.length ?? 0} total experiment${tests?.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/pages">
            <Button size="lg" className="rounded-xl font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              New Landing Page
            </Button>
          </Link>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statTiles.map((stat) => (
            <Link href={stat.href} key={stat.label}>
              <Card className="group p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {stat.icon}
                  {stat.label}
                </div>
                {stat.value === null ? (
                  <Skeleton className="h-8 w-12 rounded-lg" />
                ) : (
                  <div className="flex items-end justify-between">
                    <p className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</p>
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
                  title: "Create a test",
                  desc: "Pick a template or start from scratch. Run an A/B test or serve a single variant — track every impression automatically.",
                  cta: "Create First Test",
                  href: "/tests/new",
                  icon: <Plus className="w-5 h-5" />,
                  primary: true,
                },
                {
                  step: "03",
                  title: "Share & track",
                  desc: "Set your test to Running and share the URL. Visitors are bucketed automatically and every impression is tracked.",
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
            {/* ── Quick Actions ────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                {
                  icon: <Plus className="w-4 h-4" />,
                  label: "New Test",
                  sub: "Create a landing page & test",
                  href: "/tests/new",
                  primary: true,
                },
                {
                  icon: <FileText className="w-4 h-4" />,
                  label: "Drafts",
                  sub: `${drafts.length} test${drafts.length !== 1 ? "s" : ""} in progress`,
                  href: "/tests?status=draft",
                },
                {
                  icon: <Wrench className="w-4 h-4" />,
                  label: "Builder",
                  sub: "Drag-and-drop page editor",
                  href: "/pages",
                },
                {
                  icon: <ClipboardCheck className="w-4 h-4" />,
                  label: "Reviews",
                  sub: "Share & collect feedback",
                  href: "/reviews",
                },
                {
                  icon: <Radio className="w-4 h-4" />,
                  label: "Live Pages",
                  sub: `${running.length} serving traffic`,
                  href: "/live-pages",
                },
              ].map((action) => (
                <Link href={action.href} key={action.label}>
                  <Card className={`group flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${action.primary ? "border-primary/40 bg-primary/5 hover:border-primary/60" : "border-border/60 bg-card hover:border-primary/20"}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${action.primary ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"}`}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-tight">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{action.sub}</p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>

            {/* ── Recent Experiments ───────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-foreground">Recent Tests</h2>
                <Link href="/tests">
                  <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    View all →
                  </span>
                </Link>
              </div>

              {isLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {recent.map((test, i) => {
                    const liveUrl = `${base}/lp/${test.slug}`;
                    return (
                      <motion.div
                        key={test.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150"
                      >
                        <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${test.status === "running" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{test.name}</span>
                            <StatusBadge status={test.status} />
                            <span className="text-xs text-muted-foreground/60 hidden sm:inline capitalize">{test.testType}</span>
                          </div>
                          <code className="text-xs text-muted-foreground font-mono">/lp/{test.slug}</code>
                        </div>

                        <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground shrink-0">
                          <span><strong className="text-foreground font-semibold">{test.variantCount ?? 0}</strong> variants</span>
                          <span>{format(new Date(test.updatedAt), "MMM d")}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {test.status === "running" && (
                            <a href={liveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Open live page">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                          <Link href={`/tests/${test.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="View & edit">
                              <BarChart3 className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Recent Custom Pages ──────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-foreground">Builder Pages</h2>
                <Link href="/pages">
                  <span className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    All pages →
                  </span>
                </Link>
              </div>

              {pagesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
              ) : recentPages.length === 0 ? (
                <Link href="/pages">
                  <Card className="group flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border hover:border-primary/40 cursor-pointer transition-all">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Build your first custom page</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Drag-and-drop builder — no code needed</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary ml-auto transition-colors" />
                  </Card>
                </Link>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recentPages.map((page, i) => (
                    <motion.div
                      key={page.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="group flex flex-col gap-3 p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/25 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{page.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${page.status === "published" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                              <span className="text-xs text-muted-foreground capitalize">{page.status}</span>
                              <span className="text-xs text-muted-foreground/50">·</span>
                              <span className="text-xs text-muted-foreground">{(page.blocks as unknown[]).length} block{(page.blocks as unknown[]).length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-auto">
                          <Link href={`/builder/${page.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full h-8 text-xs rounded-lg gap-1.5 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors">
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </Button>
                          </Link>
                          <span className="text-xs text-muted-foreground shrink-0 pl-1">
                            {format(new Date(page.updatedAt), "MMM d")}
                          </span>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                  <Link href="/pages">
                    <Card className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-border hover:border-primary/40 cursor-pointer transition-all min-h-[100px]">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">New page</p>
                    </Card>
                  </Link>
                </div>
              )}
            </div>

            {/* ── Review tip ───────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
                <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold">Tip:</strong> Set a test to <em>Running</em> to start collecting visitor data. Visitors are automatically bucketed into variants and impressions are tracked.
                </p>
              </div>
              <Link href="/reviews">
                <div className="flex items-start gap-3 p-4 bg-card border border-border/60 rounded-xl cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all group">
                  <Share2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground font-semibold group-hover:text-primary transition-colors">Share for review →</strong><br />
                    Send any experiment to stakeholders for approval. Reviewers can approve or request changes — no login needed.
                  </p>
                </div>
              </Link>
            </div>
          </>
        )}

      </div>
    </AppLayout>
  );
}
