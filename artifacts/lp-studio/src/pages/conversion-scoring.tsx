import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { PageConversionScore } from "@/components/analytics/PageConversionScore";

interface PageOption {
  id: number;
  title: string;
  slug: string;
  status: string;
}

export default function ConversionScoring() {
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loadingPages, setLoadingPages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load pages list
  useEffect(() => {
    fetch("/api/lp/conversion-scoring/pages")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PageOption[]>;
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPages(list);
        if (list.length > 0) setSelectedPageId(list[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPages(false));
  }, []);

  const handleReanalyze = () => {
    if (selectedPageId === null) return;
    queryClient.invalidateQueries({ queryKey: ["page-conversion-score", selectedPageId] });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Conversion Scoring</h1>
            <p className="text-muted-foreground">
              Analyze your landing pages' conversion potential based on real visitor data and page structure
            </p>
          </div>
          {selectedPageId !== null && (
            <div className="flex items-center gap-2">
              <Link href={`/analytics/pages/${selectedPageId}`}>
                <Button variant="outline" size="sm">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  View page detail
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleReanalyze}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-analyze
              </Button>
            </div>
          )}
        </div>

        {/* Page Selector */}
        {loadingPages ? (
          <Skeleton className="h-10 w-full max-w-sm" />
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive">{error}</p>
          </Card>
        ) : pages.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No pages found. Create a landing page first to analyze it.</p>
          </Card>
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Analyze page:</label>
            <select
              className="border border-border rounded-md px-3 py-2 text-sm bg-background max-w-md flex-1"
              value={selectedPageId ?? ""}
              onChange={(e) => setSelectedPageId(Number(e.target.value))}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.slug}) — {p.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Detail body — shared self-fetching component */}
        {selectedPageId !== null && <PageConversionScore pageId={selectedPageId} />}
      </div>
    </AppLayout>
  );
}
