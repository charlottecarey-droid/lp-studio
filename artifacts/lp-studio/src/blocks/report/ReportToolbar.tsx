import { forwardRef, useEffect, useRef, useState } from "react";
import { Link2, List, Lock, Maximize2, Minimize2 } from "lucide-react";

/** What the report frame tells the page about where the reader is. */
export interface ReportFrameState {
  mode: "mag" | "scroll";
  locked: boolean;
  total: number;
  /** Current page number (cover letter not counted). */
  page: number;
  /** Analytics id of the current page: "07|Page title". */
  pid: string;
  /** Index of the current contents entry, -1 before the first. */
  on: number;
  toc: { t: string; n: number; lk: boolean }[];
}

interface Props {
  title: string;
  state: ReportFrameState | null;
  showContents: boolean;
  allowShare: boolean;
  allowFullscreen: boolean;
  allowViewToggle: boolean;
  pdfHref: string;
  fullscreen: boolean;
  toast: { msg: string; url?: string } | null;
  onContents: (entry: { t: string; n: number; lk: boolean }) => void;
  onShare: () => void;
  onFullscreen: () => void;
  onView: (mode: "mag" | "scroll") => void;
  onDownload: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

const btn =
  "inline-flex items-center gap-1.5 rounded-full border border-[#FAF8F3]/30 px-3 py-2 text-[13px] font-medium leading-none text-[#FAF8F3] transition-colors hover:border-[#FAF8F3] hover:bg-[#FAF8F3]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C7E738]";

/**
 * The report reader's toolbar, rendered by the page (not inside the frame) so
 * it can stick to the top of the screen while the report scrolls, and so
 * clipboard / full screen run as real user actions on the page.
 */
export const ReportToolbar = forwardRef<HTMLDivElement, Props>(function ReportToolbar(p, ref) {
  const [tocOpen, setTocOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fsSupported = typeof document !== "undefined" && !!(document.fullscreenEnabled || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);
  const toc = p.state?.toc ?? [];

  useEffect(() => {
    if (!tocOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !panelRef.current?.contains(e.target as Node)) setTocOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [tocOpen]);

  return (
    <div
      ref={ref}
      className="report-reader-toolbar sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#040C09] px-4 py-3 font-sans text-[#FAF8F3] md:px-10"
    >
      <span className="mr-auto min-w-0 basis-full truncate text-[11.5px] font-semibold uppercase tracking-[.12em] text-[#FAF8F3]/70 sm:basis-auto">{p.title}</span>

      {p.showContents && toc.length > 0 && (
        <div className="relative" ref={panelRef}>
          <button type="button" className={btn} aria-expanded={tocOpen} aria-haspopup="true" onClick={() => setTocOpen((o) => !o)} title="Contents">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Contents</span>
          </button>
          {tocOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-[min(70vh,560px)] w-[min(380px,calc(100vw-28px))] overflow-auto rounded-md bg-[#FAF8F3] p-2.5 text-[#040C09] shadow-2xl sm:left-auto sm:right-0">
              <p className="mx-2.5 mb-2 mt-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#040C09]/55">Contents</p>
              {toc.map((t, k) => (
                <button
                  key={`${t.n}-${k}`}
                  type="button"
                  onClick={() => {
                    setTocOpen(false);
                    p.onContents(t);
                  }}
                  className={`flex w-full items-center gap-3 rounded px-2.5 py-2 text-left text-sm font-medium hover:bg-[#003A30]/10 ${k === p.state?.on ? "bg-[#003A30]/10" : ""}`}
                >
                  <em className="min-w-6 not-italic tabular-nums text-[#040C09]/45">{t.n || ""}</em>
                  <span className={t.lk ? "opacity-60" : ""}>{t.t}</span>
                  {t.lk && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-[#040C09]/45" aria-label="Locked" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {p.allowShare && (
        <button type="button" className={btn} onClick={p.onShare} title="Copy a link to this page">
          <Link2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share page</span>
        </button>
      )}

      {p.allowFullscreen && fsSupported && (
        <button type="button" className={btn} onClick={p.onFullscreen} title={p.fullscreen ? "Exit full screen" : "Full screen"}>
          {p.fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{p.fullscreen ? "Exit" : "Full screen"}</span>
        </button>
      )}

      {p.allowViewToggle && p.state && (
        <div className="inline-flex rounded-full border border-[#FAF8F3]/30 p-[3px]" role="group" aria-label="View">
          {(["mag", "scroll"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={p.state?.mode === m}
              onClick={() => p.onView(m)}
              className={`rounded-full px-3 py-1.5 text-[13px] leading-none transition-colors ${p.state?.mode === m ? "bg-[#FAF8F3] text-[#040C09]" : "text-[#FAF8F3]/80 hover:text-[#FAF8F3]"}`}
            >
              {m === "mag" ? "Magazine" : "Scroll"}
            </button>
          ))}
        </div>
      )}

      {p.pdfHref && (
        <a
          href={p.pdfHref}
          target="_blank"
          rel="noopener"
          onClick={p.onDownload}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[#C7E738] px-3.5 py-2.5 text-[13px] font-semibold leading-none text-[#040C09] no-underline hover:brightness-105"
        >
          {p.state?.locked && <Lock className="h-3.5 w-3.5" />}
          Download PDF
        </a>
      )}

      {p.toast && (
        <div role="status" className="absolute right-4 top-[calc(100%+8px)] z-40 max-w-[min(460px,calc(100vw-28px))] rounded bg-[#C7E738] px-3.5 py-2.5 text-[13px] font-semibold text-[#040C09] shadow-xl md:right-10">
          {p.toast.msg}
          {p.toast.url && <input readOnly value={p.toast.url} onFocus={(e) => e.currentTarget.select()} autoFocus className="mt-1.5 block w-full border-0 bg-white p-1.5 font-mono text-xs text-[#040C09]" />}
        </div>
      )}
    </div>
  );
});
