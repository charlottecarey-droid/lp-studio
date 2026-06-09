import { ArrowRight, Sparkles } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { PasSplitImageBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: PasSplitImageBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: PasSplitImageBlockProps) => void;
}

export function BlockPasSplitImage({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const mediaRight = (props.mediaSide ?? "right") === "right";

  const update = <K extends keyof PasSplitImageBlockProps>(key: K, value: PasSplitImageBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  const copy = (
    <div className="flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20" style={{ color: ink, fontFamily: BODY }}>
      <div className="mx-auto w-full max-w-xl lg:mx-0">
        {(props.eyebrow || onFieldChange) && (
          <InlineText
            as="p"
            value={props.eyebrow ?? ""}
            onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
            className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: accent }}
          />
        )}
        <InlineText
          as="h2"
          value={props.problemHeading}
          onUpdate={onFieldChange ? (v) => update("problemHeading", v) : undefined}
          className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.75rem]"
          style={{ color: ink, fontFamily: DISPLAY }}
        />
        {(props.problemBody || onFieldChange) && (
          <InlineText
            as="p"
            value={props.problemBody ?? ""}
            onUpdate={onFieldChange ? (v) => update("problemBody", v) : undefined}
            className="mt-5 max-w-prose text-base leading-relaxed sm:text-lg"
            style={{ color: muted }}
            multiline
          />
        )}
        {(props.agitateBody || onFieldChange) && (
          <InlineText
            as="p"
            value={props.agitateBody ?? ""}
            onUpdate={onFieldChange ? (v) => update("agitateBody", v) : undefined}
            className="mt-4 max-w-prose border-l-2 pl-4 text-base font-medium italic leading-relaxed sm:text-lg"
            style={{ color: ink, borderColor: `${ink}1f` }}
            multiline
          />
        )}
        {(props.solutionHeading || props.solutionBody || onFieldChange) && (
          <div
            className="mt-9 rounded-2xl border p-6 sm:p-7"
            style={{
              background: `color-mix(in srgb, ${accent} 8%, transparent)`,
              borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
            }}
          >
            {(props.solutionHeading || onFieldChange) && (
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: accent, color: onAccent }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <InlineText
                  as="h3"
                  value={props.solutionHeading ?? ""}
                  onUpdate={onFieldChange ? (v) => update("solutionHeading", v) : undefined}
                  className="text-lg font-bold leading-snug sm:text-xl"
                  style={{ color: ink, fontFamily: DISPLAY }}
                />
              </div>
            )}
            {(props.solutionBody || onFieldChange) && (
              <InlineText
                as="p"
                value={props.solutionBody ?? ""}
                onUpdate={onFieldChange ? (v) => update("solutionBody", v) : undefined}
                className="mt-2.5 text-base leading-relaxed"
                style={{ color: muted }}
                multiline
              />
            )}
          </div>
        )}
        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-9">
            <CtaButton
              {...pickCtaModalConfig(props)}
              ctaAction={props.ctaAction ?? "url"}
              ctaUrl={props.ctaUrl}
              chilipiperUrl={props.chilipiperUrl}
              videoUrl={props.videoUrl}
              videoPosterUrl={props.videoPosterUrl}
              brand={brand}
              source="pas-split-image-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Get started"}
              <ArrowRight className="h-4 w-4" />
            </CtaButton>
          </div>
        )}
      </div>
    </div>
  );

  const media = (
    <div className="flex items-stretch p-6 sm:p-10 lg:p-10">
      <div className="relative w-full overflow-hidden rounded-3xl shadow-2xl">
        <div className="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[28rem]">
          <InlineImage
            src={props.imageUrl ?? ""}
            alt={props.imageAlt || props.problemHeading || "Section image"}
            onUpdate={onFieldChange ? (src) => update("imageUrl", src) : undefined}
            className="h-full w-full object-cover"
            wrapperClassName="block h-full w-full"
          />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/10" />
      </div>
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden" style={{ background: surface.background }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-2 lg:grid-cols-2 lg:gap-8">
        {mediaRight ? (
          <>
            <div className="order-2 lg:order-1">{copy}</div>
            <div className="order-1 lg:order-2">{media}</div>
          </>
        ) : (
          <>
            <div className="order-1">{media}</div>
            <div className="order-2">{copy}</div>
          </>
        )}
      </div>
    </section>
  );
}
