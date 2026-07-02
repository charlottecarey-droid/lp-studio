import { useEffect, useState, useRef, useCallback, useMemo, memo, Component, type ReactNode, type RefObject, type ErrorInfo } from "react";
import { motion, type TargetAndTransition } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import { trackView } from "@/hooks/use-recently-viewed";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Trash2, Plus, FlaskConical, Loader2, TestTube2, Layers, Code2, Type, Sparkles, BookmarkPlus, ArrowLeft,
  Search, CheckCircle2, Lock, XCircle, ChevronDown, ChevronUp, Wand2, Camera, ImageIcon, Flame, BookOpen, Variable, Mail, X, Star, MessageSquare, Palette, Eye, Monitor,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LINKED_FORM_STYLE_KEY, readLinkedFormStyle, writeLinkedFormStyle, type LinkedFormStyle } from "@/lib/linked-form-style";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, getLpPageUrl, getLpPreviewUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { fetchBrandConfig, saveBrandConfig, DEFAULT_BRAND, getBrandStyleVars, getBrandButtonCss, type BrandConfig } from "@/lib/brand-config";
import { useFactFlags } from "@/hooks/use-fact-flags";
import { syncFactFlags } from "@/lib/fact-flags-api";
import { FactReviewModal } from "@/components/FactReviewModal";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCK_REGISTRY, createBlock, getBlockDef, isAllowedAsChild, templateToBlocks, type PageBlock, type BlockType, type SchemaFieldValue } from "@/lib/block-types";
import { CustomBlocksProvider, customBlockRowToSource, type CustomBlockSource } from "@/lib/custom-blocks-context";
import {
  type BlockPath,
  collectIds,
  findBlockById,
  findPathById,
  getAtPath,
  insertAtPath,
  moveBlock,
  normalizeTree,
  removeAtPath,
  setAtPath,
} from "@/lib/block-tree";
import { NestedChild, EmptyContainerSlot, TailDropSlot } from "./NestedChildren";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { PropertyPanel } from "./property-panels/PropertyPanel";
import { BuilderTopBar } from "@/components/layout/builder-top-bar";
import { OgCharCount, OgDimensionWarning, ShareCardPreview } from "@/components/og-share-card";
import { AdCopyDialog } from "@/components/builder/AdCopyDialog";
import { LP_TEMPLATES, getTemplatesForIndustry } from "@/lib/templates";
import { isFullPageTemplate } from "@workspace/lp-template-engine";
import { buildTemplateGroups, type TemplateGroupShape } from "@/lib/template-library";
import { TiptapEditor } from "@/components/TiptapEditor";
import { MediaLibraryDrawer } from "@/components/MediaLibraryDrawer";
import { refreshBlockCopy } from "@/lib/copy-api";
import { COPY_FIELDS } from "@/lib/copy-fields";
import { propagateCtaToAll, countCtaTargets, blockHasCta } from "@/lib/cta-propagation";
import type { CtaConfig } from "@/lib/cta/ctaConfig";
import { PageCtaSection } from "@/pages/builder/property-panels/PageCtaSection";
import { useToast } from "@/hooks/use-toast";
import { SaveToLibraryDialog } from "@/components/SaveToLibraryDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useComments, useReviews, usePresence, getAuthorName, type BlockComments } from "@/hooks/use-collaboration";
import { useBlockCatalog, type ResolvedBlockDef } from "@/hooks/use-block-catalog";
import { useTenantBlockLibraryPrefs } from "@/hooks/use-tenant-block-library-prefs";
import { useTenantBlockGovernance } from "@/hooks/use-tenant-block-governance";
import {
  applyGovernanceAvailability,
  blocksApprovedForSegment,
  type GovernanceMap,
} from "@/lib/block-governance-client";
import {
  applyBlockLibraryPrefs,
  applyCategoryOrder,
  categoryLabel as resolveCategoryLabel,
  matchesSearch as matchesBlockSearch,
  type BlockLibraryPrefs,
} from "@/lib/block-library-prefs";
import { CustomizeBlockLibraryDialog } from "@/components/CustomizeBlockLibraryDialog";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { useKeyboardShortcuts, type Shortcut } from "@/lib/keyboard-shortcuts";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { Settings2, BarChart3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { isBlockVisibleForAudience, isBlockTypeAllowedForAudience, canUseGridPieces } from "@/lib/audience-gating";
import CopilotPanel, { type ApplyActionResult } from "./CopilotPanel";
import type { CopilotAction } from "@/lib/copilotStream";
import { contrastRatio } from "@/lib/section-ink";
import { CommentsPanel, CommentBadge } from "@/components/collaboration/comment-thread";
import { ShareReviewModal } from "@/components/collaboration/share-review-modal";
import {
  scorePageSeoGeo,
  gradeColor,
  gradeBgColor,
  scoreColor,
  scoreRingColor,
  type ScoreResult,
  type AiSuggestion,
} from "@/lib/seo-scoring";
import { HeatmapOverlay } from "@/components/heatmap/HeatmapOverlay";
import { PerformanceScorePanel } from "@/components/heatmap/PerformanceScorePanel";
import { ContentBriefModal, type ContentBrief } from "@/components/ContentBriefModal";
import { setBriefContext, getBriefContext } from "@/lib/brief-context";
import type { AudienceSegment } from "@/lib/brand-config";

interface CustomBlock {
  id: number;
  name: string;
  block_type: string;
  props: Record<string, unknown>;
  block_settings?: Record<string, unknown>;
  segment?: string;
}

type BuilderAnimationStyle = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-in" | "none";

const BUILDER_ANIMATION_VARIANTS: Record<BuilderAnimationStyle, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
  "fade-up":    { initial: { opacity: 0, y: 40 },        animate: { opacity: 1, y: 0 } },
  "fade-in":    { initial: { opacity: 0 },               animate: { opacity: 1 } },
  "slide-left": { initial: { opacity: 0, x: -60 },       animate: { opacity: 1, x: 0 } },
  "slide-right":{ initial: { opacity: 0, x: 60 },        animate: { opacity: 1, x: 0 } },
  "scale-in":   { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } },
  "none":       { initial: {},                            animate: {} },
};

const BUILDER_ANIMATION_EASE = [0.16, 1, 0.3, 1] as const;

function genBlockId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const API_BASE = "/api";

/** One thumbnail in the OG "images in use" picker. Decoded lazily/async so a
 *  long list never exhausts a phone's image-decode memory (which renders the
 *  tiles as scrambled garbage), and self-hides on load failure without
 *  mutating the DOM out from under React. */
function OgInUseThumb({ url, onPick }: { url: string; onPick: (url: string) => void }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <button
      type="button"
      onClick={() => onPick(url)}
      className="aspect-video rounded overflow-hidden border border-transparent hover:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] bg-muted"
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={() => setBroken(true)}
      />
    </button>
  );
}

interface FetchedPage {
  id: number;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: string;
  customCss?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  // Task #494 — tri-state robots overrides. null = inherit tenant default.
  allowIndexing?: boolean | null;
  allowFollowing?: boolean | null;
  animationsEnabled?: boolean;
  smoothScroll?: boolean;
  pageVariables?: Record<string, string>;
  // Unified CTA architecture, Phase 1. Page-level default CTA. null/absent =
  // no page-level CTA.
  ctaDefault?: CtaConfig | null;
  isTemplate?: boolean;
  // Task #1085 — global templates are owned by the neutral __system-templates
  // tenant. Used (with superadmin) to surface the "Preview as brand" control.
  isGlobal?: boolean;
  templateLabel?: string | null;
  templateDescription?: string | null;
  audienceType?: string | null;
  segmentId?: string | null;
}

async function fetchPage(id: string): Promise<FetchedPage> {
  const res = await fetch(`${API_BASE}/lp/pages/${id}`);
  if (!res.ok) throw new Error("Failed to load page");
  return res.json() as Promise<FetchedPage>;
}

function inferBuilderAudienceType(segmentName: string): string | null {
  const n = segmentName.toLowerCase();
  if (n.includes("dso") && (n.includes("corporate") || n.includes("leadership") || n.includes("executive") || n.includes("c-suite"))) return "dso-corporate";
  if (n.includes("dso") && (n.includes("practice") || n.includes("office") || n.includes("dentist"))) return "dso-practice";
  if (n.includes("independent") || n.includes("solo") || n.includes("private")) return "independent";
  if (n.includes("dso")) return "dso-corporate";
  if (n.includes("practice")) return "dso-practice";
  return null;
}

interface SavePageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "pending_review" | "published";
  customCss?: string;
  animationsEnabled?: boolean;
  smoothScroll?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  // Task #494 — tri-state robots overrides. null = inherit tenant default.
  allowIndexing?: boolean | null;
  allowFollowing?: boolean | null;
  pageVariables?: Record<string, string>;
  audienceType?: string | null;
  segmentId?: string | null;
  // Unified CTA architecture, Phase 1. Page-level default CTA (or null to clear).
  ctaDefault?: CtaConfig | null;
}

