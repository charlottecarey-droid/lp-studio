import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { MinimalNavBlockProps } from "@/lib/block-types";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: MinimalNavBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: MinimalNavBlockProps) => void;
}

export function BlockMinimalNav({ props, brand }: Props) {
  const bg = props.bgColor ?? "#ffffff";
  const text = props.textColor ?? "#0f172a";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#ffffff", "#0f172a"]);
  const border = `${text}14`;
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const logoText = props.logoText || brand.name || "Brand";

  return (
    <header className="w-full border-b" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center">
          {props.logoUrl ? (
            <img src={props.logoUrl} alt={logoText} className="h-8 w-auto object-contain" />
          ) : (
            <span className="text-xl font-extrabold tracking-tight" style={{ color: text, fontFamily: DISPLAY }}>
              {logoText}
            </span>
          )}
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
            source="minimal-nav-cta"
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
          >
            {props.ctaLabel}
          </CtaButton>
        )}
      </div>
    </header>
  );
}
