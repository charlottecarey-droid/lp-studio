import { useEffect, useState, useRef, useCallback, useMemo, Component, type ReactNode, type RefObject, type ErrorInfo } from "react";
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
  GripVertical, Trash2, Plus, FlaskConical, Loader2, TestTube2, Layers, Code2, Type, Sparkles, BookmarkPlus,
  Search, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Wand2, Camera, ImageIcon, Flame, BookOpen, Variable, Mail, X, Star, MessageSquare, Palette,
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
import { fetchBrandConfig, DEFAULT_BRAND, getBrandStyleVars, type BrandConfig } from "@/lib/brand-config";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { BLOCK_REGISTRY, createBlock, getBlockDef, isAllowedAsChild, type PageBlock, type BlockType, type SchemaFieldValue } from "@/lib/block-types";
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
import { LP_TEMPLATES, getTemplatesForIndustry } from "@/lib/templates";
import { TiptapEditor } from "@/components/TiptapEditor";
import { MediaLibraryDrawer } from "@/components/MediaLibraryDrawer";
import { refreshBlockCopy } from "@/lib/copy-api";
import { COPY_FIELDS } from "@/lib/copy-fields";
import { useToast } from "@/hooks/use-toast";
import { SaveToLibraryDialog } from "@/components/SaveToLibraryDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useComments, useReviews, usePresence, getAuthorName, type BlockComments } from "@/hooks/use-collaboration";
import { useBlockCatalog, type ResolvedBlockDef } from "@/hooks/use-block-catalog";
import { useTenantBlockLibraryPrefs } from "@/hooks/use-tenant-block-library-prefs";
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
import { Settings2 } from "lucide-react";
import { isBlockVisibleForAudience, isBlockTypeAllowedForAudience, canUseGridPieces } from "@/lib/audience-gating";
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
  animationsEnabled?: boolean;
  smoothScroll?: boolean;
  pageVariables?: Record<string, string>;
  isTemplate?: boolean;
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
  pageVariables?: Record<string, string>;
  audienceType?: string | null;
  segmentId?: string | null;
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
  const defaultCoreOrder = ["Layout", "Content", "Social Proof", "CTA", "Lead Capture", "Engagement", "Interactive", "Grid Pieces", "Showcase"] as const;
  // Any category that exists in the catalog but is neither a known core nor a
  // known non-core (SegmentLibrary) category is a tenant-created shelf — a
  // user moved a block into a new bucket via the Customize dialog. Surface
  // those in the Blocks tab so the block is reachable.
  const knownNonCore = new Set(["DSO", "DSO Practices", "Events"]);
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

const CORE_CATEGORIES = new Set(["Layout", "Content", "Social Proof", "CTA", "Lead Capture", "Engagement", "Interactive"]);

