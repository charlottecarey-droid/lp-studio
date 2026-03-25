import { useState, useEffect, useCallback } from "react";
import { X, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopupBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: PopupBlockProps;
  brand: BrandConfig;
  blockId: string;
  isEditing?: boolean;
  onCtaClick?: () => void;
}

function PopupOverlay({
  p, brand, blockId, onDismiss,
}: {
  p: PopupBlockProps;
  brand: BrandConfig;
  blockId: string;
  onDismiss: () => void;
}) {
  const isDark = p.backgroundStyle === "dark";
  const positionClass =
    p.position === "bottom-left"
      ? "items-end justify-start p-6"
      : p.position === "bottom-right"
      ? "items-end justify-end p-6"
      : "items-center justify-center";

  return (
    <div
      className={cn("fixed inset-0 z-[9999] flex", positionClass)}
      style={{ animation: "lp-fadeIn 0.2s ease-out" }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100})` }}
        onClick={onDismiss}
      />
      <div
        className={cn(
          "relative rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden",
          isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}
        style={{ animation: "lp-scaleIn 0.25s ease-out" }}
      >
        <button
          onClick={onDismiss}
          className={cn(
            "absolute top-3 right-3 p-1 rounded-full transition-colors z-10",
            isDark ? "hover:bg-white/10 text-white/70" : "hover:bg-slate-100 text-slate-400"
          )}
        >
          <X className="w-5 h-5" />
        </button>

        {p.imageUrl && (
          <div className="w-full h-40 overflow-hidden">
            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6">
          {p.headline && <h3 className="text-xl font-bold mb-2">{p.headline}</h3>}
          {p.body && (
            <p className={cn("text-sm mb-4", isDark ? "text-white/70" : "text-slate-600")}>
              {p.body}
            </p>
          )}
          {p.ctaText && (
            <button
              className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
                color: brand.ctaText || "#003A30",
              }}
              onClick={onDismiss}
            >
              {p.ctaText}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes lp-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lp-scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  );
}

export function BlockPopup({ props: p, brand, blockId, isEditing, onCtaClick }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const storageKey = `lp-popup-${blockId}-dismissed`;

  const dismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    if (p.showOnce) {
      try { sessionStorage.setItem(storageKey, "1"); } catch { /* ok */ }
    }
  }, [p.showOnce, storageKey]);

  // Live trigger logic (only runs outside editor)
  useEffect(() => {
    if (isEditing) return;
    if (dismissed) return;
    if (p.showOnce) {
      try { if (sessionStorage.getItem(storageKey)) return; } catch { /* ok */ }
    }
    if (p.trigger === "click") return; // handled by the button on-page

    if (p.trigger === "exit-intent") {
      const handler = (e: MouseEvent) => { if (e.clientY <= 0) setVisible(true); };
      document.addEventListener("mouseout", handler);
      return () => document.removeEventListener("mouseout", handler);
    }

    if (p.trigger === "scroll-percent") {
      const handler = () => {
        const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (pct >= (p.triggerValue || 50)) setVisible(true);
      };
      window.addEventListener("scroll", handler, { passive: true });
      return () => window.removeEventListener("scroll", handler);
    }

    if (p.trigger === "time-delay") {
      const timer = setTimeout(() => setVisible(true), (p.triggerValue || 5) * 1000);
      return () => clearTimeout(timer);
    }
  }, [p.trigger, p.triggerValue, p.showOnce, dismissed, storageKey, isEditing]);

  // ── EDITOR MODE: show a visible placeholder card ──────────────────────────
  if (isEditing) {
    const triggerLabel =
      p.trigger === "exit-intent" ? "Exit intent"
      : p.trigger === "scroll-percent" ? `Scroll ${p.triggerValue ?? 50}%`
      : p.trigger === "time-delay" ? `After ${p.triggerValue ?? 5}s`
      : "On button click";

    return (
      <>
        <div className="relative mx-auto my-2 max-w-md rounded-xl border-2 border-dashed border-[#C7E738]/60 bg-[#C7E738]/5 p-4 flex items-center gap-4">
          {p.imageUrl && (
            <img src={p.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#003A30]/50">Popup</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C7E738]/30 text-[#003A30] font-medium">{triggerLabel}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{p.headline || "(no headline)"}</p>
            {p.body && <p className="text-xs text-slate-500 truncate mt-0.5">{p.body}</p>}
          </div>
          <button
            onClick={() => setPreviewOpen(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#003A30] text-white hover:bg-[#003A30]/80 transition-colors"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        {previewOpen && (
          <PopupOverlay
            p={p}
            brand={brand}
            blockId={blockId}
            onDismiss={() => setPreviewOpen(false)}
          />
        )}
      </>
    );
  }

  // ── LIVE MODE: click trigger shows a floating button ──────────────────────
  if (p.trigger === "click") {
    return (
      <>
        <div className="flex justify-center py-4">
          <button
            onClick={() => setVisible(true)}
            className="py-3 px-8 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
              color: brand.ctaText || "#003A30",
            }}
          >
            {p.ctaText || "Open"}
          </button>
        </div>
        {visible && !dismissed && (
          <PopupOverlay p={p} brand={brand} blockId={blockId} onDismiss={() => { onCtaClick?.(); dismiss(); }} />
        )}
      </>
    );
  }

  // ── LIVE MODE: triggered popup ─────────────────────────────────────────────
  if (!visible || dismissed) return null;

  return (
    <PopupOverlay
      p={p}
      brand={brand}
      blockId={blockId}
      onDismiss={() => { onCtaClick?.(); dismiss(); }}
    />
  );
}
