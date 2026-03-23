import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ExternalLink, Copy, Check, Play, BarChart3, Users, ArrowUpRight, Radio } from "lucide-react";

import { useListTests } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";

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
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
    >
      {copied ? (
        <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copy URL</>
      )}
    </button>
  );
}

export default function LivePages() {
  const { data: tests, isLoading } = useListTests();
  const { toast } = useToast();

  const runningTests = tests?.filter(t => t.status === "running") ?? [];
  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Live Pages</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              All landing pages currently serving traffic.
            </p>
          </div>
          <Link href="/tests/new">
            <Button size="lg" className="rounded-xl font-semibold px-6 shadow-lg shadow-primary/20">
              <Play className="w-4 h-4 mr-2" />
              New Test
            </Button>
          </Link>
        </div>

        {/* Count pill */}
        {!isLoading && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1 rounded-full">
              <Radio className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              {runningTests.length} active {runningTests.length === 1 ? "page" : "pages"}
            </Badge>
            {tests && tests.length > runningTests.length && (
              <span className="text-sm text-muted-foreground">
                {tests.length - runningTests.length} paused or in draft
              </span>
            )}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : runningTests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center p-16 bg-card/50 border border-dashed border-border rounded-3xl"
          >
            <div className="w-16 h-16 bg-muted/60 rounded-2xl flex items-center justify-center mb-5">
              <Radio className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-display font-bold mb-2">No live pages yet</h3>
            <p className="text-muted-foreground max-w-xs mb-6">
              Set a test's status to <strong>Running</strong> to start serving traffic to its landing page.
            </p>
            <Link href="/tests">
              <Button variant="secondary" className="rounded-xl">View all tests</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {runningTests.map((test, i) => {
              const liveUrl = `${base}/lp/${test.slug}`;
              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-5 p-5 bg-card border border-border/60 rounded-2xl hover:border-primary/30 hover:shadow-lg transition-all duration-200"
                >
                  {/* Live indicator */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">{test.name}</span>
                      <Badge variant="outline" className="text-xs capitalize shrink-0">{test.testType}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md font-mono truncate max-w-xs">
                        {liveUrl}
                      </code>
                      <CopyButton url={liveUrl} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Variants</p>
                      <p className="font-bold text-foreground">{test.variantCount ?? "—"}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary" title="Open live page">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                    <Link href={`/tests/${test.id}`}>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted" title="View results">
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Tip */}
        {!isLoading && runningTests.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Share these URLs with real visitors — each one is automatically assigned a variant and tracked.
          </p>
        )}

      </div>
    </AppLayout>
  );
}
