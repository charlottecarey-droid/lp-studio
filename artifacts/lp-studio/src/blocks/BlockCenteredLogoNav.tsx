import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { CenteredLogoNavBlockProps } from "@/lib/block-types";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: CenteredLogoNavBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: CenteredLogoNavBlockProps) => void;
}

export function BlockCenteredLogoNav({ props, brand }: Props) {
  const bg = props.bgColor ?? "#ffffff";
  const text = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const border = `${text}14`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const logoText = props.logoText || brand.name || "Brand";

  const renderLinks = (links: { label: string; url: string }[], align: "start" | "end") => (
    <nav
      className={`hidden items-center gap-7 md:flex ${align === "end" ? "justify-end" : "justify-start"}`}
      style={{ fontFamily: BODY }}
    >
      {links.map((l, i) => (
        <a
          key={i}
          href={l.url || "#"}
          className="text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
          style={{ color: text }}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );

  return (
    <header className="w-full border-b" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="container mx-auto grid grid-cols-2 items-center gap-4 px-6 py-5 md:grid-cols-3">
        <div className="hidden md:block">{renderLinks(props.leftLinks ?? [], "start")}</div>
        <div className="flex items-center justify-start md:justify-center">
          {props.logoUrl ? (
            <img src={props.logoUrl} alt={logoText} className="h-8 w-auto object-contain" />
          ) : (
            <span className="text-xl font-extrabold tracking-tight" style={{ color: text, fontFamily: DISPLAY }}>
              {logoText}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-5">
          <div className="hidden md:block">{renderLinks(props.rightLinks ?? [], "end")}</div>
          {props.ctaLabel && (
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="centered-logo-nav-cta"
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel}
            </CtaButton>
          )}
        </div>
      </div>
    </header>
  );
}
