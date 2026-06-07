import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasSplitImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: PasSplitImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSplitImageBlockProps) => void;
}

export function BlockPasSplitImage({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const mediaRight = (props.mediaSide ?? "right") === "right";

  const update = <K extends keyof PasSplitImageBlockProps>(key: K, value: PasSplitImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const copy = (
    <div className="flex items-center px-6 py-16 sm:px-12 lg:px-16" style={{ backgroundColor: bg, color: ink, fontFamily: BODY }}>
      <div className="mx-auto w-full max-w-lg">
        {(props.eyebrow || onFieldChange) && (
          <InlineText as="p" value={props.eyebrow ?? ""} onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined} className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }} />
        )}
        <InlineText as="h2" value={props.problemHeading} onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined} className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: ink, fontFamily: DISPLAY }} />
        {(props.problemBody || onFieldChange) && (
          <InlineText as="p" value={props.problemBody ?? ""} onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined} className="mt-4 text-base leading-relaxed" style={{ color: muted }} multiline />
        )}
        {(props.agitateBody || onFieldChange) && (
          <InlineText as="p" value={props.agitateBody ?? ""} onUpdate={onFieldChange ? (v) => update("agitateBody", v) : undefined} className="mt-3 text-base font-medium leading-relaxed" style={{ color: ink }} multiline />
        )}
        {(props.solutionHeading || onFieldChange) && (
          <InlineText as="h3" value={props.solutionHeading ?? ""} onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined} className="mt-8 text-xl font-bold" style={{ color: ink, fontFamily: DISPLAY }} />
        )}
        {(props.solutionBody || onFieldChange) && (
          <InlineText as="p" value={props.solutionBody ?? ""} onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined} className="mt-2 text-base leading-relaxed" style={{ color: muted }} multiline />
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
              source="pas-split-image-cta"
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
      alt={props.imageAlt || props.problemHeading || "Section image"}
      onUpdate={onFieldChange ? (src) => update("imageUrl", src) : undefined}
      className="h-64 w-full object-cover md:h-full"
      wrapperClassName="block h-64 w-full md:h-full"
    />
  );

  return (
    <section className="grid w-full grid-cols-1 md:grid-cols-2">
      {mediaRight ? (<>{copy}{media}</>) : (<>{media}{copy}</>)}
    </section>
  );
}
