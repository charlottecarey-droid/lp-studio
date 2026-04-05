import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, Upload, Loader2, X, Tag, Check, Pencil,
  FolderOpen, ChevronLeft, ChevronRight, Film, Play, Link2, FileText, Trash2,
} from "lucide-react";

// ─── Shared types ───────────────────────────────────────────────────────────

interface MediaItem {
  id: number;
  title: string;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  tags: string[];
  createdAt: string;
}

interface VideoItem {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  isPreloaded: boolean;
  createdAt: string;
}

interface TagCount {
  tag: string;
  count: number;
}

export interface MediaLibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  /** If provided, open directly on this tab */
  defaultTab?: "images" | "videos" | "pdfs" | "og-images";
}

const DRAWER_PAGE_SIZE = 24;

// ─── Images tab ─────────────────────────────────────────────────────────────

function ImagesTab({ onSelect }: { onSelect: (url: string) => void }) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(async (pg?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeTag) params.set("tag", activeTag);
      params.set("page", String(pg ?? page));
      params.set("limit", String(DRAWER_PAGE_SIZE));
      params.set("excludeTag", "og-image");
      const res = await fetch(`/api/lp/media/images?${params}`);
      if (!res.ok) throw new Error("Failed to load");
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

  useEffect(() => { fetchImages(page); }, [fetchImages]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setQuery(value);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchImages(1), 300);
  };

  const handleTagClick = (tag: string) => { setActiveTag(tag); setPage(1); };
  const handlePageChange = (pg: number) => {
    setPage(pg);
    fetchImages(pg);
    if (dropZoneRef.current) dropZoneRef.current.scrollTop = 0;
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadProgress({ current: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      try {
        const relativePath = (files[i] as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const folderTags = relativePath.split("/").slice(0, -1).filter(Boolean)
          .map(p => p.toLowerCase().replace(/[_-]+/g, " ").trim());
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
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }),
      });
      setEditingTags(null);
      fetchImages();
    } catch { /* silent */ }
  };

  return (
    <>
      {/* Search + Upload bar */}
      <div className="px-4 py-3 border-b border-border flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={query} onChange={e => handleSearchChange(e.target.value)} placeholder="Search by name or tag…" className="pl-8 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={!!uploadProgress} onClick={() => fileInputRef.current?.click()} title="Select individual images">
          {uploadProgress
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadProgress.current}/{uploadProgress.total}</>
            : <><Upload className="w-3.5 h-3.5" />Files</>}
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={!!uploadProgress} onClick={() => folderInputRef.current?.click()} title="Upload an entire folder">
          <FolderOpen className="w-3.5 h-3.5" />Folder
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        <input ref={folderInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload}
          {...{ webkitdirectory: "", mozdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>} />
      </div>

      {/* Tag filter chips */}
      {tagCounts.length > 0 && (
        <div className="border-b border-border shrink-0">
          <div className="px-4 py-2 max-h-28 overflow-y-auto flex gap-1.5 flex-wrap">
            {activeTag && (
              <Badge variant="default" className="cursor-pointer text-[11px] gap-1 shrink-0" onClick={() => handleTagClick("")}>
                {activeTag}<X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {tagCounts.filter(tc => tc.tag !== activeTag).map(tc => (
              <Badge key={tc.tag} variant="outline" className="cursor-pointer text-[11px] hover:bg-muted shrink-0" onClick={() => handleTagClick(tc.tag)}>
                {tc.tag}<span className="ml-1 text-muted-foreground">{tc.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div ref={dropZoneRef} className="flex-1 overflow-y-auto px-4 py-4 relative" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {uploadProgress && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            <span>Uploading {uploadProgress.current} of {uploadProgress.total}…</span>
            <div className="flex-1 bg-muted rounded-full h-1.5 ml-1">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">{query || activeTag ? "No images match your search." : "Drop images here or click to upload"}</p>
            {!query && !activeTag && <p className="text-xs mt-1 opacity-60">Supports JPG, PNG, WebP, GIF — select multiple at once</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
              <div key={item.id} className="group relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                <div className="aspect-video" onClick={() => onSelect(item.url)}>
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={item.title}>{item.title}</p>
                  {editingTags === item.id ? (
                    <div className="mt-1.5 flex gap-1">
                      <Input value={editTagValue} onChange={e => setEditTagValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSaveTags(item.id); }} placeholder="tag1, tag2, tag3" className="h-6 text-[10px] flex-1" autoFocus />
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleSaveTags(item.id)}><Check className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {item.tags.length > 0 ? item.tags.slice(0, 3).map(t => (
                        <span key={t} className="inline-block px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">{t}</span>
                      )) : <span className="text-[10px] text-muted-foreground italic">Tagging…</span>}
                      {item.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>}
                      <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={e => { e.stopPropagation(); setEditingTags(item.id); setEditTagValue(item.tags.join(", ")); }} title="Edit tags">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{total} image{total !== 1 ? "s" : ""} &middot; p.{page}/{totalPages}</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1 || loading} onClick={() => handlePageChange(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === "…"
                  ? <span key={`e${i}`} className="text-xs text-muted-foreground px-0.5">…</span>
                  : <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => handlePageChange(p as number)} disabled={loading}>{p}</Button>
                )}
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages || loading} onClick={() => handlePageChange(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── OG Images tab ──────────────────────────────────────────────────────────

function OgImagesTab({ onSelect }: { onSelect: (url: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [editTagValue, setEditTagValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(async (pg?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("onlyTag", "og-image");
      params.set("page", String(pg ?? page));
      params.set("limit", String(DRAWER_PAGE_SIZE));
      const res = await fetch(`/api/lp/media/images?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { items: MediaItem[]; total: number; page: number; totalPages: number };
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchImages(page); }, [fetchImages]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadProgress({ current: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      try {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("folderTags", "og-image");
        const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
        if (!res.ok) failed++;
      } catch { failed++; }
    }
    await fetchImages();
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    if (!tags.includes("og-image")) tags.unshift("og-image");
    try {
      await fetch(`/api/lp/media/${id}/tags`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }),
      });
      setEditingTags(null);
      fetchImages();
    } catch { /* silent */ }
  };

  const handlePageChange = (pg: number) => {
    setPage(pg);
    fetchImages(pg);
    if (dropZoneRef.current) dropZoneRef.current.scrollTop = 0;
  };

  return (
    <>
      <div className="px-4 py-2.5 border-b border-border bg-amber-50/60 shrink-0">
        <p className="text-[11px] text-amber-700 leading-snug">
          <span className="font-semibold">OG / Social sharing images only.</span> These are used for link previews (Open Graph meta tags) and are <span className="font-semibold">never</span> selected by the AI when building page content.
        </p>
      </div>

      <div className="px-4 py-3 border-b border-border flex gap-2 shrink-0">
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={!!uploadProgress} onClick={() => fileInputRef.current?.click()} title="Upload OG images">
          {uploadProgress
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadProgress.current}/{uploadProgress.total}</>
            : <><Upload className="w-3.5 h-3.5" />Upload OG Image</>}
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      <div ref={dropZoneRef} className="flex-1 overflow-y-auto px-4 py-4 relative" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {uploadProgress && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            <span>Uploading {uploadProgress.current} of {uploadProgress.total}…</span>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Drop OG images here or click to upload</p>
            <p className="text-xs mt-1 opacity-60">1200×630 px recommended · JPG, PNG, WebP</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
              <div key={item.id} className="group relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                <div className="aspect-video" onClick={() => onSelect(item.url)}>
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={item.title}>{item.title}</p>
                  {editingTags === item.id ? (
                    <div className="mt-1.5 flex gap-1">
                      <Input value={editTagValue} onChange={e => setEditTagValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSaveTags(item.id); }} placeholder="og-image, tag2, …" className="h-6 text-[10px] flex-1" autoFocus />
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleSaveTags(item.id)}><Check className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {item.tags.slice(0, 3).map(t => (
                        <span key={t} className="inline-block px-1.5 py-0.5 rounded-full bg-amber-100 text-[10px] text-amber-700">{t}</span>
                      ))}
                      <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        onClick={e => { e.stopPropagation(); setEditingTags(item.id); setEditTagValue(item.tags.join(", ")); }} title="Edit tags">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{total} image{total !== 1 ? "s" : ""} &middot; p.{page}/{totalPages}</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1 || loading} onClick={() => handlePageChange(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages || loading} onClick={() => handlePageChange(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Videos tab ─────────────────────────────────────────────────────────────

const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
function isNativeVideo(url: string) {
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTS.some(ext => lower.endsWith(ext));
}

function VideosTab({ onSelect }: { onSelect: (url: string) => void }) {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lp/media?mediaType=video");
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { items: VideoItem[] };
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const uploadVideo = async (file: File) => {
    setUploading(true);
    setUploadPct(0);
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/lp/media/upload");
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error("Upload failed"));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const f of files) await uploadVideo(f);
      await fetchVideos();
    } catch (err) {
      alert((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("video/"));
    if (files.length === 0) return;
    try {
      for (const f of files) await uploadVideo(f);
      await fetchVideos();
    } catch (err) {
      alert((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try { new URL(trimmed); } catch { setUrlError("Please enter a valid URL."); return; }
    setUrlError("");
    setUrlInput("");
    onSelect(trimmed);
  };

  return (
    <>
      {/* Upload bar */}
      <div className="px-4 py-3 border-b border-border flex gap-2 shrink-0">
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadPct}%</>
            : <><Upload className="w-3.5 h-3.5" />Upload Video</>}
        </Button>
        <input ref={fileInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleFileChange} />

        {/* URL paste */}
        <div className="flex flex-1 gap-1.5">
          <div className="relative flex-1">
            <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleAddUrl(); }}
              placeholder="Paste YouTube, Vimeo, Loom, or .mp4 URL…"
              className={`pl-8 h-9 text-sm ${urlError ? "border-red-400" : ""}`}
            />
          </div>
          <Button size="sm" className="h-9 shrink-0" onClick={handleAddUrl}>Use URL</Button>
        </div>
      </div>
      {urlError && <p className="px-4 pt-1 text-xs text-red-500">{urlError}</p>}

      {/* Upload progress bar */}
      {uploading && (
        <div className="px-4 pt-2 pb-0 shrink-0">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {/* Video grid */}
      <div
        ref={dropZoneRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Film className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Drop videos here or click to upload</p>
            <p className="text-xs mt-1 opacity-60">MP4, WebM, OGG, MOV — or paste a URL above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
              <div
                key={item.id}
                className="group relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                onClick={() => onSelect(item.url)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-black relative">
                  {isNativeVideo(item.url) ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 1; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <Film className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <Play className="w-4 h-4 text-slate-900 ml-0.5" />
                    </div>
                  </div>
                  {item.isPreloaded && (
                    <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">Built-in</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={item.title}>{item.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.mimeType}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── PDFs tab ────────────────────────────────────────────────────────────────

interface PdfItem {
  id: string;
  title: string;
  url: string;
  sizeBytes: number | null;
  createdAt: string;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PdfsTab({ onSelect }: { onSelect: (url: string) => void }) {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const fetchPdfs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lp/media?mediaType=pdf");
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { items: PdfItem[] };
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPdfs(); }, [fetchPdfs]);

  const uploadPdf = (file: File) => {
    setUploading(true);
    setUploadPct(0);
    setError("");
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/lp/pdf/upload");
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          try { reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Upload failed")); }
          catch { reject(new Error("Upload failed")); }
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const f of files) await uploadPdf(f);
      await fetchPdfs();
    } catch (err) {
      setError((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length === 0) return;
    try {
      for (const f of files) await uploadPdf(f);
      await fetchPdfs();
    } catch (err) {
      setError((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this PDF?")) return;
    try {
      const res = await fetch(`/api/lp/media/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError((err as Error).message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadPct}%</>
            : <><Upload className="w-3.5 h-3.5" />Upload PDF</>}
        </Button>
        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={handleFileChange} />
        <span className="text-xs text-muted-foreground">Max 50 MB per file</span>
      </div>
      {error && <p className="px-4 pt-2 text-xs text-red-500">{error}</p>}
      {uploading && (
        <div className="px-4 pt-2 pb-0 shrink-0">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}
      <div
        ref={dropZoneRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Drop PDFs here or click to upload</p>
            <p className="text-xs mt-1 opacity-60">PDF files up to 50 MB</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
              <div
                key={item.id}
                className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                onClick={() => onSelect(item.url)}
              >
                <div className="shrink-0 w-9 h-9 rounded-md bg-red-50 border border-red-200 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={item.title}>{item.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatBytes(item.sizeBytes)}{item.sizeBytes ? " · " : ""}{new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all p-1 rounded"
                  onClick={(e) => handleDelete(item.id, e)}
                  title="Delete PDF"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main drawer ─────────────────────────────────────────────────────────────

export function MediaLibraryDrawer({ open, onOpenChange, onSelect, defaultTab = "images" }: MediaLibraryDrawerProps) {
  const handleSelect = (url: string) => {
    onSelect(url);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-lg">Media Library</SheetTitle>
          <SheetDescription className="text-xs">Browse and upload images, videos, and PDFs for your pages.</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 mb-0 shrink-0 w-fit">
            <TabsTrigger value="images" className="text-xs px-3">Images</TabsTrigger>
            <TabsTrigger value="og-images" className="text-xs px-3">OG Images</TabsTrigger>
            <TabsTrigger value="videos" className="text-xs px-3">Videos</TabsTrigger>
            <TabsTrigger value="pdfs" className="text-xs px-3">PDFs</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <ImagesTab onSelect={handleSelect} />
          </TabsContent>

          <TabsContent value="og-images" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <OgImagesTab onSelect={handleSelect} />
          </TabsContent>

          <TabsContent value="videos" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <VideosTab onSelect={handleSelect} />
          </TabsContent>

          <TabsContent value="pdfs" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <PdfsTab onSelect={handleSelect} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
