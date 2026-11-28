/**
 * Report reader — turns a paginated HTML report into a reading experience.
 *
 * Report document contract (kept deliberately small so any designed report can
 * be dropped in):
 *   - A normal HTML document (its own <head>, fonts, <style>, scripts).
 *   - Each page is a `<section class="page">`, designed at 816×1056 CSS px
 *     (US Letter at 96dpi) for the magazine view.
 *   - The viewer puts `rr-mag` or `rr-scroll` on <html>, so a report can ship
 *     a fixed-page layout (`html.rr-mag …`) and a reflowed reading layout
 *     (`html.rr-scroll …`). A report that only styles fixed pages still works
 *     in scroll view: pages are scaled to fit the width.
 *   - Links with `data-cp` open the page's Chili Piper modal; `data-form` opens
 *     the lead form modal (same bridge as the custom-html block).
 *   - Optional extras the viewer understands:
 *       `data-toc="Chapter"` on a page   → entry in the Contents menu
 *       `data-title="…"` on a page        → label for page-level analytics
 *       `<a data-rr-video="https://youtube.com/…">` → plays in the page's video player
 *       `<div data-rr-assessment><script type="application/json">{…}</script>…</div>`
 *         → interactive scored assessment (static fallback markup inside is
 *           what prints / shows without the viewer). Config:
 *           { questions:[{q, options:[{label, score}]}], results:[{min, title, body, cta, ctaAction}] }
 *   - A PDF can be read instead of HTML: the block renders it with pdf.js and
 *     streams page images in (see `buildPdfReportHtml`).
 *
 * The document is rendered ONLY via `srcdoc` into a sandbox WITHOUT
 * `allow-same-origin` (see BlockReportReader), exactly like custom-html.
 */

import { VIEWER_CSS, VIEWER_JS } from "./report-viewer-runtime";

export type ReportView = "auto" | "magazine" | "scroll";

/** A personal note shown as page 2. Strings may carry page variables
 *  ({{company}} …) that LP Studio resolves before the block renders; a letter
 *  that still contains an unresolved token is skipped, so anonymous visitors
 *  never see "Dear {{first_name}}". */
export interface ReportCoverLetter {
  eyebrow?: string;
  greeting?: string;
  body?: string;
  signName?: string;
  signTitle?: string;
  signImage?: string;
  /** Contents entry for the letter. Default "A note for you". */
  tocLabel?: string;
  /** Builder preview: show the letter even with unresolved tokens. */
  showUnresolved?: boolean;
}

export interface ReportTocEntry {
  title: string;
  /** 1-based page number (cover letter not counted). */
  page: number;
}

export interface ReportViewerConfig {
  title: string;
  pdfUrl: string;
  view: ReportView;
  allowViewToggle: boolean;
  /** Design size of one page in CSS px. Default 816×1056 (US Letter). */
  pageWidth?: number;
  pageHeight?: number;
  /** Open at this page (1-based, cover letter not counted). */
  startPage?: number;
  /** Page URL (no hash) used to build "share this page" links. Empty = no share button. */
  shareUrl?: string;
  allowFullscreen?: boolean;
  showContents?: boolean;
  /** Explicit contents (PDF outline). HTML reports use `data-toc` on pages instead. */
  toc?: ReportTocEntry[];
  coverLetter?: ReportCoverLetter | null;
  /** Pages are `section.page.rr-pdfp[data-rr-pdf]` placeholders filled by postMessage. */
  pdfMode?: boolean;
}

/** postMessage key the frame uses to report its height to the parent. */
export const REPORT_HEIGHT_KEY = "__lpReportHeight";

/** Hard ceiling on the frame height a (sandboxed) report may request. */
export const REPORT_MAX_HEIGHT = 80000;

/** Hash that deep-links a page: #report-p7. */
export const REPORT_PAGE_HASH = /^#report-p(\d{1,4})$/;

