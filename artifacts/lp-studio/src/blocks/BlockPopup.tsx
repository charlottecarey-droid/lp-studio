import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopupBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: PopupBlockProps;
  brand: BrandConfig;
  blockId: string;
  onCtaClick?: () => void;
}

export function BlockPopup({ props: p, brand, blockId, onCtaClick }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `lp-popup-${blockId}-dismissed`;

  const dismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    if (p.showOnce) {
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch (e) {
        void e;
      }
    }
  }, [p.showOnce, storageKey]);

  useEffect(() => {
    if (dismissed) return;
    if (p.showOnce) {
      try {
        if (sessionStorage.getItem(storageKey)) return;
      } catch (e) {
        void e;
      }
    }

    if (p.trigger === "exit-intent") {
      const handler = (e: MouseEvent) => {
        if (e.clientY <= 0) setVisible(true);
      };
      document.addEventListener("mouseout", handler);
      return () => document.removeEventListener("mouseout", handler);
    }

    if (p.trigger === "scroll-percent") {
      const handler = () => {
        const scrollPct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (scrollPct >= (p.triggerValue || 50)) setVisible(true);
      };
      window.addEventListener("scroll", handler, { passive: true });
      return () => window.removeEventListener("scroll", handler);
    }

    if (p.trigger === "time-delay") {
      const timer = setTimeout(() => setVisible(true), (p.triggerValue || 5) * 1000);
      return () => clearTimeout(timer);
    }

    return;
  }, [p.trigger, p.triggerValue, p.showOnce, dismissed, storageKey]);

  if (!visible || dismissed) return null;

  const isDark = p.backgroundStyle === "dark";
  const positionClass = p.position === "bottom-left"
    ? "items-end justify-start p-6"
    : p.position === "bottom-right"
    ? "items-end justify-end p-6"
    : "items-center justify-center";

  return (
    <div
      className={cn("fixed inset-0 z-[9999] flex", positionClass)}
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${(p.overlayOpacity ?? 50) / 100})` }}
        onClick={dismiss}
      />
      <div
        className={cn(
          "relative rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden",
          isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}
        style={{ animation: "scaleIn 0.25s ease-out" }}
      >
        <button
          onClick={dismiss}
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
          {p.headline && (
            <h3 className="text-xl font-bold mb-2">{p.headline}</h3>
          )}
          {p.body && (
            <p className={cn("text-sm mb-4", isDark ? "text-white/70" : "text-slate-600")}>
              {p.body}
            </p>
          )}
          {p.ctaText && (
            <button
              onClick={() => {
                onCtaClick?.();
                if (p.ctaUrl) window.open(p.ctaUrl, "_blank", "noopener,noreferrer");
                dismiss();
              }}
              className="w-full py-3 px-6 rounded-lg font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
                color: brand.ctaText || "#003A30",
              }}
            >
              {p.ctaText}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  );
}
