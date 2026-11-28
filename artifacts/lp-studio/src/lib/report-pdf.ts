/**
 * Report reader — PDF mode (parent side).
 *
 * Opens a PDF with pdf.js (already bundled for the one-pager editor and the
 * hub thumbnails), reads its page size and outline, and renders pages to
 * JPEG blobs with their link annotations, so the sandboxed viewer can show
 * any PDF as a flipbook. Runs in the visitor's browser; nothing server-side.
 */
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReportTocEntry } from "./report-reader";

export interface OpenedPdf {
  pdf: PDFDocumentProxy;
  numPages: number;
  /** Page design size for the viewer: 816 px wide, height from the first page's aspect ratio. */
  pageWidth: number;
  pageHeight: number;
  toc: ReportTocEntry[];
}

/** A link on a rendered page, as fractions of the page box. */
export interface PdfPageLink {
  x: number;
  y: number;
  w: number;
  h: number;
  url?: string;
  /** 1-based page number for an internal link. */
  page?: number;
}

export async function openPdf(data: ArrayBuffer): Promise<OpenedPdf> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const first = await pdf.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  const pageWidth = 816;
  const pageHeight = Math.max(300, Math.min(3000, Math.round((pageWidth * vp.height) / vp.width)));
  const toc = await readOutline(pdf);
  return { pdf, numPages: pdf.numPages, pageWidth, pageHeight, toc };
}

async function destToPage(pdf: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    const d = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(d) || d[0] == null) return null;
    const ref = d[0] as unknown;
    if (typeof ref === "number") return ref + 1;
    if (typeof ref === "object") return (await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0])) + 1;
    return null;
  } catch {
    return null;
  }
}

/** Top two levels of the PDF outline, in page order. */
async function readOutline(pdf: PDFDocumentProxy): Promise<ReportTocEntry[]> {
  const outline = await pdf.getOutline().catch(() => null);
  if (!outline || outline.length === 0) return [];
  const out: ReportTocEntry[] = [];
  const visit = async (items: typeof outline, depth: number) => {
    for (const item of items) {
      if (out.length >= 200) return;
      const page = await destToPage(pdf, item.dest);
      const title = (item.title ?? "").trim();
      if (page && title) out.push({ title, page });
      if (depth === 0 && item.items?.length) await visit(item.items, 1);
    }
  };
  await visit(outline, 0);
  return out.sort((a, b) => a.page - b.page);
}

/** Render one page (0-based) to a JPEG blob `targetWidth` px wide, plus its links. */
export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  index: number,
  targetWidth: number,
): Promise<{ blob: Blob; links: PdfPageLink[] }> {
  const page = await pdf.getPage(index + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: targetWidth / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.86),
    );
    canvas.width = 0;
    canvas.height = 0;

    const links: PdfPageLink[] = [];
    const annots = (await page.getAnnotations({ intent: "display" }).catch(() => [])) as Array<Record<string, unknown>>;
    for (const a of annots) {
      if (a.subtype !== "Link" || !Array.isArray(a.rect) || links.length >= 60) continue;
      const [x1, y1, x2, y2] = base.convertToViewportRectangle(a.rect as number[]);
      const box = {
        x: Math.min(x1, x2) / base.width,
        y: Math.min(y1, y2) / base.height,
        w: Math.abs(x2 - x1) / base.width,
        h: Math.abs(y2 - y1) / base.height,
      };
      if (typeof a.url === "string" && /^(https?:|mailto:)/i.test(a.url)) links.push({ ...box, url: a.url });
      else if (a.dest != null) {
        const p = await destToPage(pdf, a.dest);
        if (p) links.push({ ...box, page: p });
      }
    }
    return { blob, links };
  } finally {
    page.cleanup();
  }
}