export function parseReportPageHash(hash: string): number | null {
  const m = REPORT_PAGE_HASH.exec((hash || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

/** Only fetch report documents from http(s) or same-origin relative URLs. */
export function isAllowedReportSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  return /^https?:\/\//i.test(s);
}

function safeHref(url: string): string {
  const u = url.trim();
  if (!u) return "";
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return /^https?:\/\//i.test(u) ? u : "";
}

function clampDim(v: number | undefined, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 200 && v <= 4000 ? Math.round(v) : fallback;
}

/** Share links must point at an http(s) page. */
function safeShareUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u.split("#")[0] : "";
}

function sanitizeLetter(l: ReportCoverLetter): ReportCoverLetter {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    eyebrow: str(l.eyebrow, 160),
    greeting: str(l.greeting, 200),
    body: str(l.body, 4000),
    signName: str(l.signName, 120),
    signTitle: str(l.signTitle, 160),
    signImage: safeHref(str(l.signImage, 2000)),
    tocLabel: str(l.tocLabel, 80),
    showUnresolved: !!l.showUnresolved,
  };
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Build the srcdoc for the sandboxed frame: the report document with the
 * viewer's CSS, config and runtime spliced in. Returns "" for empty input.
 */
export function buildReportSrcDoc(reportHtml: string, config: ReportViewerConfig): string {
  const raw = (reportHtml || "").trim();
  if (!raw) return "";
  const cfg: ReportViewerConfig = {
    title: config.title || "",
    pdfUrl: safeHref(config.pdfUrl || ""),
    view: config.view === "magazine" || config.view === "scroll" ? config.view : "auto",
    allowViewToggle: !!config.allowViewToggle,
    pageWidth: clampDim(config.pageWidth, 816),
    pageHeight: clampDim(config.pageHeight, 1056),
    startPage: config.startPage && config.startPage > 0 ? Math.floor(config.startPage) : undefined,
    shareUrl: safeShareUrl(config.shareUrl || ""),
    allowFullscreen: config.allowFullscreen !== false,
    showContents: config.showContents !== false,
    toc: (config.toc ?? [])
      .filter((t) => t && typeof t.title === "string" && t.title.trim() && Number.isFinite(t.page) && t.page > 0)
      .slice(0, 200)
      .map((t) => ({ title: t.title.trim().slice(0, 160), page: Math.floor(t.page) })),
    coverLetter: config.coverLetter ? sanitizeLetter(config.coverLetter) : null,
    pdfMode: !!config.pdfMode,
  };
  const head = `<base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${VIEWER_CSS}</style>`;
  const tail = `<script>window.__RR=${escapeScriptJson(cfg)};</script><script>${VIEWER_JS}</script>`;

  let doc = raw;
  if (/<head[^>]*>/i.test(doc)) doc = doc.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  else if (/<html[^>]*>/i.test(doc)) doc = doc.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  else doc = `<!DOCTYPE html><html><head>${head}</head><body>${doc}</body></html>`;

  const idx = doc.toLowerCase().lastIndexOf("</body>");
  return idx === -1 ? doc + tail : doc.slice(0, idx) + tail + doc.slice(idx);
}

/**
 * Placeholder document for PDF mode: one fixed-size page per PDF page. The
 * block renders each page with pdf.js and posts the image into the frame.
 */
export function buildPdfReportHtml(numPages: number): string {
  const n = Math.max(0, Math.min(2000, Math.floor(numPages) || 0));
  let body = "";
  for (let i = 0; i < n; i++) body += `<section class="page rr-pdfp" data-rr-pdf="${i}"></section>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;font-family:Inter,system-ui,sans-serif}</style></head><body>${body}</body></html>`;
}

/** Report URLs that read as a PDF by extension (storage uploads have none: set source "pdf"). */
export function looksLikePdfSrc(src: string): boolean {
  return /\.pdf(\?|#|$)/i.test(src.trim());
}
