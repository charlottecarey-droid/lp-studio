import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";
import type { StickyBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { ChiliPiperModal } from "./ChiliPiperModal";

interface Props {
  props: StickyBarBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
  pageId?: number;
  variantId?: number;
  sessionId?: string;
}

export function BlockStickyBar({ props: p, brand, onCtaClick, pageId, variantId, sessionId }: Props) {
  const [cpOpen, setCpOpen] = useState(false);
  const isChiliPiper = p.ctaAction === "chilipiper" && !!p.chilipiperUrl;
  const [visible, setVisible] = useState(p.showAfterScroll <= 0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (p.showAfterScroll <= 0) return;
    const handler = () => {
      const scrollPct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      setVisible(scrollPct >= p.showAfterScroll);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [p.showAfterScroll]);

  if (dismissed || !visible) return null;

  const isBrand = p.backgroundStyle === "brand";
  const isDark = !isBrand && isDarkBg(p.backgroundStyle);

  const barBgStyle = isBrand
    ? { backgroundColor: brand.primaryColor || "#003A30" }
    : isDark || p.backgroundStyle === "gradient"
      ? getBgStyle(p.backgroundStyle)
      : { backgroundColor: p.backgroundStyle === "muted" ? "hsl(42,18%,96%)" : p.backgroundStyle === "light-gray" ? "#f8fafc" : "#ffffff" };
  const textColor = (isDark || isBrand) ? "#ffffff" : "#1e293b";

  return (
    <>
    <div
      className={cn(
        "fixed left-0 right-0 z-[9998] flex items-center justify-center gap-4 px-4 py-3 shadow-lg transition-transform duration-300",
        p.position === "top" ? "top-0" : "bottom-0"
      )}
      style={{ ...barBgStyle, color: textColor }}
    >
      <p className="text-sm font-medium flex-1 text-center">{p.text}</p>
      {p.ctaText && (
        <button
          onClick={() => {
            onCtaClick?.();
            if (isChiliPiper) {
              setCpOpen(true);
            } else if (p.ctaUrl) {
              window.open(p.ctaUrl, "_blank", "noopener,noreferrer");
            }
          }}
          className="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: p.ctaColor || brand.ctaBackground || "#C7E738",
            color: brand.ctaText || "#003A30",
          }}
        >
          {p.ctaText}
        </button>
      )}
      {p.dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-black/10 transition-colors"
          style={{ color: textColor }}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
    {cpOpen && p.chilipiperUrl && (
      <ChiliPiperModal
        url={p.chilipiperUrl}
        pageId={pageId}
        variantId={variantId}
        sessionId={sessionId}
        onClose={() => setCpOpen(false)}
      />
    )}
    </>
  );
}
