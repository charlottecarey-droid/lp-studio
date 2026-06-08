import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { SplitMediaRowBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";
import { resolveSectionSurface } from "@/lib/bg-styles";

interface Props {
  props: SplitMediaRowBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: SplitMediaRowBlockProps) => void;
}

export function BlockSplitMediaRow({ props, brand, onFieldChange }: Props) {
  const surface = resolveSectionSurface(props, "#FFFFFF");
  const ink = props.textColor ?? surface.color ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);
  const muted = pickContrastingColor(undefined, surface.base, ["#64748B", "#94A3B8"]);
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const mediaRight = (props.mediaSide ?? "right") === "right";
  const bullets = props.bullets ?? [];

  const update = <K extends keyof SplitMediaRowBlockProps>(key: K, value: SplitMediaRowBlockProps[K]) =>
    onFieldChange?.({ ...props, [key]: value });

  return (
    <section className="w-full py-20 sm:py-28" style={{ background: surface.background, color: ink, fontFamily: BODY }}>
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-6 md:grid-cols-2 md:px-12">
        <div className={mediaRight ? "md:order-1" : "md:order-2"}>
          {props.eyebrow !== undefined && (
            <InlineText
              as="p"
              value={props.eyebrow}
              onUpdate={onFieldChange ? (v) => update("eyebrow", v) : undefined}
              className="mb-3 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: accent }}
            />
          )}
          <InlineText
            as="h2"
            value={props.heading}
            onUpdate={onFieldChange ? (v) => update("heading", v) : undefined}
            className="text-3xl font-extrabold tracking-tight sm:text-4xl"
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
          {bullets.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: ink }}>
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
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
                source="split-media-row-cta"
                className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold shadow-sm"
                style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
              >
                {props.ctaLabel || "Learn more"}
              </CtaButton>
            </div>
          )}
        </div>
        <div className={mediaRight ? "md:order-2" : "md:order-1"}>
          <InlineImage
            src={props.imageUrl ?? ""}
            alt={props.imageAlt || props.heading || "Section image"}
            onUpdate={onFieldChange ? (src) => update("imageUrl", src) : undefined}
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg"
            wrapperClassName="block w-full"
          />
        </div>
      </div>
    </section>
  );
}
