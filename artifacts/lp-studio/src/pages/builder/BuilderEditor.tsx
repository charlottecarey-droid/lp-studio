import { useEffect, useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Trash2, Plus, FlaskConical, Loader2, TestTube2, Layers
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fetchBrandConfig, DEFAULT_BRAND, type BrandConfig } from "@/lib/brand-config";
import { BLOCK_REGISTRY, createBlock, getBlockDef, type PageBlock, type BlockType } from "@/lib/block-types";
import { BlockRenderer } from "@/blocks/BlockRenderer";
import { PropertyPanel } from "./property-panels/PropertyPanel";
import { BuilderTopBar } from "@/components/layout/builder-top-bar";
import { LP_TEMPLATES } from "@/lib/templates";
import { TiptapEditor } from "@/components/TiptapEditor";

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
}

async function fetchPage(id: string): Promise<FetchedPage> {
  const res = await fetch(`${API_BASE}/lp/pages/${id}`);
  if (!res.ok) throw new Error("Failed to load page");
  return res.json() as Promise<FetchedPage>;
}

interface SavePageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
  customCss?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
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

function BlockLibrary({ onAdd }: { onAdd: (type: string) => void }) {
  const categories = ["Layout", "Content", "Social Proof", "CTA"] as const;

  return (
    <div className="p-4 space-y-6">
      {categories.map(cat => {
        const blocks = BLOCK_REGISTRY.filter(b => b.category === cat);
        if (blocks.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</p>
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

function TemplateLibrary({ onSelect }: { onSelect: (templateId: string) => void }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
      {LP_TEMPLATES.map(t => (
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

function LayersPanel({ blocks, selectedBlockId, onSelect, onDelete, onReorder }: LayersPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = blocks.findIndex(b => b.id === active.id);
      const newIdx = blocks.findIndex(b => b.id === over.id);
      onReorder(arrayMove(blocks, oldIdx, newIdx));
    }
  };

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center gap-2 text-muted-foreground">
        <Layers className="w-8 h-8 opacity-30" />
        <p className="text-xs">No blocks yet. Add blocks from the Blocks tab.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <div className="p-2 space-y-0.5">
          {blocks.map((block, i) => (
            <SortableLayerItem
              key={block.id}
              block={block}
              index={i}
              isSelected={selectedBlockId === block.id}
              onSelect={() => onSelect(block.id)}
              onDelete={() => onDelete(block.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Insert Block Dialog ───────────────────────────────────────────────────────

interface InsertBlockDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (type: string) => void;
}

function InsertBlockDialog({ open, onClose, onInsert }: InsertBlockDialogProps) {
  const categories = ["Layout", "Content", "Social Proof", "CTA"] as const;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" />
            Insert Block
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-5 pr-1">
          {categories.map(cat => {
            const catBlocks = BLOCK_REGISTRY.filter(b => b.category === cat);
            if (catBlocks.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-3 gap-2">
                  {catBlocks.map(block => (
                    <button
                      key={block.type}
                      onClick={() => onInsert(block.type)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
                    >
                      <div className="w-full h-10 rounded-md overflow-hidden">
                        {block.thumbnail()}
                      </div>
                      <span className="text-[10px] font-medium leading-tight text-muted-foreground">{block.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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

  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [customCss, setCustomCss] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
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

  const titleRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    Promise.all([fetchPage(pageId), fetchBrandConfig()])
      .then(([p, b]) => {
        setTitle(p.title);
        setSlug(p.slug);
        setStatus(p.status === "published" ? "published" : "draft");
        setBlocks(p.blocks ?? []);
        setCustomCss(p.customCss ?? "");
        setMetaTitle(p.metaTitle ?? "");
        setMetaDescription(p.metaDescription ?? "");
        setOgImage(p.ogImage ?? "");
        setBrand(b);
        setAbTestName(p.title);
        setAbTestSlug(p.slug);
        setIsLoading(false);
      })
      .catch(err => {
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

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ?? null;

  const VALID_BLOCK_TYPES = new Set<string>(BLOCK_REGISTRY.map(b => b.type));
  const isBlockType = (t: string): t is BlockType => VALID_BLOCK_TYPES.has(t);

  const addBlock = (type: string, atIndex?: number) => {
    if (!isBlockType(type)) return;
    const newBlock = createBlock(type);
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

  const openInsertAt = (index: number) => {
    setInsertAtIndex(index);
    setInsertDialogOpen(true);
  };

  const handleInsertBlock = (type: string) => {
    addBlock(type, insertAtIndex ?? undefined);
    setInsertDialogOpen(false);
    setInsertAtIndex(null);
  };

  const applyTemplate = (templateId: string) => {
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
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateBlock = (updated: PageBlock) => {
    setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIdx = prev.findIndex(b => b.id === active.id);
        const newIdx = prev.findIndex(b => b.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const getPageData = (overrides: Partial<SavePageData> = {}): SavePageData => ({
    title,
    slug,
    blocks,
    status,
    customCss,
    metaTitle,
    metaDescription,
    ogImage,
    ...overrides,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePage(pageId, getPageData());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
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
      await savePage(pageId, getPageData({ status: newStatus }));
      setStatus(newStatus);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSaving(false);
    }
  };

  const copyPreviewLink = () => {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url);
  };

  const handleTitleBlur = () => {
    if (title.trim()) handleSave();
  };

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
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* Top Bar */}
      <BuilderTopBar
        title={title}
        titleRef={titleRef}
        status={status}
        isMobile={isMobile}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        onTitleChange={setTitle}
        onTitleBlur={handleTitleBlur}
        onSetMobile={setIsMobile}
        onCopyLink={copyPreviewLink}
        onSave={handleSave}
        onOpenAbTest={() => setAbTestModalOpen(true)}
        onPublish={handlePublish}
      />

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
        onClose={() => { setInsertDialogOpen(false); setInsertAtIndex(null); }}
        onInsert={handleInsertBlock}
      />

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel: Block Library */}
        <aside className="w-64 border-r border-border bg-background/60 overflow-y-auto shrink-0">
          <Tabs defaultValue="blocks">
            <div className="sticky top-0 bg-background/90 backdrop-blur border-b border-border z-10">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10">
                <TabsTrigger value="blocks" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Blocks</TabsTrigger>
                <TabsTrigger value="layers" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Layers</TabsTrigger>
                <TabsTrigger value="templates" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Templates</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="blocks" className="mt-0">
              <BlockLibrary onAdd={addBlock} />
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
              <TemplateLibrary onSelect={templateId => {
                if (blocks.length === 0 || confirm("Replace current blocks with this template?")) {
                  applyTemplate(templateId);
                }
              }} />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-muted/50">
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
                className={cn(
                  "w-full bg-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300",
                  isMobile ? "max-w-[390px]" : "max-w-5xl"
                )}
              >
                <style>{`
                  @keyframes marquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                  }
                  .animate-marquee { animation: marquee 40s linear infinite; }
                  .animate-marquee:hover { animation-play-state: paused; }
                `}</style>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <InsertionBar onClick={() => openInsertAt(0)} />
                    {blocks.map((block, index) => (
                      <div key={block.id}>
                        <SortableCanvasBlock
                          block={block}
                          brand={brand}
                          isSelected={selectedBlockId === block.id}
                          onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                          onDelete={() => deleteBlock(block.id)}
                          onTestBlock={() => handleOpenBlockTestModal(block.id)}
                          onBlockChange={updateBlock}
                        />
                        <InsertionBar onClick={() => openInsertAt(index + 1)} />
                      </div>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </main>

        {/* Right panel: Property Editor */}
        <aside className="w-72 border-l border-border bg-background/60 overflow-y-auto shrink-0 flex flex-col">
          {selectedBlock ? (
            <PropertyPanel
              block={selectedBlock}
              onChange={updateBlock}
              onDelete={() => deleteBlock(selectedBlock.id)}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b bg-muted/30 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page</p>
                <h3 className="font-semibold text-sm text-foreground mt-0.5">Page Settings</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
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
                </div>

                {/* Divider */}
                <div className="border-t border-border pt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">SEO &amp; Metadata</p>
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
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">OG Image URL</Label>
                  <Input
                    value={ogImage}
                    onChange={e => setOgImage(e.target.value)}
                    onBlur={handleSave}
                    placeholder="https://..."
                    className="text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Shown when shared on social media. Recommended 1200×630px.</p>
                  {ogImage && (
                    <div className="mt-2 rounded-md overflow-hidden border border-border aspect-video bg-muted">
                      <img src={ogImage} alt="OG preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground text-center pt-2 pb-1">
                  Click any block in the canvas to edit its properties.
                </p>
              </div>
            </div>
          )}
          <CustomCssPanel value={customCss} onChange={setCustomCss} />
        </aside>
      </div>
    </div>
  );
}

interface SortableCanvasBlockProps {
  block: PageBlock;
  brand: BrandConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTestBlock: () => void;
  onBlockChange: (updated: PageBlock) => void;
}

function SortableCanvasBlock({ block, brand, isSelected, onSelect, onDelete, onTestBlock, onBlockChange }: SortableCanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
        <button
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-red-500"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

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
        <div className="cursor-pointer" onClick={onSelect}>
          <BlockRenderer block={block} brand={brand} onBlockChange={onBlockChange} />
        </div>
      )}
    </div>
  );
}
