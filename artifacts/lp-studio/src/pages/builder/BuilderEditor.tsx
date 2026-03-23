import { useEffect, useState, useRef } from "react";
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
  ArrowLeft, Save, Globe, Copy, Monitor, Smartphone,
  GripVertical, Trash2, Plus, CheckCircle, FlaskConical, Loader2
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
import { LP_TEMPLATES } from "@/lib/templates";

const API_BASE = "/api";

interface FetchedPage {
  id: number;
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: string;
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

export default function BuilderEditor() {
  const [, params] = useRoute("/builder/:pageId");
  const [, navigate] = useLocation();
  const pageId = params?.pageId ?? "";

  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
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
        body: JSON.stringify({ name: "Control", isControl: true, trafficWeight: 50, config: {}, builderPageId: parseInt(pageId, 10) }),
      });
      if (!variantRes.ok) {
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

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) ?? null;

  const VALID_BLOCK_TYPES = new Set<string>(BLOCK_REGISTRY.map(b => b.type));
  const isBlockType = (t: string): t is BlockType => VALID_BLOCK_TYPES.has(t);

  const addBlock = (type: string) => {
    if (!isBlockType(type)) return;
    const newBlock = createBlock(type);
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePage(pageId, { title, slug, blocks, status });
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
      await savePage(pageId, { title, slug, blocks, status: newStatus });
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
    const url = `${window.location.origin}/lp-studio/lp/${slug}`;
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
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
        <Link href="/pages">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Pages</span>
          </Button>
        </Link>

        <div className="h-4 w-px bg-border mx-1" />

        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="flex-1 max-w-xs bg-transparent text-sm font-semibold text-foreground outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors py-0.5"
          placeholder="Page Title"
        />

        <Badge
          variant={status === "published" ? "default" : "secondary"}
          className={cn("text-xs shrink-0", status === "published" ? "bg-green-500/10 text-green-700 border-green-200" : "")}
        >
          {status === "published" ? "Live" : "Draft"}
        </Badge>

        <div className="flex-1" />

        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setIsMobile(false)}
            className={cn("p-1.5 rounded-md transition-colors", !isMobile ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobile(true)}
            className={cn("p-1.5 rounded-md transition-colors", isMobile ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copyPreviewLink}>
          <Copy className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Copy Link</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 text-xs", saveSuccess && "border-green-500 text-green-600")}
          onClick={handleSave}
          disabled={isSaving}
        >
          {saveSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{saveSuccess ? "Saved!" : "Save"}</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
          onClick={() => setAbTestModalOpen(true)}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">A/B Test</span>
        </Button>

        <Button
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handlePublish}
          disabled={isSaving}
          variant={status === "published" ? "outline" : "default"}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{status === "published" ? "Unpublish" : "Publish"}</span>
        </Button>
      </header>

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

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel: Block Library */}
        <aside className="w-64 border-r border-border bg-background/60 overflow-y-auto shrink-0">
          <Tabs defaultValue="blocks">
            <div className="sticky top-0 bg-background/90 backdrop-blur border-b border-border z-10">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10">
                <TabsTrigger value="blocks" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Blocks</TabsTrigger>
                <TabsTrigger value="templates" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Templates</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="blocks" className="mt-0">
              <BlockLibrary onAdd={addBlock} />
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
                    {blocks.map(block => (
                      <SortableCanvasBlock
                        key={block.id}
                        block={block}
                        brand={brand}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
                        onDelete={() => deleteBlock(block.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </main>

        {/* Right panel: Property Editor */}
        <aside className="w-72 border-l border-border bg-background/60 overflow-y-auto shrink-0">
          {selectedBlock ? (
            <PropertyPanel
              block={selectedBlock}
              onChange={updateBlock}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Select a block to edit</p>
                <p className="text-xs text-muted-foreground mt-1">Click any block in the canvas to open its property editor here.</p>
              </div>
            </div>
          )}
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
}

function SortableCanvasBlock({ block, brand, isSelected, onSelect, onDelete }: SortableCanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
          "absolute inset-0 pointer-events-none z-10 border-2 transition-colors",
          isSelected ? "border-primary" : "border-transparent group-hover:border-primary/30"
        )}
      />

      {/* Controls overlay */}
      <div className={cn(
        "absolute top-2 right-2 z-20 flex items-center gap-1 transition-opacity",
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
          className="p-1.5 rounded-md bg-white/95 border border-border shadow-sm text-muted-foreground hover:text-red-500"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Click target */}
      <div className="cursor-pointer" onClick={onSelect}>
        <BlockRenderer block={block} brand={brand} />
      </div>
    </div>
  );
}
