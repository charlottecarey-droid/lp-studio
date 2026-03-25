import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, Loader2, X, Tag, Check, Pencil } from "lucide-react";

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

interface MediaLibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
}

export function MediaLibraryDrawer({ open, onOpenChange, onSelect }: MediaLibraryDrawerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [editTagValue, setEditTagValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeTag) params.set("tag", activeTag);
      const res = await fetch(`/api/lp/media/images?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { items: MediaItem[]; tagCounts: TagCount[] };
      setItems(data.items);
      setTagCounts(data.tagCounts);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeTag]);

  useEffect(() => {
    if (open) fetchImages();
  }, [open, fetchImages]);

  // Debounced search
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (value: string) => {
    setQuery(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchImages(), 300);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lp/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      // Refresh the list to show the new image
      await fetchImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSelect = (item: MediaItem) => {
    onSelect(item.url);
    onOpenChange(false);
  };

  const handleSaveTags = async (id: number) => {
    const tags = editTagValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await fetch(`/api/lp/media/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      setEditingTags(null);
      fetchImages();
    } catch {
      // silent
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-lg">Media Library</SheetTitle>
          <SheetDescription className="text-xs">
            Browse, search, and select images. Auto-tagged by AI on upload.
          </SheetDescription>
        </SheetHeader>

        {/* Search + Upload bar */}
        <div className="px-4 py-3 border-b border-border flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or tag…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 shrink-0"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {/* Tag filter chips */}
        {tagCounts.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex gap-1.5 flex-wrap shrink-0">
            {activeTag && (
              <Badge
                variant="default"
                className="cursor-pointer text-[11px] gap-1"
                onClick={() => { setActiveTag(""); fetchImages(); }}
              >
                {activeTag}
                <X className="w-2.5 h-2.5" />
              </Badge>
            )}
            {tagCounts
              .filter((tc) => tc.tag !== activeTag)
              .slice(0, 12)
              .map((tc) => (
                <Badge
                  key={tc.tag}
                  variant="outline"
                  className="cursor-pointer text-[11px] hover:bg-muted"
                  onClick={() => { setActiveTag(tc.tag); }}
                >
                  {tc.tag}
                  <span className="ml-1 text-muted-foreground">{tc.count}</span>
                </Badge>
              ))}
          </div>
        )}

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Upload className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {query || activeTag ? "No images match your search." : "No images yet. Upload your first one!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="aspect-video" onClick={() => handleSelect(item)}>
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={item.title}>
                      {item.title}
                    </p>
                    {editingTags === item.id ? (
                      <div className="mt-1.5 flex gap-1">
                        <Input
                          value={editTagValue}
                          onChange={(e) => setEditTagValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveTags(item.id); }}
                          placeholder="tag1, tag2, tag3"
                          className="h-6 text-[10px] flex-1"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleSaveTags(item.id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {item.tags.length > 0 ? (
                          item.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="inline-block px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">
                            Tagging…
                          </span>
                        )}
                        {item.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{item.tags.length - 3}
                          </span>
                        )}
                        <button
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTags(item.id);
                            setEditTagValue(item.tags.join(", "));
                          }}
                          title="Edit tags"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
