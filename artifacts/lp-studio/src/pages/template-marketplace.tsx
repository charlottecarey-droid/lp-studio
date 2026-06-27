import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search,
  Star,
  History,
  Clock,
  Grid3x3,
  Eye,
  Copy,
  Plus,
  Loader2,
  LayoutTemplate,
  StarOff,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { DEFAULT_BRAND, getBrandStyleVars, fetchBrandConfig, type BrandConfig } from "@/lib/brand-config";
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
  /** Real screenshot thumbnail captured from the template's preview render.
   * null until captured; the card falls back to ogImage, then a gradient. */
  thumbnailUrl: string | null;
  /** When the thumbnail was last captured. null + recently created → the card
   * shows a "Capturing preview…" shimmer. */
  thumbnailCapturedAt: string | null;
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
  /** True for standalone full-page templates — the page's first block renders
   *  an entire page (its own hero/body/chrome) rather than composing into one.
   *  Drives the "Full Page" type filter and the card badge. */
  fullPage?: boolean;
  /** Per-workspace last-used timestamp (ISO). null = this workspace has never
   *  cloned this template; the "Recently Used" sort pushes these to the end. */
  lastUsedAt: string | null;
  /** True when this workspace has starred the template. Starred templates are
   *  grouped under "Featured" at the top of the gallery and offered as starting
   *  points in the create-page modal. Toggled via the card's star button. */
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
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

/** A template just created (< 60s ago) whose thumbnail hasn't landed yet — the
 * capture runs async, so show a brief "Capturing preview…" shimmer instead of
 * leaving the card looking empty. */
