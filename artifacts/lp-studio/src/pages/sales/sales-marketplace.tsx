import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Grid3x3,
  Eye,
  Copy,
  Clock,
  History,
  Plus,
  Loader2,
  LayoutTemplate,
  RefreshCw,
} from "lucide-react";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { getBrandStyleVars } from "@/lib/brand-config";
import { useBrandConfig } from "@/context/BrandConfigContext";
import type { PageBlock } from "@/lib/block-types";
import {
  type TemplateTypeFilter,
  templateMatchesType,
  templateMatchesIndustry,
  collectIndustries,
  compareRecentlyUsed,
  formatIndustry,
  buildTemplateGroups,
  paginateTemplateGroups,
} from "@/lib/template-library";
import { TemplatePager } from "@/components/template-pager";

// Same-origin API base for the featured (homepage-default) templates fetch.
const API_BASE = "/api";

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
  /** Real screenshot thumbnail captured from the template's preview render.
   * null until captured; the card falls back to ogImage, then a gradient. */
  thumbnailUrl: string | null;
  /** When the thumbnail was last captured. null + recently created → the card
   * shows a "Capturing preview…" shimmer. */
  thumbnailCapturedAt: string | null;
  /** True for global starter templates shared across tenants; false (or
   *  missing on legacy responses) for templates owned by the caller's
   *  tenant. Used to keep tenant-owned templates ahead of global starters
   *  in every sort order, so DSO templates and other internal designs
   *  always appear first. */
  isGlobal?: boolean;
  /** Industry tag for global starters (e.g. "dental"); drives the Industry
   *  filter. The "generic" catch-all is treated as untagged. */
  industry?: string | null;
  /** Marketplace rank; 1–10 marks a curated flagship "Premium" template. */
  premiumRank?: number;
  /** Per-workspace last-used timestamp (ISO). null = never cloned by this
   *  workspace; the "Recently Used" sort pushes these to the end. */
  lastUsedAt: string | null;
  /** True when this workspace has starred the template (→ "Featured" section).
   *  Returned per-tenant by the enriched endpoint. */
  featured?: boolean;
  /** True for standalone full-page templates (drives the "Full page" section). */
  fullPage?: boolean;
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

/** A template just created (< 60s ago) whose thumbnail hasn't landed yet — the
 * capture runs async, so show a brief "Capturing preview…" shimmer. */
function isCapturingThumbnail(t: { thumbnailUrl: string | null; thumbnailCapturedAt: string | null; createdAt: string }): boolean {
  if (t.thumbnailUrl || t.thumbnailCapturedAt) return false;
  const created = new Date(t.createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created < 60_000;
}

/** Card media: prefers the real screenshot thumbnail, then the OG image, then a
 * gradient placeholder. A broken/slow image falls back to the gradient via
 * onError. Layered absolutely so the parent hover overlay + badges sit on top. */
function TemplateCardMedia({
  thumbnailUrl,
  ogImage,
  gradient,
  capturing,
}: {
  thumbnailUrl: string | null;
  ogImage: string;
  gradient: string;
  capturing: boolean;
}) {
  // Ordered candidate sources: the real screenshot first, then the OG image. A
  // broken/slow image advances to the next candidate via onError, so a stale or
  // unreachable thumbnail still falls back to the OG image (then the gradient)
  // rather than showing a blank/grey card.
  const sources = useMemo(
    () => [thumbnailUrl, ogImage].filter((s): s is string => !!s),
    [thumbnailUrl, ogImage],
  );
  const [idx, setIdx] = useState(0);
  // Reset to the first candidate when the sources change (e.g. after a refresh).
  useEffect(() => {
    setIdx(0);
  }, [thumbnailUrl, ogImage]);
  const src = sources[idx];
  const showImage = !!src;
  return (
    <>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: gradient }} />
      )}
      {capturing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <span className="flex items-center gap-2 text-xs font-medium text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Capturing preview…
          </span>
        </div>
      )}
    </>
  );
}

type SortOption = "Newest" | "Name" | "Recently Used";

