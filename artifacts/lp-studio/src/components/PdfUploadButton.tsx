/**
 * Shared "Upload PDF" button: validates type + size, uploads through the
 * WAF-safe base64 route (`POST /api/lp/pdf/upload`, see lib/pdf-upload.ts)
 * and hands back the stored URL + a title derived from the filename.
 *
 * Used by the Content Hub panels and the Resource Link List panel.
 */
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPdfUploadFormData } from "@/lib/pdf-upload";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export async function uploadPdf(file: File): Promise<{ url: string; title: string }> {
  const formData = await buildPdfUploadFormData(file);
  const res = await fetch("/api/lp/pdf/upload", { method: "POST", body: formData, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { url?: string; title?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  if (!data.url) throw new Error("Upload succeeded but no URL was returned");
  return { url: data.url, title: data.title ?? "" };
}

export function PdfUploadButton({ onUploaded, label = "Upload PDF", className = "" }: {
  onUploaded: (r: { url: string; title: string }, file: File) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      onUploaded(await uploadPdf(file), file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handle} />
      <Button type="button" variant="outline" size="sm" className={`h-7 gap-1 px-2 text-[11px] ${className}`} disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {uploading ? "Uploading…" : label}
      </Button>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </>
  );
}
