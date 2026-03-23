import { Link, useSearch, useLocation } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  ExternalLink, BarChart3, Plus, Beaker, FileText, Radio,
  FlaskConical, Search, SlidersHorizontal,
} from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { AppLayout } from "@/components/layout/app-layout";
import { cn } from "@/lib/utils";
import { useState } from "react";

type StatusFilter = "all" | "running" | "draft" | "paused";

const FILTER_TABS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all",     label: "All",     icon: <Beaker className="w-3.5 h-3.5" /> },
  { value: "running", label: "Running", icon: <Radio className="w-3.5 h-3.5" /> },
  { value: "draft",   label: "Draft",   icon: <FileText className="w-3.5 h-3.5" /> },
  { value: "paused",  label: "Paused",  icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
];

export default function AllTests() {
  const rawSearch = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(rawSearch);
  const initialStatus = (params.get("status") ?? "all") as StatusFilter;

  const [activeFilter, setActiveFilter] = useState<StatusFilter>(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tests, isLoading } = useListTests();
  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  const filtered = (tests ?? []).filter(t => {
    const matchesStatus = activeFilter === "all" || t.status === activeFilter;
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const counts: Record<StatusFilter, number> = {
    all:     tests?.length ?? 0,
    running: tests?.filter(t => t.status === "running").length ?? 0,
    draft:   tests?.filter(t => t.status === "draft").length ?? 0,
    paused:  tests?.filter(t => t.status === "paused").length ?? 0,
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Tests</h1>
            <p className="text-muted-foreground mt-1">
              {isLoading ? "Loading…" : `${counts.all} experiment${counts.all !== 1 ? "s" : ""} · ${counts.running} live`}
            </p>
          </div>
          <Link href="/tests/new">
            <Button size="lg" className="rounded-xl font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              New Test
            </Button>
          </Link>
        </div>

        {/* Filter tabs + search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                  activeFilter === tab.value
                    ? "bg-background text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
                {!isLoading && (
                  <span className={cn(
                    "ml-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                    activeFilter === tab.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {counts[tab.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search tests…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border/60 rounded-lg outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-colors"
            />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center p-16 bg-card/50 border border-dashed border-border rounded-3xl"
          >
            <div className="w-14 h-14 bg-muted/60 rounded-2xl flex items-center justify-center mb-4">
              <FlaskConical className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-display font-bold mb-1.5">
              {activeFilter === "all" ? "No tests yet" : `No ${activeFilter} tests`}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              {activeFilter === "all"
                ? "Create your first test to start running A/B experiments on your landing pages."
                : `You have no tests in ${activeFilter} state right now.`}
            </p>
            <div className="flex items-center gap-2">
              {activeFilter !== "all" && (
                <Button variant="ghost" onClick={() => setActiveFilter("all")} className="rounded-xl">
                  View all
                </Button>
              )}
              <Link href="/tests/new">
                <Button className="rounded-xl">
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Test
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sorted.map((test, i) => {
              const liveUrl = `${base}/lp/${test.slug}`;
              const isRunning = test.status === "running";
              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150 cursor-pointer"
                  onClick={() => navigate(`/tests/${test.id}`)}
                >
                  <div className={cn(
                    "flex-shrink-0 w-2.5 h-2.5 rounded-full",
                    isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{test.name}</span>
                      <StatusBadge status={test.status} />
                      <span className="text-xs text-muted-foreground/60 hidden sm:inline capitalize">{test.testType}</span>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">/lp/{test.slug}</code>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                    <div className="text-center">
                      <p className="uppercase tracking-widest font-semibold mb-0.5">Variants</p>
                      <p className="font-bold text-foreground">{test.variantCount ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="uppercase tracking-widest font-semibold mb-0.5">Updated</p>
                      <p className="font-bold text-foreground">{format(new Date(test.updatedAt), "MMM d")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isRunning && (
                      <a href={liveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" title="Open live page">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-muted"
                      title="Analytics & settings"
                      onClick={e => { e.stopPropagation(); navigate(`/tests/${test.id}`); }}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
