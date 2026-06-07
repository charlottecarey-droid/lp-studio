import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { FullBleedSplitBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: FullBleedSplitBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FullBleedSplitBlockProps) => void;
}

export function BlockFullBleedSplit({ props, brand, onFieldChange }: Props) {
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const panelBg = props.panelBgColor ?? accent;
  const ink = props.textColor ?? pickContrastingColor(undefined, panelBg, ["#FFFFFF", "#0F172A"]);
  const muted = `${ink}CC`;
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const mediaRight = (props.mediaSide ?? "right") === "right";

  const update = <K extends keyof FullBleedSplitBlockProps>(key: K, value: FullBleedSplitBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const panel = (
    <div className="flex items-center px-6 py-16 sm:px-12 lg:px-16" style={{ backgroundColor: panelBg, color: ink, fontFamily: BODY }}>
      <div className="mx-auto w-full max-w-lg">
        {props.eyebrow !== undefined && (
          <InlineText
            as="p"
            value={props.eyebrow}
            onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
            className="mb-3 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: ink, opacity: 0.85 }}
          />
        )}
        <InlineText
          as="h2"
          value={props.heading}
          onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
          className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
          style={{ color: ink, fontFamily: DISPLAY }}
        />
        {props.body !== undefined && (
          <InlineText
            as="p"
            value={props.body}
            onUpdate={onFieldChange ? (v) => update("body", v) : undefined}
            className="mt-4 text-base leading-relaxed"
            style={{ color: muted }}
          />
        )}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-8">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="full-bleed-split-cta"
              className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Get started"}
            </CtaButton>
          </div>
        )}
      </div>
    </div>
  );

  const media = (
    <InlineImage
      src={props.imageUrl ?? ""}
      alt={props.imageAlt || props.heading || "Section image"}
      onUpdate={onFieldChange ? (src) => update("imageUrl", src) : undefined}
      className="h-64 w-full object-cover md:h-full"
      wrapperClassName="block h-64 w-full md:h-full"
    />
  );

  return (
    <section className="grid w-full grid-cols-1 md:grid-cols-2">
      {mediaRight ? (<>{panel}{media}</>) : (<>{media}{panel}</>)}
    </section>
  );
}
