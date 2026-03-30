import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, Play, Check, X, Film, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  isPreloaded: boolean;
}

const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
function isNativeVideo(url: string) {
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTS.some(ext => lower.endsWith(ext));
}

async function fetchMediaLibrary(): Promise<MediaItem[]> {
  const res = await fetch("/api/lp/media?mediaType=video");
  if (!res.ok) return [];
  const data = await res.json() as { items: MediaItem[] };
  return data.items ?? [];
}

async function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<MediaItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/lp/media/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as MediaItem);
      } else {
        const body = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(body.error ?? "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

interface VideoThumbnailProps {
  item: MediaItem;
  selected: boolean;
  onClick: () => void;
}

function VideoThumbnail({ item, selected, onClick }: VideoThumbnailProps) {
  const isEmbed = item.mimeType === "text/html" || !isNativeVideo(item.url);
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-lg overflow-hidden border-2 text-left w-full transition-all focus:outline-none",
        selected ? "border-[#C7E738] ring-2 ring-[#C7E738]/30" : "border-border hover:border-[#003A30]/40"
      )}
    >
      <div className="aspect-video bg-slate-100 relative">
        {isEmbed ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#003A30]/10">
            <Globe className="w-6 h-6 text-[#003A30]/50 mb-1" />
            <span className="text-[10px] text-[#003A30]/50 font-medium">Embed</span>
          </div>
        ) : (
          <video
            src={item.url}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="w-6 h-6 text-white drop-shadow" />
        </div>
        {selected && (
          <div className="absolute top-1.5 right-1.5 bg-[#C7E738] rounded-full p-0.5">
            <Check className="w-3 h-3 text-[#003A30]" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 bg-white">
        <p className="text-xs font-medium text-slate-700 truncate">{item.title}</p>
        {item.isPreloaded && (
          <p className="text-[10px] text-slate-400">Pre-loaded</p>
        )}
      </div>
    </button>
  );
}

interface VideoPickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function VideoPicker({ value, onChange, label }: VideoPickerProps) {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [tab, setTab] = useState<"library" | "url">("library");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const items = await fetchMediaLibrary();
      setLibrary(items);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setCustomUrl(value);
    loadLibrary();
  };

  const handleSelectLibraryItem = (item: MediaItem) => {
    onChange(item.url);
    setOpen(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const item = await uploadVideo(file, setUploadProgress);
      setLibrary(prev => [item, ...prev]);
      onChange(item.url);
      setOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleApplyUrl = () => {
    onChange(customUrl);
    setOpen(false);
  };

  const hasVideo = value && value.trim() !== "";
  const currentTitle = library.find(item => item.url === value)?.title;
  const currentIsNative = hasVideo && isNativeVideo(value);

  return (
    <div>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          {label}
        </Label>
      )}

      {hasVideo && (
        <div className="relative mb-2 rounded-lg overflow-hidden border border-border bg-black group">
          {currentIsNative ? (
            <video
              src={value}
              className="w-full h-28 object-cover opacity-80"
              preload="metadata"
              muted
            />
          ) : (
            <div className="w-full h-28 flex flex-col items-center justify-center bg-[#003A30]/10">
              <Film className="w-8 h-8 text-[#003A30]/40 mb-1" />
              <p className="text-xs text-slate-500 text-center px-2 truncate max-w-full">
                {currentTitle ?? "Embedded video"}
              </p>
            </div>
          )}
          <button
            onClick={() => onChange("")}
            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove video"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full text-sm gap-2"
        onClick={handleOpen}
      >
        <Film className="w-4 h-4" />
        {hasVideo ? "Change Video" : "Choose Video"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Video Library</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 border-b">
            <button
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === "library"
                  ? "border-[#003A30] text-[#003A30]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("library")}
            >
              Library
            </button>
            <button
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === "url"
                  ? "border-[#003A30] text-[#003A30]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("url")}
            >
              Embed URL
            </button>
          </div>

          {tab === "library" && (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {library.length} video{library.length !== 1 ? "s" : ""} available
                </p>
                <div className="flex items-center gap-2">
                  {uploading && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{uploadProgress}%</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Upload Video
                  </Button>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-red-500 mb-3">{uploadError}</p>
              )}

              {loadingLibrary ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {library.map(item => (
                    <VideoThumbnail
                      key={item.id}
                      item={item}
                      selected={value === item.url}
                      onClick={() => handleSelectLibraryItem(item)}
                    />
                  ))}
                  {library.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-muted-foreground">
                      <Film className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No videos yet. Upload one to get started.</p>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          )}

          {tab === "url" && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Paste a YouTube, Vimeo, Loom, or other embed URL.
              </p>
              <Input
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://www.youtube.com/embed/..."
                className="text-sm"
                onKeyDown={e => { if (e.key === "Enter") handleApplyUrl(); }}
              />
              <Button
                type="button"
                className="w-full"
                style={{ backgroundColor: "#003A30", color: "white" }}
                onClick={handleApplyUrl}
                disabled={!customUrl.trim()}
              >
                Use This URL
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
