import type { BrandConfig } from "@/lib/brand-config";
import { pickContrastingColor } from "@/lib/brand-config";
import type { GalleryMasonryBlockProps } from "@/lib/block-types";
import { InlineText } from "@/components/InlineText";
import { InlineImage } from "@/components/InlineImage";
import { CtaButton } from "@/components/CtaButton";
import { BRAND_BODY_FONT, BRAND_DISPLAY_FONT } from "@/lib/brand-fonts";

interface Props {
  props: GalleryMasonryBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: GalleryMasonryBlockProps) => void;
}

export function BlockGalleryMasonry({ props, brand, onFieldChange }: Props) {
  const bg = props.bgColor ?? "#FFFFFF";
  const ink = props.textColor ?? "#0F172A";
  const accent = props.accentColor ?? brand.primaryColor ?? "#4f46e5";
  const DISPLAY = props.headlineFont || BRAND_DISPLAY_FONT;
  const BODY = props.bodyFont || BRAND_BODY_FONT;
  const muted = pickContrastingColor(undefined, bg, ["#64748B", "#94A3B8"]);
  const onAccent = pickContrastingColor(undefined, accent, ["#FFFFFF", "#0F172A"]);

  const images = props.images ?? [];

  const update = <K extends keyof GalleryMasonryBlockProps>(
    key: K,
    value: GalleryMasonryBlockProps[K],
  ) => onFieldChange?.({ ...props, [key]: value });

  const updateImage = (i: number, patch: Partial<GalleryMasonryBlockProps["images"][number]>) => {
    if (!onFieldChange) return;
    const next = images.map((img, idx) => (idx === i ? { ...img, ...patch } : img));
    onFieldChange({ ...props, images: next });
  };

  return (
    <section className="w-full py-24 sm:py-32 flex flex-col items-center" style={{ backgroundColor: bg, color: ink }}>
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          {(props.eyebrow || onFieldChange) && (
            <InlineText
              as="span"
              value={props.eyebrow ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("eyebrow", v) : undefined}
              className="text-sm font-bold uppercase tracking-widest mb-4 block"
              style={{ color: accent, fontFamily: BODY }} />
          )}
          <InlineText
            as="h2"
            value={props.headline}
            onUpdate={onFieldChange ? (v: string) => update("headline", v) : undefined}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6"
            style={{ color: ink, fontFamily: DISPLAY }} />
          {(props.subheadline || onFieldChange) && (
            <InlineText
              as="p"
              value={props.subheadline ?? ""}
              onUpdate={onFieldChange ? (v: string) => update("subheadline", v) : undefined}
              className="text-lg"
              style={{ color: muted, fontFamily: BODY }} />
          )}
        </div>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {images.map((img, idx) => (
            <div key={img.id} className={`relative overflow-hidden rounded-2xl break-inside-avoid ${img.aspect || "aspect-[4/3]"} group`}>
              <InlineImage
                src={img.src}
                alt={img.alt || img.caption}
                onUpdate={onFieldChange ? (src: string) => updateImage(idx, { src }) : undefined}
                onAltUpdate={onFieldChange ? (alt: string) => updateImage(idx, { alt }) : undefined}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                wrapperClassName="block absolute inset-0 w-full h-full"
              />
            </div>
          ))}
        </div>

        {(props.ctaLabel || onFieldChange) && (
          <div className="mt-16 flex justify-center">
            <CtaButton
              ctaAction="url"
              ctaUrl={props.ctaUrl}
              brand={brand}
              source="gallery-masonry-cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
              style={{ backgroundColor: accent, color: onAccent, fontFamily: BODY }}
            >
              {props.ctaLabel || "Join our team"}
            </CtaButton>
          </div>
        )}
      </div>
    </section>
  );
}
