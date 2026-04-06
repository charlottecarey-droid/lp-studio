import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Grid3x3,
  Eye,
  Copy,
  Clock,
  Plus,
  Loader2,
  LayoutTemplate,
} from "lucide-react";
import { SalesLayout } from "@/components/layout/sales-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface TemplatePage {
  id: number;
  title: string;
  slug: string;
  templateLabel: string;
  templateDescription: string;
  blockCount: number;
  status: string;
  mode: string;
  ogImage: string;
  createdAt: string;
  updatedAt: string;
}

const GRADIENT_PALETTE = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)",
];

function getGradient(index: number): string {
  return GRADIENT_PALETTE[index % GRADIENT_PALETTE.length];
}

type SortOption = "Newest" | "Name" | "Most Blocks";

export default function SalesMarketplace() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<TemplatePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  const [cloningId, setCloningId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/lp/templates/enriched")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TemplatePage[]>;
      })
      .then((data) => setTemplates(data))
      .catch((err) => setError(err.message || "Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = templates;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.templateLabel.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.templateDescription.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q)
      );
    }

    const sorted = [...result];
    if (sortBy === "Newest") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "Name") {
      sorted.sort((a, b) => a.templateLabel.localeCompare(b.templateLabel));
    } else if (sortBy === "Most Blocks") {
      sorted.sort((a, b) => b.blockCount - a.blockCount);
    }

    return sorted;
  }, [templates, searchQuery, sortBy]);

  const handleUseTemplate = async (template: TemplatePage) => {
    setCloningId(template.id);
    try {
      const res = await fetch(`/api/lp/pages/${template.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Clone failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const newPage = await res.json();
      toast({
        title: "Template cloned",
        description: `"${template.templateLabel}" is ready to customize`,
      });
      if (newPage.id) {
        navigate(`/builder/${newPage.id}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to clone template";
      toast({ title: "Clone failed", description: message, variant: "destructive" });
    } finally {
      setCloningId(null);
    }
  };

  const handlePreview = (template: TemplatePage) => {
    window.open(`/lp/${template.slug}`, "_blank");
  };

  return (
    <SalesLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground text-sm">
            Clone a template and customize it in the builder — no account required
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search templates..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["Newest", "Name", "Most Blocks"] as SortOption[]).map((option) => (
              <Button
                key={option}
                variant={sortBy === option ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(option)}
              >
                {option === "Newest" && <Clock className="h-3.5 w-3.5 mr-1" />}
                {option}
              </Button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {error && !loading && (
          <Card className="p-8 text-center">
            <p className="text-destructive font-medium mb-2">Failed to load templates</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </Card>
        )}

        {!loading && !error && templates.length === 0 && (
          <Card className="p-12 text-center">
            <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Templates are pages marked as reusable. Ask your admin to save a page as a template to
              make it available here.
            </p>
          </Card>
        )}

        {!loading && !error && templates.length > 0 && filteredAndSorted.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-semibold mb-2">No templates match your search</h3>
            <p className="text-muted-foreground">Try a different search term</p>
          </div>
        )}

        {!loading && !error && filteredAndSorted.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {filteredAndSorted.length} template{filteredAndSorted.length !== 1 ? "s" : ""} available
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSorted.map((template, index) => (
                <Card
                  key={template.id}
                  className="group overflow-hidden border border-border/40 hover:border-border/80 hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  <div
                    className="h-40 relative overflow-hidden cursor-pointer"
                    onClick={() => handlePreview(template)}
                    style={
                      template.ogImage
                        ? {
                            backgroundImage: `url(${template.ogImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : { background: getGradient(index) }
                    }
                  >
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="h-8 w-8 text-white" />
                    </div>
                    {template.status === "published" && (
                      <Badge className="absolute top-2 right-2 bg-green-600 text-white text-[10px]">
                        Live
                      </Badge>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="font-semibold text-base leading-tight mb-1">
                      {template.templateLabel}
                    </h3>

                    {template.templateDescription && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {template.templateDescription}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground border-t border-border/40 pt-3 mt-auto">
                      <div className="flex items-center gap-1">
                        <Grid3x3 className="h-3.5 w-3.5" />
                        <span>
                          {template.blockCount} block{template.blockCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {template.mode}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-1"
                        disabled={cloningId === template.id}
                        onClick={() => handleUseTemplate(template)}
                      >
                        {cloningId === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {cloningId === template.id ? "Cloning..." : "Use Template"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(template)}
                        title="Preview live page"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </SalesLayout>
  );
}
