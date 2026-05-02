import { useRef, useState } from "react";
import type { ResourcesBlockProps, ResourceItem } from "../../../lib/block-types";
import { BG_OPTIONS } from "@/lib/bg-styles";
type BgOpts = typeof BG_OPTIONS;
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, Upload, Loader2, FileText } from "lucide-react";
import { ImagePicker } from "@/components/ImagePicker";
import { LibraryButtons, SaveItemToLibraryButton } from "@/components/LibraryPicker";

interface Props {
  props: ResourcesBlockProps;
  onChange: (next: ResourcesBlockProps) => void;
  bgOptions?: BgOpts;
}

interface PdfUploadResponse {
  url: string;
  title?: string;
  error?: string;
}

/** Upload a PDF to the shared /api/lp/pdf/upload endpoint and return the
 *  serve URL + the cleaned-up filename so the caller can pre-fill the
 *  resource title. The endpoint enforces a 50 MB cap and PDF mime check
 *  server-side, so client-side validation is intentionally light. */
async function uploadPdf(file: File): Promise<{ url: string; title: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/lp/pdf/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as PdfUploadResponse;
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  if (!data.url) throw new Error("Upload succeeded but no URL was returned");
  // The endpoint returns the serve path already prefixed with /api/storage.
  return { url: data.url, title: data.title ?? "" };
}

// Match the server-side cap in /lp/pdf/upload (50 MB) so we can fail fast
// with a friendly message instead of round-tripping a doomed upload.
const MAX_PDF_BYTES = 50 * 1024 * 1024;

/** Inline upload button shown next to a resource item's URL field. On
 *  successful upload it writes the PDF's serve URL into `url`, sets
 *  `category` to "PDF" when the user hasn't customised it, and pre-fills
 *  the title when it's still the default placeholder. */
function PdfUploadButton({ item, onPatch }: { item: ResourceItem; onPatch: (patch: Partial<ResourceItem>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hold a live ref to the current item so the async upload handler can read
  // the user's most-recent edits when deciding whether to auto-fill title/
  // category. Without this, edits made while an upload is in flight would be
  // clobbered by the captured-at-click-time closure value.
  const itemRef = useRef(item);
  itemRef.current = item;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side preflight — server will re-check, but failing fast saves the
    // round-trip and gives an immediate, friendly error.
    if (file.type && file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("File too large. Maximum size is 50 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { url, title } = await uploadPdf(file);
      const latest = itemRef.current;
      const patch: Partial<ResourceItem> = { url };
      // Only overwrite category/title if they still hold the auto-fill
      // defaults — checked against the latest item state, not the captured
      // closure, so the rep's in-flight edits survive.
      if (!latest.category || latest.category === "Article") patch.category = "PDF";
      if (!latest.title || latest.title === "New Article") patch.title = title || file.name.replace(/\.pdf$/i, "");
      onPatch(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isPdf = typeof item.url === "string" && /\.pdf(\?|$)/i.test(item.url);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={isPdf ? "Replace uploaded PDF" : "Upload a PDF and link it here"}
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : isPdf ? <FileText className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
        {uploading ? "Uploading…" : isPdf ? "Replace PDF" : "Upload PDF"}
      </Button>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </>
  );
}

export default function ResourcesPanel({ props, onChange, bgOptions }: Props) {
  const bgOpts = bgOptions ?? BG_OPTIONS;
  const updateItem = (idx: number, patch: Partial<ResourceItem>) => {
    const items = [...props.items];
    items[idx] = { ...items[idx], ...patch };
    onChange({ ...props, items });
  };

  const addItem = () => {
    onChange({
      ...props,
      items: [
        ...props.items,
        { image: "", title: "New Article", description: "", category: "Article", url: "#" },
      ],
    });
  };

  const removeItem = (idx: number) => {
    onChange({ ...props, items: props.items.filter((_, i) => i !== idx) });
  };

  const handleLoadDefaults = (items: Record<string, unknown>[]) => {
    if (items.length === 0) return;
    onChange({ ...props, items: items as unknown as ResourceItem[] });
  };

  const handleAddFromLibrary = (items: Record<string, unknown>[]) => {
    onChange({ ...props, items: [...props.items, ...(items as unknown as ResourceItem[])] });
  };

  return (
    <div className="space-y-5">
      <LibraryButtons
        type="resource"
        title="Resources Library"
        renderPreview={item => {
          const c = item.content as { category?: string; description?: string };
          return <p className="text-[11px] text-slate-500 truncate">{c.category ?? ""}{c.description ? ` — ${String(c.description).slice(0, 50)}` : ""}</p>;
        }}
        onLoadDefaults={handleLoadDefaults}
        onAddFromLibrary={handleAddFromLibrary}
      />

      <div>
        <Label className="text-xs text-slate-500 mb-1">Headline</Label>
        <Input
          value={props.headline}
          onChange={(e) => onChange({ ...props, headline: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1">Subheadline</Label>
        <Input
          value={props.subheadline}
          onChange={(e) => onChange({ ...props, subheadline: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1">Columns</Label>
        <div className="flex gap-1.5">
          {([2, 3, 4, 5] as const).map((col) => (
            <button
              key={col}
              onClick={() => onChange({ ...props, columns: col })}
              className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                props.columns === col
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-slate-500 mb-1">Background</Label>
        <Select value={props.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...props, backgroundStyle: v as ResourcesBlockProps["backgroundStyle"] })}>
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {bgOpts.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs text-slate-500">Resource Items</Label>
          <Button variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>

        <div className="space-y-4">
          {props.items.map((item, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 space-y-2 bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <GripVertical className="w-3 h-3 text-slate-400" />
                  Item {idx + 1}
                </div>
                <div className="flex items-center gap-1.5">
                  <SaveItemToLibraryButton
                    type="resource"
                    content={item as unknown as Record<string, unknown>}
                    defaultName={item.title || `Resource ${idx + 1}`}
                  />
                  {props.items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Title</Label>
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Description</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400 mb-1 block">Image</Label>
                <ImagePicker
                  value={item.image}
                  onChange={(v) => updateItem(idx, { image: v })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-400">Category Tag</Label>
                <Input
                  value={item.category}
                  onChange={(e) => updateItem(idx, { category: e.target.value })}
                  placeholder="Article, Guide, Report..."
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-slate-400">Link URL</Label>
                  <PdfUploadButton item={item} onPatch={(patch) => updateItem(idx, patch)} />
                </div>
                <Input
                  value={item.url}
                  onChange={(e) => updateItem(idx, { url: e.target.value })}
                  placeholder="https://… or upload a PDF"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