async function savePage(id: string, data: SavePageData) {
  const res = await fetch(`${API_BASE}/lp/pages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save page");
  return res.json();
}

function CustomBlockThumbnail({ blockType }: { blockType: string }) {
  const def = getBlockDef(blockType as BlockType);
  return (
    <div className="w-full h-14 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
      {blockType === "rich-text" ? (
        <Type className="w-5 h-5 text-muted-foreground" />
      ) : blockType === "custom-html" || !def ? (
        <Code2 className="w-5 h-5 text-muted-foreground" />
      ) : (
        <BookmarkPlus className="w-5 h-5 text-primary/60" />
      )}
    </div>
  );
}

function BlockLibrary({ onAdd, customBlocks, visibleBlocks, prefs, onCustomize }: { onAdd: (type: string) => void; customBlocks: CustomBlock[]; visibleBlocks: ResolvedBlockDef[]; prefs: BlockLibraryPrefs; onCustomize: () => void }) {
  // Core categories for the Blocks tab. "Hero" and "Showcase" sit right under
  // the header (Layout) section here. "Grid Pieces" still lives in the Segment
  // tab so the two tabs never duplicate the same block.
  const defaultCoreOrder = ["Layout", "Hero", "Showcase", "Features", "Content", "Social Proof", "CTA", "Lead Capture", "Engagement", "Interactive"] as const;
  // Any category that exists in the catalog but is neither a known core nor a
  // known non-core (SegmentLibrary) category is a tenant-created shelf — a
  // user moved a block into a new bucket via the Customize dialog. Surface
  // those in the Blocks tab so the block is reachable.
  const knownNonCore = new Set(["DSO", "DSO Practices", "Events", "Grid Pieces", "Full Page Templates"]);
  const tenantExtras = Array.from(new Set(
    visibleBlocks
      .map(b => b.category)
      .filter(c => !defaultCoreOrder.includes(c as (typeof defaultCoreOrder)[number]) && !knownNonCore.has(c)),
  ));
  const categories = applyCategoryOrder([...defaultCoreOrder, ...tenantExtras], prefs);
  const coreCustomBlocks = customBlocks.filter(b => !b.segment || b.segment === "core");
  const [search, setSearch] = useState("");
  const filteredCustom = search.trim()
    ? coreCustomBlocks.filter(b => b.name.toLowerCase().includes(search.trim().toLowerCase()))
    : coreCustomBlocks;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="Customize block library (hide, rename, reorder)"
          onClick={onCustomize}
        >
          <Settings2 className="w-4 h-4" />
        </Button>
      </div>

      {categories.map(cat => {
        // Render from the resolved catalog list so admin label/category/sortOrder
        // overrides actually surface in the palette UI, falling back to registry
        // metadata when no override exists.
        const blocks = visibleBlocks
          .filter(b => b.category === cat)
          .filter(b => matchesBlockSearch(b, search));
        if (blocks.length === 0) return null;
        const label = resolveCategoryLabel(cat, prefs);
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
            <div className="grid grid-cols-2 gap-2">
              {blocks.map(block => (
                <button
                  key={block.type}
                  onClick={() => onAdd(block.type)}
                  className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                >
                  <BlockThumbnail type={block.type} />
                  <span className="text-[11px] font-medium text-center leading-tight text-muted-foreground group-hover:text-foreground">
                    {block.label}
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {filteredCustom.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{resolveCategoryLabel("Custom", prefs)}</p>
          <div className="grid grid-cols-2 gap-2">
            {filteredCustom.map(block => (
              <button
                key={block.id}
                onClick={() => onAdd(`custom:${block.id}`)}
                className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
              >
                <CustomBlockThumbnail blockType={block.block_type} />
                <span className="text-[11px] font-medium text-center leading-tight text-muted-foreground group-hover:text-foreground">
                  {block.name}
                </span>
                <div className="absolute inset-0 flex items-center justify-center bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary text-primary-foreground rounded-full p-1">
                    <Plus className="w-3 h-3" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CORE_CATEGORIES = new Set(["Layout", "Hero", "Showcase", "Features", "Content", "Social Proof", "CTA", "Lead Capture", "Engagement", "Interactive"]);
// Catalog category (set in superadmin) that marks a block as a whole-page
// template. These render in the builder's Templates tab — never in the block
// library shelf (Segment tab) or the Insert Block dialog — so a full-page
// template can't be dropped in as a mid-page draggable block.
const FULL_PAGE_TEMPLATE_CATEGORY = "Full Page Templates";

function SegmentLibrary({ onAdd, customBlocks, segments, visibleBlocks, prefs, governance }: { onAdd: (type: string) => void; customBlocks: CustomBlock[]; segments: AudienceSegment[]; visibleBlocks: ResolvedBlockDef[]; prefs: BlockLibraryPrefs; governance: GovernanceMap }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  // Group catalog-resolved blocks by their (catalog-overriding) category, keeping
  // only non-core categories. Catalog rows can re-shelve a block by setting a
  // different category — that change is honored here.
  const segmentGroupMap = visibleBlocks.reduce((acc, block) => {
    if (CORE_CATEGORIES.has(block.category)) return acc;
    // Full-page templates live in the Templates tab only — never in this shelf.
    if (block.category === FULL_PAGE_TEMPLATE_CATEGORY) return acc;
    if (!matchesBlockSearch(block, search)) return acc;
    if (!acc[block.category]) acc[block.category] = [];
    acc[block.category].push(block);
    return acc;
  }, {} as Record<string, typeof visibleBlocks>);
  // Stable category order so DSO Practices is prominent and consistent. Any
  // extra categories not in this list (custom tenant shelves) fall through to
  // the prefs-based ordering after the preferred ones.
  const preferredOrder = ["DSO", "DSO Practices", "Grid Pieces", "Events"];
  const presentCategories = Object.keys(segmentGroupMap);
  const orderedGroupNames = [
    ...preferredOrder.filter(c => presentCategories.includes(c)),
    ...applyCategoryOrder(
      presentCategories.filter(c => !preferredOrder.includes(c)),
      prefs,
    ),
  ];
  const segmentGroupEntries = orderedGroupNames
    .filter(k => segmentGroupMap[k])
    .map(k => [k, segmentGroupMap[k]] as const);
  // Custom blocks (segment-scoped) filtered by search as well.
  const matchesCustom = (name: string) => !q || name.toLowerCase().includes(q);

  const renderBlockButton = (key: string, label: string, thumbnail: ReactNode, onClick: () => void) => (
    <button
      key={key}
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
    >
      {thumbnail}
      <span className="text-[11px] font-medium text-center leading-tight text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
      <div className="absolute inset-0 flex items-center justify-center bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-primary text-primary-foreground rounded-full p-1">
          <Plus className="w-3 h-3" />
        </div>
      </div>
    </button>
  );

  // Pre-compute custom-block sections (search-filtered) so we can render an
  // empty state when nothing matches across both built-in and custom lists.
  const knownSegmentNames = new Set(segments.map(s => s.name));
  // Task #4 — built-in catalog blocks the tenant approved for each brand
  // segment (governance.segments) surface under that segment's section here,
  // merged with the segment's custom blocks.
  const customSections = segments
    .map(seg => ({
      id: String(seg.id),
      label: seg.name,
      builtinBlocks: blocksApprovedForSegment(visibleBlocks, governance, String(seg.id))
        .filter(b => matchesBlockSearch(b, search)),
      blocks: customBlocks.filter(b => b.segment === seg.name && matchesCustom(b.name)),
    }))
    .filter(s => s.blocks.length > 0 || s.builtinBlocks.length > 0);
  const orphanedCustom = customBlocks.filter(
    b => b.segment && b.segment !== "core" && !knownSegmentNames.has(b.segment) && matchesCustom(b.name),
  );
  const hasAnyResults =
    segmentGroupEntries.length > 0 || customSections.length > 0 || orphanedCustom.length > 0;

  return (
    <div className="p-4 space-y-5">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search segment blocks…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      {!hasAnyResults && (
        <p className="text-xs text-muted-foreground text-center py-4 leading-relaxed">
          {q ? `No blocks match "${search}".` : "No segment blocks available."}
        </p>
      )}

      {/* Built-in segment blocks — grouped by category, stable order */}
      {segmentGroupEntries.map(([categoryName, blocks]) => (
        <div key={categoryName}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{resolveCategoryLabel(categoryName, prefs)}</p>
          <div className="grid grid-cols-2 gap-2">
            {blocks.map(block =>
              renderBlockButton(block.type, block.label, <BlockThumbnail type={block.type} />, () => onAdd(block.type))
            )}
          </div>
        </div>
      ))}

      {/* Per-brand-segment custom blocks */}
      {segments.length === 0 && !q && (
        <p className="text-xs text-muted-foreground text-center py-2 leading-relaxed">
          Define segments in Brand Settings to organize custom blocks here.
        </p>
      )}
      {customSections.map(sec => (
        <div key={sec.id}>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{sec.label}</p>
            <span className="text-[10px] text-muted-foreground ml-auto">{sec.builtinBlocks.length + sec.blocks.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sec.builtinBlocks.map(block =>
              renderBlockButton(block.type, block.label, <BlockThumbnail type={block.type} />, () => onAdd(block.type))
            )}
            {sec.blocks.map(block =>
              renderBlockButton(
                String(block.id),
                block.name,
                <CustomBlockThumbnail blockType={block.block_type} />,
                () => onAdd(`custom:${block.id}`)
              )
            )}
          </div>
        </div>
      ))}

      {/* Catch-all: custom blocks with legacy "segment" value or unrecognized segment name */}
      {orphanedCustom.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other</p>
          <div className="grid grid-cols-2 gap-2">
            {orphanedCustom.map(block =>
              renderBlockButton(
                String(block.id),
                block.name,
                <CustomBlockThumbnail blockType={block.block_type} />,
                () => onAdd(`custom:${block.id}`)
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockThumbnail({ type }: { type: string }) {
  const def = BLOCK_REGISTRY.find(b => b.type === type);
  return (
    <div className="w-full h-14 rounded-lg overflow-hidden">
      {def ? def.thumbnail() : (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-muted-foreground text-xs">{type}</div>
      )}
    </div>
  );
}

// The subset of GET /api/lp/templates/enriched the builder tab reads. It
// structurally satisfies TemplateGroupShape (id/featured/isGlobal/industry/
// premiumRank/fullPage/slug) so buildTemplateGroups can bucket these into the
// SAME ordered sections the marketplace uses (Featured → Your templates →
// Platform Homepage → Full page → Block → Industry).
interface EnrichedTemplate extends TemplateGroupShape {
  id: number;
  title: string;
  templateLabel: string;
  templateDescription: string;
}

function TemplateLibrary({ onSelect, onSelectBlock, onSelectDbTemplate, industry, fullPageBlocks, dbTemplates, homepageDefaultIds }: { onSelect: (templateId: string) => void; onSelectBlock: (type: string) => void; onSelectDbTemplate: (id: number) => void; industry?: string | null; fullPageBlocks: ResolvedBlockDef[]; dbTemplates: EnrichedTemplate[] | null; homepageDefaultIds: Set<number> | null }) {
  // Hide Dandy/dental built-in templates from non-dental tenants — every
  // shipped template currently contains hardcoded Dandy copy / dental
  // imagery. Dental tenants still see the full set.
  const visible =
    industry === undefined ? LP_TEMPLATES : getTemplatesForIndustry(industry);
  // Split full-page templates (their first block renders an entire standalone
  // page) from regular multi-block templates so they read as their own group.
  // Detection uses the shared isFullPageTemplate helper against each template's
  // expanded blocks, keeping the grouping aligned with FULL_PAGE_BLOCK_TYPES.
  const fullPage = visible.filter(t => isFullPageTemplate(templateToBlocks(t.id)));
  const regular = visible.filter(t => !isFullPageTemplate(templateToBlocks(t.id)));
  // Catalog blocks tagged "Full Page Templates" in superadmin join the same
  // group, de-duplicated against any hardcoded template that already maps to
  // the same first block type (e.g. business-case-*) so they don't double up.
  const hardcodedFullPageTypes = new Set(
    fullPage.map(t => templateToBlocks(t.id)[0]?.type).filter(Boolean) as string[],
  );
  const catalogFullPage = fullPageBlocks.filter(b => !hardcodedFullPageTypes.has(b.type));
  const renderTemplateButton = (t: (typeof visible)[number]) => (
    <button
      key={t.id}
      onClick={() => onSelect(t.id)}
      className="w-full text-left p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{t.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
        </div>
        {t.badge && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">{t.badge}</Badge>
        )}
      </div>
    </button>
  );
  const renderCatalogFullPageButton = (b: ResolvedBlockDef) => (
    <button
      key={b.type}
      onClick={() => onSelectBlock(b.type)}
      className="w-full text-left p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{b.label}</p>
        </div>
      </div>
    </button>
  );
  const renderDbTemplateButton = (t: EnrichedTemplate) => (
    <button
      key={`db-${t.id}`}
      onClick={() => onSelectDbTemplate(t.id)}
      className="w-full text-left p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{t.templateLabel || t.title}</p>
          {t.templateDescription && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t.templateDescription}</p>
          )}
        </div>
        {t.featured && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">Featured</Badge>
        )}
      </div>
    </button>
  );
  // The legacy hardcoded full-page built-ins + catalog full-page blocks are
  // builder-only (the marketplace never lists them), so they're always appended
  // to the "Full page templates" section — whether or not DB templates loaded.
  const legacyFullPageSection = (label: string) =>
    (fullPage.length > 0 || catalogFullPage.length > 0) ? (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        {fullPage.map(renderTemplateButton)}
        {catalogFullPage.map(renderCatalogFullPageButton)}
      </div>
    ) : null;

  // DB templates loaded: mirror the marketplace template library. Render the
  // tenant's own Featured + owned templates FIRST via the shared grouping, then
  // append the builder-only full-page built-ins into the "Full page templates"
  // section. Legacy regular built-ins are dropped here to avoid duplicating the
  // DB "Block templates" starters.
  if (Array.isArray(dbTemplates) && dbTemplates.length > 0) {
    const groups = buildTemplateGroups(dbTemplates, homepageDefaultIds);
    const hasFullPageGroup = groups.some(g => g.key === "fullPage");
    const hasLegacyFullPage = fullPage.length > 0 || catalogFullPage.length > 0;
    // Section list in marketplace order. When the DB produced no "fullPage"
    // group, splice a synthetic Full Page section into the SAME slot the group
    // would occupy (before block/industry), so builder-only full-page built-ins
    // don't drift to the very bottom of the tab.
    type Section = { kind: "db"; group: (typeof groups)[number] } | { kind: "legacyFullPage" };
    const sections: Section[] = groups.map(g => ({ kind: "db" as const, group: g }));
    if (!hasFullPageGroup && hasLegacyFullPage) {
      const idx = sections.findIndex(s => s.kind === "db" && (s.group.key === "block" || s.group.key === "industry"));
      sections.splice(idx === -1 ? sections.length : idx, 0, { kind: "legacyFullPage" });
    }
    return (
      <div className="p-4 space-y-5">
        {sections.map(s =>
          s.kind === "legacyFullPage" ? (
            <div key="__legacy-fullpage" className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full page templates</p>
              {fullPage.map(renderTemplateButton)}
              {catalogFullPage.map(renderCatalogFullPageButton)}
            </div>
          ) : (
            <div key={s.group.key} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.group.label}</p>
              {s.group.items.map(renderDbTemplateButton)}
              {s.group.key === "fullPage" && fullPage.map(renderTemplateButton)}
              {s.group.key === "fullPage" && catalogFullPage.map(renderCatalogFullPageButton)}
            </div>
          )
        )}
      </div>
    );
  }

  // Fallback (templates still loading, or none available to this workspace):
  // the original hardcoded library — regular templates + full-page section.
  if (visible.length === 0 && catalogFullPage.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
        <p className="text-xs text-muted-foreground mt-3 italic leading-relaxed">
          No built-in templates for your industry yet. Use saved templates from
          your team, or start from scratch and add blocks below.
        </p>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-5">
      {regular.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
          {regular.map(renderTemplateButton)}
        </div>
      )}
      {legacyFullPageSection("Full Page Templates")}
    </div>
  );
}

// ─── Layers Panel ─────────────────────────────────────────────────────────────

interface SortableLayerItemProps {
  block: PageBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableLayerItem({ block, index, isSelected, onSelect, onDelete }: SortableLayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const def = getBlockDef(block.type);
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors group/layer",
        isDragging && "opacity-40",
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted border border-transparent",
      )}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <span className="text-[10px] font-mono text-muted-foreground/60 w-4 shrink-0 text-right select-none">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>
          {def?.label ?? block.type}
        </p>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 p-0.5 text-muted-foreground/0 group-hover/layer:text-muted-foreground hover:!text-destructive transition-colors"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

interface LayersPanelProps {
  blocks: PageBlock[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (blocks: PageBlock[]) => void;
}

function LayersPanel({ blocks, selectedBlockId, onSelect, onDelete }: LayersPanelProps) {
  // No DndContext here: the entire BuilderEditor is wrapped in a single root
  // DndContext (Phase 2 single-root architecture) so this panel just plugs
  // into a SortableContext that shares the same sensors and drag handler.
  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center gap-2 text-muted-foreground">
        <Layers className="w-8 h-8 opacity-30" />
        <p className="text-xs">No blocks yet. Add blocks from the Blocks tab.</p>
      </div>
    );
  }

  // Use the full collected id list (top-level + nested children) so that
  // dragging a Layers row maps to the same SortableContext the canvas uses
  // and nested moves are reflected here automatically.
  return (
    <SortableContext items={collectIds(blocks)} strategy={verticalListSortingStrategy}>
      <div className="p-2 space-y-0.5">
        {blocks.map((block, i) => (
          <LayerRow
            key={block.id}
            block={block}
            index={i}
            depth={0}
            selectedBlockId={selectedBlockId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </SortableContext>
  );
}

interface LayerRowProps {
  block: PageBlock;
  index: number;
  depth: number;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function LayerRow({ block, index, depth, selectedBlockId, onSelect, onDelete }: LayerRowProps) {
  const children = block.children ?? [];
  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <SortableLayerItem
        block={block}
        index={index}
        isSelected={selectedBlockId === block.id}
        onSelect={() => onSelect(block.id)}
        onDelete={() => onDelete(block.id)}
      />
      {children.length > 0 && (
        <div className="mt-0.5 space-y-0.5 border-l border-border/60 ml-2">
          {children.map((c, ci) => (
            <LayerRow
              key={c.id}
              block={c}
              index={ci}
              depth={depth + 1}
              selectedBlockId={selectedBlockId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Insert Block Dialog ───────────────────────────────────────────────────────

interface InsertBlockDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (type: string) => void;
  customBlocks: CustomBlock[];
  visibleBlocks: ResolvedBlockDef[];
  prefs: BlockLibraryPrefs;
  /** When true, hide blocks that are not allowed as nested children
   *  (chrome blocks like nav-header/footer/popup/sticky-bar). */
  nestedTarget?: boolean;
  /** Seeds the search box when the dialog opens — used by the conversion-score
   *  "add the missing block" deep link (?addBlock=<search>). */
  initialSearch?: string;
}

function InsertBlockDialog({ open, onClose, onInsert, customBlocks, visibleBlocks, prefs, nestedTarget, initialSearch }: InsertBlockDialogProps) {
  const defaultCategories = ["Layout", "Hero", "Showcase", "Features", "Content", "Social Proof", "CTA", "Lead Capture", "Engagement", "Interactive", "Grid Pieces", "DSO", "DSO Practices", "Events"] as const;
  // Append any extra categories that exist in the (prefs-applied) catalog but
  // aren't in the default list, then sort the whole thing per tenant prefs.
  // Full-page templates are intentionally excluded — they belong in the
  // Templates tab, not the mid-page Insert Block dialog.
  const seen = new Set<string>([...defaultCategories, FULL_PAGE_TEMPLATE_CATEGORY]);
  const extras = visibleBlocks.map(b => b.category).filter(c => !seen.has(c));
  for (const c of extras) seen.add(c);
  const categories = applyCategoryOrder([...defaultCategories, ...new Set(extras)], prefs);
  const [search, setSearch] = useState("");
  useEffect(() => { if (open) setSearch(initialSearch ?? ""); }, [open, initialSearch]);
  const filteredCustom = search.trim()
    ? customBlocks.filter(b => b.name.toLowerCase().includes(search.trim().toLowerCase()))
    : customBlocks;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" />
            Insert Block
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="h-8 pl-7 text-xs"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1 space-y-5 pr-1">
          {categories.map(cat => {
            // Render from catalog-resolved entries so admin label/category/sortOrder
            // overrides are reflected in the dialog (registry is the data source for
            // the thumbnail only).
            const catBlocks = visibleBlocks
              .filter(b => b.category === cat)
              .filter(b => {
                if (!nestedTarget) return true;
                const reg = BLOCK_REGISTRY.find(r => r.type === b.type);
                return reg ? isAllowedAsChild(reg) : true;
              })
              .filter(b => matchesBlockSearch(b, search));
            if (catBlocks.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{resolveCategoryLabel(cat, prefs)}</p>
                <div className="grid grid-cols-3 gap-2">
                  {catBlocks.map(block => {
                    const reg = BLOCK_REGISTRY.find(r => r.type === block.type);
                    return (
                      <button
                        key={block.type}
                        onClick={() => onInsert(block.type)}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                      >
                        <div className="w-full h-10 rounded-md overflow-hidden">
                          {reg ? reg.thumbnail() : <div className="w-full h-full bg-slate-100" />}
                        </div>
                        <span className="text-[10px] font-medium leading-tight text-muted-foreground">{block.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredCustom.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{resolveCategoryLabel("Custom", prefs)}</p>
              <div className="grid grid-cols-3 gap-2">
                {filteredCustom.map(block => (
                  <button
                    key={block.id}
                    onClick={() => onInsert(`custom:${block.id}`)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                  >
                    <div className="w-full h-10 rounded-md overflow-hidden bg-muted/50 flex items-center justify-center">
                      {block.block_type === "rich-text" ? (
                        <Type className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <Code2 className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight text-muted-foreground">{block.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Insertion Bar (between blocks) ───────────────────────────────────────────

function InsertionBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative h-3 flex items-center justify-center z-[80]">
      <div className="absolute inset-x-0 h-px bg-transparent group-hover:bg-primary/30 transition-colors" />
      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        className="relative opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-md hover:scale-105 active:scale-95"
      >
        <Plus className="w-2.5 h-2.5" />
        Insert
      </button>
    </div>
  );
}

function highlightCss(css: string): string {
  if (!css) return "";
  const slots: string[] = [];
  const protect = (html: string) => {
    const key = `\x00${slots.length}\x00`;
    slots.push(html);
    return key;
  };
  let s = css.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, (_, m) => protect(`<span style="color:#6a9955">${m}</span>`));
  s = s.replace(/([.#*]?[\w-]+)(?=\s*\{)/g, (_, m) => protect(`<span style="color:#569cd6">${m}</span>`));
  s = s.replace(/\{/g, () => protect(`<span style="color:#d4d4d4">{</span>`));
  s = s.replace(/\}/g, () => protect(`<span style="color:#d4d4d4">}</span>`));
  s = s.replace(/([\w-]+)(?=\s*:)/g, (_, m) => protect(`<span style="color:#9cdcfe">${m}</span>`));
  s = s.replace(/:\s*((?:#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|[\w-.]+(?:\([\s\S]*?\))?|"[^"]*"|'[^']*'))/g,
    (_, val) => `: ${protect(`<span style="color:#ce9178">${val}</span>`)}`);
  return s.replace(/\x00(\d+)\x00/g, (_, i) => slots[parseInt(i)]);
}

/**
 * Per-page colour overrides for the linked form rendered inside the
 * EmailCaptureModal (triggered by Inside-Dandy CTAs and any other CTA wired
 * to the page's email-capture popup). Persisted on `pageVariables` under the
 * reserved `__linkedFormStyle` key so we don't need a DB migration.
 */
function LinkedFormStylePanel({
  variables,
  onChange,
}: {
  variables: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = readLinkedFormStyle(variables);
  const hasAny = current !== null;

  const update = (patch: Partial<LinkedFormStyle>) => {
    const next: LinkedFormStyle = { ...(current ?? {}), ...patch };
    // Treat empty strings as "clear" so the colour picker's reset
    // re-falls-back to the brand defaults inside BlockForm.
    (Object.keys(patch) as (keyof LinkedFormStyle)[]).forEach(k => {
      if (!patch[k]) delete next[k];
    });
    onChange(writeLinkedFormStyle(variables, next));
  };

  const clearAll = () => {
    const stripped: Record<string, string> = {};
    for (const [k, v] of Object.entries(variables)) {
      if (k !== LINKED_FORM_STYLE_KEY) stripped[k] = v;
    }
    onChange(stripped);
  };

  const Row = ({ label, value, onValue, fallback }: { label: string; value: string | undefined; onValue: (v: string) => void; fallback: string }) => (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="color"
          value={value || fallback}
          onChange={e => onValue(e.target.value)}
          className="h-7 w-10 p-0.5 cursor-pointer"
        />
        {value && (
          <button
            type="button"
            onClick={() => onValue("")}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            title="Reset to brand default"
          >
            reset
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="border-t border-border shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Linked Form Colours</span>
          {hasAny && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>
        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Overrides the colours of the linked form shown in the email-capture popup on this page. Leave any colour empty to inherit the brand default.
          </p>
          <Row label="Card background" value={current?.cardBg} onValue={v => update({ cardBg: v })} fallback="#ffffff" />
          <Row label="Text" value={current?.text} onValue={v => update({ text: v })} fallback="#0f172a" />
          <Row label="Input border" value={current?.border} onValue={v => update({ border: v })} fallback="#003a30" />
          <Row label="Button background" value={current?.button} onValue={v => update({ button: v })} fallback="#c7e738" />
          <Row label="Button text" value={current?.buttonText} onValue={v => update({ buttonText: v })} fallback="#003a30" />
          {hasAny && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear all overrides
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CustomCssPanel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineCount = value ? value.split("\n").length : 0;
  const charCount = value.length;

  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="border-t border-border shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom CSS</span>
          {value && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>
        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          <div className="relative rounded-lg border border-border overflow-hidden" style={{ background: "#1e1e1e" }}>
            <pre
              ref={preRef}
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none font-mono text-xs p-2.5 overflow-auto whitespace-pre-wrap break-words leading-relaxed"
              style={{ color: "#d4d4d4", margin: 0 }}
              dangerouslySetInnerHTML={{ __html: highlightCss(value) + "\n" }}
            />
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              onScroll={syncScroll}
              rows={10}
              spellCheck={false}
              className="relative w-full font-mono text-xs p-2.5 resize-y leading-relaxed outline-none focus:ring-1 focus:ring-primary"
              style={{
                background: "transparent",
                color: "transparent",
                caretColor: "#d4d4d4",
                minHeight: "160px",
              }}
              placeholder={`.hero {\n  background: #f0f;\n}`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            {lineCount} line{lineCount !== 1 ? "s" : ""} · {charCount} char{charCount !== 1 ? "s" : ""}
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            CSS is injected into the live page when served. Save the page to persist changes.
          </p>
        </div>
      )}
    </div>
  );
}

