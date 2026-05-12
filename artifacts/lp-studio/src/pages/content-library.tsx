import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Star, Loader2, Pencil, Check, X, BookOpen, Image, Search, Upload, FolderOpen, Tag, ChevronLeft, ChevronRight, Sparkles, Copy, ExternalLink, Calendar, HardDrive, FileType2, Users, RefreshCw, Globe, FileText, Wand2 } from "lucide-react";
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
  /** Task #253 — only meaningful for case_study today. Defaults true on
   *  existing rows. When false AND the brand has Strict Facts Mode on, the
   *  AI generation prompt will exclude this entry. */
  approved_for_ai?: boolean;
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

  const create = async (name: string, content: Record<string, unknown>, approved_for_ai = true) => {
    await fetch(`${API_BASE}/lp/library/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_default: false, approved_for_ai }),
    });
    reload();
  };

  const update = async (
    id: number, name: string, content: Record<string, unknown>, is_default: boolean,
    approved_for_ai?: boolean,
  ) => {
    await fetch(`${API_BASE}/lp/library/${type}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_default, approved_for_ai }),
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
  const v = value as { name?: string; role?: string; email?: string; chilipiperUrl?: string; photo?: string };
  return (
    <div className="space-y-2">
      <Input placeholder="Full name" value={v.name ?? ""} onChange={e => onChange({ ...v, name: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Role / Title (e.g. Enterprise AE)" value={v.role ?? ""} onChange={e => onChange({ ...v, role: e.target.value })} className="text-xs h-7" />
      <Input placeholder="email@meetdandy.com" value={v.email ?? ""} onChange={e => onChange({ ...v, email: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Chili Piper URL" value={v.chilipiperUrl ?? ""} onChange={e => onChange({ ...v, chilipiperUrl: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Headshot" value={v.photo ?? ""} onChange={url => onChange({ ...v, photo: url })} />
    </div>
  );
}

function getDefaultContent(type: LibraryType): Record<string, unknown> {
  if (type === "product_showcase") return { name: "", description: "", badge: "", image: "" };
  if (type === "product_grid") return { title: "", description: "", image: "" };
  if (type === "case_study") return { title: "", categories: "", url: "#", image: "", logoUrl: "" };
  if (type === "team_member") return { name: "", role: "", email: "", chilipiperUrl: "", photo: "" };
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
  onUpdate: (name: string, content: Record<string, unknown>, is_default: boolean, approved_for_ai?: boolean) => void;
}

function LibraryItemCard({ item, type, onToggleDefault, onDelete, onUpdate }: LibraryItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [content, setContent] = useState<Record<string, unknown>>(item.content);
  const [approvedForAi, setApprovedForAi] = useState(item.approved_for_ai !== false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onUpdate(name, content, item.is_default, approvedForAi);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => {
    setName(item.name);
    setContent(item.content);
    setApprovedForAi(item.approved_for_ai !== false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border rounded-lg p-4 space-y-3 bg-card">
        <div>
          <Label className="text-[11px] text-slate-500 mb-1 block">Library name (internal label)</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="text-xs h-7" placeholder="e.g. Crown & Bridge" />
        </div>
        <ContentForm type={type} value={content} onChange={setContent} />
        {/* Task #253 — Approved for AI gate on case_study only */}
        {type === "case_study" && (
          <label className="flex items-start gap-2 text-xs cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={approvedForAi}
              onChange={(e) => setApprovedForAi(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5"
            />
            <span className="text-slate-600">
              Approved for AI use
              <span className="block text-[11px] text-slate-400">
                When Strict Facts Mode is on (Brand Settings), unapproved case studies will be hidden from AI generation.
              </span>
            </span>
          </label>
        )}
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
    <div className="border rounded-lg p-4 flex items-start gap-3 bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-800 truncate">{item.name || "(unnamed)"}</span>
          {item.is_default && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-400 text-amber-600 gap-0.5 shrink-0">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> Default
            </Badge>
          )}
          {/* Task #253 — show an "AI" pill on case studies that are approved
              for AI use so the approved set is visible at a glance. Defaults
              to true on existing rows. */}
          {type === "case_study" && item.approved_for_ai !== false && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-300 text-emerald-600 shrink-0">
              AI
            </Badge>
          )}
          {type === "case_study" && item.approved_for_ai === false && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-400 shrink-0">
              AI off
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

function AddItemForm({ type, onCreate }: {
  type: LibraryType;
  /** Task #253 — case_study creates now also forward approved_for_ai so the
   *  tenant can set the AI flag at creation time, not only after the fact. */
  onCreate: (name: string, content: Record<string, unknown>, approved_for_ai?: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>(getDefaultContent(type));
  const [approvedForAi, setApprovedForAi] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    await onCreate(name, content, type === "case_study" ? approvedForAi : undefined);
    setName("");
    setContent(getDefaultContent(type));
    setApprovedForAi(true);
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
    <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-3 bg-background">
      <div>
        <Label className="text-[11px] text-slate-500 mb-1 block">Library name (internal label)</Label>
        <Input value={name} onChange={e => setName(e.target.value)} className="text-xs h-7" placeholder="e.g. Crown & Bridge" />
      </div>
      <ContentForm type={type} value={content} onChange={setContent} />
      {/* Task #253 — Approved-for-AI toggle on the create form (case_study only) */}
      {type === "case_study" && (
        <label className="flex items-start gap-2 text-xs cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={approvedForAi}
            onChange={(e) => setApprovedForAi(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5"
          />
          <span className="text-slate-600">
            Approved for AI use
            <span className="block text-[11px] text-slate-400">
              When Strict Facts Mode is on (Brand Settings), only approved case studies are shared with AI generation.
            </span>
          </span>
        </label>
      )}
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

  const fetchImages = useCallback(async (pg?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeTag) params.set("tag", activeTag);
      params.set("page", String(pg ?? page));
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

  useEffect(() => { fetchImages(page); }, [fetchImages, page]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setQuery(value);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
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
              className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
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
                    className={`group relative rounded-lg border overflow-hidden bg-muted/20 transition-all cursor-pointer ${
                      selectMode
                        ? `${isSelected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border hover:border-primary/40"}`
                        : "border-border hover:border-primary/50 hover:shadow-md hover:scale-[1.01]"
                    }`}
                  >
                    <div className="aspect-video">
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>

                    {selectMode && (
                      <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "bg-white/90 border-slate-400"}`}>
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

// Task #256 — first-class proof-point library row. Tenant-scoped, dated,
// sourced. Approval here flows through every page and segment that links
// to this row instead of being re-typed per segment.
interface ProofPoint {
  id: number;
  value: string;
  label: string;
  source_url: string;
  as_of_date: string | null;
  approved_for_ai: boolean;
  sort_order: number;
}

// One row in the "review before save" list returned by either of the
// /lp/proof-points/import-from-* endpoints. The UI lets the user toggle
// each one off, edit value/label/source_url/as_of_date inline, then
// hit "Save selected" to POST each accepted row through the existing
// CRUD endpoint.
interface ImportCandidate {
  value: string;
  label: string;
  source_url: string;
  as_of_date: string | null;
  context: string;
  selected: boolean;
}

function ProofPointsTab() {
  const [items, setItems] = useState<ProofPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ value: string; label: string; source_url: string; as_of_date: string; approved_for_ai: boolean }>({
    value: "", label: "", source_url: "", as_of_date: "", approved_for_ai: true,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<typeof draft>(draft);

  // ── Import-from-URL / -from-text state ──────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"url" | "text">("url");
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importTextSource, setImportTextSource] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [savingSelected, setSavingSelected] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/lp/proof-points`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const create = async () => {
    if (!draft.value.trim() && !draft.label.trim()) return;
    await fetch(`${API_BASE}/lp/proof-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: draft.value,
        label: draft.label,
        source_url: draft.source_url,
        as_of_date: draft.as_of_date || null,
        approved_for_ai: draft.approved_for_ai,
      }),
    });
    setDraft({ value: "", label: "", source_url: "", as_of_date: "", approved_for_ai: true });
    setAdding(false);
    reload();
  };

  const startEdit = (p: ProofPoint) => {
    setEditingId(p.id);
    setEditDraft({
      value: p.value,
      label: p.label,
      source_url: p.source_url,
      as_of_date: p.as_of_date ?? "",
      approved_for_ai: p.approved_for_ai !== false,
    });
  };

  const saveEdit = async (id: number) => {
    await fetch(`${API_BASE}/lp/proof-points/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: editDraft.value,
        label: editDraft.label,
        source_url: editDraft.source_url,
        as_of_date: editDraft.as_of_date || null,
        approved_for_ai: editDraft.approved_for_ai,
      }),
    });
    setEditingId(null);
    reload();
  };

  const remove = async (id: number) => {
    await fetch(`${API_BASE}/lp/proof-points/${id}`, { method: "DELETE" });
    reload();
  };

  // Calls the new extract-only endpoint and pre-selects every returned row.
  // Nothing is persisted until the user reviews + clicks "Save selected".
  const runImport = async () => {
    setImportError(null);
    setCandidates(null);
    setImporting(true);
    try {
      const endpoint = importMode === "url" ? "import-from-url" : "import-from-text";
      const body = importMode === "url"
        ? { url: importUrl }
        : { text: importText, sourceUrl: importTextSource };
      const r = await fetch(`${API_BASE}/lp/proof-points/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setImportError(typeof data?.error === "string" ? data.error : `Request failed (${r.status})`);
        return;
      }
      const proposed = Array.isArray(data?.proposed) ? data.proposed : [];
      if (proposed.length === 0) {
        setImportError("No proof points found. Try a different page or paste more specific copy with numbers in it.");
        return;
      }
      setCandidates(proposed.map((p: Record<string, unknown>) => ({
        value: typeof p.value === "string" ? p.value : "",
        label: typeof p.label === "string" ? p.label : "",
        source_url: typeof p.source_url === "string" ? p.source_url : "",
        as_of_date: typeof p.as_of_date === "string" ? p.as_of_date : null,
        context: typeof p.context === "string" ? p.context : "",
        selected: true,
      })));
    } catch (err) {
      setImportError(String(err));
    } finally {
      setImporting(false);
    }
  };

  const saveSelectedCandidates = async () => {
    if (!candidates) return;
    const picked = candidates.filter((c) => c.selected && (c.value.trim() || c.label.trim()));
    if (picked.length === 0) return;
    setSavingSelected(true);
    try {
      // POST sequentially so the server-side sort_order auto-increment
      // produces a deterministic order matching the on-screen list.
      for (const c of picked) {
        await fetch(`${API_BASE}/lp/proof-points`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: c.value,
            label: c.label,
            source_url: c.source_url,
            as_of_date: c.as_of_date || null,
            approved_for_ai: true,
          }),
        });
      }
      // Reset the import panel and reload the list so the new rows show up.
      setCandidates(null);
      setImportOpen(false);
      setImportUrl("");
      setImportText("");
      setImportTextSource("");
      reload();
    } finally {
      setSavingSelected(false);
    }
  };

  const updateCandidate = (idx: number, patch: Partial<ImportCandidate>) => {
    setCandidates((prev) => {
      if (!prev) return prev;
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <div className="text-center py-8 text-slate-400 text-sm">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No proof points yet. Add one below to share approved stats across every page and segment.</p>
        </div>
      )}

      {items.map((p) => (
        <div key={p.id} className="border rounded-lg p-4 bg-card">
          {editingId === p.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input className="text-xs h-7 w-32 shrink-0" placeholder="Value e.g. 98%" value={editDraft.value} onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })} />
                <Input className="text-xs h-7 flex-1" placeholder="Label e.g. acceptance rate" value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} />
              </div>
              <Input className="text-xs h-7" placeholder="Source URL (optional)" value={editDraft.source_url} onChange={(e) => setEditDraft({ ...editDraft, source_url: e.target.value })} />
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-slate-500 shrink-0">As of</Label>
                <Input className="text-xs h-7 w-40" type="date" value={editDraft.as_of_date} onChange={(e) => setEditDraft({ ...editDraft, as_of_date: e.target.value })} />
                <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer ml-auto">
                  <input type="checkbox" className="h-3.5 w-3.5" checked={editDraft.approved_for_ai} onChange={(e) => setEditDraft({ ...editDraft, approved_for_ai: e.target.checked })} />
                  Approved for AI
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveEdit(p.id)}><Check className="w-3 h-3" /> Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditingId(null)}><X className="w-3 h-3" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-slate-800">{p.value || "(no value)"}</span>
                  <span className="text-sm text-slate-600">{p.label}</span>
                  {p.approved_for_ai !== false ? (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-300 text-emerald-600 shrink-0">AI</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-400 shrink-0">AI off</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                  {p.as_of_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.as_of_date}</span>}
                  {p.source_url && (
                    <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-700 truncate max-w-xs">
                      <ExternalLink className="w-3 h-3" />{p.source_url}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button title="Edit" onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button title="Delete" onClick={() => { if (confirm("Delete this proof point?")) remove(p.id); }} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-2 bg-background">
          <div className="flex gap-2">
            <Input className="text-xs h-7 w-32 shrink-0" placeholder="Value e.g. 98%" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            <Input className="text-xs h-7 flex-1" placeholder="Label e.g. acceptance rate" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
          <Input className="text-xs h-7" placeholder="Source URL (optional)" value={draft.source_url} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })} />
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-slate-500 shrink-0">As of</Label>
            <Input className="text-xs h-7 w-40" type="date" value={draft.as_of_date} onChange={(e) => setDraft({ ...draft, as_of_date: e.target.value })} />
            <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer ml-auto">
              <input type="checkbox" className="h-3.5 w-3.5" checked={draft.approved_for_ai} onChange={(e) => setDraft({ ...draft, approved_for_ai: e.target.checked })} />
              Approved for AI
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={create}><Plus className="w-3 h-3" /> Add Proof Point</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Proof Point
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => { setImportOpen(true); setCandidates(null); setImportError(null); }}>
            <Wand2 className="w-3.5 h-3.5" /> Import from URL or Doc
          </Button>
        </div>
      )}

      {importOpen && (
        <div className="border-2 border-dashed border-violet-200 rounded-lg p-4 space-y-3 bg-violet-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Pull proof points from a page or document
            </div>
            <button onClick={() => { setImportOpen(false); setCandidates(null); setImportError(null); }} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!candidates && (
            <>
              <div className="flex gap-1 bg-white rounded-md p-1 border border-slate-200 w-fit">
                <button
                  className={`text-xs px-3 py-1 rounded gap-1.5 inline-flex items-center ${importMode === "url" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-700"}`}
                  onClick={() => setImportMode("url")}
                >
                  <Globe className="w-3.5 h-3.5" /> Website URL
                </button>
                <button
                  className={`text-xs px-3 py-1 rounded gap-1.5 inline-flex items-center ${importMode === "text" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-700"}`}
                  onClick={() => setImportMode("text")}
                >
                  <FileText className="w-3.5 h-3.5" /> Paste Document
                </button>
              </div>

              {importMode === "url" ? (
                <div className="space-y-2">
                  <Input
                    placeholder="https://yourcompany.com/about (or /press, /annual-report, etc.)"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-slate-500">
                    We'll scrape that page and pull every concrete stat we find. The page must be publicly reachable.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Paste the body of an annual report, press release, marketing page, or any document with numbers in it. Up to ~200KB."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="text-sm min-h-[180px] font-mono"
                  />
                  <Input
                    placeholder="Source URL (optional — used as the source link for every proof point pulled)"
                    value={importTextSource}
                    onChange={(e) => setImportTextSource(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}

              {importError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {importError}
                </div>
              )}

              <Button
                onClick={runImport}
                disabled={importing || (importMode === "url" ? !importUrl.trim() : !importText.trim())}
                className="gap-1.5"
                size="sm"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {importing ? "Extracting…" : "Extract proof points"}
              </Button>
            </>
          )}

          {candidates && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Found <strong>{candidates.length}</strong> proof point{candidates.length === 1 ? "" : "s"}. Uncheck any you don't want, edit the rest, then save.
                </p>
                <div className="flex gap-1.5 text-[11px]">
                  <button onClick={() => setCandidates(candidates.map((c) => ({ ...c, selected: true })))} className="px-2 py-0.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100">Select all</button>
                  <button onClick={() => setCandidates(candidates.map((c) => ({ ...c, selected: false })))} className="px-2 py-0.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100">Clear</button>
                </div>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {candidates.map((c, idx) => (
                  <div key={idx} className={`border rounded-lg p-3 bg-white space-y-2 ${c.selected ? "border-violet-300" : "border-slate-200 opacity-60"}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1 shrink-0"
                        checked={c.selected}
                        onChange={(e) => updateCandidate(idx, { selected: e.target.checked })}
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex gap-2">
                          <Input className="text-xs h-7 w-28 shrink-0 font-semibold" placeholder="Value" value={c.value} onChange={(e) => updateCandidate(idx, { value: e.target.value })} />
                          <Input className="text-xs h-7 flex-1" placeholder="Label" value={c.label} onChange={(e) => updateCandidate(idx, { label: e.target.value })} />
                        </div>
                        <Input className="text-xs h-7" placeholder="Source URL" value={c.source_url} onChange={(e) => updateCandidate(idx, { source_url: e.target.value })} />
                        <div className="flex items-center gap-2">
                          <Label className="text-[11px] text-slate-500 shrink-0">As of</Label>
                          <Input className="text-xs h-7 w-40" type="date" value={c.as_of_date ?? ""} onChange={(e) => updateCandidate(idx, { as_of_date: e.target.value || null })} />
                        </div>
                        {c.context && (
                          <p className="text-[11px] text-slate-400 italic pt-0.5">"{c.context}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={saveSelectedCandidates} disabled={savingSelected || candidates.every((c) => !c.selected)} size="sm" className="gap-1.5">
                  {savingSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save {candidates.filter((c) => c.selected).length} selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setCandidates(null); setImportError(null); }}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ActiveTab = LibraryType | "media" | "proof_points";

const ALL_TABS: { id: ActiveTab; label: string; description: string; icon?: React.ReactNode }[] = [
  { id: "product_showcase", label: "Product Showcase", description: "Cards used in Product Showcase blocks" },
  { id: "product_grid", label: "Product Grid", description: "Items used in Product Grid blocks" },
  { id: "case_study", label: "Case Studies", description: "Case study cards across landing pages" },
  { id: "resource", label: "Resources", description: "Articles, guides, and resources" },
  { id: "team_member", label: "Sales Reps", description: "Sales reps and their booking links — pick from this list when building Meet the Team blocks.", icon: <Users className="w-3.5 h-3.5" /> },
  { id: "proof_points", label: "Proof Points", description: "Reusable, dated, sourced stats. One approval flows through every page and segment that uses the same number — no more re-typing the same stat in every segment.", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "media", label: "Media", description: "Upload and manage images. AI auto-tags on upload — subfolders become tags when uploading a folder.", icon: <Image className="w-3.5 h-3.5" /> },
];

export function ContentLibraryContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("product_showcase");

  const activeTabMeta = ALL_TABS.find(t => t.id === activeTab)!;

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
          {ALL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-white text-slate-900"
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
          : activeTab === "proof_points"
            ? <ProofPointsTab />
            : <LibraryTab key={activeTab} type={activeTab as LibraryType} />
        }
      </motion.div>
    </div>
  );
}

export default function ContentLibrary() {
  return (
    <AppLayout>
      <div className="px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-foreground" />
              Content Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Save and manage reusable content. Mark items as <strong>Default</strong> to auto-populate new blocks.
            </p>
          </div>

          <ContentLibraryContent />
        </motion.div>
      </div>
    </AppLayout>
  );
}
