import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import { BrandLogo, brandHasLogo, brandLogoToneForText } from "@/components/BrandLogo";
import { IconOrImage } from "@/lib/icon-value";
import type { MegaMenuNavBlockProps } from "@/lib/block-types";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: MegaMenuNavBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MegaMenuNavBlockProps) => void;
}

export function BlockMegaMenuNav({ props, brand }: Props) {
  const [open, setOpen] = useState(false);
  const bg = props.bgColor ?? "#ffffff";
  const text = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const muted = pickContrastingColor(undefined, bg, ["#64748b", "#94a3b8"]);
  const border = `${text}14`;
  // Featured card can carry its own background — derive its ink from that
  // surface so the title/text stay legible on any color the author picks.
  const cardBg = props.featuredBgColor;
  const cardText = cardBg ? pickContrastingColor(undefined, cardBg, ["#0f172a", "#ffffff"]) : text;
  const cardMuted = cardBg ? pickContrastingColor(undefined, cardBg, ["#475569", "#cbd5e1"]) : muted;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const logoText = props.logoText || brand.brandName || "Brand";

  return (
    <header
      className="relative w-full border-b"
      style={{ backgroundColor: bg, borderColor: border, fontFamily: BODY }}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-8">
          {brandHasLogo(brand, props.logoUrl) ? (
            <BrandLogo brand={brand} url={props.logoUrl} tone={brandLogoToneForText(text)} alt={logoText} className="h-8 w-auto" />
          ) : (
            <span className="text-xl font-extrabold tracking-tight" style={{ color: text, fontFamily: DISPLAY }}>
              {logoText}
            </span>
          )}
          <nav className="hidden items-center gap-7 md:flex">
            {(props.links ?? []).map((l, i) => (
              <a
                key={i}
                href={l.url || "#"}
                className="text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
                style={{ color: text }}
              >
                {l.label}
              </a>
            ))}
            {(props.menuGroups ?? []).length > 0 && (
              <button
                type="button"
                onMouseEnter={() => setOpen(true)}
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
                style={{ color: text }}
              >
                {props.menuLabel || "Products"}
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </nav>
        </div>
        {props.ctaLabel && (
          <CtaButton
            {...pickCtaModalConfig(props)}
            ctaAction={props.ctaAction ?? "url"}
            ctaUrl={props.ctaUrl}
            chilipiperUrl={props.chilipiperUrl}
            videoUrl={props.videoUrl}
            videoPosterUrl={props.videoPosterUrl}
            brand={brand}
            source="mega-menu-nav-cta"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            {props.ctaLabel}
          </CtaButton>
        )}
      </div>

      {open && (props.menuGroups ?? []).length > 0 && (
        <div className="absolute inset-x-0 top-full z-40 border-t shadow-xl" style={{ backgroundColor: bg, borderColor: border }}>
          <div className="container mx-auto grid grid-cols-1 gap-8 px-6 py-8 md:grid-cols-4">
            {(props.menuGroups ?? []).map((g, gi) => (
              <div key={gi}>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
                  {g.title}
                </p>
                <ul className="space-y-2">
                  {(g.links ?? []).map((l, li) => (
                    <li key={li}>
                      <a href={l.url || "#"} className="text-sm opacity-80 transition-opacity hover:opacity-100" style={{ color: text }}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(props.featuredImageUrl || props.featuredIcon || props.featuredTitle) && (
              <div className="rounded-2xl border p-4" style={{ borderColor: border, backgroundColor: cardBg || undefined }}>
                {props.featuredImageUrl && (
                  <img src={props.featuredImageUrl} alt={props.featuredImageAlt || ""} className="mb-3 h-28 w-full rounded-xl object-cover" />
                )}
                {props.featuredIcon && (
                  <div
                    className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${accent}26` }}
                  >
                    <IconOrImage value={props.featuredIcon} className="h-5 w-5" style={{ color: accent }} alt={props.featuredTitle || ""} />
                  </div>
                )}
                {props.featuredTitle && (
                  <p className="text-sm font-semibold" style={{ color: cardText, fontFamily: DISPLAY }}>
                    {props.featuredTitle}
                  </p>
                )}
                {props.featuredText && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: cardMuted }}>
                    {props.featuredText}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
