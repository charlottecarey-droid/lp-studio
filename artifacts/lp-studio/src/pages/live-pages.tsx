import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ExternalLink, Copy, Check, Play, BarChart3, FileText, Radio, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useListTests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/app-layout";
import { getLpPageUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface BuilderPage {
  id: number;
  title: string;
  slug: string;
  status: string;
}

function usePublishedPages() {
  return useQuery<BuilderPage[]>({
    queryKey: ["lp-pages-published"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lp/pages`);
      if (!res.ok) throw new Error("Failed to fetch pages");
      const all: BuilderPage[] = await res.json();
      return all.filter(p => p.status === "published");
    },
  });
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
    >
      {copied ? (
        <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
      ) : (
        <><Copy className="w-3 h-3" /> Copy</>
      )}
    </button>
  );
}

export default function LivePages() {
  const { data: tests, isLoading: testsLoading } = useListTests();
  const { data: publishedPages, isLoading: pagesLoading } = usePublishedPages();

  const isLoading = testsLoading || pagesLoading;
  const runningTests = tests?.filter(t => t.status === "running") ?? [];
  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;

  const totalLive = runningTests.length + (publishedPages?.length ?? 0);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Pages</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isLoading ? "Loading..." : `${totalLive} page${totalLive !== 1 ? "s" : ""} currently serving traffic`}
            </p>
          </div>
          <Link href="/tests/new">
            <Button size="sm" className="rounded-md font-medium text-[13px]">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              New Test
            </Button>
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : totalLive === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-8 bg-card border border-dashed border-border rounded-lg">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Radio className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium mb-1">No live pages yet</h3>
            <p className="text-muted-foreground text-[13px] max-w-sm mb-5">
              Set a test to Running or publish a builder page to start serving traffic.
            </p>
            <div className="flex gap-2">
              <Link href="/tests">
                <Button variant="outline" size="sm" className="rounded-md text-[13px]">View tests</Button>
              </Link>
              <Link href="/pages">
                <Button variant="outline" size="sm" className="rounded-md text-[13px]">View pages</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">

            {/* Running A/B Tests */}
            {runningTests.length > 0 && (
              <div className="flex flex-col gap-1">
                {runningTests.length > 0 && (publishedPages?.length ?? 0) > 0 && (
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1" style={{ fontFamily: "var(--app-font-mono)" }}>A/B Tests</p>
                )}
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  {runningTests.map((test, i) => {
                    const liveUrl = getLpPageUrl(test.slug, micrositeDomain);
                    return (
                      <motion.div
                        key={`test-${test.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="group flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-[13px] text-foreground truncate">{test.name}</span>
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">{test.testType}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-muted-foreground font-mono truncate max-w-xs">
                              {liveUrl}
                            </code>
                            <CopyButton url={liveUrl} />
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                          <span className="tabular-nums"><strong className="text-foreground font-medium">{test.variantCount ?? "—"}</strong> variants</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Open live page">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                          <Link href={`/tests/${test.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="View test results">
                              <BarChart3 className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Published Builder Pages */}
            {(publishedPages?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1">
                {runningTests.length > 0 && (
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1" style={{ fontFamily: "var(--app-font-mono)" }}>Published Pages</p>
                )}
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  {publishedPages!.map((page, i) => {
                    const liveUrl = getLpPageUrl(page.slug, micrositeDomain);
                    return (
                      <motion.div
                        key={`page-${page.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (runningTests.length + i) * 0.03 }}
                        className="group flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-[13px] text-foreground truncate">{page.title}</span>
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Published</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-muted-foreground font-mono truncate max-w-xs">
                              {liveUrl}
                            </code>
                            <CopyButton url={liveUrl} />
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Open live page">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                          <Link href={`/builder/${page.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" title="Edit page">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tip */}
        {!isLoading && totalLive > 0 && (
          <p className="text-[11px] text-muted-foreground text-center">
            Visitors are automatically assigned a variant and tracked.
          </p>
        )}

      </div>
    </AppLayout>
  );
}
