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
import { Plus, Pencil, Trash2, Code2, Type, Blocks, LayoutGrid, Database, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBrandConfig, DEFAULT_BRAND, type AudienceSegment } from "@/lib/brand-config";
import { Link } from "wouter";
import type { SchemaFieldDef, SchemaFieldType, SchemaFieldValue } from "@/lib/block-types";

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
  const [isLoading, setIsLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch(`${API}/lp/custom-blocks`).then(r => r.json() as Promise<CustomBlock[]>).catch(() => [] as CustomBlock[]),
      fetchBrandConfig().catch(() => DEFAULT_BRAND),
    ]).then(([data, brand]) => {
      setBlocks(data);
      setSegments(brand.segments ?? []);
    }).finally(() => setIsLoading(false));
  }, []);

  const openCreate = () => {
    setEditor(EMPTY_EDITOR);
    setEditorOpen(true);
  };

  const openEdit = (block: CustomBlock) => {
    const t = block.block_type as BlockEditorType;
    setEditor({
      id: block.id,
      name: block.name,
      block_type: t,
      segment: block.segment ?? "core",
      html: typeof block.props?.html === "string" ? block.props.html : "",
      schema: Array.isArray(block.props?.schema) ? block.props.schema : [],
      template: typeof block.props?.template === "string" ? block.props.template : "",
      sample: (block.props?.sample as Record<string, SchemaFieldValue>) ?? {},
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editor.name.trim()) return;
    // Task #198 — affected-pages warning. Schema-block edits flow live to
    // every linked instance, so confirm with the editor before saving when
    // pages depend on this master.
    if (editor.id && editor.block_type === "schema") {
      try {
        const usage = await fetch(`${API}/lp/custom-blocks/${editor.id}/usage`)
          .then(r => r.ok ? r.json() as Promise<{ count: number; publishedCount: number }> : { count: 0, publishedCount: 0 });
        if (usage.count > 0) {
          const lines = [
            `This block is used on ${usage.count} page${usage.count === 1 ? "" : "s"}` +
              (usage.publishedCount > 0 ? ` (${usage.publishedCount} published).` : "."),
            "",
            "Saving will update the schema, template, and shared default values everywhere this block is used. Per-page field overrides are kept.",
            "",
            "Continue?",
          ];
          if (!confirm(lines.join("\n"))) return;
        }
      } catch {
        // Don't block saving on a usage-fetch failure.
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
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          New Block
        </Button>
      </div>

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
          <Button onClick={openCreate} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Create Custom Block
          </Button>
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
    </div>
  );
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
