import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReportReaderBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { usePageContext } from "@/lib/page-context";
import { resolveCtaConfig } from "@/lib/cta/ctaConfig";
import { parseLpCtaMessage, resolveLpCtaAction } from "@/lib/custom-html-cta";
import { resolveHubPalette } from "@/lib/hub-theme";
import { HubAssetViewer } from "./hub/HubAssetViewer";
import { isTrackingSuppressed, type HubAsset } from "./hub/hub-assets";
import {
  buildPdfReportHtml,
  buildReportSrcDoc,
  isAllowedReportSrc,
  looksLikePdfSrc,
  parseReportPageHash,
  REPORT_HEIGHT_KEY,
  REPORT_MAX_HEIGHT,
  type ReportTocEntry,
} from "@/lib/report-reader";
import { parseReportEventMessage, reportAssetKey, trackReportEvent } from "@/lib/report-tracking";

interface Props {
  props: ReportReaderBlockProps;
  brand: BrandConfig;
  blockId?: string;
}

interface DocState {
  status: "idle" | "loading" | "error";
  html: string;
  error?: string;
  pageWidth?: number;
  pageHeight?: number;
  toc?: ReportTocEntry[];
}

const SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation";

function msg<T>(data: unknown, key: string): T | null {
  if (!data || typeof data !== "object") return null;
  const v = (data as Record<string, unknown>)[key];
  return v === undefined ? null : (v as T);
}

/**
 * Report reader block: a paginated HTML report (see lib/report-reader) — or
 * any PDF, rendered with pdf.js — shown as a page-curling magazine or a
 * scrolling read, with contents, share-a-page links, full screen, a personal
 * cover letter, in-report video and assessments, and page-level reading
 * analytics (Analytics → Resources). The report renders in the same
 * origin-isolated sandbox as the custom-html block.
 */
