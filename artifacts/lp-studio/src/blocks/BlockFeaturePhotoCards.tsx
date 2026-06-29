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
  SectionItemMedia,
  sectionItemVisualValue,
  SectionItemTitle,
  SectionItemBody,
  SectionItemLink,
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
 * Tall photo cards (3:4) each with a floating caption card overlapping the
 * bottom edge. When an item has no photo (the AI generator is icon-led and never
 * emits image URLs) the photo frame degrades to a premium accent-tinted panel
 * with the item's icon centered — never an empty image box. Every color, type
 * style, alignment, radius, and CTA decision flows through the shared
 * `section-kit` toolkit so all siblings read and edit identically.
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

  // Backstop tint behind the photo frame — derived, no baked literal.
  const frameTint = `color-mix(in srgb, ${theme.ink} 8%, ${theme.surface.base})`;

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
          align="center"
          theme={theme}
          brand={brand}
          isBuilder={isBuilder}
          onUpdate={updateHeader}
        />

        {items.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-1 gap-6 pb-2 sm:mt-16 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <div key={i} className="group relative">
                <div
                  className={cn("aspect-[3/4] w-full overflow-hidden", radius)}
                  style={{ backgroundColor: frameTint }}
                >
                  <SectionItemMedia
                    value={sectionItemVisualValue(item)}
                    accent={theme.accent}
                    base={theme.surface.base}
                    alt={item.title}
                    imgClassName="transition-transform duration-700 group-hover:scale-105"
                    iconClassName="h-12 w-12"
                  />
                </div>
                <div
                  className={cn(
                    "absolute bottom-4 left-4 right-10 p-5 sm:p-6",
                    radius,
                    alignTextClass(align),
                  )}
                  style={{
                    backgroundColor: theme.cardBg,
                    boxShadow: "0 16px 40px -16px rgba(0,0,0,0.35)",
                  }}
                >
                  <SectionItemTitle
                    value={item.title}
                    onUpdate={isBuilder ? (v) => updateItem(i, { title: v }) : undefined}
                    color={theme.cardInk}
                  />
                  <SectionItemBody
                    value={item.description}
                    onUpdate={
                      isBuilder ? (v) => updateItem(i, { description: v }) : undefined
                    }
                    color={theme.cardMuted}
                    className="mt-2"
                  />
                  <SectionItemLink
                    label={item.linkLabel}
                    url={item.linkUrl}
                    color={theme.cardAccent}
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
          align="center"
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
