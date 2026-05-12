import { useState, useEffect } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { TiptapEditor } from "@/components/TiptapEditor";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Code2, Type, Blocks, LayoutGrid, Database, GripVertical, ExternalLink, FileText, Sparkles, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBrandConfig, DEFAULT_BRAND, type AudienceSegment, type BrandConfig } from "@/lib/brand-config";
import { Link } from "wouter";
import type { SchemaFieldDef, SchemaFieldType, SchemaFieldValue } from "@/lib/block-types";
import { SchemaPreviewFrame } from "@/components/blocks/SchemaPreviewFrame";
import { GenerateBlockDialog, type GeneratedBlock } from "@/components/blocks/GenerateBlockDialog";

const API = "/api";

interface CustomBlock {
  id: number;
  name: string;
  block_type: string;
  props: Record<string, unknown> & { html?: string; schema?: SchemaFieldDef[]; template?: string; sample?: Record<string, SchemaFieldValue> };
  segment: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UsagePage {
  id: number;
  title: string;
  status: string;
}

interface BlockUsage {
  count: number;
  publishedCount: number;
  pages: UsagePage[];
}

type BlockEditorType = "rich-text" | "custom-html" | "schema";

interface EditorState {
  id?: number;
  name: string;
  block_type: BlockEditorType;
  segment: string;
  html: string;
  // Schema editor state
  schema: SchemaFieldDef[];
  template: string;
  sample: Record<string, SchemaFieldValue>;
}

const EMPTY_EDITOR: EditorState = {
  name: "",
  block_type: "rich-text",
  segment: "core",
  html: "",
  schema: [],
  template: "",
  sample: {},
};

const FIELD_TYPES: { value: SchemaFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "longText", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Toggle" },
  { value: "color", label: "Color" },
  { value: "image", label: "Image URL" },
  { value: "url", label: "URL" },
  { value: "select", label: "Select" },
];

function newFieldId(existing: SchemaFieldDef[]): string {
  let i = existing.length + 1;
  while (existing.some(f => f.id === `field_${i}`)) i++;
  return `field_${i}`;
}

export default function CustomBlocksPage() {
  return (
    <AppLayout>
      <CustomBlocksContent />
    </AppLayout>
  );
}

export function CustomBlocksContent() {
  const [blocks, setBlocks] = useState<CustomBlock[]>([]);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [isSaving, setIsSaving] = useState(false);
  // Task #199 — usage map keyed by block id, populated for schema blocks so
  // each card can show "Used on N pages" and the save-confirm dialog can
  // surface the affected pages with status badges + builder links.
  const [usageById, setUsageById] = useState<Record<number, BlockUsage>>({});
  const [confirmUsage, setConfirmUsage] = useState<BlockUsage | null>(null);
  const [confirmResolver, setConfirmResolver] = useState<((ok: boolean) => void) | null>(null);
  // Task #200 — one-click "Add starter: Global Footer" in-flight state.
  const [isAddingStarter, setIsAddingStarter] = useState(false);
  // Task #210 — "Generate from prompt" dialog state.
  const [generateOpen, setGenerateOpen] = useState(false);
  // Task #220 — list of pages so the Compose-section flow can optionally
  // append the generated section to a target page in one batch.
  const [pagesForInsert, setPagesForInsert] = useState<{ id: number; title: string }[]>([]);
  // Task #202 — snapshot of the saved block (when editing) so the preview
  // panel can render a side-by-side "current vs new" diff. Null for create.
  const [savedSnapshot, setSavedSnapshot] = useState<{
    schema: SchemaFieldDef[];
    template: string;
    sample: Record<string, SchemaFieldValue>;
  } | null>(null);
  // Task #202 — editor toggle to show/hide the live preview panel without
  // leaving the editor. Defaults on for schema blocks since that's the
  // primary failure mode the preview is meant to catch.
  const [showPreview, setShowPreview] = useState(true);
  // Task #202 — when the affected-pages confirm dialog is open, optionally
  // include a thumbnail diff for the first matching page. Editors can
  // collapse it if they only care about the page list.
  const [showConfirmDiff, setShowConfirmDiff] = useState(true);
  const { toast } = useToast();

  const loadUsage = async (blockId: number): Promise<BlockUsage> => {
    try {
      const res = await fetch(`${API}/lp/custom-blocks/${blockId}/usage`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as BlockUsage;
      setUsageById(prev => ({ ...prev, [blockId]: data }));
      return data;
    } catch {
      const empty: BlockUsage = { count: 0, publishedCount: 0, pages: [] };
      setUsageById(prev => ({ ...prev, [blockId]: empty }));
      return empty;
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/lp/custom-blocks`).then(r => r.json() as Promise<CustomBlock[]>).catch(() => [] as CustomBlock[]),
      fetchBrandConfig().catch(() => DEFAULT_BRAND),
    ]).then(([data, b]) => {
      setBlocks(data);
      setSegments(b.segments ?? []);
      setBrand(b);
      // Prefetch usage for every schema block so cards render counts immediately.
      data.filter(blk => blk.block_type === "schema").forEach(blk => { void loadUsage(blk.id); });
    }).finally(() => setIsLoading(false));
  }, []);

  const hasGlobalFooter = blocks.some(
    b => b.block_type === "schema" && /^global footer$/i.test(b.name.trim())
  );

  const handleAddGlobalFooterStarter = async () => {
    setIsAddingStarter(true);
    try {
      const body = buildGlobalFooterStarter(brand);
      const created = await fetch(`${API}/lp/custom-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CustomBlock>;
      });
      setBlocks(prev => [...prev, created]);
      toast({
        title: "Global Footer added",
        description: "Edit the master once and every page footer updates.",
      });
    } catch (err) {
      toast({
        title: "Failed to add starter",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsAddingStarter(false);
    }
  };

  const openCreate = () => {
    setEditor(EMPTY_EDITOR);
    setSavedSnapshot(null);
    setEditorOpen(true);
  };

  // Task #220 — load the page list when opening the dialog so the
  // Compose-section flow can offer "insert into page" without an extra trip
  // to the builder. Best-effort: an empty list just hides the picker.
  useEffect(() => {
    if (!generateOpen) return;
    let cancelled = false;
    fetch(`${API}/lp/pages`)
      .then(r => r.ok ? r.json() as Promise<Array<{ id: number; title: string; isTemplate?: boolean }>> : [])
      .then(rows => {
        if (cancelled) return;
        setPagesForInsert(
          (Array.isArray(rows) ? rows : [])
            .filter(p => !p.isTemplate)
            .map(p => ({ id: p.id, title: p.title })),
        );
      })
      .catch(() => { if (!cancelled) setPagesForInsert([]); });
    return () => { cancelled = true; };
  }, [generateOpen]);

  // Task #220 — accept a composed multi-block section: create each block via
  // the existing custom-blocks endpoint, then optionally append matching
  // custom-schema instances to the target page in order. Failures partway
  // through still surface the blocks that did save so the editor can recover
  // without losing work.
  const handleAcceptBatch = async (
    generated: GeneratedBlock[],
    opts: { sectionName: string; targetPageId: number | null },
  ) => {
    const created: CustomBlock[] = [];
    for (let i = 0; i < generated.length; i++) {
      const g = generated[i];
      const body = {
        name: (g.name?.trim() || `${opts.sectionName} – Block ${i + 1}`).slice(0, 120),
        block_type: "schema",
        segment: "core",
        props: { schema: g.schema, template: g.template, sample: g.sample },
      };
      const res = await fetch(`${API}/lp/custom-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // Task #220 — surface partial progress so the UI reflects what already
        // landed on the server before the failure (the loop creates blocks
        // sequentially; earlier ones are committed and shouldn't be hidden).
        if (created.length > 0) {
          setBlocks(prev => [...prev, ...created]);
          created.forEach(b => { if (b.block_type === "schema") void loadUsage(b.id); });
        }
        throw new Error(`Block ${i + 1} failed: ${detail || `HTTP ${res.status}`}`);
      }
      created.push(await res.json() as CustomBlock);
    }
    setBlocks(prev => [...prev, ...created]);
    created.forEach(b => { if (b.block_type === "schema") void loadUsage(b.id); });

    if (opts.targetPageId) {
      try {
        const pageRes = await fetch(`${API}/lp/pages/${opts.targetPageId}`);
        if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
        const page = await pageRes.json() as { id: number; blocks?: unknown[] };
        const existing = Array.isArray(page.blocks) ? page.blocks : [];
        const newInstances = created.map(cb => ({
          // Mirror the BuilderEditor's `addBlock` shape for schema custom
          // blocks (task #198): empty per-instance values so the page renders
          // the master's shared values until edited.
          id: `custom-schema-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${cb.id}`,
          type: "custom-schema",
          props: {
            schema: [],
            template: "",
            values: {},
            customBlockId: cb.id,
            customBlockName: cb.name,
          },
        }));
        const putRes = await fetch(`${API}/lp/pages/${opts.targetPageId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: [...existing, ...newInstances] }),
        });
        if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
        toast({
          title: `Added ${created.length} block${created.length === 1 ? "" : "s"} to page`,
          description: `"${opts.sectionName}" appended in order.`,
        });
      } catch (err) {
        toast({
          title: "Saved blocks, but couldn't append to page",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: `Saved ${created.length} block${created.length === 1 ? "" : "s"}`,
        description: `"${opts.sectionName}" is ready to drop into a page.`,
      });
    }
  };

