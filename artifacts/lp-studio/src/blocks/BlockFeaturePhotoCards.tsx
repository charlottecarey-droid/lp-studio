import type { BrandConfig } from "@/lib/brand-config";
import type {
  FeaturePhotoCardsBlockProps,
  SectionFeatureItem,
} from "@/lib/block-types";
import { cn } from "@/lib/utils";
import { BRAND_BODY_FONT } from "@/lib/brand-fonts";
import {
  alignTextClass,
  sectionRadiusClass,
  useSectionTheme,
  SectionHeader,
  SectionIconVisual,
  SectionItemTitle,
  SectionItemBody,
  SectionCtas,
} from "./shared/section-kit";

interface Props {
  props: FeaturePhotoCardsBlockProps;
  brand: BrandConfig;
  onFieldChange?: (updated: FeaturePhotoCardsBlockProps) => void;
  pageId?: number;
  variantId?: number;
  onCtaClick?: (url: string) => void;
}

/**
 * Feature — photo cards.
 *
 * Feature cards that lead with a photo/visual. Each card stacks a large,
 * radius-clipped visual (an image renders LARGE via `SectionIconVisual`, an
 * icon sits small inside a tinted tile) above a card body that carries the
 * title + description. Every color, type style, alignment, radius, and CTA
 * decision flows through the shared `section-kit` toolkit so this block reads
 * and edits identically to its graduated siblings.
 */
export function BlockFeaturePhotoCards({
  props,
  brand,
  onFieldChange,
  pageId,
  variantId,
  onCtaClick,
}: Props) {
  const isBuilder = !!onFieldChange;
  const theme = useSectionTheme(props, brand);
  const align = props.align ?? "center";
  const items = props.items ?? [];
  const radius = sectionRadiusClass(props.cardRadius);

  const update = (patch: Partial<FeaturePhotoCardsBlockProps>) =>
    onFieldChange?.({ ...props, ...patch });
  const updateHeader = (key: "eyebrow" | "heading" | "subhead", value: string) =>
    update({ [key]: value });
  const updateItem = (i: number, patch: Partial<SectionFeatureItem>) =>
    update({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        background: theme.surface.background,
        color: theme.ink,
        fontFamily: BRAND_BODY_FONT,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow={props.eyebrow}
          heading={props.heading}
          subhead={props.subhead}
          align={align}
          theme={theme}
          brand={brand}
          isBuilder={isBuilder}
          onUpdate={updateHeader}
        />

        {items.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 sm:mt-16 md:grid-cols-3 lg:max-w-none">
            {items.map((item, i) => (
              <div
                key={i}
                className={cn("group flex flex-col p-3", radius)}
                style={{
                  backgroundColor: theme.cardBg,
                  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.25)",
                }}
              >
                <div
                  className={cn(
                    "flex items-center justify-center overflow-hidden",
                    radius,
                  )}
                  style={{
                    aspectRatio: "3 / 4",
                    backgroundColor: `color-mix(in srgb, ${theme.cardInk} 8%, ${theme.cardBg})`,
                  }}
                >
                  <SectionIconVisual
                    value={item.icon}
                    color={theme.cardAccent}
                    imageClassName="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    tileClassName="h-16 w-16"
                    tileBg={`color-mix(in srgb, ${theme.cardAccent} 12%, ${theme.cardBg})`}
                    radiusClass={radius}
                    alt={item.title}
                  />
                </div>

                <div className={cn("px-2 pb-1 pt-5", alignTextClass(align))}>
                  <SectionItemTitle
                    value={item.title}
                    onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                    color={theme.cardInk}
                  />
                  <SectionItemBody
                    value={item.description}
                    onUpdate={isBuilder ? (v) => updateItem(i, { description: v }) : undefined}
                    color={theme.cardMuted}
                    className="mt-2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionCtas
          props={props}
          brand={brand}
          theme={theme}
          align={align}
          isBuilder={isBuilder}
          onUpdate={update}
          pageId={pageId}
          variantId={variantId}
          source="feature-photo-cards"
          onCtaClick={onCtaClick}
        />
      </div>
    </section>
  );
}