export function BlockReportReader({ props, brand, blockId }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = (props.src || "").trim();
  const isPdf = props.source === "pdf" || (props.source !== "html" && looksLikePdfSrc(src));
  const [doc, setDoc] = useState<DocState>({ status: "idle", html: "" });
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const suppressed = isTrackingSuppressed();

  // ── Load the report (HTML text, or a PDF opened with pdf.js) ──────────────
  useEffect(() => {
    if (!src) {
      setDoc({ status: "idle", html: "" });
      return;
    }
    if (!isAllowedReportSrc(src)) {
      setDoc({ status: "error", html: "", error: "Report URL must start with https:// or /" });
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setDoc((d) => ({ ...d, status: "loading" }));
    (async () => {
      const res = await fetch(src, { signal: ctrl.signal, credentials: isPdf ? "same-origin" : "omit" });
      if (!res.ok) throw new Error(`Couldn't load the report (HTTP ${res.status})`);
      if (!isPdf) {
        const html = await res.text();
        if (!cancelled) setDoc({ status: "idle", html });
        return;
      }
      const data = await res.arrayBuffer();
      const { openPdf } = await import("@/lib/report-pdf");
      const opened = await openPdf(data);
      if (cancelled) {
        void opened.pdf.destroy();
        return;
      }
      pdfRef.current = opened.pdf;
      setDoc({ status: "idle", html: buildPdfReportHtml(opened.numPages), pageWidth: opened.pageWidth, pageHeight: opened.pageHeight, toc: opened.toc });
    })().catch((err: unknown) => {
      if (cancelled || ctrl.signal.aborted) return;
      setDoc({ status: "error", html: "", error: err instanceof Error ? err.message : "Couldn't load the report" });
    });
    return () => {
      cancelled = true;
      ctrl.abort();
      const pdf = pdfRef.current;
      pdfRef.current = null;
      if (pdf) void pdf.destroy();
    };
  }, [src, isPdf]);

  // ── Deep link: #report-p7 opens at page 7 ─────────────────────────────────
  const [startPage, setStartPage] = useState<number | null>(() => (typeof window === "undefined" ? null : parseReportPageHash(window.location.hash)));
  useEffect(() => {
    const onHash = () => {
      const p = parseReportPageHash(window.location.hash);
      if (p) setStartPage(p);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const letter = props.coverLetter;
  const srcDoc = useMemo(
    () =>
      buildReportSrcDoc(doc.html, {
        title: props.title ?? "",
        pdfUrl: props.pdfUrl || (isPdf ? src : ""),
        view: props.view ?? "auto",
        allowViewToggle: props.allowViewToggle ?? true,
        pageWidth: doc.pageWidth,
        pageHeight: doc.pageHeight,
        toc: doc.toc,
        pdfMode: isPdf,
        startPage: startPage ?? undefined,
        shareUrl: props.allowShare === false || suppressed || typeof window === "undefined" ? "" : window.location.href.split("#")[0],
        allowFullscreen: props.allowFullscreen !== false,
        showContents: props.showContents !== false,
        coverLetter: letter?.enabled
          ? {
              eyebrow: letter.eyebrow,
              greeting: letter.greeting,
              body: letter.body,
              signName: letter.signName,
              signTitle: letter.signTitle,
              signImage: letter.signImage,
              showUnresolved: suppressed,
            }
          : null,
      }),
    [doc, props.title, props.pdfUrl, props.view, props.allowViewToggle, props.allowShare, props.allowFullscreen, props.showContents, letter, isPdf, src, startPage, suppressed],
  );

  // ── Tracking context (latest values for the long-lived listeners) ─────────
  const ctx = usePageContext();
  const report = useMemo(
    () => ({ key: reportAssetKey({ trackingKey: props.trackingKey, title: props.title, src }), title: props.title || reportAssetKey({ title: props.title, src }) }),
    [props.trackingKey, props.title, src],
  );
  const [modal, setModal] = useState<{ mode: "chilipiper" | "form"; email: string; url?: string } | null>(null);
  const [video, setVideo] = useState<HubAsset | null>(null);
  const cta = useMemo(() => resolveCtaConfig({ tenantDefault: ctx.tenantDefaultCta, pageOverride: ctx.pageCta }), [ctx.tenantDefaultCta, ctx.pageCta]);
  const latest = useRef({ cta, brandCp: brand?.chilipiperUrl, track: { pageId: ctx.pageId, sessionId: ctx.sessionId, blockId }, report });
  latest.current = { cta, brandCp: brand?.chilipiperUrl, track: { pageId: ctx.pageId, sessionId: ctx.sessionId, blockId }, report };
  const palette = useMemo(() => resolveHubPalette({}, brand, "dark"), [brand]);

  // ── Frame ↔ page messaging ────────────────────────────────────────────────
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !srcDoc) return;
    let viewed = false;
    let raf = 0;
    let renderToken = 0;
    let scrolledByFrame = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    const sendViewport = () => {
      raf = 0;
      const win = iframe.contentWindow;
      if (!win) return;
      const r = iframe.getBoundingClientRect();
      const top = Math.max(0, -r.top);
      const bottom = Math.max(top, Math.min(r.height, window.innerHeight - r.top));
      win.postMessage({ __lpReportViewport: { top: Math.round(top), bottom: Math.round(bottom) } }, "*");
      if (!viewed && bottom - top > 120) {
        viewed = true;
        trackReportEvent(latest.current.track, latest.current.report, { action: "view" });
      }
    };
    const queueViewport = () => {
      if (!raf) raf = requestAnimationFrame(sendViewport);
    };

    const streamPdfPages = async () => {
      const pdf = pdfRef.current;
      if (!pdf) return;
      const token = ++renderToken;
      const width = Math.round(816 * Math.min(2, Math.max(1.25, window.devicePixelRatio || 1)));
      // Start where the reader opens (deep link), then the rest in order.
      const first = Math.max(0, Math.min(pdf.numPages - 1, (startPage ?? 1) - 1));
      const order = [...Array(pdf.numPages).keys()].sort((a, b) => (a >= first ? 0 : 1) - (b >= first ? 0 : 1) || a - b);
      const { renderPdfPage } = await import("@/lib/report-pdf");
      for (const i of order) {
        if (token !== renderToken || pdfRef.current !== pdf) return;
        try {
          const { blob, links } = await renderPdfPage(pdf, i, width);
          if (token !== renderToken) return;
          iframe.contentWindow?.postMessage({ __lpReportPdfPage: { i, blob, links } }, "*");
        } catch (err) {
          console.warn("[report-reader] page render failed", i + 1, err);
        }
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const ctaReq = parseLpCtaMessage(e.data);
      if (ctaReq) {
        const action = resolveLpCtaAction(ctaReq, latest.current.cta, latest.current.brandCp);
        if (action.kind === "chilipiper") setModal({ mode: "chilipiper", email: action.email, url: action.url });
        else if (action.kind === "form") setModal({ mode: "form", email: action.email });
        else if (action.kind === "navigate") window.location.assign(action.url);
        else console.warn("[report-reader] __lpOpenCta ignored:", action.reason);
        return;
      }
      const h = msg<number>(e.data, REPORT_HEIGHT_KEY);
      if (typeof h === "number" && h > 0) {
        iframe.style.height = Math.min(h, REPORT_MAX_HEIGHT) + "px";
        queueViewport();
        return;
      }
      const ev = parseReportEventMessage(e.data);
      if (ev) {
        trackReportEvent(latest.current.track, latest.current.report, ev);
        return;
      }
      const vid = msg<{ url?: unknown; title?: unknown }>(e.data, "__lpReportVideo");
      if (vid && typeof vid.url === "string" && /^https:\/\//i.test(vid.url.trim())) {
        setVideo({ kind: "video", title: typeof vid.title === "string" && vid.title.trim() ? vid.title.trim().slice(0, 160) : "Video", videoUrl: vid.url.trim(), downloadable: false });
        return;
      }
      const sc = msg<{ y?: unknown }>(e.data, "__lpReportScroll");
      if (sc && typeof sc.y === "number" && Number.isFinite(sc.y)) {
        scrolledByFrame = true;
        const top = iframe.getBoundingClientRect().top + window.scrollY + Math.max(0, Math.min(sc.y, REPORT_MAX_HEIGHT)) - 12;
        window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
        return;
      }
      if (msg(e.data, "__lpReportReady") != null) void streamPdfPages();
    };

    const onLoad = () => {
      queueViewport();
      // A deep link in magazine view flips the book but can't scroll the page.
      if (startPage) setTimeout(() => !scrolledByFrame && iframe.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }), 350);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("scroll", queueViewport, { passive: true });
    window.addEventListener("resize", queueViewport);
    iframe.addEventListener("load", onLoad);
    return () => {
      renderToken++;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("scroll", queueViewport);
      window.removeEventListener("resize", queueViewport);
      iframe.removeEventListener("load", onLoad);
    };
  }, [srcDoc, startPage]);

  if (!src) {
    return (
      <div className="py-12 px-8 text-center text-muted-foreground text-sm italic">
        Report reader — add a report URL (HTML report or PDF) in the properties panel
      </div>
    );
  }
  if (doc.status === "error") {
    return <div className="py-12 px-8 text-center text-sm text-destructive">{doc.error}</div>;
  }
  if (!srcDoc) {
    return <div className="py-16 px-8 text-center text-muted-foreground text-sm">Loading report…</div>;
  }

  return (
    <div className="report-reader-block w-full overflow-hidden">
      <iframe
        ref={iframeRef}
        title={props.title || "Report"}
        // SECURITY: same contract as BlockCustomHtml — never add allow-same-origin.
        sandbox={SANDBOX}
        allow="fullscreen; clipboard-write"
        allowFullScreen
        srcDoc={srcDoc}
        className="w-full border-0"
        style={{ minHeight: "480px", display: "block" }}
        scrolling="no"
      />
      <HubAssetViewer asset={video} onClose={() => setVideo(null)} palette={palette} />
      {modal && (
        <EmailCaptureModal
          open
          onClose={() => setModal(null)}
          email={modal.email}
          mode={modal.mode}
          chilipiperUrl={modal.url}
          formSource={cta.modalFormSource ?? "simple"}
          linkedFormId={cta.modalFormId}
          marketoBaseUrl={cta.modalMarketoBaseUrl}
          marketoMunchkinId={cta.modalMarketoMunchkinId}
          marketoFormId={cta.modalMarketoFormId}
          chiliPiperConfig={
            cta.modalChiliPiperHandoffUrl
              ? { url: cta.modalChiliPiperHandoffUrl, mode: cta.modalChiliPiperHandoffMode ?? "modal", fieldMap: cta.modalChiliPiperHandoffFieldMap }
              : null
          }
          formConfig={{
            headline: cta.modalHeadline,
            subheadline: cta.modalSubheadline,
            submitText: cta.modalSubmitText,
            successMessage: cta.modalSuccessMessage,
            disclaimer: cta.modalDisclaimer,
            showFirstName: cta.modalShowFirstName,
            showLastName: cta.modalShowLastName,
            showPhone: cta.modalShowPhone,
            showCompany: cta.modalShowCompany,
          }}
          brand={brand}
          pageId={ctx.pageId ?? undefined}
          variantId={ctx.variantId ?? undefined}
          source="report-reader"
          theme={brand?.modalTheme ?? undefined}
        />
      )}
    </div>
  );
}