  // Task #210 — accept a generated block and open the existing editor with
  // it prefilled, so the standard save path / segments / link-master flow all
  // work unchanged.
  const handleAcceptGenerated = (g: GeneratedBlock) => {
    setEditor({
      name: g.name || "Generated Block",
      block_type: "schema",
      segment: "core",
      html: "",
      schema: g.schema,
      template: g.template,
      sample: g.sample,
    });
    setSavedSnapshot(null);
    setEditorOpen(true);
  };

  const openEdit = (block: CustomBlock) => {
    const t = block.block_type as BlockEditorType;
    const schema = Array.isArray(block.props?.schema) ? block.props.schema : [];
    const template = typeof block.props?.template === "string" ? block.props.template : "";
    const sample = (block.props?.sample as Record<string, SchemaFieldValue>) ?? {};
    setEditor({
      id: block.id,
      name: block.name,
      block_type: t,
      segment: block.segment ?? "core",
      html: typeof block.props?.html === "string" ? block.props.html : "",
      schema,
      template,
      sample,
    });
    // Task #202 — snapshot what's saved so the preview panel can show a
    // before/after diff against the editor's pending changes.
    setSavedSnapshot({ schema, template, sample });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editor.name.trim()) return;
    // Task #198/#199 — affected-pages warning. Schema-block edits flow live
    // to every linked instance, so we surface the affected pages (with status
    // badges + builder links) in a confirmation dialog before saving.
    if (editor.id && editor.block_type === "schema") {
      const usage = await loadUsage(editor.id);
      if (usage.count > 0) {
        const ok = await new Promise<boolean>(resolve => {
          setConfirmUsage(usage);
          setConfirmResolver(() => resolve);
        });
        if (!ok) return;
      }
    }
    setIsSaving(true);
    try {
      const props =
        editor.block_type === "schema"
          ? { schema: editor.schema, template: editor.template, sample: editor.sample }
          : { html: editor.html };
      const body = {
        name: editor.name.trim(),
        block_type: editor.block_type,
        segment: editor.segment,
        props,
      };
      if (editor.id) {
        const updated = await fetch(`${API}/lp/custom-blocks/${editor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<CustomBlock>;
        });
        setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));
        if (updated.block_type === "schema") void loadUsage(updated.id);
        toast({ title: "Block updated" });
      } else {
        const created = await fetch(`${API}/lp/custom-blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<CustomBlock>;
        });
        setBlocks(prev => [...prev, created]);
        if (created.block_type === "schema") void loadUsage(created.id);
        toast({ title: "Custom block saved" });
      }
      setEditorOpen(false);
    } catch (err) {
      toast({ title: "Failed to save", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (block: CustomBlock) => {
    if (!confirm(`Delete "${block.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/lp/custom-blocks/${block.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBlocks(prev => prev.filter(b => b.id !== block.id));
      toast({ title: "Block deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const segmentLabel = (seg: string) => {
    if (!seg || seg === "core") return "Core";
    const found = segments.find(s => s.name === seg);
    return found ? found.name : seg;
  };

  const isKnownSegment = (seg: string) => {
    if (!seg || seg === "core") return true;
    return segments.some(s => s.name === seg);
  };

  /* ── Schema field editor helpers ──────────────────────────────────────── */

  const addField = () => {
    const id = newFieldId(editor.schema);
    setEditor(prev => ({
      ...prev,
      schema: [...prev.schema, { id, label: "New field", type: "text" }],
    }));
  };

  const updateField = (i: number, patch: Partial<SchemaFieldDef>) => {
    setEditor(prev => ({
      ...prev,
      schema: prev.schema.map((f, idx) => idx === i ? { ...f, ...patch } : f),
    }));
  };

  const removeField = (i: number) => {
    setEditor(prev => {
      const removed = prev.schema[i]?.id;
      const nextSample = { ...prev.sample };
      if (removed) delete nextSample[removed];
      return { ...prev, schema: prev.schema.filter((_, idx) => idx !== i), sample: nextSample };
    });
  };

  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= editor.schema.length) return;
    setEditor(prev => {
      const next = [...prev.schema];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, schema: next };
    });
  };

  const setSampleVal = (id: string, v: SchemaFieldValue) => {
    setEditor(prev => ({ ...prev, sample: { ...prev.sample, [id]: v } }));
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Custom Blocks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build reusable blocks with the rich text editor, custom HTML, or a schema-driven template with editable fields.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleAddGlobalFooterStarter}
            disabled={isAddingStarter || hasGlobalFooter}
            className="gap-2"
            title={hasGlobalFooter ? "You already have a Global Footer block" : "One-click starter: a global footer pre-populated for your brand"}
          >
            <Sparkles className="w-4 h-4" />
            {hasGlobalFooter ? "Global Footer added" : "Add starter: Global Footer"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setGenerateOpen(true)}
            className="gap-2"
            title="Describe a block in plain English and let AI draft it"
          >
            <Sparkles className="w-4 h-4" />
            Generate from prompt
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Block
          </Button>
        </div>
      </div>

      {/* Task #210 — Prompt → New Custom Block */}
      <GenerateBlockDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onAccept={handleAcceptGenerated}
        onAcceptBatch={handleAcceptBatch}
        pages={pagesForInsert}
      />

      {/* Block list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : blocks.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
            <Blocks className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No custom blocks yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4 leading-relaxed">
            Create your first block using the rich text editor, custom HTML, or a reusable schema.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Custom Block
            </Button>
            <Button
              onClick={handleAddGlobalFooterStarter}
              disabled={isAddingStarter || hasGlobalFooter}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Add starter: Global Footer
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map(block => (
            <div
              key={block.id}
              className="group border border-border rounded-xl bg-background p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{block.name}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {block.block_type === "rich-text" && (
                      <Badge variant="secondary" className="gap-1 text-xs"><Type className="w-3 h-3" />Rich Text</Badge>
                    )}
                    {block.block_type === "custom-html" && (
                      <Badge variant="secondary" className="gap-1 text-xs font-mono"><Code2 className="w-3 h-3" />HTML</Badge>
                    )}
                    {block.block_type === "schema" && (
                      <Badge variant="secondary" className="gap-1 text-xs bg-amber-50 text-amber-700 border-amber-200"><Database className="w-3 h-3" />Schema</Badge>
                    )}
                    <Badge
                      variant={(!block.segment || block.segment === "core") ? "outline" : "secondary"}
                      className={cn(
                        "gap-1 text-xs",
                        (!block.segment || block.segment === "core") && "text-muted-foreground",
                        block.segment && block.segment !== "core" && isKnownSegment(block.segment) && "bg-primary/8 text-primary border-primary/20",
                        block.segment && block.segment !== "core" && !isKnownSegment(block.segment) && "text-amber-600 border-amber-200 bg-amber-50"
                      )}
                    >
                      <LayoutGrid className="w-3 h-3" />
                      {segmentLabel(block.segment)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(block)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(block)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Content preview */}
              <div className="text-xs text-muted-foreground border border-border rounded-md p-2.5 bg-muted/30 min-h-[60px] max-h-[80px] overflow-hidden relative">
                {block.block_type === "rich-text" && (
                  <div
                    className="prose prose-xs max-w-none line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.props?.html || "<em>Empty</em>") }}
                  />
                )}
                {block.block_type === "custom-html" && (
                  <code className="text-[10px] font-mono text-muted-foreground line-clamp-3 whitespace-pre-wrap break-all">
                    {block.props?.html || "(empty)"}
                  </code>
                )}
                {block.block_type === "schema" && (
                  <div className="text-[11px] line-clamp-3">
                    {(block.props?.schema?.length ?? 0)} field{(block.props?.schema?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                    {block.props?.template ? `${(block.props?.template ?? "").length} chars template` : "no template yet"}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/30 to-transparent pointer-events-none" />
              </div>

              {/* Task #199 — "Used on" section for schema (master) blocks. */}
              {block.block_type === "schema" && (
                <UsedOnSection usage={usageById[block.id]} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={editorOpen} onOpenChange={v => { if (!v) setEditorOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editor.id ? "Edit Custom Block" : "New Custom Block"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Name */}
            <div>
              <Label className="text-sm font-medium">Block Name</Label>
              <Input
                className="mt-1.5"
                value={editor.name}
                onChange={e => setEditor(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Mission Statement, About Us"
                autoFocus
              />
            </div>

            {/* Type selector */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Block Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <TypeOption icon={<Type className="w-4 h-4" />} title="Rich Text" desc="Formatted content" active={editor.block_type === "rich-text"} onClick={() => setEditor(prev => ({ ...prev, block_type: "rich-text" }))} />
                <TypeOption icon={<Code2 className="w-4 h-4" />} title="Custom HTML" desc="Raw HTML / embeds" active={editor.block_type === "custom-html"} onClick={() => setEditor(prev => ({ ...prev, block_type: "custom-html" }))} />
                <TypeOption icon={<Database className="w-4 h-4" />} title="Schema" desc="Template + editable fields" active={editor.block_type === "schema"} onClick={() => setEditor(prev => ({ ...prev, block_type: "schema" }))} />
              </div>
            </div>

            {/* Tab assignment */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Tab Assignment</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setEditor(prev => ({ ...prev, segment: "core" }))}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-left transition-colors",
                    editor.segment === "core"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Core</p>
                    <p className="text-xs opacity-70">Blocks tab</p>
                  </div>
                </button>
                {segments.map(seg => (
                  <button
                    key={seg.id}
                    onClick={() => setEditor(prev => ({ ...prev, segment: seg.name }))}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-left transition-colors",
                      editor.segment === seg.name
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{seg.name}</p>
                      <p className="text-xs opacity-70">Segment tab</p>
                    </div>
                  </button>
                ))}
                {segments.length === 0 && (
                  <p className="text-xs text-muted-foreground self-center">
                    No segments defined yet.{" "}
                    <Link href="/brand-settings" className="underline underline-offset-2 hover:text-foreground">
                      Add segments in Brand Settings
                    </Link>{" "}
                    to assign this block to a segment tab.
                  </p>
                )}
              </div>
            </div>

            {/* Editor body */}
            {editor.block_type === "rich-text" && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Content</Label>
                <TiptapEditor
                  content={editor.html}
                  onChange={html => setEditor(prev => ({ ...prev, html }))}
                  placeholder="Start writing your content..."
                  showToolbar={true}
                />
              </div>
            )}

            {editor.block_type === "custom-html" && (
              <div>
                <Label className="text-sm font-medium mb-2 block">HTML</Label>
                <Textarea
                  value={editor.html}
                  onChange={e => setEditor(prev => ({ ...prev, html: e.target.value }))}
                  placeholder="<div>Paste your HTML here...</div>"
                  className="font-mono text-xs min-h-[200px] resize-y"
                  spellCheck={false}
                />
              </div>
            )}

            {editor.block_type === "schema" && (
              <div className="space-y-4">
                {/* Field schema editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Fields</Label>
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addField}>
                      <Plus className="w-3.5 h-3.5" /> Add field
                    </Button>
                  </div>
                  {editor.schema.length === 0 ? (
                    <div className="border border-dashed border-border rounded-md p-4 text-xs text-muted-foreground text-center">
                      No fields yet. Add fields editors will use to fill in this block.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {editor.schema.map((f, i) => (
                        <div key={i} className="border border-border rounded-md p-3 bg-muted/20 space-y-2">
                          <div className="flex items-center gap-1">
                            <button type="button" className="p-1 text-muted-foreground hover:text-foreground" onClick={() => moveField(i, -1)} aria-label="Move up">
                              <GripVertical className="w-3.5 h-3.5" />
                            </button>
                            <Input
                              className="h-8 text-xs flex-1"
                              value={f.id}
                              onChange={e => updateField(i, { id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_") })}
                              placeholder="field_id"
                            />
                            <Input
                              className="h-8 text-xs flex-1"
                              value={f.label}
                              onChange={e => updateField(i, { label: e.target.value })}
                              placeholder="Label"
                            />
                            <Select value={f.type} onValueChange={v => updateField(i, { type: v as SchemaFieldType })}>
                              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map(ft => (
                                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeField(i)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          {f.type === "select" && (
                            <Input
                              className="h-8 text-xs"
                              value={(f.options ?? []).join(", ")}
                              onChange={e => updateField(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                              placeholder="Options (comma-separated)"
                            />
                          )}
                          <Input
                            className="h-8 text-xs"
                            value={f.helpText ?? ""}
                            onChange={e => updateField(i, { helpText: e.target.value })}
                            placeholder="Help text (optional)"
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={f.required ?? false}
                              onChange={e => updateField(i, { required: e.target.checked })}
                            />
                            Required field
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Template */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Template
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      Use <code className="bg-muted px-1 rounded">{"{{field_id}}"}</code> placeholders. HTML/CSS supported.
                    </span>
                  </Label>
                  <Textarea
                    value={editor.template}
                    onChange={e => setEditor(prev => ({ ...prev, template: e.target.value }))}
                    placeholder={`<div style="padding:24px;background:{{bg}};color:#fff">\n  <h2>{{headline}}</h2>\n  <p>{{body}}</p>\n</div>`}
                    className="font-mono text-xs min-h-[180px] resize-y"
                    spellCheck={false}
                  />
                </div>

                {/* Task #202 — Live before/after preview. Renders the proposed
                    template/schema against the master sample values so editors
                    can catch breaking changes (missing fields, broken HTML)
                    without round-tripping through every linked page. */}
                <div className="rounded-md border border-border bg-background">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Preview change</Label>
                      <span className="text-[11px] text-muted-foreground">
                        Rendered with the shared (master) values below.
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setShowPreview(v => !v)}
                    >
                      {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPreview ? "Hide" : "Show"}
                    </Button>
                  </div>
                  {showPreview && (
                    savedSnapshot ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                        <div className="p-2">
                          <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Current</span>
                            <Badge variant="outline" className="text-[10px]">Saved</Badge>
                          </div>
                          <div className="border border-border rounded bg-white overflow-hidden">
                            <SchemaPreviewFrame
                              schema={savedSnapshot.schema}
                              template={savedSnapshot.template}
                              values={savedSnapshot.sample}
                            />
                          </div>
                        </div>
                        <div className="p-2">
                          <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">New</span>
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">Pending</Badge>
                          </div>
                          <div className="border border-primary/30 rounded bg-white overflow-hidden ring-1 ring-primary/10">
                            <SchemaPreviewFrame
                              schema={editor.schema}
                              template={editor.template}
                              values={editor.sample}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2">
                        <div className="border border-border rounded bg-white overflow-hidden">
                          <SchemaPreviewFrame
                            schema={editor.schema}
                            template={editor.template}
                            values={editor.sample}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Shared default values — flow live to every linked instance (task #198). */}
                {editor.schema.length > 0 && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <Label className="text-sm font-medium mb-1 block">Shared content (master values)</Label>
                    <p className="text-xs text-muted-foreground mb-3 leading-snug">
                      These values appear on every page that uses this block. Editing them updates all linked instances at once. Pages can override individual fields locally — those overrides win for that page only.
                    </p>
                    <div className="space-y-2">
                      {editor.schema.map(f => (
                        <div key={f.id} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                          <Label className="text-xs text-muted-foreground truncate">{f.label}</Label>
                          {f.type === "boolean" ? (
                            <Select value={String(editor.sample[f.id] ?? false)} onValueChange={v => setSampleVal(f.id, v === "true")}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : f.type === "longText" ? (
                            <Textarea
                              rows={2}
                              className="text-xs"
                              value={String(editor.sample[f.id] ?? "")}
                              onChange={e => setSampleVal(f.id, e.target.value)}
                            />
                          ) : f.type === "number" ? (
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={String(editor.sample[f.id] ?? "")}
                              onChange={e => setSampleVal(f.id, Number(e.target.value))}
                            />
                          ) : f.type === "color" ? (
                            <Input
                              type="color"
                              className="h-8"
                              value={String(editor.sample[f.id] ?? "#000000")}
                              onChange={e => setSampleVal(f.id, e.target.value)}
                            />
                          ) : (
                            <Input
                              className="h-8 text-xs"
                              value={String(editor.sample[f.id] ?? "")}
                              onChange={e => setSampleVal(f.id, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !editor.name.trim()} className="gap-2">
              {isSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {isSaving ? "Saving…" : editor.id ? "Save Changes" : "Save Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task #199 — Affected-pages confirm dialog. Replaces native confirm()
          with a list of pages (status badge + open-in-new-tab link) so editors
          can preview the impact before saving a master schema-block change. */}
      <Dialog
        open={confirmUsage !== null}
        onOpenChange={open => {
          if (!open && confirmResolver) {
            confirmResolver(false);
            setConfirmResolver(null);
            setConfirmUsage(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Update {confirmUsage?.count ?? 0} page{confirmUsage?.count === 1 ? "" : "s"}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm overflow-y-auto pr-1">
            <p className="text-muted-foreground leading-snug">
              This block is used on {confirmUsage?.count ?? 0} page{confirmUsage?.count === 1 ? "" : "s"}
              {confirmUsage && confirmUsage.publishedCount > 0 ? ` (${confirmUsage.publishedCount} published)` : ""}.
              Saving will update the schema, template, and shared default values everywhere it's used.
              Per-page field overrides are kept.
            </p>

            {/* Task #202 — optional thumbnail diff for the first matching page,
                so editors get a final before/after sanity check inline with
                the impact list. Rendered with the master sample values; pages
                with per-field overrides will look slightly different. */}
            {savedSnapshot && confirmUsage && confirmUsage.pages.length > 0 && (
              <div className="rounded-md border border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      Preview · {confirmUsage.pages[0].title || `Page ${confirmUsage.pages[0].id}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Rendered with shared values — per-page overrides may differ.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs shrink-0"
                    onClick={() => setShowConfirmDiff(v => !v)}
                  >
                    {showConfirmDiff ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showConfirmDiff ? "Hide" : "Show"}
                  </Button>
                </div>
                {showConfirmDiff && (
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Current</span>
                      </div>
                      <div className="border border-border rounded bg-white overflow-hidden">
                        <SchemaPreviewFrame
                          mode="thumbnail"
                          schema={savedSnapshot.schema}
                          template={savedSnapshot.template}
                          values={savedSnapshot.sample}
                        />
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className="text-[10px] font-medium text-primary uppercase tracking-wide">New</span>
                      </div>
                      <div className="border border-primary/30 rounded bg-white overflow-hidden ring-1 ring-primary/10">
                        <SchemaPreviewFrame
                          mode="thumbnail"
                          schema={editor.schema}
                          template={editor.template}
                          values={editor.sample}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
              {confirmUsage?.pages.map(p => (
                <a
                  key={p.id}
                  href={`/builder/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-foreground">{p.title || `Page ${p.id}`}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] capitalize",
                      p.status === "published" && "bg-green-50 text-green-700 border-green-200",
                      p.status === "draft" && "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    {p.status}
                  </Badge>
                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (confirmResolver) confirmResolver(false);
                setConfirmResolver(null);
                setConfirmUsage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmResolver) confirmResolver(true);
                setConfirmResolver(null);
                setConfirmUsage(null);
              }}
            >
              Save and update {confirmUsage?.count ?? 0} page{confirmUsage?.count === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsedOnSection({ usage }: { usage?: BlockUsage }) {
  if (!usage) {
    return (
      <div className="text-[11px] text-muted-foreground">Checking usage…</div>
    );
  }
  if (usage.count === 0) {
    return (
      <div className="text-[11px] text-muted-foreground">Not used on any pages yet</div>
    );
  }
  const preview = usage.pages.slice(0, 3);
  const extra = usage.count - preview.length;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Used on {usage.count} page{usage.count === 1 ? "" : "s"}
        {usage.publishedCount > 0 ? ` · ${usage.publishedCount} published` : ""}
      </p>
      <div className="flex flex-wrap gap-1">
        {preview.map(p => (
          <a
            key={p.id}
            href={`/builder/${p.id}`}
            target="_blank"
            rel="noreferrer"
            title={`${p.title} (${p.status})`}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] max-w-[140px] hover:bg-muted/50",
              p.status === "published"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200",
            )}
          >
            <span className="truncate">{p.title || `Page ${p.id}`}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        ))}
        {extra > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground">
            +{extra} more
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Build the request body for a one-click "Global Footer" starter — a schema
 * custom block (Task #198 global block) pre-populated with sensible fields and
 * an HTML/CSS template. Editing the master once flows through to every page
 * footer that links to it.
 */
function buildGlobalFooterStarter(brand: BrandConfig) {
  const brandName = (brand.brandName || "Your Company").trim();
  const primary = brand.primaryColor || "#0f172a";
  const accent = brand.accentColor || "#3b82f6";
  const year = new Date().getFullYear();

  const schema: SchemaFieldDef[] = [
    { id: "company_name", label: "Company name", type: "text", required: true },
    { id: "tagline", label: "Tagline", type: "text", helpText: "Short line shown under the company name" },
    { id: "address", label: "Address", type: "longText", helpText: "Street, city, postal code" },
    { id: "phone", label: "Phone", type: "text" },
    { id: "email", label: "Email", type: "text" },
    { id: "twitter_url", label: "Twitter / X URL", type: "url" },
    { id: "linkedin_url", label: "LinkedIn URL", type: "url" },
    { id: "instagram_url", label: "Instagram URL", type: "url" },
    { id: "facebook_url", label: "Facebook URL", type: "url" },
    { id: "copyright", label: "Copyright text", type: "text" },
    { id: "background_color", label: "Background color", type: "color" },
    { id: "text_color", label: "Text color", type: "color" },
    { id: "accent_color", label: "Accent color", type: "color" },
  ];

  const sample: Record<string, SchemaFieldValue> = {
    company_name: brandName,
    tagline: "",
    address: "",
    phone: "",
    email: "",
    twitter_url: "",
    linkedin_url: "",
    instagram_url: "",
    facebook_url: "",
    copyright: `© ${year} ${brandName}. All rights reserved.`,
    background_color: primary,
    text_color: "#ffffff",
    accent_color: accent,
  };

  const template = `<footer style="background:{{background_color}};color:{{text_color}};padding:48px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;">
    <div>
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;">{{company_name}}</div>
      <div style="margin-top:8px;font-size:14px;opacity:0.75;">{{tagline}}</div>
    </div>
    <div style="font-size:14px;line-height:1.7;opacity:0.85;">
      <div style="font-weight:600;margin-bottom:8px;opacity:1;">Contact</div>
      <div style="white-space:pre-line;">{{address}}</div>
      <div>{{phone}}</div>
      <div><a href="mailto:{{email}}" style="color:{{accent_color}};text-decoration:none;">{{email}}</a></div>
    </div>
    <div style="font-size:14px;line-height:1.9;">
      <div style="font-weight:600;margin-bottom:8px;">Follow</div>
      <div><a href="{{twitter_url}}" style="color:{{accent_color}};text-decoration:none;">Twitter / X</a></div>
      <div><a href="{{linkedin_url}}" style="color:{{accent_color}};text-decoration:none;">LinkedIn</a></div>
      <div><a href="{{instagram_url}}" style="color:{{accent_color}};text-decoration:none;">Instagram</a></div>
      <div><a href="{{facebook_url}}" style="color:{{accent_color}};text-decoration:none;">Facebook</a></div>
    </div>
  </div>
  <div style="max-width:1100px;margin:32px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,0.15);font-size:12px;opacity:0.7;">
    {{copyright}}
  </div>
</footer>`;

  return {
    name: "Global Footer",
    block_type: "schema",
    segment: "core",
    props: { schema, template, sample },
  };
}

function TypeOption({ icon, title, desc, active, onClick }: { icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 px-3 py-3 rounded-lg border-2 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/40"
      )}
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs opacity-70 mt-0.5 truncate">{desc}</p>
      </div>
    </button>
  );
}
