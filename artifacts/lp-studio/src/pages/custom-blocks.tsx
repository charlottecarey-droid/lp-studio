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
import { Plus, Pencil, Trash2, Code2, Type, Blocks, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBrandConfig, DEFAULT_BRAND, type AudienceSegment } from "@/lib/brand-config";
import { Link } from "wouter";

const API = "/api";

interface CustomBlock {
  id: number;
  name: string;
  block_type: string;
  props: { html: string };
  segment: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type BlockEditorType = "rich-text" | "custom-html";

interface EditorState {
  id?: number;
  name: string;
  block_type: BlockEditorType;
  segment: string;
  html: string;
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
  const [editor, setEditor] = useState<EditorState>({ name: "", block_type: "rich-text", segment: "core", html: "" });
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
    setEditor({ name: "", block_type: "rich-text", segment: "core", html: "" });
    setEditorOpen(true);
  };

  const openEdit = (block: CustomBlock) => {
    setEditor({
      id: block.id,
      name: block.name,
      block_type: block.block_type as BlockEditorType,
      segment: block.segment ?? "core",
      html: block.props?.html ?? "",
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editor.name.trim()) return;
    setIsSaving(true);
    try {
      const body = {
        name: editor.name.trim(),
        block_type: editor.block_type,
        segment: editor.segment,
        props: { html: editor.html },
      };
      if (editor.id) {
        const updated = await fetch(`${API}/lp/custom-blocks/${editor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => r.json() as Promise<CustomBlock>);
        setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));
        toast({ title: "Block updated" });
      } else {
        const created = await fetch(`${API}/lp/custom-blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => r.json() as Promise<CustomBlock>);
        setBlocks(prev => [...prev, created]);
        toast({ title: "Custom block saved" });
      }
      setEditorOpen(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (block: CustomBlock) => {
    if (!confirm(`Delete "${block.name}"? This cannot be undone.`)) return;
    try {
      await fetch(`${API}/lp/custom-blocks/${block.id}`, { method: "DELETE" });
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Custom Blocks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build reusable blocks with the Rich Text editor or custom HTML. Assign them to the Blocks tab (Core) or a segment-specific tab.
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
            Create your first block using the Rich Text editor or paste custom HTML.
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
                    {block.block_type === "rich-text" ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Type className="w-3 h-3" />
                        Rich Text
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs font-mono">
                        <Code2 className="w-3 h-3" />
                        HTML
                      </Badge>
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
              <div
                className="text-xs text-muted-foreground border border-border rounded-md p-2.5 bg-muted/30 min-h-[60px] max-h-[80px] overflow-hidden relative"
              >
                {block.block_type === "rich-text" ? (
                  <div
                    className="prose prose-xs max-w-none line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.props?.html || "<em>Empty</em>") }}
                  />
                ) : (
                  <code className="text-[10px] font-mono text-muted-foreground line-clamp-3 whitespace-pre-wrap break-all">
                    {block.props?.html || "(empty)"}
                  </code>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/30 to-transparent pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={editorOpen} onOpenChange={v => { if (!v) setEditorOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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
              <div className="flex gap-2">
                <button
                  onClick={() => setEditor(prev => ({ ...prev, block_type: "rich-text" }))}
                  className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                    editor.block_type === "rich-text"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Type className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Rich Text</p>
                    <p className="text-xs opacity-70 mt-0.5">Formatted content with headings, lists, links</p>
                  </div>
                </button>
                <button
                  onClick={() => setEditor(prev => ({ ...prev, block_type: "custom-html" }))}
                  className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                    editor.block_type === "custom-html"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Code2 className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Custom HTML</p>
                    <p className="text-xs opacity-70 mt-0.5">Raw HTML — embeds, widgets, advanced layouts</p>
                  </div>
                </button>
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

            {/* Editor */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Content</Label>
              {editor.block_type === "rich-text" ? (
                <TiptapEditor
                  content={editor.html}
                  onChange={html => setEditor(prev => ({ ...prev, html }))}
                  placeholder="Start writing your content..."
                  showToolbar={true}
                />
              ) : (
                <Textarea
                  value={editor.html}
                  onChange={e => setEditor(prev => ({ ...prev, html: e.target.value }))}
                  placeholder="<div>Paste your HTML here...</div>"
                  className="font-mono text-xs min-h-[200px] resize-y"
                  spellCheck={false}
                />
              )}
            </div>
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