export default function SalesMarketplace() {
  const { toast } = useToast();
  // Render previews with the tenant's actual brand (Dandy's palette/fonts for
  // Dandy tenants) so var(--brand-*) resolve to the real colors, matching the
  // builder — not the neutral DEFAULT_BRAND slate/blue.
  const { brand } = useBrandConfig();
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<TemplatePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  // Type filter (task #753): All / Premium / Industry-specific / Custom.
  const [typeFilter, setTypeFilter] = useState<TemplateTypeFilter>("All");
  // Industry filter: null = "all industries"; otherwise a single industry slug
  // that only restricts industry-tagged globals.
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [refreshingThumbId, setRefreshingThumbId] = useState<number | null>(null);
  // Superadmin homepage-default template ids — drives the "Platform Homepage
  // templates" section. `null` = still loading / fetch failed; the section is
  // then skipped and those templates fall through to other buckets.
  const [homepageDefaultIds, setHomepageDefaultIds] = useState<Set<number> | null>(null);
  // Current gallery page (1-based). Reset to 1 when search/filter/sort changes.
  const [page, setPage] = useState(1);
  // In-app preview modal state. Templates aren't published as public /lp
  // pages (opening one in a new tab 404s), so the preview button now opens
  // a modal that fetches the template's full block JSON and renders it
  // with the same BlockRenderer the builder & viewer use.
  const [previewTemplate, setPreviewTemplate] = useState<TemplatePage | null>(null);
  const [previewBlocks, setPreviewBlocks] = useState<PageBlock[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Monotonic request token: when the user rapidly switches templates or
  // closes the modal mid-fetch, only the most recent request is allowed
  // to write state. Prevents stale-response-A from overwriting newer-B.
  const previewRequestRef = useRef(0);

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

  // Load the superadmin homepage-default template ids so the "Platform Homepage
  // templates" section can be built (mirrors the create-page modal flow). A
  // failed/empty fetch leaves an empty set → the section is skipped gracefully.
  useEffect(() => {
    fetch(`${API_BASE}/lp/featured-templates`, { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((data: { templates?: { id?: string }[] }) => {
        const ids = new Set<number>();
        for (const t of data.templates ?? []) {
          const raw = typeof t.id === "string" ? t.id : "";
          const num = Number(raw.startsWith("global:") ? raw.slice(7) : raw);
          if (Number.isInteger(num) && num > 0) ids.add(num);
        }
        setHomepageDefaultIds(ids);
      })
      .catch(() => setHomepageDefaultIds(new Set()));
  }, []);

  // Real industry tags present across the loaded templates (excludes the
  // "generic" catch-all), sorted alphabetically. Populates the Industry
  // dropdown.
  const availableIndustries = useMemo(() => collectIndustries(templates), [templates]);

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

    // Type filter: Premium / Industry-specific / Custom (or All).
    if (typeFilter !== "All") {
      result = result.filter((t) => templateMatchesType(t, typeFilter));
    }

    // Industry filter: only restricts global, industry-tagged templates.
    if (selectedIndustry !== null) {
      result = result.filter((t) => templateMatchesIndustry(t, selectedIndustry));
    }

    const sorted = [...result];
    // Primary sort key — tenant-owned templates always appear before
    // global starter templates, regardless of the user-selected sort.
    // Secondary sort is the user-selected option.
    const ownedRank = (t: TemplatePage) => (t.isGlobal ? 1 : 0);
    if (sortBy === "Newest") {
      sorted.sort((a, b) => {
        const r = ownedRank(a) - ownedRank(b);
        if (r !== 0) return r;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortBy === "Name") {
      sorted.sort((a, b) => {
        const r = ownedRank(a) - ownedRank(b);
        if (r !== 0) return r;
        return a.templateLabel.localeCompare(b.templateLabel);
      });
    } else if (sortBy === "Recently Used") {
      sorted.sort((a, b) => {
        const r = ownedRank(a) - ownedRank(b);
        if (r !== 0) return r;
        return compareRecentlyUsed(a, b);
      });
    }

    return sorted;
  }, [templates, searchQuery, sortBy, typeFilter, selectedIndustry]);

  // Group into the ordered display sections (Featured → Your templates →
  // Platform Homepage → Full page → Block → Industry) — shared with the
  // Marketing marketplace so the two galleries stay identical.
  const allGroups = useMemo(
    () => buildTemplateGroups(filteredAndSorted, homepageDefaultIds),
    [filteredAndSorted, homepageDefaultIds],
  );

  // Reset to page 1 whenever the result set changes (search / filter / sort).
  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, selectedIndustry, typeFilter]);

  // Slice the ordered sections into the current page; the two lowest-priority
  // sections overflow onto later pages once the total exceeds the page size.
  const { groups: displayGroups, total, totalPages, page: currentPage } = useMemo(
    () => paginateTemplateGroups(allGroups, page),
    [allGroups, page],
  );

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

  // Force a fresh screenshot capture for a tenant-owned template. Awaits the
  // server (a few seconds while thum.io renders), then patches the row in local
  // state so the new thumbnail (with its cache-busted URL) loads immediately.
  const handleRefreshThumbnail = async (template: TemplatePage) => {
    if (template.isGlobal) return;
    setRefreshingThumbId(template.id);
    try {
      const res = await fetch(`/api/lp/templates/${template.id}/refresh-thumbnail`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        captured?: boolean;
        thumbnailUrl: string | null;
        thumbnailCapturedAt: string | null;
      };
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? { ...t, thumbnailUrl: data.thumbnailUrl, thumbnailCapturedAt: data.thumbnailCapturedAt }
            : t,
        ),
      );
      if (data.captured) {
        toast({
          title: "Thumbnail refreshed",
          description: `Updated the preview for "${template.templateLabel}".`,
        });
      } else {
        // No real screenshot — the card now falls back to the page's OG image.
        toast({
          title: "Showing the social image",
          description: `We couldn't capture a fresh preview for "${template.templateLabel}", so the card shows the page's social image instead.`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh thumbnail";
      toast({ title: "Couldn't refresh thumbnail", description: message, variant: "destructive" });
    } finally {
      setRefreshingThumbId(null);
    }
  };

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
    <SalesLayout>
      <div className="space-y-6">
        <SalesPageHeader
          title="Template Library"
          description="Clone a template and customize it in the builder — no account required"
        />

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
            {/* Type filter — All / Premium / Industry-specific / Custom. */}
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TemplateTypeFilter)}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All types</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Industry-specific">Industry-specific</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {/* Industry filter — single-select, defaults to "All industries". */}
            {availableIndustries.length > 0 && (
              <Select
                value={selectedIndustry ?? "__all__"}
                onValueChange={(v) => setSelectedIndustry(v === "__all__" ? null : v)}
              >
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All industries</SelectItem>
                  {availableIndustries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {formatIndustry(industry)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(["Newest", "Name", "Recently Used"] as SortOption[]).map((option) => (
              <Button
                key={option}
                variant={sortBy === option ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(option)}
              >
                {option === "Newest" && <Clock className="h-3.5 w-3.5 mr-1" />}
                {option === "Recently Used" && <History className="h-3.5 w-3.5 mr-1" />}
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

        {!loading && !error && total > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {total} template{total !== 1 ? "s" : ""} available
              {totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}
            </p>

            {displayGroups.map((group) => (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-2 pt-2">
                  <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                  <span className="text-xs text-muted-foreground">({group.items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.items.map((template, index) => (
                <Card
                  key={template.id}
                  className="group overflow-hidden border border-border/40 hover:border-border/80 hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  <div
                    className="h-40 relative overflow-hidden cursor-pointer bg-muted"
                    onClick={() => handlePreview(template)}
                  >
                    <TemplateCardMedia
                      thumbnailUrl={template.thumbnailUrl}
                      ogImage={template.ogImage}
                      gradient={getGradient(index)}
                      capturing={isCapturingThumbnail(template)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="h-8 w-8 text-white" />
                    </div>
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
                        title="Preview template"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {/* Refresh thumbnail — tenant-owned only (the server
                          refuses to re-capture shared global templates). */}
                      {!template.isGlobal && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshThumbnail(template)}
                          title="Refresh preview thumbnail"
                          disabled={refreshingThumbId === template.id}
                        >
                          {refreshingThumbId === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                  ))}
                </div>
              </div>
            ))}

            {/* Pager — only shown when the result spans more than one page. */}
            {totalPages > 1 && (
              <TemplatePager
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {/* Preview Modal — fetches the template's full block JSON and renders
          it with BlockRenderer inside a scrollable container so reps can
          browse every template before cloning. The "Use this template" CTA
          delegates back to handleUseTemplate to keep one clone path. */}
      <Dialog open={previewTemplate !== null} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent
          className="max-w-6xl w-[95vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
        >
          <DialogTitle className="sr-only">
            {previewTemplate?.templateLabel ?? "Template preview"}
          </DialogTitle>

          <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-3 border-b bg-background shrink-0">
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

          <div className="relative isolate flex-1 overflow-y-auto bg-white">
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
              <div className="template-preview-root" style={getBrandStyleVars(brand)}>
                {previewBlocks.map((block, i) => (
                  <BlockRenderer
                    key={(block as { id?: string }).id ?? i}
                    block={block}
                    brand={brand}
                    animationsEnabled={false}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SalesLayout>
  );
}