function SegmentLibrary({ onAdd, customBlocks, segments, visibleBlocks, prefs }: { onAdd: (type: string) => void; customBlocks: CustomBlock[]; segments: AudienceSegment[]; visibleBlocks: ResolvedBlockDef[]; prefs: BlockLibraryPrefs }) {
  // Group catalog-resolved blocks by their (catalog-overriding) category, keeping
  // only non-core categories. Catalog rows can re-shelve a block by setting a
  // different category — that change is honored here.
  const segmentGroupMap = visibleBlocks.reduce((acc, block) => {
    if (CORE_CATEGORIES.has(block.category)) return acc;
    if (!acc[block.category]) acc[block.category] = [];
    acc[block.category].push(block);
    return acc;
  }, {} as Record<string, typeof visibleBlocks>);
  // Tenant prefs already applied upstream (block hide / reorder / re-shelve),
  // but re-derive a stable order using prefs.categoryOrder for non-core groups.
  const orderedGroupNames = applyCategoryOrder(Object.keys(segmentGroupMap), prefs)
    .filter(k => segmentGroupMap[k]);
  const segmentGroupEntries = orderedGroupNames.map(k => [k, segmentGroupMap[k]] as const);

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

  return (
    <div className="p-4 space-y-5">
      {/* Built-in segment blocks — grouped by category */}
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
      {segments.length > 0 ? (
        segments.map(seg => {
          const segCustomBlocks = customBlocks.filter(b => b.segment === seg.name);
          if (segCustomBlocks.length === 0) return null;
          return (
            <div key={seg.id}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{seg.name}</p>
                <span className="text-[10px] text-muted-foreground ml-auto">{segCustomBlocks.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {segCustomBlocks.map(block =>
                  renderBlockButton(
                    String(block.id),
                    block.name,
                    <CustomBlockThumbnail blockType={block.block_type} />,
                    () => onAdd(`custom:${block.id}`)
                  )
                )}
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2 leading-relaxed">
          Define segments in Brand Settings to organize custom blocks here.
        </p>
      )}

      {/* Catch-all: custom blocks with legacy "segment" value or unrecognized segment name */}
      {(() => {
        const knownSegmentNames = new Set(segments.map(s => s.name));
        const orphaned = customBlocks.filter(b => b.segment && b.segment !== "core" && !knownSegmentNames.has(b.segment));
        if (orphaned.length === 0) return null;
        return (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other</p>
            <div className="grid grid-cols-2 gap-2">
              {orphaned.map(block =>
                renderBlockButton(
                  String(block.id),
                  block.name,
                  <CustomBlockThumbnail blockType={block.block_type} />,
                  () => onAdd(`custom:${block.id}`)
                )
              )}
            </div>
          </div>
        );
      })()}
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

function TemplateLibrary({ onSelect, industry }: { onSelect: (templateId: string) => void; industry?: string | null }) {
  // Hide Dandy/dental built-in templates from non-dental tenants — every
  // shipped template currently contains hardcoded Dandy copy / dental
  // imagery. Dental tenants still see the full set.
  const visible =
    industry === undefined ? LP_TEMPLATES : getTemplatesForIndustry(industry);
  if (visible.length === 0) {
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
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
      {visible.map(t => (
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
      ))}
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
}

function InsertBlockDialog({ open, onClose, onInsert, customBlocks, visibleBlocks, prefs, nestedTarget }: InsertBlockDialogProps) {
  const defaultCategories = ["Layout", "Content", "Social Proof", "CTA", "Lead Capture", "Engagement", "Interactive", "Grid Pieces", "DSO", "DSO Practices", "Showcase", "Events"] as const;
  // Append any extra categories that exist in the (prefs-applied) catalog but
  // aren't in the default list, then sort the whole thing per tenant prefs.
  const seen = new Set<string>(defaultCategories);
  const extras = visibleBlocks.map(b => b.category).filter(c => !seen.has(c));
  for (const c of extras) seen.add(c);
  const categories = applyCategoryOrder([...defaultCategories, ...new Set(extras)], prefs);
  const [search, setSearch] = useState("");
  useEffect(() => { if (open) setSearch(""); }, [open]);
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
  const { domainContext, canPublish, canReview, reviewWorkflowEnabled } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;

  const [blocks, setBlocksRaw] = useState<PageBlock[]>([]);
  // 50-entry undo/redo. We snapshot blocks BEFORE every mutation. Loads from
  // the server bypass history (use setBlocksRaw directly).
  const historyPastRef = useRef<PageBlock[][]>([]);
  const historyFutureRef = useRef<PageBlock[][]>([]);
  const HISTORY_LIMIT = 50;
  const setBlocks = useCallback<typeof setBlocksRaw>((updater) => {
    setBlocksRaw((prev) => {
      const next = typeof updater === "function"
        ? (updater as (p: PageBlock[]) => PageBlock[])(prev)
        : updater;
      if (next === prev) return prev;
      historyPastRef.current.push(prev);
      if (historyPastRef.current.length > HISTORY_LIMIT) historyPastRef.current.shift();
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
      return past;
    });
  }, []);
  const redo = useCallback(() => {
    setBlocksRaw((prev) => {
      const next = historyFutureRef.current.pop();
      if (next === undefined) return prev;
      historyPastRef.current.push(prev);
      if (historyPastRef.current.length > HISTORY_LIMIT) historyPastRef.current.shift();
      return next;
    });
  }, []);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
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
  const [pageVariables, setPageVariables] = useState<Record<string, string>>({});
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [blockDefaults, setBlockDefaults] = useState<Record<string, unknown>>({});
  // Hoist a single useBlockCatalog call here and pass the resolved blocks to
  // every consumer (BlockLibrary, SegmentLibrary, InsertBlockDialog, addBlock).
  // Avoids divergent fetch states across subcomponents that previously caused
  // brief windows where the palette showed catalog labels while insertion still
  // used registry/dental defaults.
  const { blocks: allCatalogBlocks, getDef: catalogGetDef } = useBlockCatalog();
  const { prefs: libraryPrefs, save: saveLibraryPrefs, saving: librarySaving } = useTenantBlockLibraryPrefs();
  const [customizeLibraryOpen, setCustomizeLibraryOpen] = useState(false);
  const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abTestModalOpen, setAbTestModalOpen] = useState(false);
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
    () => allCatalogBlocks
      .filter(b => isBlockVisibleForAudience(b.category, pageAudienceType))
      .filter(b => canGridPieces || b.category !== "Grid Pieces"),
    [allCatalogBlocks, pageAudienceType, canGridPieces],
  );
  // Apply tenant block-library prefs (hide / rename / re-shelve / reorder) on
  // top of the audience-filtered catalog. The unfiltered `catalogBlocks` is
  // still passed to the customize dialog so users can toggle hidden items
  // back on.
  const tenantCatalogBlocks = useMemo<ResolvedBlockDef[]>(
    () => applyBlockLibraryPrefs(catalogBlocks, libraryPrefs),
    [catalogBlocks, libraryPrefs],
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

  const { blocks: commentBlocks, addComment, resolveComment } = useComments(pageIdNum);
  const { reviews, createReview, deleteReview } = useReviews(pageIdNum);
  const { user } = useAuth();
  const tenantIndustry = user?.tenantIndustry ?? null;
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
        setTemplateLabel(p.templateLabel ?? p.title);
        setTemplateDescription(p.templateDescription ?? "");
        // Server load: bypass undo history.
        setBlocksRaw(normalizeTree(p.blocks ?? []));
        historyPastRef.current = [];
        historyFutureRef.current = [];
        setCustomCss(p.customCss ?? "");
        setAnimationsEnabled(p.animationsEnabled !== false);
        setSmoothScroll(p.smoothScroll !== false);
        setMetaTitle(p.metaTitle ?? "");
        setMetaDescription(p.metaDescription ?? "");
        setOgImage(p.ogImage ?? "");
        setPageVariables(p.pageVariables ?? {});
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
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Builder load error:", err);
        setError(err instanceof Error ? err.message : "Failed to load page");
        setIsLoading(false);
      });
  }, [pageId]);

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
        const cbProps = (customBlock.props ?? {}) as { sample?: Record<string, SchemaFieldValue> };
        const newBlock = createBlock("custom-schema");
        newBlock.props = {
          schema: [],
          template: "",
          values: cbProps.sample ?? {},
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
            const cbProps = (custom.props ?? {}) as { sample?: Record<string, SchemaFieldValue> };
            const cs = createBlock("custom-schema");
            cs.props = {
              schema: [],
              template: "",
              values: cbProps.sample ?? {},
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
    if (templateId === "inside-dandy-event") {
      const block = createBlock("event-page");
      setBlocks([block]);
      setSelectedBlockId(null);
      return;
    }

    if (templateId === "inside-dandy-spatial-tour") {
      const block = createBlock("spatial-tour");
      setBlocks([block]);
      setSelectedBlockId(null);
      return;
    }

    const templateBlockTypes: Record<string, BlockType[]> = {
      "video-hero": ["hero", "trust-bar", "photo-strip", "stat-callout", "benefits-grid", "testimonial", "product-grid", "bottom-cta"],
      "problem-first": ["hero", "pas-section", "comparison", "stat-callout", "trust-bar", "benefits-grid", "testimonial", "bottom-cta"],
      "social-proof-leader": ["hero", "testimonial", "photo-strip", "stat-callout", "trust-bar", "benefits-grid", "bottom-cta"],
      "how-it-works": ["hero", "how-it-works", "trust-bar", "product-grid", "benefits-grid", "testimonial", "bottom-cta"],
      "minimal-cta": ["hero", "trust-bar"],
    };
    const types = templateBlockTypes[templateId] ?? [];
    const newBlocks = types.map(t => createBlock(t));
    setBlocks(newBlocks);
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

  const applyCtaToAll = () => {
    if (!selectedBlock) return;
    const p = selectedBlock.props as Record<string, unknown>;

    // Extract the effective CTA values from the source block regardless of its type.
    // DSO hero blocks store the primary CTA in primaryCta* fields; all others use ctaText/ctaUrl.
    const sourceUrl  = ((p.primaryCtaUrl  ?? p.ctaUrl ?? p.url  ?? "") as string);
    const sourceText = ((p.primaryCtaText ?? p.ctaText ?? "")           as string);
    const sourceMode = ((p.primaryCtaMode ?? p.ctaMode ?? p.ctaAction ?? p.ctaType ?? "link") as string);
    // chilipiperUrl: explicit field first, then fall back to ctaUrl when mode is chilipiper
    const sourceChilipiper = ((p.chilipiperUrl as string | undefined) ??
      (sourceMode === "chilipiper" ? sourceUrl : "")) as string;

    setBlocks(prev => prev.map(b => {
      if (b.id === selectedBlock.id) return b;
      const bp = b.props as Record<string, unknown>;

      // Determine if this block has any CTA-like fields
      const hasPrimaryCta  = "primaryCtaUrl" in bp;
      const hasCtaUrl      = "ctaUrl" in bp;
      const hasUrl         = "url" in bp;
      const hasChilipiper  = "chilipiperUrl" in bp;
      if (!hasPrimaryCta && !hasCtaUrl && !hasUrl && !hasChilipiper) return b;

      const updates: Record<string, unknown> = {};

      // Hero-style blocks (primaryCta*)
      if (hasPrimaryCta) {
        updates.primaryCtaUrl  = sourceUrl;
        updates.primaryCtaText = sourceText;
        updates.primaryCtaMode = sourceMode;
      }

      // Standard DSO blocks (ctaUrl / ctaText / ctaMode)
      if (hasCtaUrl) {
        updates.ctaUrl  = sourceUrl;
        updates.ctaText = sourceText;
        if ("ctaMode" in bp)   updates.ctaMode   = sourceMode;
        if ("ctaAction" in bp) updates.ctaAction  = sourceMode;
        if ("ctaType" in bp)   updates.ctaType    = sourceMode;
        if (hasChilipiper && sourceChilipiper) updates.chilipiperUrl = sourceChilipiper;
      }

      // Legacy blocks that use "url" instead of "ctaUrl"
      if (hasUrl && !hasCtaUrl) {
        updates.url = sourceUrl;
        if ("ctaAction" in bp) updates.ctaAction = sourceMode;
        if ("ctaType" in bp)   updates.ctaType   = sourceMode;
      }

      // Capture-style blocks: only have chilipiperUrl, no ctaUrl (e.g. dso-cta-capture)
      if (hasChilipiper && !hasCtaUrl && !hasPrimaryCta && sourceChilipiper) {
        updates.chilipiperUrl = sourceChilipiper;
      }

      return { ...b, props: { ...bp, ...updates } } as PageBlock;
    }));
  };

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
        brand={brand}
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
        renderChild={renderNestedChild}
        renderEmptySlot={renderEmptySlot}
        renderTailSlot={renderTailSlot}
        parentLayout={parentLayout}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brand, selectedBlockId],
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
    pageVariables: Object.keys(pageVariables).length > 0 ? pageVariables : undefined,
    audienceType: pageAudienceType ?? (appliedSegment ? null : undefined),
    segmentId: appliedSegment?.id ?? (pageAudienceType ? null : undefined),
    ...overrides,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePage(pageId, getPageData());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      toast({ title: "Saved", description: "Page saved." });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
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

  const handlePublish = async () => {
    const isPublished = status === "published";
    const confirmMsg = isPublished
      ? "Unpublish this page? It will no longer be publicly accessible."
      : "Publish this page? It will be publicly accessible.";
    if (!confirm(confirmMsg)) return;
    const newStatus: "draft" | "published" = isPublished ? "draft" : "published";
    setIsSaving(true);
    try {
      await savePage(pageId, getPageData({ status: newStatus }));
      setStatus(newStatus);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      // Show outreach banner after publishing (not unpublishing)
      if (newStatus === "published") {
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
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `Approve failed (HTTP ${res.status})`);
      }
      setStatus("published");
      setShowOutreachBanner(true);
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
      // Capture the canvas at current size
      const blob = await toBlob(el, {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "#ffffff",
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
        commentMode={commentMode}
        viewers={viewers}
        unresolvedComments={commentBlocks.reduce((sum, b) => sum + b.threads.filter(t => !t.comment.resolved).length, 0)}
        onTitleChange={setTitle}
        onTitleBlur={handleTitleBlur}
        liveUrl={getLpPageUrl(slug, micrositeDomain)}
        previewUrl={getLpPreviewUrl(slug, micrositeDomain)}
        onSave={handleSave}
        onSaveAsTemplate={() => { setTemplateLabel(templateLabel || title); setShowTemplateDialog(true); }}
        onOpenAbTest={() => setAbTestModalOpen(true)}
        onPublish={handlePublish}
        onToggleCommentMode={() => setCommentMode(prev => !prev)}
        onShareForReview={() => setShareModalOpen(true)}
        canPublish={canPublish}
        canReview={canReview}
        onSubmitForReview={handleSubmitForReview}
        onApproveReview={handleApproveReview}
        onRejectReview={handleRejectReview}
        reviewWorkflowEnabled={reviewWorkflowEnabled}
      />

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
        onClose={() => { setInsertDialogOpen(false); setInsertAtIndex(null); setNestedInsertTarget(null); }}
        onInsert={handleInsertBlock}
        customBlocks={visibleCustomBlocks}
        visibleBlocks={tenantCatalogBlocks}
        prefs={libraryPrefs}
        nestedTarget={nestedInsertTarget !== null}
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
                placeholder="e.g. DSO Heartland Skin"
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

        {/* Left panel: Block Library */}
        <aside className="w-64 border-r border-border bg-background/60 overflow-y-auto shrink-0">
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
                onAdd={addBlock}
                customBlocks={visibleCustomBlocks}
                visibleBlocks={tenantCatalogBlocks}
                prefs={libraryPrefs}
                onCustomize={() => setCustomizeLibraryOpen(true)}
              />
            </TabsContent>
            <TabsContent value="segment" className="mt-0">
              <SegmentLibrary
                onAdd={addBlock}
                customBlocks={visibleCustomBlocks}
                segments={brand.segments ?? []}
                visibleBlocks={tenantCatalogBlocks}
                prefs={libraryPrefs}
              />
            </TabsContent>
            <TabsContent value="layers" className="mt-0">
              <LayersPanel
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelect={id => setSelectedBlockId(id === selectedBlockId ? null : id)}
                onDelete={deleteBlock}
                onReorder={setBlocks}
              />
            </TabsContent>
            <TabsContent value="templates" className="mt-0">
              <TemplateLibrary
                industry={tenantIndustry}
                onSelect={templateId => {
                  if (blocks.length === 0 || confirm("Replace current blocks with this template?")) {
                    applyTemplate(templateId);
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-muted/50" onClick={() => setSelectedBlockId(null)}>
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
                style={getBrandStyleVars(brand)}
                data-lp-page
              >
                <BrandFontLoader brand={brand} />
                <style>{`
                  @keyframes marquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                  }
                  .animate-marquee { animation: marquee 40s linear infinite; }
                  .animate-marquee:hover { animation-play-state: paused; }
                `}</style>
                <SortableContext items={collectIds(blocks)} strategy={verticalListSortingStrategy}>
                    <InsertionBar onClick={() => openInsertAt(0)} />
                    {blocks.map((block, index) => (
                      <div key={block.id}>
                        <SortableCanvasBlock
                          block={block}
                          brand={brand}
                          isSelected={selectedBlockId === block.id}
                          onSelect={() => setSelectedBlockId(block.id)}
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
                          path={[index]}
                          renderChild={renderNestedChild}
                          renderEmptySlot={renderEmptySlot}
                          renderTailSlot={renderTailSlot}
                        />
                        <InsertionBar onClick={() => openInsertAt(index + 1)} />
                      </div>
                    ))}
                    {/* Top-level tail drop slot — lets users drop a block
                        at the very end of the page (the standard sortable
                        "before over" semantics never resolves to "after the
                        last item"). Same `container:` droppable id is
                        treated as "append" by handleDragEnd. */}
                    <TailDropSlot parentPath={[]} />
                  </SortableContext>
              </div>
            )}
          </div>
        </main>

        {/* Right panel: Property Editor */}
        <aside className="w-72 border-l border-border bg-background/60 shrink-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {selectedBlock ? (
            <PropertyPanel
              block={selectedBlock}
              onChange={updateBlock}
              onDelete={() => deleteBlock(selectedBlock.id)}
              brandVoiceSet={!!(brand.brandName?.trim() || brand.toneOfVoice?.trim() || (brand.messagingPillars?.length ?? 0) > 0)}
              brand={brand}
              pageId={parseInt(pageId, 10) || undefined}
              onApplyCtaToAll={applyCtaToAll}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b bg-muted/30 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page</p>
                <h3 className="font-semibold text-sm text-foreground mt-0.5">Page Settings</h3>
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
                  <p className="text-[10px] text-muted-foreground mt-1">{metaTitle.length}/60 chars — ideal under 60</p>
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
                  <p className="text-[10px] text-muted-foreground mt-1">{metaDescription.length}/160 chars — ideal under 160</p>
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
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Shown when shared on social media. Captures at 1200×630px.</p>
                  {ogImage && (
                    <div className="mt-2 rounded-md overflow-hidden border border-border aspect-video bg-muted">
                      <img src={ogImage} alt="OG preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
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
                            <button
                              key={url}
                              type="button"
                              onClick={() => { setOgImage(url); setOgPickerOpen(false); setTimeout(handleSave, 100); }}
                              className="aspect-video rounded overflow-hidden border border-transparent hover:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] bg-muted"
                            >
                              <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
      </div>
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

  const handleAutoFill = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lp/seo-meta-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, title, currentSlug, audienceType, segmentContext }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json() as { metaTitle: string; metaDescription: string; suggestedSlug: string };

      // Generate OG screenshot URL from the live page
      const pageSlug = data.suggestedSlug || currentSlug;
      const pageUrl = getLpPageUrl(pageSlug, micrositeDomain);
      const ogScreenshot = `https://image.thum.io/get/width/1200/crop/630/noanimate/${pageUrl}`;

      onGenerated(data.metaTitle, data.metaDescription, data.suggestedSlug, ogScreenshot);
    } catch {
      // Silent fail — button just stops loading
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
  /** Path of THIS block within the page tree (top-level paths are `[index]`). */
  path?: BlockPath;
  /** Recursive child renderer (BuilderEditor closure). */
  renderChild?: (c: PageBlock, i: number, parentPath: BlockPath) => ReactNode;
  renderTailSlot?: (parentPath: BlockPath) => ReactNode;
  /** Empty-container droppable renderer (BuilderEditor closure). */
  renderEmptySlot?: (parentPath: BlockPath) => ReactNode;
}

function SortableCanvasBlock({ block, brand, isSelected, onSelect, onDelete, onTestBlock, onBlockChange, onSaveToLibrary, onSetAsDefault, commentMode, blockIndex, blockComments, onAddComment, onResolveComment, currentUserName, path, renderChild, renderEmptySlot, renderTailSlot }: SortableCanvasBlockProps) {
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
