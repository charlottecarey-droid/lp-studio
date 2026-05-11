import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Star,
  TrendingUp,
  Clock,
  Grid3x3,
  Eye,
  Copy,
  Filter,
  Plus,
  Loader2,
  LayoutTemplate,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND, getBrandStyleVars, fetchBrandConfig, type BrandConfig } from "@/lib/brand-config";
import type { PageBlock } from "@/lib/block-types";

// Matches the enriched response from GET /api/lp/templates/enriched
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
  /** True for built-in starter templates seeded by the platform. Sorted to the
   * bottom so a tenant's own custom templates always appear first. */
  isGlobal: boolean;
  /** Industry tag for global starter templates (e.g. "dental", "saas").
   * Null/empty for universal templates and tenant-saved templates. */
  industry: string | null;
  /** Marketplace ordering rank derived from the seed file. Lower wins.
   * 0 = tenant-owned, 1-10 = featured flagships, 20 = premium starters,
   * 50 = generic starters, 100 = industry starters. Missing → fall back
   * to a high number so unranked entries sink. */
  premiumRank?: number;
  createdAt: string;
  updatedAt: string;
}

function formatIndustry(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

// Color palette for template thumbnails (when no ogImage)
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

type SortOption = "Featured" | "Newest" | "Name" | "Most Blocks";

export default function TemplateMarketplace() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<TemplatePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Featured");
  // Industry filter: `null` means "all industries" (default). A Set means
  // only show global templates whose industry is in the set. Tenant-saved
  // templates and universal globals (no industry) always pass through so
  // the user never loses access to their own work.
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string> | null>(null);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplatePage | null>(null);
  const [previewBlocks, setPreviewBlocks] = useState<PageBlock[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Tenant brand for preview rendering — falls back to neutral DEFAULT_BRAND
  // until the fetch resolves so any block reading var(--brand-primary) etc.
  // resolves to the tenant's actual palette instead of the neutral defaults.
  const [previewBrand, setPreviewBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  useEffect(() => {
    let cancelled = false;
    fetchBrandConfig()
      .then(b => { if (!cancelled) setPreviewBrand(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // Monotonic request token: when the user rapidly switches templates or
  // closes the modal mid-fetch, only the most recent request is allowed to
  // write state. Prevents stale-response-A from overwriting newer-response-B.
  const previewRequestRef = useRef(0);

  // Fetch real templates from the database
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

  // Unique industry tags present across the loaded templates, sorted
  // alphabetically. Used to populate the filter checkbox list.
  const availableIndustries = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.industry && t.industry.trim()) set.add(t.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

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

    // Industry filter: only restricts global, industry-tagged templates.
    // Tenant-owned templates and untagged globals always remain visible.
    if (selectedIndustries !== null) {
      result = result.filter((t) => {
        if (!t.isGlobal) return true;
        const tag = t.industry?.trim();
        if (!tag) return true;
        return selectedIndustries.has(tag);
      });
    }

    // Two-stage sort: tenant-owned templates always appear first, then the
    // user-selected sort breaks ties inside each group. This keeps a tenant's
    // own custom templates above the generic starter library, even after the
    // tenant has been using the product for a while.
    const rankOf = (t: TemplatePage) => t.premiumRank ?? (t.isGlobal ? 200 : 0);
    const sorted = [...result];
    const compare = (a: TemplatePage, b: TemplatePage) => {
      if (a.isGlobal !== b.isGlobal) return a.isGlobal ? 1 : -1;
      if (sortBy === "Featured") {
        const ra = rankOf(a);
        const rb = rankOf(b);
        if (ra !== rb) return ra - rb;
        return a.templateLabel.localeCompare(b.templateLabel);
      }
      if (sortBy === "Newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "Name") {
        return a.templateLabel.localeCompare(b.templateLabel);
      }
      if (sortBy === "Most Blocks") {
        return b.blockCount - a.blockCount;
      }
      return 0;
    };
    sorted.sort(compare);

    return sorted;
  }, [templates, searchQuery, sortBy, selectedIndustries]);

  // Build display groups for the Featured sort. Tenant-owned templates
  // ALWAYS render first ("Your templates") so a tenant's own work stays
  // above the starter library even after we surface curated flagships.
  // Then global premium ranks 1-10 are the hand-picked flagships,
  // followed by "All templates" for everything else. For non-Featured
  // sorts we render a single ungrouped list.
  const displayGroups = useMemo(() => {
    if (sortBy !== "Featured") {
      return [{ label: null as string | null, items: filteredAndSorted }];
    }
    const tenant: TemplatePage[] = [];
    const featured: TemplatePage[] = [];
    const rest: TemplatePage[] = [];
    for (const t of filteredAndSorted) {
      if (!t.isGlobal) {
        tenant.push(t);
        continue;
      }
      const rank = t.premiumRank ?? 200;
      if (rank <= 10) featured.push(t);
      else rest.push(t);
    }
    const groups: { label: string | null; items: TemplatePage[] }[] = [];
    if (tenant.length > 0) groups.push({ label: "Your templates", items: tenant });
    if (featured.length > 0) groups.push({ label: "Featured", items: featured });
    if (rest.length > 0) {
      const restLabel = tenant.length > 0 || featured.length > 0 ? "All templates" : null;
      groups.push({ label: restLabel, items: rest });
    }
    return groups;
  }, [filteredAndSorted, sortBy]);

  // "All" is true both for the sentinel (`null`, untouched) and for the case
  // where the user has individually re-checked every industry. This keeps the
  // Select-All checkbox and label honest after individual toggles.
  const allIndustriesSelected =
    selectedIndustries === null ||
    (availableIndustries.length > 0 && selectedIndustries.size === availableIndustries.length);
  const someIndustriesSelected =
    !allIndustriesSelected && selectedIndustries !== null && selectedIndustries.size > 0;
  const filterButtonLabel = allIndustriesSelected
    ? "All industries"
    : selectedIndustries && selectedIndustries.size === 0
      ? "No industries"
      : selectedIndustries && selectedIndustries.size === 1
        ? formatIndustry(Array.from(selectedIndustries)[0])
        : `${selectedIndustries?.size ?? 0} industries`;

  const toggleIndustry = (industry: string, checked: boolean) => {
    setSelectedIndustries((prev) => {
      // Materialize "all" into a concrete set on first interaction so the
      // user can deselect a single industry without nuking the rest.
      const base = prev === null ? new Set(availableIndustries) : new Set(prev);
      if (checked) base.add(industry);
      else base.delete(industry);
      // Collapse back to the "all" sentinel when every industry is checked,
      // so the Select-All control and label stay in their natural state.
      if (base.size === availableIndustries.length) return null;
      return base;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIndustries(checked ? null : new Set<string>());
  };

  // Clone a template using the real pages clone endpoint
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
        description: `"${template.templateLabel}" is now in your pages as "${newPage.title}"`,
      });
      // Navigate to the new page in the builder
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

  // Open the in-app preview modal. Templates aren't published as public /lp
  // pages, so opening one in a new tab 404s — instead we fetch the block JSON
  // and render it inside a scrollable modal using the same BlockRenderer the
  // builder & viewer use, so the preview matches the live result.
  const handlePreview = async (template: TemplatePage) => {
    const requestId = ++previewRequestRef.current;
    setPreviewTemplate(template);
    setPreviewBlocks(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/lp/templates/${template.id}/preview`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { blocks: PageBlock[] };
      if (previewRequestRef.current !== requestId) return; // stale
      setPreviewBlocks(Array.isArray(data.blocks) ? data.blocks : []);
    } catch (err) {
      if (previewRequestRef.current !== requestId) return; // stale
      const message = err instanceof Error ? err.message : "Failed to load preview";
      setPreviewError(message);
    } finally {
      if (previewRequestRef.current === requestId) {
        setPreviewLoading(false);
      }
    }
  };

  const closePreview = () => {
    // Bump the token so any in-flight request becomes stale and can't
    // resurrect modal state after the user has closed it.
    previewRequestRef.current++;
    setPreviewTemplate(null);
    setPreviewBlocks(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Clone a ready-made layout to get started quickly, then customize it in the builder.
          </p>
        </div>

        {/* Search and Sort */}
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
          <div className="flex gap-2 flex-wrap">
            {availableIndustries.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Filter className="h-3.5 w-3.5" />
                    {filterButtonLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="end">
                  <div className="p-3 border-b">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
                      <Checkbox
                        checked={
                          allIndustriesSelected
                            ? true
                            : someIndustriesSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(c) => toggleSelectAll(c === true || c === "indeterminate")}
                      />
                      Select all
                    </label>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {availableIndustries.map((industry) => {
                      const checked = allIndustriesSelected || (selectedIndustries?.has(industry) ?? false);
                      return (
                        <label
                          key={industry}
                          className="flex items-center gap-2 cursor-pointer select-none text-sm px-2 py-1.5 rounded hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleIndustry(industry, c === true)}
                          />
                          {formatIndustry(industry)}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {(["Featured", "Newest", "Name", "Most Blocks"] as SortOption[]).map((option) => (
              <Button
                key={option}
                variant={sortBy === option ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(option)}
              >
                {option === "Featured" && <Star className="h-3.5 w-3.5 mr-1" />}
                {option === "Newest" && <Clock className="h-3.5 w-3.5 mr-1" />}
                {option}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
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

        {/* Error State */}
        {error && !loading && (
          <Card className="p-8 text-center">
            <p className="text-destructive font-medium mb-2">Failed to load templates</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && templates.length === 0 && (
          <Card className="p-12 text-center">
            <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Mark any existing page as a template to make it available here. Open a page, go to settings, and toggle "Save as Template."
            </p>
            <Button variant="outline" onClick={() => navigate("/pages")}>
              <Plus className="h-4 w-4 mr-2" />
              Go to Pages
            </Button>
          </Card>
        )}

        {/* No Search Results */}
        {!loading && !error && templates.length > 0 && filteredAndSorted.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-semibold mb-2">No templates match your search</h3>
            <p className="text-sm text-muted-foreground">Try a different search term.</p>
          </div>
        )}

        {/* Templates Grid */}
        {!loading && !error && filteredAndSorted.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {filteredAndSorted.length} template{filteredAndSorted.length !== 1 ? "s" : ""} available
            </p>

            {displayGroups.map((group, gi) => (
              <div key={gi} className="space-y-4">
                {group.label && (
                  <div className="flex items-center gap-2 pt-2">
                    {group.label === "Featured" && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                    <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                    <span className="text-xs text-muted-foreground">({group.items.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.items.map((template, index) => (
                <Card
                  key={template.id}
                  className="group overflow-hidden border border-border/40 hover:border-border/80 hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  {/* Thumbnail — use ogImage if available, otherwise gradient.
                      Clicking the thumbnail opens the preview modal (matches
                      the Eye icon affordance on hover). */}
                  <button
                    type="button"
                    onClick={() => handlePreview(template)}
                    aria-label={`Preview ${template.templateLabel}`}
                    className="h-40 relative overflow-hidden block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={
                      template.ogImage
                        ? { backgroundImage: `url(${template.ogImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { background: getGradient(index) }
                    }
                  >
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                      <Eye className="h-8 w-8 text-white" />
                    </div>
                    {template.status === "published" && (
                      <Badge className="absolute top-2 right-2 bg-green-600 text-white text-[10px]">
                        Live
                      </Badge>
                    )}
                    {template.isGlobal && (
                      <Badge className="absolute top-2 left-2 bg-white/90 text-foreground hover:bg-white text-[10px] font-medium border border-border/40">
                        Starter
                      </Badge>
                    )}
                  </button>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="font-semibold text-base leading-tight mb-1">
                      {template.templateLabel}
                    </h3>

                    {template.templateDescription && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {template.templateDescription}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground border-t border-border/40 pt-3 mt-auto">
                      <div className="flex items-center gap-1">
                        <Grid3x3 className="h-3.5 w-3.5" />
                        <span>{template.blockCount} block{template.blockCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {template.mode}
                        </Badge>
                      </div>
                    </div>

                    {/* Action Buttons */}
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
              </div>
            ))}
          </>
        )}
      </div>

      {/* Preview Modal — fetches the template's full block JSON and renders it
          with BlockRenderer inside a scrollable container so users can browse
          every starter without cloning. The "Use this template" CTA at the
          bottom delegates back to handleUseTemplate to keep one clone path. */}
      <Dialog open={previewTemplate !== null} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent
          className="max-w-6xl w-[95vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
        >
          <DialogTitle className="sr-only">
            {previewTemplate?.templateLabel ?? "Template preview"}
          </DialogTitle>

          {/* Header bar */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-background shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base truncate">
                  {previewTemplate?.templateLabel}
                </h2>
                {previewTemplate?.isGlobal && (
                  <Badge variant="outline" className="text-[10px]">Starter</Badge>
                )}
              </div>
              {previewTemplate?.templateDescription && (
                <p className="text-xs text-muted-foreground truncate">
                  {previewTemplate.templateDescription}
                </p>
              )}
            </div>
            <Button
              size="sm"
              className="gap-1 shrink-0"
              disabled={!previewTemplate || cloningId === previewTemplate.id}
              onClick={() => previewTemplate && handleUseTemplate(previewTemplate)}
            >
              {previewTemplate && cloningId === previewTemplate.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Use this template
            </Button>
          </div>

          {/* Scrollable preview body. The inner wrapper uses a white background
              so blocks designed for a real landing page (which assume a page
              background) render correctly inside the dialog. */}
          <div className="flex-1 overflow-y-auto bg-white">
            {previewLoading && (
              <div className="h-full grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {previewError && !previewLoading && (
              <div className="h-full grid place-items-center p-8 text-center">
                <div>
                  <p className="text-destructive font-medium mb-2">Preview failed to load</p>
                  <p className="text-sm text-muted-foreground">{previewError}</p>
                </div>
              </div>
            )}
            {!previewLoading && !previewError && previewBlocks && previewBlocks.length === 0 && (
              <div className="h-full grid place-items-center p-8 text-center">
                <p className="text-sm text-muted-foreground">This template has no blocks yet.</p>
              </div>
            )}
            {!previewLoading && !previewError && previewBlocks && previewBlocks.length > 0 && (
              // Apply the tenant's brand CSS vars on a wrapper so blocks that
              // read `var(--brand-primary)`, `var(--brand-accent)`, etc. resolve
              // to the tenant's actual palette (matching what the builder will
              // show after cloning). Falls back to DEFAULT_BRAND until the
              // /api/lp/brand fetch resolves so vars are never unset.
              <div className="template-preview-root" style={getBrandStyleVars(previewBrand)}>
                {previewBlocks.map((block, i) => (
                  <BlockRenderer
                    key={(block as { id?: string }).id ?? i}
                    block={block}
                    brand={previewBrand}
                    animationsEnabled={false}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
