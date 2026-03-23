import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

async function uploadImage(file: File): Promise<string> {
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

export function ImagePicker({ value, onChange, label, placeholder, className }: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const hasImage = value && value.trim() !== "";

  return (
    <div className={className}>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          {label}
        </Label>
      )}
      {hasImage && (
        <div className="relative mb-2 rounded-lg overflow-hidden border border-border bg-muted/30 group">
          <img
            src={value}
            alt="Preview"
            className="w-full h-24 object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button
            onClick={() => onChange("")}
            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-center">
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
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
