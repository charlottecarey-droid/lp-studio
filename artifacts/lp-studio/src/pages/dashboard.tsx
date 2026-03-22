import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
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
  Beaker,
} from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { AppLayout } from "@/components/layout/app-layout";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { data: tests, isLoading } = useListTests();

  const running = tests?.filter(t => t.status === "running") ?? [];
  const drafts  = tests?.filter(t => t.status === "draft")   ?? [];
  const recent  = [...(tests ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5);

  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  const today = format(new Date(), "EEEE, MMMM d");

  const isEmpty = !isLoading && (!tests || tests.length === 0);

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
          <Link href="/tests/new">
            <Button size="lg" className="rounded-xl font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              New Landing Page
            </Button>
          </Link>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Live Pages",
              value: isLoading ? null : running.length,
              icon: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />,
              color: "text-emerald-600",
            },
            {
              label: "All Experiments",
              value: isLoading ? null : (tests?.length ?? 0),
              icon: <Beaker className="w-3.5 h-3.5" />,
              color: "text-foreground",
            },
            {
              label: "Drafts",
              value: isLoading ? null : drafts.length,
              icon: <FileText className="w-3.5 h-3.5" />,
              color: "text-foreground",
            },
            {
              label: "A/B Tests",
              value: isLoading ? null : (tests?.filter(t => t.testType === "ab").length ?? 0),
              icon: <Activity className="w-3.5 h-3.5" />,
              color: "text-foreground",
            },
          ].map((stat) => (
            <Card key={stat.label} className="p-5 rounded-2xl border border-border/60 bg-card">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {stat.icon}
                {stat.label}
              </div>
              {stat.value === null ? (
                <Skeleton className="h-8 w-12 rounded-lg" />
              ) : (
                <p className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</p>
              )}
            </Card>
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
                  title: "Create a landing page",
                  desc: "Pick a template or start from scratch. Each page can run an A/B test or just serve a single variant.",
                  cta: "Create First Page",
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: <Plus className="w-4 h-4" />,
                  label: "New Landing Page",
                  sub: "Create a test or page",
                  href: "/tests/new",
                  primary: true,
                },
                {
                  icon: <Radio className="w-4 h-4" />,
                  label: "Live Pages",
                  sub: `${running.length} serving traffic`,
                  href: "/live-pages",
                },
                {
                  icon: <Paintbrush className="w-4 h-4" />,
                  label: "Brand Settings",
                  sub: "Colors, buttons & nav",
                  href: "/brand",
                },
              ].map((action) => (
                <Link href={action.href} key={action.label}>
                  <Card className={`group flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${action.primary ? "border-primary/40 bg-primary/5 hover:border-primary/60" : "border-border/60 bg-card hover:border-primary/20"}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${action.primary ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"}`}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.sub}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>

            {/* ── Recent Experiments ───────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display font-bold text-foreground">Recent Experiments</h2>
                <Link href="/">
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
                        {/* Status dot */}
                        <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${test.status === "running" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{test.name}</span>
                            <StatusBadge status={test.status} />
                            <span className="text-xs text-muted-foreground/60 hidden sm:inline capitalize">{test.testType}</span>
                          </div>
                          <code className="text-xs text-muted-foreground font-mono">/lp/{test.slug}</code>
                        </div>

                        {/* Meta */}
                        <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground shrink-0">
                          <span><strong className="text-foreground font-semibold">{test.variantCount ?? 0}</strong> variants</span>
                          <span>{format(new Date(test.updatedAt), "MMM d")}</span>
                        </div>

                        {/* Actions */}
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

            {/* ── At a glance tip ──────────────────────────────── */}
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
              <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground font-semibold">Tip:</strong> Set a test to <em>Running</em> to start collecting visitor data. Each unique visitor is automatically bucketed into a variant and their impressions and conversions are tracked.
              </p>
            </div>
          </>
        )}

      </div>
    </AppLayout>
  );
}
