import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StickyBarBlockProps } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

interface Props {
  props: StickyBarBlockProps;
  brand: BrandConfig;
  onCtaClick?: () => void;
}

export function BlockStickyBar({ props: p, brand, onCtaClick }: Props) {
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

  const isDark = p.backgroundStyle === "dark";
  const isBrand = p.backgroundStyle === "brand";

  const bgColor = isBrand
    ? (brand.primaryColor || "#003A30")
    : isDark ? "#1e293b" : "#ffffff";
  const textColor = (isDark || isBrand) ? "#ffffff" : "#1e293b";

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-[9998] flex items-center justify-center gap-4 px-4 py-3 shadow-lg transition-transform duration-300",
        p.position === "top" ? "top-0" : "bottom-0"
      )}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <p className="text-sm font-medium flex-1 text-center">{p.text}</p>
      {p.ctaText && (
        <button
          onClick={() => {
            onCtaClick?.();
            if (p.ctaUrl) window.open(p.ctaUrl, "_blank", "noopener,noreferrer");
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
  );
}
