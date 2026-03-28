import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Star, Loader2, Pencil, Check, X, BookOpen, Image, Search, Upload, FolderOpen, Tag, ChevronLeft, ChevronRight, Sparkles, Copy, ExternalLink, Calendar, HardDrive, FileType2, Users, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImagePicker } from "@/components/ImagePicker";

const API_BASE = "/api";

type LibraryType = "product_showcase" | "product_grid" | "case_study" | "resource" | "team_member";

interface LibraryItem {
  id: number;
  type: LibraryType;
  name: string;
  content: Record<string, unknown>;
  is_default: boolean;
  sort_order: number;
}

function useLibrary(type: LibraryType) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/lp/library/${type}`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [type]);

  const create = async (name: string, content: Record<string, unknown>) => {
    await fetch(`${API_BASE}/lp/library/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_default: false }),
    });
    reload();
  };

  const update = async (id: number, name: string, content: Record<string, unknown>, is_default: boolean) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_default }),
    });
    reload();
  };

  const toggleDefault = async (id: number) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}/default`, { method: "PATCH" });
    reload();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}`, { method: "DELETE" });
    reload();
  };

  return { items, loading, reload, create, update, toggleDefault, remove };
}


function ProductShowcaseForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { name?: string; description?: string; badge?: string; image?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Product name" value={v.name ?? ""} onChange={e => onChange({ ...v, name: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Description" value={v.description ?? ""} onChange={e => onChange({ ...v, description: e.target.value })} rows={2} className="text-xs resize-none" />
      <Input placeholder="Badge e.g. FROM $99/UNIT" value={v.badge ?? ""} onChange={e => onChange({ ...v, badge: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Image (optional)" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
    </div>
  );
}

function ProductGridForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { title?: string; description?: string; image?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Description" value={v.description ?? ""} onChange={e => onChange({ ...v, description: e.target.value })} rows={2} className="text-xs resize-none" />
      <ImagePicker label="Image (optional)" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
    </div>
  );
}

function CaseStudyForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { title?: string; categories?: string; url?: string; image?: string; logoUrl?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Categories e.g. INDUSTRY / SIZE" value={v.categories ?? ""} onChange={e => onChange({ ...v, categories: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Link URL" value={v.url ?? ""} onChange={e => onChange({ ...v, url: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Cover image" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
      <ImagePicker label="Logo" value={v.logoUrl ?? ""} onChange={url => onChange({ ...v, logoUrl: url })} />
    </div>
  );
}

function ResourceForm({
  value, onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const v = value as { title?: string; description?: string; category?: string; url?: string; image?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Description" value={v.description ?? ""} onChange={e => onChange({ ...v, description: e.target.value })} rows={2} className="text-xs resize-none" />
      <Input placeholder="Category e.g. Article, Guide" value={v.category ?? ""} onChange={e => onChange({ ...v, category: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Link URL" value={v.url ?? ""} onChange={e => onChange({ ...v, url: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Image (optional)" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} />
    </div>
  );
}

function TeamMemberForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const v = value as { name?: string; role?: string; email?: string; calendlyUrl?: string; photo?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Full name" value={v.name ?? ""} onChange={e => onChange({ ...v, name: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Role / Title (e.g. Enterprise AE)" value={v.role ?? ""} onChange={e => onChange({ ...v, role: e.target.value })} className="text-xs h-7" />
      <Input placeholder="email@meetdandy.com" value={v.email ?? ""} onChange={e => onChange({ ...v, email: e.target.value })} className="text-xs h-7" />
      <Input placeholder="ChiliPiper / Calendly URL" value={v.calendlyUrl ?? ""} onChange={e => onChange({ ...v, calendlyUrl: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Headshot" value={v.photo ?? ""} onChange={url => onChange({ ...v, photo: url })} />
    </div>
  );
}

function getDefaultContent(type: LibraryType): Record<string, unknown> {
  if (type === "product_showcase") return { name: "", description: "", badge: "", image: "" };
  if (type === "product_grid") return { title: "", description: "", image: "" };
  if (type === "case_study") return { title: "", categories: "", url: "#", image: "", logoUrl: "" };
  if (type === "team_member") return { name: "", role: "", email: "", calendlyUrl: "", photo: "" };
  return { title: "", description: "", category: "Article", url: "#", image: "" };
}

function ContentForm({ type, value, onChange }: { type: LibraryType; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  if (type === "product_showcase") return <ProductShowcaseForm value={value} onChange={onChange} />;
  if (type === "product_grid") return <ProductGridForm value={value} onChange={onChange} />;
  if (type === "case_study") return <CaseStudyForm value={value} onChange={onChange} />;
  if (type === "team_member") return <TeamMemberForm value={value} onChange={onChange} />;
  return <ResourceForm value={value} onChange={onChange} />;
}

function getPreviewText(item: LibraryItem): string {
  const c = item.content as Record<string, unknown>;
  if (item.type === "product_showcase") return String(c.description ?? "").slice(0, 80);
  if (item.type === "product_grid") return String(c.description ?? "").slice(0, 80);
  if (item.type === "case_study") return String(c.categories ?? "");
  if (item.type === "team_member") return [c.role, c.email].filter(Boolean).join(" · ");
  return String(c.category ?? "");
}

interface LibraryItemCardProps {
  item: LibraryItem;
  type: LibraryType;
  onToggleDefault: () => void;
  onDelete: () => void;
  onUpdate: (name: string, content: Record<string, unknown>, is_default: boolean) => void;
}

function LibraryItemCard({ item, type, onToggleDefault, onDelete, onUpdate }: LibraryItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState<Record<string, unknown>>(item.content);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onUpdate(name, content, item.is_default);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => {
    setName(item.name);
    setContent(item.content);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border rounded-xl p-4 space-y-3 bg-white shadow-sm">
        <div>
          <Label className="text-[11px] text-slate-500 mb-1 block">Library name (internal label)</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="text-xs h-7" placeholder="e.g. Crown & Bridge" />
        </div>
        <ContentForm type={type} value={content} onChange={setContent} />
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={cancel}>
            <X className="w-3 h-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 flex items-start gap-3 bg-white hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-800 truncate">{item.name || "(unnamed)"}</span>
          {item.is_default && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-400 text-amber-600 gap-0.5 shrink-0">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> Default
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{getPreviewText(item)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          title={item.is_default ? "Remove from defaults" : "Mark as default"}
          onClick={onToggleDefault}
          className={`p-1.5 rounded-lg transition-colors ${item.is_default ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-amber-400 hover:bg-amber-50"}`}
        >
          <Star className={`w-3.5 h-3.5 ${item.is_default ? "fill-amber-400" : ""}`} />
        </button>
        <button
          title="Edit"
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          title="Delete"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddItemForm({ type, onCreate }: { type: LibraryType; onCreate: (name: string, content: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>(getDefaultContent(type));
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    await onCreate(name, content);
    setName("");
    setContent(getDefaultContent(type));
    setOpen(false);
    setSaving(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Add Item
      </Button>
    );
  }

  return (
    <div className="border-2 border-dashed border-[#C7E738]/60 rounded-xl p-4 space-y-3 bg-[#C7E738]/5">
      <div>
        <Label className="text-[11px] text-slate-500 mb-1 block">Library name (internal label)</Label>
        <Input value={name} onChange={e => setName(e.target.value)} className="text-xs h-7" placeholder="e.g. Crown & Bridge" />
      </div>
      <ContentForm type={type} value={content} onChange={setContent} />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleCreate} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add to Library
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

interface MediaItem {
  id: number;
  title: string;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  tags: string[];
  createdAt: string;
}

interface TagCount {
  tag: string;
  count: number;
}

const MEDIA_PAGE_SIZE = 48;

function MediaTab() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [editTagValue, setEditTagValue] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyMsg, setReclassifyMsg] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [modalImage, setModalImage] = useState<MediaItem | null>(null);
  const [modalTagEdit, setModalTagEdit] = useState(false);
  const [modalTagValue, setModalTagValue] = useState("");
  const [modalCopied, setModalCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeTag) params.set("tag", activeTag);
      params.set("page", String(pg));
      params.set("limit", String(MEDIA_PAGE_SIZE));
      const res = await fetch(`/api/lp/media/images?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { items: MediaItem[]; tagCounts: TagCount[]; total: number; page: number; totalPages: number };
      setItems(data.items);
      setTagCounts(data.tagCounts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeTag, page]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setQuery(value);
    setPage(1);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchImages(1), 300);
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    setPage(1);
    setSelectMode(false);
    setSelected(new Set());
  };

  const handlePageChange = (pg: number) => {
    setPage(pg);
    fetchImages(pg);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadProgress({ current: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      try {
        const relativePath = (files[i] as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const folderParts = relativePath.split("/").slice(0, -1).filter(Boolean);
        const folderTags = folderParts.map(p => p.toLowerCase().replace(/[_-]+/g, " ").trim());
        const formData = new FormData();
        formData.append("file", files[i]);
        if (folderTags.length > 0) formData.append("folderTags", folderTags.join(","));
        const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
        if (!res.ok) failed++;
      } catch { failed++; }
    }
    await fetchImages();
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (failed > 0) alert(`${failed} of ${files.length} files failed to upload.`);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files ?? []).filter(f => f.type.startsWith("image/")));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    uploadFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")));
  };

  const handleSaveTags = async (id: number) => {
    const tags = editTagValue.split(",").map(t => t.trim()).filter(Boolean);
    try {
      await fetch(`/api/lp/media/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      setEditingTags(null);
      fetchImages();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/lp/media/${id}`, { method: "DELETE" });
      fetchImages();
    } catch { /* silent */ }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every(i => selected.has(i.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} image${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true);
    await Promise.all([...selected].map(id => fetch(`/api/lp/media/${id}`, { method: "DELETE" }).catch(() => {})));
    setSelected(new Set());
    setSelectMode(false);
    setDeleting(false);
    await fetchImages();
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleReclassify = async (force = false) => {
    if (reclassifying) return;
    setReclassifying(true);
    setReclassifyMsg(force ? "Re-scanning all images…" : "Starting…");
    try {
      const url = force ? "/api/lp/media/reclassify?force=true" : "/api/lp/media/reclassify";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json() as { total: number; message?: string };
      setReclassifyMsg(data.total === 0
        ? "All images already classified!"
        : `Classifying ${data.total} images in the background — refresh in a moment.`);
      setTimeout(() => { setReclassifyMsg(""); setReclassifying(false); }, 6000);
    } catch {
      setReclassifyMsg("Failed to start.");
      setTimeout(() => { setReclassifyMsg(""); setReclassifying(false); }, 3000);
    }
  };

  const PURPOSES = ["lp-hero", "lp-feature", "product-detail"];

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openModal = (item: MediaItem) => {
    setModalImage(item);
    setModalTagEdit(false);
    setModalTagValue(item.tags.join(", "));
    setModalCopied(false);
  };

  const closeModal = () => { setModalImage(null); setModalTagEdit(false); };

  const handleModalSaveTags = async () => {
    if (!modalImage) return;
    const newTags = modalTagValue.split(",").map(t => t.trim()).filter(Boolean);
    await fetch(`/api/lp/media/images/${modalImage.id}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    const updated = { ...modalImage, tags: newTags };
    setModalImage(updated);
    setItems(prev => prev.map(i => i.id === modalImage.id ? updated : i));
    setModalTagEdit(false);
  };

  const handleModalDelete = async () => {
    if (!modalImage) return;
    if (!confirm(`Delete "${modalImage.title}"? This cannot be undone.`)) return;
    await handleDelete(modalImage.id, modalImage.title);
    closeModal();
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
    });
  };

  const totalCount = tagCounts.reduce((sum, tc) => sum + tc.count, 0);

  return (
    <>
    <div className="flex gap-5 items-start min-h-0">

      {/* ── Category sidebar ── */}
      {!selectMode && tagCounts.length > 0 && (
        <div className="w-44 shrink-0 sticky top-0 self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-2">Categories</p>
          <div className="space-y-0.5">
            {/* All */}
            <button
              onClick={() => { if (activeTag) handleTagClick(""); }}
              className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                !activeTag ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
              }`}
            >
              <span className="truncate">All images</span>
              <span className={`text-[11px] ml-1 shrink-0 ${!activeTag ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{totalCount}</span>
            </button>
            {/* Each tag */}
            {(() => {
              const SIDEBAR_LIMIT = 10;
              const activeIdx = tagCounts.findIndex(tc => tc.tag === activeTag);
              const mustExpand = activeIdx >= SIDEBAR_LIMIT;
              const showAll = sidebarExpanded || mustExpand;
              const visible = showAll ? tagCounts : tagCounts.slice(0, SIDEBAR_LIMIT);
              const hidden = tagCounts.length - SIDEBAR_LIMIT;
              return (
                <>
                  {visible.map(tc => (
                    <button
                      key={tc.tag}
                      onClick={() => handleTagClick(tc.tag === activeTag ? "" : tc.tag)}
                      className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                        activeTag === tc.tag ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="truncate capitalize">{tc.tag}</span>
                      <span className={`text-[11px] ml-1 shrink-0 ${activeTag === tc.tag ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{tc.count}</span>
                    </button>
                  ))}
                  {hidden > 0 && (
                    <button
                      onClick={() => setSidebarExpanded(v => !v)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
                    >
                      {showAll ? "↑ Show less" : `+ ${hidden} more`}
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {/* Classify existing images */}
          <div className="mt-4 pt-3 border-t border-border">
            <button
              onClick={() => handleReclassify(false)}
              disabled={reclassifying}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Classify untagged images so the AI page generator picks the right image for each section"
            >
              {reclassifying
                ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                : <Sparkles className="w-3 h-3 shrink-0" />}
              <span className="text-left leading-tight">
                {reclassifying ? "Classifying…" : "Classify for AI"}
              </span>
            </button>
            <button
              onClick={() => handleReclassify(true)}
              disabled={reclassifying}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Re-scan ALL images — use this to fix OG/social images that were incorrectly tagged as hero or feature images"
            >
              {reclassifying
                ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                : <RefreshCw className="w-3 h-3 shrink-0" />}
              <span className="text-left leading-tight">
                Re-scan all (fix OG images)
              </span>
            </button>
            {reclassifyMsg && (
              <p className="mt-1.5 px-2.5 text-[10px] text-muted-foreground leading-tight">{reclassifyMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Toolbar */}
        <div className="flex gap-2 items-center flex-wrap">
          {!selectMode ? (
            <>
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search by name or tag…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={!!uploadProgress} onClick={() => fileInputRef.current?.click()} title="Select individual images">
                {uploadProgress
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadProgress.current}/{uploadProgress.total}</>
                  : <><Upload className="w-3.5 h-3.5" />Files</>}
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={!!uploadProgress} onClick={() => folderInputRef.current?.click()} title="Upload an entire folder — subfolders become tags">
                <FolderOpen className="w-3.5 h-3.5" />Folder
              </Button>
              {items.length > 0 && (
                <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={() => setSelectMode(true)}>
                  <Check className="w-3.5 h-3.5" />Select
                </Button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={toggleSelectAll}
                className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-colors shrink-0 ${allSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-slate-600 hover:bg-muted"}`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSelected ? "bg-primary border-primary" : "border-slate-400"}`}>
                  {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                {allSelected ? "Deselect all" : `Select all (${items.length})`}
              </button>
              <span className="text-sm text-slate-500 shrink-0">{selected.size} selected</span>
              <div className="flex-1" />
              {selected.size > 0 && (
                <Button
                  size="sm" className="h-9 gap-1.5 shrink-0 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete {selected.size}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={exitSelectMode}>
                <X className="w-3.5 h-3.5 mr-1" />Cancel
              </Button>
            </>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          <input ref={folderInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload}
            {...{ webkitdirectory: "", mozdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>}
          />
        </div>

        {/* Active filter + count pill */}
        {(activeTag || query) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {activeTag && (
              <Badge variant="default" className="gap-1 cursor-pointer text-[11px]" onClick={() => handleTagClick("")}>
                {activeTag}<X className="w-2.5 h-2.5" />
              </Badge>
            )}
            <span>{total} image{total !== 1 ? "s" : ""} found</span>
          </div>
        )}

        {/* Upload progress bar */}
        {uploadProgress && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            <span>Uploading {uploadProgress.current} of {uploadProgress.total}…</span>
            <div className="flex-1 bg-muted rounded-full h-1.5 ml-1">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Image grid */}
        <div onDrop={!selectMode ? handleDrop : undefined} onDragOver={!selectMode ? e => e.preventDefault() : undefined}>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <div
              className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{query || activeTag ? "No images match your search." : "Drop images here or click to upload"}</p>
              {!query && !activeTag && <p className="text-xs mt-1 opacity-60">Supports JPG, PNG, WebP, GIF · Select multiple or upload a whole folder</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={selectMode ? () => toggleSelect(item.id) : () => openModal(item)}
                    className={`group relative rounded-xl border overflow-hidden bg-muted/20 transition-all cursor-pointer ${
                      selectMode
                        ? `${isSelected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border hover:border-primary/40"}`
                        : "border-border hover:border-primary/50 hover:shadow-md hover:scale-[1.01]"
                    }`}
                  >
                    <div className="aspect-video">
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>

                    {selectMode && (
                      <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm ${isSelected ? "bg-primary border-primary" : "bg-white/90 border-slate-400"}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}

                    {!selectMode && (
                      <button
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-red-600 text-white rounded-lg p-1"
                        onClick={e => { e.stopPropagation(); handleDelete(item.id, item.title); }}
                        title="Delete image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <div className="p-2">
                      <p className="text-xs font-medium truncate" title={item.title}>{item.title}</p>
                      {!selectMode && (
                        editingTags === item.id ? (
                          <div className="mt-1.5 flex gap-1">
                            <Input
                              value={editTagValue}
                              onChange={e => setEditTagValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleSaveTags(item.id); if (e.key === "Escape") setEditingTags(null); }}
                              placeholder="tag1, tag2…"
                              className="h-6 text-[10px] flex-1"
                              autoFocus
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleSaveTags(item.id)}>
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditingTags(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            {item.tags.length > 0
                              ? item.tags.slice(0, 3).map(t => (
                                <span key={t} className="inline-block px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">{t}</span>
                              ))
                              : <span className="text-[10px] text-muted-foreground italic">Tagging…</span>
                            }
                            {item.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>}
                            <button
                              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              onClick={e => { e.stopPropagation(); setEditingTags(item.id); setEditTagValue(item.tags.join(", ")); }}
                              title="Edit tags"
                            >
                              <Tag className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} &middot; {total} image{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {/* Page number pills — show up to 7 */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => handlePageChange(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button
                variant="outline" size="sm" className="h-8 w-8 p-0"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Image detail modal ── */}
    {modalImage && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      >
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col sm:flex-row"
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={closeModal}
            className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Image */}
          <div className="sm:w-3/5 bg-slate-950 flex items-center justify-center min-h-48 max-h-[90vh]">
            <img
              src={modalImage.url}
              alt={modalImage.title}
              className="w-full h-full object-contain max-h-[60vh] sm:max-h-[90vh]"
            />
          </div>

          {/* Info panel */}
          <div className="sm:w-2/5 flex flex-col overflow-y-auto p-5 gap-4">
            {/* Title */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Filename</p>
              <p className="text-sm font-medium break-all leading-snug">{modalImage.title}</p>
            </div>

            {/* URL */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">URL</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-500 truncate flex-1 font-mono bg-muted px-2 py-1 rounded-lg">{modalImage.url}</p>
                <button
                  onClick={() => handleCopyUrl(window.location.origin + modalImage.url)}
                  className="shrink-0 p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                  title="Copy URL"
                >
                  {modalCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={modalImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Purpose */}
            {PURPOSES.some(p => modalImage.tags.includes(p)) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">AI Purpose</p>
                <div className="flex gap-1.5 flex-wrap">
                  {PURPOSES.map(p => (
                    <span
                      key={p}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        modalImage.tags.includes(p)
                          ? p === "lp-hero" ? "bg-violet-100 text-violet-700 border-violet-300"
                            : p === "lp-feature" ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-muted text-muted-foreground border-border opacity-40"
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                {!modalTagEdit && (
                  <button
                    onClick={() => setModalTagEdit(true)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />Edit
                  </button>
                )}
              </div>
              {modalTagEdit ? (
                <div className="space-y-2">
                  <Input
                    value={modalTagValue}
                    onChange={e => setModalTagValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleModalSaveTags(); if (e.key === "Escape") setModalTagEdit(false); }}
                    placeholder="tag1, tag2, tag3…"
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={handleModalSaveTags}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModalTagEdit(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {modalImage.tags.length > 0
                    ? modalImage.tags.map(t => (
                        <span key={t} className={`px-2 py-0.5 rounded-full text-[11px] border ${
                          PURPOSES.includes(t) ? "bg-muted/50 text-muted-foreground border-dashed border-border" : "bg-muted text-slate-700 border-border"
                        }`}>{t}</span>
                      ))
                    : <span className="text-xs text-muted-foreground italic">No tags</span>
                  }
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 shrink-0" />
                <span>{formatBytes(modalImage.sizeBytes)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileType2 className="w-3.5 h-3.5 shrink-0" />
                <span>{modalImage.mimeType || "Unknown type"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{new Date(modalImage.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
            </div>

            {/* Delete */}
            <div className="mt-auto pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400"
                onClick={handleModalDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete image
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function LibraryTab({ type }: { type: LibraryType }) {
  const lib = useLibrary(type);

  return (
    <div className="space-y-3">
      {lib.loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {lib.items.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No items yet. Add your first one below.</p>
            </div>
          )}
          {lib.items.map(item => (
            <LibraryItemCard
              key={item.id}
              item={item}
              type={type}
              onToggleDefault={() => lib.toggleDefault(item.id)}
              onDelete={() => {
                if (confirm(`Delete "${item.name || "this item"}"?`)) lib.remove(item.id);
              }}
              onUpdate={(name, content, is_default) => lib.update(item.id, name, content, is_default)}
            />
          ))}
          <AddItemForm type={type} onCreate={lib.create} />
        </>
      )}
    </div>
  );
}

type ActiveTab = LibraryType | "media";

const ALL_TABS: { id: ActiveTab; label: string; description: string; icon?: React.ReactNode }[] = [
  { id: "product_showcase", label: "Product Showcase", description: "Cards used in Product Showcase blocks" },
  { id: "product_grid", label: "Product Grid", description: "Items used in Product Grid blocks" },
  { id: "case_study", label: "Case Studies", description: "Case study cards across landing pages" },
  { id: "resource", label: "Resources", description: "Articles, guides, and resources" },
  { id: "team_member", label: "Sales Reps", description: "Sales reps and their booking links — pick from this list when building Meet the Team blocks.", icon: <Users className="w-3.5 h-3.5" /> },
  { id: "media", label: "Media", description: "Upload and manage images. AI auto-tags on upload — subfolders become tags when uploading a folder.", icon: <Image className="w-3.5 h-3.5" /> },
];

export default function ContentLibrary() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("product_showcase");

  const activeTabMeta = ALL_TABS.find(t => t.id === activeTab)!;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#C7E738]" />
              Content Library
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Save and manage reusable content. Mark items as <strong>Default</strong> to auto-populate new blocks.
            </p>
          </div>

          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
            {ALL_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-500">{activeTabMeta.description}</p>
          </div>

          {activeTab === "media"
            ? <MediaTab />
            : <LibraryTab key={activeTab} type={activeTab as LibraryType} />
          }
        </motion.div>
      </div>
    </AppLayout>
  );
}