export default function BuilderEditor() {
  const [, params] = useRoute("/builder/:pageId");
  const [, navigate] = useLocation();
  const pageId = params?.pageId ?? "";
  const { domainContext, canPublish, canReview, reviewWorkflowEnabled, user } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const tenantHost = user?.tenantHost ?? null;

  const [blocks, setBlocksRaw] = useState<PageBlock[]>([]);
  // 50-entry undo/redo. We snapshot blocks BEFORE every mutation. Loads from
  // the server bypass history (use setBlocksRaw directly).
  const historyPastRef = useRef<PageBlock[][]>([]);
  const historyFutureRef = useRef<PageBlock[][]>([]);
  const lastSnapshotAtRef = useRef<number>(0);
  const HISTORY_LIMIT = 50;
  // Coalesce rapid mutations (typing in an inspector input) into a single
  // undo snapshot. Without this, each keystroke pushes a full copy of the
  // blocks array onto the history stack — slow and gives the user one tiny
  // undo step per character. 500ms ≈ a natural pause between edits.
  const HISTORY_COALESCE_MS = 500;
  const setBlocks = useCallback<typeof setBlocksRaw>((updater) => {
    setBlocksRaw((prev) => {
      const next = typeof updater === "function"
        ? (updater as (p: PageBlock[]) => PageBlock[])(prev)
        : updater;
      if (next === prev) return prev;
      const now = Date.now();
      if (now - lastSnapshotAtRef.current > HISTORY_COALESCE_MS) {
        historyPastRef.current.push(prev);
        if (historyPastRef.current.length > HISTORY_LIMIT) historyPastRef.current.shift();
        lastSnapshotAtRef.current = now;
      }
      historyFutureRef.current = [];
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    setBlocksRaw((prev) => {
      const past = historyPastRef.current.pop();
      if (past === undefined) return prev;
      historyFutureRef.current.push(prev);
      if (historyFutureRef.current.length > HISTORY_LIMIT) historyFutureRef.current.shift();
      lastSnapshotAtRef.current = 0;
      return past;
    });
  }, []);
  const redo = useCallback(() => {
    setBlocksRaw((prev) => {
      const next = historyFutureRef.current.pop();
      if (next === undefined) return prev;
      historyPastRef.current.push(prev);
      if (historyPastRef.current.length > HISTORY_LIMIT) historyPastRef.current.shift();
      lastSnapshotAtRef.current = 0;
      return next;
    });
  }, []);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  // Mobile "Best on desktop" notice — dismissable, remembered across visits.
  const [desktopNoticeDismissed, setDesktopNoticeDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem("lp-builder-desktop-notice-dismissed") === "1"; } catch { return false; }
  });
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "pending_review" | "published">("draft");
  const [isTemplate, setIsTemplate] = useState(false);
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [customCss, setCustomCss] = useState("");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [smoothScroll, setSmoothScroll] = useState(true);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  // Task #494 — per-page robots overrides. null = inherit tenant default.
  const [allowIndexing, setAllowIndexing] = useState<boolean | null>(null);
  const [allowFollowing, setAllowFollowing] = useState<boolean | null>(null);
  const [pageVariables, setPageVariables] = useState<Record<string, string>>({});
  // Unified CTA architecture, Phase 1. Page-level default CTA (normalized
  // CtaConfig). null = no page-level CTA — every block falls straight through to
  // its own CTA / the tenant default, exactly as before this feature existed.
  const [pageCta, setPageCta] = useState<CtaConfig | null>(null);
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  // Task #1085 — true when this page is a global template (owned by the neutral
  // system tenant). Combined with superadmin + catalog mode to decide whether
  // to offer the "Preview as brand" control.
  const [isGlobalTemplate, setIsGlobalTemplate] = useState(false);
  // Task #1085 — display-only "preview as brand". `previewBrand` is the chosen
  // tenant's brand config (or null = neutral default). It is NEVER merged into
  // `brand` or any save payload — only fed to the canvas renderer.
  const [previewTenantId, setPreviewTenantId] = useState<number | null>(null);
  const [previewBrand, setPreviewBrand] = useState<BrandConfig | null>(null);
  const [previewTenants, setPreviewTenants] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [blockDefaults, setBlockDefaults] = useState<Record<string, unknown>>({});
  // Hoist a single useBlockCatalog call here and pass the resolved blocks to
  // every consumer (BlockLibrary, SegmentLibrary, InsertBlockDialog, addBlock).
  // Avoids divergent fetch states across subcomponents that previously caused
  // brief windows where the palette showed catalog labels while insertion still
  // used registry/dental defaults.
  const { blocks: allCatalogBlocks, getDef: catalogGetDef } = useBlockCatalog();
  const { prefs: libraryPrefs, save: saveLibraryPrefs, saving: librarySaving } = useTenantBlockLibraryPrefs();
  // Task #4 — tenant block governance. Layer 2 of the precedence model: a block
  // with `enabled === false` is removed from every palette below. Fail-open: an
  // empty map (no rows / failed read) leaves the catalog untouched.
  const { governanceMap } = useTenantBlockGovernance();
  const [customizeLibraryOpen, setCustomizeLibraryOpen] = useState(false);
  const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // Builder Copilot (June 2026 chatbot spec) — collapsible "Ask AI" panel.
  const [copilotOpen, setCopilotOpen] = useState(false);
  // Mobile builder: the two side panels collapse into slide-in drawers so the
  // canvas + top bar are the only things on screen at once. Desktop never reads
  // these — the panels stay always-visible columns via base (non-`max-md:`)
  // classes, so the desktop builder renders exactly as before.
  const isMobile = useIsMobile();
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  // Strict desktop parity: when the viewport grows back to md+, force both
  // drawers closed so no lingering mobile drawer state can affect desktop
  // (e.g. the Ask AI button, whose visibility reads these flags).
  useEffect(() => {
    if (!isMobile) { setMobileLeftOpen(false); setMobileRightOpen(false); }
  }, [isMobile]);
  // Task #1138 — Strict Facts review. Persistent per-page fact flags drive both
  // the review banner and the publish gate (review-not-remove: the values stay
  // on the page). `pageId` is the route param string defined just above.
  const factFlags = useFactFlags(
    pageId && !isNaN(parseInt(pageId, 10)) ? parseInt(pageId, 10) : undefined,
  );
  const [factReviewOpen, setFactReviewOpen] = useState(false);

  // Task #1026 — "catalog mode". When the superadmin opened this page from the
  // Block Catalog's "Edit visually" action, the scratch page carries __catalog*
  // page variables. In that mode the builder edits a SINGLE block whose props
  // are a global block default: we focus the single block, hide page-level
  // chrome (block library, insertion bars, publish/review/segment), and route
  // Save back to block_catalog instead of saving the scratch page.
  const catalogCtx = useMemo(() => {
    const pv = pageVariables as Record<string, string>;
    const blockType = pv?.["__catalogBlockType"];
    if (!pv?.["__catalog"] || !blockType) return null;
    return {
      blockType,
      industry: pv["__catalogIndustry"] ?? "",
      label: pv["__catalogLabel"] ?? blockType,
      category: pv["__catalogCategory"] ?? "Content",
    };
  }, [pageVariables]);
  const catalogMode = !!catalogCtx;
  // Task #1085 — "Preview as brand" (display only). Only offered to app
  // superadmins editing a brand-neutral page: a global template or a
  // block-catalog scratch page. For everyone else (normal tenant editing,
  // non-superadmins) the control never renders and `effectiveBrand` is just the
  // real tenant brand, so there is zero behaviour change.
  const isSuperadmin = (user?.appUserRole ?? null) === "superadmin";
  const showBrandPreview = isSuperadmin && (catalogMode || isGlobalTemplate);
  // The brand actually fed to the canvas renderer. `previewBrand` is only ever
  // non-null while a superadmin has an active preview selection; saves keep
  // using the real `brand`, so the persisted page stays brand-neutral.
  const effectiveBrand = (showBrandPreview && previewBrand) ? previewBrand : brand;
  // Lazy-load the tenant list the first time the control is eligible to show.
  useEffect(() => {
    if (!showBrandPreview || previewTenants.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/superadmin/tenants`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const rows = await res.json() as { id: number; name: string; slug: string }[];
        if (!cancelled && Array.isArray(rows)) {
          setPreviewTenants(
            rows
              .map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      } catch {
        /* non-fatal — control just shows no tenants */
      }
    })();
    return () => { cancelled = true; };
  }, [showBrandPreview, previewTenants.length]);
  // Resolve the chosen tenant's brand for preview. Cleared selection → neutral.
  const handlePreviewTenantChange = useCallback((value: string) => {
    if (value === "__neutral__") {
      setPreviewTenantId(null);
      setPreviewBrand(null);
      return;
    }
    const id = parseInt(value, 10);
    if (Number.isNaN(id)) return;
    setPreviewTenantId(id);
    fetchBrandConfig(null, id)
      .then((b) => setPreviewBrand(b))
      .catch(() => setPreviewBrand(null));
  }, []);
  // In catalog mode keep the single block selected — deselecting (canvas click,
  // ⌘\ shortcut, etc.) would surface the page-settings panel for a throwaway
  // scratch page, which is meaningless here.
  useEffect(() => {
    if (catalogMode && !selectedBlockId && blocks.length > 0) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [catalogMode, selectedBlockId, blocks]);
  const [strictBannerDismissed, setStrictBannerDismissed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Snapshot of the last saved page payload (JSON string). Used to derive a
  // dirty flag so the Save button can dim and show "Saved" when nothing has
  // changed (task #266 — make autosave/save behaviour clearer).
  const lastSavedSnapshotRef = useRef<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abTestModalOpen, setAbTestModalOpen] = useState(false);
  const [adCopyDialogOpen, setAdCopyDialogOpen] = useState(false);
  const [abTestName, setAbTestName] = useState("");
  const [abTestSlug, setAbTestSlug] = useState("");
  const [abTestCreating, setAbTestCreating] = useState(false);
  const [abTestError, setAbTestError] = useState<string | null>(null);

  const [blockTestModalOpen, setBlockTestModalOpen] = useState(false);
  const [blockTestTargetBlockId, setBlockTestTargetBlockId] = useState<string | null>(null);
  const [blockTestName, setBlockTestName] = useState("");
  const [blockTestSlug, setBlockTestSlug] = useState("");
  const [blockTestCreating, setBlockTestCreating] = useState(false);
  const [blockTestError, setBlockTestError] = useState<string | null>(null);

  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  // Seeds the Insert Block dialog search box when arriving from the conversion-
  // score panel's "add the missing block" deep link (?addBlock=<search>).
  const [insertInitialSearch, setInsertInitialSearch] = useState<string>("");
  // When set, the next "Insert Block" dialog confirmation drops the new block
  // into the given nested container slot instead of the page root.
  const [nestedInsertTarget, setNestedInsertTarget] = useState<
    { parentPath: BlockPath; index: number } | null
  >(null);
  const [saveToLibraryBlock, setSaveToLibraryBlock] = useState<PageBlock | null>(null);

  const { toast } = useToast();

  const handleSetAsDefault = useCallback(async (block: PageBlock) => {
    try {
      const res = await fetch(`${API_BASE}/lp/block-defaults/${block.type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ props: block.props, blockSettings: block.blockSettings ?? {} }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Failed to set default");
      }
      toast({ title: "Default saved", description: `${block.type} default updated.` });
    } catch (err) {
      toast({ title: "Couldn't set default", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  }, [toast]);

  // Content Brief state
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [appliedBrief, setAppliedBrief] = useState<{ brief: ContentBrief; company: string; objective: string } | null>(null);
  const [pageAudienceType, setPageAudienceType] = useState<string | null>(null);
  // Audience-filtered palette: hides "DSO" (leadership-only) from practice
  // pages and "DSO Practices" from leadership pages. Preserves the custom
  // getDef fallback so renderers for legacy blocks on a page keep working
  // even after the block type is filtered from the palette.
  // Task #120: gate the "Grid Pieces" category to admins / superadmins / users
  // with the `blocks` perm so ordinary editors stick to full sections. We
  // call `useAuth()` here (in addition to L941) because the memos below run
  // before the main `user` destructure further down.
  const { user: gridGateUser } = useAuth();
  const canGridPieces = canUseGridPieces(gridGateUser);
  const catalogBlocks = useMemo<ResolvedBlockDef[]>(
    () => applyGovernanceAvailability(allCatalogBlocks, governanceMap)
      .filter(b => isBlockVisibleForAudience(b.category, pageAudienceType))
      .filter(b => canGridPieces || b.category !== "Grid Pieces"),
    [allCatalogBlocks, pageAudienceType, canGridPieces, governanceMap],
  );
  // Apply tenant block-library prefs (hide / rename / re-shelve / reorder) on
  // top of the audience-filtered catalog. The unfiltered `catalogBlocks` is
  // still passed to the customize dialog so users can toggle hidden items
  // back on.
  const tenantCatalogBlocks = useMemo<ResolvedBlockDef[]>(
    () => applyBlockLibraryPrefs(catalogBlocks, libraryPrefs),
    [catalogBlocks, libraryPrefs],
  );
  // Full-page templates from the catalog (superadmin "Full Page Templates"
  // category). Sourced from the same resolved/visible list so enabled-state,
  // audience filtering and library prefs carry over; rendered in the Templates
  // tab's "Full Page Templates" group rather than the block library shelf.
  const fullPageCatalogBlocks = useMemo<ResolvedBlockDef[]>(
    () => tenantCatalogBlocks.filter(b => b.category === FULL_PAGE_TEMPLATE_CATEGORY),
    [tenantCatalogBlocks],
  );
  // Segment tab is the home for industry-specific blocks (DSO, DSO Practices,
  // Grid Pieces, Events). It intentionally skips audience gating so
  // a leadership page can still insert a "Meet the Team" block from the
  // practice category — gating only filters the core Blocks tab.
  const segmentCatalogBlocks = useMemo<ResolvedBlockDef[]>(
    () => applyBlockLibraryPrefs(
      applyGovernanceAvailability(allCatalogBlocks, governanceMap)
        .filter(b => canGridPieces || b.category !== "Grid Pieces"),
      libraryPrefs,
    ),
    [allCatalogBlocks, canGridPieces, libraryPrefs, governanceMap],
  );
  // Segment-scoped custom blocks: keep the grid-pieces perm gate (real
  // permission) but skip the audience gate (intentional, matches segment
  // catalog behavior above).
  const segmentVisibleCustomBlocks = useMemo(
    () => customBlocks.filter(cb => canGridPieces || cb.block_type !== "schema"),
    [customBlocks, canGridPieces],
  );
  // Custom blocks wrap a base block_type; gate them by that wrapped type so a
  // saved "Dandy Insights Snapshot" custom block stays hidden on practice pages.
  // Schema-driven custom blocks are also gated by the grid-pieces perm.
  const visibleCustomBlocks = useMemo(
    () => customBlocks
      .filter(cb => isBlockTypeAllowedForAudience(cb.block_type, pageAudienceType))
      .filter(cb => canGridPieces || cb.block_type !== "schema"),
    [customBlocks, pageAudienceType, canGridPieces],
  );
  // Names of every shared/global master block this page links to via its
  // `custom-schema` instances (task #201). Walks the nested block tree so
  // masters used inside containers still surface. Falls back to the stored
  // `customBlockName` (or "Master block #id") when the source row hasn't
  // loaded yet — this keeps the banner stable while customBlocks is fetching.
  const linkedMasterNames = useMemo<string[]>(() => {
    const names: string[] = [];
    const walk = (list: PageBlock[]) => {
      for (const b of list) {
        if (b.type === "custom-schema") {
          const props = b.props as { customBlockId?: number; customBlockName?: string };
          if (typeof props.customBlockId === "number") {
            const source = customBlocks.find(c => c.id === props.customBlockId);
            names.push(source?.name ?? props.customBlockName ?? `Master block #${props.customBlockId}`);
          }
        }
        if (b.children && b.children.length > 0) walk(b.children);
      }
    };
    walk(blocks);
    return names;
  }, [blocks, customBlocks]);
  const [appliedSegment, setAppliedSegment] = useState<AudienceSegment | null>(() => {
    const ctx = getBriefContext();
    if (ctx?.segmentContext) {
      return ctx.segmentContext as unknown as AudienceSegment;
    }
    return null;
  });

  useEffect(() => {
    const segCtx = appliedSegment ? {
      id: appliedSegment.id,
      name: appliedSegment.name,
      description: appliedSegment.description,
      messagingAngle: appliedSegment.messagingAngle,
      uniqueContext: appliedSegment.uniqueContext,
      valueProps: appliedSegment.valueProps,
      personas: appliedSegment.personas?.map(p => ({ role: p.role, painPoints: p.painPoints })),
      challenges: appliedSegment.challenges?.map(c => ({ title: c.title, desc: c.desc })),
    } : undefined;

    if (appliedBrief) {
      setBriefContext({
        company: appliedBrief.company,
        objective: appliedBrief.objective,
        valueProps: appliedBrief.brief.valueProps,
        toneGuidance: appliedBrief.brief.toneGuidance,
        suggestedHeadline: appliedBrief.brief.suggestedHeadline,
        segmentContext: segCtx,
      });
    } else if (appliedSegment) {
      setBriefContext({
        company: "",
        objective: "",
        valueProps: appliedSegment.valueProps ?? [],
        toneGuidance: appliedSegment.messagingAngle ?? "",
        suggestedHeadline: "",
        segmentContext: segCtx,
      });
    } else {
      setBriefContext(null);
    }
    return () => { setBriefContext(null); };
  }, [appliedBrief, appliedSegment]);

  // Collaboration state — auto-enable comment mode from URL param (?comments=1)
  const [commentMode, setCommentMode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("comments") === "1"; } catch { return false; }
  });
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const pageIdNum = parseInt(pageId, 10);

  useEffect(() => {
    if (!isNaN(pageIdNum)) trackView("page", pageIdNum);
  }, [pageIdNum]);

  // Conversion-score "add the missing block" deep link: ?addBlock=<search>
  // opens the Insert Block dialog pre-filtered to the relevant block, then
  // strips the param so a refresh/back doesn't re-open it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addBlock = params.get("addBlock");
    if (addBlock) {
      setInsertInitialSearch(addBlock);
      setInsertDialogOpen(true);
      params.delete("addBlock");
      const qs = params.toString();
      navigate(`/builder/${pageId}${qs ? `?${qs}` : ""}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { blocks: commentBlocks, addComment, resolveComment } = useComments(pageIdNum);
  const { reviews, createReview, deleteReview, deleteReviews } = useReviews(pageIdNum);
  const tenantIndustry = user?.tenantIndustry ?? null;

  // Templates tab: the tenant's own (Featured + owned) + global templates, from
  // the same enriched feed the marketplace uses, so the builder tab mirrors the
  // template library ordering. null = still loading (the tab falls back to the
  // hardcoded built-ins until this resolves). homepageDefaultIds powers the
  // "Platform Homepage templates" section (empty/failed → section skipped).
  const [dbTemplates, setDbTemplates] = useState<EnrichedTemplate[] | null>(null);
  const [templateHomepageIds, setTemplateHomepageIds] = useState<Set<number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/templates/enriched")
      .then(r => (r.ok ? (r.json() as Promise<EnrichedTemplate[]>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => { if (!cancelled) setDbTemplates(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setDbTemplates([]); });
    fetch("/api/lp/featured-templates", { cache: "no-store", credentials: "include" })
      .then(r => (r.ok ? r.json() : { templates: [] }))
      .then((data: { templates?: { id?: string }[] }) => {
        if (cancelled) return;
        const ids = new Set<number>();
        for (const t of data.templates ?? []) {
          const raw = typeof t.id === "string" ? t.id : "";
          const num = Number(raw.startsWith("global:") ? raw.slice(7) : raw);
          if (Number.isInteger(num) && num > 0) ids.add(num);
        }
        setTemplateHomepageIds(ids);
      })
      .catch(() => { if (!cancelled) setTemplateHomepageIds(new Set()); });
    return () => { cancelled = true; };
  }, []);

  const authDisplayName = user?.name || user?.email || "";
  const displayName = authDisplayName || getAuthorName() || "Builder User";
  const { viewers } = usePresence(pageIdNum, displayName);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [capturingOg, setCapturingOg] = useState(false);
  const [ogPickerOpen, setOgPickerOpen] = useState(false);
  const [inUseImages, setInUseImages] = useState<string[]>([]);
  const [inUseLoading, setInUseLoading] = useState(false);

  const openOgPicker = async () => {
    setOgPickerOpen(v => !v);
    if (inUseImages.length === 0 && !inUseLoading) {
      setInUseLoading(true);
      try {
        const res = await fetch(`${API_BASE}/lp/in-use-images`);
        const data = await res.json() as { urls?: string[] };
        setInUseImages(data.urls ?? []);
      } catch {
        // ignore
      } finally {
        setInUseLoading(false);
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    Promise.all([
      fetchPage(pageId),
      fetchBrandConfig(),
      fetch(`${API_BASE}/lp/block-defaults`).then(r => r.json() as Promise<Record<string, unknown>>).catch(() => ({})),
      fetch(`${API_BASE}/lp/custom-blocks`).then(r => r.json() as Promise<CustomBlock[]>).catch(() => []),
    ])
      .then(([p, b, defaults, customs]) => {
        if (!p || !b) {
          setError("Failed to load page or brand configuration");
          setIsLoading(false);
          return;
        }
        setTitle(p.title);
        setSlug(p.slug);
        setStatus(
          p.status === "published"
            ? "published"
            : p.status === "pending_review"
              ? "pending_review"
              : "draft",
        );
        setIsTemplate(p.isTemplate ?? false);
        setIsGlobalTemplate(p.isGlobal ?? false);
        setTemplateLabel(p.templateLabel ?? p.title);
        setTemplateDescription(p.templateDescription ?? "");
        // Server load: bypass undo history.
        const loadedTree = normalizeTree(p.blocks ?? []);
        setBlocksRaw(loadedTree);
        historyPastRef.current = [];
        historyFutureRef.current = [];
        // Task #1026 — in catalog mode the page holds exactly one block (a
        // global default being edited). Auto-select it so the property panel
        // opens immediately on the block the superadmin came to edit.
        if ((p.pageVariables as Record<string, string> | undefined)?.["__catalog"] && loadedTree[0]) {
          setSelectedBlockId(loadedTree[0].id);
        }
        setCustomCss(p.customCss ?? "");
        setAnimationsEnabled(p.animationsEnabled !== false);
        setSmoothScroll(p.smoothScroll !== false);
        setMetaTitle(p.metaTitle ?? "");
        setMetaDescription(p.metaDescription ?? "");
        setOgImage(p.ogImage ?? "");
        setAllowIndexing(p.allowIndexing ?? null);
        setAllowFollowing(p.allowFollowing ?? null);
        setPageVariables(p.pageVariables ?? {});
        setPageCta((p.ctaDefault ?? null) as CtaConfig | null);
        setBrand(b);
        setBlockDefaults(defaults);
        setCustomBlocks(customs);
        setAbTestName(p.title);
        setAbTestSlug(p.slug);
        // Restore audience/segment from saved page data (only if builder context not already set)
        if (!getBriefContext() && p.segmentId && Array.isArray(b.segments)) {
          const savedSeg = (b.segments as AudienceSegment[]).find(s => s.id === p.segmentId);
          if (savedSeg) {
            setAppliedSegment(savedSeg);
            if (!p.audienceType) setPageAudienceType(inferBuilderAudienceType(savedSeg.name));
          }
        }
        if (p.audienceType) setPageAudienceType(p.audienceType);
        // Seed the dirty-tracking baseline with what we just loaded from the
        // server so the Save button starts in the "nothing to save" state.
        try {
          const baseline = JSON.stringify({
            title: p.title,
            slug: p.slug,
            blocks: normalizeTree(p.blocks ?? []),
            status: p.status,
            customCss: p.customCss ?? "",
            metaTitle: p.metaTitle ?? "",
            metaDescription: p.metaDescription ?? "",
            ogImage: p.ogImage ?? "",
            allowIndexing: p.allowIndexing ?? null,
            allowFollowing: p.allowFollowing ?? null,
            animationsEnabled: p.animationsEnabled !== false,
            smoothScroll: p.smoothScroll !== false,
            pageVariables: p.pageVariables ?? {},
            ctaDefault: p.ctaDefault ?? null,
          });
          lastSavedSnapshotRef.current = baseline;
          setSavedSnapshot(baseline);
        } catch { /* ignore */ }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Builder load error:", err);
        setError(err instanceof Error ? err.message : "Failed to load page");
        setIsLoading(false);
      });
  }, [pageId]);

  // Task #1295 — Strict Facts banner race fix. The page-creation handoff fires a
  // best-effort fact-flags sync before navigating here, but the builder's
  // one-shot GET on mount usually wins that race and reads pendingCount=0, so the
  // banner never appears. Re-run the idempotent, regen-memory-aware sync once per
  // page load as the source of truth, then refresh the flags off the result.
  // Resolved decisions (approved/edited/swapped/removed) and trusted url-sourced
  // forms are preserved server-side, so this never resurrects resolved flags.
  const factSyncedRef = useRef<string | null>(null);
  const refreshFactFlags = factFlags.refresh;
  useEffect(() => {
    if (isLoading) return;            // wait until the page itself has loaded
    if (catalogMode) return;          // throwaway block-catalog scratch page
    const idNum = parseInt(pageId, 10);
    if (isNaN(idNum) || idNum <= 0) return; // no real persisted page to sync
    if (factSyncedRef.current === pageId) return; // run once per page load
    factSyncedRef.current = pageId;
    void (async () => {
      try {
        await syncFactFlags(pageId);
        await refreshFactFlags();
      } catch {
        /* best-effort — a sync hiccup must never block the editor */
      }
    })();
  }, [isLoading, catalogMode, pageId, refreshFactFlags]);

  const handleCreateAbTest = async () => {
    if (!abTestName.trim() || !abTestSlug.trim()) return;
    setAbTestCreating(true);
    setAbTestError(null);
    try {
      const testRes = await fetch(`${API_BASE}/lp/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: abTestName.trim(), slug: abTestSlug.trim(), testType: "ab" }),
      });
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({ error: "Failed to create test" })) as { error?: string };
        throw new Error(err.error ?? "Failed to create test");
      }
      const test = await testRes.json() as { id: number };
      const variantRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Control", isControl: true, trafficWeight: 50, builderPageId: parseInt(pageId, 10) }),
      });
      if (!variantRes.ok) {
        await fetch(`${API_BASE}/lp/tests/${test.id}`, { method: "DELETE" }).catch(() => {});
        const err = await variantRes.json().catch(() => ({ error: "Failed to create variant" })) as { error?: string };
        throw new Error(err.error ?? "Failed to create variant");
      }
      navigate(`/tests/${test.id}`);
    } catch (err) {
      setAbTestError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setAbTestCreating(false);
    }
  };

  const handleOpenBlockTestModal = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const def = getBlockDef(block.type);
    const blockLabel = def?.label ?? block.type;
    const suggestedName = `${title} — Test ${blockLabel}`;
    const suggestedSlug = slug;
    setBlockTestTargetBlockId(blockId);
    setBlockTestName(suggestedName);
    setBlockTestSlug(suggestedSlug);
    setBlockTestError(null);
    setBlockTestModalOpen(true);
  };

  const handleCreateBlockTest = async () => {
    if (!blockTestName.trim() || !blockTestSlug.trim() || !blockTestTargetBlockId) return;
    const block = blocks.find(b => b.id === blockTestTargetBlockId);
    if (!block) return;
    setBlockTestCreating(true);
    setBlockTestError(null);
    const pageIdNum = parseInt(pageId, 10);
    try {
      const testRes = await fetch(`${API_BASE}/lp/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: blockTestName.trim(), slug: blockTestSlug.trim(), testType: "ab" }),
      });
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({ error: "Failed to create test" })) as { error?: string };
        throw new Error(err.error ?? "Failed to create test");
      }
      const test = await testRes.json() as { id: number };
      const controlRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Control",
          isControl: true,
          trafficWeight: 50,
          builderPageId: pageIdNum,
          testedBlockId: blockTestTargetBlockId,
          blockOverrides: {},
          config: { headline: "Control", ctaText: "CTA" },
        }),
      });
      if (!controlRes.ok) {
        await fetch(`${API_BASE}/lp/tests/${test.id}`, { method: "DELETE" }).catch(() => {});
        const err = await controlRes.json().catch(() => ({ error: "Failed to create control variant" })) as { error?: string };
        throw new Error(err.error ?? "Failed to create control variant");
      }
      const challengerRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Challenger",
          isControl: false,
          trafficWeight: 50,
          builderPageId: pageIdNum,
          testedBlockId: blockTestTargetBlockId,
          blockOverrides: {},
          config: { headline: "Challenger", ctaText: "CTA" },
        }),
      });
      if (!challengerRes.ok) {
        await fetch(`${API_BASE}/lp/tests/${test.id}`, { method: "DELETE" }).catch(() => {});
        const err = await challengerRes.json().catch(() => ({ error: "Failed to create challenger variant" })) as { error?: string };
        throw new Error(err.error ?? "Failed to create challenger variant");
      }
      const challenger = await challengerRes.json() as { id: number };
      setBlockTestModalOpen(false);
      navigate(`/block-test-editor/${test.id}/${challenger.id}/${blockTestTargetBlockId}?pageId=${pageId}`);
    } catch (err) {
      setBlockTestError(err instanceof Error ? err.message : "Failed to create block test");
    } finally {
      setBlockTestCreating(false);
    }
  };

  // Walk the full tree (not just the root) so children of container blocks
  // (Hero overlay, BentoShowcase children, Section/Columns/Grid/Stack) can
  // be selected and edited via the property panel.
  const selectedBlock = selectedBlockId ? (findBlockById(blocks, selectedBlockId) ?? null) : null;

  const VALID_BLOCK_TYPES = new Set<string>(BLOCK_REGISTRY.map(b => b.type));
  const isBlockType = (t: string): t is BlockType => VALID_BLOCK_TYPES.has(t);

  const insertBlock = (newBlock: PageBlock, atIndex?: number) => {
    setBlocks(prev => {
      if (atIndex !== undefined) {
        const next = [...prev];
        next.splice(atIndex, 0, newBlock);
        return next;
      }
      return [...prev, newBlock];
    });
    setSelectedBlockId(newBlock.id);
  };

  const addBlock = (type: string, atIndex?: number) => {
    if (type.startsWith("custom:")) {
      const customId = Number(type.slice(7));
      const customBlock = customBlocks.find(b => b.id === customId);
      if (!customBlock) return;
      // Schema-driven custom blocks (task #120) materialize as a `custom-schema`
      // PageBlock that carries the schema/template/values from the custom block.
      if (customBlock.block_type === "schema") {
        // Schema-driven custom blocks store ONLY a reference + per-instance
        // values. Schema/template are looked up live from the source block
        // at render time (CustomBlocksContext) so existing instances pick
        // up template/schema edits automatically.
        // Task #198: new instances start with empty `values` so they FOLLOW
        // the master's shared values out of the gate. Editors override
        // individual fields explicitly via the property panel.
        const newBlock = createBlock("custom-schema");
        newBlock.props = {
          schema: [],
          template: "",
          values: {},
          customBlockId: customBlock.id,
          customBlockName: customBlock.name,
        };
        insertBlock(newBlock, atIndex);
        return;
      }
      const bt = customBlock.block_type as BlockType;
      const newBlock = {
        id: genBlockId(bt),
        type: bt,
        props: customBlock.props ?? {},
        ...(customBlock.block_settings && Object.keys(customBlock.block_settings).length > 0
          ? { blockSettings: customBlock.block_settings }
          : {}),
      } as PageBlock;
      insertBlock(newBlock, atIndex);
      return;
    }
    if (!isBlockType(type)) return;
    // Precedence: tenant-saved block default → catalog default → in-code registry default
    const savedDefault = blockDefaults[type] as { props?: unknown; blockSettings?: unknown } | undefined;
    let newBlock: PageBlock;
    if (savedDefault?.props) {
      newBlock = {
        id: genBlockId(type),
        type,
        props: savedDefault.props,
        ...(savedDefault.blockSettings && Object.keys(savedDefault.blockSettings as object).length > 0
          ? { blockSettings: savedDefault.blockSettings }
          : {}),
      } as PageBlock;
    } else {
      const catalogDef = catalogGetDef(type);
      // Use catalog defaults only when they actually override (catalog rows for this block_type)
      if (catalogDef && catalogDef.source === "catalog") {
        newBlock = {
          id: genBlockId(type),
          type,
          props: catalogDef.defaultProps(),
        } as PageBlock;
      } else {
        newBlock = createBlock(type);
      }
    }
    insertBlock(newBlock, atIndex);
  };

  const openInsertAt = (index: number) => {
    setInsertAtIndex(index);
    setInsertDialogOpen(true);
  };

  const handleInsertBlock = (type: string) => {
    if (nestedInsertTarget) {
      // Build the block via the same code path as addBlock so saved/catalog
      // defaults are honored, then insert at the nested target.
      let newBlock: PageBlock | null = null;
      if (type.startsWith("custom:")) {
        const customId = Number(type.slice(7));
        const custom = customBlocks.find(b => b.id === customId);
        if (custom) {
          if (custom.block_type === "schema") {
            // Task #198: empty values = follow master.
            const cs = createBlock("custom-schema");
            cs.props = {
              schema: [],
              template: "",
              values: {},
              customBlockId: custom.id,
              customBlockName: custom.name,
            };
            newBlock = cs;
          } else {
            const bt = custom.block_type as BlockType;
            newBlock = {
              id: genBlockId(bt),
              type: bt,
              props: custom.props ?? {},
              ...(custom.block_settings && Object.keys(custom.block_settings).length > 0
                ? { blockSettings: custom.block_settings }
                : {}),
            } as PageBlock;
          }
        }
      } else if (isBlockType(type)) {
        const savedDefault = blockDefaults[type] as { props?: unknown; blockSettings?: unknown } | undefined;
        if (savedDefault?.props) {
          newBlock = {
            id: genBlockId(type),
            type,
            props: savedDefault.props,
            ...(savedDefault.blockSettings && Object.keys(savedDefault.blockSettings as object).length > 0
              ? { blockSettings: savedDefault.blockSettings }
              : {}),
          } as PageBlock;
        } else {
          const catalogDef = catalogGetDef(type);
          newBlock = catalogDef && catalogDef.source === "catalog"
            ? ({ id: genBlockId(type), type, props: catalogDef.defaultProps() } as PageBlock)
            : createBlock(type);
        }
      }
      if (newBlock) insertBlockAt(nestedInsertTarget.parentPath, nestedInsertTarget.index, newBlock);
    } else {
      addBlock(type, insertAtIndex ?? undefined);
    }
    setInsertDialogOpen(false);
    setInsertAtIndex(null);
    setNestedInsertTarget(null);
  };

  const applyTemplate = (templateId: string) => {
    const newBlocks = templateToBlocks(templateId);
    setBlocks(newBlocks);
    setSelectedBlockId(null);
  };

  // Seed the page from a DB template (tenant-owned or global) fetched by id.
  // Mirrors the marketplace preview endpoint: pull the full block JSON, then
  // load it into the canvas through the same normalizeTree path used when
  // opening a saved page. Failures toast rather than silently no-op.
  const applyDbTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/lp/templates/${id}/preview`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { blocks?: unknown };
      const rawBlocks = Array.isArray(data.blocks) ? (data.blocks as PageBlock[]) : null;
      if (!rawBlocks || rawBlocks.length === 0) throw new Error("This template has no content.");
      setBlocks(normalizeTree(rawBlocks));
      setSelectedBlockId(null);
    } catch (err) {
      toast({
        title: "Couldn't load template",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Seed the page from a catalog full-page template: a single full-page block,
  // built via the SAME precedence the block library uses (tenant-saved block
  // default → catalog default → in-code registry default), behind the same
  // isBlockType type guard as addBlock.
  const applyFullPageBlock = (type: string) => {
    if (!isBlockType(type)) return;
    const savedDefault = blockDefaults[type] as { props?: unknown; blockSettings?: unknown } | undefined;
    let newBlock: PageBlock;
    if (savedDefault?.props) {
      newBlock = {
        id: genBlockId(type),
        type,
        props: savedDefault.props,
        ...(savedDefault.blockSettings && Object.keys(savedDefault.blockSettings as object).length > 0
          ? { blockSettings: savedDefault.blockSettings }
          : {}),
      } as PageBlock;
    } else {
      const catalogDef = catalogGetDef(type);
      newBlock = catalogDef && catalogDef.source === "catalog"
        ? ({ id: genBlockId(type), type, props: catalogDef.defaultProps() } as PageBlock)
        : createBlock(type);
    }
    setBlocks([newBlock]);
    setSelectedBlockId(null);
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => {
      const path = findPathById(prev, id);
      if (!path) return prev.filter(b => b.id !== id);
      const { tree } = removeAtPath(prev, path);
      return tree;
    });
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  // Deep-clone a block subtree, regenerating every id so the duplicate
  // doesn't collide with the original (or its nested children).
  const cloneBlockWithNewIds = (block: PageBlock): PageBlock => {
    const cloned = structuredClone(block);
    const reId = (b: PageBlock) => {
      b.id = genBlockId(b.type);
      b.children?.forEach(reId);
    };
    reId(cloned);
    return cloned;
  };

  const duplicateBlock = useCallback((id: string) => {
    const path = findPathById(blocks, id);
    if (!path) return;
    const block = getAtPath(blocks, path);
    if (!block) return;
    const cloned = cloneBlockWithNewIds(block);
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1] + 1;
    setBlocks(prev => insertAtPath(prev, parentPath, idx, cloned));
    setSelectedBlockId(cloned.id);
  }, [blocks, setBlocks]);

  const updateBlock = (updated: PageBlock) => {
    setBlocks(prev => {
      const path = findPathById(prev, updated.id);
      if (!path) return prev.map(b => b.id === updated.id ? updated : b);
      // Preserve children when prop edits don't include them.
      return setAtPath(prev, path, (cur) => ({
        ...updated,
        ...(cur.children !== undefined && updated.children === undefined
          ? { children: cur.children }
          : {}),
      }));
    });
  };

  // Insert into a specific container slot (used by the canvas insert chips
  // inside nested containers). `parentPath = []` is the page root.
  const insertBlockAt = (parentPath: BlockPath, index: number, newBlock: PageBlock) => {
    setBlocks(prev => insertAtPath(prev, parentPath, index, newBlock));
    setSelectedBlockId(newBlock.id);
  };

  // ── Builder Copilot — apply a proposed action via the REAL builder mutations
  //    (the panel never mutates blocks itself). Each of the 6 v1 action types
  //    maps to an existing mutation; the bot proposes, this confirms-and-applies.
  //    Optimistic + undoable: every mutation goes through `setBlocks`, which the
  //    existing 50-entry undo history snapshots, so Cmd-Z reverts an applied
  //    action. Top-level blocks only in v1 (matches the action arg shapes).
  const applyCopilotAction = useCallback(
    async (action: CopilotAction): Promise<ApplyActionResult> => {
      const a = action.args ?? {};
      const str = (v: unknown): string => (typeof v === "string" ? v : "");
      const indexOfId = (id: string): number => blocks.findIndex((b) => b.id === id);

      try {
        switch (action.type) {
          case "insert_block": {
            const type = str(a.type);
            if (!type || !VALID_BLOCK_TYPES.has(type)) {
              return { ok: false, message: `Unknown block type "${type}"` };
            }
            const afterId = str(a.afterBlockId);
            // afterBlockId "" → top; unknown id → append (addBlock handles
            // undefined index as append).
            const atIndex = afterId ? indexOfId(afterId) + 1 : 0;
            addBlock(type, atIndex >= 0 ? atIndex : undefined);
            return { ok: true };
          }
          case "remove_block": {
            const id = str(a.blockId);
            if (indexOfId(id) === -1) return { ok: false, message: "Block not found" };
            deleteBlock(id);
            return { ok: true };
          }
          case "reorder_block": {
            const id = str(a.blockId);
            const from = indexOfId(id);
            if (from === -1) return { ok: false, message: "Block not found" };
            const beforeId = str(a.beforeBlockId);
            setBlocks((prev) => {
              const next = [...prev];
              const [moved] = next.splice(from, 1);
              if (!moved) return prev;
              let to = beforeId ? next.findIndex((b) => b.id === beforeId) : next.length;
              if (to === -1) to = next.length;
              next.splice(to, 0, moved);
              return next;
            });
            return { ok: true };
          }
          case "fix_contrast": {
            const id = str(a.blockId);
            const idx = indexOfId(id);
            if (idx === -1) return { ok: false, message: "Block not found" };
            const block = blocks[idx];
            const props = { ...(block.props as Record<string, unknown>) };
            // Don't GUESS a text color against a fallback "white" background.
            // Many blocks (e.g. the product/brand heroes) paint a dark brand
            // surface from a component DEFAULT, not a saved `backgroundColor`
            // prop — so a naive black/white pick against an assumed-white bg
            // sets DARK text on a DARK panel (the exact bug this used to cause).
            // Instead CLEAR the explicit text-color overrides so the block's own
            // surface-aware ink resolver (resolveSectionInk) recomputes a
            // contrast-safe color against the surface it actually paints. Only
            // blocks that lack such a resolver fall back to the bg-derived pick.
            const hadOverride =
              "textColor" in props || "cardTextColor" in props || "headlineColor" in props;
            delete props.textColor;
            delete props.cardTextColor;
            delete props.headlineColor;
            if (!hadOverride) {
              const bgRaw =
                (typeof props.backgroundColor === "string" && props.backgroundColor) ||
                (typeof props.bgColor === "string" && props.bgColor) ||
                "";
              if (bgRaw) {
                props.textColor =
                  contrastRatio("#ffffff", bgRaw) >= contrastRatio("#111111", bgRaw)
                    ? "#ffffff"
                    : "#111111";
              } else {
                return { ok: false, message: "This block resolves its own contrast — nothing to override." };
              }
            }
            updateBlock({ ...block, props } as PageBlock);
            return { ok: true };
          }
          case "rewrite_copy": {
            const id = str(a.blockId);
            const idx = indexOfId(id);
            if (idx === -1) return { ok: false, message: "Block not found" };
            const field = str(a.field);
            if (!field) return { ok: false, message: "No field specified" };
            const block = blocks[idx];
            const props = block.props as Record<string, unknown>;
            const currentValue = typeof props[field] === "string" ? (props[field] as string) : "";
            const instruction = str(a.instruction);
            // Route through the SAME per-block copy endpoint the inspector uses,
            // forwarding the copilot's instruction (e.g. "address dentists, not
            // patients") so the rewrite actually follows what the user asked for.
            const updated = await refreshBlockCopy(
              block.type,
              [field],
              { [field]: currentValue },
              instruction || undefined,
            );
            const newValue = updated[field];
            if (typeof newValue !== "string" || !newValue.trim()) {
              return { ok: false, message: "Couldn't generate new copy" };
            }
            updateBlock({ ...block, props: { ...props, [field]: newValue } } as PageBlock);
            return { ok: true };
          }
          case "replace_image": {
            // v1: select the block + slot and open the media library so the user
            // picks the replacement (no autonomous image swap). Wires to the
            // existing selection + media drawer flow.
            const id = str(a.blockId);
            if (indexOfId(id) === -1) return { ok: false, message: "Block not found" };
            setSelectedBlockId(id);
            return {
              ok: true,
              message: "Selected the block — open its image field to pick a new image.",
            };
          }
          default:
            return { ok: false, message: `Unsupported action "${action.type}"` };
        }
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Could not apply" };
      }
    },
    [blocks, addBlock, deleteBlock, setBlocks, updateBlock],
  );

  // "Configure one CTA, copy it to every CTA on the page." Delegates to the
  // reusable, pure `propagateCtaToAll` util (src/lib/cta-propagation.ts), which
  // copies ONLY the canonical shared CTA-config fields (HeroCtaConfig +
  // CtaSuiteFields action/style + CtaModalConfig modal fields) — never a
  // block's own headline/body/layout. Goes through `setBlocks` so it lands in
  // the undo history (Cmd-Z reverts the whole propagation in one step). The
  // util's optional `fields: "all" | "style"` is wired for "all" here; flip to
  // "style" later for a "match styling only" affordance.
  const applyCtaToAll = useCallback(() => {
    if (!selectedBlock) return;
    if (!blockHasCta(selectedBlock.type, selectedBlock.props)) {
      // Source has no CTA — the button should be hidden/disabled, but guard.
      toast({
        title: "No CTA to copy",
        description: "Select a section that has a call-to-action first.",
        variant: "destructive",
      });
      return;
    }
    const targetCount = countCtaTargets(blocks, selectedBlock.id);
    if (targetCount === 0) {
      toast({
        title: "No other CTAs on the page",
        description: "Add another section with a call-to-action to copy this one to it.",
      });
      return;
    }
    setBlocks((prev) => propagateCtaToAll(prev, selectedBlock.id, { fields: "all" }));
    toast({
      title: "CTA applied",
      description: `Applied this CTA to ${targetCount} other section${targetCount === 1 ? "" : "s"}. Press ⌘Z to undo.`,
    });
  }, [selectedBlock, blocks, setBlocks, toast]);

  // Recursive renderers for nested children of container blocks. Defined here
  // (not in a child component) so they share the BuilderEditor closure for
  // selection state and undo-tracked mutations.
  const renderNestedChild = useCallback(
    (child: PageBlock, index: number, parentPath: BlockPath, parentLayout?: "stack" | "grid"): ReactNode => (
      <NestedChild
        key={child.id}
        child={child}
        parentPath={parentPath}
        index={index}
        brand={effectiveBrand}
        isSelected={selectedBlockId === child.id}
        onSelect={() => setSelectedBlockId(child.id)}
        onDelete={() => deleteBlock(child.id)}
        onInsertAfter={() => {
          // Open the insert dialog targeted at this nested slot.
          setNestedInsertTarget({ parentPath, index: index + 1 });
          setInsertDialogOpen(true);
        }}
        onInsertBefore={() => {
          // Top-of-container insert chip — only the first child renders this
          // (NestedChild gates on index===0 internally).
          setNestedInsertTarget({ parentPath, index: 0 });
          setInsertDialogOpen(true);
        }}
        onBlockChange={updateBlock}
        pageCta={pageCta}
        renderChild={renderNestedChild}
        renderEmptySlot={renderEmptySlot}
        renderTailSlot={renderTailSlot}
        parentLayout={parentLayout}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brand, selectedBlockId, pageCta],
  );
  const renderEmptySlot = useCallback(
    (parentPath: BlockPath, parentLayout?: "stack" | "grid"): ReactNode => (
      <EmptyContainerSlot
        parentPath={parentPath}
        parentLayout={parentLayout}
        onInsert={() => {
          setNestedInsertTarget({ parentPath, index: 0 });
          setInsertDialogOpen(true);
        }}
      />
    ),
    [],
  );
  const renderTailSlot = useCallback(
    (parentPath: BlockPath, parentLayout?: "stack" | "grid"): ReactNode => (
      <TailDropSlot parentPath={parentPath} parentLayout={parentLayout} />
    ),
    [],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks(prev => {
      const fromPath = findPathById(prev, String(active.id));
      if (!fromPath) return prev;

      const overId = String(over.id);
      // Drops onto an empty/nested container slot are encoded as
      // "container:<parentPath joined by .>"
      if (overId.startsWith("container:")) {
        const seg = overId.slice("container:".length);
        const toParent: BlockPath = seg === "" ? [] : seg.split(".").map(Number);
        // Append at the end of the destination container. For root
        // (toParent === []), getAtPath returns undefined intentionally — use
        // the top-level array length as the append index.
        const childCount =
          toParent.length === 0
            ? prev.length
            : (getAtPath(prev, toParent)?.children ?? []).length;
        return moveBlock(prev, fromPath, toParent, childCount);
      }

      // Default: dropped onto another block — insert immediately before it,
      // in its parent container.
      const toPath = findPathById(prev, overId);
      if (!toPath) return prev;
      const toParent = toPath.slice(0, -1);
      const toIndex = toPath[toPath.length - 1];
      return moveBlock(prev, fromPath, toParent, toIndex);
    });
  };

  const getPageData = (overrides: Partial<SavePageData> = {}): SavePageData => ({
    title,
    slug,
    blocks,
    status,
    customCss,
    animationsEnabled,
    smoothScroll,
    metaTitle,
    metaDescription,
    ogImage,
    allowIndexing,
    allowFollowing,
    pageVariables: Object.keys(pageVariables).length > 0 ? pageVariables : undefined,
    ctaDefault: pageCta,
    audienceType: pageAudienceType ?? (appliedSegment ? null : undefined),
    segmentId: appliedSegment?.id ?? (pageAudienceType ? null : undefined),
    ...overrides,
  });

  // Snapshot of the current editable payload, used to derive isDirty by
  // comparing to lastSavedSnapshotRef. Audience/segment fields are excluded
  // because they're persisted via their own targeted handler.
  const currentSnapshot = useMemo(() => {
    try {
      return JSON.stringify({
        title,
        slug,
        blocks,
        status,
        customCss,
        metaTitle,
        metaDescription,
        ogImage,
        allowIndexing,
        allowFollowing,
        animationsEnabled,
        smoothScroll,
        pageVariables: pageVariables ?? {},
        ctaDefault: pageCta ?? null,
      });
    } catch {
      return "";
    }
  }, [title, slug, blocks, status, customCss, metaTitle, metaDescription, ogImage, allowIndexing, allowFollowing, animationsEnabled, smoothScroll, pageVariables, pageCta]);

  const isDirty = !isLoading && currentSnapshot !== "" && currentSnapshot !== savedSnapshot;

  // Task #267 — guard against losing work when the user closes the tab, hits
  // browser back, or navigates within the app while edits are pending.
  useUnsavedChangesWarning(isDirty);

  // Centralized "the server now matches our local state" hook. Every code
  // path that successfully persists the page (manual Save, Publish, Submit
  // for Review, Approve, Reject, Save-as-Template) must call this so the
  // dirty flag/Save button correctly flip back to clean. `overrides` lets
  // status-changing flows record the snapshot for the *new* status without
  // racing React's setState (we can't read the post-setStatus value
  // synchronously here).
  const markSaved = (overrides: { status?: "draft" | "pending_review" | "published" } = {}) => {
    let snap: string;
    try {
      snap = JSON.stringify({
        title,
        slug,
        blocks,
        status: overrides.status ?? status,
        customCss,
        metaTitle,
        metaDescription,
        ogImage,
        animationsEnabled,
        smoothScroll,
        pageVariables: pageVariables ?? {},
      });
    } catch {
      snap = currentSnapshot;
    }
    lastSavedSnapshotRef.current = snap;
    setSavedSnapshot(snap);
    setLastSavedAt(Date.now());
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Task #1026 — catalog mode: persist the edited single block's props back
      // to block_catalog.default_props for (block_type, industry) instead of
      // saving the scratch page. The block's `type` is the source of truth (the
      // superadmin can't change it here), and page_variables carry the industry.
      if (catalogCtx) {
        const blk = blocks[0];
        const res = await fetch(`${API_BASE}/admin/block-catalog/default-props`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block_type: catalogCtx.blockType,
            industry: catalogCtx.industry,
            label: catalogCtx.label,
            category: catalogCtx.category,
            default_props: blk?.props ?? {},
          }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Failed to save global default");
        markSaved();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        toast({
          title: "Global default saved",
          description: `${catalogCtx.label} (${catalogCtx.industry}) updated in the Block Catalog.`,
        });
        return;
      }
      await savePage(pageId, getPageData());
      markSaved();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      toast({ title: "Saved", description: "Page saved." });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Editor reassigned (or cleared) the page's segment from the top-bar
  // popover (task #250). We update local state immediately so the badge
  // reflects the change without a reload, then persist via PUT
  // /lp/pages/:pageId — which already accepts segmentId. On failure we roll
  // back so the badge can't lie about what's saved on the server.
  const handleSegmentChange = async (nextSegmentId: string | null) => {
    const previous = appliedSegment;
    const next = nextSegmentId
      ? (brand.segments ?? []).find(s => s.id === nextSegmentId) ?? null
      : null;
    if ((previous?.id ?? null) === (next?.id ?? null)) return;
    setAppliedSegment(next);
    try {
      await savePage(pageId, getPageData({ segmentId: next?.id ?? null }));
      // Segment isn't part of the dirty snapshot, but the rest of the
      // page payload was just persisted alongside it, so refresh the
      // baseline to keep Save accurate.
      markSaved();
      toast({
        title: next ? "Segment updated" : "Segment cleared",
        description: next ? `Page is now tailored for ${next.name}.` : "This page is no longer tied to a segment.",
      });
    } catch (err) {
      setAppliedSegment(previous);
      toast({
        title: "Couldn't update segment",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      });
    }
  };

  // Central registry of builder keyboard shortcuts. The help dialog renders
  // straight from this list so adding a shortcut here automatically appears
  // there. ⌘K (CommandPalette) is intentionally NOT registered here — its
  // own hook owns it globally.
  const builderShortcuts: Shortcut[] = useMemo(() => [
    {
      id: "save",
      keys: "mod+s",
      label: "Save page",
      group: "Page",
      handler: () => { void handleSave(); },
    },
    {
      id: "undo",
      keys: "mod+z",
      label: "Undo",
      group: "Edit",
      handler: () => undo(),
    },
    {
      id: "redo",
      keys: "mod+shift+z",
      label: "Redo",
      group: "Edit",
      handler: () => redo(),
    },
    {
      id: "redo-y",
      keys: "mod+y",
      label: "Redo (alt)",
      group: "Edit",
      handler: () => redo(),
    },
    {
      id: "duplicate",
      keys: "mod+d",
      label: "Duplicate selected block",
      group: "Edit",
      handler: () => { if (selectedBlockId) duplicateBlock(selectedBlockId); },
    },
    {
      id: "deselect",
      keys: "esc",
      label: "Deselect block",
      group: "Selection",
      handler: () => setSelectedBlockId(null),
    },
    {
      id: "help",
      keys: "mod+/",
      label: "Show keyboard shortcuts",
      group: "Help",
      handler: () => setShortcutsHelpOpen(o => !o),
    },
  ], [handleSave, undo, redo, selectedBlockId, duplicateBlock]);
  useKeyboardShortcuts(builderShortcuts);

  const [showOutreachBanner, setShowOutreachBanner] = useState(false);

  // A page is a microsite when it's tied to a sales account (the microsite
  // builder tags it with `pageVariables.salesAccountId`). The post-publish
  // outreach banner only makes sense for those — regular published pages
  // have no contacts to send tracked links to.
  const isMicrosite = Boolean(pageVariables.salesAccountId);

  // Open the review modal and refresh the flags. Used both by the banner and
  // by the publish gate when the server refuses a publish (409).
  const openFactReview = () => {
    setFactReviewOpen(true);
    void factFlags.refresh();
  };

  const handlePublish = async () => {
    const isPublished = status === "published";
    const confirmMsg = isPublished
      ? "Unpublish this page? It will no longer be publicly accessible."
      : "Publish this page? It will be publicly accessible.";
    if (!confirm(confirmMsg)) return;
    const newStatus: "draft" | "published" = isPublished ? "draft" : "published";
    setIsSaving(true);
    try {
      // Publish goes through a direct PUT so we can detect the Strict Facts
      // publish gate (409 fact_flags_pending) and open the review modal instead
      // of silently failing. Unpublish never trips the gate.
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getPageData({ status: newStatus })),
      });
      if (res.status === 409) {
        const j = await res.json().catch(() => ({} as { code?: string }));
        if (j.code === "fact_flags_pending") {
          await factFlags.refresh();
          openFactReview();
          toast({
            title: "Review facts before publishing",
            description: "Approve, edit or remove the flagged facts, then publish.",
          });
          return;
        }
        throw new Error((j as { error?: string }).error ?? "Failed to update status");
      }
      if (!res.ok) throw new Error("Failed to update status");
      setStatus(newStatus);
      markSaved({ status: newStatus });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      // Microsites get the outreach banner after publishing; regular pages have
      // no sales contacts to send tracked links to.
      if (newStatus === "published" && isMicrosite) {
        setShowOutreachBanner(true);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Page-review workflow handlers (task #108) ────────────────────────────
  const handleSubmitForReview = async () => {
    if (!confirm("Submit this page for review? Reviewers will be notified.")) return;
    setIsSaving(true);
    try {
      // Save latest content first so the reviewer sees what was actually drafted.
      await savePage(pageId, getPageData());
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/submit-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `Submit failed (HTTP ${res.status})`);
      }
      const data = await res.json() as { asanaWarning?: string | null };
      setStatus("pending_review");
      markSaved({ status: "pending_review" });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      if (data.asanaWarning) {
        alert(`Submitted for review.\n\nNote: ${data.asanaWarning}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit for review");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveReview = async () => {
    if (!confirm("Approve and publish this page?")) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 409) {
        const j = await res.json().catch(() => ({} as { code?: string }));
        if (j.code === "fact_flags_pending") {
          await factFlags.refresh();
          openFactReview();
          toast({
            title: "Review facts before publishing",
            description: "Approve, edit or remove the flagged facts, then approve again.",
          });
          return;
        }
        throw new Error((j as { error?: string }).error ?? `Approve failed (HTTP ${res.status})`);
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `Approve failed (HTTP ${res.status})`);
      }
      setStatus("published");
      markSaved({ status: "published" });
      // Outreach banner is microsite-only (see handlePublish); regular pages
      // have no sales contacts to send tracked links to.
      if (isMicrosite) {
        setShowOutreachBanner(true);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectReview = async () => {
    const note = window.prompt("Reason for rejection (required, will be shared with the requester):", "");
    if (!note || !note.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: note.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `Reject failed (HTTP ${res.status})`);
      }
      setStatus("draft");
      markSaved({ status: "draft" });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    setTemplateSaving(true);
    try {
      // Save current state first so the template reflects latest content
      await savePage(pageId, getPageData());
      markSaved();
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/mark-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemplate: true, templateLabel: templateLabel.trim() || title, templateDescription: templateDescription.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save template");
      const updated = await res.json() as { isTemplate: boolean; templateLabel: string | null; templateDescription: string | null };
      setIsTemplate(updated.isTemplate);
      setTemplateLabel(updated.templateLabel ?? title);
      setTemplateDescription(updated.templateDescription ?? "");
      setShowTemplateDialog(false);
    } catch {
      alert("Failed to save as template. Please try again.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const captureOgScreenshot = async () => {
    const el = canvasRef.current;
    if (!el) return;
    setCapturingOg(true);
    try {
      const { toBlob } = await import("html-to-image");
      // Capture the canvas at current size.
      const blob = await toBlob(el, {
        // cacheBust appends ?t=… to every resource, forcing fresh cross-origin
        // re-fetches that fail CORS (dropping the imagery); keep it off.
        cacheBust: false,
        pixelRatio: 1,
        backgroundColor: "#ffffff",
        // Inlining every @font-face — especially cross-origin Google Fonts — is
        // what makes capture hang/freeze on large pages. Skip it and let text
        // fall back to a system font in the share image.
        skipFonts: true,
        // A 1×1 transparent pixel for any image html-to-image still can't fetch,
        // so one un-inlinable asset can't abort the whole capture.
        imagePlaceholder:
          "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
        filter: (node: HTMLElement) => {
          // Filter out drag handles / selection outlines that shouldn't appear in OG
          if (node.dataset?.noog === "true") return false;
          return true;
        },
      });
      if (!blob) throw new Error("Capture failed — blank result");

      // Resize to 1200×630 using an offscreen canvas
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load captured image"));
        img.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d")!;
      // Draw the top portion of the page scaled to fit 1200px wide, cropped to 630px tall
      const scale = 1200 / img.width;
      ctx.drawImage(img, 0, 0, img.width, Math.min(img.height, 630 / scale), 0, 0, 1200, Math.min(630, img.height * scale));
      // If the page is shorter than 630px at scale, fill the rest white
      if (img.height * scale < 630) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, img.height * scale, 1200, 630 - img.height * scale);
      }
      URL.revokeObjectURL(objectUrl);

      const resizedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Resize failed"))), "image/png");
      });

      // Upload via existing endpoint
      const formData = new FormData();
      formData.append("file", resizedBlob, "og-screenshot.png");
      const res = await fetch(`${API_BASE}/lp/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };

      // The upload returns a storage path — build the full serve URL
      const ogUrl = url.startsWith("http") ? url : `${window.location.origin}/api/storage${url}`;
      setOgImage(ogUrl);
      setTimeout(handleSave, 100);
    } catch (err) {
      console.error("OG capture error:", err);
      alert(err instanceof Error ? err.message : "Screenshot capture failed");
    } finally {
      setCapturingOg(false);
    }
  };

  const handleTitleBlur = () => {
    if (title.trim()) handleSave();
  };

  // Map raw custom-block rows into the live source map consumed by
  // BlockCustomSchema / CustomSchemaPanel via CustomBlocksContext. Only
  // schema-typed rows participate.
  // IMPORTANT: this hook must run unconditionally on every render, so it
  // sits ABOVE the loading / error early-returns below. Moving it after a
  // conditional return triggers React error #310 ("Rendered more hooks
  // than during the previous render") on the very first transition out of
  // the loading state — regression caught by
  // tests/grid-pieces-palette-ui.spec.ts.
  const customBlockSources: CustomBlockSource[] = useMemo(() => {
    const out: CustomBlockSource[] = [];
    for (const row of customBlocks) {
      const src = customBlockRowToSource(row);
      if (src) out.push(src);
    }
    return out;
  }, [customBlocks]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Failed to load page</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/pages">
            <Button variant="outline">Back to Pages</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CustomBlocksProvider blocks={customBlockSources}>
    <KeyboardShortcutsHelp open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} shortcuts={builderShortcuts} />
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Top Bar */}
      <BuilderTopBar
        title={title}
        titleRef={titleRef as RefObject<HTMLInputElement>}
        status={status}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        isDirty={isDirty}
        lastSavedAt={lastSavedAt}
        commentMode={commentMode}
        viewers={viewers}
        unresolvedComments={commentBlocks.reduce((sum, b) => sum + b.threads.filter(t => !t.comment.resolved).length, 0)}
        segmentName={appliedSegment?.name ?? null}
        segmentId={appliedSegment?.id ?? null}
        availableSegments={(brand.segments ?? []).map(s => ({ id: s.id, name: s.name }))}
        onSegmentChange={handleSegmentChange}
        onTitleChange={setTitle}
        onTitleBlur={handleTitleBlur}
        liveUrl={getLpPageUrl(slug, micrositeDomain, tenantHost)}
        previewUrl={getLpPreviewUrl(slug, micrositeDomain)}
        onSave={handleSave}
        onSaveAsTemplate={() => { setTemplateLabel(templateLabel || title); setShowTemplateDialog(true); }}
        onOpenAbTest={() => setAbTestModalOpen(true)}
        onOpenAdCopy={Number.isFinite(pageIdNum) ? () => setAdCopyDialogOpen(true) : undefined}
        onRewriteCopy={pageIdNum > 0 ? () => navigate(`/pages?rewrite=${pageIdNum}`) : undefined}
        onPublish={handlePublish}
        onToggleCommentMode={() => setCommentMode(prev => !prev)}
        onShareForReview={() => setShareModalOpen(true)}
        canPublish={canPublish}
        canReview={canReview}
        onSubmitForReview={handleSubmitForReview}
        onApproveReview={handleApproveReview}
        onRejectReview={handleRejectReview}
        reviewWorkflowEnabled={reviewWorkflowEnabled}
        catalogMode={catalogMode}
        catalogSaveLabel="Save default"
        onOpenBlocks={catalogMode ? undefined : () => { setMobileRightOpen(false); setMobileLeftOpen(o => !o); }}
        onOpenSettings={() => { setMobileLeftOpen(false); setMobileRightOpen(o => !o); }}
      />

      {/* Desktop-recommended notice. The page builder works on a phone, but the
          drag-and-drop editing experience is designed for a larger screen.
          Shown only on mobile (hidden at the `md` breakpoint and up), and only
          until the user dismisses it with the close button. */}
      {!desktopNoticeDismissed && (
        <div className="md:hidden mx-4 mt-2 flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Monitor className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Best on desktop
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              You can edit on your phone, but the page builder is designed for a larger screen. For the smoothest experience, open it on a computer.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setDesktopNoticeDismissed(true);
              try { localStorage.setItem("lp-builder-desktop-notice-dismissed", "1"); } catch { /* ignore */ }
            }}
            className="ml-auto -mr-1 -mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Task #1026 — catalog mode banner. Makes it unmistakable that edits here
          set a GLOBAL block default (not a page) and gives a clear way back to
          the Block Catalog tab. */}
      {catalogCtx && (
        <div className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Editing global block default — {catalogCtx.label}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                <span className="font-mono">{catalogCtx.blockType}</span> ·{" "}
                {catalogCtx.industry === "dental" ? "Dental" : "Generic B2B SaaS"}. Saving writes back to the Block Catalog
                for every tenant in this industry.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => navigate("/superadmin#catalog")}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Block Catalog</span>
          </Button>
        </div>
      )}

      {/* Task #1085 — "Preview as brand" (superadmin, brand-neutral pages only).
          Renders the canvas as a chosen tenant's brand (colors, fonts, gated
          assets). DISPLAY ONLY — never persisted; saves stay brand-neutral. */}
      {showBrandPreview && (
        <div className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-xl bg-muted/40 border border-border px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Preview as brand</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Render the canvas as a tenant would see it. Display only — your
                changes are saved brand-neutral.
              </p>
            </div>
          </div>
          <Select
            value={previewTenantId != null ? String(previewTenantId) : "__neutral__"}
            onValueChange={handlePreviewTenantChange}
          >
            <SelectTrigger className="h-8 w-[200px] text-xs shrink-0">
              <SelectValue placeholder="Neutral (default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__neutral__">Neutral (default)</SelectItem>
              {previewTenants.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Linked-blocks banner — explains that any custom-schema instance with
          a `customBlockId` follows its master; edits there flow into this page
          (task #201). Names duplicate when a master is used multiple times so
          authors see the actual instance count. */}
      {linkedMasterNames.length > 0 && (
        <div className="mx-4 mt-2 flex items-start gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
              {linkedMasterNames.length === 1
                ? "1 block on this page is linked to a shared master"
                : `${linkedMasterNames.length} blocks on this page are linked to a shared master`}
            </p>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-0.5 leading-relaxed">
              Edits to {linkedMasterNames.length === 1 ? "this master" : "these masters"} flow into this page automatically:{" "}
              <span className="font-medium">{linkedMasterNames.join(", ")}</span>
            </p>
          </div>
        </div>
      )}

      {/* Task #1138 — Strict Facts review banner. Driven by the persistent
          per-page fact flags (stats, claims, quotes the AI used that aren't in
          the approved pool). The values stay on the page — this opens the
          review modal so editors can approve, edit, swap or remove each one. */}
      {factFlags.pendingCount > 0 && !strictBannerDismissed && (
        <div data-testid="fact-review-banner" className="relative mx-4 mt-2 flex items-start gap-3 rounded-xl bg-[hsl(var(--accent-warm)/0.10)] dark:bg-[hsl(var(--accent-warm)/0.15)] border border-[hsl(var(--accent-warm)/0.30)] dark:border-[hsl(var(--accent-warm)/0.35)] px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-[hsl(var(--accent-warm)/0.18)] dark:bg-[hsl(var(--accent-warm)/0.25)] flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-[hsl(var(--accent-warm-strong))] dark:text-[hsl(var(--accent-warm))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[hsl(var(--accent-warm-strong))] dark:text-[hsl(var(--accent-warm))]">
              {factFlags.pendingCount === 1
                ? "This page won't publish until you approve 1 fact"
                : `This page won't publish until you approve ${factFlags.pendingCount} facts`}
            </p>
            <p className="text-[11px] text-[hsl(var(--accent-warm-strong))] dark:text-[hsl(var(--accent-warm))] mt-0.5 leading-relaxed">
              Your page is ready — it just can't go live yet. Approve, edit, swap or remove each flagged stat, claim or quote, then publish. Save the real ones to your library so the AI can reuse them next time.
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={openFactReview}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--accent-warm-strong))] dark:text-[hsl(var(--accent-warm))] hover:underline"
              >
                Review facts to publish
              </button>
              <Link
                href="/brand"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--accent-warm-strong))] dark:text-[hsl(var(--accent-warm))] hover:underline"
              >
                Open Brand Settings →
              </Link>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setStrictBannerDismissed(true)}
            className="text-[hsl(var(--accent-warm-strong)/0.55)] hover:text-[hsl(var(--accent-warm-strong))] dark:text-[hsl(var(--accent-warm)/0.55)] dark:hover:text-[hsl(var(--accent-warm))] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Task #1138 — Strict Facts review modal. */}
      <FactReviewModal open={factReviewOpen} onOpenChange={setFactReviewOpen} ff={factFlags} />


      {/* Post-publish outreach banner */}
      {showOutreachBanner && (
        <div className="relative mx-4 mt-2 flex items-center gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 px-5 py-3.5 animate-in slide-in-from-top-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <Mail className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Page published! Send tracked links to your contacts?</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Generate hotlinks and send personalized outreach for this microsite.</p>
          </div>
          <a
            href="/sales/draft-email"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shrink-0"
          >
            <Mail className="w-3.5 h-3.5" />
            Send Outreach
          </a>
          <button
            onClick={() => setShowOutreachBanner(false)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {Number.isFinite(pageIdNum) && (
        <AdCopyDialog
          open={adCopyDialogOpen}
          onClose={() => setAdCopyDialogOpen(false)}
          pageId={pageIdNum}
          pageTitle={title}
        />
      )}

      <Dialog open={abTestModalOpen} onOpenChange={setAbTestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              Run A/B Test on this Page
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This page will become the <strong>Control</strong> variant. Add challenger variants from the test detail page to start testing.
            </p>
            <div>
              <Label className="text-sm font-medium">Test Name</Label>
              <Input
                className="mt-1.5"
                value={abTestName}
                onChange={e => setAbTestName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium">URL Slug</Label>
              <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                <Input
                  className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                  value={abTestSlug}
                  onChange={e => setAbTestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Using the same slug as your page routes live traffic through the test seamlessly.</p>
            </div>
            {abTestError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{abTestError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbTestModalOpen(false)} disabled={abTestCreating}>Cancel</Button>
            <Button
              onClick={handleCreateAbTest}
              disabled={abTestCreating || !abTestName.trim() || !abTestSlug.trim()}
              className="gap-2"
            >
              {abTestCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              {abTestCreating ? "Creating..." : "Create Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockTestModalOpen} onOpenChange={setBlockTestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-primary" />
              Test This Block
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This creates a block-level A/B test. Visitors see the same page, but the selected block is swapped between <strong>Control</strong> (original) and <strong>Challenger</strong> (your new version).
            </p>
            <div>
              <Label className="text-sm font-medium">Test Name</Label>
              <Input
                className="mt-1.5"
                value={blockTestName}
                onChange={e => setBlockTestName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium">URL Slug</Label>
              <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                <Input
                  className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                  value={blockTestSlug}
                  onChange={e => setBlockTestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Use the same slug as your page so live traffic is automatically split.</p>
            </div>
            {blockTestError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{blockTestError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockTestModalOpen(false)} disabled={blockTestCreating}>Cancel</Button>
            <Button
              onClick={handleCreateBlockTest}
              disabled={blockTestCreating || !blockTestName.trim() || !blockTestSlug.trim()}
              className="gap-2"
            >
              {blockTestCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
              {blockTestCreating ? "Creating..." : "Create Block Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert Block Dialog */}
      <InsertBlockDialog
        open={insertDialogOpen}
        onClose={() => { setInsertDialogOpen(false); setInsertAtIndex(null); setNestedInsertTarget(null); setInsertInitialSearch(""); }}
        onInsert={handleInsertBlock}
        customBlocks={visibleCustomBlocks}
        visibleBlocks={tenantCatalogBlocks}
        prefs={libraryPrefs}
        nestedTarget={nestedInsertTarget !== null}
        initialSearch={insertInitialSearch}
      />

      <CustomizeBlockLibraryDialog
        open={customizeLibraryOpen}
        onClose={() => setCustomizeLibraryOpen(false)}
        catalogBlocks={catalogBlocks}
        prefs={libraryPrefs}
        saving={librarySaving}
        onSave={saveLibraryPrefs}
      />

      {/* Share for Review Modal */}
      <ShareReviewModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        pageId={pageIdNum}
        pageName={title}
        reviews={reviews}
        onCreateReview={createReview}
        onDeleteReview={deleteReview}
        onDeleteReviews={deleteReviews}
      />

      {/* Save as Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={open => { if (!open) setShowTemplateDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              {isTemplate ? "Update Template" : "Save as Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This page will appear in the sales team's template picker when they create a new microsite.
            </p>
            <div>
              <Label className="text-sm font-medium">Template Name</Label>
              <Input
                className="mt-1.5"
                value={templateLabel}
                onChange={e => setTemplateLabel(e.target.value)}
                placeholder="e.g. DSO Dark Enterprise Skin"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                className="mt-1.5 w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                placeholder="e.g. Dark-mode enterprise skin for large regional DSOs"
                value={templateDescription}
                onChange={e => setTemplateDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)} disabled={templateSaving}>Cancel</Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={templateSaving || !templateLabel.trim()}
              className="gap-2"
            >
              {templateSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
              {templateSaving ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save to Library Dialog */}
      <SaveToLibraryDialog
        open={saveToLibraryBlock !== null}
        block={saveToLibraryBlock}
        segments={brand.segments ?? []}
        onClose={() => setSaveToLibraryBlock(null)}
        onSaved={() => {
          setSaveToLibraryBlock(null);
          fetch(`${API_BASE}/lp/custom-blocks`)
            .then(r => r.json() as Promise<CustomBlock[]>)
            .then(setCustomBlocks)
            .catch(() => {});
          toast({ title: "Saved to Library", description: "Block is now available in the Saved Blocks section." });
        }}
      />

      {/* Content Brief Modal */}
      <ContentBriefModal
        open={briefModalOpen}
        onClose={() => setBriefModalOpen(false)}
        initialSegmentId={appliedSegment?.id ?? ""}
        onApply={(brief, company, objective, segment) => {
          setAppliedBrief({ brief, company, objective });
          if (segment) {
            setAppliedSegment(segment);
            setPageAudienceType(inferBuilderAudienceType(segment.name));
          }
          const segLabel = segment ? ` (${segment.name} segment)` : "";
          toast({ title: "Brief Applied", description: `Campaign context from "${company}"${segLabel} is now active for AI copy generation.` });
        }}
      />

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">

        {/* Mobile drawer backdrop — tap to dismiss either side panel. Hidden on
            desktop (md:) where the panels are always-visible columns. */}
        {(mobileLeftOpen || mobileRightOpen) && (
          <div
            className="fixed inset-x-0 bottom-0 top-14 z-40 bg-black/40 md:hidden"
            onClick={() => { setMobileLeftOpen(false); setMobileRightOpen(false); }}
            aria-hidden="true"
          />
        )}

        {/* Left panel: Block Library — hidden in catalog mode (task #1026):
            there's exactly one block to edit and adding/removing blocks would
            corrupt the single-block global default. */}
        {!catalogMode && (
        <aside
          className={cn(
            "w-64 border-r border-border bg-background/60 overflow-y-auto shrink-0",
            // Mobile-only: slide-in drawer over the canvas. Desktop ignores all
            // `max-md:` classes, so the column above is unchanged at md+.
            // Force a fully opaque background on mobile — the translucent
            // `bg-background/60` is fine as a desktop column but lets the page
            // canvas bleed through and makes the panel unreadable when it
            // floats over the canvas as a drawer.
            "max-md:bg-background",
            "max-md:fixed max-md:top-14 max-md:bottom-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:max-w-[85vw] max-md:shadow-xl max-md:transition-transform max-md:duration-300 max-md:ease-in-out",
            mobileLeftOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
          )}
        >
          <Tabs defaultValue="blocks">
            <div className="sticky top-0 bg-background/90 backdrop-blur border-b border-border z-10">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10">
                <TabsTrigger value="blocks" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Blocks</TabsTrigger>
                <TabsTrigger value="segment" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Segment</TabsTrigger>
                <TabsTrigger value="layers" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Layers</TabsTrigger>
                <TabsTrigger value="templates" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Templates</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="blocks" className="mt-0">
              <BlockLibrary
                onAdd={type => { addBlock(type); if (isMobile) setMobileLeftOpen(false); }}
                customBlocks={visibleCustomBlocks}
                visibleBlocks={tenantCatalogBlocks}
                prefs={libraryPrefs}
                onCustomize={() => setCustomizeLibraryOpen(true)}
              />
            </TabsContent>
            <TabsContent value="segment" className="mt-0">
              <SegmentLibrary
                onAdd={type => { addBlock(type); if (isMobile) setMobileLeftOpen(false); }}
                customBlocks={segmentVisibleCustomBlocks}
                segments={brand.segments ?? []}
                visibleBlocks={segmentCatalogBlocks}
                prefs={libraryPrefs}
                governance={governanceMap}
              />
            </TabsContent>
            <TabsContent value="layers" className="mt-0">
              <LayersPanel
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelect={id => {
                  const next = id === selectedBlockId ? null : id;
                  setSelectedBlockId(next);
                  if (isMobile && next) { setMobileLeftOpen(false); setMobileRightOpen(true); }
                }}
                onDelete={deleteBlock}
                onReorder={setBlocks}
              />
            </TabsContent>
            <TabsContent value="templates" className="mt-0">
              <TemplateLibrary
                industry={tenantIndustry}
                fullPageBlocks={fullPageCatalogBlocks}
                dbTemplates={dbTemplates}
                homepageDefaultIds={templateHomepageIds}
                onSelect={templateId => {
                  if (blocks.length === 0 || confirm("Replace current blocks with this template?")) {
                    applyTemplate(templateId);
                    if (isMobile) setMobileLeftOpen(false);
                  }
                }}
                onSelectBlock={type => {
                  if (blocks.length === 0 || confirm("Replace current blocks with this template?")) {
                    applyFullPageBlock(type);
                    if (isMobile) setMobileLeftOpen(false);
                  }
                }}
                onSelectDbTemplate={id => {
                  if (blocks.length === 0 || confirm("Replace current blocks with this template?")) {
                    void applyDbTemplate(id);
                    if (isMobile) setMobileLeftOpen(false);
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </aside>
        )}

        {/* Center: Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-muted/50" onClick={() => { if (!catalogMode) setSelectedBlockId(null); }}>
          <div className="min-h-full flex flex-col items-center py-6 px-4">
            {blocks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Start building</h3>
                <p className="text-sm text-muted-foreground max-w-xs">Add blocks from the library on the left, or pick a template to get started quickly.</p>
              </div>
            ) : (
              <div
                ref={canvasRef}
                className="w-full max-w-5xl bg-white rounded-xl overflow-hidden ring-1 ring-black/5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_40px_-8px_rgba(15,23,42,0.12)] transition-all duration-300"
                style={getBrandStyleVars(effectiveBrand)}
                data-lp-page
                data-lp-builder
              >
                <BrandFontLoader brand={effectiveBrand} />
                <style>{`
                  @keyframes marquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                  }
                  .animate-marquee { animation: marquee 40s linear infinite; }
                  .animate-marquee:hover { animation-play-state: paused; }
                `}</style>
                {getBrandButtonCss(brand) && <style>{getBrandButtonCss(brand)}</style>}
                <SortableContext items={collectIds(blocks)} strategy={verticalListSortingStrategy}>
                    {!catalogMode && <InsertionBar onClick={() => openInsertAt(0)} />}
                    {blocks.map((block, index) => (
                      <div key={block.id}>
                        <SortableCanvasBlock
                          block={block}
                          brand={effectiveBrand}
                          isSelected={selectedBlockId === block.id}
                          onSelect={() => { setSelectedBlockId(block.id); if (isMobile) { setMobileLeftOpen(false); setMobileRightOpen(true); } }}
                          onDelete={() => deleteBlock(block.id)}
                          onTestBlock={() => handleOpenBlockTestModal(block.id)}
                          onBlockChange={updateBlock}
                          onSaveToLibrary={setSaveToLibraryBlock}
                          onSetAsDefault={handleSetAsDefault}
                          commentMode={commentMode}
                          blockIndex={index}
                          blockComments={commentBlocks.find(cb => cb.blockIndex === index)}
                          onAddComment={addComment}
                          onResolveComment={resolveComment}
                          currentUserName={authDisplayName || undefined}
                          pageCta={pageCta}
                          path={[index]}
                          renderChild={renderNestedChild}
                          renderEmptySlot={renderEmptySlot}
                          renderTailSlot={renderTailSlot}
                        />
                        {!catalogMode && <InsertionBar onClick={() => openInsertAt(index + 1)} />}
                      </div>
                    ))}
                    {/* Top-level tail drop slot — lets users drop a block
                        at the very end of the page (the standard sortable
                        "before over" semantics never resolves to "after the
                        last item"). Same `container:` droppable id is
                        treated as "append" by handleDragEnd. */}
                    {!catalogMode && <TailDropSlot parentPath={[]} />}
                  </SortableContext>
              </div>
            )}
          </div>
        </main>

        {/* Right panel: Property Editor */}
        <aside
          className={cn(
            "w-72 border-l border-border bg-background/60 shrink-0 flex flex-col overflow-hidden",
            // Mobile-only: slide-in drawer from the right. Desktop ignores these.
            // Force a fully opaque background on mobile so the page canvas
            // behind the drawer can't bleed through and obscure the controls.
            "max-md:bg-background",
            "max-md:fixed max-md:top-14 max-md:bottom-0 max-md:right-0 max-md:z-50 max-md:w-80 max-md:max-w-[88vw] max-md:shadow-xl max-md:transition-transform max-md:duration-300 max-md:ease-in-out",
            mobileRightOpen ? "max-md:translate-x-0" : "max-md:translate-x-full",
          )}
        >
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {selectedBlock ? (
            <PropertyPanel
              block={selectedBlock}
              onChange={updateBlock}
              onDelete={() => deleteBlock(selectedBlock.id)}
              brandVoiceSet={!!(brand.brandName?.trim() || brand.toneOfVoice?.trim() || (brand.messagingPillars?.length ?? 0) > 0)}
              brand={brand}
              pageId={parseInt(pageId, 10) || undefined}
              pageCta={pageCta}
              /* Sales/microsite scope first: a page is a microsite when it's
                 tied to a sales account (pageVariables.salesAccountId →
                 isMicrosite). "Copy this CTA to all sections" is an ABM
                 microsite workflow, so we only surface it there for now.
                 To enable app-wide later, pass `applyCtaToAll` unconditionally. */
              onApplyCtaToAll={isMicrosite ? applyCtaToAll : undefined}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b bg-muted/30 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page</p>
                    <h3 className="font-semibold text-sm text-foreground mt-0.5">Page Settings</h3>
                  </div>
                  {parseInt(pageId, 10) > 0 && (
                    <Link href={`/analytics/pages/${parseInt(pageId, 10)}`}>
                      <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5 shrink-0">
                        <BarChart3 className="w-3.5 h-3.5" />
                        Analytics
                      </a>
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* AI Content Brief */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Content Brief</p>
                  </div>
                  {appliedBrief ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-primary truncate">{appliedBrief.company}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{appliedBrief.objective}</p>
                        </div>
                        <button
                          onClick={() => setAppliedBrief(null)}
                          className="text-[9px] text-muted-foreground hover:text-destructive px-1 shrink-0"
                          title="Remove brief context"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[10px] text-foreground leading-relaxed line-clamp-2">{appliedBrief.brief.suggestedHeadline}</p>
                      <button
                        onClick={() => setBriefModalOpen(true)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        View / update brief →
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setBriefModalOpen(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground">Generate AI Brief</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Target audience, value props &amp; copy guidance</p>
                      </div>
                    </button>
                  )}
                </div>

                {/* Page CTA (unified CTA architecture, Phase 1). Define one
                    default CTA for the whole page; sections without their own
                    CTA inherit it (tenant default < page CTA < block CTA). */}
                <div className="border-t border-border pt-3">
                  <PageCtaSection
                    value={pageCta}
                    onChange={(next) => { setPageCta(next); setTimeout(handleSave, 150); }}
                  />
                </div>

              {/* Slug */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">URL Slug</Label>
                  <div className="flex items-center gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <span className="px-2.5 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0 font-mono">/lp/</span>
                    <input
                      value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      onBlur={handleSave}
                      className="flex-1 min-w-0 px-2.5 py-2 text-xs font-mono bg-transparent outline-none"
                      placeholder="my-page-slug"
                      spellCheck={false}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Only lowercase letters, numbers, and hyphens. Changing the slug will update the live URL.</p>
                  {suggestedSlug && suggestedSlug !== slug && (
                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-blue-700 font-medium">AI suggests: <span className="font-mono">/{suggestedSlug}</span></p>
                      </div>
                      <button
                        onClick={() => { setSlug(suggestedSlug); setSuggestedSlug(null); setTimeout(handleSave, 100); }}
                        className="text-[9px] font-medium text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setSuggestedSlug(null)}
                        className="text-[9px] text-blue-400 hover:text-blue-600"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border pt-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SEO &amp; Metadata</p>
                    <AutoMetaButton
                      blocks={blocks}
                      title={title}
                      currentSlug={slug}
                      micrositeDomain={micrositeDomain}
                      audienceType={pageAudienceType}
                      segmentContext={appliedSegment ? {
                        id: appliedSegment.id,
                        name: appliedSegment.name,
                        description: appliedSegment.description,
                        messagingAngle: appliedSegment.messagingAngle,
                      } : null}
                      onGenerated={(mt, md, sugSlug, og) => {
                        setMetaTitle(mt);
                        setMetaDescription(md);
                        if (sugSlug && sugSlug !== slug) setSuggestedSlug(sugSlug);
                        if (og) setOgImage(og);
                        setTimeout(handleSave, 100);
                      }}
                    />
                  </div>
                </div>

                {/* Meta title */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Meta Title</Label>
                  <Input
                    value={metaTitle}
                    onChange={e => setMetaTitle(e.target.value)}
                    onBlur={handleSave}
                    placeholder={title || "Page title for search engines"}
                    className="text-sm"
                  />
                  <OgCharCount value={metaTitle} kind="title" />
                </div>

                {/* Meta description */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Meta Description</Label>
                  <textarea
                    value={metaDescription}
                    onChange={e => setMetaDescription(e.target.value)}
                    onBlur={handleSave}
                    placeholder="Briefly describe this page for search engine results…"
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none outline-none focus:ring-1 focus:ring-ring"
                  />
                  <OgCharCount value={metaDescription} kind="description" />
                </div>

                {/* OG Image */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">OG Image</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1.5"
                      disabled={capturingOg || blocks.length === 0}
                      onClick={captureOgScreenshot}
                    >
                      {capturingOg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      {capturingOg ? "Capturing…" : "Capture Page"}
                    </Button>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <Input
                      value={ogImage}
                      onChange={e => setOgImage(e.target.value)}
                      onBlur={handleSave}
                      placeholder="https://..."
                      className="text-sm font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 w-8 h-8"
                      title="Pick from pages in use"
                      onClick={openOgPicker}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Shown when shared on social media. Best at 1200×630px.</p>
                  <OgDimensionWarning
                    imageUrl={ogImage}
                    apiBase={API_BASE}
                    onResized={url => {
                      const full = url.startsWith("http") ? url : `${window.location.origin}${url}`;
                      setOgImage(full);
                      setTimeout(handleSave, 100);
                    }}
                  />
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Share preview</p>
                    <ShareCardPreview
                      title={metaTitle || title}
                      description={metaDescription}
                      imageUrl={ogImage}
                      domain={micrositeDomain}
                    />
                  </div>
                  {ogPickerOpen && (
                    <div className="mt-2 border border-border rounded-md bg-background overflow-hidden">
                      <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40 border-b border-border">
                        <span className="text-[11px] font-medium text-muted-foreground">Images in use across pages</span>
                        <button type="button" onClick={() => setOgPickerOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {inUseLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : inUseImages.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-4">No images found in pages yet.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1 p-1.5 max-h-48 overflow-y-auto">
                          {inUseImages.map(url => (
                            <OgInUseThumb
                              key={url}
                              url={url}
                              onPick={u => { setOgImage(u); setOgPickerOpen(false); setTimeout(handleSave, 100); }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Search engine visibility (task #494, #547) */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Search Engine Visibility</p>
                  <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                    Published pages are <span className="font-medium text-foreground">hidden from search engines &amp; AI crawlers by default</span> so they only reach the people you share the link with. Choose &ldquo;Allow indexing&rdquo; below to opt this page in. &ldquo;Use company default&rdquo; keeps the hidden default.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium text-foreground mb-1 block">Indexing</Label>
                      <select
                        value={allowIndexing === null ? "inherit" : allowIndexing ? "allow" : "deny"}
                        onChange={e => {
                          const v = e.target.value;
                          setAllowIndexing(v === "inherit" ? null : v === "allow");
                          setTimeout(handleSave, 50);
                        }}
                        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="inherit">Use company default</option>
                        <option value="allow">Allow indexing</option>
                        <option value="deny">No indexing (noindex)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-foreground mb-1 block">Link Following</Label>
                      <select
                        value={allowFollowing === null ? "inherit" : allowFollowing ? "allow" : "deny"}
                        onChange={e => {
                          const v = e.target.value;
                          setAllowFollowing(v === "inherit" ? null : v === "allow");
                          setTimeout(handleSave, 50);
                        }}
                        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="inherit">Use company default</option>
                        <option value="allow">Follow links</option>
                        <option value="deny">Don&apos;t follow links (nofollow)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Animations toggle */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Animations</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Scroll Animations</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">Fade &amp; slide blocks as visitors scroll</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={animationsEnabled}
                      onClick={() => { setAnimationsEnabled(v => !v); setTimeout(handleSave, 50); }}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
                        animationsEnabled ? "bg-[var(--brand-primary)]" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
                          animationsEnabled ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Smooth Scroll</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">Animate jumps to anchor links instead of snapping</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={smoothScroll}
                      onClick={() => { setSmoothScroll(v => !v); setTimeout(handleSave, 50); }}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
                        smoothScroll ? "bg-[var(--brand-primary)]" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
                          smoothScroll ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Performance Score Panel */}
                {!isNaN(pageIdNum) && (
                  <PerformanceScorePanel pageId={pageIdNum} blocks={blocks} meta={{ metaTitle, metaDescription, ogImage, slug }} />
                )}

                {/* SEO & GEO Score Panel */}
                <SeoGeoPanel blocks={blocks} metaTitle={metaTitle} metaDescription={metaDescription} ogImage={ogImage} slug={slug} brand={brand} />

                {/* Heatmap Panel */}
                {!isNaN(pageIdNum) && (
                  <div className="border rounded-lg p-3 mt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heatmap</p>
                    </div>
                    <HeatmapOverlay pageId={pageIdNum} />
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground text-center pt-2 pb-1">
                  Click any block in the canvas to edit its properties.
                </p>
              </div>
            </div>
          )}
          </div>
          <LinkedFormStylePanel
            variables={pageVariables}
            onChange={vars => { setPageVariables(vars); setTimeout(handleSave, 50); }}
          />
          <VariablesPanel
            blocks={blocks}
            // Hide internal/reserved keys (e.g. `__linkedFormStyle`) from the
            // user-facing variables list — they're managed by their own panels
            // (LinkedFormStylePanel above) and shouldn't be editable as raw text.
            variables={Object.fromEntries(Object.entries(pageVariables).filter(([k]) => !k.startsWith("__")))}
            onChange={visibleVars => {
              // Preserve any reserved `__`-prefixed entries written by other
              // panels — VariablesPanel only sees user-editable vars.
              const reserved: Record<string, string> = {};
              for (const [k, v] of Object.entries(pageVariables)) {
                if (k.startsWith("__")) reserved[k] = v;
              }
              setPageVariables({ ...reserved, ...visibleVars });
            }}
          />
          <CustomCssPanel value={customCss} onChange={setCustomCss} />
        </aside>

        {/* Builder Copilot — collapsible "Ask AI" panel (chatbot spec, Bot 1).
            Page-scoped: needs a numeric page id. Hidden in catalog mode (no
            page to reason about). */}
        {!catalogMode && pageIdNum > 0 && (
          <CopilotPanel
            open={copilotOpen}
            onClose={() => setCopilotOpen(false)}
            pageId={pageIdNum}
            getLiveBlocks={() => blocks}
            getTitle={() => title}
            onApplyAction={applyCopilotAction}
          />
        )}
      </div>

      {/* Copilot launcher — floating "✦ Ask AI" button (hidden while the panel
          is open or in catalog mode). */}
      {!catalogMode && pageIdNum > 0 && !copilotOpen && !mobileLeftOpen && !mobileRightOpen && (
        <button
          onClick={() => setCopilotOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium shadow-lg hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none motion-safe:transition"
          aria-label="Open Builder Copilot"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
          Ask AI
        </button>
      )}
    </div>
    </DndContext>
    </CustomBlocksProvider>
  );
}

// ── Variables Panel ──────────────────────────────────────────────────────────

function extractVariableTokens(blocks: PageBlock[]): string[] {
  const found = new Set<string>();
  const TOKEN_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const scan = (val: unknown) => {
    if (typeof val === "string") {
      let m;
      while ((m = TOKEN_RE.exec(val)) !== null) {
        found.add(m[1]);
      }
    } else if (Array.isArray(val)) {
      val.forEach(scan);
    } else if (val && typeof val === "object") {
      Object.values(val as Record<string, unknown>).forEach(scan);
    }
  };
  blocks.forEach(b => scan(b.props));
  return Array.from(found).sort();
}

const KNOWN_MICROSITE_VARS: Record<string, string> = {
  company_name: "Company Name",
  practice_count: "Practice Count",
};

function VariablesPanel({
  blocks,
  variables,
  onChange,
}: {
  blocks: PageBlock[];
  variables: Record<string, string>;
  onChange: (vars: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const tokens = extractVariableTokens(blocks);

  if (tokens.length === 0) return null;

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Variable className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page Variables</span>
          {tokens.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {tokens.length}
            </span>
          )}
        </div>
        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            These tokens appear in your block copy. Set values here to resolve them at render and publish time.
          </p>
          {tokens.map(token => (
            <div key={token}>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">
                {`{${token}}`}
                {KNOWN_MICROSITE_VARS[token] && (
                  <span className="ml-1 text-[9px] text-primary/70 non-mono">{KNOWN_MICROSITE_VARS[token]}</span>
                )}
              </label>
              <Input
                value={variables[token] ?? ""}
                onChange={e => onChange({ ...variables, [token]: e.target.value })}
                placeholder={KNOWN_MICROSITE_VARS[token] ?? token}
                className="text-xs h-8 font-mono"
              />
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Variable values are saved with the page and applied when the page is served or previewed.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Auto-fill Meta Tags ──────────────────────────────────────────────────

function AutoMetaButton({
  blocks,
  title,
  currentSlug,
  micrositeDomain,
  audienceType,
  segmentContext,
  onGenerated,
}: {
  blocks: PageBlock[];
  title: string;
  currentSlug: string;
  micrositeDomain?: string | null;
  audienceType?: string | null;
  segmentContext?: Record<string, unknown> | null;
  onGenerated: (metaTitle: string, metaDescription: string, suggestedSlug: string, ogImage: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantHost = user?.tenantHost ?? null;

  const handleAutoFill = async () => {
    setLoading(true);
    try {
      // Thread the active brief so the meta description anchors on the
      // brief's valueProps/audience, not just brand-level keywords.
      const { getBriefContext } = await import("@/lib/brief-context");
      const briefContext = getBriefContext() ?? undefined;

      const res = await fetch("/api/lp/seo-meta-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, title, currentSlug, audienceType, segmentContext, briefContext }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json() as { metaTitle: string; metaDescription: string; suggestedSlug: string };

      // The AI returns blanks if it produces no usable content. Surface that
      // instead of silently "succeeding" with empty fields — this is exactly
      // how the regression looked to users ("button does nothing").
      if (!data.metaTitle && !data.metaDescription) {
        toast({ title: "Couldn't auto-fill", description: "The AI didn't return any metadata. Please try again.", variant: "destructive" });
        return;
      }

      // Generate OG screenshot URL from the live page
      const pageSlug = data.suggestedSlug || currentSlug;
      const pageUrl = getLpPageUrl(pageSlug, micrositeDomain, tenantHost);
      const ogScreenshot = `https://image.thum.io/get/width/1200/crop/630/noanimate/${pageUrl}`;

      onGenerated(data.metaTitle, data.metaDescription, data.suggestedSlug, ogScreenshot);
    } catch {
      toast({ title: "Couldn't auto-fill", description: "Something went wrong generating SEO metadata. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAutoFill}
      disabled={loading || blocks.length === 0}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
        "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20",
        (loading || blocks.length === 0) && "opacity-50 cursor-not-allowed"
      )}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      Auto-fill all
    </button>
  );
}

// ── SEO & GEO Scoring Panel ──────────────────────────────────────────────

function ScoreRing({ score, size = 48, strokeWidth = 4 }: { score: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-border" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className={scoreRingColor(score)} />
    </svg>
  );
}

function SeoGeoPanel({
  blocks,
  metaTitle,
  metaDescription,
  ogImage,
  slug,
  brand,
}: {
  blocks: PageBlock[];
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  slug: string;
  brand: BrandConfig;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const score = scorePageSeoGeo(blocks, { metaTitle, metaDescription, ogImage, slug });

  const handleDeepAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/lp/seo-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, metaTitle, metaDescription, slug, brandName: brand.brandName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error((err as { error?: string }).error ?? "Analysis failed");
      }
      const data = await res.json() as { suggestions: AiSuggestion[] };
      setAiSuggestions(data.suggestions);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setAiLoading(false);
    }
  };

  const failedChecks = score.checks.filter((c) => !c.passed);
  const passedChecks = score.checks.filter((c) => c.passed);

  return (
    <div className="border-t border-border pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left group"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SEO & GEO Score</p>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* Collapsed: score summary */}
      {!expanded && (
        <div className="flex items-center gap-3 mt-3">
          <div className="relative w-12 h-12">
            <ScoreRing score={score.overallScore} />
            <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", scoreColor(score.overallScore))}>
              {score.overallScore}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge className={cn("text-[10px] px-1.5 py-0 font-bold border", gradeBgColor(score.grade))}>{score.grade}</Badge>
              <span className="text-[10px] text-muted-foreground">
                SEO {score.seoScore} · GEO {score.geoScore}
              </span>
            </div>
            {failedChecks.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {failedChecks.length} improvement{failedChecks.length !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        </div>
      )}

      {/* Expanded: full breakdown */}
      {expanded && (
        <div className="mt-3 space-y-4">
          {/* Score rings row */}
          <div className="flex items-center justify-around">
            {[
              { label: "Overall", value: score.overallScore, grade: score.grade },
              { label: "SEO", value: score.seoScore },
              { label: "GEO", value: score.geoScore },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <div className="relative w-11 h-11">
                  <ScoreRing score={s.value} size={44} strokeWidth={3.5} />
                  <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-bold", scoreColor(s.value))}>
                    {s.value}
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Issues */}
          {failedChecks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Issues</p>
              <div className="space-y-1.5">
                {failedChecks.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100">
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-medium text-foreground leading-tight">{c.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{c.tip}</p>
                    </div>
                    <Badge className="ml-auto text-[8px] px-1 py-0 border shrink-0" variant="outline">{c.category.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passed */}
          {passedChecks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Passed ({passedChecks.length})</p>
              <div className="space-y-1">
                {passedChecks.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-2 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Deep Analysis */}
          <div className="border-t border-border pt-3">
            <button
              onClick={handleDeepAnalysis}
              disabled={aiLoading}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                "bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-200 text-violet-700 hover:from-violet-500/20 hover:to-blue-500/20",
                aiLoading && "opacity-60 cursor-not-allowed"
              )}
            >
              {aiLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analyzing…</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5" />AI Deep Analysis</>
              )}
            </button>

            {aiError && (
              <p className="text-[10px] text-red-500 mt-2">{aiError}</p>
            )}

            {aiSuggestions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {aiSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded-lg border",
                      s.priority === "high" ? "bg-red-50/50 border-red-100" :
                      s.priority === "medium" ? "bg-yellow-50/50 border-yellow-100" :
                      "bg-blue-50/50 border-blue-100"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={cn(
                          "text-[8px] px-1 py-0 border font-medium",
                          s.category === "seo" ? "text-blue-600 border-blue-200 bg-blue-50" :
                          s.category === "geo" ? "text-violet-600 border-violet-200 bg-violet-50" :
                          "text-green-600 border-green-200 bg-green-50"
                        )}
                      >
                        {s.category.toUpperCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px] px-1 py-0",
                          s.priority === "high" ? "text-red-500" : s.priority === "medium" ? "text-yellow-600" : "text-blue-500"
                        )}
                      >
                        {s.priority}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-medium text-foreground mt-1 leading-tight">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{s.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Canvas Block ─────────────────────────────────────────────────────────

class BuilderBlockErrorBoundary extends Component<{ children: ReactNode; blockType: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; blockType: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(`[BuilderBlockErrorBoundary] block "${this.props.blockType}" render error:`, err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full py-10 flex items-center justify-center bg-destructive/5 border border-destructive/20 rounded">
          <p className="text-xs text-destructive/70 font-mono">Block &quot;{this.props.blockType}&quot; failed to render — check props in the panel.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SortableCanvasBlockProps {
  block: PageBlock;
  brand: BrandConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTestBlock: () => void;
  onBlockChange: (updated: PageBlock) => void;
  onSaveToLibrary: (block: PageBlock) => void;
  onSetAsDefault: (block: PageBlock) => void;
  commentMode: boolean;
  blockIndex: number;
  blockComments: BlockComments | undefined;
  onAddComment: (params: { blockIndex: number; authorName: string; message: string; parentId?: number }) => Promise<void>;
  onResolveComment: (commentId: number) => Promise<void>;
  currentUserName?: string;
  /** Page-level default CTA, threaded so the canvas preview shows each block's
   *  PRIMARY button following the Page CTA (matching the published page). */
  pageCta?: CtaConfig | null;
  /** Path of THIS block within the page tree (top-level paths are `[index]`). */
  path?: BlockPath;
  /** Recursive child renderer (BuilderEditor closure). */
  renderChild?: (c: PageBlock, i: number, parentPath: BlockPath) => ReactNode;
  renderTailSlot?: (parentPath: BlockPath) => ReactNode;
  /** Empty-container droppable renderer (BuilderEditor closure). */
  renderEmptySlot?: (parentPath: BlockPath) => ReactNode;
}

function SortableCanvasBlockInner({ block, brand, isSelected, onSelect, onDelete, onTestBlock, onBlockChange, onSaveToLibrary, onSetAsDefault, commentMode, blockIndex, blockComments, onAddComment, onResolveComment, currentUserName, pageCta, path, renderChild, renderEmptySlot, renderTailSlot }: SortableCanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { toast } = useToast();
  const [refreshingCopy, setRefreshingCopy] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  const blockCopyFields = COPY_FIELDS[block.type];
  const hasCopyFields = Array.isArray(blockCopyFields) && blockCopyFields.length > 0;

  const handleRefreshCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCopyFields || refreshingCopy) return;
    setRefreshingCopy(true);
    try {
      if (block.type === "zigzag-features") {
        type ZigRow = { headline: string; body: string; [key: string]: unknown };
        const propsAny = block.props as unknown as { rows?: ZigRow[]; headline?: string; subheadline?: string };
        const rows = (propsAny.rows ?? []) as ZigRow[];
        const [topUpdated, updatedRows] = await Promise.all([
          (propsAny.headline || propsAny.subheadline)
            ? refreshBlockCopy("zigzag-features", ["headline", "subheadline"], {
                headline: typeof propsAny.headline === "string" ? propsAny.headline : "",
                subheadline: typeof propsAny.subheadline === "string" ? propsAny.subheadline : "",
              })
            : Promise.resolve({} as Record<string, string>),
          Promise.all(
            rows.map(async (row) => {
              const updated = await refreshBlockCopy("zigzag-features", ["headline", "body"], {
                headline: typeof row.headline === "string" ? row.headline : "",
                body: typeof row.body === "string" ? row.body : "",
              });
              return { ...row, ...updated };
            }),
          ),
        ]);
        onBlockChange({ ...block, props: { ...block.props, ...topUpdated, rows: updatedRows } } as unknown as PageBlock);
      } else if (block.type === "dandy-switchback" || block.type === "dandy-vertical-tabs") {
        const isSwitchback = block.type === "dandy-switchback";
        type Item = { title: string; description: string; [key: string]: unknown };
        const propsAny = block.props as unknown as { headline?: string; subheadline?: string; eyebrow?: string; items?: Item[]; tabs?: Item[] };
        const items = (isSwitchback ? propsAny.items : propsAny.tabs) ?? [];
        const topFields = isSwitchback ? ["eyebrow", "headline", "subheadline"] : ["headline", "subheadline"];
        const topValues: Record<string, string> = {};
        for (const f of topFields) topValues[f] = String((propsAny as Record<string, unknown>)[f] ?? "");
        const [topUpdated, updatedItems] = await Promise.all([
          refreshBlockCopy(block.type, topFields, topValues),
          Promise.all(
            items.map(async (item) => {
              const updated = await refreshBlockCopy(block.type, ["title", "description"], {
                title: typeof item.title === "string" ? item.title : "",
                description: typeof item.description === "string" ? item.description : "",
              });
              return { ...item, ...updated };
            }),
          ),
        ]);
        const collectionKey = isSwitchback ? "items" : "tabs";
        onBlockChange({ ...block, props: { ...block.props, ...topUpdated, [collectionKey]: updatedItems } } as unknown as PageBlock);
      } else {
        const currentValues: Record<string, string> = {};
        for (const f of blockCopyFields!) {
          const v = (block.props as Record<string, unknown>)[f];
          if (typeof v === "string") currentValues[f] = v;
        }
        const updated = await refreshBlockCopy(block.type, blockCopyFields!, currentValues);
        if (Object.keys(updated).length > 0) {
          onBlockChange({ ...block, props: { ...block.props, ...updated } } as PageBlock);
        }
      }
    } catch (err) {
      toast({
        title: "Couldn't refresh copy",
        description: err instanceof Error ? err.message : "AI copy generation failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshingCopy(false);
    }
  };

  const isRichTextBlock = block.type === "rich-text";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      className={cn(
        "relative group",
        isDragging && "opacity-50 z-50",
      )}
    >
      {/* Selection / hover outline */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none z-[60] border-2 transition-colors",
          isSelected ? "border-primary" : "border-transparent group-hover:border-primary/30"
        )}
      />

      {/* Controls overlay */}
      <div className={cn(
        "absolute top-2 right-2 z-[70] flex items-center gap-1 transition-opacity",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-primary"
          onClick={e => { e.stopPropagation(); onTestBlock(); }}
          title="Test this block"
        >
          <TestTube2 className="w-3.5 h-3.5" />
        </button>
        {hasCopyFields && (
          <button
            className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-primary disabled:opacity-50"
            onClick={handleRefreshCopy}
            title="Refresh copy with AI"
            disabled={refreshingCopy}
          >
            {refreshingCopy
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-primary"
          onClick={e => { e.stopPropagation(); onSaveToLibrary(block); }}
          title="Save to Library"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-amber-500 disabled:opacity-50"
          onClick={async e => { e.stopPropagation(); if (settingDefault) return; setSettingDefault(true); try { await onSetAsDefault(block); } finally { setSettingDefault(false); } }}
          title="Set as Default"
          disabled={settingDefault}
        >
          {settingDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
        </button>
        <button
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-red-500"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Always-on comment dot — visible outside of comment mode when there are open threads */}
      {!commentMode && (blockComments?.threads.filter(t => !t.comment.resolved).length ?? 0) > 0 && (
        <button
          className="absolute right-3 top-3 z-[80] flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow-md hover:bg-amber-600 transition-colors"
          onClick={e => { e.stopPropagation(); }}
          title={`${blockComments!.threads.filter(t => !t.comment.resolved).length} open comment(s) — click Comments to review`}
        >
          <MessageSquare className="w-3 h-3" />
          {blockComments!.threads.filter(t => !t.comment.resolved).length}
        </button>
      )}

      {/* Comment badge (visible when comment mode is on) */}
      {commentMode && (
        <div className="absolute right-3 top-3 z-[80]">
          <Popover>
            <PopoverTrigger asChild>
              <div>
                <CommentBadge
                  count={blockComments?.threads.filter(t => !t.comment.resolved).length ?? 0}
                  onClick={() => {}}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent side="left" className="w-auto p-0 border-0 shadow-none bg-transparent" align="start">
              <CommentsPanel
                blockComments={blockComments}
                blockIndex={blockIndex}
                onAddComment={onAddComment}
                onResolve={onResolveComment}
                currentUserName={currentUserName}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Rich-text: show Tiptap inline when selected */}
      {isRichTextBlock && isSelected ? (
        <div className="relative" onClick={e => e.stopPropagation()}>
          <div className="bg-white">
            <div className="px-8 py-6">
              <TiptapEditor
                content={(block.props as { html: string }).html}
                onChange={html => onBlockChange({ ...block, props: { ...block.props, html } })}
                placeholder="Start writing your content..."
                showToolbar={true}
                className="border-primary/50"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="cursor-pointer" onClick={e => { e.stopPropagation(); onSelect(); }}>
          <BuilderBlockErrorBoundary blockType={block.type}>
            {(() => {
              const animStyle = (block.blockSettings?.animationStyle ?? "fade-up") as BuilderAnimationStyle;
              const variant = BUILDER_ANIMATION_VARIANTS[animStyle] ?? BUILDER_ANIMATION_VARIANTS["fade-up"];
              const renderer = (
                <BlockRenderer
                  block={block}
                  brand={brand}
                  onBlockChange={onBlockChange}
                  animationsEnabled={false}
                  isBuilder
                  pageCta={pageCta}
                  path={path ?? [blockIndex]}
                  renderChild={renderChild}
                  renderEmptySlot={renderEmptySlot}
                  renderTailSlot={renderTailSlot}
                />
              );
              if (animStyle === "none") return renderer;
              return (
                <motion.div
                  key={animStyle}
                  initial={variant.initial}
                  animate={variant.animate}
                  transition={{ duration: 0.65, ease: BUILDER_ANIMATION_EASE }}
                >
                  {renderer}
                </motion.div>
              );
            })()}
          </BuilderBlockErrorBoundary>
        </div>
      )}
    </div>
  );
}

/** Memoize so typing in the inspector only re-renders the selected block's
 *  canvas wrapper, not every block on the page. The parent passes callbacks
 *  via useCallback so shallow-equal props comparison stays stable. */
const SortableCanvasBlock = memo(SortableCanvasBlockInner);
