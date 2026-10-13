import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { BrandLogo } from "@/components/BrandLogo";
import { InlineText } from "@/components/InlineText";
import { ABM_BODY, anchorClick, type AbmPalette } from "@/lib/abm-theme";
import { AbmCtaButtons, type AbmCtaProps } from "./AbmCta";
import { cn } from "@/lib/utils";

export interface AbmNavLink {
  label: string;
  href: string;
}

interface Props {
  brand: BrandConfig;
  /** "light" = white bar with dark text (the reference page); "dark" = near-black bar with light text. */
  theme: "light" | "dark";
  links: AbmNavLink[];
  /** Optional partner / account name or logo shown after the brand mark ("Brand × Account"). */
  companyName?: string;
  companyLogoUrl?: string;
  companyLogoAlt?: string;
  hideBrandLogo?: boolean;
  /** A plain text link right of the nav links ("Log in", "Pricing"). */
  utilityText?: string;
  utilityUrl?: string;
  /** The nav's CTA button — the hero's primary CTA suite. */
  cta: AbmCtaProps;
  hideCta?: boolean;
  palette: AbmPalette;
  pageId?: number;
  variantId?: number;
  onCtaClick?: () => void;
  onUtilityChange?: (v: string) => void;
  onCtaLabelChange?: (key: "ctaText" | "ctaSecondaryText", value: string) => void;
  /** Builder canvas: keep the bar in flow (never fixed) so it cannot escape the hero. */
  sticky?: boolean;
}

/**
 * The account page's own site-style top bar: brand logo (× account), nav links,
 * a utility link and the CTA button. Rendered BY the hero (it is a self-nav
 * block) so a page never stacks two navbars. Solid surface in both themes —
 * unlike the glass StickyHeroNav it never goes transparent over the hero.
 */
export function AbmNavBar({ brand, theme, links, companyName, companyLogoUrl, companyLogoAlt, hideBrandLogo, utilityText, utilityUrl, cta, hideCta, palette, pageId, variantId, onCtaClick, onUtilityChange, onCtaLabelChange, sticky = true }: Props) {
  const [open, setOpen] = useState(false);
  const dark = theme === "dark";
  const bg = dark ? "#0B0B0F" : "#FFFFFF";
  const ink = dark ? "#F6F7F9" : "#0B0B0F";
  const linkInk = dark ? "rgba(246,247,249,0.82)" : "rgba(11,11,15,0.78)";
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgba(11,11,15,0.1)";
  const isEditor = !!onUtilityChange;
  // The CTA's own colour overrides still apply; the fill otherwise follows the
  // section palette (brand CTA colours are resolved against the hero surface).
  const navPalette: AbmPalette = { ...palette, base: bg, dark, text: ink, outline: { border: ink, text: ink } };
  // Only draw the "×" between the marks when there is actually a brand mark to
  // the left of it (a brand with no logo AND no name renders nothing there).
  const hasBrandMark = !hideBrandLogo && !!(brand.logoUrl || brand.logoUrlDark || brand.brandName);

  return (
    <div className={cn("abm-nav z-40 w-full", sticky && "sticky top-0")} style={{ background: bg, color: ink, borderBottom: `1px solid ${hairline}`, fontFamily: ABM_BODY }}>
      <div className="mx-auto flex w-full max-w-page items-center justify-between gap-6 px-6 py-3.5 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          {hasBrandMark && (
            <a href="#" aria-label={brand.brandName || "Home"} className="flex items-center">
              <BrandLogo brand={brand} tone={dark ? "onDark" : "onLight"} alt={brand.brandName || "Logo"} style={{ height: 26, display: "block" }} />
            </a>
          )}
          {(companyLogoUrl || companyName) && (
            <>
              {hasBrandMark && <span aria-hidden className="text-xs" style={{ color: linkInk }}>×</span>}
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt={companyLogoAlt || companyName || "Account"} style={{ height: 24, width: "auto", maxWidth: 150, objectFit: "contain", filter: dark ? "brightness(0) invert(1)" : "none" }} />
              ) : (
                <span className="truncate text-[15px] font-medium" style={{ color: ink }}>{companyName}</span>
              )}
            </>
          )}
        </div>

        {links.length > 0 && (
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Page">
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"} onClick={anchorClick(l.href)} className="whitespace-nowrap text-[14px] font-medium no-underline" style={{ color: linkInk }}>
                {l.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-5">
          {(utilityText || isEditor) && (
            <a href={utilityUrl || "#"} onClick={anchorClick(utilityUrl)} className="hidden text-[14px] font-medium no-underline sm:inline" style={{ color: ink }}>
              <InlineText as="span" value={utilityText ?? ""} onUpdate={onUtilityChange} />
            </a>
          )}
          {!hideCta && (
            <div className="hidden sm:block">
              <AbmCtaButtons props={cta} brand={brand} palette={navPalette} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} onLabelChange={onCtaLabelChange} source="abm-nav" primaryOnly size="sm" />
            </div>
          )}
          {(links.length > 0 || !hideCta) && (
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ color: ink }}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="lg:hidden" style={{ borderTop: `1px solid ${hairline}` }}>
          <div className="mx-auto flex w-full max-w-page flex-col gap-1 px-6 py-4">
            {links.map((l, i) => (
              <a key={i} href={l.href || "#"} onClick={(e) => { anchorClick(l.href)(e); setOpen(false); }} className="rounded-md px-2 py-2.5 text-[15px] font-medium no-underline" style={{ color: ink }}>
                {l.label}
              </a>
            ))}
            {utilityText && (
              <a href={utilityUrl || "#"} className="rounded-md px-2 py-2.5 text-[15px] font-medium no-underline" style={{ color: ink }}>{utilityText}</a>
            )}
            {!hideCta && (
              <div className="px-2 pt-2 sm:hidden">
                <AbmCtaButtons props={cta} brand={brand} palette={navPalette} pageId={pageId} variantId={variantId} onCtaClick={onCtaClick} source="abm-nav-mobile" primaryOnly size="sm" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
