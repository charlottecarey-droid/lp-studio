import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Star, Loader2, Pencil, Check, X, BookOpen, Image, Search, Upload, FolderOpen, Tag, ChevronLeft, ChevronRight, Sparkles, Copy, ExternalLink, Calendar, HardDrive, FileType2, Users, RefreshCw, Globe, FileText, Wand2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

  // Task #1139 — persist a tenant-chosen order. We optimistically reorder the
  // local list, push the new order, then reload to stay in sync. This order is
  // the tie-breaker the AI page generator uses when picking case studies.
  const reorder = async (orderedIds: number[]) => {
    setItems(prev => {
      const byId = new Map(prev.map(i => [i.id, i] as const));
      const next = orderedIds
        .map(id => byId.get(id))
        .filter((i): i is LibraryItem => i != null);
      // keep any items not present in orderedIds (defensive) at the end
      for (const i of prev) if (!orderedIds.includes(i.id)) next.push(i);
      return next;
    });
    try {
      await fetch(`${API_BASE}/lp/library/${type}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orderedIds }),
      });
    } catch { /* optimistic update already applied; reload reconciles */ }
    reload();
  };

  return { items, loading, reload, create, update, toggleDefault, remove, reorder };
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
  const v = value as {
    title?: string; categories?: string; url?: string; image?: string; logoUrl?: string;
    quote?: string; author?: string; stat?: string; statLabel?: string;
    locationCount?: string | number; segment?: string;
  };
  return (
    <div className="space-y-2">
      <Input placeholder="Title" value={v.title ?? ""} onChange={e => onChange({ ...v, title: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Categories e.g. INDUSTRY / SIZE" value={v.categories ?? ""} onChange={e => onChange({ ...v, categories: e.target.value })} className="text-xs h-7" />
      <Textarea placeholder="Customer quote" value={v.quote ?? ""} onChange={e => onChange({ ...v, quote: e.target.value })} rows={2} className="text-xs resize-none" />
      <Input placeholder="Quote author e.g. Jane Doe, COO" value={v.author ?? ""} onChange={e => onChange({ ...v, author: e.target.value })} className="text-xs h-7" />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Headline stat e.g. 12.5%" value={v.stat ?? ""} onChange={e => onChange({ ...v, stat: e.target.value })} className="text-xs h-7" />
        <Input placeholder="Stat label e.g. revenue lift" value={v.statLabel ?? ""} onChange={e => onChange({ ...v, statLabel: e.target.value })} className="text-xs h-7" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="# of locations" value={v.locationCount == null ? "" : String(v.locationCount)} onChange={e => onChange({ ...v, locationCount: e.target.value })} className="text-xs h-7" />
        <Input placeholder="Segment / industry" value={v.segment ?? ""} onChange={e => onChange({ ...v, segment: e.target.value })} className="text-xs h-7" />
      </div>
      <Input placeholder="Link URL" value={v.url ?? ""} onChange={e => onChange({ ...v, url: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Cover image" value={v.image ?? ""} onChange={url => onChange({ ...v, image: url })} previewClassName="w-full h-44 object-contain bg-muted/40" />
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
      <Input placeholder="email@example.com" value={v.email ?? ""} onChange={e => onChange({ ...v, email: e.target.value })} className="text-xs h-7" />
      <Input placeholder="Chili Piper URL" value={v.chilipiperUrl ?? ""} onChange={e => onChange({ ...v, chilipiperUrl: e.target.value })} className="text-xs h-7" />
      <ImagePicker label="Headshot" value={v.photo ?? ""} onChange={url => onChange({ ...v, photo: url })} />
    </div>
  );
}

function getDefaultContent(type: LibraryType): Record<string, unknown> {
  if (type === "product_showcase") return { name: "", description: "", badge: "", image: "" };
  if (type === "product_grid") return { title: "", description: "", image: "" };
  if (type === "case_study") return { title: "", categories: "", url: "#", image: "", logoUrl: "", quote: "", author: "", stat: "", statLabel: "", locationCount: "", segment: "" };
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
  /** Task #1139 — drag handle injected by the sortable wrapper. */
  dragHandle?: React.ReactNode;
}

function LibraryItemCard({ item, type, onToggleDefault, onDelete, onUpdate, dragHandle }: LibraryItemCardProps) {
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
      {dragHandle}
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

interface ReferenceSource {
  host: string;
  count: number;
}

const MEDIA_PAGE_SIZE = 48;

/** Tags applied by the reference-image harvest (task #747). These are internal
 *  bookkeeping tags, surfaced through the dedicated "Reference sites" section
 *  rather than the generic category list, so we hide them there to avoid noise
 *  (especially the one-per-image `refsrc:<hash>` tags). */
const isReferenceTag = (t: string): boolean =>
  t === "scraped" || t === "page-reference" || t.startsWith("refhost:") || t.startsWith("refsrc:");

/** Extract the source host of a scraped image from its `refhost:<host>` tag. */
const referenceHostOf = (tags: string[]): string => {
  const t = tags.find(x => typeof x === "string" && x.startsWith("refhost:"));
  return t ? t.slice("refhost:".length) : "";
};

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
  const [removingTag, setRemovingTag] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [addTagMenuOpen, setAddTagMenuOpen] = useState(false);
  const [addTagValue, setAddTagValue] = useState("");
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyMsg, setReclassifyMsg] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [refSources, setRefSources] = useState<ReferenceSource[]>([]);
  const [refTotal, setRefTotal] = useState(0);
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

  const fetchRefSources = useCallback(async () => {
    try {
      const res = await fetch("/api/lp/media/reference-sources");
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { total: number; hosts: ReferenceSource[] };
      setRefSources(Array.isArray(data.hosts) ? data.hosts : []);
      setRefTotal(data.total ?? 0);
    } catch {
      setRefSources([]);
      setRefTotal(0);
    }
  }, []);

  useEffect(() => { fetchRefSources(); }, [fetchRefSources]);

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
    fetchRefSources();
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
      fetchRefSources();
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
    fetchRefSources();
  };

  // Tags present across the currently-selected images, with how many of the
  // selection carry each tag — drives the "Remove tag" menu so the user can
  // strip a mis-applied tag (e.g. lp-hero on off-topic shots) in one action.
  const selectedTagCounts = (() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!selected.has(item.id)) continue;
      for (const t of item.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  })();

  // Remove a single tag from every selected image that carries it. Done in one
  // server-side call so it covers the whole selection — including images on other
  // pages that aren't currently loaded (the menu's tag list is built from the
  // visible page, but removal applies to all selected ids). Selection is kept so
  // the user can strip several tags in a row.
  const handleBulkRemoveTag = async (tag: string) => {
    if (selected.size === 0) return;
    if (!confirm(`Remove the "${tag}" tag from the selected image${selected.size === 1 ? "" : "s"} that carry it?`)) return;
    setRemovingTag(true);
    setTagMenuOpen(false);
    try {
      await fetch(`/api/lp/media/remove-tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], tag }),
      });
    } catch { /* result is reflected by the refresh below */ }
    setRemovingTag(false);
    await fetchImages();
    fetchRefSources();
  };

  // Add a tag to every selected image in one server-side call (covers ids on
  // other pages too). Idempotent server-side, so images that already carry the
  // tag are untouched. Selection is kept so the user can add several tags in a
  // row.
  const handleBulkAddTag = async () => {
    const tag = addTagValue.trim().toLowerCase();
    if (selected.size === 0 || !tag) return;
    setAddingTag(true);
    try {
      await fetch(`/api/lp/media/add-tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], tag }),
      });
    } catch { /* result is reflected by the refresh below */ }
    setAddingTag(false);
    setAddTagValue("");
    setAddTagMenuOpen(false);
    await fetchImages();
    fetchRefSources();
  };

  // Bulk-remove reference-sourced images. With a host filter active, deletes
  // only that site's images; otherwise wipes every reference-sourced image.
  const handleDeleteReference = async (host: string) => {
    const label = host || "every reference site";
    const n = host
      ? (refSources.find(s => s.host === host)?.count ?? total)
      : refTotal;
    if (!confirm(`Permanently delete ${n} image${n === 1 ? "" : "s"} pulled in from ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams();
      if (host) params.set("host", host);
      await fetch(`/api/lp/media/reference?${params}`, { method: "DELETE" });
    } catch { /* silent */ }
    setDeleting(false);
    setActiveTag("");
    setPage(1);
    await fetchRefSources();
    await fetchImages(1);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setTagMenuOpen(false);
    setAddTagMenuOpen(false);
    setAddTagValue("");
  };

  // Classify the tenant's own images in client-driven batches of 20 so the
  // whole library finishes (nothing left untagged) with visible progress. The
  // server reports rate-limited ids instead of dropping them; we back off and
  // re-queue those (capped) so a saturated AI proxy can't strand images — the
  // old "stops at ~20" bug. Resumable: re-running picks up whatever is left.
  const handleReclassify = async (force = false) => {
    if (reclassifying) return;
    setReclassifying(true);
    setReclassifyMsg(force ? "Finding images to re-scan…" : "Finding images to classify…");
    try {
      const targetsRes = await fetch(`/api/lp/media/classify-targets${force ? "?force=true" : ""}`);
      if (!targetsRes.ok) throw new Error("targets");
      const { total, ids } = await targetsRes.json() as { total: number; ids: number[] };
      if (total === 0) {
        setReclassifyMsg("All images already classified!");
        setTimeout(() => { setReclassifyMsg(""); setReclassifying(false); }, 6000);
        return;
      }

      const MAX_ATTEMPTS = 5;
      const attempts = new Map<number, number>();
      let queue = [...ids];
      let done = 0;
      setReclassifyMsg(`Classifying 0 of ${total}…`);

      while (queue.length > 0) {
        const batch = queue.slice(0, 20);
        queue = queue.slice(20);
        let backoff = false;

        const requeue = (id: number) => {
          const n = (attempts.get(id) ?? 0) + 1;
          attempts.set(id, n);
          if (n < MAX_ATTEMPTS) queue.push(id);
          else done++; // give up gracefully so the run can finish
        };

        try {
          const res = await fetch("/api/lp/media/classify-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: batch }),
          });
          if (!res.ok) throw new Error("batch");
          const { results } = await res.json() as { results: { id: number; status: string }[] };
          for (const r of results) {
            if (r.status === "rate-limited" || r.status === "no-config") {
              backoff = true;
              requeue(r.id);
            } else {
              done++; // tagged | skipped | error — all genuinely processed
            }
          }
        } catch {
          // Whole-batch failure (network/5xx): re-queue with attempt accounting.
          backoff = true;
          for (const id of batch) requeue(id);
        }

        setReclassifyMsg(`Classifying ${Math.min(done, total)} of ${total}…`);
        if (queue.length > 0 && backoff) {
          setReclassifyMsg(`Rate limit reached — pausing… (${Math.min(done, total)} of ${total})`);
          await new Promise(r => setTimeout(r, 15000));
        }
      }

      setReclassifyMsg(`Done — classified ${total} image${total === 1 ? "" : "s"}.`);
      fetchImages(page);
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
  // Reference-harvest bookkeeping tags are surfaced through the dedicated
  // "Reference sites" section below, so keep them out of the generic list.
  const visibleTagCounts = tagCounts.filter(tc => !isReferenceTag(tc.tag));
  const activeRefHost = activeTag.startsWith("refhost:") ? activeTag.slice("refhost:".length) : "";
  const refFilterActive = activeTag === "scraped" || activeTag.startsWith("refhost:");

  return (
    <>
    <div className="flex gap-5 items-start min-h-0">

      {/* ── Category sidebar ── */}
      {!selectMode && (visibleTagCounts.length > 0 || refTotal > 0) && (
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
              const activeIdx = visibleTagCounts.findIndex(tc => tc.tag === activeTag);
              const mustExpand = activeIdx >= SIDEBAR_LIMIT;
              const showAll = sidebarExpanded || mustExpand;
              const visible = showAll ? visibleTagCounts : visibleTagCounts.slice(0, SIDEBAR_LIMIT);
              const hidden = visibleTagCounts.length - SIDEBAR_LIMIT;
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

          {/* ── Reference sites (task #747 harvested images) ── */}
          {refTotal > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-2 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Reference sites
              </p>
              <div className="space-y-0.5">
                <button
                  onClick={() => handleTagClick(activeTag === "scraped" ? "" : "scraped")}
                  title="Images pulled in from reference websites during page generation"
                  className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                    activeTag === "scraped" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="truncate">All reference images</span>
                  <span className={`text-[11px] ml-1 shrink-0 ${activeTag === "scraped" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{refTotal}</span>
                </button>
                {refSources.map(src => (
                  <button
                    key={src.host}
                    onClick={() => handleTagClick(activeTag === `refhost:${src.host}` ? "" : `refhost:${src.host}`)}
                    title={src.host}
                    className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      activeTag === `refhost:${src.host}` ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="truncate">{src.host}</span>
                    <span className={`text-[11px] ml-1 shrink-0 ${activeTag === `refhost:${src.host}` ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{src.count}</span>
                  </button>
                ))}
                {refFilterActive && (
                  <button
                    onClick={() => handleDeleteReference(activeRefHost)}
                    disabled={deleting}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 mt-1 rounded-lg text-xs text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title={activeRefHost ? `Delete all images from ${activeRefHost}` : "Delete all reference-sourced images"}
                  >
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Trash2 className="w-3 h-3 shrink-0" />}
                    <span className="text-left leading-tight">
                      {activeRefHost ? `Delete all from ${activeRefHost}` : "Delete all reference images"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

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
                <div className="relative shrink-0">
                  <Button
                    variant="outline" size="sm" className="h-9 gap-1.5"
                    onClick={() => setTagMenuOpen(v => !v)}
                    disabled={removingTag || deleting}
                  >
                    {removingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                    Remove tag
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${tagMenuOpen ? "rotate-90" : ""}`} />
                  </Button>
                  {tagMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setTagMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-white shadow-lg py-1">
                        {selectedTagCounts.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-500">The selected images have no tags.</p>
                        ) : (
                          <>
                            <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Remove from selected</p>
                            {selectedTagCounts.map(({ tag, count }) => (
                              <button
                                key={tag}
                                onClick={() => handleBulkRemoveTag(tag)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-red-50 hover:text-red-700 transition-colors"
                              >
                                <span className="truncate">{tag}</span>
                                <span className="text-xs text-slate-400 shrink-0">{count}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              {selected.size > 0 && (
                <div className="relative shrink-0">
                  <Button
                    variant="outline" size="sm" className="h-9 gap-1.5"
                    onClick={() => setAddTagMenuOpen(v => !v)}
                    disabled={addingTag || deleting}
                  >
                    {addingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add tag
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${addTagMenuOpen ? "rotate-90" : ""}`} />
                  </Button>
                  {addTagMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setAddTagMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-white shadow-lg p-2">
                        <p className="px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Add to {selected.size} selected
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={addTagValue}
                            onChange={e => setAddTagValue(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleBulkAddTag(); } }}
                            placeholder="Tag name…"
                            className="h-8 text-sm"
                          />
                          <Button
                            size="sm" className="h-8 shrink-0"
                            onClick={handleBulkAddTag}
                            disabled={addingTag || !addTagValue.trim()}
                          >
                            {addingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
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

                    {item.tags.includes("scraped") && (() => {
                      const host = referenceHostOf(item.tags);
                      return (
                        <div
                          className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/65 text-white rounded-full pl-1.5 pr-2 py-0.5 max-w-[calc(100%-12px)]"
                          title={host ? `Pulled in from ${host}` : "Pulled in from a reference website"}
                        >
                          <Globe className="w-2.5 h-2.5 shrink-0" />
                          <span className="text-[9px] font-medium truncate">{host || "Reference"}</span>
                        </div>
                      );
                    })()}

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
                          {(() => {
                            const shownTags = item.tags.filter(t => !isReferenceTag(t));
                            return (<>
                            {shownTags.length > 0
                              ? shownTags.slice(0, 3).map(t => (
                                <span key={t} className="inline-block px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">{t}</span>
                              ))
                              : <span className="text-[10px] text-muted-foreground italic">Tagging…</span>
                            }
                            {shownTags.length > 3 && <span className="text-[10px] text-muted-foreground">+{shownTags.length - 3}</span>}</>);
                          })()}
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
                  {(() => {
                    const shown = modalImage.tags.filter(t => !isReferenceTag(t));
                    return shown.length > 0
                      ? shown.map(t => (
                          <span key={t} className={`px-2 py-0.5 rounded-full text-[11px] border ${
                            PURPOSES.includes(t) ? "bg-muted/50 text-muted-foreground border-dashed border-border" : "bg-muted text-slate-700 border-border"
                          }`}>{t}</span>
                        ))
                      : <span className="text-xs text-muted-foreground italic">No tags</span>;
                  })()}
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
              {modalImage.tags.includes("scraped") && (
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {(() => {
                      const host = referenceHostOf(modalImage.tags);
                      return host ? `Pulled in from ${host}` : "Pulled in from a reference website";
                    })()}
                  </span>
                </div>
              )}
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

// Task #1139 — a single library card made drag-sortable. The drag handle is the
// only grab target so the card's edit/default/delete buttons stay clickable.
function SortableLibraryItemCard(props: LibraryItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };
  const handle = (
    <button
      type="button"
      title="Drag to reorder"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
      className="mt-0.5 p-1 -ml-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none shrink-0"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      <LibraryItemCard {...props} dragHandle={handle} />
    </div>
  );
}

function LibraryTab({ type }: { type: LibraryType }) {
  const lib = useLibrary(type);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lib.items.findIndex(i => i.id === active.id);
    const newIndex = lib.items.findIndex(i => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(lib.items, oldIndex, newIndex).map(i => i.id);
    lib.reorder(ordered);
  };

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
          {lib.items.length > 1 && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <GripVertical className="w-3 h-3" />
              {type === "case_study"
                ? "Drag to reorder. Higher items are preferred first in AI-generated pages."
                : "Drag to reorder."}
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lib.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {lib.items.map(item => (
                <SortableLibraryItemCard
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
            </SortableContext>
          </DndContext>
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
  // "stat" (numeric metric — the default) or "quote" (a verbatim testimonial).
  // Quotes carry attribution so Strict Facts can vet them against the page copy.
  fact_kind?: "stat" | "quote";
  attribution_name?: string;
  attribution_title?: string;
  attribution_company?: string;
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
  fact_kind: "stat" | "quote";
  attribution_name: string;
  attribution_title: string;
  attribution_company: string;
}

function ProofPointsTab() {
  const [items, setItems] = useState<ProofPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ value: string; label: string; source_url: string; as_of_date: string; approved_for_ai: boolean; fact_kind: "stat" | "quote"; attribution_name: string; attribution_title: string; attribution_company: string }>({
    value: "", label: "", source_url: "", as_of_date: "", approved_for_ai: true,
    fact_kind: "stat", attribution_name: "", attribution_title: "", attribution_company: "",
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
        fact_kind: draft.fact_kind,
        attribution_name: draft.attribution_name,
        attribution_title: draft.attribution_title,
        attribution_company: draft.attribution_company,
      }),
    });
    setDraft({ value: "", label: "", source_url: "", as_of_date: "", approved_for_ai: true, fact_kind: "stat", attribution_name: "", attribution_title: "", attribution_company: "" });
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
      // Preserve attribution on edit — omitting these would let the PUT wipe
      // a scraped quote's attribution back to blank.
      fact_kind: p.fact_kind === "quote" ? "quote" : "stat",
      attribution_name: p.attribution_name ?? "",
      attribution_title: p.attribution_title ?? "",
      attribution_company: p.attribution_company ?? "",
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
        fact_kind: editDraft.fact_kind,
        attribution_name: editDraft.attribution_name,
        attribution_title: editDraft.attribution_title,
        attribution_company: editDraft.attribution_company,
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
        fact_kind: p.fact_kind === "quote" ? "quote" : "stat",
        attribution_name: typeof p.attribution_name === "string" ? p.attribution_name : "",
        attribution_title: typeof p.attribution_title === "string" ? p.attribution_title : "",
        attribution_company: typeof p.attribution_company === "string" ? p.attribution_company : "",
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
            fact_kind: c.fact_kind,
            attribution_name: c.attribution_name,
            attribution_title: c.attribution_title,
            attribution_company: c.attribution_company,
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
              <div className="flex gap-1 bg-white rounded-md p-1 border border-slate-200 w-fit">
                <button type="button" className={`text-[11px] px-2.5 py-0.5 rounded ${editDraft.fact_kind === "stat" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setEditDraft({ ...editDraft, fact_kind: "stat" })}>Stat</button>
                <button type="button" className={`text-[11px] px-2.5 py-0.5 rounded ${editDraft.fact_kind === "quote" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setEditDraft({ ...editDraft, fact_kind: "quote" })}>Quote</button>
              </div>
              {editDraft.fact_kind === "quote" ? (
                <Textarea className="text-xs min-h-[60px]" placeholder="Verbatim quote text" value={editDraft.value} onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })} />
              ) : (
                <div className="flex gap-2">
                  <Input className="text-xs h-7 w-32 shrink-0" placeholder="Value e.g. 98%" value={editDraft.value} onChange={(e) => setEditDraft({ ...editDraft, value: e.target.value })} />
                  <Input className="text-xs h-7 flex-1" placeholder="Label e.g. acceptance rate" value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} />
                </div>
              )}
              {editDraft.fact_kind === "quote" && (
                <div className="flex gap-2">
                  <Input className="text-xs h-7 flex-1" placeholder="Attributed to (name)" value={editDraft.attribution_name} onChange={(e) => setEditDraft({ ...editDraft, attribution_name: e.target.value })} />
                  <Input className="text-xs h-7 flex-1" placeholder="Title" value={editDraft.attribution_title} onChange={(e) => setEditDraft({ ...editDraft, attribution_title: e.target.value })} />
                  <Input className="text-xs h-7 flex-1" placeholder="Company" value={editDraft.attribution_company} onChange={(e) => setEditDraft({ ...editDraft, attribution_company: e.target.value })} />
                </div>
              )}
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
                {p.fact_kind === "quote" ? (
                  <div className="mb-0.5">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-sm text-slate-700 italic flex-1 min-w-0">"{p.value || "(no quote)"}"</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-violet-300 text-violet-600 shrink-0">Quote</Badge>
                      {p.approved_for_ai !== false ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-300 text-emerald-600 shrink-0">AI</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-400 shrink-0">AI off</Badge>
                      )}
                    </div>
                    {(p.attribution_name || p.attribution_title || p.attribution_company) && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        — {[p.attribution_name, p.attribution_title, p.attribution_company].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-slate-800">{p.value || "(no value)"}</span>
                    <span className="text-sm text-slate-600">{p.label}</span>
                    {p.approved_for_ai !== false ? (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-300 text-emerald-600 shrink-0">AI</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-300 text-slate-400 shrink-0">AI off</Badge>
                    )}
                  </div>
                )}
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
          <div className="flex gap-1 bg-white rounded-md p-1 border border-slate-200 w-fit">
            <button type="button" className={`text-[11px] px-2.5 py-0.5 rounded ${draft.fact_kind === "stat" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setDraft({ ...draft, fact_kind: "stat" })}>Stat</button>
            <button type="button" className={`text-[11px] px-2.5 py-0.5 rounded ${draft.fact_kind === "quote" ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setDraft({ ...draft, fact_kind: "quote" })}>Quote</button>
          </div>
          {draft.fact_kind === "quote" ? (
            <>
              <Textarea className="text-xs min-h-[60px]" placeholder="Verbatim quote text" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
              <div className="flex gap-2">
                <Input className="text-xs h-7 flex-1" placeholder="Attributed to (name)" value={draft.attribution_name} onChange={(e) => setDraft({ ...draft, attribution_name: e.target.value })} />
                <Input className="text-xs h-7 flex-1" placeholder="Title" value={draft.attribution_title} onChange={(e) => setDraft({ ...draft, attribution_title: e.target.value })} />
                <Input className="text-xs h-7 flex-1" placeholder="Company" value={draft.attribution_company} onChange={(e) => setDraft({ ...draft, attribution_company: e.target.value })} />
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Input className="text-xs h-7 w-32 shrink-0" placeholder="Value e.g. 98%" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
              <Input className="text-xs h-7 flex-1" placeholder="Label e.g. acceptance rate" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
          )}
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
                        {c.fact_kind === "quote" ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-violet-300 text-violet-600 shrink-0">Quote</Badge>
                            </div>
                            <Textarea className="text-xs min-h-[56px]" placeholder="Quote text" value={c.value} onChange={(e) => updateCandidate(idx, { value: e.target.value })} />
                            <div className="flex gap-2">
                              <Input className="text-xs h-7 flex-1" placeholder="Name" value={c.attribution_name} onChange={(e) => updateCandidate(idx, { attribution_name: e.target.value })} />
                              <Input className="text-xs h-7 flex-1" placeholder="Title" value={c.attribution_title} onChange={(e) => updateCandidate(idx, { attribution_title: e.target.value })} />
                              <Input className="text-xs h-7 flex-1" placeholder="Company" value={c.attribution_company} onChange={(e) => updateCandidate(idx, { attribution_company: e.target.value })} />
                            </div>
                          </>
                        ) : (
                          <div className="flex gap-2">
                            <Input className="text-xs h-7 w-28 shrink-0 font-semibold" placeholder="Value" value={c.value} onChange={(e) => updateCandidate(idx, { value: e.target.value })} />
                            <Input className="text-xs h-7 flex-1" placeholder="Label" value={c.label} onChange={(e) => updateCandidate(idx, { label: e.target.value })} />
                          </div>
                        )}
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
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-2">
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
