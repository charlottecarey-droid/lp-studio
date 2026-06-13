import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, ImageIcon, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MediaLibraryDrawer } from "@/components/MediaLibraryDrawer";
import { useAuth } from "@/context/AuthContext";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /**
   * Task #234 — short context phrase used as the default AI generation
   * brief when the user clicks "Generate" without typing a Tweak prompt.
   * Optional: callers should pass the surrounding field/section label
   * (e.g. "Hero image", "Founder portrait") so default generations are
   * on-topic. Falls back to the picker `label`, then a generic phrase.
   */
  aiHint?: string;
  /**
   * Tailwind classes for the preview <img>. Defaults to a short cropped band
   * (`w-full h-24 object-cover`). Pass a taller `object-contain` variant when
   * the full image must be visible (e.g. case-study cover images) rather than
   * cropped to a thin strip.
   */
  previewClassName?: string;
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/lp/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
    throw new Error(err.error ?? "Upload failed");
  }
  const { url } = await res.json() as { url: string };
  return `/api/storage${url}`;
}

export function ImagePicker({ value, onChange, label, placeholder, className, aiHint, previewClassName = "w-full h-24 object-cover" }: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Task #234 — Generate / Tweak controls. Hidden unless the workspace has
  // the `aiImageGenOutsideBuilderEnabled` flag flipped on by a Dandy
  // operator. The Tweak input is the user's freeform brief; when empty we
  // fall back to `aiHint` (caller context) → `label` → a generic phrase.
  const { user } = useAuth();
  const aiEnabled = !!user?.aiImageGenOutsideBuilderEnabled;
  const [tweak, setTweak] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const serveUrl = await uploadImage(file);
      onChange(serveUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const brief = (tweak.trim() || aiHint?.trim() || label?.trim() || "On-brand editorial image").slice(0, 1000);
      const res = await fetch("/api/lp/image/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, altHint: aiHint ?? label ?? undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" })) as { error?: string };
        throw new Error(err.error ?? "Generation failed");
      }
      const { url } = await res.json() as { url: string };
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const hasImage = value && value.trim() !== "";

  return (
    <div className={className}>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          {label}
        </Label>
      )}
      {hasImage && (
        <div className="relative mb-2 rounded-lg overflow-hidden border border-border bg-muted/30 group min-h-9">
          <img
            src={value}
            alt="Preview"
            className={previewClassName}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {/* Always visible (not hover-gated): a hover-only control vanishes on
              touch and disappears entirely when a broken image collapses the
              preview, so the remove affordance was effectively missing. */}
          <button
            onClick={() => onChange("")}
            className="absolute top-1 right-1 z-10 bg-black/60 hover:bg-destructive text-white rounded-full p-1 opacity-100 transition-colors"
            title="Remove image"
            aria-label="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex gap-1.5 items-center">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-sm flex-1"
          placeholder={placeholder ?? "Paste URL or upload"}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 w-8 h-8"
          title="Browse media library"
          onClick={() => setLibraryOpen(true)}
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 w-8 h-8"
          title="Upload image"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {aiEnabled && (
        <div className="flex gap-1.5 items-center mt-1.5">
          <Input
            value={tweak}
            onChange={e => setTweak(e.target.value)}
            className="text-xs flex-1 h-8"
            placeholder="Tweak (optional brief — e.g. 'sunlit dental clinic, warm tones')"
            disabled={isGenerating}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 h-8 text-xs gap-1"
            title="Generate an on-brand AI image"
            disabled={isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Generate
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      <MediaLibraryDrawer
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onSelect={(url) => onChange(url)}
      />
    </div>
  );
}
