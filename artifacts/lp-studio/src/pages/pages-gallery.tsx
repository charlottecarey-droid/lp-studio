import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit2, ExternalLink, Trash2, FileText, Globe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LP_TEMPLATES } from "@/lib/templates";
import { createBlock, templateToBlocks, type PageBlock } from "@/lib/block-types";

const API_BASE = "/api";

interface Page {
  id: number;
  title: string;
  slug: string;
  blocks: unknown[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

async function fetchPages(): Promise<Page[]> {
  const res = await fetch(`${API_BASE}/lp/pages`);
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json() as Promise<Page[]>;
}

interface CreatePageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  status: "draft" | "published";
}

async function createPage(data: CreatePageData) {
  const res = await fetch(`${API_BASE}/lp/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create page" }));
    throw new Error(err.error ?? "Failed to create page");
  }
  return res.json();
}

async function deletePage(id: number) {
  await fetch(`${API_BASE}/lp/pages/${id}`, { method: "DELETE" });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TEMPLATE_OPTIONS = [
  { id: "blank", name: "Blank Canvas", description: "Start from scratch with an empty page" },
  ...LP_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description })),
];

function getTemplateBlocks(templateId: string): PageBlock[] {
  if (templateId === "blank") return [];
  return templateToBlocks(templateId);
}

export default function PagesGallery() {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const load = () => {
    setIsLoading(true);
    fetchPages()
      .then(setPages)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleTitleChange = (v: string) => {
    setNewTitle(v);
    setNewSlug(slugify(v));
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const blocks = getTemplateBlocks(selectedTemplate);
      const page = await createPage({ title: newTitle.trim(), slug: newSlug.trim(), blocks, status: "draft" });
      setShowCreateModal(false);
      setNewTitle("");
      setNewSlug("");
      setSelectedTemplate("blank");
      navigate(`/builder/${page.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (page: Page) => {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    await deletePage(page.id);
    setPages(prev => prev.filter(p => p.id !== page.id));
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Pages</h1>
            <p className="text-muted-foreground mt-1">Build and publish landing pages with the drag-and-drop editor.</p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            New Page
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No pages yet</h3>
            <p className="text-muted-foreground mb-6 text-sm">Create your first page to get started.</p>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Page
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map(page => (
              <div
                key={page.id}
                className="group relative bg-background rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Page thumbnail area */}
                <div className="h-28 bg-gradient-to-br from-[#003A30]/5 via-[#E8F5F2] to-[#C7E738]/10 relative overflow-hidden">
                  <div className="absolute inset-0 flex flex-col gap-1.5 p-3 opacity-50">
                    <div className="h-2 w-3/4 bg-[#003A30] rounded" />
                    <div className="h-1.5 w-1/2 bg-[#003A30]/60 rounded" />
                    <div className="h-4 w-20 bg-[#C7E738] rounded-full mt-1" />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        page.status === "published"
                          ? "bg-green-500/10 text-green-700 border-green-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      {page.status === "published" ? (
                        <><Globe className="w-2.5 h-2.5 mr-1 inline" />Live</>
                      ) : (
                        <><Clock className="w-2.5 h-2.5 mr-1 inline" />Draft</>
                      )}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 left-3">
                    <span className="text-[10px] text-[#003A30]/50 font-mono">{page.blocks?.length ?? 0} block{page.blocks?.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Page info */}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{page.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">/lp/{page.slug}</p>
                  </div>

                  <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3 mr-0.5" />
                    Updated {formatDate(page.updatedAt)}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Link href={`/builder/${page.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <a
                      href={`/lp-studio/lp/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" className="px-2" title="Preview">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 text-muted-foreground hover:text-red-500"
                      title="Delete"
                      onClick={() => handleDelete(page)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Page Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm font-medium">Page Name</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Summer Promotion"
                value={newTitle}
                onChange={e => handleTitleChange(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium">URL Slug</Label>
              <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                <Input
                  className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                  placeholder="page-slug"
                  value={newSlug}
                  onChange={e => setNewSlug(slugify(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Starting Template</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {TEMPLATE_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={cn(
                      "text-left p-3 rounded-xl border text-sm transition-all",
                      selectedTemplate === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <p className="font-medium text-xs text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
            {createError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newTitle.trim() || !newSlug.trim()}
              className="gap-2"
            >
              {isCreating ? "Creating..." : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
