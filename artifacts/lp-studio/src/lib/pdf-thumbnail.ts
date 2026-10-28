/**
 * PDF → thumbnail, in the browser (Content Hub, Oct 2026).
 *
 * Renders the first page of a PDF with pdf.js (already bundled for the
 * one-pager editor) onto a canvas, encodes it as a JPEG and uploads it as an
 * ordinary image, so a hub card can show the poster / brochure itself instead
 * of the designed placeholder. Runs in the builder as the signed-in user: no
 * server-side rasterizer, no new dependency. Sources can be a File (just
 * uploaded) or a same-origin storage URL (already attached).
 */
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { uploadImage } from "@/components/ImagePicker";

export interface PdfThumbnailOptions {
  /** Longest edge of the thumbnail in CSS pixels. Default 1200. */
  maxEdge?: number;
  /** JPEG quality 0–1. Default 0.88. */
  quality?: number;
}

/** Render page 1 of a PDF to a JPEG blob. Throws when the file isn't a renderable PDF. */
export async function renderPdfFirstPage(source: File | ArrayBuffer | string, opts: PdfThumbnailOptions = {}): Promise<Blob> {
  const maxEdge = opts.maxEdge ?? 1200;
  const quality = opts.quality ?? 0.88;
  let data: ArrayBuffer;
  if (typeof source === "string") {
    const res = await fetch(source, { credentials: "include" });
    if (!res.ok) throw new Error(`Could not fetch the PDF (${res.status})`);
    data = await res.arrayBuffer();
  } else if (source instanceof ArrayBuffer) {
    data = source;
  } else {
    data = await source.arrayBuffer();
  }
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = maxEdge / Math.max(base.width, base.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    // White behind transparent pages — a poster with no background must not come out black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality));
  } finally {
    await pdf.destroy().catch(() => {});
  }
}

/** Render + upload. Returns the stored image URL to set as the resource's thumbnail. */
export async function createPdfThumbnail(source: File | ArrayBuffer | string, filename = "thumbnail", opts?: PdfThumbnailOptions): Promise<string> {
  const blob = await renderPdfFirstPage(source, opts);
  const safe = filename.replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "-").slice(0, 80) || "thumbnail";
  return uploadImage(new File([blob], `${safe}-thumb.jpg`, { type: "image/jpeg" }));
}

/** Items that can get a generated thumbnail: hosted PDFs (a storage URL) with no thumbnail yet. */
export function needsPdfThumbnail(a: { kind?: string; fileUrl?: string; thumbnailUrl?: string }): boolean {
  if (a.kind !== "pdf") return false;
  const file = (a.fileUrl ?? "").trim();
  if (!file || !/\/api\/storage\/objects\//.test(file)) return false;
  return !(a.thumbnailUrl ?? "").trim();
}
