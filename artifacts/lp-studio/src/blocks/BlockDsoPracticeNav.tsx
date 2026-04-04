import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand-config";
import type { DsoPracticeNavBlockProps } from "@/lib/block-types";
import { ChiliPiperButton } from "@/components/ChiliPiperButton";
import dandyLogoUrl from "@/assets/dandy-logo.svg?url";

const BG = "#003A30";
const BG_ALT = "#002B24";
const LIME = "#C7E738";
const BORDER = "rgba(199,231,56,0.15)";

interface Props {
  props: DsoPracticeNavBlockProps;
  brand: BrandConfig;
}

export function BlockDsoPracticeNav({ props, brand }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const ctaUrl = props.ctaUrl || brand.chilipiperUrl || "#";
  const ctaMode = props.ctaMode || (brand.chilipiperUrl ? "chilipiper" : "link");
  const ctaText = props.ctaText || "Book a Demo";
  const links = props.links?.length
    ? props.links
    : [
        { label: "How it works", anchor: "#steps" },
        { label: "Products", anchor: "#products" },
        { label: "Partnership perks", anchor: "#perks" },
        { label: "Meet your rep", anchor: "#team" },
      ];

  const ctaBtnStyle: React.CSSProperties = {
    backgroundColor: LIME,
    color: BG,
  };

  const CtaButton = ({ className, onClick }: { className?: string; onClick?: () => void }) => {
    const cls = cn(
      "inline-flex items-center justify-center shrink-0",
      "px-4 py-2 rounded-full text-sm font-bold tracking-wide",
      "transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-95",
      className
    );
    if (ctaMode === "chilipiper") {
      return (
        <ChiliPiperButton url={ctaUrl} className={cls} style={ctaBtnStyle}>
          {ctaText}
        </ChiliPiperButton>
      );
    }
    return (
      <a href={ctaUrl} className={cls} style={ctaBtnStyle} onClick={onClick}>
        {ctaText}
      </a>
    );
  };

  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{ backgroundColor: BG, borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center gap-6">

        {/* Logo + co-brand */}
        <div className="flex items-center gap-2 shrink-0">
          {props.dsoName && (
            <>
              <span className="text-white/80 text-sm font-semibold tracking-wide whitespace-nowrap">
                {props.dsoName}
              </span>
              <span className="text-white/30 text-sm font-light">×</span>
            </>
          )}
          <img src={dandyLogoUrl} alt="Dandy" className="h-6 w-auto brightness-0 invert" />
        </div>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 ml-3">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.anchor}
              className="px-3 py-1.5 text-sm font-medium text-white/65 hover:text-white rounded-lg transition-colors whitespace-nowrap"
              style={{ "--tw-bg-opacity": "0.08" } as React.CSSProperties}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block ml-auto">
          <CtaButton />
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-2 rounded-lg transition-colors"
          style={{ color: "rgba(255,255,255,0.7)" }}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-1"
          style={{ backgroundColor: BG_ALT, borderColor: BORDER }}
        >
          {links.map((link, i) => (
            <a
              key={i}
              href={link.anchor}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-white/75 hover:text-white rounded-lg transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2">
            <CtaButton className="w-full" onClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