function isCapturingThumbnail(t: { thumbnailUrl: string | null; thumbnailCapturedAt: string | null; createdAt: string }): boolean {
  if (t.thumbnailUrl || t.thumbnailCapturedAt) return false;
  const created = new Date(t.createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created < 60_000;
}

/** Card media: prefers the real screenshot thumbnail, then the OG image, then a
 * gradient placeholder. A broken/slow image falls back to the gradient via
 * onError. Layered absolutely so the parent button's hover overlay + badges sit
 * on top. */
function TemplateCardMedia({
  featuredThumbnail,
  thumbnailUrl,
  ogImage,
  gradient,
  capturing,
}: {
  /** Curated homepage thumbnail (featured_homepage_templates.thumbnail_url) for
   *  templates also shown on the marketing homepage. When present it takes
   *  priority so the in-app "Homepage templates" cards match the homepage. */
  featuredThumbnail?: string | null;
  thumbnailUrl: string | null;
  ogImage: string;
  gradient: string;
  capturing: boolean;
}) {
  // Ordered candidate sources: the curated homepage image first (so featured
  // templates match the marketing homepage), then the real screenshot, then the
  // OG image. A broken/slow image advances to the next candidate via onError, so
  // a stale or unreachable source still falls back rather than showing a
  // blank/grey card.
  const sources = useMemo(
    () => [featuredThumbnail, thumbnailUrl, ogImage].filter((s): s is string => !!s),
    [featuredThumbnail, thumbnailUrl, ogImage],
  );
  const [idx, setIdx] = useState(0);
  // Reset to the first candidate when the sources change (e.g. after a refresh).
  useEffect(() => {
    setIdx(0);
  }, [featuredThumbnail, thumbnailUrl, ogImage]);
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

type SortOption = "Featured" | "Newest" | "Name" | "Recently Used";

export default function TemplateMarketplace() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<TemplatePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Featured");
  // Type filter (task #753): All / Premium / Industry-specific / Custom.
  // Replaces the former All / Yours / Starters owner control. See
  // templateMatchesType for the bucket definitions.
  const [typeFilter, setTypeFilter] = useState<TemplateTypeFilter>("All");
  // Track the in-flight un-template request and the template pending
  // confirmation. We stash the full record (not just the id) so the dialog
  // can show the label without re-querying state after the user clicks.
  const [removingTemplateId, setRemovingTemplateId] = useState<number | null>(null);
  // Track the in-flight star toggle so the card's star shows a spinner and
  // can't be double-clicked mid-request.
  const [featuringId, setFeaturingId] = useState<number | null>(null);
  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<TemplatePage | null>(null);
  const [refreshingThumbId, setRefreshingThumbId] = useState<number | null>(null);
  // Industry filter: `null` means "all industries" (default). Otherwise a
  // single industry slug; only industry-tagged globals are restricted —
  // tenant-owned templates and untagged globals always pass through so the
  // user never loses access to their own work.
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<number | null>(null);
  // Superadmin homepage-default template ids — drives the "Platform Homepage
  // templates" section. `null` = still loading / fetch failed; in that case the
  // section is simply skipped and those templates fall through to other buckets.
  const [homepageDefaultIds, setHomepageDefaultIds] = useState<Set<number> | null>(null);
  // Curated homepage thumbnails (template lp_pages id → featured_homepage_templates
  // thumbnail_url) so the in-app "Homepage templates" cards show the SAME
  // hand-picked images as the marketing homepage. Empty until the fetch lands.
  const [homepageThumbnails, setHomepageThumbnails] = useState<Map<number, string>>(new Map());
  // Current gallery page (1-based). Reset to 1 whenever search/filter/sort
  // changes so the user never lands on an out-of-range page.
  const [page, setPage] = useState(1);
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

  // Load the superadmin homepage-default template ids so the "Platform Homepage
  // templates" section can be built. Mirrors the create-page modal flow (the
  // featured-templates endpoint returns ids like "global:123"). A failed/empty
  // fetch leaves an empty set → the section is skipped gracefully.
  useEffect(() => {
    fetch(`${API_BASE}/lp/featured-templates`, { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((data: { templates?: { id?: string; thumbnail?: string }[] }) => {
        const ids = new Set<number>();
        const thumbs = new Map<number, string>();
        for (const t of data.templates ?? []) {
          const raw = typeof t.id === "string" ? t.id : "";
          const num = Number(raw.startsWith("global:") ? raw.slice(7) : raw);
          if (Number.isInteger(num) && num > 0) {
            ids.add(num);
            const thumb = typeof t.thumbnail === "string" ? t.thumbnail.trim() : "";
            if (thumb) thumbs.set(num, thumb);
          }
        }
        setHomepageDefaultIds(ids);
        setHomepageThumbnails(thumbs);
      })
      .catch(() => {
        setHomepageDefaultIds(new Set());
        setHomepageThumbnails(new Map());
      });
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

    // Type filter: Premium / Industry-specific / Custom (or All). See
    // templateMatchesType for the bucket definitions.
    if (typeFilter !== "All") {
      result = result.filter((t) => templateMatchesType(t, typeFilter));
    }

    // Industry filter: only restricts global, industry-tagged templates.
    // Tenant-owned templates and untagged globals always remain visible.
    if (selectedIndustry !== null) {
      result = result.filter((t) => templateMatchesIndustry(t, selectedIndustry));
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
      if (sortBy === "Recently Used") {
        return compareRecentlyUsed(a, b);
      }
      return 0;
    };
    sorted.sort(compare);

    return sorted;
  }, [templates, searchQuery, sortBy, selectedIndustry, typeFilter]);

  // Group the filtered+sorted templates into the ordered display sections
  // (Featured → Your templates → Platform Homepage → Full page → Block →
  // Industry). Shared with the Sales marketplace so the two galleries match.
  const allGroups = useMemo(
    () => buildTemplateGroups(filteredAndSorted, homepageDefaultIds),
    [filteredAndSorted, homepageDefaultIds],
  );

  // Reset to page 1 whenever the result set changes (search / filter / sort)
  // so a stale page never strands the user on an out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, selectedIndustry, typeFilter]);

  // Slice the ordered sections into the current page. The two lowest-priority
  // sections naturally overflow onto later pages once the total exceeds the
  // page size; section headers re-render wherever a section starts/continues.
  const { groups: displayGroups, total, totalPages, page: currentPage } = useMemo(
    () => paginateTemplateGroups(allGroups, page),
    [allGroups, page],
  );

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

  // Toggle whether a template is "featured" (starred) for this workspace.
  // Optimistic: flip the flag locally so the card moves into/out of the
  // "Featured" group immediately, then persist via the PUT endpoint and revert
  // on failure. Works for both tenant-owned and global templates.
  const handleToggleFeatured = async (template: TemplatePage) => {
    const next = !template.featured;
    setFeaturingId(template.id);
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, featured: next } : t)),
    );
    try {
      const res = await fetch(`/api/lp/templates/${template.id}/featured`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast({
        title: next ? "Added to Featured" : "Removed from Featured",
        description: next
          ? `"${template.templateLabel}" now appears in your Featured templates.`
          : `"${template.templateLabel}" no longer appears in your Featured templates.`,
      });
    } catch (err) {
      // Revert the optimistic flip.
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, featured: !next } : t)),
      );
      const message =
        err instanceof Error ? err.message : "Failed to update featured state";
      toast({
        title: "Couldn't update Featured",
        description: message,
        variant: "destructive",
      });
    } finally {
      setFeaturingId(null);
    }
  };

  const handleRemoveTemplate = async (template: TemplatePage) => {
    if (template.isGlobal) return;
    setRemovingTemplateId(template.id);
    try {
      const res = await fetch(`/api/lp/pages/${template.id}/mark-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemplate: false, templateLabel: null, templateDescription: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      toast({
        title: "Removed from templates",
        description: `"${template.templateLabel}" is now a regular page and won't show in the New Microsite modal.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove template";
      toast({ title: "Couldn't remove template", description: message, variant: "destructive" });
    } finally {
      setRemovingTemplateId(null);
      setRemoveConfirmTarget(null);
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
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Templates</h1>
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
            {/* Type filter — All / Premium / Industry-specific / Custom.
                Replaces the former owner control. Defaults to "All". */}
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TemplateTypeFilter)}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All types</SelectItem>
                <SelectItem value="Full Page">Full Page</SelectItem>
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
            {(["Featured", "Newest", "Name", "Recently Used"] as SortOption[]).map((option) => (
              <Button
                key={option}
                variant={sortBy === option ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(option)}
              >
                {option === "Featured" && <Star className="h-3.5 w-3.5 mr-1" />}
                {option === "Newest" && <Clock className="h-3.5 w-3.5 mr-1" />}
                {option === "Recently Used" && <History className="h-3.5 w-3.5 mr-1" />}
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
        {!loading && !error && total > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {total} template{total !== 1 ? "s" : ""} available
              {totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}
            </p>

            {displayGroups.map((group) => (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-2 pt-2">
                  {group.key === "featured" && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                  <span className="text-xs text-muted-foreground">({group.items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.items.map((template, index) => (
                <Card
                  key={template.id}
                  className="group overflow-hidden border border-border/40 hover:border-border/80 hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  {/* Thumbnail — real screenshot if captured, else ogImage,
                      else a gradient placeholder. Clicking opens the preview
                      modal (matches the Eye icon affordance on hover). The star
                      toggle is a sibling overlay (not nested in the preview
                      button) so featuring never triggers a preview. */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => handlePreview(template)}
                      aria-label={`Preview ${template.templateLabel}`}
                      className="h-40 relative overflow-hidden block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-muted"
                    >
                      <TemplateCardMedia
                        featuredThumbnail={homepageThumbnails.get(template.id) ?? null}
                        thumbnailUrl={template.thumbnailUrl}
                        ogImage={template.ogImage}
                        gradient={getGradient(index)}
                        capturing={isCapturingThumbnail(template)}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <Eye className="h-8 w-8 text-white" />
                      </div>
                      {template.isGlobal && (
                        <Badge className="absolute top-2 left-2 bg-white/90 text-foreground hover:bg-white text-[10px] font-medium border border-border/40">
                          Starter
                        </Badge>
                      )}
                      {template.fullPage && (
                        <Badge className="absolute bottom-2 left-2 bg-primary/90 text-primary-foreground hover:bg-primary text-[10px] font-medium border border-primary/40">
                          Full Page
                        </Badge>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(template)}
                      disabled={featuringId === template.id}
                      aria-pressed={!!template.featured}
                      aria-label={
                        template.featured
                          ? `Remove ${template.templateLabel} from Featured`
                          : `Add ${template.templateLabel} to Featured`
                      }
                      title={template.featured ? "Remove from Featured" : "Add to Featured"}
                      className="absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-border/40 bg-white/90 shadow-sm transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    >
                      {featuringId === template.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Star
                          className={`h-4 w-4 ${template.featured ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                        />
                      )}
                    </button>
                  </div>

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
                      {!template.isGlobal && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRemoveConfirmTarget(template)}
                          title="Remove from templates (page stays in your pages)"
                          disabled={removingTemplateId === template.id}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        >
                          {removingTemplateId === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <StarOff className="h-4 w-4" />
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

          {/* Scrollable preview body. The inner wrapper uses a white background
              so blocks designed for a real landing page (which assume a page
              background) render correctly inside the dialog. */}
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

      {/* Un-template confirmation. Pages aren't deleted — only the
          is_template flag flips off — but we still confirm because the
          template instantly disappears from the New Microsite modal for
          every sales user, which is a meaningful behavior change. */}
      <AlertDialog
        open={removeConfirmTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveConfirmTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from templates?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeConfirmTarget ? (
                <>
                  &quot;{removeConfirmTarget.templateLabel}&quot; will no longer appear in
                  the template library or the New Microsite modal. The page itself
                  stays in your pages — you can mark it as a template again at any time.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingTemplateId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (removeConfirmTarget) handleRemoveTemplate(removeConfirmTarget);
              }}
              disabled={removingTemplateId !== null}
              className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
            >
              {removingTemplateId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove from templates"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
